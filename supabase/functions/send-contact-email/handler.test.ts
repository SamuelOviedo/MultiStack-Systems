// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createContactHandler, type ContactDeps, type ContactStore, type OutgoingEmail } from "./handler";
import type { Lead } from "./templates";

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
}

function fakeStore(o: StoreOptions = {}) {
  const calls = { buckets: [] as string[], recorded: [] as string[], inserted: [] as Lead[], purges: 0, leadQueries: [] as number[] };
  const store: ContactStore = {
    async recordAndCount(bucket) {
      if (o.recordThrows) throw new Error("db down");
      calls.buckets.push(bucket);
      return bucket.startsWith("ip:") ? (o.ipCount ?? 1) : (o.emailCount ?? 1);
    },
    async record(bucket) { calls.recorded.push(bucket); },
    async purge() { calls.purges++; },
    async countLeads(minutes) {
      calls.leadQueries.push(minutes);
      return minutes === 10 ? (o.leads10 ?? 0) : (o.leads60 ?? 0);
    },
    async insertLead(lead) {
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

  it("a failing rate check fails OPEN for transient errors: the lead is not lost", async () => {
    const t = setup({ store: { recordThrows: true } });
    const res = await t.handle(post(lead()));
    expect(res.status).toBe(200);
    expect(t.calls!.inserted).toHaveLength(1);
    expect(t.emails).toHaveLength(1);
    expect(t.logs.some(([l, m]) => l === "error" && m.includes("throttle check failed"))).toBe(true);
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
