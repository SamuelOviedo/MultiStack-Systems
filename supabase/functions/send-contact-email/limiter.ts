/**
 * Safety net of the contact form's rate limits for when their shared counters (the database) cannot be read.
 * Pure module — no Deno / network APIs — so Vitest covers it.
 *
 * The limits live in the database so every function instance sees the same counters. A limiter that silently
 * switches itself off whenever the database misbehaves is not a limit, so a failing check is handled in three ways:
 *
 *   · a measurement that WAS taken is never thrown away (handler.ts decides with whatever it measured);
 *   · a failure that says "this is misconfigured" (permission denied, table missing, key rejected, a request the schema
 *     refuses) will not heal by itself, so it is classified as `config` and the form refuses (503) — like a missing salt
 *     or secret key — and tells the team;
 *   · anything else (network, timeout, 5xx, overload, a restarting database) is `transient`: the lead is accepted,
 *     because the e-mail may be its only copy, but the dimension whose check failed is bounded by stricter limits kept
 *     in this instance's memory (LocalLimiter), and the team e-mail says the shared limits were not checked, so nobody
 *     has to watch the logs to learn it.
 *
 * What the per-instance limits can and cannot do: instances do not share memory, so N instances let N times these
 * numbers through. They are a brake on one instance, not a global limit; the notice in the e-mail is what makes a long
 * degraded period visible.
 */
import { DEGRADED_THROTTLE, type LocalCounts } from "./lead.ts";

export type StoreFailure = "config" | "transient";

/** PostgREST / Postgres codes that name a cause only a configuration change can cure. */
const CONFIG_CODES = new Set([
  "42501",    // insufficient_privilege: the key's role lost its grant on the table
  "42P01",    // undefined_table
  "42703",    // undefined_column
  "PGRST204", // column not found in the schema cache
  "PGRST205", // table not found in the schema cache
  "PGRST301", // JWT invalid / expired
  "PGRST302", // anonymous access disabled
]);
/** Only wording that cannot describe a hiccup. Codes and statuses carry the real signal. */
const CONFIG_MESSAGE = /invalid api key|permission denied/i;

/**
 * Tells a broken configuration from a hiccup. Order matters:
 *   1. a code names the cause exactly;
 *   2. a 5xx / 408 / 425 / 429 heals by itself — including PGRST002 ("Could not query the database for the schema cache.
 *      Retrying."), which PostgREST answers with 503 while the database restarts, fails over or reloads its schema;
 *   3. a HEAD answer has no body, hence no code: for the fixed queries of this function a 400/401/403/404 can only mean
 *      the request is refused or the object is gone, so the status is the whole signal;
 *   4. as a last resort, wording that cannot describe a hiccup.
 * Unknown shapes are `transient`: they must not take the form down.
 */
export function classifyStoreError(e: unknown): StoreFailure {
  const o = (typeof e === "object" && e !== null ? e : {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof o.code === "string" ? o.code : "";
  const status = typeof o.status === "number" ? o.status : 0;
  if (CONFIG_CODES.has(code)) return "config";
  if (status >= 500 || status === 408 || status === 425 || status === 429) return "transient";
  if (status === 400 || status === 401 || status === 403 || status === 404) return "config";
  if (typeof o.message === "string" && CONFIG_MESSAGE.test(o.message)) return "config";
  return "transient";
}

/**
 * PostgREST's error code and the HTTP status travel with the thrown error, so classifyStoreError can tell a broken
 * configuration from a hiccup.
 */
export function storeError(error: { message: string; code?: string }, status?: number): Error & { code?: string; status?: number } {
  return Object.assign(new Error(error.message), { code: error.code, status });
}

/**
 * The count of a HEAD request. PostgREST always answers one; anything else must be a FAILURE of the check — never a silent
 * 0, which would read as "nobody has written yet". supabase-js reports an empty 404 (a HEAD has no body) as "no error",
 * status 204 and no count: the table is not there, which is a configuration problem, not a hiccup.
 */
export function exactCount(r: { count: number | null; status: number }): number {
  if (typeof r.count !== "number" || !Number.isInteger(r.count) || r.count < 0) {
    throw storeError({ message: "count unavailable", ...(r.status === 204 ? { code: "PGRST205" } : {}) }, r.status);
  }
  return r.count;
}

/** One-line, bounded rendering of a failure for the log: its code and status (what classifyStoreError reads) and its message. */
export function describeStoreError(e: unknown): string {
  const o = (typeof e === "object" && e !== null ? e : {}) as { code?: unknown; status?: unknown; message?: unknown };
  const parts: string[] = [];
  if (typeof o.code === "string" && o.code) parts.push(`code=${o.code.slice(0, 24)}`);
  if (typeof o.status === "number" && o.status) parts.push(`status=${o.status}`);
  const message = e instanceof Error ? e.message : typeof o.message === "string" ? o.message : "unknown error";
  return [...parts, message].join(" ").replace(/[\r\n\t]+/g, " ").slice(0, 300);
}

/** Longest a single database operation of the limit check may take before it counts as a (transient) failure. */
export const STORE_TIMEOUT_MS = 3000;

/** Rejects after `ms`, so a hung database degrades the check quickly instead of holding the visitor's request. */
export function withTimeout<T>(p: Promise<T>, ms: number = STORE_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

const HOUR_MS = 3_600_000;
const TEN_MIN_MS = 600_000;
const SWEEP_EVERY_MS = 60_000;

/**
 * Per-instance sliding-window counters, bounded in memory. It counts every lead the shared check ACCEPTED — never one it
 * rejected, so a flood that the shared limits already stop cannot fill it — which keeps the window warm when degradation
 * starts. When the table of buckets is full it forgets the least recently seen one: per-sender limits are best effort, the
 * global counter does not depend on the table at all.
 */
export class LocalLimiter {
  private readonly keys = new Map<string, number[]>();
  private recent: number[] = [];
  private lastSweepAt = -Infinity;

  constructor(
    private readonly now: () => number = Date.now,
    /** distinct buckets remembered at once */
    private readonly maxKeys = 2000,
    /** timestamps kept per bucket (far above every limit, so counts above a limit stay above it) */
    private readonly maxStamps = 64,
  ) {}

  /** Records this attempt and returns the counts INCLUDING it (record-then-count, like the database path). */
  observe(ipBucket: string | null, emailBucket: string | null): LocalCounts {
    const t = this.now();
    return {
      perIp: ipBucket ? this.hit(ipBucket, t) : null,
      perEmail: emailBucket ? this.hit(emailBucket, t) : null,
      global10Min: this.hitGlobal(t),
    };
  }

  private hit(key: string, t: number): number {
    let stamps = this.keys.get(key);
    if (!stamps) {
      if (this.keys.size >= this.maxKeys) {
        // Expired buckets first, but scanning the whole table for every newcomer of a flood would be the cost: at most once a minute.
        if (t - this.lastSweepAt >= SWEEP_EVERY_MS) {
          this.lastSweepAt = t;
          this.sweep(t);
        }
        if (this.keys.size >= this.maxKeys) {
          const idle = this.keys.keys().next().value; // Map keeps insertion order and a hit moves its bucket to the end: the first key is the least recently seen
          if (idle !== undefined) this.keys.delete(idle);
        }
      }
      stamps = [];
    } else {
      this.keys.delete(key); // re-inserted below, at the end: an active bucket is never the one forgotten
    }
    this.keys.set(key, stamps);
    const cutoff = t - HOUR_MS;
    let drop = 0;
    while (drop < stamps.length && stamps[drop] <= cutoff) drop++;
    if (drop) stamps.splice(0, drop);
    stamps.push(t);
    if (stamps.length > this.maxStamps) stamps.splice(0, stamps.length - this.maxStamps);
    return stamps.length;
  }

  private hitGlobal(t: number): number {
    const cutoff = t - TEN_MIN_MS;
    let drop = 0;
    while (drop < this.recent.length && this.recent[drop] <= cutoff) drop++;
    if (drop) this.recent.splice(0, drop);
    this.recent.push(t);
    const cap = this.maxStamps * 4;
    if (this.recent.length > cap) this.recent.splice(0, this.recent.length - cap);
    return this.recent.length;
  }

  /** Forgets the buckets whose newest attempt left the hour window. */
  private sweep(t: number): void {
    const cutoff = t - HOUR_MS;
    for (const [key, stamps] of this.keys) {
      if (stamps.length === 0 || stamps[stamps.length - 1] <= cutoff) this.keys.delete(key);
    }
  }
}

/** Which shared measurements failed: a per-instance limit is applied ONLY to the dimension whose shared check is missing. */
export interface FailedChecks {
  ip: boolean;
  email: boolean;
  global: boolean;
}

/**
 * Verdict of the per-instance limits. A dimension that was measured fine is not judged again here (a shared office with 8
 * of its 15 hourly messages must not be refused because an unrelated counter failed). Mirrors the healthy rules for the
 * global dimension: above the soft limit the lead is stored without the team e-mail, above the hard one it is rejected.
 */
export function decideDegraded(c: LocalCounts, failed: FailedChecks): "allow" | "store-only" | "reject" {
  const D = DEGRADED_THROTTLE;
  if (failed.ip && c.perIp !== null && c.perIp > D.perIpPerHour) return "reject";
  if (failed.email && c.perEmail !== null && c.perEmail > D.perEmailPerHour) return "reject";
  if (failed.global) {
    if (c.global10Min > D.globalHardPer10Min) return "reject";
    if (c.global10Min > D.globalSoftPer10Min) return "store-only";
  }
  return "allow";
}
