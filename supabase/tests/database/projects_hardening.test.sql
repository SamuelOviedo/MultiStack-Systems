-- =============================================================================
-- S5 / S10 / S4 regression suite
--   S5  — only staff create or own projects; clients cannot reach a project's
--         sub-tables through user_id; only admins re-assign user_id
--   S10 — deleting the creator's account keeps its projects
--   S4  — client requests are fresh and unassigned; free-text sizes are capped
-- Run locally: npx supabase test db
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(32);

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-000000000000', '5a000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's5-admin@test.local',  '{}'),
  ('00000000-0000-0000-0000-000000000000', '5b000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's5-collab@test.local', '{}'),
  ('00000000-0000-0000-0000-000000000000', '5c000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's5-client@test.local', '{}');
UPDATE public.profiles SET user_type = 0 WHERE id = '5a000000-0000-4000-8000-000000000000';
UPDATE public.profiles SET user_type = 1 WHERE id = '5b000000-0000-4000-8000-000000000000';

-- P: created and led by the collaborator, delivered to the client
INSERT INTO public.proyectos_clientes (id, user_id, nombre_proyecto, lead_developer_id, client_id) VALUES
  ('6a000000-0000-4000-8000-000000000000', '5b000000-0000-4000-8000-000000000000', 'Proyecto P',
   '5b000000-0000-4000-8000-000000000000', '5c000000-0000-4000-8000-000000000000');
INSERT INTO public.project_stages (project_id, stage_key, stage_label) VALUES
  ('6a000000-0000-4000-8000-000000000000', 'kickoff', 'Kickoff');
-- Q: a client-owned project created before S5 (legacy shape)
INSERT INTO public.proyectos_clientes (id, user_id, nombre_proyecto) VALUES
  ('6b000000-0000-4000-8000-000000000000', '5c000000-0000-4000-8000-000000000000', 'Proyecto Q');

SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'proyectos_clientes'
     AND policyname IN ('Users can insert own projects', 'Users can update own projects',
                        'Users can view own projects', 'usuario crea sus proyectos', 'usuario ve sus proyectos')),
  0, 'S5: hand-made duplicate project policies are gone'
);

-- ── 1. Client ─────────────────────────────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"5c000000-0000-4000-8000-000000000000","role":"authenticated","email":"s5-client@test.local"}', true);

SELECT throws_ok(
  $$ INSERT INTO public.proyectos_clientes (user_id, nombre_proyecto)
     VALUES ('5c000000-0000-4000-8000-000000000000', 'Proyecto del cliente') $$,
  '42501', NULL, 'S5: a client cannot create projects'
);
SELECT is(
  (SELECT count(*)::int FROM public.proyectos_clientes WHERE id = '6a000000-0000-4000-8000-000000000000'),
  1, 'the client still reads the project delivered to it (client_id)'
);
UPDATE public.proyectos_clientes SET estado = 'cancelado', lead_developer_id = NULL
 WHERE id = '6a000000-0000-4000-8000-000000000000';
SELECT throws_ok(
  $$ INSERT INTO public.project_stages (project_id, stage_key, stage_label)
     VALUES ('6a000000-0000-4000-8000-000000000000', 'x', 'x') $$,
  '42501', NULL, 'the client cannot add stages to its project'
);
SELECT throws_ok(
  $$ INSERT INTO public.client_access_tokens (project_id) VALUES ('6a000000-0000-4000-8000-000000000000') $$,
  '42501', NULL, 'the client cannot mint portal tokens'
);
-- Legacy client-owned project Q: ownership alone grants nothing any more
SELECT is(
  (SELECT count(*)::int FROM public.proyectos_clientes WHERE id = '6b000000-0000-4000-8000-000000000000'),
  0, 'S5: a client-owned legacy project is not reachable through user_id'
);
UPDATE public.proyectos_clientes SET nombre_proyecto = 'Cambiado' WHERE id = '6b000000-0000-4000-8000-000000000000';
SELECT throws_ok(
  $$ INSERT INTO public.project_services (project_id, service_type, provider, name)
     VALUES ('6b000000-0000-4000-8000-000000000000', 'domain', 'x', 'x') $$,
  '42501', NULL, 'S5: nor are its services'
);
DELETE FROM public.proyectos_clientes WHERE id = '6b000000-0000-4000-8000-000000000000';
RESET role;

SELECT is(
  (SELECT estado || '|' || coalesce(lead_developer_id::text, 'null') FROM public.proyectos_clientes
    WHERE id = '6a000000-0000-4000-8000-000000000000'),
  'en_analisis|5b000000-0000-4000-8000-000000000000',
  'the client''s UPDATE on its project changed nothing'
);
SELECT is(
  (SELECT nombre_proyecto FROM public.proyectos_clientes WHERE id = '6b000000-0000-4000-8000-000000000000'),
  'Proyecto Q', 'the legacy project was neither updated nor deleted by the client'
);

-- ── 2. Collaborator keeps its scope ───────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"5b000000-0000-4000-8000-000000000000","role":"authenticated","email":"s5-collab@test.local"}', true);

SELECT lives_ok(
  $$ INSERT INTO public.proyectos_clientes (id, user_id, nombre_proyecto)
     VALUES ('6c000000-0000-4000-8000-000000000000', '5b000000-0000-4000-8000-000000000000', 'Nuevo del colaborador') $$,
  'a collaborator can still create projects from the dashboard'
);
SELECT lives_ok(
  $$ UPDATE public.proyectos_clientes SET descripcion = 'editado' WHERE id = '6c000000-0000-4000-8000-000000000000' $$,
  'a collaborator can edit the projects it created'
);
SELECT lives_ok(
  $$ INSERT INTO public.project_stages (project_id, stage_key, stage_label)
     VALUES ('6c000000-0000-4000-8000-000000000000', 'kickoff', 'Kickoff') $$,
  'a collaborator manages the stages of its projects'
);
SELECT throws_ok(
  $$ UPDATE public.proyectos_clientes SET user_id = '5c000000-0000-4000-8000-000000000000'
     WHERE id = '6a000000-0000-4000-8000-000000000000' $$,
  '42501', NULL, 'S5: a lead developer cannot hand the project over to a client (user_id)'
);
SELECT throws_ok(
  $$ INSERT INTO public.proyectos_clientes (user_id, nombre_proyecto)
     VALUES ('5a000000-0000-4000-8000-000000000000', 'A nombre de otro') $$,
  '42501', NULL, 'a collaborator cannot create projects in someone else''s name'
);
RESET role;

-- ── 3. Admin ──────────────────────────────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"5a000000-0000-4000-8000-000000000000","role":"authenticated","email":"s5-admin@test.local"}', true);
SELECT lives_ok(
  $$ UPDATE public.proyectos_clientes SET user_id = '5a000000-0000-4000-8000-000000000000'
     WHERE id = '6b000000-0000-4000-8000-000000000000' $$,
  'an admin can re-assign a project''s creator'
);
SELECT lives_ok(
  $$ INSERT INTO public.proyectos_clientes (id, user_id, nombre_proyecto)
     VALUES ('6d000000-0000-4000-8000-000000000000', '5a000000-0000-4000-8000-000000000000', 'Del admin') $$,
  'an admin creates projects'
);
RESET role;

-- ── 4. S10: deleting the creator keeps its projects ───────────────────────────
SELECT col_is_null('public', 'proyectos_clientes', 'user_id', 'S10: user_id is nullable');
SELECT fk_ok('public', 'proyectos_clientes', 'user_id', 'auth', 'users', 'id', 'user_id still references auth.users');

DELETE FROM auth.users WHERE id = '5b000000-0000-4000-8000-000000000000';
SELECT is(
  (SELECT count(*)::int FROM public.proyectos_clientes
    WHERE id IN ('6a000000-0000-4000-8000-000000000000', '6c000000-0000-4000-8000-000000000000') AND user_id IS NULL),
  2, 'S10: the deleted collaborator''s projects survive, without creator'
);
SELECT is(
  (SELECT count(*)::int FROM public.project_stages
    WHERE project_id IN ('6a000000-0000-4000-8000-000000000000', '6c000000-0000-4000-8000-000000000000')),
  2, 'S10: …and so do their stages'
);

-- ── 5. S4: client requests and size limits ────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"5c000000-0000-4000-8000-000000000000","role":"authenticated","email":"s5-client@test.local"}', true);
SELECT lives_ok(
  $$ INSERT INTO public.tickets (type, title, client_email, client_name, priority, status)
     VALUES ('solicitud', 'Solicitud normal', 's5-client@test.local', 'Cliente', 'media', 'abierto') $$,
  'a normal client request (current frontend shape) is accepted'
);
SELECT throws_ok(
  $$ INSERT INTO public.tickets (type, title, client_email, client_name, priority, status)
     VALUES ('solicitud', 'Ya resuelta', 's5-client@test.local', 'Cliente', 'media', 'resuelto') $$,
  '42501', NULL, 'S4: a client cannot file a request in a later status'
);
SELECT throws_ok(
  $$ INSERT INTO public.tickets (type, title, client_email, client_name, priority, status, assigned_to)
     VALUES ('solicitud', 'Asignada', 's5-client@test.local', 'Cliente', 'media', 'abierto',
             '5a000000-0000-4000-8000-000000000000') $$,
  '42501', NULL, 'S4: a client cannot file a request already assigned'
);
SELECT throws_ok(
  $$ INSERT INTO public.tickets (type, title, client_email, client_name, priority, status)
     VALUES ('bug', 'Otro tipo', 's5-client@test.local', 'Cliente', 'media', 'abierto') $$,
  '42501', NULL, 'S4: a client only files ''solicitud'' requests'
);
RESET role;

SET LOCAL role service_role;
SELECT throws_ok(
  $$ INSERT INTO public.tickets (type, title, client_name, description)
     VALUES ('consulta', repeat('x', 201), 'x', 'x') $$,
  '23514', NULL, 'S4: titles longer than 200 characters are rejected, even for the service role'
);
SELECT throws_ok(
  $$ INSERT INTO public.tickets (type, title, client_name, description)
     VALUES ('consulta', 't', 'x', repeat('x', 10001)) $$,
  '23514', NULL, 'S4: descriptions longer than 10 000 characters are rejected'
);
RESET role;

-- ── 6. S10: deleting a client keeps its requests and projects ───────────────
DELETE FROM auth.users WHERE id = '5c000000-0000-4000-8000-000000000000';
SELECT is(
  (SELECT count(*)::int FROM public.tickets WHERE client_email = 's5-client@test.local' AND client_id IS NULL),
  1, 'S10: a deleted client''s request survives, without owner'
);
SELECT is(
  (SELECT client_id FROM public.proyectos_clientes WHERE id = '6a000000-0000-4000-8000-000000000000'),
  NULL, 'S10: the project delivered to a deleted client survives, without client'
);
SELECT is(
  (SELECT count(*)::int FROM public.proyectos_clientes WHERE id = '6b000000-0000-4000-8000-000000000000'),
  1, 'S10: other projects are untouched by the client''s deletion'
);

-- ── 7. S4: rate-limit log is service-role only ───────────────────────────────
SELECT ok(
  NOT has_table_privilege('anon', 'public.contact_rate_events', 'SELECT,INSERT,UPDATE,DELETE'),
  'S4: anon has no privileges on contact_rate_events'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.contact_rate_events', 'SELECT,INSERT,UPDATE,DELETE'),
  'S4: authenticated has no privileges on contact_rate_events'
);
SET LOCAL role service_role;
SELECT lives_ok(
  $$ INSERT INTO public.contact_rate_events (bucket) VALUES ('ip:test') $$,
  'S4: the service role records attempts'
);
RESET role;

SELECT * FROM finish();
ROLLBACK;
