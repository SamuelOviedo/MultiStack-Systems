import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.5";
import { createNotificationHandler, type CallerContext, type OutgoingEmail } from "./handler.ts";
import { BRAND } from "../_shared/email/layout.ts";

// Request contract & security model: see handler.ts.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "onboarding@resend.dev";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.multistacksystems.com").replace(/\/+$/, "");

async function authenticate(accessToken: string): Promise<CallerContext | null> {
  // Every query below runs with the caller's JWT → RLS applies.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;

  return {
    userId: data.user.id,
    async getUserType() {
      const { data: type, error: rpcError } = await supabase.rpc("get_user_type");
      return rpcError || typeof type !== "number" ? null : type;
    },
    async getTicket(ticketId) {
      const { data: ticket } = await supabase
        .from("tickets")
        .select("id, title, client_email, project_id")
        .eq("id", ticketId)
        .maybeSingle();
      return ticket ?? null;
    },
    async getMessage(messageId, ticketId) {
      const { data: message } = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, sender_type, message, created_at")
        .eq("id", messageId)
        .eq("ticket_id", ticketId)
        .maybeSingle();
      return message ?? null;
    },
  };
}

async function sendEmail({ to, subject, html }: OutgoingEmail): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    // Replies go to the support mailbox (the mail. sending subdomain has no MX).
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, reply_to: BRAND.supportEmail }),
  });
  // Resend's error body can echo the recipient: keep only the status.
  if (!res.ok) throw new Error(`Resend HTTP ${res.status}`);
}

Deno.serve(createNotificationHandler({
  authenticate,
  sendEmail,
  siteUrl: SITE_URL,
  emailConfigured: Boolean(RESEND_API_KEY),
  log: (event, detail) => console.log(`[send-notification] ${event}`, detail ? JSON.stringify(detail) : ""),
}));
