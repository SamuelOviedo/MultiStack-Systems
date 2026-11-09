/**
 * Validation and abuse limits for the public contact form (fix S4).
 * Pure module — no Deno / network APIs — so Vitest covers it.
 * Keep the field limits in sync with src/lib/contact.ts (CONTACT_LIMITS).
 */
import type { Lead } from "./templates.ts";

export const LEAD_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  emailMax: 254,
  phoneMax: 40,
  messageMin: 5,
  messageMax: 5000,
} as const;

/**
 * Abuse limits. Per-sender limits reject (429); the global "soft" limit never
 * rejects — it stores the lead but skips the team e-mail, so a flood cannot
 * lock real customers out of the form. Only the high "hard" cap rejects, to
 * protect the database.
 */
export const THROTTLE = {
  /**
   * same client IP (keyed hash), per rolling hour. 15 lets a shared office or
   * public network send several leads per hour; abuse from one address is
   * still capped, and the per-e-mail and global limits apply independently.
   */
  perIpPerHour: 15,
  /** same e-mail address, per rolling hour */
  perEmailPerHour: 3,
  /** all anonymous leads, per rolling 10 minutes: above this, store without e-mail */
  globalSoftPer10Min: 30,
  /** all anonymous leads, per rolling hour: above this, reject */
  globalHardPerHour: 300,
} as const;

/**
 * Limits each function instance applies ALONE, from its own memory, to the dimension whose shared counter could not be
 * read (see limiter.ts). Instances do not share memory, so a visitor spread over several of them gets several times
 * these numbers: the per-sender ones are stricter than THROTTLE so that the total stays small, and still generous for a
 * real visitor (a person rarely sends more than one or two messages). The global ones mirror the healthy rules (store
 * without the team e-mail above the soft limit, reject above the hard one) at a per-instance scale.
 */
export const DEGRADED_THROTTLE = {
  /** same client IP, per rolling hour, per instance */
  perIpPerHour: 5,
  /** same e-mail address, per rolling hour, per instance */
  perEmailPerHour: 2,
  /** all leads, per rolling 10 minutes, per instance: above this, store without the team e-mail */
  globalSoftPer10Min: 30,
  /** all leads, per rolling 10 minutes, per instance: above this, reject */
  globalHardPer10Min: 100,
} as const;

/** Per-instance counts, INCLUDING the current attempt (null when the IP / e-mail is unknown). */
export interface LocalCounts {
  perIp: number | null;
  perEmail: number | null;
  global10Min: number;
}

export interface ThrottleCounts {
  /** attempts from this IP in the last hour (null when the IP is unknown) */
  perIp: number | null;
  /**
   * attempts with this e-mail in the last hour, INCLUDING the current one —
   * recorded before counting, like perIp, so parallel requests cannot all see
   * a count under the limit (null when no e-mail)
   */
  perEmail: number | null;
  global10Min: number;
  global1Hour: number;
}

export type ThrottleDecision = "allow" | "store-only" | "reject";

export function decideThrottle(c: ThrottleCounts): ThrottleDecision {
  const T = THROTTLE;
  if (c.perIp !== null && c.perIp > T.perIpPerHour) return "reject";
  if (c.perEmail !== null && c.perEmail > T.perEmailPerHour) return "reject";
  if (c.global1Hour >= T.globalHardPerHour) return "reject";
  if (c.global10Min >= T.globalSoftPer10Min) return "store-only";
  return "allow";
}

/** First client IP from the proxy headers, or null. */
/**
 * Client IP for the per-IP limit — ONLY from cf-connecting-ip, the one header
 * the infrastructure controls. Measured on Supabase Edge Functions
 * (2026-10-15, lab): Cloudflare rejects requests that carry their own
 * CF-Connecting-IP (error 1000); a forged X-Forwarded-For is replaced, and the
 * resulting chain ends with an infrastructure address (its last entry is NOT
 * the client); forged True-Client-IP / Forwarded pass through untouched.
 * Without cf-connecting-ip the IP is unknown and the per-IP limit is skipped —
 * the e-mail and global limits still apply. No fallback to other headers.
 */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  const ip = headers.get("cf-connecting-ip")?.trim() ?? "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

/** Name of the hidden field; real visitors never fill it in. */
export const HONEYPOT_FIELD = "website";

export type LeadCheck =
  | { kind: "ok"; lead: Lead }
  | { kind: "honeypot" }
  | { kind: "invalid"; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;

/**
 * True when the text holds a character that no real visitor types and that a database column cannot always store: C0 controls
 * other than tab, line feed and carriage return (so U+0000, which PostgreSQL cannot convert to text), DEL, and unpaired UTF-16
 * surrogates (not valid Unicode text). A lead like that made the ticket insert fail while the e-mail still went out, and the
 * global counters (which count stored tickets) never saw it. Walks the string once; no regular expression.
 */
export function hasUnsafeText(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c <= 0x08 || c === 0x0b || c === 0x0c || (c >= 0x0e && c <= 0x1f) || c === 0x7f) return true;
    if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i++; // a well-formed pair
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function checkLead(body: unknown): LeadCheck {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

  if (str(b[HONEYPOT_FIELD])) return { kind: "honeypot" };

  const message = str(b.message);
  const email = str(b.email).toLowerCase();
  const phone = str(b.phone);
  // Single line: the name ends up in the email subject header.
  // Legacy clients send { email, message } only: name falls back to email.
  const name = str(b.name).replace(/\s+/g, " ") || email;

  const L = LEAD_LIMITS;
  const phoneDigits = phone.replace(/\D/g, "").length;
  // Checked on the raw values: trim() would hide a leading or trailing control character. Every field that reaches the
  // store or the team e-mail is covered; the answer is the same generic 400 as any other invalid field.
  const clean = (v: unknown) => typeof v !== "string" || !hasUnsafeText(v);
  const checks: Array<[boolean, string]> = [
    [name.length >= L.nameMin && name.length <= L.nameMax && clean(b.name), "name"],
    [clean(b.email) && (!email || (email.length <= L.emailMax && EMAIL_RE.test(email))), "email"],
    [clean(b.phone) && (!phone || (phone.length <= L.phoneMax && PHONE_CHARS_RE.test(phone) && phoneDigits >= 7 && phoneDigits <= 15)), "phone"],
    [Boolean(email || phone), "contact method"],
    [message.length >= L.messageMin && message.length <= L.messageMax && clean(b.message), "message"],
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, field]) => field);
  if (failed.length) return { kind: "invalid", reason: failed.join(", ") };

  return { kind: "ok", lead: { name, phone, email, message } };
}
