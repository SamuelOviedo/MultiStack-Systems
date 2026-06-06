const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

export const FROM_VERIFIED = "MultiStack Systems <soporte@multistacksystems.com>";
export const FROM_DEV      = "onboarding@resend.dev";
export const REPLY_TO      = "soporte@multistacksystems.com";

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
