/**
 * send-notification — e-mails a client when the team replies to a ticket.
 *
 * Security model (fix S2):
 *   · The caller must present a valid user session (Bearer JWT). The anon /
 *     publishable key alone is rejected: authentication resolves a real user.
 *   · Only staff (user_type 0 admin, 1 collaborator) may notify.
 *   · The request carries IDs only ({ type, ticket_id, message_id }). Ticket,
 *     recipient and message text are read from the database with the CALLER's
 *     JWT, so RLS decides access: a collaborator can only notify about tickets
 *     assigned to them; anything else looks like "not found".
 *   · The message must be a team message of that ticket, created recently
 *     (no replaying old messages to spam a client).
 *   · Every dynamic value is HTML-escaped; errors never echo internals.
 *
 * Pure module (no Deno globals, no remote imports): index.ts wires the real
 * Supabase client and Resend; tests inject fakes.
 */
import { escapeHtml, isUuid, isValidEmail, toSubjectText } from "../_shared/html.ts";

export interface NotificationTicket {
  id: string;
  title: string;
  client_email: string | null;
  project_id: string | null;
}

export interface NotificationMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  message: string;
  created_at: string;
}

/** Data access bound to the caller's JWT (RLS-scoped). */
export interface CallerContext {
  userId: string;
  getUserType(): Promise<number | null>;
  getTicket(ticketId: string): Promise<NotificationTicket | null>;
  getMessage(messageId: string, ticketId: string): Promise<NotificationMessage | null>;
}

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
}

export interface NotificationDeps {
  /** Resolves a user from a bearer token; null when the token is not a valid session. */
  authenticate(accessToken: string): Promise<CallerContext | null>;
  sendEmail(email: OutgoingEmail): Promise<void>;
  /** Public origin of the app, no trailing slash (e.g. https://www.multistacksystems.com). */
  siteUrl: string;
  /** False when RESEND_API_KEY is missing: fail closed without touching Resend. */
  emailConfigured: boolean;
  now?: () => number;
  log?: (event: string, detail?: Record<string, unknown>) => void;
}

const STAFF_TYPES = new Set([0, 1]);
/** A reply must be notified right after it is written. */
export const MESSAGE_MAX_AGE_MS = 15 * 60 * 1000;
const MESSAGE_MAX_CHARS = 10_000;

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

export function teamReplyHtml(params: {
  ticketTitle: string;
  message: string;
  link: string | null;
}): string {
  const linkBlock = params.link
    ? `<p><a href="${escapeHtml(params.link)}" style="color:#00ff88;">Ver tus solicitudes →</a></p>`
    : `<p style="color:#64748b;font-size:13px;">Puedes responder a este correo o usar el enlace de seguimiento que te compartió el equipo.</p>`;
  return `
          <h2>El equipo de MultiStack ha respondido tu ticket</h2>
          <p><strong>Ticket:</strong> ${escapeHtml(params.ticketTitle)}</p>
          <blockquote style="border-left:3px solid #00ff88;padding-left:12px;margin:12px 0;white-space:pre-wrap;">${escapeHtml(params.message)}</blockquote>
          ${linkBlock}
        `;
}

export function createNotificationHandler(deps: NotificationDeps) {
  const log = deps.log ?? (() => {});
  const now = deps.now ?? (() => Date.now());

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return fail(405, "method_not_allowed");

    // ── Authentication ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = /^Bearer\s+(\S+)$/i.exec(authHeader)?.[1];
    if (!token) return fail(401, "unauthorized");

    let caller: CallerContext | null;
    try {
      caller = await deps.authenticate(token);
    } catch {
      caller = null;
    }
    if (!caller) {
      log("rejected", { reason: "invalid_session" });
      return fail(401, "unauthorized");
    }

    // ── Authorization: staff only ───────────────────────────────────────────
    const userType = await caller.getUserType().catch(() => null);
    if (userType === null || !STAFF_TYPES.has(userType)) {
      log("rejected", { reason: "not_staff", user: caller.userId });
      return fail(403, "forbidden");
    }

    // ── Input: identifiers only ─────────────────────────────────────────────
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return fail(400, "invalid_json");
    }
    const { type, ticket_id: ticketId, message_id: messageId } = (body ?? {}) as Record<string, unknown>;
    if (type !== "team_reply") return fail(400, "unsupported_type");
    if (!isUuid(ticketId) || !isUuid(messageId)) return fail(400, "invalid_ids");

    // ── Load from DB under the caller's RLS ─────────────────────────────────
    const ticket = await caller.getTicket(ticketId).catch(() => null);
    if (!ticket) {
      log("rejected", { reason: "ticket_not_accessible", user: caller.userId });
      return fail(404, "not_found");
    }
    const message = await caller.getMessage(messageId, ticketId).catch(() => null);
    if (!message || message.ticket_id !== ticket.id) return fail(404, "not_found");
    if (message.sender_type !== "team") return fail(403, "forbidden");

    const createdAt = Date.parse(message.created_at);
    if (!Number.isFinite(createdAt) || now() - createdAt > MESSAGE_MAX_AGE_MS) {
      return fail(409, "message_too_old");
    }

    const recipient = ticket.client_email?.trim().toLowerCase() ?? "";
    if (!isValidEmail(recipient)) return fail(422, "no_recipient");

    if (!deps.emailConfigured) {
      log("misconfigured", { missing: "RESEND_API_KEY" });
      return fail(503, "email_unavailable");
    }

    // Requests without a project are solicitudes / contact leads: the client
    // follows them in /solicitudes (login required, RLS-scoped). Project
    // tickets belong to the token portal; the token is never e-mailed here
    // because client_email on portal tickets is free text typed by the visitor.
    const link = ticket.project_id ? null : `${deps.siteUrl}/solicitudes`;

    try {
      await deps.sendEmail({
        to: recipient,
        subject: `[MultiStack] Respuesta a tu ticket: ${toSubjectText(ticket.title)}`,
        html: teamReplyHtml({
          ticketTitle: ticket.title,
          message: message.message.slice(0, MESSAGE_MAX_CHARS),
          link,
        }),
      });
    } catch {
      log("send_failed", { ticket: ticket.id });
      return fail(502, "send_failed");
    }

    log("sent", { ticket: ticket.id, message: message.id, user: caller.userId });
    return json(200, { ok: true });
  };
}
