-- =============================================================================
-- Add google_docs_requirements_url to projects + thread it through conversion.
--
-- Captured during discovery meetings: a link to the external Google Docs where
-- the full requirements live. Editable from the project detail view and
-- pre-fillable at ticket→project conversion time.
-- =============================================================================

ALTER TABLE public.proyectos_clientes
  ADD COLUMN google_docs_requirements_url text;

-- ── Re-create the conversion RPC with the extra param ───────────────────────
-- Signature changes (7th arg), so drop the old overload to avoid ambiguity.
DROP FUNCTION IF EXISTS public.convert_ticket_to_project(uuid,text,text,uuid,date,jsonb);

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
    client_id, lead_developer_id, requirements, deadline, source_ticket_id,
    google_docs_requirements_url
  ) VALUES (
    auth.uid(), p_title, p_description, 'en_analisis',
    v_ticket.client_name, v_ticket.client_email,
    v_client_id, p_lead_developer_id,
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
