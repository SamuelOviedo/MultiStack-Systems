// Originally generated (Lovable). Hand-edited: the hardcoded fallback project
// was removed and the configuration is validated before creating the client.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { resolveSupabaseEnv } from './env';
import { captureAuthRedirect } from '@/lib/authRedirect';

// Fail fast: an empty, undefined or placeholder URL/key throws a descriptive
// SupabaseConfigError here instead of creating a client that sends auth
// (e.g. Google OAuth) to a non-existent host such as your_project_ref.supabase.co.
const { url: SUPABASE_URL, publishableKey: SUPABASE_PUBLISHABLE_KEY } = resolveSupabaseEnv(import.meta.env);

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

// Must run before createClient(): supabase-js strips the URL hash while it
// initializes, and the recovery / link-error markers live in that hash.
if (typeof window !== 'undefined') captureAuthRedirect();

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
