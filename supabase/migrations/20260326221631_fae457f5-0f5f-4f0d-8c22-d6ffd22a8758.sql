CREATE TABLE public.proyectos_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre_proyecto text NOT NULL,
  descripcion text,
  estado text NOT NULL DEFAULT 'En análisis',
  fecha_creacion timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proyectos_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON public.proyectos_clientes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects"
  ON public.proyectos_clientes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON public.proyectos_clientes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);