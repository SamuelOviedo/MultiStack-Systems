/**
 * send-auth-email — Supabase Auth "Send Email Hook" (HTTP).
 *
 * Supabase Auth calls this function for every auth e-mail; there is no user
 * JWT (verify_jwt = false). Authenticity comes from the Standard Webhooks
 * signature made with the hook secret (fix S3):
 *   · no / wrong / stale signature  → 401, nothing sent
 *   · secret not configured         → 500, nothing sent (fail closed)
 *   · signed but malformed payload  → 400, nothing sent
 * Error bodies follow the Auth hook format { error: { http_code, message } }
 * and never include internals. Templates and per-action behaviour are the
 * pre-existing ones (see ACTIONS).
 *
 * Pure module: index.ts wires Deno env + Resend; tests inject fakes.
 */
import {
  decodeWebhookSecret,
  verifyStandardWebhook,
  WebhookVerificationError,
} from "../_shared/standard-webhooks.ts";
import { isValidEmail } from "../_shared/html.ts";
import { confirmSignupHtml, emailChangeHtml, inviteHtml, passwordRecoveryHtml } from "./templates.ts";

export interface AuthEmail {
  to: string;
  subject: string;
  html: string;
}

export interface AuthEmailDeps {
  /** Hook secret as shown by Supabase ("v1,whsec_…"); "" when missing. */
  hookSecret: string;
  /** False when RESEND_API_KEY is missing. */
  emailConfigured: boolean;
  supabaseUrl: string;
  sendEmail(email: AuthEmail): Promise<void>;
  now?: () => number;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

/** Auth payloads are a few KB; refuse anything absurd before hashing it. */
const MAX_BODY_BYTES = 64 * 1024;

type Template = (email: string, confirmUrl: string) => string;

/** e-mail action → message. Unlisted actions are acknowledged without e-mail (unchanged behaviour). */
const ACTIONS: Record<string, { subject: string; template: Template }> = {
  signup:           { subject: "Confirma tu cuenta — MultiStack Systems",      template: confirmSignupHtml },
  email_change_new: { subject: "Confirma tu nuevo correo — MultiStack Systems", template: emailChangeHtml },
  recovery:         { subject: "Recuperar contraseña — MultiStack Systems",    template: passwordRecoveryHtml },
  invite:           { subject: "Te invitaron a MultiStack Systems",            template: inviteHtml },
};

function hookError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: status, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const ok = () =>
  new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } });

export function buildConfirmUrl(
  supabaseUrl: string,
  tokenHash: string,
  actionType: string,
  redirectTo: string,
): string {
  const url = new URL(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/verify`);
  url.searchParams.set("token", tokenHash);
  url.searchParams.set("type", actionType);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

function httpUrlOrEmpty(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : "";
  } catch {
    return "";
  }
}

interface ValidPayload {
  email: string;
  tokenHash: string;
  actionType: string;
  redirectTo: string;
}

/** Shape check of a (signed) hook payload; null when unusable. */
export function parseHookPayload(payload: unknown): ValidPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const { user, email_data: data } = payload as Record<string, unknown>;
  if (!user || typeof user !== "object" || !data || typeof data !== "object") return null;

  const email = (user as Record<string, unknown>).email;
  const d = data as Record<string, unknown>;
  if (!isValidEmail(email)) return null;
  if (typeof d.token_hash !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(d.token_hash)) return null;
  if (typeof d.email_action_type !== "string" || !/^[a-z_]{1,64}$/.test(d.email_action_type)) return null;

  return {
    email,
    tokenHash: d.token_hash,
    actionType: d.email_action_type,
    // Same precedence as before (redirect_to, then site_url); anything that
    // is not an http(s) URL is dropped and Auth falls back to its Site URL.
    redirectTo: httpUrlOrEmpty(d.redirect_to) || httpUrlOrEmpty(d.site_url),
  };
}

export function createAuthEmailHandler(deps: AuthEmailDeps) {
  const log = deps.log ?? (() => {});

  return async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") return hookError(405, "Method not allowed");

    // ── Fail closed without a usable secret ─────────────────────────────────
    try {
      if (!deps.hookSecret) throw new Error("missing");
      decodeWebhookSecret(deps.hookSecret);
    } catch {
      log("misconfigured", { missing: "SEND_EMAIL_HOOK_SECRET" });
      return hookError(500, "Email hook is not configured");
    }

    // ── Verify the signature over the RAW body, before parsing ──────────────
    const body = await req.text();
    if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
      return hookError(413, "Payload too large");
    }
    try {
      await verifyStandardWebhook(body, req.headers, deps.hookSecret, { now: deps.now });
    } catch (e) {
      if (e instanceof WebhookVerificationError) {
        log("rejected", { reason: e.message });
        return hookError(401, "Invalid webhook signature");
      }
      log("verify_error");
      return hookError(500, "Unable to verify webhook");
    }

    // ── Validate the signed payload ─────────────────────────────────────────
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      return hookError(400, "Invalid payload");
    }
    const parsed = parseHookPayload(payload);
    if (!parsed) {
      log("rejected", { reason: "invalid_payload" });
      return hookError(400, "Invalid payload");
    }

    const action = ACTIONS[parsed.actionType];
    if (!action) {
      log("skipped", { action: parsed.actionType });
      return ok();
    }

    if (!deps.emailConfigured) {
      log("misconfigured", { missing: "RESEND_API_KEY" });
      return hookError(500, "Email provider is not configured");
    }

    const confirmUrl = buildConfirmUrl(deps.supabaseUrl, parsed.tokenHash, parsed.actionType, parsed.redirectTo);
    try {
      await deps.sendEmail({
        to: parsed.email,
        subject: action.subject,
        html: action.template(parsed.email, confirmUrl),
      });
    } catch {
      log("send_failed", { action: parsed.actionType });
      return hookError(500, "Failed to send email");
    }

    log("sent", { action: parsed.actionType });
    return ok();
  };
}
