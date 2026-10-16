-- =============================================================================
-- S17 regression suite — client access is granted by tickets.client_id, never
-- by e-mail coincidence. Reproduces the "e-mail squatting" attack: someone
-- registers (auto-confirmed) with a stranger's address and tries to read that
-- person's leads and projects.
-- Run locally: npx supabase test db
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(25);

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-000000000000', '1a000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's17-admin@test.local',  '{}'),
  ('00000000-0000-0000-0000-000000000000', '1b000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's17-collab@test.local', '{}'),
  ('00000000-0000-0000-0000-000000000000', '1c000000-0000-4000-8000-000000000000', 'authenticated', 'authenticated', 's17-client@test.local', '{}');
UPDATE public.profiles SET user_type = 0 WHERE id = '1a000000-0000-4000-8000-000000000000';
UPDATE public.profiles SET user_type = 1 WHERE id = '1b000000-0000-4000-8000-000000000000';

SELECT has_column('public', 'tickets', 'client_id', 'tickets.client_id exists');
SELECT has_index('public', 'tickets', 'idx_tickets_client_id', 'client_id is indexed');

-- ── 1. A prospect leaves a lead through the public contact form (anon) ──────
SET LOCAL role anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT lives_ok(
  $$ INSERT INTO public.tickets (id, type, title, client_email, client_name, client_id)
     VALUES ('2a000000-0000-4000-8000-000000000000', 'consulta', 'Lead del prospecto',
             'victim@test.local', 'Víctima', '1c000000-0000-4000-8000-000000000000') $$,
  'anonymous contact lead is accepted'
);
RESET role;
SELECT is(
  (SELECT client_id FROM public.tickets WHERE id = '2a000000-0000-4000-8000-000000000000'),
  NULL, 'anonymous leads never get an owner, even if client_id is sent'
);

-- ── 2. Attacker registers with the prospect's e-mail (auto-confirmed) ───────
INSERT INTO auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_user_meta_data)
VALUES ('00000000-0000-0000-0000-000000000000', '1d000000-0000-4000-8000-000000000000',
        'authenticated', 'authenticated', 'victim@test.local', now(), '{}');

SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1d000000-0000-4000-8000-000000000000","role":"authenticated","email":"victim@test.local"}', true);

SELECT is(
  (SELECT count(*)::int FROM public.tickets WHERE id = '2a000000-0000-4000-8000-000000000000'),
  0, 'S17: e-mail squatter cannot read the stranger''s lead'
);
SELECT is(
  (SELECT count(*)::int FROM public.tickets WHERE client_email = 'victim@test.local'),
  0, 'S17: no ticket is visible by e-mail coincidence'
);

-- Squatter creates its own request the way the published frontend does (no client_id)
SELECT lives_ok(
  $$ INSERT INTO public.tickets (id, type, title, client_email, client_name, priority, status)
     VALUES ('2b000000-0000-4000-8000-000000000000', 'solicitud', 'Solicitud propia',
             'victim@test.local', 'victim@test.local', 'media', 'abierto') $$,
  'client request without client_id (current frontend) is accepted'
);
SELECT is(
  (SELECT count(*)::int FROM public.tickets WHERE id = '2b000000-0000-4000-8000-000000000000'),
  1, 'client sees its own request'
);

-- Trying to plant a request in another client's account
SELECT lives_ok(
  $$ INSERT INTO public.tickets (id, type, title, client_email, client_name, client_id)
     VALUES ('2c000000-0000-4000-8000-000000000000', 'solicitud', 'Plantada',
             'victim@test.local', 'x', '1c000000-0000-4000-8000-000000000000') $$,
  'insert with a foreign client_id does not fail…'
);
RESET role;
SELECT is(
  (SELECT client_id FROM public.tickets WHERE id = '2c000000-0000-4000-8000-000000000000'),
  '1d000000-0000-4000-8000-000000000000'::uuid,
  '…but ownership is forced to the caller (cannot be spoofed)'
);
SELECT is(
  (SELECT client_id FROM public.tickets WHERE id = '2b000000-0000-4000-8000-000000000000'),
  '1d000000-0000-4000-8000-000000000000'::uuid,
  'the trigger filled client_id for the frontend insert'
);

-- ── 3. Another client cannot see those requests ─────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1c000000-0000-4000-8000-000000000000","role":"authenticated","email":"s17-client@test.local"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.tickets
    WHERE id IN ('2a000000-0000-4000-8000-000000000000','2b000000-0000-4000-8000-000000000000','2c000000-0000-4000-8000-000000000000')),
  0, 'a client never sees other clients'' requests or anonymous leads'
);
-- A client can still type someone else's address as CONTACT e-mail (the
-- "public inserts contact lead" policy also covers authenticated users — S4,
-- next block), but ownership stays with the client and the address owner gains
-- nothing from it.
SELECT lives_ok(
  $$ INSERT INTO public.tickets (id, type, title, client_email, client_name)
     VALUES ('2d000000-0000-4000-8000-000000000000', 'solicitud', 'Con email ajeno', 'victim@test.local', 'x') $$,
  'client filing with a foreign contact e-mail is accepted (S4 residual)…'
);
RESET role;
SELECT is(
  (SELECT client_id FROM public.tickets WHERE id = '2d000000-0000-4000-8000-000000000000'),
  '1c000000-0000-4000-8000-000000000000'::uuid,
  '…but it is owned by the filing client, not by the e-mail''s owner'
);
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1d000000-0000-4000-8000-000000000000","role":"authenticated","email":"victim@test.local"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.tickets WHERE id = '2d000000-0000-4000-8000-000000000000'),
  0, 'the e-mail''s account does not see a ticket filed under its address by someone else'
);
RESET role;

-- ── 4. Conversion links owners from the ticket, not from the e-mail ─────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1a000000-0000-4000-8000-000000000000","role":"authenticated","email":"s17-admin@test.local"}', true);
SELECT lives_ok(
  $$ SELECT public.convert_ticket_to_project('2a000000-0000-4000-8000-000000000000', 'Proyecto lead', 'd', NULL, NULL, '{}'::jsonb, NULL) $$,
  'admin converts the anonymous lead'
);
SELECT lives_ok(
  $$ SELECT public.convert_ticket_to_project('2b000000-0000-4000-8000-000000000000', 'Proyecto propio', 'd', NULL, NULL, '{}'::jsonb, NULL) $$,
  'admin converts the squatter''s own request'
);
RESET role;
SELECT is(
  (SELECT client_id FROM public.proyectos_clientes WHERE source_ticket_id = '2a000000-0000-4000-8000-000000000000'),
  NULL, 'S17: project from an anonymous lead is NOT linked by e-mail'
);
SELECT is(
  (SELECT client_id FROM public.proyectos_clientes WHERE source_ticket_id = '2b000000-0000-4000-8000-000000000000'),
  '1d000000-0000-4000-8000-000000000000'::uuid, 'project from a client request is linked to its creator'
);

SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1d000000-0000-4000-8000-000000000000","role":"authenticated","email":"victim@test.local"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.proyectos_clientes WHERE nombre_proyecto = 'Proyecto lead'),
  0, 'S17: e-mail squatter cannot read the stranger''s project'
);
SELECT is(
  (SELECT count(*)::int FROM public.proyectos_clientes WHERE nombre_proyecto = 'Proyecto propio'),
  1, 'client reads the project created from its own request'
);
RESET role;

-- ── 5. Only admins may re-link ownership ────────────────────────────────────
UPDATE public.tickets SET assigned_to = '1b000000-0000-4000-8000-000000000000'
 WHERE id = '2c000000-0000-4000-8000-000000000000';

SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1b000000-0000-4000-8000-000000000000","role":"authenticated","email":"s17-collab@test.local"}', true);
SELECT throws_ok(
  $$ UPDATE public.tickets SET client_id = '1b000000-0000-4000-8000-000000000000'
      WHERE id = '2c000000-0000-4000-8000-000000000000' $$,
  '42501', NULL, 'assignee cannot change the owner of a ticket'
);
SELECT lives_ok(
  $$ UPDATE public.tickets SET status = 'en_progreso' WHERE id = '2c000000-0000-4000-8000-000000000000' $$,
  'assignee can still update its ticket (status)'
);
RESET role;

SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"1a000000-0000-4000-8000-000000000000","role":"authenticated","email":"s17-admin@test.local"}', true);
SELECT lives_ok(
  $$ UPDATE public.tickets SET client_id = '1c000000-0000-4000-8000-000000000000'
      WHERE id = '2c000000-0000-4000-8000-000000000000' $$,
  'admin can explicitly re-link an owner (reviewed backfill path)'
);
SELECT ok(
  (SELECT count(*) FROM public.tickets) >= 3,
  'admin still reads every ticket'
);
RESET role;

SELECT * FROM finish();
ROLLBACK;
