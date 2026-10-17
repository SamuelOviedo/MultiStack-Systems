/**
 * Request handling for the public contact form (fix S4). Every dependency is
 * injected — data store, e-mail sending, secrets, logging — so the rules below
 * are covered by Vitest; index.ts wires Deno, supabase-js and Resend.
 *
 * Request contract: POST { name, phone?, email?, message, website? } (see
 * src/lib/contact.ts). `website` is the honeypot.
 */
import { contactHtml, contactSubject, type Lead } from "./templates.ts";
import { replyToFor } from "./reply-to.ts";
import { checkLead, clientIp, decideThrottle, type ThrottleDecision } from "./lead.ts";

export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  subject: string;
  html: string;
}

/** Data access of the form (supabase-js in index.ts, in memory in the tests). */
export interface ContactStore {
  /**
   * Records an attempt in `bucket` and THEN counts the bucket's last hour: each
   * request's insert commits before its count, so a burst of parallel requests
   * cannot all see a count under the limit. Throws on failure.
   */
  recordAndCount(bucket: string): Promise<number>;
  /** Records an attempt without counting it (honeypot hits). */
  record(bucket: string): Promise<void>;
  /** Opportunistic purge of events older than a day; never throws. */
  purge(): Promise<void>;
  /** Anonymous leads of the last `minutes`. Throws on failure. */
  countLeads(minutes: number): Promise<number>;
  /** Stores the lead as a ticket: returns the error message, or null on success. May throw. */
  insertLead(lead: Lead): Promise<string | null>;
}

export interface ContactDeps {
  /** Opens the data store; null when the dedicated server key is not configured (the form then answers 503). Called once per request. */
  openStore(): ContactStore | null;
  /** Logical name of the server key configuration — safe to log (never log a key). */
  secretSource: string;
  /** HMAC key of the IP / e-mail buckets (CONTACT_RATE_SALT). */
  rateSalt: string;
  /** Whether RESEND_API_KEY is configured. */
  resendConfigured: boolean;
  fromAddress: string;
  dest: string;
  sendEmail(email: OutgoingEmail): Promise<void>;
  log?: (level: "info" | "warn" | "error", message: string) => void;
}

export const RATE_SALT_MIN_LENGTH = 32;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Answer to every POST while an indispensable credential is missing. Deliberately says nothing about WHICH one
 * (the reason goes to the log only).
 */
/**
 * Answer to an unexpected failure (e-mail provider, database client, ...). The visitor never sees the internal message:
 * it can name secrets, the provider's account or a recipient. The detail goes to the log only (see describeError).
 */
const internalError = () => json(500, { error: "No se pudo enviar el mensaje. Intenta de nuevo más tarde." });

/** One-line, bounded rendering of an error for the log (diagnosis without log injection or unbounded output). */
function describeError(e: unknown): string {
  const m = e instanceof Error ? e.message : "unknown error";
  return m.replace(/[\r\n\t]+/g, " ").slice(0, 300);
}

const unavailable = () => json(503, { error: "Servicio no disponible temporalmente. Intenta de nuevo más tarde." });

/** Keyed hash ("ip:…" / "em:…"): raw IPs and e-mails are never stored. */
async function keyedBucket(prefix: "ip" | "em", value: string, key: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(value)));
  return `${prefix}:` + Array.from(mac.slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function createContactHandler(deps: ContactDeps) {
  const log = deps.log ?? (() => {});
  const saltOk = deps.rateSalt.length >= RATE_SALT_MIN_LENGTH;

  /**
   * Records this attempt (per IP and per e-mail, kept 24 h) and counts recent
   * activity. Fails open: a DB hiccup must never lose a real lead; the CHECK
   * limits in the database still apply.
   */
  async function throttle(store: ContactStore, ipBucket: string | null, email: string): Promise<ThrottleDecision> {
    try {
      const perIp = ipBucket ? await store.recordAndCount(ipBucket) : null;
      const perEmail = email ? await store.recordAndCount(await keyedBucket("em", email, deps.rateSalt)) : null;
      await store.purge();

      const [g10, g60] = await Promise.all([store.countLeads(10), store.countLeads(60)]);
      return decideThrottle({ perIp, perEmail, global10Min: g10, global1Hour: g60 });
    } catch (e) {
      log("error", `[contact] ⚠ throttle check failed (allowing): ${describeError(e)}`);
      return "allow";
    }
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Método no permitido" });

    // FAIL CLOSED: without CONTACT_RATE_SALT the per-IP and per-e-mail limits cannot work. Refusing is safer than silently
    // running without them; the secret is set BEFORE the function is deployed, so this only fires if it is later removed
    // or shortened. Transient failures (a database hiccup) still fail open below: a real lead must not be lost.
    if (!saltOk) {
      log("error", `[contact] ❌ CONTACT_RATE_SALT missing or shorter than ${RATE_SALT_MIN_LENGTH} characters — refusing requests (fail closed)`);
      return unavailable();
    }

    // FAIL CLOSED: without the Resend key the team can never be notified. Storing the lead and then failing would leave
    // a ticket nobody was told about and invite retries (duplicates).
    if (!deps.resendConfigured) {
      log("error", "[contact] ❌ RESEND_API_KEY missing — refusing requests (fail closed)");
      return unavailable();
    }

    // Startup diagnostics logged to Supabase function logs
    log("info", `[contact] FROM_ADDRESS: ${deps.fromAddress}`);
    log("info", `[contact] DEST: ${deps.dest}`);

    try {
      // The edge_functions secret key is the only way to store a lead (direct anonymous inserts are closed, S4) and to
      // count attempts. No fallback to another key. FAIL CLOSED: without it no limit can be enforced and no lead
      // can be stored, so the form refuses (503) instead of e-mailing everything unchecked (the former contingency
      // "e-mail only, NOT stored" is gone on purpose).
      const store = deps.openStore();
      if (!store) {
        log("error", `[contact] ❌ secret key missing: ${deps.secretSource} — refusing requests (fail closed)`);
        return unavailable();
      }
      log("info", `[contact] secret key source: ${deps.secretSource}`);

      const ip = clientIp(req.headers);
      const bucket = ip ? await keyedBucket("ip", ip, deps.rateSalt) : null;
      if (!ip) log("warn", "[contact] client IP unavailable — per-IP limit skipped");

      const check = checkLead(await req.json().catch(() => ({})));

      if (check.kind === "honeypot") {
        // Bots get the normal answer; the attempt counts against the IP, nothing is stored or sent.
        if (bucket) await store.record(bucket);
        log("warn", "[contact] Honeypot filled — ignored");
        return json(200, { ok: true });
      }
      if (check.kind === "invalid") {
        log("warn", `[contact] Rejected — invalid: ${check.reason}`);
        return json(400, {
          error: "Se requiere nombre, un teléfono o email válido y un mensaje de entre 5 y 5000 caracteres",
        });
      }
      const lead = check.lead;

      const decision: ThrottleDecision = await throttle(store, bucket, lead.email);
      if (decision === "reject") {
        log("warn", "[contact] Throttled (rejected)");
        return json(429, { error: "Recibimos demasiados mensajes. Intenta de nuevo más tarde." });
      }

      // Persist the lead as a 'received' ticket. Non-fatal: a transient DB error must never lose the email
      // notification; it is logged and the e-mail says it was not stored.
      let stored = false;
      try {
        const dbError = await store.insertLead(lead);
        if (dbError) log("error", `[contact] ⚠ ticket insert failed: ${dbError.replace(/[\r\n\t]+/g, " ").slice(0, 300)}`);
        else {
          stored = true;
          log("info", "[contact] ✅ ticket row created");
        }
      } catch (e) {
        log("error", `[contact] ⚠ ticket insert threw: ${describeError(e)}`);
      }

      // Under a flood (soft global limit) the lead is kept but the team e-mail is
      // skipped — unless storing failed, in which case the e-mail is its only copy.
      if (decision === "store-only" && stored) {
        log("warn", "[contact] Soft global limit — stored without team e-mail");
        return json(200, { ok: true });
      }

      await deps.sendEmail({
        from: deps.fromAddress,
        // The visitor's plain address, or the support mailbox (see reply-to.ts).
        replyTo: replyToFor(lead.email),
        to: deps.dest,
        subject: contactSubject(lead.name),
        html: contactHtml(lead, stored),
      });

      return json(200, { ok: true });
    } catch (e: unknown) {
      log("error", `[contact] ❌ ${describeError(e)}`);
      return internalError();
    }
  };
}
