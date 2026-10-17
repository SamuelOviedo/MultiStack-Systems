-- =============================================================================
-- Fix S4 (database part) — no direct anonymous writes, bounded input sizes
--
-- Before: "public inserts contact lead" let anyone holding the public key
-- insert tickets straight through the REST API (no captcha, no rate limit,
-- no length limits), bypassing every check of the contact form. Client
-- requests could also be created already assigned or in any status.
--
-- After:
--   · the anonymous INSERT policy is removed. The contact form keeps working:
--     send-contact-email validates the lead and stores it with the
--     service-role client (which bypasses RLS) — that is the only public way
--     in, and where honeypot / throttling / captcha live.
--   · "client inserts own solicitud" only accepts a fresh, unassigned request.
--   · CHECK constraints cap free-text sizes on tickets, messages and projects
--     (generous limits, far above current data and UI usage).
-- =============================================================================

DROP POLICY IF EXISTS "public inserts contact lead" ON public.tickets;

DROP POLICY "client inserts own solicitud" ON public.tickets;
CREATE POLICY "client inserts own solicitud"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    AND client_id = auth.uid()          -- filled by the trigger (S17)
    AND client_email = auth.email()     -- contact address stays the account's
    AND type = 'solicitud'
    AND status = 'abierto'
    AND priority = 'media'
    AND assigned_to IS NULL
    AND public.get_user_type() = 2
  );

-- ── Size limits ──────────────────────────────────────────────────────────────
ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_title_len        CHECK (char_length(title) <= 200),
  ADD CONSTRAINT tickets_description_len  CHECK (char_length(description) <= 10000),
  ADD CONSTRAINT tickets_client_name_len  CHECK (char_length(client_name) <= 200),
  ADD CONSTRAINT tickets_client_email_len CHECK (char_length(client_email) <= 254);

ALTER TABLE public.ticket_messages
  ADD CONSTRAINT ticket_messages_message_len     CHECK (char_length(message) <= 10000),
  ADD CONSTRAINT ticket_messages_sender_name_len CHECK (char_length(sender_name) <= 200);

ALTER TABLE public.proyectos_clientes
  ADD CONSTRAINT proyectos_nombre_len       CHECK (char_length(nombre_proyecto) <= 200),
  ADD CONSTRAINT proyectos_descripcion_len  CHECK (char_length(descripcion) <= 10000),
  ADD CONSTRAINT proyectos_client_name_len  CHECK (char_length(client_name) <= 200),
  ADD CONSTRAINT proyectos_client_email_len CHECK (char_length(client_email) <= 254),
  ADD CONSTRAINT proyectos_client_phone_len CHECK (char_length(client_phone) <= 40);
