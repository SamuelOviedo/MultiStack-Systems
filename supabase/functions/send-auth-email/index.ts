import { createAuthEmailHandler, type AuthEmail } from "./handler.ts";

// Supabase Auth Send Email Hook. Security model & behaviour: see handler.ts.
// Required secret: SEND_EMAIL_HOOK_SECRET (Dashboard → Authentication → Hooks).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://ckyqrdemgssbrqfnkxsr.supabase.co";

async function sendEmail({ to, subject, html }: AuthEmail): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  // Resend's error body can echo the recipient: keep only the status.
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
}

Deno.serve(createAuthEmailHandler({
  hookSecret: Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "",
  emailConfigured: Boolean(RESEND_API_KEY),
  supabaseUrl: SUPABASE_URL,
  sendEmail,
  log: (event, detail) => console.log(`[send-auth-email] ${event}`, detail ? JSON.stringify(detail) : ""),
}));
