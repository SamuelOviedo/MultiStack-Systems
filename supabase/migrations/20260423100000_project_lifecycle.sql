-- Extend proyectos_clientes with client info and timestamps
ALTER TABLE public.proyectos_clientes
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS client_email text,
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Normalize existing estado values to new snake_case enum
UPDATE public.proyectos_clientes SET estado = 'en_analisis'    WHERE estado = 'En análisis';
UPDATE public.proyectos_clientes SET estado = 'en_desarrollo'  WHERE estado = 'Desarrollo';
UPDATE public.proyectos_clientes SET estado = 'activo'         WHERE estado = 'Finalizado';

-- project_stages: one row per completed stage per project
CREATE TABLE IF NOT EXISTS public.project_stages (
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

-- project_services: external services tied to a project
CREATE TABLE IF NOT EXISTS public.project_services (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    uuid NOT NULL REFERENCES public.proyectos_clientes(id) ON DELETE CASCADE,
  service_type  text NOT NULL CHECK (service_type IN ('domain','hosting','database','cdn','other')),
  provider      text NOT NULL,
  name          text NOT NULL,
  url           text,
  cost_monthly  numeric(10,2),
  cost_yearly   numeric(10,2),
  currency      text DEFAULT 'USD',
  renewal_date  date,
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- project_maintenance: monthly billing + task log
CREATE TABLE IF NOT EXISTS public.project_maintenance (
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

-- Enable RLS on new tables
ALTER TABLE public.project_stages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_maintenance ENABLE ROW LEVEL SECURITY;

-- RLS: access via project ownership
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

-- Add RLS policies on proyectos_clientes (SELECT + UPDATE, INSERT already exists)
DROP POLICY IF EXISTS "select own projects"  ON public.proyectos_clientes;
DROP POLICY IF EXISTS "update own projects"  ON public.proyectos_clientes;
DROP POLICY IF EXISTS "delete own projects"  ON public.proyectos_clientes;

CREATE POLICY "select own projects"
  ON public.proyectos_clientes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "update own projects"
  ON public.proyectos_clientes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own projects"
  ON public.proyectos_clientes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "insert own projects"
  ON public.proyectos_clientes FOR INSERT WITH CHECK (auth.uid() = user_id);
