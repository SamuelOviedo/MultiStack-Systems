// Pinned on purpose, like send-notification and send-contact-email: an unpinned "@2" is resolved when the function is
// DEPLOYED, and reserveWelcome (handler.ts) reads the shape of supabase-js's update().select() answer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.5";
import { sendEmail } from "../_shared/resend.ts";
import { createWelcomeHandler, reserveWelcome, type WelcomeCaller, type WelcomeEmail } from "./handler.ts";

// Request contract, idempotency and security model: see handler.ts. This file only wires the runtime.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

async function authenticate(accessToken: string): Promise<WelcomeCaller | null> {
  // Every query below runs with the caller's JWT → RLS applies (own profile row only). No service_role here.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const user = data.user;

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name,
    },
    // The statement and its outcomes live in handler.ts (reserveWelcome), where they are tested.
    reserve: () => reserveWelcome(supabase, user.id),
  };
}

Deno.serve(createWelcomeHandler({
  authenticate,
  sendEmail: ({ to, subject, html, idempotencyKey }: WelcomeEmail) => sendEmail({ to, subject, html, idempotencyKey }),
  emailConfigured: Boolean(RESEND_API_KEY),
  log: (event, detail) => console.log(`[send-welcome-email] ${event}`, detail ? JSON.stringify(detail) : ""),
}));
