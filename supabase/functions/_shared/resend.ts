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

// A token is a run of characters that cannot separate an address from the text around it. Every token that contains
// an "@" is replaced whole: one linear pass (a token ends at the first separator, nothing is retried from inside it),
// and no prefix of an over-long local part is left behind.
const TOKEN_RE = /[^\s<>()[\]"',;:]+/g;
const SEPARATOR_RE = /[\s<>()[\]"',;:]/;
const RESEND_KEY_LIKE_RE = /\bre_[A-Za-z0-9_-]{6,}/g;
// Only the head of the body is redacted: the log line keeps 200 characters, and the cost stays a few milliseconds
// whatever the size of the body (the function has 2 s of CPU).
const PROVIDER_DETAIL_INPUT_MAX_LENGTH = 4096;
const PROVIDER_DETAIL_MAX_LENGTH = 200;

/** The first `max` characters, without the token the cut splits: its "@" may lie past the cut. */
function headAtTokenBoundary(text: string, max: number): string {
  if (text.length <= max || SEPARATOR_RE.test(text[max])) return text.slice(0, max);
  let end = max;
  while (end > 0 && !SEPARATOR_RE.test(text[end - 1])) end--;
  return text.slice(0, end);
}

/**
 * Resend's error text made safe for a log line (rule 5: no addresses, no keys): its error bodies can echo the
 * recipient ("…send testing emails to your own email address (x@y)"). One line, capped; linear in the first 4 KB.
 */
export function redactProviderDetail(text: string): string {
  return headAtTokenBoundary(text, PROVIDER_DETAIL_INPUT_MAX_LENGTH)
    .replace(TOKEN_RE, (token) => (token.includes("@") ? "[address]" : token))
    .replace(RESEND_KEY_LIKE_RE, "[key]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, PROVIDER_DETAIL_MAX_LENGTH);
}

// Resend's error names are snake_case words (validation_error, rate_limit_exceeded, daily_quota_exceeded…): only that
// shape is kept as a code, so a name, an address or free text can never pass for one.
const PROVIDER_CODE_RE = /^[a-z]+(?:_[a-z]+)+$/;
const PROVIDER_CODE_MAX_LENGTH = 64;

const providerCodeOf = (name: unknown): string | null =>
  typeof name === "string" && name.length <= PROVIDER_CODE_MAX_LENGTH && PROVIDER_CODE_RE.test(name) ? name : null;

/**
 * What a rejected Resend call throws. The message keeps its shape ("Resend <status> — <detail>", which
 * send-contact-email logs); the detail is now "name: message", redacted. The fields are the HTTP status and Resend's
 * error name, or null when it is not code-shaped: neither can carry personal data, so any caller may log them.
 */
export class ResendError extends Error {
  readonly httpStatus: number;
  readonly providerCode: string | null;

  constructor(message: string, httpStatus: number, providerCode: string | null) {
    super(message);
    this.name = "ResendError";
    this.httpStatus = httpStatus;
    this.providerCode = providerCode;
  }
}

/** "name: message" from Resend's structured error, or the raw body, always redacted; plus its code, when code-shaped. */
async function providerError(res: Response): Promise<{ detail: string; code: string | null }> {
  const raw = await res.text().catch(() => "");
  let detail = raw;
  let code: string | null = null;
  try {
    const body = JSON.parse(raw) as { name?: unknown; message?: unknown };
    code = providerCodeOf(body?.name);
    const parts = [body?.name, body?.message].filter((part): part is string => typeof part === "string" && part !== "");
    if (parts.length > 0) detail = parts.join(": ");
  } catch {
    // Not JSON: keep the raw text (redacted below).
  }
  return { detail: redactProviderDetail(detail) || "no detail", code };
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

  // Rule 5: no recipient, sender or subject in the logs (a contact subject carries the visitor's name).
  console.log("[resend] → sending");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const { detail, code } = await providerError(res);
    console.error(`[resend] ❌ HTTP ${res.status}: ${detail}`);
    throw new ResendError(`Resend ${res.status} — ${detail}`, res.status, code);
  }

  const data = await res.json().catch(() => null) as { id?: string } | null;
  console.log(`[resend] ✅ Sent. ID: ${data?.id ?? "unknown"}`);
}
