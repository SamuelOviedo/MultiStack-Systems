-- =============================================================================
-- Fix S10 — deleting an account must not delete the projects it created
--
-- Before: proyectos_clientes.user_id → auth.users ON DELETE CASCADE. user_id is
-- the creator (the admin, for every converted lead), so deleting that account
-- deleted all of its projects and, by cascade, their stages, services,
-- maintenance, portal tokens, tickets and messages.
--
-- After: user_id is nullable and ON DELETE SET NULL. Projects survive; admins
-- keep full access ("admin manages all projects"), lead developers and clients
-- keep theirs (lead_developer_id / client_id are already ON DELETE SET NULL).
-- An orphaned project (user_id NULL) is simply managed by admins.
-- =============================================================================

ALTER TABLE public.proyectos_clientes
  DROP CONSTRAINT proyectos_clientes_user_id_fkey,
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.proyectos_clientes
  ADD CONSTRAINT proyectos_clientes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.proyectos_clientes.user_id IS
  'Creator of the project (staff). NULL once that account is deleted.';
