-- =============================================================================
-- MultiStack Systems — Schema final consolidado
-- Generado: 2026-05-13
-- Reemplaza las 6 migrations anteriores
-- =============================================================================

-- ── Profiles ──────────────────────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email     text,
  user_type integer NOT NULL DEFAULT 2
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: auto-create profile en signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, user_type)
  VALUES (NEW.id, NEW.email, 2)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Proyectos clientes ────────────────────────────────────────────────────────
CREATE TABLE public.proyectos_clientes (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_proyecto text NOT NULL,
  descripcion     text,
  estado          text NOT NULL DEFAULT 'en_analisis',
  fecha_creacion  timestamptz NOT NULL DEFAULT now(),
  client_name     text,
  client_email    text,
  client_phone    text,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.proyectos_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select own projects"
  ON public.proyectos_clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "insert own projects"
  ON public.proyectos_clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update own projects"
  ON public.proyectos_clientes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "delete own projects"
  ON public.proyectos_clientes FOR DELETE
  USING (auth.uid() = user_id);

-- ── Project stages ────────────────────────────────────────────────────────────
CREATE TABLE public.project_stages (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   uuid NOT NULL REFERENCES public.proyectos_clientes(id) ON DELETE CASCADE,
  stage_key    text NOT NULL,
  stage_label  text NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by text,
  notes        text,
  metadata     jsonb DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  UNIQUE(project_id, stage_key)
);

ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own project stages"
  ON public.project_stages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = project_stages.project_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = project_stages.project_id AND user_id = auth.uid()
  ));

-- ── Project services ──────────────────────────────────────────────────────────
CREATE TABLE public.project_services (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   uuid NOT NULL REFERENCES public.proyectos_clientes(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('domain','hosting','database','cdn','other')),
  provider     text NOT NULL,
  name         text NOT NULL,
  url          text,
  cost_monthly numeric(10,2),
  cost_yearly  numeric(10,2),
  currency     text DEFAULT 'USD',
  renewal_date date,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own project services"
  ON public.project_services FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = project_services.project_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = project_services.project_id AND user_id = auth.uid()
  ));

-- ── Project maintenance ───────────────────────────────────────────────────────
CREATE TABLE public.project_maintenance (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES public.proyectos_clientes(id) ON DELETE CASCADE,
  month         date NOT NULL,
  status        text NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente','en_proceso','completado')),
  tasks_done    text[],
  notes         text,
  billed        boolean DEFAULT false,
  billed_amount numeric(10,2),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(project_id, month)
);

ALTER TABLE public.project_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own project maintenance"
  ON public.project_maintenance FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = project_maintenance.project_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = project_maintenance.project_id AND user_id = auth.uid()
  ));

-- ── Tickets ───────────────────────────────────────────────────────────────────
-- project_id nullable: permite solicitudes sin proyecto asignado (tipo-2)
CREATE TABLE public.tickets (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  uuid REFERENCES public.proyectos_clientes(id) ON DELETE CASCADE,
  client_name  text,
  client_email text,
  type        text NOT NULL CHECK (type IN ('modificacion','bug','consulta','pago','mantenimiento','otro','solicitud')),
  priority    text NOT NULL DEFAULT 'media' CHECK (priority IN ('baja','media','alta','urgente')),
  status      text NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','en_revision','en_progreso','resuelto','cerrado')),
  title       text NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Team: acceso total a tickets de sus proyectos
CREATE POLICY "team manages tickets"
  ON public.tickets FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = tickets.project_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = tickets.project_id AND user_id = auth.uid()
  ));

-- Cliente tipo-2: puede crear solicitudes sin proyecto
CREATE POLICY "client inserts own solicitud"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    project_id IS NULL
    AND client_email = auth.email()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type = 2
    )
  );

-- Cliente tipo-2: puede leer sus propias solicitudes
CREATE POLICY "client reads own solicitudes"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    project_id IS NULL
    AND client_email = auth.email()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND user_type = 2
    )
  );

-- ── Ticket messages ───────────────────────────────────────────────────────────
CREATE TABLE public.ticket_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id   uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('client','team')),
  sender_name text NOT NULL,
  message     text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team manages ticket messages"
  ON public.ticket_messages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.proyectos_clientes p ON p.id = t.project_id
    WHERE t.id = ticket_messages.ticket_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t
    JOIN public.proyectos_clientes p ON p.id = t.project_id
    WHERE t.id = ticket_messages.ticket_id AND p.user_id = auth.uid()
  ));

-- ── Client access tokens ──────────────────────────────────────────────────────
CREATE TABLE public.client_access_tokens (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id       uuid NOT NULL REFERENCES public.proyectos_clientes(id) ON DELETE CASCADE,
  token            text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  client_name      text,
  client_email     text,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  last_accessed_at timestamptz
);

ALTER TABLE public.client_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team manages client tokens"
  ON public.client_access_tokens FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = client_access_tokens.project_id AND user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.proyectos_clientes
    WHERE id = client_access_tokens.project_id AND user_id = auth.uid()
  ));

-- ── Portal RPC functions (SECURITY DEFINER — bypass RLS para acceso por token)
CREATE OR REPLACE FUNCTION public.portal_get_project(p_token text)
RETURNS TABLE(
  id uuid, nombre_proyecto text, descripcion text, estado text,
  client_name text, client_email text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE client_access_tokens
  SET last_accessed_at = now()
  WHERE token = p_token AND active = true;

  RETURN QUERY
  SELECT p.id, p.nombre_proyecto, p.descripcion, p.estado, p.client_name, p.client_email
  FROM proyectos_clientes p
  JOIN client_access_tokens t ON t.project_id = p.id
  WHERE t.token = p_token AND t.active = true;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_tickets(p_token text)
RETURNS TABLE(
  id uuid, project_id uuid, client_name text, client_email text,
  type text, priority text, status text, title text, description text,
  created_at timestamptz, updated_at timestamptz, resolved_at timestamptz,
  message_count bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT cat.project_id INTO v_project_id
  FROM client_access_tokens cat
  WHERE cat.token = p_token AND cat.active = true;

  IF v_project_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    t.id, t.project_id, t.client_name, t.client_email,
    t.type, t.priority, t.status, t.title, t.description,
    t.created_at, t.updated_at, t.resolved_at,
    COUNT(m.id)::bigint AS message_count
  FROM tickets t
  LEFT JOIN ticket_messages m ON m.ticket_id = t.id
  WHERE t.project_id = v_project_id
  GROUP BY t.id
  ORDER BY t.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_create_ticket(
  p_token       text,
  p_client_name text,
  p_client_email text,
  p_type        text,
  p_title       text,
  p_description text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_id uuid;
  v_ticket_id  uuid;
BEGIN
  SELECT cat.project_id INTO v_project_id
  FROM client_access_tokens cat
  WHERE cat.token = p_token AND cat.active = true;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  INSERT INTO tickets(project_id, client_name, client_email, type, title, description)
  VALUES (v_project_id, p_client_name, p_client_email, p_type, p_title, p_description)
  RETURNING id INTO v_ticket_id;

  RETURN v_ticket_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_get_messages(p_token text, p_ticket_id uuid)
RETURNS TABLE(
  id uuid, ticket_id uuid, sender_type text, sender_name text, message text, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_id uuid;
BEGIN
  SELECT cat.project_id INTO v_project_id
  FROM client_access_tokens cat
  WHERE cat.token = p_token AND cat.active = true;

  IF v_project_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT m.id, m.ticket_id, m.sender_type, m.sender_name, m.message, m.created_at
  FROM ticket_messages m
  JOIN tickets t ON t.id = m.ticket_id
  WHERE m.ticket_id = p_ticket_id AND t.project_id = v_project_id
  ORDER BY m.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_add_message(
  p_token       text,
  p_ticket_id   uuid,
  p_sender_name text,
  p_message     text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project_id uuid;
  v_msg_id     uuid;
BEGIN
  SELECT cat.project_id INTO v_project_id
  FROM client_access_tokens cat
  WHERE cat.token = p_token AND cat.active = true;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid token';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tickets WHERE id = p_ticket_id AND project_id = v_project_id
  ) THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  INSERT INTO ticket_messages(ticket_id, sender_type, sender_name, message)
  VALUES (p_ticket_id, 'client', p_sender_name, p_message)
  RETURNING id INTO v_msg_id;

  UPDATE tickets SET updated_at = now() WHERE id = p_ticket_id;

  RETURN v_msg_id;
END;
$$;

-- Grant anon execute para que portal funcione sin auth
GRANT EXECUTE ON FUNCTION public.portal_get_project(text)                            TO anon;
GRANT EXECUTE ON FUNCTION public.portal_get_tickets(text)                            TO anon;
GRANT EXECUTE ON FUNCTION public.portal_create_ticket(text,text,text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.portal_get_messages(text, uuid)                     TO anon;
GRANT EXECUTE ON FUNCTION public.portal_add_message(text, uuid, text, text)          TO anon;
