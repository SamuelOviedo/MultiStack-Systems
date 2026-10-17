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
import { classifyStoreError, decideDegraded, LocalLimiter, STORE_TIMEOUT_MS, withTimeout } from "./limiter.ts";

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
  /** Records an attempt without counting it (honeypot hits). Throws on failure. */
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
  /** Per-instance fallback counters (limiter.ts). Tests inject their own; production keeps one for the instance's life. */
  localLimiter?: LocalLimiter;
  /** Longest a database call of the limit check may take (default STORE_TIMEOUT_MS). Tests shorten it. */
  storeTimeoutMs?: number;
}

/**
 * What the limit check decided. `limitsUnchecked` is set when the shared counters could not be fully read and the lead
 * went through under the per-instance limits only: the team e-mail says so.
 */
type ThrottleOutcome =
  | { decision: "reject" }
  | { decision: "unavailable" }
  | { decision: Exclude<ThrottleDecision, "reject">; limitsUnchecked: boolean };

type Measure<T> = { ok: true; value: T } | { ok: false; error: unknown };

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
  const local = deps.localLimiter ?? new LocalLimiter();
  const timeoutMs = deps.storeTimeoutMs ?? STORE_TIMEOUT_MS;

  /** One database call of the limit check: never throws, never takes longer than the timeout. */
  async function measure<T>(call: () => Promise<T>): Promise<Measure<T>> {
    try {
      return { ok: true, value: await withTimeout(Promise.resolve().then(call), timeoutMs) };
    } catch (error) {
      return { ok: false, error };
    }
  }

  /**
   * Records this attempt (per IP and per e-mail, kept 24 h) and counts recent activity, deciding with whatever could be
   * measured (see limiter.ts for the reasoning):
   *   1. a limit that was measured and exceeded rejects, even if another call failed;
   *   2. a failure that only a configuration change can cure refuses the form (the controls are broken, not busy);
   *   3. a transient failure lets the lead through under the stricter per-instance limits, and the team e-mail says the
   *      shared limits were not checked. A real lead is never lost to a database hiccup; the CHECK limits still apply.
   * The four calls are independent (different buckets / tables), so they run together: one round trip, not three.
   */
  async function throttle(store: ContactStore, ipBucket: string | null, emailBucket: string | null): Promise<ThrottleOutcome> {
    const counts = local.observe(ipBucket, emailBucket);
    const [ip, em, g10, g60] = await Promise.all([
      measure(async () => (ipBucket ? await store.recordAndCount(ipBucket) : null)),
      measure(async () => (emailBucket ? await store.recordAndCount(emailBucket) : null)),
      measure(() => store.countLeads(10)),
      measure(() => store.countLeads(60)),
    ]);
    await measure(() => store.purge()); // best effort: it never throws, and a slow purge must not hold the visitor

    const known = decideThrottle({
      perIp: ip.ok ? ip.value : null,
      perEmail: em.ok ? em.value : null,
      global10Min: g10.ok ? g10.value : 0,
      global1Hour: g60.ok ? g60.value : 0,
    });
    if (known === "reject") return { decision: "reject" };

    const failures = [ip, em, g10, g60].filter((m): m is { ok: false; error: unknown } => !m.ok);
    if (failures.length === 0) return { decision: known, limitsUnchecked: false };

    const detail = `${failures.length}/4 checks failed; first: ${describeError(failures[0].error)}`;
    if (failures.some((f) => classifyStoreError(f.error) === "config")) {
      log("error", `[contact] ❌ throttle misconfigured — refusing requests (fail closed): ${detail}`);
      return { decision: "unavailable" };
    }
    if (decideDegraded(counts) === "reject") {
      log("warn", `[contact] Throttled by the per-instance limits while the shared ones were unavailable: ${detail}`);
      return { decision: "reject" };
    }
    log("error", `[contact] ⚠ throttle degraded — allowing under per-instance limits: ${detail}`);
    return { decision: known, limitsUnchecked: true };
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
        // Bots get the normal answer; the attempt counts against the IP, nothing is stored or sent. A failure to write the
        // count is logged (it used to vanish) but never changes the answer: a bot must not learn anything from it.
        if (bucket) {
          const recorded = await measure(() => store.record(bucket));
          if (!recorded.ok) log("error", `[contact] ⚠ honeypot attempt could not be counted: ${describeError(recorded.error)}`);
        }
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

      const emailBucket = lead.email ? await keyedBucket("em", lead.email, deps.rateSalt) : null;
      const outcome = await throttle(store, bucket, emailBucket);
      if (outcome.decision === "unavailable") return unavailable();
      if (outcome.decision === "reject") {
        log("warn", "[contact] Throttled (rejected)");
        return json(429, { error: "Recibimos demasiados mensajes. Intenta de nuevo más tarde." });
      }
      const { decision, limitsUnchecked } = outcome;

      // Persist the lead as a 'received' ticket. Non-fatal: a transient DB error must never lose the email
      // notification; it is logged and the e-mail says it was not stored. The call is time-boxed so a hung database
      // cannot hold the visitor's request: if it times out the lead counts as not stored (a ticket that still lands
      // later only means the team sees it twice).
      let stored = false;
      try {
        const dbError = await withTimeout(Promise.resolve().then(() => store.insertLead(lead)), timeoutMs * 2);
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
        html: contactHtml(lead, stored, undefined, { limitsUnchecked }),
      });

      return json(200, { ok: true });
    } catch (e: unknown) {
      log("error", `[contact] ❌ ${describeError(e)}`);
      return internalError();
    }
  };
}
