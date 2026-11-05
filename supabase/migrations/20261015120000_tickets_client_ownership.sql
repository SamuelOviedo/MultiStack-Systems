-- =============================================================================
-- Security fix S17 — stop authorizing clients by e-mail match
--
-- Before: a client (user_type 2) could read every request without a project
-- whose client_email equals auth.email(), and convert_ticket_to_project linked
-- the new project to whichever profile had the lead's e-mail. With sign-ups
-- auto-confirmed (mailer_autoconfirm), auth.email() proves nothing: anyone
-- registering a stranger's address inherited that person's leads/projects.
--
-- After: ownership is an explicit, verified relation — tickets.client_id —
-- set by the database from the caller's session, never from user input:
--   · authenticated client inserts → client_id := auth.uid() (always)
--   · anonymous inserts (contact form) → client_id := NULL (no owner)
--   · only admins (or postgres / service_role) can change client_id later
--   · clients read requests where client_id = auth.uid()
--   · ticket → project conversion links client_id from the ticket, not e-mail
--
-- Deliberately NOT done here (needs a reviewed, manual step): backfilling
-- client_id on existing rows. Until then, pre-existing requests stay visible
-- to staff only; any backfill is a separate, reviewed manual step.
--
-- Compatible with the currently published frontend: it does not send
-- client_id; the trigger fills it.
-- =============================================================================

-- ── Column ───────────────────────────────────────────────────────────────────
ALTER TABLE public.tickets
  ADD COLUMN client_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_tickets_client_id ON public.tickets(client_id);

-- ── Ownership is set by the database, never trusted from the request ────────
-- SECURITY INVOKER: current_user is the API role for PostgREST calls and the
-- definer (postgres) inside SECURITY DEFINER functions / Dashboard edits.
CREATE OR REPLACE FUNCTION public.tickets_enforce_client_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user = 'anon' THEN
    -- Anonymous leads (contact form) never have an owner.
    NEW.client_id := NULL;
    RETURN NEW;
  END IF;

  IF current_user <> 'authenticated' THEN
    RETURN NEW;  -- postgres / service_role / SECURITY DEFINER paths
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF public.get_user_type() = 2 THEN
      NEW.client_id := auth.uid();   -- a client always owns what it creates
    ELSIF public.get_user_type() IS DISTINCT FROM 0 THEN
      NEW.client_id := NULL;         -- collaborators cannot assign owners
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: only admins may (re)link an owner.
  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     AND public.get_user_type() IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'only admins can change tickets.client_id'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.tickets_enforce_client_id() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER tickets_enforce_client_id
  BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tickets_enforce_client_id();

-- ── Client policies: by client_id instead of e-mail ──────────────────────────
DROP POLICY IF EXISTS "client reads own solicitudes" ON public.tickets;
CREATE POLICY "client reads own solicitudes"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    AND client_id = auth.uid()
    AND public.get_user_type() = 2
  );

DROP POLICY IF EXISTS "client inserts own solicitud" ON public.tickets;
CREATE POLICY "client inserts own solicitud"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    AND client_id = auth.uid()          -- filled by the trigger
    AND client_email = auth.email()     -- contact address stays the account's
    AND public.get_user_type() = 2
  );

-- ── Conversion: link the project owner from the ticket, never by e-mail ─────
CREATE OR REPLACE FUNCTION public.convert_ticket_to_project(
  p_ticket_id         uuid,
  p_title             text,
  p_description       text,
  p_lead_developer_id uuid,
  p_deadline          date,
  p_requirements      jsonb,
  p_google_docs_url   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ticket     tickets%ROWTYPE;
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

  -- Owner = the authenticated client that created the request (if any).
  -- Anonymous leads stay unlinked; an admin links them explicitly later.
  INSERT INTO proyectos_clientes (
    user_id, nombre_proyecto, descripcion, estado,
    client_name, client_email,
    client_id, lead_developer_id, requirements, deadline, source_ticket_id,
    google_docs_requirements_url
  ) VALUES (
    auth.uid(), p_title, p_description, 'en_analisis',
    v_ticket.client_name, v_ticket.client_email,
    v_ticket.client_id, p_lead_developer_id,
    COALESCE(p_requirements, '{}'::jsonb), p_deadline, p_ticket_id,
    NULLIF(trim(p_google_docs_url), '')
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

REVOKE EXECUTE ON FUNCTION public.convert_ticket_to_project(uuid,text,text,uuid,date,jsonb,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.convert_ticket_to_project(uuid,text,text,uuid,date,jsonb,text) TO authenticated;
