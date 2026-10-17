/**
 * Safety net of the contact form's rate limits for when their shared counters (the database) cannot be read.
 * Pure module — no Deno / network APIs — so Vitest covers it.
 *
 * The limits live in the database so every function instance sees the same counters. A limiter that silently
 * switches itself off whenever the database misbehaves is not a limit, so a failing check is handled in three ways:
 *
 *   · a measurement that WAS taken is never thrown away (handler.ts decides with whatever it measured);
 *   · a failure that says "this is misconfigured" (permission denied, table missing, key rejected) will not heal by
 *     itself, so it is classified as `config` and the form refuses (503) — like a missing salt or secret key;
 *   · anything else (network, timeout, 5xx, overload) is `transient`: the lead is accepted, because the e-mail may be
 *     its only copy, but under much stricter limits kept in this instance's memory (LocalLimiter) and flagged in the
 *     team e-mail so nobody has to watch the logs to learn that the shared limits were not checked.
 */
import { DEGRADED_THROTTLE, type LocalCounts } from "./lead.ts";

export type StoreFailure = "config" | "transient";

/** PostgREST / Postgres codes that only a configuration change can cure. */
const CONFIG_CODES = new Set([
  "42501",    // insufficient_privilege: the key's role lost its grant on the table
  "42P01",    // undefined_table
  "42703",    // undefined_column
  "PGRST204", // column not found in the schema cache
  "PGRST205", // table not found in the schema cache
  "PGRST301", // JWT invalid / expired
  "PGRST302", // anonymous access disabled
]);
const CONFIG_MESSAGE = /invalid api key|permission denied|\bjwt\b|schema cache|does not exist/i;

/**
 * Tells a broken configuration from a hiccup. Reads `code` (PostgREST / Postgres), `status` (HTTP) and, as a last
 * resort, the message, off whatever was thrown. Unknown shapes are `transient`: they must not take the form down.
 */
export function classifyStoreError(e: unknown): StoreFailure {
  const o = (typeof e === "object" && e !== null ? e : {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = typeof o.code === "string" ? o.code : "";
  if (CONFIG_CODES.has(code)) return "config";
  if (o.status === 401 || o.status === 403) return "config";
  if (typeof o.message === "string" && CONFIG_MESSAGE.test(o.message)) return "config";
  return "transient";
}

/** Longest a single database call of the limit check may take before it counts as a (transient) failure. */
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

/**
 * Per-instance sliding-window counters, bounded in memory. Instances do not share memory, so this can only bound what ONE
 * instance lets through while the shared counters are unavailable (see DEGRADED_THROTTLE); it never replaces them. It
 * counts every lead that reaches the limit check, so the window is already warm when degradation starts.
 */
export class LocalLimiter {
  private readonly keys = new Map<string, number[]>();
  private recent: number[] = [];

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
      if (this.keys.size >= this.maxKeys) this.sweep(t);
      // Still full of live buckets: a flood of distinct senders. A newcomer counts as over every limit — only while the
      // shared counters are down — and the global cap below does not depend on this table at all.
      if (this.keys.size >= this.maxKeys) return Number.MAX_SAFE_INTEGER;
      stamps = [];
      this.keys.set(key, stamps);
    }
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
    if (this.recent.length > this.maxStamps * 4) this.recent.splice(0, this.recent.length - this.maxStamps * 4);
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

/** Verdict of the per-instance limits (applied only while the shared counters could not be read). */
export function decideDegraded(c: LocalCounts): "allow" | "reject" {
  const D = DEGRADED_THROTTLE;
  if (c.perIp !== null && c.perIp > D.perIpPerHour) return "reject";
  if (c.perEmail !== null && c.perEmail > D.perEmailPerHour) return "reject";
  if (c.global10Min > D.globalPer10Min) return "reject";
  return "allow";
}
