/**
 * send-welcome-email — the welcome e-mail goes out AT MOST ONCE per account.
 *
 * Security and idempotency model:
 *   · The caller must present a valid user session (Bearer JWT, resolved with
 *     auth.getUser): verify_jwt is off for this function (config.toml), so
 *     this check is the only gate. The anon / publishable key alone is 401.
 *   · The request carries nothing: recipient and name come from the caller's
 *     own auth user, so the function cannot be pointed at someone else.
 *   · Before sending, the flag profiles.welcome_email_sent is RESERVED with one
 *     atomic statement under the caller's JWT (RLS: own row only):
 *       UPDATE profiles SET welcome_email_sent = true
 *        WHERE id = <caller> AND welcome_email_sent = false RETURNING id
 *     Under READ COMMITTED a concurrent second UPDATE waits for the row lock,
 *     re-checks the WHERE and matches 0 rows, so parallel calls send one e-mail.
 *   · Fail closed: without Resend configured nothing is reserved (503); if the
 *     reservation errors nothing is sent (503); 0 rows means already sent (or
 *     no profile row) and nothing is sent (200, skipped).
 *   · At most once, not at least once: if Resend fails AFTER the reservation
 *     the flag stays true and the e-mail is NOT retried (the trigger
 *     guard_profile_privileged_columns forbids API roles to reset it). A lost
 *     welcome is preferred over a duplicate one.
 *   · Resend Idempotency-Key "welcome/<user uuid>" (never the address) also
 *     de-duplicates on the provider's side for 24 h.
 *   · Responses carry codes only, never provider or database detail; logs carry
 *     the event and the user id, never the address, the IP or the token.
 *
 * Pure module (no Deno globals, no remote imports): index.ts wires the real
 * Supabase client and Resend; tests inject fakes.
 */
import { isUuid, isValidEmail } from "../_shared/html.ts";
import { WELCOME_SUBJECT, welcomeHtml } from "./templates.ts";

/** The caller's own auth user, as resolved from the JWT. */
export interface WelcomeUser {
  id: string;
  email: string | null;
  /** user_metadata.full_name ?? user_metadata.name: user-controlled, cleaned by the template. */
  name: unknown;
}

/** Outcome of the atomic reservation of profiles.welcome_email_sent. */
export type Reservation = "reserved" | "already_sent";

/** Data access bound to the caller's JWT (RLS-scoped). */
export interface WelcomeCaller {
  user: WelcomeUser;
  /**
   * Flips welcome_email_sent false → true on the caller's own row in ONE
   * statement (UPDATE … WHERE id = uid AND welcome_email_sent = false
   * RETURNING id). "reserved" when this call flipped it, "already_sent" when
   * no row matched. Throws on any database or transport error.
   */
  reserve(): Promise<Reservation>;
}

export interface WelcomeEmail {
  to: string;
  subject: string;
  html: string;
  /** Resend Idempotency-Key: "welcome/<user uuid>". */
  idempotencyKey: string;
}

export interface WelcomeDeps {
  /** Resolves a user from a bearer token; null when the token is not a valid session. */
  authenticate(accessToken: string): Promise<WelcomeCaller | null>;
  sendEmail(email: WelcomeEmail): Promise<void>;
  /** False when RESEND_API_KEY is missing: fail closed WITHOUT spending the reservation. */
  emailConfigured: boolean;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const fail = (status: number, code: string) => json(status, { error: code });

/** Provider-side de-duplication key: the user's id, never the address. */
export const welcomeIdempotencyKey = (userId: string) => `welcome/${userId}`;

export function createWelcomeHandler(deps: WelcomeDeps) {
  const log = deps.log ?? (() => {});

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return fail(405, "method_not_allowed");

    // ── Authentication ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
    if (!token) return fail(401, "unauthorized");

    let caller: WelcomeCaller | null;
    try {
      caller = await deps.authenticate(token);
    } catch {
      caller = null;
    }
    if (!caller || !isUuid(caller.user?.id)) {
      log("rejected", { reason: "invalid_session" });
      return fail(401, "unauthorized");
    }
    const { user } = caller;

    // ── Fail closed before touching the flag ────────────────────────────────
    if (!deps.emailConfigured) {
      log("misconfigured", { missing: "RESEND_API_KEY" });
      return fail(503, "email_unavailable");
    }

    const recipient = user.email?.trim() ?? "";
    if (!isValidEmail(recipient)) {
      // Nothing to send to (e.g. a phone-only account): keep the flag untouched.
      log("rejected", { reason: "no_recipient", user: user.id });
      return fail(422, "no_recipient");
    }

    // ── Atomic reservation: at most one sender per account ──────────────────
    let reservation: Reservation;
    try {
      reservation = await caller.reserve();
    } catch {
      log("reserve_failed", { user: user.id });
      return fail(503, "unavailable");
    }
    if (reservation !== "reserved") {
      log("skipped", { user: user.id });
      return json(200, { ok: true, skipped: true });
    }

    // ── Send (only the caller that won the reservation gets here) ───────────
    try {
      await deps.sendEmail({
        to: recipient,
        subject: WELCOME_SUBJECT,
        html: welcomeHtml(recipient, user.name),
        idempotencyKey: welcomeIdempotencyKey(user.id),
      });
    } catch {
      // The flag stays reserved: no retry (at most once). See the header.
      log("send_failed", { user: user.id });
      return fail(502, "send_failed");
    }

    log("sent", { user: user.id });
    return json(200, { ok: true });
  };
}
