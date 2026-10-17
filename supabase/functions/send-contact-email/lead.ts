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
  const checks: Array<[boolean, string]> = [
    [name.length >= L.nameMin && name.length <= L.nameMax, "name"],
    [!email || (email.length <= L.emailMax && EMAIL_RE.test(email)), "email"],
    [!phone || (phone.length <= L.phoneMax && PHONE_CHARS_RE.test(phone) && phoneDigits >= 7 && phoneDigits <= 15), "phone"],
    [Boolean(email || phone), "contact method"],
    [message.length >= L.messageMin && message.length <= L.messageMax, "message"],
  ];
  const failed = checks.filter(([ok]) => !ok).map(([, field]) => field);
  if (failed.length) return { kind: "invalid", reason: failed.join(", ") };

  return { kind: "ok", lead: { name, phone, email, message } };
}
