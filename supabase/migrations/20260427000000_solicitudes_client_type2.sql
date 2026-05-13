-- Allow tickets without a project (client solicitudes)
ALTER TABLE public.tickets
  ALTER COLUMN project_id DROP NOT NULL;

-- Add 'solicitud' to ticket type constraint
ALTER TABLE public.tickets
  DROP CONSTRAINT IF EXISTS tickets_type_check;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_type_check
  CHECK (type IN ('modificacion','bug','consulta','pago','mantenimiento','otro','solicitud'));

-- RLS: type-2 clients can insert solicitudes tied to their own email
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

-- RLS: type-2 clients can read their own solicitudes
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
