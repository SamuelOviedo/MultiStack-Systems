-- =============================================================================
-- Security fix S5 — only staff can create or own projects
--
-- Before: "insert own projects" / "update own projects" (and five equivalent
-- policies created by hand outside migrations) only checked
-- auth.uid() = user_id. Any signed-in client could create a project through
-- the REST API, become its owner (user_id) and, through the "own project"
-- policies of the sub-tables, manage its stages, services, maintenance and
-- client portal tokens, or point lead_developer_id / client_id anywhere.
--
-- After:
--   · "own project" policies (projects and every sub-table) also require the
--     caller to be staff: admin (0) or collaborator (1). Collaborators keep
--     their current scope (the dashboard lets them create projects).
--   · clients (2) keep read access to their projects through client_id
--     ("client reads own project") and the token portal RPCs.
--   · user_id (the creator) can only be changed by an admin, so ownership —
--     and with it the sub-table access — cannot be handed to a client.
--   · the hand-made duplicates are removed (DROP ... IF EXISTS: they exist in
--     production only, never in a fresh database).
-- =============================================================================

-- ── Hand-made duplicates (production drift) ──────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own projects" ON public.proyectos_clientes;
DROP POLICY IF EXISTS "Users can update own projects" ON public.proyectos_clientes;
DROP POLICY IF EXISTS "Users can view own projects"   ON public.proyectos_clientes;
DROP POLICY IF EXISTS "usuario crea sus proyectos"    ON public.proyectos_clientes;
DROP POLICY IF EXISTS "usuario ve sus proyectos"      ON public.proyectos_clientes;

-- ── proyectos_clientes: creator policies become staff-only ───────────────────
DROP POLICY "select own projects" ON public.proyectos_clientes;
CREATE POLICY "select own projects"
  ON public.proyectos_clientes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.get_user_type() IN (0, 1));

DROP POLICY "insert own projects" ON public.proyectos_clientes;
CREATE POLICY "insert own projects"
  ON public.proyectos_clientes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.get_user_type() IN (0, 1));

DROP POLICY "update own projects" ON public.proyectos_clientes;
CREATE POLICY "update own projects"
  ON public.proyectos_clientes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.get_user_type() IN (0, 1))
  WITH CHECK (user_id = auth.uid() AND public.get_user_type() IN (0, 1));

DROP POLICY "delete own projects" ON public.proyectos_clientes;
CREATE POLICY "delete own projects"
  ON public.proyectos_clientes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND public.get_user_type() IN (0, 1));

-- ── Sub-tables: "own project" access also requires staff ─────────────────────
DROP POLICY "manage own project stages" ON public.project_stages;
CREATE POLICY "manage own project stages"
  ON public.project_stages FOR ALL
  TO authenticated
  USING (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_stages.project_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_stages.project_id AND p.user_id = auth.uid()
  ));

DROP POLICY "manage own project services" ON public.project_services;
CREATE POLICY "manage own project services"
  ON public.project_services FOR ALL
  TO authenticated
  USING (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_services.project_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_services.project_id AND p.user_id = auth.uid()
  ));

DROP POLICY "manage own project maintenance" ON public.project_maintenance;
CREATE POLICY "manage own project maintenance"
  ON public.project_maintenance FOR ALL
  TO authenticated
  USING (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_maintenance.project_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_maintenance.project_id AND p.user_id = auth.uid()
  ));

DROP POLICY "team manages client tokens" ON public.client_access_tokens;
CREATE POLICY "team manages client tokens"
  ON public.client_access_tokens FOR ALL
  TO authenticated
  USING (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = client_access_tokens.project_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (public.get_user_type() IN (0, 1) AND EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = client_access_tokens.project_id AND p.user_id = auth.uid()
  ));

-- ── Only admins re-assign the creator (user_id) ──────────────────────────────
-- "lead dev updates project" checks lead_developer_id only, so without this a
-- lead developer could hand the project (and its sub-tables) to anyone.
CREATE OR REPLACE FUNCTION public.proyectos_guard_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND NEW.user_id IS DISTINCT FROM OLD.user_id
     AND public.get_user_type() IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'only admins can change proyectos_clientes.user_id'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.proyectos_guard_owner() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER proyectos_guard_owner
  BEFORE UPDATE ON public.proyectos_clientes
  FOR EACH ROW EXECUTE FUNCTION public.proyectos_guard_owner();
