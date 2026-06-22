-- =============================================================================
-- Fix: "infinite recursion detected in policy for relation proyectos_clientes"
--
-- Cause — a mutual RLS reference between two tables:
--   • proyectos_clientes policy "subticket assignee reads parent project"
--       SELECTs from tickets.
--   • tickets policy "team manages tickets"
--       SELECTs from proyectos_clientes.
--
-- Evaluating either table re-triggers the other's RLS, which re-triggers the
-- first, looping until Postgres aborts. (project_stages / services / maintenance
-- also read proyectos_clientes, but one-directionally — no loop there.)
--
-- Fix — relocate both cross-table checks into SECURITY DEFINER functions, which
-- run with the owner's rights and DO NOT re-evaluate RLS. Same pattern already
-- proven by get_user_type(). Business logic is preserved verbatim:
--   • Project owner (user_id) keeps full ticket CRUD.
--   • A user assigned to any ticket on a project keeps SELECT on that project.
-- =============================================================================

-- ── Helpers (SECURITY DEFINER — bypass RLS, break the recursion) ─────────────
CREATE OR REPLACE FUNCTION public.user_owns_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = p_project_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.user_assigned_to_project(p_project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tickets
    WHERE project_id = p_project_id AND assigned_to = auth.uid()
  )
$$;

GRANT EXECUTE ON FUNCTION public.user_owns_project(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_assigned_to_project(uuid)  TO authenticated;

-- ── proyectos_clientes: replace the tickets-querying SELECT policy ───────────
DROP POLICY "subticket assignee reads parent project" ON public.proyectos_clientes;

CREATE POLICY "subticket assignee reads parent project"
  ON public.proyectos_clientes FOR SELECT
  TO authenticated
  USING (public.user_assigned_to_project(id));

-- ── tickets: replace the proyectos_clientes-querying owner policy ────────────
DROP POLICY "team manages tickets" ON public.tickets;

CREATE POLICY "team manages tickets"
  ON public.tickets FOR ALL
  USING (public.user_owns_project(project_id))
  WITH CHECK (public.user_owns_project(project_id));
