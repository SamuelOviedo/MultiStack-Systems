// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyStoreError, decideDegraded, LocalLimiter, STORE_TIMEOUT_MS, withTimeout } from "./limiter";
import { DEGRADED_THROTTLE, THROTTLE } from "./lead";

describe("classifyStoreError — a broken configuration is not a hiccup", () => {
  it.each([
    ["42501", { code: "42501" }],
    ["42P01", { code: "42P01" }],
    ["42703", { code: "42703" }],
    ["PGRST204", { code: "PGRST204" }],
    ["PGRST205", { code: "PGRST205" }],
    ["PGRST301", { code: "PGRST301" }],
    ["PGRST302", { code: "PGRST302" }],
    ["HTTP 401", { status: 401 }],
    ["HTTP 403", { status: 403 }],
    ["Invalid API key", { message: "Invalid API key" }],
    ["permission denied", { message: "permission denied for table contact_rate_events" }],
    ["JWT", { message: "JWT expired" }],
    ["schema cache", { message: "Could not find the table 'public.x' in the schema cache" }],
    ["does not exist", { message: 'relation "public.x" does not exist' }],
  ])("%s is config", (_n, e) => {
    expect(classifyStoreError(e)).toBe("config");
    expect(classifyStoreError(Object.assign(new Error(String((e as { message?: string }).message ?? "x")), e))).toBe("config");
  });

  it.each([
    ["a network error", new Error("fetch failed")],
    ["a timeout", new Error("timed out after 3000 ms")],
    ["HTTP 500", { status: 500 }],
    ["HTTP 502", { status: 502 }],
    ["HTTP 503", { status: 503 }],
    ["HTTP 429", { status: 429 }],
    ["statement timeout", { code: "57014" }],
    ["too many connections", { code: "53300" }],
    ["connection failure", { code: "08006" }],
    ["an unknown PostgREST code", { code: "PGRST000" }],
    ["an empty code and status 0", { code: "", status: 0 }],
    ["a string", "boom"],
    ["null", null],
    ["undefined", undefined],
    ["a number", 42],
    ["an empty object", {}],
    ["non-string fields", { code: 42501, status: "401", message: 7 }],
  ])("%s is transient (it must never take the form down)", (_n, e) => {
    expect(classifyStoreError(e)).toBe("transient");
  });
});

describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("returns the value and leaves no timer behind", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("passes the original rejection through and leaves no timer behind", async () => {
    vi.useFakeTimers();
    const boom = new Error("boom");
    await expect(withTimeout(Promise.reject(boom), 100)).rejects.toBe(boom);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects after the given time when the promise never settles", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise<never>(() => {}), 100);
    const assertion = expect(p).rejects.toThrow("timed out after 100 ms");
    await vi.advanceTimersByTimeAsync(99);
    await vi.advanceTimersByTimeAsync(2);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a late rejection of the abandoned promise is not an unhandled rejection", async () => {
    vi.useFakeTimers();
    let rejectLater!: (e: Error) => void;
    const slow = new Promise<never>((_, rej) => { rejectLater = rej; });
    const p = withTimeout(slow, 10);
    const assertion = expect(p).rejects.toThrow("timed out");
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
    rejectLater(new Error("too late"));
    await vi.advanceTimersByTimeAsync(0);
  });

  it("defaults to the documented timeout", () => {
    expect(STORE_TIMEOUT_MS).toBe(3000);
  });
});

describe("LocalLimiter", () => {
  const HOUR = 3_600_000;
  const clock = (start = 1_000_000) => { let t = start; return { now: () => t, advance: (ms: number) => { t += ms; } }; };

  it("counts INCLUDING the current attempt, per bucket (record-then-count)", () => {
    const c = clock(); const l = new LocalLimiter(c.now);
    expect(l.observe("ip:a", "em:a")).toEqual({ perIp: 1, perEmail: 1, global10Min: 1 });
    expect(l.observe("ip:a", "em:b")).toEqual({ perIp: 2, perEmail: 1, global10Min: 2 });
    expect(l.observe("ip:b", "em:a")).toEqual({ perIp: 1, perEmail: 2, global10Min: 3 });
  });

  it("unknown IP / e-mail give null, still counting globally", () => {
    const l = new LocalLimiter(clock().now);
    expect(l.observe(null, null)).toEqual({ perIp: null, perEmail: null, global10Min: 1 });
  });

  it("per-bucket attempts leave the window after an hour (sliding)", () => {
    const c = clock(); const l = new LocalLimiter(c.now);
    l.observe("ip:a", null); c.advance(30 * 60_000); l.observe("ip:a", null);
    c.advance(30 * 60_000 + 1); // the first attempt is now just over an hour old
    expect(l.observe("ip:a", null).perIp).toBe(2);
    c.advance(HOUR + 1);
    expect(l.observe("ip:a", null).perIp).toBe(1);
  });

  it("the global counter looks back 10 minutes only", () => {
    const c = clock(); const l = new LocalLimiter(c.now);
    l.observe("ip:a", null); c.advance(9 * 60_000); l.observe("ip:b", null);
    expect(l.observe("ip:c", null).global10Min).toBe(3);
    c.advance(60_000 + 1); // the first one left the window
    expect(l.observe("ip:d", null).global10Min).toBe(3);
  });

  it("memory is bounded: at most maxKeys buckets, and a newcomer to a full table counts as over every limit", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    for (const k of ["ip:1", "ip:2", "ip:3"]) l.observe(k, null);
    const saturated = l.observe("ip:4", null);
    expect(saturated.perIp).toBe(Number.MAX_SAFE_INTEGER);
    expect(decideDegraded(saturated)).toBe("reject");
    expect(l.observe("ip:1", null).perIp).toBe(2); // known buckets keep counting
  });

  it("a full table frees itself once its buckets expire", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    for (const k of ["ip:1", "ip:2", "ip:3"]) l.observe(k, null);
    c.advance(HOUR + 1);
    expect(l.observe("ip:4", null).perIp).toBe(1);
  });

  it("the global cap does NOT depend on the bucket table: flooding it with distinct senders still hits the global limit", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    let last = l.observe("ip:0", null);
    for (let i = 1; i <= DEGRADED_THROTTLE.globalPer10Min; i++) last = l.observe(`ip:${i}`, null);
    expect(last.global10Min).toBe(DEGRADED_THROTTLE.globalPer10Min + 1);
    expect(decideDegraded(last)).toBe("reject");
  });

  it("timestamps per bucket are capped, yet a count above a limit stays above it", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 10, 8);
    let n = 0;
    for (let i = 0; i < 200; i++) n = l.observe("ip:a", null).perIp!;
    expect(n).toBe(8);
    expect(n).toBeGreaterThan(DEGRADED_THROTTLE.perIpPerHour);
  });

  it("the global list is capped too (no unbounded growth under a flood)", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 10, 8);
    let n = 0;
    for (let i = 0; i < 500; i++) n = l.observe(null, null).global10Min;
    expect(n).toBe(32);
    expect(n).toBeGreaterThan(DEGRADED_THROTTLE.globalPer10Min);
  });
});

describe("decideDegraded", () => {
  const D = DEGRADED_THROTTLE;
  it("allows up to the limit and rejects the next one, for each limit", () => {
    expect(decideDegraded({ perIp: D.perIpPerHour, perEmail: null, global10Min: 1 })).toBe("allow");
    expect(decideDegraded({ perIp: D.perIpPerHour + 1, perEmail: null, global10Min: 1 })).toBe("reject");
    expect(decideDegraded({ perIp: null, perEmail: D.perEmailPerHour, global10Min: 1 })).toBe("allow");
    expect(decideDegraded({ perIp: null, perEmail: D.perEmailPerHour + 1, global10Min: 1 })).toBe("reject");
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: D.globalPer10Min })).toBe("allow");
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: D.globalPer10Min + 1 })).toBe("reject");
  });

  it("unknown IP and e-mail are not rejected on their own", () => {
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: 1 })).toBe("allow");
  });

  it("is always stricter than the shared limits (the reason it exists), so a visitor spread over instances stays bounded", () => {
    expect(D.perIpPerHour).toBeLessThan(THROTTLE.perIpPerHour);
    expect(D.perEmailPerHour).toBeLessThan(THROTTLE.perEmailPerHour);
    expect(D.globalPer10Min).toBeLessThan(THROTTLE.globalSoftPer10Min);
  });
});
