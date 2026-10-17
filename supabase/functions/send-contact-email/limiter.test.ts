// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyStoreError, decideDegraded, describeStoreError, exactCount, LocalLimiter, storeError, withTimeout } from "./limiter";
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
    ["HTTP 400 (a HEAD has no body, so no code)", { status: 400 }],
    ["HTTP 401", { status: 401 }],
    ["HTTP 403", { status: 403 }],
    ["HTTP 404", { status: 404 }],
    ["Invalid API key", { message: "Invalid API key" }],
    ["permission denied", { message: "permission denied for table contact_rate_events" }],
    ["a code beats a transient-looking status (PGRST205 is a 404, 42501 a 403)", { code: "PGRST205", status: 404 }],
  ])("%s is config", (_n, e) => {
    expect(classifyStoreError(e)).toBe("config");
    expect(classifyStoreError(Object.assign(new Error(String((e as { message?: string }).message ?? "x")), e))).toBe("config");
  });

  it.each([
    ["a network error", new Error("fetch failed")],
    ["a timeout", new Error("timed out after 3000 ms")],
    ["an aborted request", Object.assign(new Error("AbortError: The signal has been aborted"), { code: "", status: 0 })],
    ["HTTP 500", { status: 500 }],
    ["HTTP 502", { status: 502 }],
    ["HTTP 503", { status: 503 }],
    ["HTTP 520", { status: 520 }],
    ["HTTP 408", { status: 408 }],
    ["HTTP 425", { status: 425 }],
    ["HTTP 429", { status: 429 }],
    ["statement timeout", { code: "57014" }],
    ["too many connections", { code: "53300" }],
    ["connection failure", { code: "08006" }],
    ["PGRST000 (could not connect)", { code: "PGRST000", status: 503 }],
    ["PGRST002: a restarting database / a reloading schema cache answers 503 and heals itself", Object.assign(new Error("Could not query the database for the schema cache. Retrying."), { code: "PGRST002", status: 503 })],
    ["that same wording with no code at all", { status: 503, message: "Could not query the database for the schema cache. Retrying." }],
    ["a message about the schema cache and nothing else", { message: "Could not query the database for the schema cache. Retrying." }],
    ["Supavisor's \"prepared statement does not exist\"", { message: 'prepared statement "s1" does not exist' }],
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

describe("storeError / exactCount — what supabase-js actually hands the adapter", () => {
  /** the shapes postgrest-js produces (index.cjs processResponse + its fetch-error branch) */
  const classify = (r: { error: { message: string; code?: string } | null; count?: number | null; status: number }) => {
    try {
      if (r.error) throw storeError(r.error, r.status);
      exactCount({ count: r.count ?? null, status: r.status });
      return "ok";
    } catch (e) { return classifyStoreError(e); }
  };

  it("a count is returned as is, 0 included", () => {
    expect(exactCount({ count: 0, status: 200 })).toBe(0);
    expect(exactCount({ count: 16, status: 200 })).toBe(16);
  });

  it("storeError carries the code and the status", () => {
    const e = storeError({ message: "boom", code: "42501" }, 403);
    expect(e).toBeInstanceOf(Error);
    expect(e).toMatchObject({ message: "boom", code: "42501", status: 403 });
  });

  it.each([
    ["a missing count", { count: null, status: 200 }],
    ["NaN (parseInt of a content-range '*/*')", { count: NaN, status: 200 }],
    ["a negative count", { count: -1, status: 200 }],
    ["a fractional count", { count: 1.5, status: 200 }],
  ])("%s is a failure of the check, never a silent 0 (transient)", (_n, r) => {
    expect(() => exactCount(r)).toThrow("count unavailable");
    expect(classifyStoreError((() => { try { exactCount(r); } catch (e) { return e; } })())).toBe("transient");
  });

  it("an empty 404 that supabase-js reports as 'no error', status 204, means the table is not there: config", () => {
    expect(classify({ error: null, count: null, status: 204 })).toBe("config");
  });

  it.each([
    ["network failure {code:'', status:0}", { error: { message: "TypeError: fetch failed", code: "" }, status: 0 }, "transient"],
    ["POST 403 / 42501", { error: { message: "permission denied for table contact_rate_events", code: "42501" }, status: 403 }, "config"],
    ["POST 404 / 42P01", { error: { message: 'relation "public.contact_rate_events" does not exist', code: "42P01" }, status: 404 }, "config"],
    ["POST 404 / PGRST205", { error: { message: "Could not find the table", code: "PGRST205" }, status: 404 }, "config"],
    ["POST 503 / PGRST002 (restart)", { error: { message: "Could not query the database for the schema cache. Retrying.", code: "PGRST002" }, status: 503 }, "transient"],
    ["HEAD 503, empty body -> {message:''}", { error: { message: "" }, status: 503 }, "transient"],
    ["HEAD 500, empty body", { error: { message: "" }, status: 500 }, "transient"],
    ["HEAD 403, empty body", { error: { message: "" }, status: 403 }, "config"],
    ["HEAD 401, empty body", { error: { message: "" }, status: 401 }, "config"],
    ["HEAD 400, empty body (a missing column)", { error: { message: "" }, status: 400 }, "config"],
    ["gateway 401 'Invalid API key' (no code)", { error: { message: "Invalid API key" }, status: 401 }, "config"],
  ])("%s -> %s", (_n, r, expected) => {
    expect(classify(r)).toBe(expected);
  });
});

describe("describeStoreError — what the log says", () => {
  it("leads with the code and the status the classifier read, then the message", () => {
    expect(describeStoreError(storeError({ message: "permission denied", code: "42501" }, 403))).toBe("code=42501 status=403 permission denied");
  });

  it("an empty HEAD message still leaves the status to read", () => {
    expect(describeStoreError(storeError({ message: "" }, 403))).toBe("status=403 ");
  });

  it("is one line and bounded, whatever it is given", () => {
    const line = describeStoreError(Object.assign(new Error("a\nb\r\n" + "x".repeat(1000)), { code: "C".repeat(100), status: 500 }));
    expect(line).not.toMatch(/[\r\n\t]/);
    expect(line.length).toBeLessThanOrEqual(300);
    expect(line.startsWith(`code=${"C".repeat(24)} status=500 a b`)).toBe(true);
  });

  it("never throws on odd values", () => {
    for (const v of [null, undefined, "boom", 7, {}, { message: 5 }]) expect(typeof describeStoreError(v)).toBe("string");
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

  it("stays pending just before the deadline and rejects at it", async () => {
    vi.useFakeTimers();
    let state = "pending";
    const p = withTimeout(new Promise<never>(() => {}), 100).catch((e: Error) => { state = e.message; });
    await vi.advanceTimersByTimeAsync(99);
    expect(state).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    await p;
    expect(state).toBe("timed out after 100 ms");
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

  it("memory is bounded and a full table forgets a bucket instead of refusing newcomers", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    for (const k of ["ip:1", "ip:2", "ip:3"]) l.observe(k, null);
    expect(l.observe("ip:4", null).perIp).toBe(1);        // a newcomer is counted normally, never rejected for lack of room
    expect(l.observe("ip:1", null).perIp).toBe(1);        // ip:1 was the oldest: forgotten, so it starts again (and evicts ip:2)
    expect(l.observe("ip:3", null).perIp).toBe(2);        // ip:3 survived
  });

  it("an active bucket is not the one forgotten: a hit refreshes it (least recently SEEN goes first)", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    for (const k of ["ip:1", "ip:2", "ip:3"]) l.observe(k, null);
    l.observe("ip:1", null);                         // ip:1 is now the most recently seen
    l.observe("ip:4", null);                         // table full: ip:2, the least recently seen, goes
    expect(l.observe("ip:1", null).perIp).toBe(3);   // survived with its whole history
    expect(l.observe("ip:2", null).perIp).toBe(1);   // forgotten: starts again
  });

  it("a full table frees itself first by dropping expired buckets, evicting nothing live", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    for (const k of ["ip:1", "ip:2"]) l.observe(k, null);
    c.advance(HOUR + 1);
    l.observe("ip:3", null);                               // fresh
    expect(l.observe("ip:4", null).perIp).toBe(1);        // table full: the two expired go, ip:3 stays
    expect(l.observe("ip:3", null).perIp).toBe(2);
  });

  it("the global cap does NOT depend on the bucket table: flooding it with distinct senders still reaches the global limit", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 3);
    let last = l.observe("ip:0", null);
    for (let i = 1; i <= DEGRADED_THROTTLE.globalHardPer10Min; i++) last = l.observe(`ip:${i}`, null);
    expect(last.global10Min).toBe(DEGRADED_THROTTLE.globalHardPer10Min + 1);
  });

  it("timestamps per bucket are capped, yet a count above a limit stays above it", () => {
    const c = clock(); const l = new LocalLimiter(c.now, 10, 8);
    let n = 0;
    for (let i = 0; i < 200; i++) n = l.observe("ip:a", null).perIp!;
    expect(n).toBe(8);
    expect(n).toBeGreaterThan(DEGRADED_THROTTLE.perIpPerHour);
  });

  it("the global list is capped too (no unbounded growth under a flood), above both global limits with the defaults", () => {
    const c = clock(); const l = new LocalLimiter(c.now);
    let n = 0;
    for (let i = 0; i < 1000; i++) n = l.observe(null, null).global10Min;
    expect(n).toBe(256);
    expect(n).toBeGreaterThan(DEGRADED_THROTTLE.globalHardPer10Min);
  });
});

describe("decideDegraded — a dimension is judged only if ITS shared check is missing", () => {
  const D = DEGRADED_THROTTLE;
  const ALL = { ip: true, email: true, global: true };
  const NONE = { ip: false, email: false, global: false };

  it("per IP: allows up to the limit and rejects the next one", () => {
    expect(decideDegraded({ perIp: D.perIpPerHour, perEmail: null, global10Min: 1 }, ALL)).toBe("allow");
    expect(decideDegraded({ perIp: D.perIpPerHour + 1, perEmail: null, global10Min: 1 }, ALL)).toBe("reject");
  });

  it("per e-mail: allows up to the limit and rejects the next one", () => {
    expect(decideDegraded({ perIp: null, perEmail: D.perEmailPerHour, global10Min: 1 }, ALL)).toBe("allow");
    expect(decideDegraded({ perIp: null, perEmail: D.perEmailPerHour + 1, global10Min: 1 }, ALL)).toBe("reject");
  });

  it("global: allow, then store-only above the soft limit, then reject above the hard one", () => {
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: D.globalSoftPer10Min }, ALL)).toBe("allow");
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: D.globalSoftPer10Min + 1 }, ALL)).toBe("store-only");
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: D.globalHardPer10Min }, ALL)).toBe("store-only");
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: D.globalHardPer10Min + 1 }, ALL)).toBe("reject");
  });

  it("a dimension whose shared check WORKED is never judged by the local count", () => {
    const over = { perIp: 99, perEmail: 99, global10Min: 999 };
    expect(decideDegraded(over, NONE)).toBe("allow");
    expect(decideDegraded(over, { ...NONE, global: true })).toBe("reject");
    expect(decideDegraded({ ...over, global10Min: 1 }, { ...NONE, global: true })).toBe("allow");
    expect(decideDegraded({ ...over, perEmail: 1, global10Min: 1 }, { ...NONE, ip: true })).toBe("reject");
    expect(decideDegraded({ ...over, perIp: 1, global10Min: 1 }, { ...NONE, email: true })).toBe("reject");
    expect(decideDegraded({ ...over, perIp: 1, global10Min: 1 }, { ...NONE, ip: true })).toBe("allow");
  });

  it("unknown IP and e-mail are not rejected on their own", () => {
    expect(decideDegraded({ perIp: null, perEmail: null, global10Min: 1 }, ALL)).toBe("allow");
  });

  it("the per-sender limits are stricter than the shared ones; the global ones mirror the healthy rules", () => {
    expect(D.perIpPerHour).toBeLessThan(THROTTLE.perIpPerHour);
    expect(D.perEmailPerHour).toBeLessThan(THROTTLE.perEmailPerHour);
    expect(D.globalSoftPer10Min).toBeLessThanOrEqual(THROTTLE.globalSoftPer10Min);
    expect(D.globalHardPer10Min).toBeGreaterThan(D.globalSoftPer10Min);
  });
});
