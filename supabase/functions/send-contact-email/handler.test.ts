// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createContactHandler, type ContactDeps, type ContactStore, type OutgoingEmail } from "./handler";
import { alertSubject, type Lead } from "./templates";
import { LocalLimiter } from "./limiter";

const SALT = "a".repeat(64);
const IP = "203.0.113.7";

interface StoreOptions {
  /** count returned for the last hour of an "ip:" bucket / an "em:" bucket */
  ipCount?: number;
  emailCount?: number;
  leads10?: number;
  leads60?: number;
  insertError?: string | null;
  insertThrows?: boolean;
  recordThrows?: boolean;
  /** failure injection per call: thrown as is (any value), checked at call time so a test can change it mid-way */
  ipError?: unknown;
  emailError?: unknown;
  leadsError?: unknown;
  honeypotError?: unknown;
  /** calls that never answer (a hung database) */
  hangIp?: boolean;
  hangEmail?: boolean;
  hangLeads?: boolean;
  hangInsert?: boolean;
  hangPurge?: boolean;
  hangHoneypot?: boolean;
  purgeError?: unknown;
  /** every measuring call waits for this before answering (to observe that they are all in flight together) */
  gate?: Promise<void>;
}

const never = () => new Promise<never>(() => {});

function fakeStore(o: StoreOptions = {}) {
  const calls = { buckets: [] as string[], recorded: [] as string[], inserted: [] as Lead[], purges: 0, leadQueries: [] as number[], started: 0 };
  const store: ContactStore = {
    async recordAndCount(bucket) {
      const isIp = bucket.startsWith("ip:");
      calls.started++;
      if (o.gate) await o.gate;
      if (isIp && o.hangIp) return never();
      if (!isIp && o.hangEmail) return never();
      if (o.recordThrows) throw new Error("db down");
      const injected = isIp ? o.ipError : o.emailError;
      if (injected !== undefined) throw injected;
      calls.buckets.push(bucket);
      return isIp ? (o.ipCount ?? 1) : (o.emailCount ?? 1);
    },
    async record(bucket) {
      if (o.hangHoneypot) return never();
      if (o.honeypotError !== undefined) throw o.honeypotError;
      calls.recorded.push(bucket);
    },
    async purge() {
      if (o.hangPurge) return never();
      if (o.purgeError !== undefined) throw o.purgeError;
      calls.purges++;
    },
    async countLeads(minutes) {
      calls.leadQueries.push(minutes);
      calls.started++;
      if (o.gate) await o.gate;
      if (o.hangLeads) return never();
      if (o.leadsError !== undefined) throw o.leadsError;
      return minutes === 10 ? (o.leads10 ?? 0) : (o.leads60 ?? 0);
    },
    async insertLead(lead) {
      if (o.hangInsert) return never();
      if (o.insertThrows) throw new Error("insert exploded");
      if (o.insertError) return o.insertError;
      calls.inserted.push(lead);
      return null;
    },
  };
  return { store, calls };
}

function setup(over: Partial<ContactDeps> & { store?: StoreOptions | null; sendFails?: Error } = {}) {
  const { store: storeOpts, sendFails, ...deps } = over;
  const fs = storeOpts === null ? null : fakeStore(storeOpts ?? {});
  const emails: OutgoingEmail[] = [];
  const logs: Array<[string, string]> = [];
  const handle = createContactHandler({
    openStore: () => fs?.store ?? null,
    secretSource: "SUPABASE_SECRET_KEYS.edge_functions",
    rateSalt: SALT,
    resendConfigured: true,
    fromAddress: "MultiStack <soporte@mail.example.test>",
    dest: "equipo@example.test",
    async sendEmail(e) { if (sendFails) throw sendFails; emails.push(e); },
    log: (level, message) => logs.push([level, message]),
    ...deps,
  });
  return { handle, emails, logs, calls: fs?.calls };
}

const post = (body: unknown, headers: Record<string, string> = { "cf-connecting-ip": IP }) =>
  new Request("https://f.test/", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const lead = (over: Record<string, unknown> = {}) => ({ name: "Ana Pérez", email: "Ana@Example.com", message: "Necesito una web", ...over });

describe("contact handler — protocol", () => {
  it("answers CORS preflight without touching the store or sending e-mail", async () => {
    const t = setup();
    const res = await t.handle(new Request("https://f.test/", { method: "OPTIONS" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(t.calls!.buckets).toEqual([]);
    expect(t.emails).toEqual([]);
  });

  it.each(["GET", "PUT", "DELETE", "PATCH"])("rejects %s with 405", async (method) => {
    const t = setup();
    const res = await t.handle(new Request("https://f.test/", { method }));
    expect(res.status).toBe(405);
    expect(t.emails).toEqual([]);
  });

  it("treats an unreadable body as empty: 400, nothing stored or sent", async () => {
    const t = setup();
    const res = await t.handle(post("not json"));
    expect(res.status).toBe(400);
    expect(t.calls!.inserted).toEqual([]);
    expect(t.emails).toEqual([]);
  });

  it("rejects an invalid lead with 400 and the documented message", async () => {
    const t = setup();
    const res = await t.handle(post(lead({ message: "hi" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/entre 5 y 5000 caracteres/);
    expect(t.calls!.buckets).toEqual([]);
  });
});

describe("contact handler — honeypot", () => {
  it("answers 200 like a real visitor, counts the IP, stores and sends nothing", async () => {
    const t = setup();
    const res = await t.handle(post(lead({ website: "http://spam.example" })));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(t.calls!.recorded).toHaveLength(1);
    expect(t.calls!.recorded[0]).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(t.calls!.inserted).toEqual([]);
    expect(t.emails).toEqual([]);
  });
});

describe("contact handler — a normal lead", () => {
  it("stores the ticket and e-mails the team once, replying to the visitor", async () => {
    const t = setup();
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(t.calls!.inserted).toEqual([{ name: "Ana Pérez", email: "ana@example.com", phone: "", message: "Necesito una web" }]);
    expect(t.emails).toHaveLength(1);
    expect(t.emails[0]).toMatchObject({ to: "equipo@example.test", from: "MultiStack <soporte@mail.example.test>", replyTo: "ana@example.com" });
    expect(t.emails[0].subject).toContain("Ana Pérez");
    expect(t.emails[0].html).not.toContain("No se registró en el panel");
  });

  it("phone-only leads reply to support and use only the IP bucket", async () => {
    const t = setup();
    const res = await t.handle(post({ name: "Ana", phone: "+504 9999-9999", message: "Hola, info" }));
    expect(res.status).toBe(200);
    expect(t.emails[0].replyTo).toBe("soporte@multistacksystems.com");
    expect(t.calls!.buckets.map((b) => b.slice(0, 3))).toEqual(["ip:"]);
  });

  it("never stores a raw IP or e-mail in the rate buckets: keyed hashes, stable per value and per salt", async () => {
    const a = setup(); await a.handle(post(lead()));
    const b = setup(); await b.handle(post(lead()));
    const c = setup(); await c.handle(post(lead(), { "cf-connecting-ip": "198.51.100.9" }));
    const d = setup({ rateSalt: "b".repeat(64) }); await d.handle(post(lead()));
    const [ip, em] = a.calls!.buckets;
    expect(ip).toMatch(/^ip:[0-9a-f]{32}$/);
    expect(em).toMatch(/^em:[0-9a-f]{32}$/);
    expect(JSON.stringify(a.calls!.buckets)).not.toContain(IP);
    expect(JSON.stringify(a.calls!.buckets)).not.toContain("example.com");
    expect(b.calls!.buckets).toEqual(a.calls!.buckets);
    expect(c.calls!.buckets[0]).not.toBe(ip);
    expect(c.calls!.buckets[1]).toBe(em);
    expect(d.calls!.buckets[0]).not.toBe(ip);
  });

  it("without cf-connecting-ip the per-IP limit is skipped (the others still apply)", async () => {
    const t = setup();
    const res = await t.handle(post(lead(), {}));
    expect(res.status).toBe(200);
    expect(t.calls!.buckets.map((b) => b.slice(0, 3))).toEqual(["em:"]);
  });
});

describe("contact handler — abuse limits (S4)", () => {
  it("allows the 15th attempt of an IP in an hour and rejects the 16th with 429", async () => {
    const ok = setup({ store: { ipCount: 15 } });
    expect((await ok.handle(post(lead()))).status).toBe(200);
    const blocked = setup({ store: { ipCount: 16 } });
    const res = await blocked.handle(post(lead()));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/demasiados mensajes/);
    expect(blocked.calls!.inserted).toEqual([]);
    expect(blocked.emails).toEqual([]);
  });

  it("allows 3 attempts per e-mail and hour and rejects the 4th", async () => {
    expect((await setup({ store: { emailCount: 3 } }).handle(post(lead()))).status).toBe(200);
    const blocked = setup({ store: { emailCount: 4 } });
    expect((await blocked.handle(post(lead()))).status).toBe(429);
    expect(blocked.emails).toEqual([]);
  });

  it("hard global limit: 300 leads in an hour reject, nothing stored", async () => {
    const t = setup({ store: { leads60: 300 } });
    expect((await t.handle(post(lead()))).status).toBe(429);
    expect(t.calls!.inserted).toEqual([]);
  });

  it("soft global limit: 30 leads in 10 minutes are stored WITHOUT the team e-mail", async () => {
    const t = setup({ store: { leads10: 30 } });
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(200);
    expect(t.calls!.inserted).toHaveLength(1);
    expect(t.emails).toEqual([]);
  });

  it("soft global limit but the ticket could not be stored: the e-mail is the only copy and goes out", async () => {
    const t = setup({ store: { leads10: 30, insertError: "boom" } });
    expect((await t.handle(post(lead()))).status).toBe(200);
    expect(t.emails).toHaveLength(1);
    expect(t.emails[0].html).toContain("No se registró en el panel");
  });

  it("a transient failure of the rate check does not lose the lead (details: 'degraded rate limits' below)", async () => {
    const t = setup({ store: { recordThrows: true } });
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(200);
    expect(t.calls!.inserted).toHaveLength(1);
    expect(t.emails).toHaveLength(1);
    expect(t.logs.some(([l, m]) => l === "error" && m.includes("throttle degraded"))).toBe(true);
  });
});

describe("contact handler — degraded rate limits (W2.1)", () => {
  const BANNER = "Límites de seguridad no verificados";
  const NOT_STORED = "No se registró en el panel";
  const DOWN = new Error("fetch failed");
  const DENIED = Object.assign(new Error("permission denied for table contact_rate_events"), { code: "42501", status: 403 });
  const errLog = (t: ReturnType<typeof setup>, needle: string) => t.logs.some(([l, m]) => l === "error" && m.includes(needle));
  const fromIp = (ip: string) => ({ "cf-connecting-ip": ip });
  const bodyOf = (i: number) => lead({ email: `u${i}@example.com` });

  describe("a healthy check", () => {
    it("is unchanged: no banner, no per-instance rejection, nothing logged as degraded", async () => {
      const t = setup();
      for (let i = 0; i < 30; i++) expect((await t.handle(post(bodyOf(i), fromIp("203.0.113.7")))).status).toBe(200);
      expect(t.emails).toHaveLength(30);
      expect(t.emails.every((e) => !e.html.includes(BANNER))).toBe(true);
      expect(t.logs.some(([, m]) => /degraded|misconfigured/.test(m))).toBe(false);
    });

    it("the measuring calls are all in flight together: one round trip, not four", async () => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => { release = resolve; });
      const t = setup({ store: { gate } });
      const pending = t.handle(post(lead()));
      await vi.waitFor(() => expect(t.calls!.started).toBe(4)); // ip, e-mail, leads(10), leads(60) — none has answered yet
      release();
      expect((await pending).status).toBe(200);
    });

    it("a purge that fails is logged as a warning and is not a failure of the check", async () => {
      const t = setup({ store: { purgeError: DOWN } });
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(200);
      expect(t.emails[0].html).not.toContain(BANNER);
      expect(t.logs.some(([l, m]) => l === "warn" && m.includes("purge of old attempts failed"))).toBe(true);
      expect(t.logs.some(([, m]) => /degraded|misconfigured/.test(m))).toBe(false);
    });

    it("a hung purge never holds the request: it is not awaited", async () => {
      const t = setup({ store: { hangPurge: true }, storeTimeoutMs: 1000 });
      const started = Date.now();
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(200);
      expect(Date.now() - started).toBeLessThan(400); // well under the 1000 ms deadline it would have cost
      expect(t.emails[0].html).not.toContain(BANNER);
    });
  });

  describe("a transient failure (network, timeout, 5xx, restart, unknown): the lead is accepted, flagged and bounded", () => {
    it.each([
      ["a plain error", new Error("fetch failed")],
      ["a 503 from the gateway", Object.assign(new Error("upstream"), { status: 503 })],
      ["PGRST002: the database is restarting / reloading its schema cache", Object.assign(new Error("Could not query the database for the schema cache. Retrying."), { code: "PGRST002", status: 503 })],
      ["a statement timeout", Object.assign(new Error("canceling statement"), { code: "57014" })],
      ["too many connections", Object.assign(new Error("remaining connection slots"), { code: "53300" })],
      ["a thrown string", "boom"],
      ["a thrown null", null],
    ])("%s on the IP count: 200, ticket stored, one lead e-mail with the banner, logged as degraded", async (_n, error) => {
      const t = setup({ store: { ipError: error } });
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(t.calls!.inserted).toHaveLength(1);
      expect(t.emails).toHaveLength(1);
      expect(t.emails[0].subject).toContain("Ana Pérez"); // the lead's e-mail, not an outage alert
      expect(t.emails[0].html).toContain(BANNER);
      expect(errLog(t, "throttle degraded")).toBe(true);
    });

    it("the banner sits right under the intro, above the lead's details, and names where to look", async () => {
      const t = setup({ store: { leadsError: DOWN } });
      await t.handle(post(lead()));
      const html = t.emails[0].html;
      expect(html.indexOf("Has recibido una nueva consulta")).toBeLessThan(html.indexOf(BANNER));
      expect(html.indexOf(BANNER)).toBeLessThan(html.indexOf("Nombre completo"));
      expect(html).toContain("send-contact-email");
    });

    it("a failure never skips a measurement: every other call is still attempted", async () => {
      const t = setup({ store: { ipError: DOWN } });
      await t.handle(post(lead()));
      expect(t.calls!.buckets.map((b) => b.slice(0, 3))).toEqual(["em:"]);
      expect([...t.calls!.leadQueries].sort()).toEqual([10, 60]);
      expect(t.calls!.purges).toBe(1);
    });

    it("a hung database degrades after ONE timeout instead of holding the visitor", async () => {
      const t = setup({ store: { hangIp: true, hangLeads: true }, storeTimeoutMs: 25 });
      const started = Date.now();
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(200);
      expect(Date.now() - started).toBeLessThan(500);
      expect(t.emails[0].html).toContain(BANNER);
      expect(errLog(t, "timed out")).toBe(true);
    });

    it("a hung ticket insert is time-boxed too: the e-mail goes out saying it was not stored", async () => {
      const t = setup({ store: { hangInsert: true }, storeTimeoutMs: 25 });
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(200);
      expect(t.emails).toHaveLength(1);
      expect(t.emails[0].html).toContain(NOT_STORED);
    });

    it("total outage (every shared check and the insert fail): still 200 and ONE e-mail carrying both notices", async () => {
      const t = setup({ store: { recordThrows: true, leadsError: DOWN, insertThrows: true } });
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(200);
      expect(t.emails).toHaveLength(1);
      expect(t.emails[0].html).toContain(BANNER);
      expect(t.emails[0].html).toContain(NOT_STORED);
    });

    it("keeps the soft global limit: leads stored without e-mail while the IP check is down", async () => {
      const t = setup({ store: { ipError: DOWN, leads10: 30 } });
      expect((await t.handle(post(lead()))).status).toBe(200);
      expect(t.calls!.inserted).toHaveLength(1);
      expect(t.emails).toEqual([]);
    });
  });

  describe("a measurement that WAS taken is never thrown away", () => {
    it("IP over the limit + the e-mail check failing: 429", async () => {
      const t = setup({ store: { ipCount: 16, emailError: DOWN } });
      expect((await t.handle(post(lead()))).status).toBe(429);
      expect(t.calls!.inserted).toEqual([]);
      expect(t.emails).toEqual([]);
    });

    it("e-mail over the limit + the IP check failing: 429", async () => {
      const t = setup({ store: { emailCount: 4, ipError: DOWN } });
      expect((await t.handle(post(lead()))).status).toBe(429);
      expect(t.emails).toEqual([]);
    });

    it("hard global cap measured + both counters failing: 429", async () => {
      const t = setup({ store: { leads60: 300, ipError: DOWN, emailError: DOWN } });
      expect((await t.handle(post(lead()))).status).toBe(429);
      expect(t.calls!.inserted).toEqual([]);
    });

    it("IP over the limit + another call HUNG: 429 once the timeout passes", async () => {
      const t = setup({ store: { ipCount: 16, hangLeads: true }, storeTimeoutMs: 25 });
      expect((await t.handle(post(lead()))).status).toBe(429);
      expect(t.emails).toEqual([]);
    });

    it("a measured breach wins over a configuration failure elsewhere (429, not 503), and sends no alert", async () => {
      const t = setup({ store: { ipCount: 16, leadsError: DENIED } });
      expect((await t.handle(post(lead()))).status).toBe(429);
      expect(t.emails).toEqual([]);
    });
  });

  describe("a configuration failure refuses the form (fail closed): the controls are broken, not busy", () => {
    const GENERIC503 = { error: "Servicio no disponible temporalmente. Intenta de nuevo más tarde." };
    it.each([
      ["permission denied (42501)", Object.assign(new Error("permission denied for table contact_rate_events"), { code: "42501" })],
      ["table missing (42P01)", Object.assign(new Error('relation "public.contact_rate_events" does not exist'), { code: "42P01" })],
      ["table not in the schema cache (PGRST205)", Object.assign(new Error("Could not find the table"), { code: "PGRST205" })],
      ["rejected key (HTTP 401)", Object.assign(new Error("Invalid API key"), { status: 401 })],
      ["forbidden (HTTP 403)", Object.assign(new Error("forbidden"), { status: 403 })],
      ["a HEAD answer with no body and no code: 400", Object.assign(new Error(""), { status: 400 })],
      ["a HEAD answer with no body and no code: 404 (count unavailable, status 204 -> PGRST205)", Object.assign(new Error("count unavailable"), { code: "PGRST205", status: 204 })],
      ["no code, but a permission message", new Error("permission denied for table tickets")],
    ])("%s on the IP count: 503, no ticket, no lead e-mail, logged as misconfigured", async (_n, error) => {
      const t = setup({ store: { ipError: error } });
      const res = await t.handle(post(lead()));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual(GENERIC503);
      expect(t.calls!.inserted).toEqual([]);
      expect(t.emails.every((e) => e.subject === alertSubject())).toBe(true); // at most the outage alert, never the lead
      expect(errLog(t, "throttle misconfigured")).toBe(true);
      expect(errLog(t, "fail closed")).toBe(true);
    });

    it("also when only the global counter is misconfigured", async () => {
      const t = setup({ store: { leadsError: DENIED } });
      expect((await t.handle(post(lead()))).status).toBe(503);
      expect(t.calls!.inserted).toEqual([]);
    });

    it("a configuration failure anywhere wins over transient failures elsewhere", async () => {
      const t = setup({ store: { ipError: DOWN, emailError: DOWN, leadsError: DENIED } });
      expect((await t.handle(post(lead()))).status).toBe(503);
      expect(t.calls!.inserted).toEqual([]);
    });

    it("wins over the per-instance limits too: a warm window never turns a broken configuration into a 429", async () => {
      const opts: StoreOptions = {};
      const t = setup({ store: opts });
      for (let i = 1; i <= 6; i++) await t.handle(post(bodyOf(i), fromIp("203.0.113.5")));
      opts.ipError = DENIED;
      expect((await t.handle(post(bodyOf(7), fromIp("203.0.113.5")))).status).toBe(503);
    });

    it("the log names the failure that caused it (code and status), even when a transient one came first", async () => {
      const t = setup({ store: { ipError: DOWN, leadsError: DENIED } });
      await t.handle(post(lead()));
      expect(t.logs.some(([l, m]) => l === "error" && m.includes("throttle misconfigured") && m.includes("code=42501 status=403 permission denied"))).toBe(true);
    });

    it("the 503 body never names the table, the code or the key", async () => {
      const t = setup({ store: { ipError: DENIED } });
      const body = JSON.stringify(await (await t.handle(post(lead()))).json());
      expect(body).not.toMatch(/contact_rate_events|42501|denied|table|key/i);
    });
  });

  describe("a configuration failure also tells the team by e-mail: the form is down and nobody reads the logs", () => {
    it("sends ONE alert with the technical reason and nothing the visitor sent", async () => {
      const t = setup({ store: { ipError: DENIED } });
      const res = await t.handle(post(lead({ name: "Visitante Secreto", message: "contenido privado del visitante", phone: "+504 9999-0000" })));
      expect(res.status).toBe(503);
      expect(t.emails).toHaveLength(1);
      expect(t.emails[0]).toMatchObject({ to: "equipo@example.test", from: "MultiStack <soporte@mail.example.test>", subject: alertSubject() });
      expect(t.emails[0].html).toContain("code=42501 status=403 permission denied");
      expect(t.emails[0].html).toContain("fuera de servicio");
      for (const visitor of ["Visitante Secreto", "contenido privado", "9999-0000", "ana@example.com", IP]) expect(t.emails[0].html).not.toContain(visitor);
      expect(t.emails[0].replyTo).toBeUndefined();
    });

    it("at most one alert per instance every 30 minutes", async () => {
      let clock = 1_000_000;
      const t = setup({ store: { ipError: DENIED }, now: () => clock });
      await t.handle(post(lead()));
      await t.handle(post(lead()));
      clock += 30 * 60_000 - 1;
      await t.handle(post(lead()));
      expect(t.emails).toHaveLength(1);
      clock += 1;
      await t.handle(post(lead()));
      expect(t.emails).toHaveLength(2);
    });

    it("a failing or hung alert never changes the visitor's answer", async () => {
      const failing = setup({ store: { ipError: DENIED }, sendFails: new Error("Resend 500") });
      expect((await failing.handle(post(lead()))).status).toBe(503);
      expect(errLog(failing, "the outage alert could not be sent")).toBe(true);
      const hung = setup({ store: { ipError: DENIED }, storeTimeoutMs: 25, sendEmail: () => never() });
      const started = Date.now();
      expect((await hung.handle(post(lead()))).status).toBe(503);
      expect(Date.now() - started).toBeLessThan(500);
      expect(errLog(hung, "the outage alert could not be sent")).toBe(true);
    });

    it("is not sent for a transient failure, a measured breach, or the credential-missing refusals", async () => {
      const cases = [
        setup({ store: { ipError: DOWN } }),
        setup({ store: { ipCount: 16 } }),
        setup({ rateSalt: "" }),
        setup({ store: null }),
        setup({ resendConfigured: false }),
      ];
      for (const t of cases) await t.handle(post(lead()));
      expect(cases.flatMap((t) => t.emails.map((e) => e.subject)).filter((s) => s === alertSubject())).toEqual([]);
    });
  });

  describe("the per-instance limits that bound a degraded period — only for the dimension whose shared check failed", () => {
    it("IP check down: 5 messages per hour per instance, the 6th is a 429 (and says why in the log)", async () => {
      const t = setup({ store: { ipError: DOWN } });
      const codes: number[] = [];
      for (let i = 1; i <= 7; i++) codes.push((await t.handle(post(bodyOf(i), fromIp("203.0.113.9")))).status);
      expect(codes).toEqual([200, 200, 200, 200, 200, 429, 429]);
      expect(t.emails).toHaveLength(5);
      expect(t.logs.some(([l, m]) => l === "warn" && m.includes("per-instance limits"))).toBe(true);
    });

    it("e-mail check down: 2 per hour per instance, the 3rd is a 429, whatever the IP", async () => {
      const t = setup({ store: { emailError: DOWN } });
      const codes: number[] = [];
      for (let i = 1; i <= 4; i++) codes.push((await t.handle(post(lead({ email: "same@example.com" }), fromIp(`198.51.100.${i}`)))).status);
      expect(codes).toEqual([200, 200, 429, 429]);
    });

    it("global check down: 30 leads per 10 minutes are e-mailed, the next ones are stored WITHOUT the e-mail, from the 101st they are rejected", async () => {
      const t = setup({ store: { leadsError: DOWN } });
      const codes: number[] = [];
      for (let i = 1; i <= 102; i++) codes.push((await t.handle(post(bodyOf(i), fromIp(`10.0.${Math.floor(i / 200)}.${i % 200}`)))).status);
      expect(codes.slice(0, 100).every((c) => c === 200)).toBe(true);
      expect(codes.slice(100)).toEqual([429, 429]);
      expect(t.emails).toHaveLength(30);
      expect(t.calls!.inserted).toHaveLength(100);
    });

    it("a dimension that was measured fine is not judged locally: a shared office is not refused because an unrelated counter failed", async () => {
      const t = setup({ store: { ipCount: 8, leadsError: DOWN } }); // the shared IP count says 8 of 15
      for (let i = 1; i <= 8; i++) expect((await t.handle(post(bodyOf(i), fromIp("203.0.113.11")))).status).toBe(200);
      expect(t.emails).toHaveLength(8);
    });

    it("the window is warm before degradation starts: accepted healthy leads already count", async () => {
      const opts: StoreOptions = {};
      const t = setup({ store: opts });
      for (let i = 1; i <= 5; i++) expect((await t.handle(post(bodyOf(i), fromIp("203.0.113.50")))).status).toBe(200);
      opts.ipError = DOWN; // the database goes down now
      expect((await t.handle(post(bodyOf(6), fromIp("203.0.113.50")))).status).toBe(429);
    });

    it("requests the shared limits rejected never enter the per-instance counters: a flood cannot poison them", async () => {
      const opts: StoreOptions = { ipCount: 16 };
      const t = setup({ store: opts });
      for (let i = 1; i <= 10; i++) expect((await t.handle(post(bodyOf(i), fromIp("203.0.113.60")))).status).toBe(429);
      opts.ipCount = undefined; opts.ipError = DOWN; // then the database fails
      expect((await t.handle(post(bodyOf(11), fromIp("203.0.113.60")))).status).toBe(200);
    });

    it("a full per-instance table forgets its oldest bucket: newcomers are not refused for lack of room", async () => {
      const t = setup({ store: { ipError: DOWN }, localLimiter: new LocalLimiter(Date.now, 2) });
      for (let i = 1; i <= 6; i++) expect((await t.handle(post(bodyOf(i), fromIp(`192.0.2.${i}`)))).status).toBe(200);
    });

    it("without cf-connecting-ip the per-instance IP limit is skipped, the e-mail and global ones still apply", async () => {
      const t = setup({ store: { emailError: DOWN } });
      const codes: number[] = [];
      for (let i = 1; i <= 3; i++) codes.push((await t.handle(post(lead({ email: "noip@example.com" }), {}))).status);
      expect(codes).toEqual([200, 200, 429]);
    });

    it("the per-instance limits are per handler (instance): another instance has its own memory", async () => {
      const a = setup({ store: { ipError: DOWN } });
      const b = setup({ store: { ipError: DOWN } });
      for (let i = 1; i <= 5; i++) await a.handle(post(bodyOf(i), fromIp("203.0.113.70")));
      expect((await a.handle(post(bodyOf(6), fromIp("203.0.113.70")))).status).toBe(429);
      expect((await b.handle(post(bodyOf(7), fromIp("203.0.113.70")))).status).toBe(200);
    });

    it("healthy requests are never rejected by the per-instance limits, however many", async () => {
      const t = setup();
      for (let i = 1; i <= 25; i++) expect((await t.handle(post(bodyOf(i), fromIp("203.0.113.80")))).status).toBe(200);
    });
  });

  describe("the honeypot", () => {
    it("a failure to count the attempt is logged, never changes the bot's answer", async () => {
      const t = setup({ store: { honeypotError: DOWN } });
      const res = await t.handle(post(lead({ website: "http://spam.example" })));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(t.calls!.inserted).toEqual([]);
      expect(t.emails).toEqual([]);
      expect(errLog(t, "honeypot attempt could not be counted")).toBe(true);
    });

    it("a hung database does not hold the bot's request either", async () => {
      const t = setup({ store: { hangHoneypot: true }, storeTimeoutMs: 25 });
      const res = await t.handle(post(lead({ website: "x" })));
      expect(res.status).toBe(200);
      expect(errLog(t, "honeypot attempt could not be counted")).toBe(true);
    });

    it("honeypot hits do not count in the per-instance limits", async () => {
      const t = setup({ store: { ipError: DOWN } });
      for (let i = 0; i < 30; i++) await t.handle(post(lead({ website: "x" }), fromIp("203.0.113.90")));
      expect((await t.handle(post(lead(), fromIp("203.0.113.90")))).status).toBe(200);
    });
  });
});

describe("contact handler — storing is non-fatal", () => {
  it("a ticket insert error still e-mails the team and says it was not stored", async () => {
    const t = setup({ store: { insertError: "insert failed" } });
    expect((await t.handle(post(lead()))).status).toBe(200);
    expect(t.emails).toHaveLength(1);
    expect(t.emails[0].html).toContain("No se registró en el panel");
  });

  it("a ticket insert that throws behaves the same", async () => {
    const t = setup({ store: { insertThrows: true } });
    expect((await t.handle(post(lead()))).status).toBe(200);
    expect(t.emails[0].html).toContain("No se registró en el panel");
  });
});

describe("contact handler — fail closed without CONTACT_RATE_SALT (D1)", () => {
  it.each([["empty", ""], ["too short", "a".repeat(31)]])("answers 503 to every POST when the salt is %s: nothing stored, counted or sent", async (_n, salt) => {
    const t = setup({ rateSalt: salt });
    for (const body of [lead(), lead({ website: "x" }), {}, "not json"]) {
      const res = await t.handle(post(body));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "Servicio no disponible temporalmente. Intenta de nuevo más tarde." });
    }
    expect(t.calls!.buckets).toEqual([]);
    expect(t.calls!.recorded).toEqual([]);
    expect(t.calls!.inserted).toEqual([]);
    expect(t.emails).toEqual([]);
    expect(t.logs.some(([l, m]) => l === "error" && m.includes("CONTACT_RATE_SALT") && m.includes("fail closed"))).toBe(true);
  });

  it("accepts a salt of exactly 32 characters", async () => {
    expect((await setup({ rateSalt: "a".repeat(32) }).handle(post(lead()))).status).toBe(200);
  });

  it("keeps answering CORS preflight and non-POST methods as before", async () => {
    const t = setup({ rateSalt: "" });
    expect((await t.handle(new Request("https://f.test/", { method: "OPTIONS" }))).status).toBe(200);
    expect((await t.handle(new Request("https://f.test/", { method: "GET" }))).status).toBe(405);
  });

  it("never echoes the secret's name or value in the response", async () => {
    const res = await setup({ rateSalt: "" }).handle(post(lead()));
    expect(JSON.stringify(await res.json())).not.toMatch(/SALT|secret|SUPABASE|edge_functions/i);
  });
});

describe("contact handler — fail closed without the edge_functions key (D4)", () => {
  it("answers 503 to every POST: no e-mail, no ticket, no unchecked pass-through", async () => {
    const t = setup({ store: null });
    for (const body of [lead(), lead({ website: "x" }), {}, "not json"]) {
      const res = await t.handle(post(body));
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "Servicio no disponible temporalmente. Intenta de nuevo más tarde." });
    }
    expect(t.emails).toEqual([]);
    expect(t.logs.some(([l, m]) => l === "error" && m.includes("SUPABASE_SECRET_KEYS.edge_functions") && m.includes("fail closed"))).toBe(true);
  });

  it("keeps answering CORS preflight and non-POST methods as before", async () => {
    const t = setup({ store: null });
    expect((await t.handle(new Request("https://f.test/", { method: "OPTIONS" }))).status).toBe(200);
    expect((await t.handle(new Request("https://f.test/", { method: "GET" }))).status).toBe(405);
  });

  it("the response never names the missing credential", async () => {
    const res = await setup({ store: null }).handle(post(lead()));
    expect(JSON.stringify(await res.json())).not.toMatch(/SUPABASE|secret|edge_functions|SALT|key/i);
  });

  it("with the key and the salt present the form works (nothing else changed)", async () => {
    const t = setup();
    expect((await t.handle(post(lead()))).status).toBe(200);
    expect(t.emails).toHaveLength(1);
  });
});

describe("contact handler — fail closed without the Resend key", () => {
  it("answers 503 to every POST before touching the store: no counting, no ticket, no e-mail", async () => {
    const t = setup({ resendConfigured: false });
    for (const body of [lead(), lead({ website: "x" }), {}]) {
      const res = await t.handle(post(body));
      expect(res.status).toBe(503);
      expect(JSON.stringify(await res.json())).not.toMatch(/RESEND|key|secret/i);
    }
    expect(t.calls!.buckets).toEqual([]);
    expect(t.calls!.recorded).toEqual([]);
    expect(t.calls!.inserted).toEqual([]);
    expect(t.emails).toEqual([]);
    expect(t.logs.some(([l, m]) => l === "error" && m.includes("RESEND_API_KEY") && m.includes("fail closed"))).toBe(true);
  });

  it("keeps answering CORS preflight and non-POST methods as before", async () => {
    const t = setup({ resendConfigured: false });
    expect((await t.handle(new Request("https://f.test/", { method: "OPTIONS" }))).status).toBe(200);
    expect((await t.handle(new Request("https://f.test/", { method: "GET" }))).status).toBe(405);
  });
});

describe("contact handler — unexpected failures answer a generic 500 (D6)", () => {
  const GENERIC = { error: "No se pudo enviar el mensaje. Intenta de nuevo más tarde." };
  const LEAKY = /Resend|owner@|example\.invalid|SUPABASE|secret|key|edge_functions|SALT|\.supabase\.co|stack trace|\n\s+at /i;

  it("a failing e-mail provider never reaches the visitor: no provider text, no address, no secret name", async () => {
    const t = setup({ sendFails: new Error("Resend 403 — You can only send testing emails to your own email address (owner@example.invalid)") });
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC);
    expect(JSON.stringify(GENERIC)).not.toMatch(LEAKY);
  });

  it("keeps the diagnostic detail in the log", async () => {
    const t = setup({ sendFails: new Error("Resend 403 — boom") });
    await t.handle(post(lead()));
    expect(t.logs.some(([l, m]) => l === "error" && m.includes("Resend 403 — boom"))).toBe(true);
  });

  it("a store that cannot be opened (e.g. SUPABASE_URL missing) is also generic", async () => {
    const t = setup({ openStore: () => { throw new Error("Invalid URL: SUPABASE_URL is undefined"); } });
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC);
  });

  it("a thrown non-Error is generic too", async () => {
    const t = setup({ sendEmail: async () => { throw "plain string secret-ish"; } });
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC);
  });

  it("log lines are single-line and bounded", async () => {
    const t = setup({ sendFails: new Error("line one\nline two\r\n" + "x".repeat(1000)) });
    await t.handle(post(lead()));
    const line = t.logs.find(([l, m]) => l === "error" && m.startsWith("[contact] ❌"))![1];
    expect(line).not.toMatch(/[\r\n]/);
    expect(line.length).toBeLessThanOrEqual(320);
  });

  it("every error status answers a body with only a generic message", async () => {
    for (const [make, status] of [
      [() => setup({ rateSalt: "" }), 503],
      [() => setup({ store: null }), 503],
      [() => setup({ resendConfigured: false }), 503],
      [() => setup({ sendFails: new Error("x") }), 500],
    ] as const) {
      const res = await make().handle(post(lead()));
      expect(res.status).toBe(status);
      const body = await res.json();
      expect(Object.keys(body)).toEqual(["error"]);
      expect(String(body.error)).not.toMatch(LEAKY);
    }
  });
});

describe("contact handler — the e-mail provider", () => {
  it("a working provider answers 200 and sends exactly one e-mail", async () => {
    const t = setup();
    expect((await t.handle(post(lead()))).status).toBe(200);
    expect(t.emails).toHaveLength(1);
  });
});
