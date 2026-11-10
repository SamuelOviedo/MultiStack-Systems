-- =============================================================================
-- Quotations F1 (foundation) regression suite — tables cotizaciones and
-- cotizacion_eventos: admin-only RLS, column privileges, state machine,
-- immutability and audit trail.
--
-- Identifiers follow specs/002-admin-quotations/contracts/acceso-y-rls.md §3:
--   A1-A9  per-table access matrix      S1, S2, S3, S4, S10, S14, S15
--   S17    SECURITY DEFINER functions   S22    whitelist immutability (F1 part)
--   S24    events without personal data
-- Extra groups (owner requirements): ROLE (role resolution), SEQ (sequences),
-- PRIV (catalog privileges), LEN (prospect length limits), SVC (service_role:
-- no privileges at all, decision of security), ACL (exact access control
-- lists), ACT (event actor = session), CHK (the declarative layer alone, with
-- the triggers off), FWD (forward catalog walk), ACC (deleting an admin account).
--
-- Every assertion runs real SQL under the roles PostgREST uses
-- (anon / authenticated / service_role + request.jwt.claims) or as postgres.
-- One transaction, rolled back: no data survives. Synthetic data only
-- (@test.local, fixed UUIDs, sentinel strings).
--
-- Maintenance notes for later phases (do not weaken these tests, extend them):
--   * S17 expects no EXECUTE for authenticated on any cotizacion_* function.
--     F3 (first RPC) narrows that to "only the canonical RPC list". It also
--     expects EVERY function with that prefix to be SECURITY DEFINER with a
--     pinned search_path: a SECURITY INVOKER helper needs another name (or an
--     on-purpose change here).
--   * ACL pins the exact grants. F3 changes them on purpose (content columns,
--     RPC EXECUTE). FWD requires every later cotizacion*/catalogo* table to have
--     RLS and to revoke anon and service_role too (decision of security).
--   * PRIV expects exactly the four prospect columns to be writable.
--     F3 adds its content columns here on purpose.
--   * S22 reads the columns from the catalog: a new column is covered with no
--     change to plan(n). F4 updates the whitelist table below on purpose.
--   * A8 is a literal substring match. A column such as "archivada_at" (F4)
--     contains "iva": F4 must add an explicit exclusion, not drop the check.
-- Run locally: npx supabase test db
-- =============================================================================
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(339);

-- ── Helpers (live in pg_temp: they die with the transaction) ─────────────────
-- Creates a cotizacion in the requested state, through the real triggers, as
-- postgres with a simulated admin session; leaves the session empty.
CREATE FUNCTION pg_temp.nueva_en(p_estado text, p_id uuid) RETURNS uuid
LANGUAGE plpgsql AS $f$
DECLARE v_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims',
    '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  INSERT INTO public.cotizaciones (id, prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono)
  VALUES (coalesce(p_id, gen_random_uuid()), 'Fixture ' || p_estado, 'Contacto ' || p_estado,
          'fx-' || p_estado || '@test.local', '5550100')
  RETURNING id INTO v_id;
  IF p_estado = 'cancelada' THEN
    UPDATE public.cotizaciones SET estado = 'cancelada' WHERE id = v_id;
  ELSIF p_estado <> 'borrador' THEN
    UPDATE public.cotizaciones SET estado = 'emitida' WHERE id = v_id;
    IF p_estado <> 'emitida' THEN
      UPDATE public.cotizaciones SET estado = p_estado WHERE id = v_id;
    END IF;
  END IF;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN v_id;
END $f$;

-- Attempts a state change; returns the resulting estado, or "SQLSTATE:message".
CREATE FUNCTION pg_temp.pasar(p_id uuid, p_destino text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  UPDATE public.cotizaciones SET estado = p_destino WHERE id = p_id RETURNING estado INTO v;
  RETURN coalesce(v, 'NO ROW');
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ':' || SQLERRM;
END $f$;

-- Runs a DML statement under the CURRENT role and returns the rows it affected,
-- or -1 if it raised (so a surprise is a red assertion, not a dead script).
CREATE FUNCTION pg_temp.afectadas(p_sql text) RETURNS bigint
LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
EXCEPTION WHEN OTHERS THEN
  RETURN -1;
END $f$;

-- Two consecutive UPDATEs (the second changes nothing): returns the version steps.
CREATE FUNCTION pg_temp.subidas(p_id uuid) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE v0 int; v1 int; v2 int;
BEGIN
  SELECT row_version INTO v0 FROM public.cotizaciones WHERE id = p_id;
  UPDATE public.cotizaciones SET prospecto_nombre = 'Subida 1' WHERE id = p_id RETURNING row_version INTO v1;
  UPDATE public.cotizaciones SET prospecto_nombre = prospecto_nombre WHERE id = p_id RETURNING row_version INTO v2;
  RETURN format('+%s,+%s', v1 - v0, v2 - v1);
END $f$;

-- Inserts a cotizacion under the CURRENT session, then rolls the attempt back.
-- Reports: events visible inside / cotizaciones left / events left.
CREATE FUNCTION pg_temp.alta_revertida() RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE c0 bigint; e0 bigint; e_dentro bigint; c1 bigint; e1 bigint;
BEGIN
  SELECT count(*) INTO c0 FROM public.cotizaciones;
  SELECT count(*) INTO e0 FROM public.cotizacion_eventos;
  BEGIN
    INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('Alta revertida');
    SELECT count(*) INTO e_dentro FROM public.cotizacion_eventos;
    RAISE EXCEPTION USING ERRCODE = 'XX001', MESSAGE = 'revertir';
  EXCEPTION WHEN SQLSTATE 'XX001' THEN NULL;
  END;
  SELECT count(*) INTO c1 FROM public.cotizaciones;
  SELECT count(*) INTO e1 FROM public.cotizacion_eventos;
  RETURN format('inside=%s,cotizaciones=%s,events=%s', e_dentro - e0, c1 - c0, e1 - e0);
END $f$;

-- Runs ONE statement with every user trigger of both tables switched off, so only
-- the declarative layer (constraints and indexes) can reject it, and always undoes
-- everything, the trigger switch included. Returns "SQLSTATE:constraint name" when
-- the statement fails, or ACCEPTED when it goes through.
CREATE FUNCTION pg_temp.solo_restricciones(p_sql text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE v_constraint text;
BEGIN
  BEGIN
    ALTER TABLE public.cotizaciones       DISABLE TRIGGER USER;
    ALTER TABLE public.cotizacion_eventos DISABLE TRIGGER USER;
    EXECUTE p_sql;
    RAISE EXCEPTION USING ERRCODE = 'XX001', MESSAGE = 'accepted';
  EXCEPTION
    WHEN SQLSTATE 'XX001' THEN RETURN 'ACCEPTED';
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      RETURN SQLSTATE || ':' || coalesce(v_constraint, SQLERRM);
  END;
END $f$;

-- S22 sweep. For every non-borrador fixture and every column of cotizaciones
-- that is not whitelisted (columns come from the catalog), tries to change the
-- column to a different value and records the outcome, undoing any success.
CREATE TEMP TABLE _fix (k text PRIMARY KEY, estado text NOT NULL, id uuid NOT NULL);
CREATE TEMP TABLE _lista_blanca (col text PRIMARY KEY);
CREATE TEMP TABLE _s22 (k text, columna text, resultado text);

CREATE FUNCTION pg_temp.barrido_inmutable() RETURNS void
LANGUAGE plpgsql AS $f$
DECLARE
  f record; c record; v_cur text; v_new text; v_res text;
BEGIN
  DELETE FROM _s22;
  FOR f IN SELECT k, id FROM _fix WHERE estado <> 'borrador' ORDER BY k LOOP
    FOR c IN
      SELECT a.attname::text AS nombre, format_type(a.atttypid, a.atttypmod) AS tipo
        FROM pg_attribute a
       WHERE a.attrelid = 'public.cotizaciones'::regclass AND a.attnum > 0 AND NOT a.attisdropped
         AND a.attname NOT IN (SELECT col FROM _lista_blanca)
       ORDER BY a.attnum
    LOOP
      EXECUTE format('SELECT to_jsonb(t) ->> %L FROM public.cotizaciones t WHERE t.id = %L', c.nombre, f.id)
        INTO v_cur;
      v_new := CASE
        WHEN c.tipo = 'uuid' THEN quote_literal(gen_random_uuid()::text)
        WHEN c.tipo = 'text' OR c.tipo LIKE 'character%' THEN quote_literal(coalesce(v_cur, '') || 'x')
        WHEN c.tipo LIKE 'timestamp%' THEN quote_literal((coalesce(v_cur::timestamptz, now()) + interval '1 day')::text)
        WHEN c.tipo IN ('smallint', 'integer', 'bigint') OR c.tipo LIKE 'numeric%' THEN (coalesce(v_cur::numeric, 0) + 1)::text
        WHEN c.tipo = 'boolean' THEN (NOT coalesce(v_cur::boolean, false))::text
        WHEN c.tipo = 'date' THEN quote_literal((coalesce(v_cur::date, current_date) + 1)::text)
        WHEN c.tipo = 'jsonb' THEN quote_literal('{"s22":"x"}')
        WHEN v_cur IS NOT NULL THEN 'NULL'
        ELSE NULL
      END;
      IF v_new IS NULL THEN
        v_res := 'NO TEST VALUE FOR TYPE ' || c.tipo;   -- fail loud: teach the sweep this type
      ELSE
        BEGIN
          EXECUTE format('UPDATE public.cotizaciones SET %I = %s WHERE id = %L', c.nombre, v_new, f.id);
          RAISE EXCEPTION USING ERRCODE = 'XX001', MESSAGE = 'accepted';   -- forces the undo
        EXCEPTION WHEN OTHERS THEN
          IF SQLSTATE = 'XX001' THEN v_res := 'ACCEPTED'; ELSE v_res := SQLSTATE || ':' || SQLERRM; END IF;
        END;
      END IF;
      INSERT INTO _s22 VALUES (f.k, c.nombre, v_res);
    END LOOP;
  END LOOP;
END $f$;

-- Whitelist the trigger is expected to allow outside borrador (ciclo-de-vida.md §5, F1).
INSERT INTO _lista_blanca VALUES ('estado'), ('row_version'), ('actualizado_por'), ('actualizado_at');

-- Expected (non-borrador fixture x non-whitelisted catalog column) pairs whose
-- outcome is NOT exactly P0001 / COT:INMUTABLE, or that were never probed.
CREATE TEMP VIEW _s22_fallos AS
SELECT e.k, e.attname, r.resultado
  FROM (SELECT f.k, a.attname::text AS attname
          FROM _fix f
         CROSS JOIN pg_attribute a
         WHERE f.estado <> 'borrador'
           AND a.attrelid = 'public.cotizaciones'::regclass AND a.attnum > 0 AND NOT a.attisdropped
           AND a.attname NOT IN (SELECT col FROM _lista_blanca)) e
  LEFT JOIN _s22 r ON r.k = e.k AND r.columna = e.attname
 WHERE r.resultado IS DISTINCT FROM 'P0001:COT:INMUTABLE';

-- ── Fixtures (as postgres) ───────────────────────────────────────────────────
-- ...01 admin · ...02 collaborator · ...03 client · ...05 second admin.
-- ...04 has NO auth.users row and NO profiles row: its role resolves to NULL.
INSERT INTO auth.users (instance_id, id, aud, role, email, raw_user_meta_data) VALUES
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'cot-admin@test.local',  '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'cot-collab@test.local', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cot-client@test.local', '{}'),
  ('00000000-0000-0000-0000-000000000000', 'c1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'cot-admin2@test.local', '{}');
UPDATE public.profiles SET user_type = 0 WHERE id IN ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005');
UPDATE public.profiles SET user_type = 1 WHERE id = 'c1000000-0000-4000-8000-000000000002';

-- One cotizacion in each of the five states (B borrador, E emitida, A aceptada_firmada,
-- R rechazada, C cancelada), made through the real triggers.
INSERT INTO _fix VALUES
  ('B', 'borrador',         'c2000000-0000-4000-8000-000000000001'),
  ('E', 'emitida',          'c2000000-0000-4000-8000-000000000002'),
  ('A', 'aceptada_firmada', 'c2000000-0000-4000-8000-000000000003'),
  ('R', 'rechazada',        'c2000000-0000-4000-8000-000000000004'),
  ('C', 'cancelada',        'c2000000-0000-4000-8000-000000000005');
DO $$ BEGIN PERFORM pg_temp.nueva_en(estado, id) FROM _fix; END $$;

SELECT is(
  (SELECT string_agg(right(id::text, 2) || '=' || user_type, ' ' ORDER BY id)
     FROM public.profiles WHERE id::text LIKE 'c1000000-%'),
  '01=0 02=1 03=2 05=0',
  'F: fixture profiles are admin (0), collaborator (1), client (2) and a second admin (0)'
);
SELECT is(
  (SELECT count(*)::int FROM public.profiles WHERE id = 'c1000000-0000-4000-8000-000000000004'),
  0, 'F: the fifth identity has no profiles row (its role is NULL)'
);

-- ── A8 / A9 — catalog guarantees on both tables ──────────────────────────────
SELECT is(
  (SELECT count(*)::int FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.' || t.nombre) AND a.attnum > 0 AND NOT a.attisdropped
      AND a.attname ~* '(impuesto|isv|iva|tax|descuento)'),
  0, format('A8: %s has no tax or discount column', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);

SELECT is(
  (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid = to_regclass('public.' || t.nombre)),
  true, format('A9: row level security is enabled on %s', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);

SELECT is(
  (SELECT count(*)::int FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.nombre
      AND (lower(btrim(coalesce(p.qual, ''), '() ')) = 'true'
        OR lower(btrim(coalesce(p.with_check, ''), '() ')) = 'true')),
  0, format('A9: no policy on %s is USING (true)', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);

-- ── PRIV — privileges seen by the catalog (survive any future policy edit) ───
SELECT is(
  (SELECT string_agg(a.attname, ',' ORDER BY a.attname) FROM pg_attribute a
    WHERE a.attrelid = 'public.cotizaciones'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT')),
  'prospecto_contacto,prospecto_email,prospecto_nombre,prospecto_telefono',
  'PRIV: authenticated can INSERT only the four prospect columns of cotizaciones'
);
SELECT is(
  (SELECT string_agg(a.attname, ',' ORDER BY a.attname) FROM pg_attribute a
    WHERE a.attrelid = 'public.cotizaciones'::regclass AND a.attnum > 0 AND NOT a.attisdropped
      AND has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')),
  'prospecto_contacto,prospecto_email,prospecto_nombre,prospecto_telefono',
  'PRIV: authenticated can UPDATE only the four prospect columns of cotizaciones'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.cotizaciones', 'DELETE, TRUNCATE'),
  'PRIV: authenticated has neither DELETE nor TRUNCATE on cotizaciones'
);
SELECT ok(
  NOT has_any_column_privilege('authenticated', 'public.cotizacion_eventos', 'INSERT, UPDATE')
  AND NOT has_table_privilege('authenticated', 'public.cotizacion_eventos', 'DELETE, TRUNCATE'),
  'PRIV: authenticated has no write privilege of any kind on cotizacion_eventos'
);
SELECT ok(
  NOT has_any_column_privilege('anon', to_regclass('public.' || t.nombre), 'SELECT, INSERT, UPDATE, REFERENCES')
  AND NOT has_table_privilege('anon', to_regclass('public.' || t.nombre), 'DELETE, TRUNCATE, TRIGGER'),
  format('PRIV: anon has no privilege at all on %s', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.' || t.nombre, 'REFERENCES')
  AND NOT has_any_column_privilege('authenticated', 'public.' || t.nombre, 'REFERENCES')
  AND NOT has_table_privilege('authenticated', 'public.' || t.nombre, 'TRIGGER')
  -- MAINTAIN exists from PostgreSQL 17 on; on older versions the name is not valid.
  AND NOT (CASE WHEN current_setting('server_version_num')::int >= 170000
                THEN has_table_privilege('authenticated', 'public.' || t.nombre, 'MAINTAIN')
                ELSE false END),
  format('PRIV: authenticated has no REFERENCES, TRIGGER or MAINTAIN on %s', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.' || t.nombre, 'SELECT WITH GRANT OPTION')
  AND NOT has_any_column_privilege('authenticated', 'public.' || t.nombre,
        'SELECT WITH GRANT OPTION, INSERT WITH GRANT OPTION, UPDATE WITH GRANT OPTION, REFERENCES WITH GRANT OPTION'),
  format('PRIV: authenticated holds no privilege WITH GRANT OPTION on %s', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);

-- ── ACL — the exact access control lists ─────────────────────────────────────
-- Besides the owner. Any new grantee, privilege or grant option breaks them.
SELECT is(
  (SELECT string_agg(x.grantee::regrole::text || ':' || x.privilege_type || CASE WHEN x.is_grantable THEN '*' ELSE '' END,
                     ',' ORDER BY x.grantee::regrole::text, x.privilege_type)
     FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid = to_regclass('public.' || t.nombre) AND x.grantee <> c.relowner),
  'authenticated:SELECT',
  format('ACL: the table ACL of %s (besides the owner) is exactly authenticated:SELECT, no grant option', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);
SELECT is(
  (SELECT string_agg(a.attname || ':' || x.grantee::regrole::text || ':' || x.privilege_type || CASE WHEN x.is_grantable THEN '*' ELSE '' END,
                     ',' ORDER BY a.attname, x.privilege_type)
     FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
    WHERE a.attrelid = 'public.cotizaciones'::regclass AND a.attnum > 0 AND NOT a.attisdropped),
  (SELECT string_agg(c || ':authenticated:' || p, ',' ORDER BY c, p)
     FROM unnest(ARRAY['prospecto_contacto', 'prospecto_email', 'prospecto_nombre', 'prospecto_telefono']) AS c,
          unnest(ARRAY['INSERT', 'UPDATE']) AS p),
  'ACL: the column ACLs of cotizaciones are exactly INSERT and UPDATE of the four prospect columns for authenticated'
);
SELECT is(
  (SELECT count(*)::int FROM pg_attribute a CROSS JOIN LATERAL aclexplode(a.attacl) x
    WHERE a.attrelid = 'public.cotizacion_eventos'::regclass AND a.attnum > 0 AND NOT a.attisdropped),
  0, 'ACL: cotizacion_eventos has no column-level ACL entry'
);
SELECT is(
  (SELECT count(*)::int FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE c.oid IN ('public.cotizacion_borrador_seq'::regclass, 'public.cotizacion_eventos_id_seq'::regclass)
      AND x.grantee <> c.relowner),
  0, 'ACL: the two sequences have no ACL entry besides the owner'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%' AND x.grantee <> p.proowner),
  0, 'ACL: no cotizacion_* function has an EXECUTE grant besides the owner (F3 narrows this to the canonical RPC list)'
);

-- ── SEQ — the sequences are closed to the API roles ──────────────────────────
-- (service_role is asserted in the SVC group.)
SELECT ok(
  NOT has_sequence_privilege(r.rol, 'public.' || s.seq, p.priv),
  format('SEQ: %s has no %s on %s', r.rol, p.priv, s.seq)
) FROM (VALUES ('anon'), ('authenticated')) AS r(rol),
     (VALUES ('cotizacion_borrador_seq'), ('cotizacion_eventos_id_seq')) AS s(seq),
     (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS p(priv);

-- ── S17 — the module's functions, walked from the catalog (pg_proc) ──────────
-- A future cotizacion_* function is covered with no change to this file's plan.
SELECT cmp_ok(
  (SELECT count(*)::int FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'),
  '>=', 6, 'S17: the catalog walk finds the module functions (at least the six F1 trigger functions)'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'
      AND NOT (p.prosecdef AND coalesce(p.proconfig, '{}') @> ARRAY['search_path=public, pg_temp'])),
  0, 'S17: every function of the module (touching tables or not) is SECURITY DEFINER and pins search_path = public, pg_temp'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
     CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'
      AND x.grantee = 0 AND x.privilege_type = 'EXECUTE'),
  0, 'S17: PUBLIC has EXECUTE on no function of the module'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'
      AND has_function_privilege('anon', p.oid, 'EXECUTE')),
  0, 'S17: anon has EXECUTE on no function of the module'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  0, 'S17: authenticated has EXECUTE on no function of the module (F1 creates no RPC)'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'
      AND has_function_privilege('service_role', p.oid, 'EXECUTE')),
  0, 'S17: service_role has EXECUTE on no function of the module'
);
SELECT is(
  (SELECT count(*)::int FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'cotizacion\_%'
      AND p.prosrc ~* '(current_setting|set_config|session_replication_role)'),
  0, 'S17: no function of the module reads a session variable, sets one or touches session_replication_role'
);
-- Only the empty key list exists in F1, so the order cannot be probed with data yet.
SELECT ok(
  (SELECT p.prosrc ~ 'array_agg\(k ORDER BY k COLLATE "C"\)' FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'cotizacion_evento_validar'),
  'S17: cotizacion_evento_validar() sorts the event keys with COLLATE "C" (no dependence on the locale)'
);
SELECT is(
  (SELECT count(*)::int FROM pg_trigger t
    WHERE NOT t.tgisinternal
      AND t.tgrelid IN ('public.cotizaciones'::regclass, 'public.cotizacion_eventos'::regclass)
      AND t.tgenabled <> 'A'),
  0, 'S17: every trigger on the two tables is ENABLE ALWAYS (none disabled, none origin-only)'
);
SELECT is(
  (SELECT count(*)::int FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgenabled = 'A'
      AND t.tgname = ANY (ARRAY['cotizaciones_preparar_alta', 'cotizaciones_controlar_cambio',
                                'cotizaciones_registrar_creada', 'cotizaciones_sin_truncate',
                                'cotizaciones_sin_borrado', 'cotizacion_eventos_validar',
                                'cotizacion_eventos_inmutable', 'cotizacion_eventos_sin_truncate'])),
  8, 'S17: the eight F1 triggers exist and are ENABLE ALWAYS'
);

-- ── S15 (postgres paths) — the alta trigger holds for roles that skip RLS ────
SELECT set_config('request.jwt.claims', '', true);
SELECT throws_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('S15 denegada') $$,
  '42501', 'COT:SIN_PERMISO', 'S15: postgres cannot insert without a session'
);
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('S15 denegada') $$,
  '42501', 'COT:SIN_PERMISO', 'S15: postgres cannot insert with a client session'
);
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('S15 denegada') $$,
  '42501', 'COT:SIN_PERMISO', 'S15: postgres cannot insert with a collaborator session'
);
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('S15 denegada') $$,
  '42501', 'COT:SIN_PERMISO', 'S15: postgres cannot insert with the session of a user without a profile'
);
SELECT is(
  (SELECT count(*)::int FROM public.cotizaciones WHERE prospecto_nombre = 'S15 denegada'),
  0, 'S15: none of the four rejected altas left a row behind'
);

-- Hostile alta by postgres with an admin session: every forced value is overwritten.
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (id, referencia_interna, estado, prospecto_nombre,
                                      creado_por, creado_at, actualizado_por, actualizado_at, row_version)
     VALUES ('c3000000-0000-4000-8000-0000000000aa', 'BOR-999', 'emitida', 'Hostil',
             'c1000000-0000-4000-8000-000000000003', '2000-01-01',
             'c1000000-0000-4000-8000-000000000003', '2000-01-01', 99) $$,
  'S15: postgres can send hostile estado, reference, version and audit values in an insert'
);
SELECT is(
  (SELECT estado || '|v' || row_version FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'borrador|v1', 'S15: an alta sent with estado = emitida and row_version = 99 is stored as borrador, version 1'
);
SELECT ok(
  (SELECT referencia_interna <> 'BOR-999' AND referencia_interna ~ '^BOR-[1-9][0-9]*$'
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S15: the hostile reference BOR-999 is overwritten by BOR-<n> (no zero padding)'
);
SELECT ok(
  (SELECT creado_por = 'c1000000-0000-4000-8000-000000000001' AND actualizado_por = 'c1000000-0000-4000-8000-000000000001'
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S15: creado_por and actualizado_por come from the session, not from the statement'
);
SELECT ok(
  (SELECT creado_at = now() AND actualizado_at = now()
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S15: creado_at and actualizado_at are set by the database, not by the statement'
);
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos
    WHERE cotizacion_id = 'c3000000-0000-4000-8000-0000000000aa' AND tipo = 'creada'
      AND actor = 'c1000000-0000-4000-8000-000000000001'),
  1, 'S24: the hostile alta wrote exactly one creada event, attributed to the session admin'
);
SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (id, prospecto_nombre) VALUES ('c3000000-0000-4000-8000-0000000000ab', 'Segunda') $$,
  'S15: a second alta succeeds'
);
SELECT ok(
  (SELECT substr(referencia_interna, 5)::bigint FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000ab')
  > (SELECT substr(referencia_interna, 5)::bigint FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S15: references come from a growing sequence'
);

-- Version and audit on UPDATE (the trigger decides, never the caller).
SELECT lives_ok(
  $$ UPDATE public.cotizaciones SET row_version = 500, actualizado_por = 'c1000000-0000-4000-8000-000000000003',
                                    actualizado_at = '2000-01-01'
      WHERE id = 'c3000000-0000-4000-8000-0000000000aa' $$,
  'S22: postgres can send hostile version and audit values in an update'
);
SELECT ok(
  (SELECT row_version = 2 AND actualizado_por = 'c1000000-0000-4000-8000-000000000001' AND actualizado_at = now()
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S22: row_version is old + 1 and actualizado_por/at are the session and now(), whatever was sent'
);
SELECT set_config('request.jwt.claims', '', true);
SELECT lives_ok(
  $$ UPDATE public.cotizaciones SET prospecto_nombre = 'Sin sesion' WHERE id = 'c3000000-0000-4000-8000-0000000000aa' $$,
  'S22: an update without a session is accepted for a borrador'
);
SELECT ok(
  (SELECT row_version = 3 AND actualizado_por IS NULL
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S22: without a session actualizado_por is NULL, never a stale or forged value'
);
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
SELECT lives_ok(
  $$ UPDATE public.cotizaciones SET prospecto_nombre = 'Otro admin' WHERE id = 'c3000000-0000-4000-8000-0000000000aa' $$,
  'S22: a second admin updates the first admin''s borrador'
);
SELECT ok(
  (SELECT row_version = 4 AND actualizado_por = 'c1000000-0000-4000-8000-000000000005'
          AND creado_por = 'c1000000-0000-4000-8000-000000000001'
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000aa'),
  'S22: actualizado_por follows the updater while creado_por stays with the creator'
);

-- ── S2 — the full state-transition matrix, as postgres (no RLS, no privileges) ─
SELECT set_config('request.jwt.claims', '', true);
CREATE TEMP TABLE _pares AS
SELECT o.n AS oo, o.estado AS origen, d.n AS dd, d.estado AS destino,
       (o.estado, d.estado) IN (('borrador', 'emitida'), ('borrador', 'cancelada'),
                                ('emitida', 'rechazada'), ('emitida', 'cancelada'),
                                ('emitida', 'aceptada_firmada'), ('aceptada_firmada', 'emitida')) AS permitida,
       o.estado = d.estado AS misma,
       NULL::uuid AS id
  FROM unnest(ARRAY['borrador', 'emitida', 'aceptada_firmada', 'rechazada', 'cancelada']) WITH ORDINALITY AS o(estado, n)
 CROSS JOIN unnest(ARRAY['borrador', 'emitida', 'aceptada_firmada', 'rechazada', 'cancelada']) WITH ORDINALITY AS d(estado, n);
-- One fresh row per origin/destination pair, each already in its origin state.
UPDATE _pares SET id = pg_temp.nueva_en(origen, NULL::uuid);

SELECT is(pg_temp.pasar(id, destino), destino, format('S2: %s -> %s is allowed', origen, destino))
  FROM _pares WHERE permitida AND NOT misma ORDER BY oo, dd;
SELECT is(pg_temp.pasar(id, destino), destino, format('S2: %s -> %s (estado unchanged) is not a transition', origen, destino))
  FROM _pares WHERE misma ORDER BY oo;
SELECT throws_ok(
  format('UPDATE public.cotizaciones SET estado = %L WHERE id = %L', destino, id),
  'P0001', 'COT:ESTADO_INVALIDO', format('S2: %s -> %s is rejected', origen, destino))
  FROM _pares WHERE NOT permitida AND NOT misma ORDER BY oo, dd;
SELECT is(
  (SELECT count(*)::int FROM _pares p JOIN public.cotizaciones c ON c.id = p.id
    WHERE NOT p.permitida AND NOT p.misma AND c.estado <> p.origen),
  0, 'S2: no rejected transition changed the estado of its row'
);
SELECT throws_ok(
  $$ UPDATE public.cotizaciones SET estado = NULL WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'P0001', 'COT:ESTADO_INVALIDO', 'S2: a NULL estado is rejected as an invalid state'
);
SELECT throws_ok(
  $$ UPDATE public.cotizaciones SET estado = 'estado_inexistente' WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'P0001', 'COT:ESTADO_INVALIDO', 'S2: an unknown estado is rejected as an invalid state'
);

-- ── S3 — a non-borrador row rejects prospect changes ─────────────────────────
SELECT throws_ok(
  format('UPDATE public.cotizaciones SET %I = %L WHERE id = %L', col, 'cambiado', 'c2000000-0000-4000-8000-000000000002'),
  'P0001', 'COT:INMUTABLE', 'S3: an emitida row rejects a change of ' || col)
  FROM unnest(ARRAY['prospecto_nombre', 'prospecto_contacto', 'prospecto_email', 'prospecto_telefono']) AS col;
SELECT throws_ok(
  format('UPDATE public.cotizaciones SET prospecto_nombre = %L WHERE id = %L', 'cambiado', f.id),
  'P0001', 'COT:INMUTABLE', format('S3: a row in %s rejects a change of the prospect', f.estado))
  FROM _fix f WHERE f.k IN ('A', 'R', 'C') ORDER BY f.k;
SELECT throws_ok(
  $$ UPDATE public.cotizaciones SET estado = 'rechazada', prospecto_nombre = 'cambiado'
      WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'P0001', 'COT:INMUTABLE', 'S3: a valid transition cannot carry a prospect change in the same statement'
);
SELECT is(
  (SELECT estado || '|' || prospecto_nombre FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000002'),
  'emitida|Fixture emitida', 'S3: the emitida fixture is untouched after every rejection'
);

-- ── S22 — whitelist immutability, swept from the catalog (one assertion) ─────
DO $$ BEGIN PERFORM pg_temp.barrido_inmutable(); END $$;
SELECT is(
  (SELECT count(*)::int FROM _s22_fallos), 0,
  'S22: every non-whitelisted column of cotizaciones (from the catalog) is frozen in every non-borrador state'
);
SELECT diag('S22 detail: ' || string_agg(k || '.' || attname || ' -> ' || coalesce(resultado, '(not probed)'), '; ' ORDER BY k, attname))
  FROM _s22_fallos HAVING count(*) > 0;

-- The whitelisted audit columns do not raise; the trigger overwrites them.
CREATE TEMP TABLE _v AS SELECT row_version AS v FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
SELECT lives_ok(
  $$ UPDATE public.cotizaciones SET row_version = 500, actualizado_por = 'c1000000-0000-4000-8000-000000000003',
                                    actualizado_at = '2000-01-01'
      WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'S22: the whitelisted audit columns are accepted on a non-borrador row'
);
SELECT ok(
  (SELECT c.row_version = (SELECT v FROM _v) + 1 AND c.actualizado_por = 'c1000000-0000-4000-8000-000000000005'
          AND c.actualizado_at = now()
     FROM public.cotizaciones c WHERE c.id = 'c2000000-0000-4000-8000-000000000002'),
  'S22: ...and the trigger overwrites them (old + 1, the session, now())'
);
SELECT set_config('request.jwt.claims', '', true);

-- Identity columns do not change even in a borrador.
SELECT throws_ok(
  format('UPDATE public.cotizaciones SET %I = %s WHERE id = %L', v.col, v.val, 'c2000000-0000-4000-8000-000000000001'),
  'P0001', 'COT:INMUTABLE', 'S22: a borrador cannot change ' || v.col)
  FROM (VALUES
    ('id',                 $v$gen_random_uuid()$v$),
    ('referencia_interna', $v$'BOR-424242'$v$),
    ('creado_por',         $v$gen_random_uuid()$v$),
    ('creado_at',          $v$now() + interval '1 day'$v$)
  ) AS v(col, val);

-- A column added by a later phase and never classified fails closed.
ALTER TABLE public.cotizaciones ADD COLUMN s22_futura text;
DO $$ BEGIN PERFORM pg_temp.barrido_inmutable(); END $$;
SELECT is(
  (SELECT count(*)::int FROM _s22_fallos), 0,
  'S22: a column added later and never classified is frozen in every non-borrador state (fails closed)'
);
SELECT diag('S22 detail: ' || string_agg(k || '.' || attname || ' -> ' || coalesce(resultado, '(not probed)'), '; ' ORDER BY k, attname))
  FROM _s22_fallos HAVING count(*) > 0;
SELECT lives_ok(
  $$ UPDATE public.cotizaciones SET s22_futura = 'x' WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'S22: the same new column stays writable while the row is a borrador'
);
ALTER TABLE public.cotizaciones DROP COLUMN s22_futura;

-- ── S4 — events are append-only, even for postgres ───────────────────────────
CREATE TEMP TABLE _cnt AS
SELECT (SELECT count(*)::int FROM public.cotizaciones) AS cot, (SELECT count(*)::int FROM public.cotizacion_eventos) AS ev;

SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$,
  'P0001', 'COT:INMUTABLE', 'S4: events reject UPDATE, even for postgres');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'S4: events reject DELETE, even for postgres');
SELECT throws_ok($$ TRUNCATE public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'S4: events reject TRUNCATE, even for postgres');
SELECT throws_ok($$ TRUNCATE public.cotizaciones, public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'S4: truncating both tables at once is rejected (the foreign key would allow it)');
SELECT throws_ok($$ TRUNCATE public.cotizaciones CASCADE $$,
  'P0001', 'COT:INMUTABLE', 'S4: TRUNCATE ... CASCADE on cotizaciones is rejected');
SELECT throws_ok($$ TRUNCATE public.cotizaciones $$,
  '0A000', NULL, 'S4: truncating cotizaciones alone is rejected (referenced by the events foreign key)');
SELECT throws_ok($$ DELETE FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'P0001', 'COT:INMUTABLE', 'S4: a cotizacion cannot be deleted, even by postgres (its own BEFORE DELETE trigger answers, not the foreign key)');
SELECT is(
  (SELECT cot || '/' || ev FROM _cnt),
  (SELECT (SELECT count(*) FROM public.cotizaciones) || '/' || (SELECT count(*) FROM public.cotizacion_eventos)),
  'S4: none of the rejected statements removed or changed a row count'
);

-- Replica mode (logical replication, --disable-triggers restores) must not bypass anything.
SET LOCAL session_replication_role = replica;
SELECT is(current_setting('session_replication_role'), 'replica', 'S4: the next attempts run with session_replication_role = replica');
SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$,
  'P0001', 'COT:INMUTABLE', 'S4: with replica, events still reject UPDATE');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'S4: with replica, events still reject DELETE');
SELECT throws_ok($$ TRUNCATE public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'S4: with replica, events still reject TRUNCATE');
SELECT throws_ok($$ DELETE FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'P0001', 'COT:INMUTABLE', 'S4: with replica, a cotizacion still rejects DELETE (the foreign key trigger is skipped there)');
SELECT throws_ok($$ UPDATE public.cotizaciones SET prospecto_nombre = 'cambiado' WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'P0001', 'COT:INMUTABLE', 'S22: with replica, a non-borrador row is still frozen');
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('replica') $$,
  '42501', 'COT:SIN_PERMISO', 'S15: with replica, an alta without a session is still rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '{"a":"b"}') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: with replica, the event schema is still enforced'
);
SET LOCAL session_replication_role = origin;
SELECT is(current_setting('session_replication_role'), 'origin', 'S4: session_replication_role is back to origin');
SELECT is(
  (SELECT count(*) FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000002')
  || '/' || (SELECT count(*) FROM public.cotizacion_eventos WHERE cotizacion_id = 'c2000000-0000-4000-8000-000000000002' AND tipo = 'creada'),
  '1/1', 'S4: the cotizacion and its creada event are still there after both DELETE attempts'
);

-- ── Baseline for the role checks ─────────────────────────────────────────────
CREATE TEMP TABLE _base AS
SELECT (SELECT count(*)::int FROM public.cotizaciones)        AS cot,
       (SELECT count(*)::int FROM public.cotizacion_eventos)  AS ev,
       (SELECT md5(string_agg(to_jsonb(c)::text, '|' ORDER BY c.id)) FROM public.cotizaciones c)       AS h_cot,
       (SELECT md5(string_agg(to_jsonb(e)::text, '|' ORDER BY e.id)) FROM public.cotizacion_eventos e) AS h_ev,
       (SELECT md5(string_agg(to_jsonb(c)::text, '|' ORDER BY c.id)) FROM public.cotizaciones c
         WHERE c.id IN (SELECT id FROM _fix WHERE estado <> 'borrador'))                               AS h_fix,
       (SELECT string_agg(estado || ':' || n, ',' ORDER BY estado)
          FROM (SELECT estado, count(*) AS n FROM public.cotizaciones GROUP BY estado) s)              AS por_estado;
GRANT SELECT ON _base TO PUBLIC;

SELECT cmp_ok((SELECT cot FROM _base), '>=', 5, 'A3: cotizaciones holds rows (in all five states) before the role checks');
SELECT cmp_ok((SELECT ev FROM _base),  '>=', 5, 'A3: cotizacion_eventos holds rows before the role checks');

-- ── anon ─────────────────────────────────────────────────────────────────────
SET LOCAL role anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT throws_ok(format('SELECT * FROM public.%I', t), '42501', NULL, format('A1: anon cannot SELECT from %s', t))
  FROM unnest(ARRAY['cotizaciones', 'cotizacion_eventos']) AS t;
SELECT throws_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('anon') $$,
  '42501', NULL, 'A2: anon cannot INSERT into cotizaciones');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000002', 'creada', 'c1000000-0000-4000-8000-000000000001') $$,
  '42501', NULL, 'A2: anon cannot INSERT into cotizacion_eventos');
SELECT throws_ok(format('UPDATE public.%I SET %I = NULL', t.nombre, t.col), '42501', NULL, format('A2: anon cannot UPDATE %s', t.nombre))
  FROM (VALUES ('cotizaciones', 'prospecto_nombre'), ('cotizacion_eventos', 'motivo')) AS t(nombre, col);
SELECT throws_ok(format('DELETE FROM public.%I', t), '42501', NULL, format('A2: anon cannot DELETE from %s', t))
  FROM unnest(ARRAY['cotizaciones', 'cotizacion_eventos']) AS t;
SELECT throws_ok($$ SELECT public.cotizacion_preparar_alta() $$, '42501', NULL, 'S17: anon cannot call cotizacion_preparar_alta()');
SELECT throws_ok($$ SELECT public.cotizacion_evento_validar() $$, '42501', NULL, 'S17: anon cannot call cotizacion_evento_validar()');
SELECT throws_ok($$ SELECT nextval('public.cotizacion_borrador_seq') $$, '42501', NULL, 'SEQ: anon cannot call nextval on cotizacion_borrador_seq');
RESET role;

-- ── client (2) ───────────────────────────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated","email":"cot-client@test.local"}', true);
SELECT is(public.get_user_type(), 2, 'ROLE: the client session resolves to user_type 2');
SELECT is((SELECT count(*)::int FROM public.cotizaciones), 0, 'A3: a client reads 0 rows of cotizaciones although rows exist');
SELECT is((SELECT count(*)::int FROM public.cotizacion_eventos), 0, 'A3: a client reads 0 rows of cotizacion_eventos although rows exist');
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('A5 cliente') $$,
  '42501', NULL, 'A5: a client cannot INSERT into cotizaciones');
SELECT is(pg_temp.afectadas($$ UPDATE public.cotizaciones SET prospecto_nombre = 'A5 hack' $$), 0::bigint,
  'A5: a client UPDATE of cotizaciones affects 0 rows');
SELECT throws_ok($$ DELETE FROM public.cotizaciones $$, '42501', NULL, 'A5: a client cannot DELETE from cotizaciones');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000002', 'creada', 'c1000000-0000-4000-8000-000000000003') $$,
  '42501', NULL, 'A5: a client cannot INSERT into cotizacion_eventos');
SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$, '42501', NULL, 'A5: a client cannot UPDATE cotizacion_eventos');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$, '42501', NULL, 'A5: a client cannot DELETE from cotizacion_eventos');
RESET role;

-- ── collaborator (1) ─────────────────────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated","email":"cot-collab@test.local"}', true);
SELECT is(public.get_user_type(), 1, 'ROLE: the collaborator session resolves to user_type 1');
SELECT is((SELECT count(*)::int FROM public.cotizaciones), 0, 'A4: a collaborator reads 0 rows of cotizaciones although rows exist');
SELECT is((SELECT count(*)::int FROM public.cotizacion_eventos), 0, 'A4: a collaborator reads 0 rows of cotizacion_eventos although rows exist');
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('A5 colaborador') $$,
  '42501', NULL, 'A5: a collaborator cannot INSERT into cotizaciones');
SELECT is(pg_temp.afectadas($$ UPDATE public.cotizaciones SET prospecto_nombre = 'A5 hack' $$), 0::bigint,
  'A5: a collaborator UPDATE of cotizaciones affects 0 rows');
SELECT throws_ok($$ DELETE FROM public.cotizaciones $$, '42501', NULL, 'A5: a collaborator cannot DELETE from cotizaciones');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000002', 'creada', 'c1000000-0000-4000-8000-000000000002') $$,
  '42501', NULL, 'A5: a collaborator cannot INSERT into cotizacion_eventos');
SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$, '42501', NULL, 'A5: a collaborator cannot UPDATE cotizacion_eventos');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$, '42501', NULL, 'A5: a collaborator cannot DELETE from cotizacion_eventos');
RESET role;

-- ── S14 — a user without a profiles row (role NULL) ──────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000004","role":"authenticated","email":"cot-noprofile@test.local"}', true);
SELECT is(public.get_user_type(), NULL, 'S14: a user without a profiles row resolves to a NULL role');
SELECT is((SELECT count(*)::int FROM public.cotizaciones), 0, 'S14: a user without a profile reads 0 rows of cotizaciones');
SELECT is((SELECT count(*)::int FROM public.cotizacion_eventos), 0, 'S14: a user without a profile reads 0 rows of cotizacion_eventos');
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('S14 sin perfil') $$,
  '42501', NULL, 'S14: a user without a profile cannot INSERT into cotizaciones');
SELECT is(pg_temp.afectadas($$ UPDATE public.cotizaciones SET prospecto_nombre = 'S14 hack' $$), 0::bigint,
  'S14: a user without a profile UPDATE of cotizaciones affects 0 rows');
SELECT throws_ok($$ DELETE FROM public.cotizaciones $$, '42501', NULL, 'S14: a user without a profile cannot DELETE from cotizaciones');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000002', 'creada', 'c1000000-0000-4000-8000-000000000004') $$,
  '42501', NULL, 'S14: a user without a profile cannot INSERT into cotizacion_eventos');
SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$, '42501', NULL, 'S14: a user without a profile cannot UPDATE cotizacion_eventos');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$, '42501', NULL, 'S14: a user without a profile cannot DELETE from cotizacion_eventos');
RESET role;

-- Nothing the anon, client, collaborator or profile-less attempts did changed a byte.
SELECT is((SELECT md5(string_agg(to_jsonb(c)::text, '|' ORDER BY c.id)) FROM public.cotizaciones c), (SELECT h_cot FROM _base),
  'A5: no rejected write by anon, client, collaborator or profile-less user changed cotizaciones');
SELECT is((SELECT md5(string_agg(to_jsonb(e)::text, '|' ORDER BY e.id)) FROM public.cotizacion_eventos e), (SELECT h_ev FROM _base),
  'A5: no rejected write by anon, client, collaborator or profile-less user changed cotizacion_eventos');

-- RLS alone. The alta trigger is switched off INSIDE this rolled-back test only,
-- to prove the policy layer rejects by itself (the layers are independent).
ALTER TABLE public.cotizaciones DISABLE TRIGGER cotizaciones_preparar_alta;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('RLS cliente') $$,
  '42501', 'new row violates row-level security policy for table "cotizaciones"',
  'A5: RLS alone rejects a client INSERT (alta trigger off for this check)');
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('RLS colaborador') $$,
  '42501', 'new row violates row-level security policy for table "cotizaciones"',
  'A5: RLS alone rejects a collaborator INSERT (alta trigger off for this check)');
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('RLS sin perfil') $$,
  '42501', 'new row violates row-level security policy for table "cotizaciones"',
  'S14: RLS alone rejects the INSERT of a user without a profile (alta trigger off for this check)');
RESET role;
ALTER TABLE public.cotizaciones ENABLE ALWAYS TRIGGER cotizaciones_preparar_alta;
SELECT is(
  (SELECT tgenabled::text FROM pg_trigger WHERE tgname = 'cotizaciones_preparar_alta'),
  'A', 'S17: the alta trigger is back to ENABLE ALWAYS after the RLS-only check'
);

-- ── admin (0) ────────────────────────────────────────────────────────────────
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","email":"cot-admin@test.local"}', true);
SELECT is(public.get_user_type(), 0, 'ROLE: the admin session resolves to user_type 0');

-- A6 / A7
SELECT is((SELECT count(*)::int FROM public.cotizaciones), (SELECT cot FROM pg_temp._base), 'A6: the admin reads every row of cotizaciones');
SELECT is((SELECT count(*)::int FROM public.cotizacion_eventos), (SELECT ev FROM pg_temp._base), 'A6: the admin reads every row of cotizacion_eventos');
SELECT is(
  (SELECT string_agg(estado || ':' || n, ',' ORDER BY estado)
     FROM (SELECT estado, count(*) AS n FROM public.cotizaciones GROUP BY estado) s),
  (SELECT por_estado FROM pg_temp._base), 'A6: the admin sees the rows of all five states (RLS does not hide non-borrador rows from reads)'
);
SELECT throws_ok($$ DELETE FROM public.cotizaciones $$, '42501', 'permission denied for table cotizaciones', 'A7: the admin cannot DELETE from cotizaciones');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$, '42501', 'permission denied for table cotizacion_eventos', 'A7: the admin cannot DELETE from cotizacion_eventos');
SELECT throws_ok($$ TRUNCATE public.cotizaciones $$, '42501', 'permission denied for table cotizaciones', 'A7: the admin cannot TRUNCATE cotizaciones');
SELECT throws_ok($$ TRUNCATE public.cotizacion_eventos $$, '42501', 'permission denied for table cotizacion_eventos', 'A7: the admin cannot TRUNCATE cotizacion_eventos');

-- S10 / S4 (admin side): the audit trail cannot be forged or edited from the API
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000002', 'creada', 'c1000000-0000-4000-8000-000000000001') $$,
  '42501', 'permission denied for table cotizacion_eventos', 'S10: the admin cannot insert an event');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000002', 'creada', 'c1000000-0000-4000-8000-000000000003') $$,
  '42501', 'permission denied for table cotizacion_eventos', 'S10: the admin cannot forge an event attributed to someone else');
SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$, '42501', 'permission denied for table cotizacion_eventos', 'S4: the admin cannot UPDATE an event');

-- S1
SELECT throws_ok($$ UPDATE public.cotizaciones SET estado = 'emitida' $$, '42501', 'permission denied for table cotizaciones', 'S1: the admin cannot write estado');
SELECT is(
  (SELECT estado FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000001'),
  'borrador', 'S1: the borrador fixture is still a borrador');

-- S15: the admin can insert only the prospect columns
SELECT throws_ok(
  format('INSERT INTO public.cotizaciones (prospecto_nombre, %I) VALUES (%L, %s)', v.col, 'S15 ' || v.col, v.val),
  '42501', 'permission denied for table cotizaciones', 'S15: the admin cannot INSERT ' || v.col)
  FROM (VALUES
    ('id',                 $v$gen_random_uuid()$v$),
    ('referencia_interna', $v$'BOR-7'$v$),
    ('estado',             $v$'emitida'$v$),
    ('row_version',        $v$5$v$),
    ('creado_por',         $v$'c1000000-0000-4000-8000-000000000003'$v$),
    ('creado_at',          $v$now()$v$),
    ('actualizado_por',    $v$'c1000000-0000-4000-8000-000000000003'$v$),
    ('actualizado_at',     $v$now()$v$)
  ) AS v(col, val);
SELECT throws_ok(
  format('UPDATE public.cotizaciones SET %I = %s WHERE id = %L', v.col, v.val, 'c2000000-0000-4000-8000-000000000001'),
  '42501', 'permission denied for table cotizaciones', 'S15: the admin cannot UPDATE ' || v.col)
  FROM (VALUES
    ('id',                 $v$gen_random_uuid()$v$),
    ('referencia_interna', $v$'BOR-7'$v$),
    ('row_version',        $v$5$v$),
    ('creado_por',         $v$'c1000000-0000-4000-8000-000000000003'$v$),
    ('creado_at',          $v$now()$v$),
    ('actualizado_por',    $v$'c1000000-0000-4000-8000-000000000003'$v$),
    ('actualizado_at',     $v$now()$v$)
  ) AS v(col, val);

SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono)
     VALUES ('Alta Admin', 'Contacto', 'alta@test.local', '5550101') $$,
  'S15: the admin inserts a prospect with the four granted columns');
SELECT is(
  (SELECT estado || '|v' || row_version FROM public.cotizaciones WHERE prospecto_nombre = 'Alta Admin'),
  'borrador|v1', 'S15: the new row is a borrador at version 1');
SELECT ok(
  (SELECT creado_por = 'c1000000-0000-4000-8000-000000000001' AND actualizado_por = 'c1000000-0000-4000-8000-000000000001'
     FROM public.cotizaciones WHERE prospecto_nombre = 'Alta Admin'),
  'S15: the new row is audited with the admin session (creado_por, actualizado_por)');
SELECT ok(
  (SELECT creado_at = now() AND actualizado_at = now() FROM public.cotizaciones WHERE prospecto_nombre = 'Alta Admin'),
  'S15: the new row carries database timestamps (creado_at, actualizado_at)');
SELECT ok(
  (SELECT referencia_interna ~ '^BOR-[1-9][0-9]*$' FROM public.cotizaciones WHERE prospecto_nombre = 'Alta Admin'),
  'S15: the new row got BOR-<n> from the sequence (no zero padding)');
SELECT ok(
  NOT (has_sequence_privilege('authenticated', 'public.cotizacion_borrador_seq', 'USAGE')
    OR has_sequence_privilege('authenticated', 'public.cotizacion_borrador_seq', 'SELECT')
    OR has_sequence_privilege('authenticated', 'public.cotizacion_borrador_seq', 'UPDATE'))
  AND EXISTS (SELECT 1 FROM public.cotizaciones WHERE prospecto_nombre = 'Alta Admin'),
  'SEQ: the admin alta works while authenticated holds no privilege on the sequence');
SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('Alta Returning')
     RETURNING id, referencia_interna, estado, row_version $$,
  'S15: INSERT ... RETURNING works for the admin (what the client library sends)');
SELECT lives_ok($$ INSERT INTO public.cotizaciones DEFAULT VALUES $$,
  'S15: an alta with no prospect data is accepted (the minimum is enforced at emission, not here)');

-- S24: sentinel prospect, same-transaction audit
SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono)
     VALUES ('SENTINEL-NOMBRE-7f31', 'SENTINEL-CONTACTO-7f31', 'sentinel-email-7f31@test.local', 'SENTINEL-TEL-7f31') $$,
  'S24: the admin inserts a prospect made of sentinel strings');
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos e JOIN public.cotizaciones c ON c.id = e.cotizacion_id
    WHERE c.prospecto_nombre = 'SENTINEL-NOMBRE-7f31' AND e.tipo = 'creada'),
  1, 'S24: the alta wrote exactly one creada event');
SELECT is(
  (SELECT e.detalle FROM public.cotizacion_eventos e JOIN public.cotizaciones c ON c.id = e.cotizacion_id
    WHERE c.prospecto_nombre = 'SENTINEL-NOMBRE-7f31'),
  '{}'::jsonb, 'S24: the creada event has an exactly empty detalle');
SELECT is(
  (SELECT e.motivo FROM public.cotizacion_eventos e JOIN public.cotizaciones c ON c.id = e.cotizacion_id
    WHERE c.prospecto_nombre = 'SENTINEL-NOMBRE-7f31'),
  NULL, 'S24: the creada event has a NULL motivo');
SELECT is(
  (SELECT e.actor FROM public.cotizacion_eventos e JOIN public.cotizaciones c ON c.id = e.cotizacion_id
    WHERE c.prospecto_nombre = 'SENTINEL-NOMBRE-7f31'),
  'c1000000-0000-4000-8000-000000000001'::uuid, 'S24: the creada event actor is the admin session');
SELECT ok(
  (SELECT e.ocurrido_at = now() FROM public.cotizacion_eventos e JOIN public.cotizaciones c ON c.id = e.cotizacion_id
    WHERE c.prospecto_nombre = 'SENTINEL-NOMBRE-7f31'),
  'S24: the creada event timestamp is set by the database (ocurrido_at = the transaction time of the alta)');
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos e
    WHERE to_jsonb(e)::text ~* 'SENTINEL-NOMBRE-7f31|SENTINEL-CONTACTO-7f31|sentinel-email-7f31|SENTINEL-TEL-7f31'),
  0, 'S24: no sentinel name, contact, e-mail or phone appears in any event');
SELECT is(pg_temp.alta_revertida(), 'inside=1,cotizaciones=0,events=0',
  'S24: the creada event lives and dies with its alta (same transaction)');
SELECT is(
  (SELECT count(*)::int FROM public.cotizaciones c
    WHERE (SELECT count(*) FROM public.cotizacion_eventos e WHERE e.cotizacion_id = c.id AND e.tipo = 'creada') <> 1),
  0, 'S24: every cotizacion has exactly one creada event');

-- S22 / S3 (admin side): version bump on every UPDATE; non-borrador rows are out of reach
SELECT is(pg_temp.subidas('c2000000-0000-4000-8000-000000000001'), '+1,+1',
  'S22: every UPDATE of a borrador raises row_version by one, even one that changes nothing');
SELECT lives_ok(
  $$ UPDATE public.cotizaciones SET prospecto_nombre = 'Cambio', prospecto_contacto = 'Cambio',
                                    prospecto_email = 'cambio@test.local', prospecto_telefono = '5550102'
      WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'S3: a borrador accepts a change of the four prospect columns from the admin');
SELECT is(
  (SELECT prospecto_nombre || '|' || prospecto_contacto || '|' || prospecto_email || '|' || prospecto_telefono
     FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000001'),
  'Cambio|Cambio|cambio@test.local|5550102', 'S3: the four prospect changes of the borrador were stored');
SELECT is(
  pg_temp.afectadas($$ UPDATE public.cotizaciones SET prospecto_nombre = 'hack'
                        WHERE id IN ('c2000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000003',
                                     'c2000000-0000-4000-8000-000000000004', 'c2000000-0000-4000-8000-000000000005') $$),
  0::bigint, 'S3: the admin UPDATE of rows that are not borradores affects 0 rows (RLS)');
SELECT is(
  (SELECT prospecto_nombre FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000002'),
  'Fixture emitida', 'S3: the emitida fixture still holds its original prospect');

-- LEN: prospect length limits
SELECT throws_ok(
  format('INSERT INTO public.cotizaciones (%I) VALUES (repeat(''x'', %s))', v.col, v.n + 1),
  '23514', NULL, format('LEN: %s longer than %s characters is rejected', v.col, v.n))
  FROM (VALUES ('prospecto_nombre', 200), ('prospecto_contacto', 200), ('prospecto_email', 254), ('prospecto_telefono', 40)) AS v(col, n);
SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono)
     VALUES (repeat('a', 200), repeat('b', 200), repeat('c', 254), repeat('1', 40)) $$,
  'LEN: the four prospect columns accept exactly their maximum length');

-- S17 / SEQ (an admin is authenticated too: still no direct access)
SELECT throws_ok($$ SELECT public.cotizacion_controlar_cambio() $$, '42501', NULL, 'S17: even an admin cannot call cotizacion_controlar_cambio()');
SELECT throws_ok($$ SELECT public.cotizacion_registrar_creada() $$, '42501', NULL, 'S17: even an admin cannot call cotizacion_registrar_creada()');
SELECT throws_ok($$ SELECT nextval('public.cotizacion_borrador_seq') $$, '42501', NULL, 'SEQ: authenticated cannot call nextval on cotizacion_borrador_seq');
SELECT throws_ok($$ SELECT last_value FROM public.cotizacion_borrador_seq $$, '42501', NULL, 'SEQ: authenticated cannot read cotizacion_borrador_seq');
SELECT throws_ok($$ SELECT setval('public.cotizacion_borrador_seq', 1) $$, '42501', NULL, 'SEQ: authenticated cannot setval cotizacion_borrador_seq');
SELECT throws_ok($$ SELECT nextval('public.cotizacion_eventos_id_seq') $$, '42501', NULL, 'SEQ: authenticated cannot call nextval on cotizacion_eventos_id_seq');
RESET role;

-- ── SVC — service_role (BYPASSRLS): no privileges on the module ──────────────
-- Decision of security: Supabase grants ALL on new objects to service_role by
-- default and the migration revokes it, so a leaked service key cannot forge an
-- event, call setval, or touch either table. The catalog says so, and the real
-- statements fail with 42501 (privileges are checked before RLS and triggers).
SELECT ok(
  NOT has_any_column_privilege('service_role', to_regclass('public.' || t.nombre), 'SELECT, INSERT, UPDATE, REFERENCES')
  AND NOT has_table_privilege('service_role', to_regclass('public.' || t.nombre), 'DELETE, TRUNCATE, TRIGGER'),
  format('SVC: service_role has no privilege at all on %s', t.nombre)
) FROM (VALUES ('cotizaciones'), ('cotizacion_eventos')) AS t(nombre);
SELECT ok(
  NOT has_sequence_privilege('service_role', 'public.' || s.seq, p.priv),
  format('SVC: service_role has no %s on %s', p.priv, s.seq)
) FROM (VALUES ('cotizacion_borrador_seq'), ('cotizacion_eventos_id_seq')) AS s(seq),
     (VALUES ('USAGE'), ('SELECT'), ('UPDATE')) AS p(priv);
SELECT ok(
  NOT has_function_privilege('service_role', p.oid, 'EXECUTE'),
  format('SVC: service_role has no EXECUTE on %s()', p.proname)
) FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace
    AND p.proname IN ('cotizacion_preparar_alta', 'cotizacion_controlar_cambio', 'cotizacion_registrar_creada',
                      'cotizacion_evento_validar', 'cotizacion_evento_inmutable', 'cotizacion_bloquear_truncate')
  ORDER BY p.proname;

SET LOCAL role service_role;
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT is(current_user::text, 'service_role', 'SVC: the following checks run as service_role');
SELECT throws_ok(s.sentencia, '42501', 'permission denied for table ' || s.tabla,
  format('SVC: service_role cannot %s %s', s.accion, s.tabla))
  FROM (VALUES
    ('SELECT from',   'cotizaciones',       $q$ SELECT count(*) FROM public.cotizaciones $q$),
    ('INSERT into',   'cotizaciones',       $q$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('svc') $q$),
    ('UPDATE',        'cotizaciones',       $q$ UPDATE public.cotizaciones SET prospecto_nombre = NULL $q$),
    ('DELETE from',   'cotizaciones',       $q$ DELETE FROM public.cotizaciones $q$),
    ('TRUNCATE',      'cotizaciones',       $q$ TRUNCATE public.cotizaciones $q$),
    ('SELECT from',   'cotizacion_eventos', $q$ SELECT count(*) FROM public.cotizacion_eventos $q$),
    ('INSERT into',   'cotizacion_eventos', $q$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
                                                VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001') $q$),
    ('UPDATE',        'cotizacion_eventos', $q$ UPDATE public.cotizacion_eventos SET motivo = NULL $q$),
    ('DELETE from',   'cotizacion_eventos', $q$ DELETE FROM public.cotizacion_eventos $q$),
    ('TRUNCATE',      'cotizacion_eventos', $q$ TRUNCATE public.cotizacion_eventos $q$)
  ) AS s(accion, tabla, sentencia);
SELECT throws_ok(q.sentencia, '42501', 'permission denied for sequence ' || q.seq,
  format('SVC: service_role cannot call %s on %s', q.fn, q.seq))
  FROM (SELECT f.fn, s.seq, format('SELECT %s(%L%s)', f.fn, 'public.' || s.seq, f.resto) AS sentencia
          FROM (VALUES ('nextval', ''), ('setval', ', 1')) AS f(fn, resto),
               (VALUES ('cotizacion_borrador_seq'), ('cotizacion_eventos_id_seq')) AS s(seq)) AS q;
SELECT throws_ok(format('SELECT last_value FROM public.%I', s.seq), '42501',
  'permission denied for sequence ' || s.seq, format('SVC: service_role cannot read %s', s.seq))
  FROM (VALUES ('cotizacion_borrador_seq'), ('cotizacion_eventos_id_seq')) AS s(seq);
SELECT throws_ok(format('SELECT public.%I()', fn), '42501', format('permission denied for function %s', fn),
  format('SVC: service_role cannot call %s()', fn))
  FROM unnest(ARRAY['cotizacion_preparar_alta', 'cotizacion_controlar_cambio', 'cotizacion_registrar_creada',
                    'cotizacion_evento_validar', 'cotizacion_evento_inmutable', 'cotizacion_bloquear_truncate']) AS fn;
RESET role;

-- ── SVC (claims) — the triggers decide, whatever role the session claims ─────
-- The triggers apply to every role that does hold privileges. A service_role
-- claim in the session buys nothing: they read the session (sub), not the role
-- claim. Run as postgres, the one role left that can write.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('svc') $$,
  '42501', 'COT:SIN_PERMISO', 'SVC: with a service_role claim and no sub, an alta is rejected');
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"service_role"}', true);
SELECT throws_ok($$ INSERT INTO public.cotizaciones (prospecto_nombre) VALUES ('svc') $$,
  '42501', 'COT:SIN_PERMISO', 'SVC: with a service_role claim and a client sub, an alta is rejected');
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"service_role"}', true);
SELECT lives_ok(
  $$ INSERT INTO public.cotizaciones (id, referencia_interna, estado, prospecto_nombre, row_version)
     VALUES ('c3000000-0000-4000-8000-0000000000ac', 'BOR-1000', 'emitida', 'SVC alta', 99) $$,
  'SVC: with a service_role claim and an admin sub, an alta is accepted, whatever hostile values it sends');
SELECT ok(
  (SELECT estado = 'borrador' AND row_version = 1 AND referencia_interna <> 'BOR-1000'
          AND referencia_interna ~ '^BOR-[1-9][0-9]*$'
     FROM public.cotizaciones WHERE id = 'c3000000-0000-4000-8000-0000000000ac'),
  'SVC: that alta is stored as borrador, version 1, with a sequence reference');
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT throws_ok($$ UPDATE public.cotizaciones SET estado = 'aceptada_firmada' WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'P0001', 'COT:ESTADO_INVALIDO', 'SVC: with a service_role claim, borrador -> aceptada_firmada is rejected');
SELECT throws_ok($$ UPDATE public.cotizaciones SET estado = 'borrador' WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'P0001', 'COT:ESTADO_INVALIDO', 'SVC: with a service_role claim, an emitida row cannot go back to borrador');
SELECT throws_ok($$ UPDATE public.cotizaciones SET estado = 'emitida' WHERE id = 'c2000000-0000-4000-8000-000000000004' $$,
  'P0001', 'COT:ESTADO_INVALIDO', 'SVC: with a service_role claim, a rechazada row cannot be reopened');
SELECT throws_ok($$ UPDATE public.cotizaciones SET estado = 'emitida' WHERE id = 'c2000000-0000-4000-8000-000000000005' $$,
  'P0001', 'COT:ESTADO_INVALIDO', 'SVC: with a service_role claim, a cancelada row cannot be reopened');
SELECT throws_ok($$ UPDATE public.cotizaciones SET prospecto_nombre = 'cambiado' WHERE id = 'c2000000-0000-4000-8000-000000000002' $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, a frozen column of an emitida row cannot change');
SELECT throws_ok($$ UPDATE public.cotizaciones SET referencia_interna = 'BOR-424242' WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, the reference of a borrador cannot change');
SELECT throws_ok($$ UPDATE public.cotizacion_eventos SET motivo = NULL $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, events reject UPDATE');
SELECT throws_ok($$ DELETE FROM public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, events reject DELETE');
SELECT throws_ok($$ TRUNCATE public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, events reject TRUNCATE');
SELECT throws_ok($$ TRUNCATE public.cotizaciones, public.cotizacion_eventos $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, truncating both tables at once is rejected');
SELECT throws_ok($$ DELETE FROM public.cotizaciones WHERE id = 'c2000000-0000-4000-8000-000000000001' $$,
  'P0001', 'COT:INMUTABLE', 'SVC: with a service_role claim, a cotizacion cannot be deleted');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '{"a":"b"}') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'SVC: with a service_role claim, the event schema still applies (extra key)');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'tipo_inexistente_zz', 'c1000000-0000-4000-8000-000000000001') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'SVC: with a service_role claim, the event schema still applies (unknown tipo)');
SELECT set_config('request.jwt.claims', '', true);

SELECT is(
  (SELECT md5(string_agg(to_jsonb(c)::text, '|' ORDER BY c.id)) FROM public.cotizaciones c
    WHERE c.id IN (SELECT id FROM _fix WHERE estado <> 'borrador')),
  (SELECT h_fix FROM _base),
  'S3: the four non-borrador fixtures are byte-identical after every admin and service_role-claim attempt'
);

-- ── S24 — the event schema, as postgres ──────────────────────────────────────
SELECT set_config('request.jwt.claims', '', true);
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '{"a":"b"}') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle with one key is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001',
             '{"prospecto_email":"sentinel-email-7f31@test.local"}') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle carrying a prospect e-mail is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '[]') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle that is an array is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '"texto"') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle that is a text scalar is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '1') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle that is a number is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', 'null') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle that is the JSON null is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', NULL) $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a SQL NULL detalle is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001',
             jsonb_build_object('k', repeat('a', 300))) $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a detalle of more than 256 characters is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, motivo)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', 'motivo en un tipo que no lo lleva') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a non-null motivo on a type that carries none is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'tipo_inexistente_zz', 'c1000000-0000-4000-8000-000000000001') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: an unknown event tipo is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000001', NULL, 'c1000000-0000-4000-8000-000000000001') $$,
  'P0001', 'COT:DETALLE_INVALIDO', 'S24: a NULL event tipo is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001') $$,
  '23505', 'duplicate key value violates unique constraint "cotizacion_eventos_creada_unica"',
  'S24: a second creada event for the same cotizacion is rejected by the unique index, even for postgres');
SELECT is(
  (SELECT string_agg(e.detalle::text || '|' || coalesce(e.motivo, '<null>') || '|' || e.actor, ';')
     FROM public.cotizacion_eventos e
    WHERE e.cotizacion_id = 'c2000000-0000-4000-8000-000000000001' AND e.tipo = 'creada'),
  '{}|<null>|c1000000-0000-4000-8000-000000000001',
  'S24: the one creada event of the fixture exists, with detalle {}, no motivo and the admin as actor (positive control)');
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos WHERE detalle <> '{}'::jsonb OR motivo IS NOT NULL),
  0, 'S24: no stored event carries a key, a detalle or a motivo');

-- ── ACT — the actor of an event is the session (auth.uid()) ──────────────────
-- Two cotizaciones are made WITHOUT their creada event (the registrar trigger is
-- switched off INSIDE this rolled-back test only), so a creada event can be
-- inserted by hand without meeting the unique index.
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
ALTER TABLE public.cotizaciones DISABLE TRIGGER cotizaciones_registrar_creada;
INSERT INTO public.cotizaciones (id, prospecto_nombre) VALUES
  ('c3000000-0000-4000-8000-0000000000b1', 'ACT uno'),
  ('c3000000-0000-4000-8000-0000000000b2', 'ACT dos');
ALTER TABLE public.cotizaciones ENABLE ALWAYS TRIGGER cotizaciones_registrar_creada;
SELECT is(
  (SELECT tgenabled::text FROM pg_trigger WHERE tgname = 'cotizaciones_registrar_creada'),
  'A', 'ACT: the registrar trigger is back to ENABLE ALWAYS after the setup');
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos WHERE cotizacion_id IN
     ('c3000000-0000-4000-8000-0000000000b1', 'c3000000-0000-4000-8000-0000000000b2')),
  0, 'ACT: the two setup cotizaciones start with no event');
-- With the admin session of ...01:
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b1', 'creada', 'c1000000-0000-4000-8000-000000000003') $$,
  '42501', 'COT:SIN_PERMISO', 'ACT: with a session, an event whose actor is another user is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b1', 'creada', 'c1000000-0000-4000-8000-000000000005') $$,
  '42501', 'COT:SIN_PERMISO', 'ACT: with a session, an event whose actor is another admin is rejected');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b1', 'creada', NULL) $$,
  '42501', 'COT:SIN_PERMISO', 'ACT: with a session, an event with a NULL actor is rejected as a permission error');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c3000000-0000-4000-8000-0000000000b1', 'creada', 'c1000000-0000-4000-8000-000000000003', '{"a":"b"}') $$,
  '42501', 'COT:SIN_PERMISO', 'ACT: the actor check comes first: a foreign actor with an invalid detalle is a permission error');
-- The rule does not look at the role of the session: a client session is held to it too.
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b1', 'creada', 'c1000000-0000-4000-8000-000000000001') $$,
  '42501', 'COT:SIN_PERMISO', 'ACT: a client session cannot name an admin as the actor either (the rule ignores the role)');
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos WHERE cotizacion_id = 'c3000000-0000-4000-8000-0000000000b1'),
  0, 'ACT: none of the rejected events was stored');
SELECT lives_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b1', 'creada', 'c1000000-0000-4000-8000-000000000001') $$,
  'ACT: with a session, an event whose actor is the session passes the validator');
-- Without a session (maintenance, restores) the rule is not applied.
SELECT set_config('request.jwt.claims', '', true);
SELECT lives_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b2', 'creada', 'c1000000-0000-4000-8000-000000000003') $$,
  'ACT: without a session the actor rule is not applied (any actor is accepted)');
SELECT is(
  (SELECT string_agg(right(cotizacion_id::text, 2) || '=' || right(actor::text, 2), ' ' ORDER BY cotizacion_id)
     FROM public.cotizacion_eventos WHERE cotizacion_id IN
       ('c3000000-0000-4000-8000-0000000000b1', 'c3000000-0000-4000-8000-0000000000b2')),
  'b1=01 b2=03', 'ACT: each event kept the actor it was inserted with');
SELECT throws_ok(
  $$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c3000000-0000-4000-8000-0000000000b2', 'creada', NULL) $$,
  '23502', NULL, 'ACT: without a session a NULL actor still fails the NOT NULL constraint');
SELECT is(
  (SELECT count(*)::int FROM public.cotizaciones c
    WHERE (SELECT count(*) FROM public.cotizacion_eventos e WHERE e.cotizacion_id = c.id AND e.tipo = 'creada') <> 1),
  0, 'ACT: every cotizacion has exactly one creada event again');

-- ── CHK — the declarative layer alone (triggers off, rolled back) ────────────
-- Constraints and indexes must hold even if a trigger is ever disabled by hand.
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizaciones (referencia_interna, creado_por)
     VALUES ('BOR-777777', 'c1000000-0000-4000-8000-000000000001'), ('BOR-777777', 'c1000000-0000-4000-8000-000000000001') $$),
  '23505:cotizaciones_referencia_interna_key',
  'CHK: UNIQUE (referencia_interna) is exercised: a duplicate reference is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizaciones (referencia_interna, creado_por)
     VALUES ('BOR-12a', 'c1000000-0000-4000-8000-000000000001') $$),
  '23514:cotizaciones_referencia_interna_formato', 'CHK: a reference that is not BOR-<digits> is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizaciones (referencia_interna, creado_por, estado)
     VALUES ('BOR-777778', 'c1000000-0000-4000-8000-000000000001', 'otro') $$),
  '23514:cotizaciones_estado_check', 'CHK: an estado outside the five known ones is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizaciones (referencia_interna, creado_por, row_version)
     VALUES ('BOR-777779', 'c1000000-0000-4000-8000-000000000001', 0) $$),
  '23514:cotizaciones_row_version_check', 'CHK: a row_version below 1 is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'tipo_inexistente_zz', 'c1000000-0000-4000-8000-000000000001') $$),
  '23514:cotizacion_eventos_tipo_check', 'CHK: an event tipo outside the closed set is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', '[]') $$),
  '23514:cotizacion_eventos_detalle_forma', 'CHK: a detalle that is not a JSON object is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, detalle)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001',
             jsonb_build_object('k', repeat('a', 300))) $$),
  '23514:cotizacion_eventos_detalle_forma', 'CHK: a detalle of more than 256 characters is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor, motivo)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001', repeat('m', 1001)) $$),
  '23514:cotizacion_eventos_motivo_len', 'CHK: a motivo of more than 1000 characters is rejected');
SELECT is(
  pg_temp.solo_restricciones($$ INSERT INTO public.cotizacion_eventos (cotizacion_id, tipo, actor)
     VALUES ('c2000000-0000-4000-8000-000000000001', 'creada', 'c1000000-0000-4000-8000-000000000001') $$),
  '23505:cotizacion_eventos_creada_unica', 'CHK: even with the triggers off, a second creada event is rejected by the unique index');
SELECT is(
  (SELECT confdeltype::text FROM pg_constraint
    WHERE conrelid = 'public.cotizacion_eventos'::regclass AND contype = 'f' AND confrelid = 'public.cotizaciones'::regclass),
  'r', 'CHK: the foreign key from the events to their cotizacion is ON DELETE RESTRICT (a second line behind the DELETE trigger)');
SELECT is(pg_get_serial_sequence('public.cotizaciones', 'referencia_interna'), 'public.cotizacion_borrador_seq',
  'CHK: the reference sequence is owned by referencia_interna (it dies with the column)');
SELECT is(
  (SELECT a.attidentity::text FROM pg_attribute a WHERE a.attrelid = 'public.cotizacion_eventos'::regclass AND a.attname = 'id'),
  'a', 'CHK: the event id is GENERATED ALWAYS (nobody can choose it)');
SELECT is(
  (SELECT string_agg(t.tgname || '=' || t.tgenabled::text, ',' ORDER BY t.tgname) FROM pg_trigger t
    WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.cotizaciones'::regclass, 'public.cotizacion_eventos'::regclass)
      AND t.tgenabled <> 'A'),
  NULL, 'CHK: the helper left no trigger switched off or lowered from ENABLE ALWAYS');

-- ── FWD — forward catalog walk (module relations present and future) ─────────
SELECT cmp_ok(
  (SELECT count(*)::int FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') AND c.relname LIKE 'cotizacion%'),
  '>=', 2, 'FWD: the catalog walk finds the module tables');
SELECT is(
  (SELECT string_agg(c.relname, ', ' ORDER BY c.relname) FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (c.relname LIKE 'cotizacion%' OR c.relname LIKE 'catalogo%')
      AND ((c.relkind IN ('r', 'p') AND NOT c.relrowsecurity)
        OR has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
        OR has_table_privilege('anon', c.oid, 'DELETE, TRUNCATE, TRIGGER')
        OR has_any_column_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
        OR has_table_privilege('service_role', c.oid, 'DELETE, TRUNCATE, TRIGGER'))),
  NULL, 'FWD: every cotizacion*/catalogo* relation has RLS, no anon privilege and no service_role privilege (none listed)');
SELECT is(
  (SELECT string_agg(c.relname || ':' || r.rol, ', ' ORDER BY c.relname, r.rol) FROM pg_class c
     CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS r(rol)
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'S'
      AND (c.relname LIKE 'cotizacion%' OR c.relname LIKE 'catalogo%')
      AND has_sequence_privilege(r.rol, c.oid, 'USAGE, SELECT, UPDATE')),
  NULL, 'FWD: no cotizacion*/catalogo* sequence is open to anon, authenticated or service_role (none listed)');

-- ── ACC — deleting an admin account (no foreign key on the audit identities) ──
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
INSERT INTO public.cotizaciones (id, prospecto_nombre) VALUES ('c3000000-0000-4000-8000-0000000000e1', 'ACC alta');
SELECT set_config('request.jwt.claims', '', true);
SELECT lives_ok($$ DELETE FROM auth.users WHERE id = 'c1000000-0000-4000-8000-000000000005' $$,
  'ACC: deleting the account of an admin is not blocked by the module');
SELECT is(
  (SELECT count(*)::int FROM public.cotizaciones
    WHERE id = 'c3000000-0000-4000-8000-0000000000e1'
      AND creado_por = 'c1000000-0000-4000-8000-000000000005' AND actualizado_por = 'c1000000-0000-4000-8000-000000000005'),
  1, 'ACC: the cotizacion keeps its creado_por and actualizado_por after the deletion of the account');
SELECT is(
  (SELECT count(*)::int FROM public.cotizacion_eventos
    WHERE cotizacion_id = 'c3000000-0000-4000-8000-0000000000e1' AND actor = 'c1000000-0000-4000-8000-000000000005'),
  1, 'ACC: the audit event keeps its actor after the deletion of the account');
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
SELECT is((SELECT count(*)::int FROM public.cotizaciones), 0,
  'ACC: the still-valid JWT of the deleted admin reads 0 rows (its role resolves to NULL)');
RESET role;
SELECT set_config('request.jwt.claims', '', true);

-- Last check, because it edits the schema (rolled back with the transaction): the
-- foreign key already blocks TRUNCATE cotizaciones, so drop it here to prove the
-- table's own BEFORE TRUNCATE trigger would still stop it.
DO $$
DECLARE v_fk text;
BEGIN
  SELECT conname INTO v_fk FROM pg_constraint
   WHERE conrelid = 'public.cotizacion_eventos'::regclass AND contype = 'f'
     AND confrelid = 'public.cotizaciones'::regclass;
  EXECUTE format('ALTER TABLE public.cotizacion_eventos DROP CONSTRAINT %I', v_fk);
END $$;
SELECT throws_ok($$ TRUNCATE public.cotizaciones $$,
  'P0001', 'COT:INMUTABLE', 'S4: cotizaciones rejects TRUNCATE by its own trigger, with no foreign key to help');

SELECT * FROM finish();
ROLLBACK;
