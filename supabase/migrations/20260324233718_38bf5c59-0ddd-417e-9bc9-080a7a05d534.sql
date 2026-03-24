
-- Create enum for project status
CREATE TYPE public.estado_proyecto AS ENUM ('En análisis', 'Desarrollo', 'Finalizado');

-- Create proyectos_clientes table
CREATE TABLE public.proyectos_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nombre_proyecto TEXT NOT NULL,
  descripcion TEXT,
  estado estado_proyecto NOT NULL DEFAULT 'En análisis',
  fecha_creacion TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.proyectos_clientes ENABLE ROW LEVEL SECURITY;

-- Users can view their own projects
CREATE POLICY "Users can view own projects"
  ON public.proyectos_clientes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects"
  ON public.proyectos_clientes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects"
  ON public.proyectos_clientes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects"
  ON public.proyectos_clientes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
