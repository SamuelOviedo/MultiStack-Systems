-- =============================================================================
-- LOCAL DEV SEED — runs on `supabase db reset`. Never executed against remote.
--
-- Three pre-confirmed test accounts (no confirmation email is ever sent —
-- email_confirmed_at is set directly):
--
--   admin@test.local  / test123456   → role 0 (Admin)
--   dev@test.local    / test123456   → role 1 (Collaborator)
--   client@test.local / test123456   → role 2 (Client)
-- =============================================================================

DO $$
DECLARE
  v_users CONSTANT jsonb := '[
    {"id": "a0000000-0000-4000-8000-000000000000", "email": "admin@test.local",  "type": 0},
    {"id": "b0000000-0000-4000-8000-000000000001", "email": "dev@test.local",    "type": 1},
    {"id": "c0000000-0000-4000-8000-000000000002", "email": "client@test.local", "type": 2}
  ]';
  v_user jsonb;
BEGIN
  FOR v_user IN SELECT * FROM jsonb_array_elements(v_users) LOOP
    -- Auth user, pre-confirmed (bcrypt of 'test123456')
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      (v_user->>'id')::uuid,
      'authenticated', 'authenticated',
      v_user->>'email',
      crypt('test123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(), now(), '', '', '', ''
    )
    ON CONFLICT (id) DO NOTHING;

    -- Identity row (required for email/password login)
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      (v_user->>'id')::uuid,
      v_user->>'id',
      jsonb_build_object(
        'sub',   v_user->>'id',
        'email', v_user->>'email',
        'email_verified', true
      ),
      'email',
      now(), now(), now()
    )
    ON CONFLICT (provider_id, provider) DO NOTHING;

    -- Profile: trigger creates it as type 2 — force the intended role,
    -- and skip the welcome email by pre-marking it sent
    INSERT INTO public.profiles (id, email, user_type, welcome_email_sent)
    VALUES ((v_user->>'id')::uuid, v_user->>'email', (v_user->>'type')::int, true)
    ON CONFLICT (id) DO UPDATE
      SET user_type = EXCLUDED.user_type,
          welcome_email_sent = true;
  END LOOP;
END $$;
