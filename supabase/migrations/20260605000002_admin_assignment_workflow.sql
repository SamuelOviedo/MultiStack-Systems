-- =============================================================================
-- Admin Dashboard & Project Assignment Workflow
-- Roles: 0 = Admin, 1 = Collaborator, 2 = Client (profiles.user_type)
-- =============================================================================

-- ── Helper: current user's role (SECURITY DEFINER — bypasses profiles RLS,
--    avoids recursive policy evaluation) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT user_type FROM public.profiles WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_user_type() TO authenticated;

-- ── Tickets: assignment column + 'asignado' lifecycle status ─────────────────
ALTER TABLE public.tickets
  ADD COLUMN assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tickets DROP CONSTRAINT tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('abierto','en_revision','asignado','en_progreso','resuelto','cerrado'));

CREATE INDEX idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_status      ON public.tickets(status);

-- ── Profiles: admins list all users (assignment dropdown role 0/1) ───────────
CREATE POLICY "admin reads all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_type() = 0);

-- ── Tickets: admin full access (read all, assign, manage lifecycle).
--    Multiple role-0 accounts share identical access. ─────────────────────────
CREATE POLICY "admin manages all tickets"
  ON public.tickets FOR ALL
  USING (public.get_user_type() = 0)
  WITH CHECK (public.get_user_type() = 0);

-- ── Tickets: collaborators see and update only what's assigned to them ──────
CREATE POLICY "collaborator reads assigned tickets"
  ON public.tickets FOR SELECT
  USING (public.get_user_type() = 1 AND assigned_to = auth.uid());

CREATE POLICY "collaborator updates assigned tickets"
  ON public.tickets FOR UPDATE
  USING (public.get_user_type() = 1 AND assigned_to = auth.uid())
  WITH CHECK (public.get_user_type() = 1 AND assigned_to = auth.uid());

-- ── Ticket messages: mirror the access model ─────────────────────────────────
CREATE POLICY "admin manages all ticket messages"
  ON public.ticket_messages FOR ALL
  USING (public.get_user_type() = 0)
  WITH CHECK (public.get_user_type() = 0);

CREATE POLICY "collaborator messages on assigned tickets"
  ON public.ticket_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id AND t.assigned_to = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_messages.ticket_id AND t.assigned_to = auth.uid()
  ));
