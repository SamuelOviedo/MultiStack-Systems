/**
 * Single source of truth for the From address of every Resend e-mail.
 *
 * The address comes from the FROM_EMAIL Edge Function secret — the same secret
 * send-auth-email and send-notification already read — so moving all four
 * functions to another sender (e.g. from mail.multistacksystems.com to the root
 * domain) is one `secrets set`, not a redeploy. Only addresses on our own
 * sending domains are accepted; anything else falls back to DEFAULT_SENDER so a
 * mistyped secret can never make us send as a foreign domain. Pure module: runs
 * on Deno and under Vitest.
 */
export const SENDER_NAME = "MultiStack Systems";

/** Used while FROM_EMAIL is unset or invalid: today's verified Resend domain. */
export const DEFAULT_SENDER = `${SENDER_NAME} <soporte@mail.multistacksystems.com>`;

/** Mailbox with MX records (SpaceMail); the mail. sending subdomain has none. */
export const SUPPORT_REPLY_TO = "soporte@multistacksystems.com";

/** Domains verified (or being verified) in Resend for sending. */
export const SENDING_DOMAINS: readonly string[] = ["multistacksystems.com", "mail.multistacksystems.com"];

// "Display Name <local@domain>" or a bare "local@domain"; single line only.
const NAMED_RE = /^([^<>"\r\n]{1,64}?)\s*<([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]{1,253})>$/;
const BARE_RE = /^([A-Za-z0-9._%+-]{1,64})@([A-Za-z0-9.-]{1,253})$/;

export interface ResolvedSender {
  from: string;
  /** "FROM_EMAIL", or "default" when the secret is unset or rejected. */
  source: "FROM_EMAIL" | "default";
  /** Why FROM_EMAIL was rejected (never contains the raw value). */
  rejected?: "malformed" | "foreign-domain";
}

export function resolveSender(value: string | undefined | null): ResolvedSender {
  const raw = (value ?? "").trim();
  if (!raw) return { from: DEFAULT_SENDER, source: "default" };

  const named = raw.match(NAMED_RE);
  const bare = named ? null : raw.match(BARE_RE);
  if (!named && !bare) return { from: DEFAULT_SENDER, source: "default", rejected: "malformed" };

  const domain = (named ? named[3] : bare![2]).toLowerCase();
  if (!SENDING_DOMAINS.includes(domain)) {
    return { from: DEFAULT_SENDER, source: "default", rejected: "foreign-domain" };
  }
  return { from: raw, source: "FROM_EMAIL" };
}
