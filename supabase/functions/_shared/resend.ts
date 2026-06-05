const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";

export const FROM = "MultiStack Systems <soporte@multistacksystems.com>";
export const REPLY_TO = "soporte@multistacksystems.com";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from ?? FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      reply_to: opts.replyTo ?? REPLY_TO,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }
}
