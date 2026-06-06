-- =============================================================================
-- Public contact form: allow anon/authenticated INSERT into tickets.
-- Strictly scoped — the row must look exactly like an incoming contact lead:
--   · no project linkage, no assignee, default lifecycle entry status
--   · only lead-type categories
-- SELECT / UPDATE / DELETE remain governed by the existing role policies:
--   admin (0) global, collaborator (1) assigned-only, client (2) own rows.
-- =============================================================================

CREATE POLICY "public inserts contact lead"
  ON public.tickets FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    project_id  IS NULL
    AND assigned_to IS NULL
    AND status   = 'abierto'
    AND priority = 'media'
    AND type IN ('consulta', 'solicitud')
    AND client_email IS NOT NULL
  );
