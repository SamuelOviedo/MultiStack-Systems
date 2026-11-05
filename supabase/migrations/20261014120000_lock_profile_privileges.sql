-- =============================================================================
-- Security fix S1 — privilege escalation through profiles.user_type
--
-- Before: policy "update own profile" (USING auth.uid() = id, no column limits)
-- plus Supabase's default table grants let any signed-in user run
--   PATCH /rest/v1/profiles?id=eq.<own id>  {"user_type": 0}
-- and become an admin. "insert own profile" had the same hole for a missing row.
--
-- After — three independent layers, each sufficient on its own:
--   1. Privileges: API roles (anon, authenticated) keep SELECT only, plus
--      UPDATE on the single column the app writes (welcome_email_sent, used by
--      the send-welcome-email Edge Function with the caller's JWT).
--   2. RLS: no INSERT policy (profiles are created only by the
--      handle_new_user trigger); UPDATE limited to the own row in USING and
--      WITH CHECK.
--   3. Trigger guard: even if a future migration re-grants UPDATE, API roles
--      cannot change id / email / user_type, cannot insert profiles, and can
--      only flip welcome_email_sent from false to true (no re-send loops).
--
-- Unaffected: role changes by the team through the Supabase Dashboard / SQL
-- editor (postgres) or the service_role, the handle_new_user trigger
-- (SECURITY DEFINER), get_user_type() and every existing SELECT policy.
-- =============================================================================

-- ── 1. Privileges ────────────────────────────────────────────────────────────
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.profiles FROM PUBLIC, anon, authenticated;

-- anon never reads profiles (every SELECT policy needs auth.uid()).
REVOKE SELECT ON public.profiles FROM PUBLIC, anon;

GRANT UPDATE (welcome_email_sent) ON public.profiles TO authenticated;

-- ── 2. RLS policies ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "update own profile" ON public.profiles;

CREATE POLICY "update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ── 3. Trigger guard (defense in depth) ──────────────────────────────────────
-- SECURITY INVOKER on purpose: current_user is the API role for PostgREST
-- requests, and the definer (postgres) inside handle_new_user and other
-- SECURITY DEFINER functions, which therefore pass untouched.
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'profiles are created by the system only'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.id        IS DISTINCT FROM OLD.id
  OR NEW.email     IS DISTINCT FROM OLD.email
  OR NEW.user_type IS DISTINCT FROM OLD.user_type THEN
    RAISE EXCEPTION 'protected profile column'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.welcome_email_sent AND NOT NEW.welcome_email_sent THEN
    RAISE EXCEPTION 'welcome_email_sent cannot be reset'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();
