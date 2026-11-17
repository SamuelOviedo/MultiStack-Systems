-- =============================================================================
-- S1 regression suite — profiles.user_type privilege escalation.
-- Run locally: npx supabase test db   (requires `npx supabase start`)
--
-- Every assertion executes real SQL under the same database roles PostgREST
-- uses (anon / authenticated + request.jwt.claims), so it exercises grants,
-- RLS and triggers exactly as an API call would. Runs in one transaction that
-- is rolled back: no data survives the test.
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(45);

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
-- Auth users: the handle_new_user trigger creates each profile as a client (2).
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data)
VALUES
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 's1-admin@test.local',  '{}'),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 's1-collab@test.local', '{}'),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 's1-client@test.local', '{}'),
  -- Tries to smuggle a role through signup metadata
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 's1-sneaky@test.local', '{"user_type": 0}'),
  -- A fresh client whose welcome e-mail was never sent: the reservation below runs on it
  ('00000000-0000-0000-0000-000000000000', '66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 's1-welcome@test.local', '{}');

SELECT is(
  (SELECT user_type FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333'),
  2, 'signup trigger creates a client profile (user_type 2)'
);
SELECT is(
  (SELECT user_type FROM public.profiles WHERE id = '44444444-4444-4444-8444-444444444444'),
  2, 'signup metadata cannot choose the role'
);

-- Promotion through the trusted path (Dashboard / SQL editor = postgres)
SELECT lives_ok(
  $$ UPDATE public.profiles SET user_type = 0 WHERE id = '11111111-1111-4111-8111-111111111111' $$,
  'postgres (Dashboard) can still promote an admin'
);
UPDATE public.profiles SET user_type = 1 WHERE id = '22222222-2222-4222-8222-222222222222';

-- Tickets: one assigned to the collaborator, one unassigned
INSERT INTO public.tickets (id, type, title, client_email, assigned_to)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'consulta', 'S1 assigned',   'lead@test.local', '22222222-2222-4222-8222-222222222222'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'consulta', 'S1 unassigned', 'lead@test.local', NULL);

-- ── Catalog-level guarantees (survive any future policy edit) ────────────────
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'user_type', 'UPDATE'),
  'authenticated has no UPDATE on user_type');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE'),
  'authenticated has no UPDATE on email');
SELECT ok(NOT has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'),
  'authenticated has no UPDATE on id');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'welcome_email_sent', 'UPDATE'),
  'authenticated keeps UPDATE on welcome_email_sent (send-welcome-email)');
SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'INSERT'),
  'authenticated has no INSERT on profiles');
SELECT ok(NOT has_table_privilege('authenticated', 'public.profiles', 'DELETE'),
  'authenticated has no DELETE on profiles');
SELECT ok(NOT has_any_column_privilege('anon', 'public.profiles', 'UPDATE'),
  'anon has no UPDATE on any profiles column');
SELECT ok(NOT has_table_privilege('anon', 'public.profiles', 'INSERT'),
  'anon has no INSERT on profiles');

-- What the welcome flow relies on: useAuth reads user_type and welcome_email_sent in one query, and the reservation
-- filters and returns through SELECT-privileged columns. The guard trigger is the layer that forbids a reset.
SELECT col_not_null('public', 'profiles', 'welcome_email_sent',
  'welcome_email_sent is NOT NULL (the reservation filter "= false" never meets a NULL)');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'user_type', 'SELECT'),
  'authenticated can read user_type (useAuth)');
SELECT ok(has_column_privilege('authenticated', 'public.profiles', 'welcome_email_sent', 'SELECT'),
  'authenticated can read welcome_email_sent (useAuth, and the WHERE of the reservation)');
SELECT ok(NOT has_column_privilege('anon', 'public.profiles', 'welcome_email_sent', 'SELECT'),
  'anon cannot read welcome_email_sent');
SELECT policies_are('public', 'profiles',
  ARRAY['select own profile', 'admin reads all profiles', 'update own profile'],
  'profiles keeps exactly its three policies (no INSERT or DELETE policy, one UPDATE policy)');
SELECT has_trigger('public', 'profiles', 'guard_profile_privileged_columns',
  'the guard trigger exists on profiles');
SELECT trigger_is('public', 'profiles', 'guard_profile_privileged_columns',
  'public', 'guard_profile_privileged_columns',
  'the guard trigger runs public.guard_profile_privileged_columns()');
SELECT is(
  (SELECT tgenabled::text FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass AND tgname = 'guard_profile_privileged_columns'),
  'O', 'the guard trigger is enabled (fires for API sessions)'
);

-- ── Client (role 2) ──────────────────────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","email":"s1-client@test.local"}', true);

SELECT throws_ok(
  $$ UPDATE public.profiles SET user_type = 0 WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot promote itself to admin'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET user_type = 1 WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot promote itself to collaborator'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET email = 'admin@multistacksystems.com' WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot rewrite its profile email'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET id = '55555555-5555-4555-8555-555555555555' WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot change its profile id'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET welcome_email_sent = true, user_type = 0 WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot piggy-back user_type on an allowed column'
);
SELECT throws_ok(
  $$ INSERT INTO public.profiles (id, email, user_type)
     VALUES ('55555555-5555-4555-8555-555555555555', 'fake@test.local', 0) $$,
  '42501', NULL, 'client cannot insert a privileged profile'
);
SELECT throws_ok(
  $$ DELETE FROM public.profiles WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot delete its profile'
);

-- The exact write send-welcome-email performs with the caller's JWT
SELECT lives_ok(
  $$ UPDATE public.profiles SET welcome_email_sent = true WHERE id = auth.uid() $$,
  'client can mark its own welcome email as sent'
);
SELECT is(
  (SELECT welcome_email_sent FROM public.profiles WHERE id = auth.uid()),
  true, 'welcome_email_sent flag persisted'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET welcome_email_sent = false WHERE id = auth.uid() $$,
  '42501', NULL, 'client cannot reset welcome_email_sent (no re-send loop)'
);

-- Other rows are invisible to RLS: the update matches nothing
UPDATE public.profiles SET welcome_email_sent = true
 WHERE id = '22222222-2222-4222-8222-222222222222';
SELECT is(
  (SELECT count(*)::int FROM public.profiles),
  1, 'client only sees its own profile'
);

RESET role;
SELECT is(
  (SELECT welcome_email_sent FROM public.profiles WHERE id = '22222222-2222-4222-8222-222222222222'),
  false, 'client cannot touch another user''s profile'
);
SELECT is(
  (SELECT user_type FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333'),
  2, 'client is still a client after every attempt'
);

-- ── The reservation send-welcome-email runs (reserveWelcome), verbatim ──────
-- UPDATE … SET welcome_email_sent = true WHERE id = <caller> AND welcome_email_sent = false RETURNING id
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated","email":"s1-welcome@test.local"}', true);

SELECT results_eq(
  $$ UPDATE public.profiles SET welcome_email_sent = true
      WHERE id = '66666666-6666-4666-8666-666666666666' AND welcome_email_sent = false
     RETURNING id $$,
  $$ VALUES ('66666666-6666-4666-8666-666666666666'::uuid) $$,
  'reservation: the first call on its own profile claims 1 row'
);
SELECT is_empty(
  $$ UPDATE public.profiles SET welcome_email_sent = true
      WHERE id = '66666666-6666-4666-8666-666666666666' AND welcome_email_sent = false
     RETURNING id $$,
  'reservation: the second call matches 0 rows (already sent: nothing is sent again)'
);
SELECT results_eq(
  $$ UPDATE public.profiles SET welcome_email_sent = true
      WHERE id = '66666666-6666-4666-8666-666666666666'
     RETURNING id $$,
  $$ VALUES ('66666666-6666-4666-8666-666666666666'::uuid) $$,
  'control: without "AND welcome_email_sent = false" the row is claimed again (true to true passes the guard)'
);
SELECT is_empty(
  $$ UPDATE public.profiles SET welcome_email_sent = true
      WHERE id = '44444444-4444-4444-8444-444444444444' AND welcome_email_sent = false
     RETURNING id $$,
  'reservation: another user''s id matches 0 rows (RLS: own row only)'
);
RESET role;

-- ── Anonymous ────────────────────────────────────────────────────────────────
SET LOCAL role anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT throws_ok(
  $$ UPDATE public.profiles SET user_type = 0 $$,
  '42501', NULL, 'anon cannot update profiles'
);
RESET role;

-- ── Admin (role 0) keeps its access ──────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated","email":"s1-admin@test.local"}', true);

SELECT is(public.get_user_type(), 0, 'admin resolves to user_type 0');
SELECT ok(
  (SELECT count(*) FROM public.profiles) >= 4,
  'admin still reads every profile (assignment dropdown)'
);
SELECT is(
  (SELECT count(*)::int FROM public.tickets
    WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')),
  2, 'admin still sees all tickets'
);
SELECT throws_ok(
  $$ UPDATE public.profiles SET user_type = 0 WHERE id = '33333333-3333-4333-8333-333333333333' $$,
  '42501', NULL, 'role changes are not possible through the API, even for admins'
);
SELECT is_empty(
  $$ UPDATE public.profiles SET welcome_email_sent = true
      WHERE id = '44444444-4444-4444-8444-444444444444'
     RETURNING id $$,
  'an admin cannot set another user''s welcome flag (0 rows: the UPDATE policy is own row only)'
);
RESET role;

SELECT results_eq(
  $$ SELECT id, welcome_email_sent FROM public.profiles
      WHERE id IN ('44444444-4444-4444-8444-444444444444', '66666666-6666-4666-8666-666666666666')
      ORDER BY id $$,
  $$ VALUES ('44444444-4444-4444-8444-444444444444'::uuid, false),
            ('66666666-6666-4666-8666-666666666666'::uuid, true) $$,
  'only the caller''s own reservation stuck: the other flag is still false'
);

-- ── Collaborator (role 1) keeps its access ───────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated","email":"s1-collab@test.local"}', true);

SELECT is(public.get_user_type(), 1, 'collaborator resolves to user_type 1');
SELECT results_eq(
  $$ SELECT id FROM public.tickets
      WHERE id IN ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') $$,
  $$ VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid) $$,
  'collaborator still sees only its assigned ticket'
);
RESET role;

SELECT * FROM finish();
ROLLBACK;
