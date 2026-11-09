/**
 * Request handling for the public contact form (fix S4). Every dependency is
 * injected — data store, e-mail sending, secrets, logging — so the rules below
 * are covered by Vitest; index.ts wires Deno, supabase-js and Resend.
 *
 * Request contract: POST { name, phone?, email?, message, website? } (see
 * src/lib/contact.ts). `website` is the honeypot.
 */
import { alertHtml, alertSubject, contactHtml, contactSubject, type Lead } from "./templates.ts";
import { replyToFor } from "./reply-to.ts";
import { checkLead, clientIp, decideThrottle, type ThrottleDecision } from "./lead.ts";
import { classifyStoreError, decideDegraded, describeStoreError, LocalLimiter, STORE_TIMEOUT_MS, withTimeout } from "./limiter.ts";

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
  /** Opportunistic purge of events older than a day. Throws on failure (the handler only logs it). */
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
  /** Clock for the alert cool-down (default Date.now). */
  now?: () => number;
}

/**
 * What the limit check decided. `limitsUnchecked` is set when a shared counter could not be read and the lead went through
 * under the per-instance limits for that dimension: the team e-mail says so. `unavailable` carries the log-safe detail of
 * the configuration failure, for the team alert.
 */
type ThrottleOutcome =
  | { decision: "reject" }
  | { decision: "unavailable"; detail: string }
  | { decision: Exclude<ThrottleDecision, "reject">; limitsUnchecked: boolean };

/** At most one "the form is refusing messages" alert per instance in this time (a failed send is retried after ALERT_RETRY_MS). */
const ALERT_COOLDOWN_MS = 30 * 60_000;
const ALERT_RETRY_MS = 5 * 60_000;

/**
 * A configuration-class failure closes the form only once it has lasted this long WITHOUT a single healthy check in between
 * (and each sighting is within CONFIG_STALE_MS of the previous one). A hiccup that looks like a configuration problem — a
 * gateway answering 403/404 to a body-less HEAD during a restore, a WAF rule — heals before that and never closes anything;
 * a real misconfiguration is still closed, and alerted, within the minute. Until then the request goes through as degraded.
 */
const CONFIG_PERSISTENCE_MS = 60_000;
const CONFIG_STALE_MS = 5 * 60_000;

/** Purge old attempts at most this often per instance: one DELETE per lead would pile up behind a flood. */
const PURGE_EVERY_MS = 5 * 60_000;

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
 * Answer to an unexpected failure (e-mail provider, database client, ...). The visitor never sees the internal message:
 * it can name secrets, the provider's account or a recipient. The detail goes to the log only (see describeError).
 */
const internalError = () => json(500, { error: "No se pudo enviar el mensaje. Intenta de nuevo más tarde." });

/** One-line, bounded rendering of an error for the log (diagnosis without log injection or unbounded output). */
const describeError = describeStoreError;

/**
 * Answer to every POST while an indispensable credential is missing or the limit check is misconfigured. Deliberately says
 * nothing about WHICH (the reason goes to the log only).
 */
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
  const clock = () => (deps.now ?? Date.now)();
  let configSince: number | null = null; // start of the current run of configuration-class failures
  let configLast = 0;
  let lastPurgeAt = -Infinity;

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
   *   2. a failure that only a configuration change can cure refuses the form once it has lasted CONFIG_PERSISTENCE_MS (the
   *      controls are broken, not busy) — until then it is handled like step 3;
   *   3. a transient failure lets the lead through, bounded by the per-instance limits of the dimension whose check
   *      failed, and the team e-mail says the shared limits were not checked. A real lead is never lost to a database
   *      hiccup; the CHECK limits still apply.
   * The calls are independent (different buckets / tables), so they run together: one round trip, not three. The
   * per-instance counters only ever see requests that got past steps 1 and 2, so a flood the shared limits already stop
   * cannot poison them.
   */
  async function throttle(store: ContactStore, ipBucket: string | null, emailBucket: string | null): Promise<ThrottleOutcome> {
    // Housekeeping (events older than a day): best effort and NOT awaited — a slow or hung purge must add nothing to the
    // visitor's wait, and a failure only gets logged (it never counts as a failure of the check). At most every
    // PURGE_EVERY_MS per instance, so a flood does not queue one DELETE per request.
    const t0 = clock();
    if (t0 - lastPurgeAt >= PURGE_EVERY_MS) {
      lastPurgeAt = t0;
      void measure(() => store.purge()).then((m) => {
        if (!m.ok) log("warn", `[contact] ⚠ purge of old attempts failed: ${describeError(m.error)}`);
      });
    }

    const [ip, em, g10, g60] = await Promise.all([
      measure(async () => (ipBucket ? await store.recordAndCount(ipBucket) : null)),
      measure(async () => (emailBucket ? await store.recordAndCount(emailBucket) : null)),
      measure(() => store.countLeads(10)),
      measure(() => store.countLeads(60)),
    ]);

    const known = decideThrottle({
      perIp: ip.ok ? ip.value : null,
      perEmail: em.ok ? em.value : null,
      global10Min: g10.ok ? g10.value : 0,
      global1Hour: g60.ok ? g60.value : 0,
    });
    if (known === "reject") return { decision: "reject" };

    const failures = [ip, em, g10, g60].filter((m): m is { ok: false; error: unknown } => !m.ok);
    const cause = failures.find((f) => classifyStoreError(f.error) === "config");
    if (!cause) configSince = null; // no configuration-class failure this time: the run (if any) is over
    if (failures.length === 0) {
      local.observe(ipBucket, emailBucket); // keeps the per-instance window warm for the day the database misbehaves
      return { decision: known, limitsUnchecked: false };
    }

    const detail = `${failures.length}/4 checks failed; ${cause ? "configuration" : "first"}: ${describeError((cause ?? failures[0]).error)}`;
    if (cause) {
      const now = clock();
      if (configSince === null || now - configLast > CONFIG_STALE_MS) configSince = now;
      configLast = now;
      if (now - configSince >= CONFIG_PERSISTENCE_MS) {
        log("error", `[contact] ❌ throttle misconfigured for ${Math.round((now - configSince) / 1000)} s — refusing requests (fail closed): ${detail}`);
        return { decision: "unavailable", detail };
      }
      log("error", `[contact] ❌ throttle misconfigured (seen for ${Math.round((now - configSince) / 1000)} s; the form closes at ${CONFIG_PERSISTENCE_MS / 1000} s) — this request goes through as degraded: ${detail}`);
    }

    const verdict = decideDegraded(local.observe(ipBucket, emailBucket), { ip: !ip.ok, email: !em.ok, global: !g10.ok || !g60.ok });
    if (verdict === "reject") {
      log("warn", `[contact] Throttled by the per-instance limits while the shared ones were unavailable: ${detail}`);
      return { decision: "reject" };
    }
    log("error", `[contact] ⚠ throttle degraded — allowing under per-instance limits: ${detail}`);
    return { decision: verdict === "store-only" ? "store-only" : known, limitsUnchecked: true };
  }

  /**
   * A form that refuses everyone because its limit check is misconfigured is an outage nobody would notice from the logs, so
   * the team is told by e-mail (which does not depend on the database): once per instance per ALERT_COOLDOWN_MS, best
   * effort, never changes the visitor's answer, and carries nothing the visitor sent.
   */
  let lastAlertAt = -Infinity;
  async function alertTeam(detail: string): Promise<void> {
    const now = clock();
    if (now - lastAlertAt < ALERT_COOLDOWN_MS) return;
    lastAlertAt = now;
    try {
      await withTimeout(
        Promise.resolve().then(() => deps.sendEmail({
          from: deps.fromAddress,
          to: deps.dest,
          subject: alertSubject(),
          html: alertHtml(detail),
        })),
        timeoutMs,
      );
    } catch (e) {
      lastAlertAt = now - ALERT_COOLDOWN_MS + ALERT_RETRY_MS; // a failed send is not a delivered alert: try again soon
      log("error", `[contact] ⚠ the outage alert could not be sent: ${describeError(e)}`);
    }
  }

  return async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json(405, { error: "Método no permitido" });

    // FAIL CLOSED: without CONTACT_RATE_SALT the per-IP and per-e-mail limits cannot work. Refusing is safer than silently
    // running without them; the secret is set BEFORE the function is deployed, so this only fires if it is later removed
    // or shortened. A transient database failure does NOT refuse the form (a real lead must not be lost): see throttle().
    if (!saltOk) {
      log("error", `[contact] ❌ CONTACT_RATE_SALT missing or shorter than ${RATE_SALT_MIN_LENGTH} characters — refusing requests (fail closed)`);
      // The likeliest deploy mistake. The team hears of it by e-mail whenever the Resend key is there to send it.
      if (deps.resendConfigured) await alertTeam(`CONTACT_RATE_SALT missing or shorter than ${RATE_SALT_MIN_LENGTH} characters`);
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
        await alertTeam(`secret key missing: ${deps.secretSource}`);
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
      if (outcome.decision === "unavailable") {
        await alertTeam(outcome.detail);
        return unavailable();
      }
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

      // CONTINGENCY — a lead whose storage really failed (database down, a hiccup, a timeout) is still e-mailed: the e-mail is
      // then the only copy, and the team is told twice (error log "ticket insert failed|threw" and the "not stored" notice in the
      // e-mail). Content that can never be stored is refused earlier with a 400 (checkLead), so this is no way around the limits.
      // The shared global counters count stored tickets and cannot see such a lead, so it counts against this instance's own hard
      // global cap, held in memory and independent of the database that just failed.
      if (!stored && decideDegraded(
        { perIp: null, perEmail: null, global10Min: local.globalCount() },
        { ip: false, email: false, global: true },
      ) === "reject") {
        log("warn", "[contact] Throttled: the lead could not be stored and this instance's global cap is reached");
        return json(429, { error: "Recibimos demasiados mensajes. Intenta de nuevo más tarde." });
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
