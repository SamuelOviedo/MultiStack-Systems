import { resolveSender, SUPPORT_REPLY_TO } from "./sender.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

// Corporate sender from the FROM_EMAIL secret (shared with send-auth-email and
// send-notification); falls back to the mail. subdomain (see sender.ts).
const SENDER = resolveSender(Deno.env.get("FROM_EMAIL"));
if (SENDER.rejected) console.error(`[resend] ⚠ FROM_EMAIL ${SENDER.rejected} — using the default sender`);

export const FROM_VERIFIED = SENDER.from;
export const FROM_DEV      = "onboarding@resend.dev";
// Replies must reach a mailbox with MX records: the mail. sending subdomain has none.
export const REPLY_TO      = SUPPORT_REPLY_TO;

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error("[resend] ❌ RESEND_API_KEY is not set — check Supabase Edge Function secrets");
    throw new Error("RESEND_API_KEY not set");
  }

  const payload = {
    from:     opts.from    ?? FROM_VERIFIED,
    to:       opts.to,
    subject:  opts.subject,
    html:     opts.html,
    reply_to: opts.replyTo ?? REPLY_TO,
  };

  console.log(
    `[resend] → to: ${payload.to} | from: ${payload.from} | subject: "${payload.subject}"`
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Parse JSON body — Resend always returns structured errors
    let detail: string;
    try {
      const errJson = await res.json() as { message?: string; name?: string };
      detail = errJson.message ?? errJson.name ?? JSON.stringify(errJson);
    } catch {
      detail = await res.text();
    }
    console.error(`[resend] ❌ HTTP ${res.status}: ${detail}`);
    throw new Error(`Resend ${res.status} — ${detail}`);
  }

  const data = await res.json() as { id?: string };
  console.log(`[resend] ✅ Sent. ID: ${data?.id ?? "unknown"}`);
}
