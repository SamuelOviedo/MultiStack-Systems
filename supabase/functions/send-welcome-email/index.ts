// Pinned on purpose, like send-notification and send-contact-email: an unpinned "@2" is resolved when the function is
// DEPLOYED, and the reservation below reads the shape of supabase-js's update().select() answer.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.5";
import { sendEmail } from "../_shared/resend.ts";
import { createWelcomeHandler, type WelcomeCaller, type WelcomeEmail } from "./handler.ts";

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
    async reserve() {
      // UPDATE … SET welcome_email_sent = true WHERE id = <caller> AND welcome_email_sent = false RETURNING id
      const { data: rows, error: updateError } = await supabase
        .from("profiles")
        .update({ welcome_email_sent: true })
        .eq("id", user.id)
        .eq("welcome_email_sent", false)
        .select("id");
      // The database / PostgREST detail is never surfaced: the handler only sees "it failed".
      if (updateError || !Array.isArray(rows)) throw new Error("welcome reservation failed");
      return rows.length > 0 ? "reserved" : "already_sent";
    },
  };
}

Deno.serve(createWelcomeHandler({
  authenticate,
  sendEmail: ({ to, subject, html, idempotencyKey }: WelcomeEmail) => sendEmail({ to, subject, html, idempotencyKey }),
  emailConfigured: Boolean(RESEND_API_KEY),
  log: (event, detail) => console.log(`[send-welcome-email] ${event}`, detail ? JSON.stringify(detail) : ""),
}));
