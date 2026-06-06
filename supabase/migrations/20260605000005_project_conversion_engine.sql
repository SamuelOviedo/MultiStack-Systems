-- =============================================================================
-- Convert Ticket → Project engine.
--
-- Architectural note: proyectos_clientes IS the projects table — the entire
-- ecosystem (stages, services, maintenance, client portal RPCs, dashboard)
-- already hangs off it, and tickets.project_id already references it.
-- We extend it rather than forking a parallel `projects` table.
-- =============================================================================

-- ── Schema: scoping & ownership fields ───────────────────────────────────────
ALTER TABLE public.proyectos_clientes
  ADD COLUMN client_id         uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN lead_developer_id uuid  REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN requirements      jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN deadline          date,
  ADD COLUMN source_ticket_id  uuid  REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX idx_proyectos_client_id ON public.proyectos_clientes(client_id);
CREATE INDEX idx_proyectos_lead_dev  ON public.proyectos_clientes(lead_developer_id);

-- ── Tickets: 'convertido' terminal status for converted leads ────────────────
ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('abierto','en_revision','asignado','en_progreso','resuelto','cerrado','convertido'));

-- ── RLS: proyectos_clientes ──────────────────────────────────────────────────
-- Existing "own projects" policies (user_id owner) remain. Added matrix:
--   admin (0)            → global CRUD
--   lead developer       → read/update their projects
--   sub-ticket assignee  → read parent project
--   client (client_id)   → read own projects

CREATE POLICY "admin manages all projects"
  ON public.proyectos_clientes FOR ALL
  USING (public.get_user_type() = 0)
  WITH CHECK (public.get_user_type() = 0);

CREATE POLICY "lead dev reads project"
  ON public.proyectos_clientes FOR SELECT
  TO authenticated
  USING (lead_developer_id = auth.uid());

CREATE POLICY "lead dev updates project"
  ON public.proyectos_clientes FOR UPDATE
  TO authenticated
  USING (lead_developer_id = auth.uid())
  WITH CHECK (lead_developer_id = auth.uid());

CREATE POLICY "subticket assignee reads parent project"
  ON public.proyectos_clientes FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.project_id = proyectos_clientes.id AND t.assigned_to = auth.uid()
  ));

CREATE POLICY "client reads own project"
  ON public.proyectos_clientes FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

-- ── RLS: sub-tables follow the lead-dev + admin model ────────────────────────
CREATE POLICY "admin manages all project stages"
  ON public.project_stages FOR ALL
  USING (public.get_user_type() = 0)
  WITH CHECK (public.get_user_type() = 0);

CREATE POLICY "lead dev manages project stages"
  ON public.project_stages FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_stages.project_id AND p.lead_developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_stages.project_id AND p.lead_developer_id = auth.uid()
  ));

CREATE POLICY "admin manages all project services"
  ON public.project_services FOR ALL
  USING (public.get_user_type() = 0)
  WITH CHECK (public.get_user_type() = 0);

CREATE POLICY "lead dev manages project services"
  ON public.project_services FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_services.project_id AND p.lead_developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_services.project_id AND p.lead_developer_id = auth.uid()
  ));

CREATE POLICY "admin manages all project maintenance"
  ON public.project_maintenance FOR ALL
  USING (public.get_user_type() = 0)
  WITH CHECK (public.get_user_type() = 0);

CREATE POLICY "lead dev manages project maintenance"
  ON public.project_maintenance FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_maintenance.project_id AND p.lead_developer_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes p
    WHERE p.id = project_maintenance.project_id AND p.lead_developer_id = auth.uid()
  ));

-- ── Atomic conversion: single SECURITY DEFINER transaction ──────────────────
CREATE OR REPLACE FUNCTION public.convert_ticket_to_project(
  p_ticket_id         uuid,
  p_title             text,
  p_description       text,
  p_lead_developer_id uuid,
  p_deadline          date,
  p_requirements      jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket     tickets%ROWTYPE;
  v_client_id  uuid;
  v_project_id uuid;
BEGIN
  -- Admin-only operation
  IF public.get_user_type() IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Solo administradores pueden convertir tickets a proyectos';
  END IF;

  SELECT * INTO v_ticket FROM tickets WHERE id = p_ticket_id;
  IF v_ticket.id IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;
  IF v_ticket.project_id IS NOT NULL THEN
    RAISE EXCEPTION 'El ticket ya pertenece a un proyecto';
  END IF;

  -- Link the client profile when the lead's email matches a registered user
  SELECT id INTO v_client_id
  FROM profiles
  WHERE lower(email) = lower(v_ticket.client_email)
  LIMIT 1;

  INSERT INTO proyectos_clientes (
    user_id, nombre_proyecto, descripcion, estado,
    client_name, client_email,
    client_id, lead_developer_id, requirements, deadline, source_ticket_id
  ) VALUES (
    auth.uid(), p_title, p_description, 'en_analisis',
    v_ticket.client_name, v_ticket.client_email,
    v_client_id, p_lead_developer_id,
    COALESCE(p_requirements, '{}'::jsonb), p_deadline, p_ticket_id
  )
  RETURNING id INTO v_project_id;

  -- Close the loop on the trigger ticket — same transaction, fully atomic
  UPDATE tickets SET
    status      = 'convertido',
    project_id  = v_project_id,
    assigned_to = COALESCE(assigned_to, p_lead_developer_id),
    updated_at  = now()
  WHERE id = p_ticket_id;

  RETURN v_project_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.convert_ticket_to_project(uuid,text,text,uuid,date,jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.convert_ticket_to_project(uuid,text,text,uuid,date,jsonb) TO authenticated;
