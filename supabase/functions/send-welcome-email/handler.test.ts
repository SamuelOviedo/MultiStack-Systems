// @vitest-environment node
/**
 * send-welcome-email: the welcome e-mail goes out at most once per account, the function fails closed and nothing
 * personal reaches the response or the logs. Resend is a spy: no e-mail ever leaves the test.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createWelcomeHandler,
  reserveWelcome,
  welcomeIdempotencyKey,
  type Reservation,
  type ReservationClient,
  type ReservationQuery,
  type WelcomeCaller,
  type WelcomeDeps,
  type WelcomeEmail,
} from "./handler.ts";
import { WELCOME_SUBJECT, welcomeHtml } from "./templates.ts";

const USER_ID = "3f2c9a1e-5b7d-4c8e-9f01-23456789abcd";
const OTHER_ID = "7a6b5c4d-3e2f-4a1b-8c9d-0e1f2a3b4c5d";
const EMAIL = "cliente.bienvenida@example.com";
const TOKEN = "eyJhbGciOiJIUzI1NiJ9.session-del-cliente.firma";
const OTHER_TOKEN = "eyJhbGciOiJIUzI1NiJ9.session-de-otro.firma";
const CLIENT_IP = "203.0.113.7";

/**
 * Fake `profiles` table. `reserve` behaves like
 *   UPDATE profiles SET welcome_email_sent = true WHERE id = <caller> AND welcome_email_sent = false RETURNING id
 * under READ COMMITTED: it yields first (so parallel requests are all in flight), then checks and sets the flag in
 * ONE synchronous step, which is what the row lock guarantees in Postgres.
 */
function makeDb(rows: Record<string, boolean>) {
  const flags = new Map(Object.entries(rows));
  const reserveCalls: string[] = [];
  const reserveFor = async (userId: string): Promise<Reservation> => {
    reserveCalls.push(userId);
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (flags.get(userId) !== false) return "already_sent"; // already true, or no profile row: 0 rows
    flags.set(userId, true);
    return "reserved";
  };
  return { flags, reserveCalls, reserveFor };
}

interface FakeUser {
  id: string;
  email: string | null;
  name?: unknown;
}

function makeDeps(
  users: Record<string, FakeUser>,
  db: ReturnType<typeof makeDb>,
  overrides: Partial<WelcomeDeps> = {},
) {
  const sent: WelcomeEmail[] = [];
  const sendEmail = vi.fn(async (email: WelcomeEmail) => { sent.push(email); });
  const log = vi.fn();
  const deps: WelcomeDeps = {
    authenticate: async (token): Promise<WelcomeCaller | null> => {
      const user = users[token];
      if (!user) return null;
      return { user: { id: user.id, email: user.email, name: user.name }, reserve: () => db.reserveFor(user.id) };
    },
    sendEmail,
    emailConfigured: true,
    log,
    ...overrides,
  };
  return { deps, sent, sendEmail, log };
}

const USERS: Record<string, FakeUser> = {
  [TOKEN]: { id: USER_ID, email: EMAIL, name: "María Fernanda" },
  [OTHER_TOKEN]: { id: OTHER_ID, email: "otra.persona@example.com" },
};

function post(token?: string, init: { scheme?: string; body?: unknown; method?: string } = {}): Request {
  return new Request("https://fn.local/send-welcome-email", {
    method: init.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": CLIENT_IP,
      "x-real-ip": CLIENT_IP,
      ...(token ? { Authorization: `${init.scheme ?? "Bearer"} ${token}` } : {}),
    },
    body: init.method === "GET" ? undefined : JSON.stringify(init.body ?? {}),
  });
}

describe("send-welcome-email · session", () => {
  it("rejects a request without Authorization (401): nothing reserved, nothing sent", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, db);
    const res = await createWelcomeHandler(deps)(post());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(db.reserveCalls).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid or forged session, a non-Bearer scheme and the publishable key alone (401)", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, db);
    for (const req of [
      post("forged.jwt.value"),
      post("sb_publishable_clave-publica"),
      post(TOKEN, { scheme: "Basic" }),
      post("", { scheme: "Bearer" }),
    ]) {
      const res = await createWelcomeHandler(deps)(req);
      expect(res.status).toBe(401);
    }
    expect(db.reserveCalls).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.flags.get(USER_ID)).toBe(false);
  });

  it("treats an authenticate() crash or a user without a valid id as unauthenticated (401)", async () => {
    const db = makeDb({ [USER_ID]: false });
    for (const authenticate of [
      async () => { throw new Error("auth server down"); },
      async () => ({ user: { id: "not-a-uuid", email: EMAIL, name: "" }, reserve: () => db.reserveFor("not-a-uuid") }),
    ] as WelcomeDeps["authenticate"][]) {
      const { deps, sendEmail } = makeDeps(USERS, db, { authenticate });
      const res = await createWelcomeHandler(deps)(post(TOKEN));
      expect(res.status).toBe(401);
      expect(sendEmail).not.toHaveBeenCalled();
    }
    expect(db.reserveCalls).toEqual([]);
  });

  it("answers the CORS preflight and refuses other methods", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, db);
    expect((await createWelcomeHandler(deps)(new Request("https://fn.local/x", { method: "OPTIONS" }))).status).toBe(200);
    expect((await createWelcomeHandler(deps)(post(TOKEN, { method: "GET" }))).status).toBe(405);
    expect(db.reserveCalls).toEqual([]);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("send-welcome-email · fails closed before the reservation", () => {
  it("answers 503 when e-mail is not configured, WITHOUT spending the reservation", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, db, { emailConfigured: false });
    const res = await createWelcomeHandler(deps)(post(TOKEN));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "email_unavailable" });
    expect(db.reserveCalls).toEqual([]);
    expect(db.flags.get(USER_ID)).toBe(false);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("does not reserve for an account without a usable address (422)", async () => {
    for (const email of [null, "", "  ", "sin-arroba", "a@b.c\r\nBcc: x@y.z"]) {
      const db = makeDb({ [USER_ID]: false });
      const { deps, sendEmail } = makeDeps({ [TOKEN]: { id: USER_ID, email } }, db);
      const res = await createWelcomeHandler(deps)(post(TOKEN));
      expect(res.status).toBe(422);
      expect(db.reserveCalls).toEqual([]);
      expect(sendEmail).not.toHaveBeenCalled();
    }
  });
});

describe("send-welcome-email · atomic reservation", () => {
  it("answers 503 and sends nothing when the reservation errors; the detail never reaches the response", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, db, {
      authenticate: async () => ({
        user: { id: USER_ID, email: EMAIL, name: "" },
        reserve: async () => { throw new Error(`permission denied for table profiles (${EMAIL})`); },
      }),
    });
    const res = await createWelcomeHandler(deps)(post(TOKEN));
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "unavailable" });
    expect(text).not.toContain(EMAIL);
    expect(text).not.toContain("permission denied");
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("skips (200, skipped) and sends nothing when the reservation matches 0 rows", async () => {
    for (const rows of [{ [USER_ID]: true }, {}]) { // already sent, or no profile row at all
      const db = makeDb(rows);
      const { deps, sendEmail } = makeDeps(USERS, db);
      const res = await createWelcomeHandler(deps)(post(TOKEN));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, skipped: true });
      expect(db.reserveCalls).toEqual([USER_ID]);
      expect(sendEmail).not.toHaveBeenCalled();
    }
  });

  it("sends exactly one e-mail to the caller's own address, with Idempotency-Key welcome/<uuid>", async () => {
    const db = makeDb({ [USER_ID]: false, [OTHER_ID]: false });
    const { deps, sent } = makeDeps(USERS, db);
    const res = await createWelcomeHandler(deps)(post(TOKEN));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(EMAIL);
    expect(sent[0].subject).toBe(WELCOME_SUBJECT);
    expect(sent[0].html).toBe(welcomeHtml(EMAIL, "María Fernanda"));
    expect(sent[0].idempotencyKey).toBe(`welcome/${USER_ID}`);
    expect(welcomeIdempotencyKey(USER_ID)).toBe(`welcome/${USER_ID}`);
    // The key is built from the id only: no address, no part of it.
    expect(sent[0].idempotencyKey).not.toContain("@");
    expect(sent[0].idempotencyKey).not.toContain(EMAIL.split("@")[0]);
    // Only the caller's row was reserved; the other account is untouched.
    expect(db.reserveCalls).toEqual([USER_ID]);
    expect(db.flags.get(USER_ID)).toBe(true);
    expect(db.flags.get(OTHER_ID)).toBe(false);
  });

  it("ignores a recipient or name smuggled in the body", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sent } = makeDeps(USERS, db);
    await createWelcomeHandler(deps)(post(TOKEN, { body: { to: "victima@evil.test", email: "victima@evil.test", name: "<b>x</b>" } }));
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(EMAIL);
    expect(sent[0].html).not.toContain("evil.test");
  });

  it("a second call after a successful send is skipped", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sent } = makeDeps(USERS, db);
    const handle = createWelcomeHandler(deps);
    expect((await handle(post(TOKEN))).status).toBe(200);
    const again = await handle(post(TOKEN));
    expect(await again.json()).toEqual({ ok: true, skipped: true });
    expect(sent).toHaveLength(1);
  });

  it("two simultaneous calls send one e-mail (the WHERE … = false lets only one reserve)", async () => {
    const db = makeDb({ [USER_ID]: false });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    // The first send stays in flight while the second request runs: the classic read-then-send race window.
    const sendEmail = vi.fn(async () => { await gate; });
    const { deps } = makeDeps(USERS, db, { sendEmail });
    const handle = createWelcomeHandler(deps);
    const both = Promise.all([handle(post(TOKEN)), handle(post(TOKEN))]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    release();
    const bodies = await Promise.all((await both).map((r) => r.json()));
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(db.reserveCalls).toEqual([USER_ID, USER_ID]);
    expect(bodies).toEqual(expect.arrayContaining([{ ok: true }, { ok: true, skipped: true }]));
  });

  it("control: a read-then-mark double (the old index.ts pattern) WOULD send twice, so the race above is real", async () => {
    const flags = new Map([[USER_ID, false]]);
    const sendEmail = vi.fn(async () => {});
    const { deps } = makeDeps(USERS, makeDb({}), {
      sendEmail,
      authenticate: async () => ({
        user: { id: USER_ID, email: EMAIL, name: "" },
        reserve: async () => {
          const seen = flags.get(USER_ID); // SELECT welcome_email_sent …
          await new Promise((resolve) => setTimeout(resolve, 0));
          flags.set(USER_ID, true); // … later, an unconditional UPDATE
          return seen === false ? "reserved" : "already_sent";
        },
      }),
    });
    const handle = createWelcomeHandler(deps);
    await Promise.all([handle(post(TOKEN)), handle(post(TOKEN))]);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("a burst of ten parallel calls still sends one e-mail", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, db);
    const handle = createWelcomeHandler(deps);
    const responses = await Promise.all(Array.from({ length: 10 }, () => handle(post(TOKEN))));
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

type Step = [method: string, ...args: unknown[]];
type Answer = { data: unknown; error: unknown };

/**
 * Fake supabase-js client for reserveWelcome. It records every builder step and, when the chain ends in select(), runs
 * it against an in-memory `profiles` table the way PostgREST would: UPDATE … SET <values> WHERE <every eq> RETURNING
 * <columns>. A dropped filter therefore shows twice: in the recorded steps and in the outcome (a row that is already
 * true matches again). `answer` replaces the table's answer (a PostgREST error, an odd body); `crash` rejects instead.
 */
function makeProfilesClient(rows: Record<string, boolean>, fault: { answer?: Answer; crash?: Error } = {}) {
  const table = new Map(Object.entries(rows));
  const steps: Step[] = [];
  let executions = 0;
  const client: ReservationClient = {
    from(name) {
      steps.push(["from", name]);
      const filters: Array<[string, unknown]> = [];
      let values: Record<string, unknown> = {};
      const query: ReservationQuery = {
        eq(column, value) {
          steps.push(["eq", column, value]);
          filters.push([column, value]);
          return query;
        },
        async select(columns): Promise<Answer> {
          steps.push(["select", columns]);
          executions++;
          if (fault.crash) throw fault.crash;
          if (fault.answer) return fault.answer;
          const updated: Array<Record<string, unknown>> = [];
          for (const [id, flag] of table) {
            const row: Record<string, unknown> = { id, welcome_email_sent: flag };
            if (!filters.every(([column, value]) => row[column] === value)) continue;
            Object.assign(row, values);
            table.set(id, row.welcome_email_sent as boolean);
            updated.push({ [columns]: row[columns] });
          }
          return { data: updated, error: null };
        },
      };
      return {
        update(newValues) {
          steps.push(["update", newValues]);
          values = newValues;
          return query;
        },
      };
    },
  };
  return { client, steps, table, executions: () => executions };
}

describe("send-welcome-email · reserveWelcome (the statement index.ts runs)", () => {
  it("builds exactly UPDATE profiles SET welcome_email_sent = true WHERE id = <uid> AND welcome_email_sent = false RETURNING id", async () => {
    const db = makeProfilesClient({ [USER_ID]: false });
    await reserveWelcome(db.client, USER_ID);
    expect(db.steps).toEqual([
      ["from", "profiles"],
      ["update", { welcome_email_sent: true }],
      ["eq", "id", USER_ID],
      ["eq", "welcome_email_sent", false],
      ["select", "id"],
    ]);
    expect(db.executions()).toBe(1); // one statement, not a read followed by a write
  });

  it("1 row → reserved; the next call on the same row matches 0 rows → already_sent; other rows are untouched", async () => {
    const db = makeProfilesClient({ [USER_ID]: false, [OTHER_ID]: false });
    expect(await reserveWelcome(db.client, USER_ID)).toBe("reserved");
    expect(db.table.get(USER_ID)).toBe(true);
    expect(await reserveWelcome(db.client, USER_ID)).toBe("already_sent");
    expect(await reserveWelcome(db.client, USER_ID)).toBe("already_sent");
    expect(db.table.get(OTHER_ID)).toBe(false);
  });

  it("0 rows because the flag is already true, or because there is no profile row → already_sent", async () => {
    expect(await reserveWelcome(makeProfilesClient({ [USER_ID]: true }).client, USER_ID)).toBe("already_sent");
    expect(await reserveWelcome(makeProfilesClient({}).client, USER_ID)).toBe("already_sent");
  });

  it("a PostgREST error, a transport crash or an answer that is not a list throws a generic error, without the detail", async () => {
    const detail = `permission denied for table profiles (${EMAIL})`;
    for (const fault of [
      { answer: { data: null, error: { code: "42501", message: detail } } },
      { answer: { data: [{ id: USER_ID }], error: { code: "PGRST116", message: detail } } }, // error wins over rows
      { answer: { data: null, error: null } },
      { answer: { data: { id: USER_ID }, error: null } },
      { crash: new Error(`fetch failed: ${detail}`) },
    ]) {
      const db = makeProfilesClient({ [USER_ID]: false }, fault);
      const error = await reserveWelcome(db.client, USER_ID).then(() => null, (e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe("welcome reservation failed");
      expect(db.executions()).toBe(1);
    }
  });

  it("wired like index.ts (reserve = reserveWelcome(client, user.id)): one e-mail, then skipped", async () => {
    const db = makeProfilesClient({ [USER_ID]: false });
    const { deps, sendEmail } = makeDeps(USERS, makeDb({}), {
      authenticate: async (token) => (token === TOKEN
        ? { user: { id: USER_ID, email: EMAIL, name: "" }, reserve: () => reserveWelcome(db.client, USER_ID) }
        : null),
    });
    const handle = createWelcomeHandler(deps);
    expect(await (await handle(post(TOKEN))).json()).toEqual({ ok: true });
    expect(await (await handle(post(TOKEN))).json()).toEqual({ ok: true, skipped: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(db.table.get(USER_ID)).toBe(true);
  });
});

describe("send-welcome-email · Resend failure after the reservation", () => {
  const LEAK = `Resend 403 — You can only send testing emails to your own email address (${EMAIL}); key re_live_secret123`;

  it("answers a generic 502 without the provider's message", async () => {
    const db = makeDb({ [USER_ID]: false });
    const { deps } = makeDeps(USERS, db, { sendEmail: async () => { throw new Error(LEAK); } });
    const res = await createWelcomeHandler(deps)(post(TOKEN));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "send_failed" });
    for (const fragment of [EMAIL, "re_live_secret123", "Resend", "testing emails"]) expect(text).not.toContain(fragment);
  });

  it("keeps the flag reserved and does NOT retry: at most once, never twice", async () => {
    const db = makeDb({ [USER_ID]: false });
    const sendEmail = vi.fn(async () => { throw new Error(LEAK); });
    const { deps } = makeDeps(USERS, db, { sendEmail });
    const handle = createWelcomeHandler(deps);
    expect((await handle(post(TOKEN))).status).toBe(502);
    expect(db.flags.get(USER_ID)).toBe(true);
    const again = await handle(post(TOKEN));
    expect(await again.json()).toEqual({ ok: true, skipped: true });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});

describe("send-welcome-email · logs", () => {
  it("never log the address, the IP or the token, in any outcome", async () => {
    const log = vi.fn();
    const scenarios: Array<[Partial<WelcomeDeps>, Record<string, boolean>, string | undefined]> = [
      [{}, { [USER_ID]: false }, TOKEN], // sent
      [{}, { [USER_ID]: true }, TOKEN], // skipped
      [{}, { [USER_ID]: false }, "forged.jwt.value"], // rejected
      [{}, { [USER_ID]: false }, undefined], // no Authorization
      [{ emailConfigured: false }, { [USER_ID]: false }, TOKEN], // misconfigured
      [{ sendEmail: async () => { throw new Error(`Resend 422 — ${EMAIL} ${CLIENT_IP} ${TOKEN}`); } }, { [USER_ID]: false }, TOKEN],
      [{
        authenticate: async () => ({
          user: { id: USER_ID, email: EMAIL, name: "" },
          reserve: async () => { throw new Error(`db error for ${EMAIL} from ${CLIENT_IP}`); },
        }),
      }, { [USER_ID]: false }, TOKEN],
      [{ authenticate: async () => ({ user: { id: USER_ID, email: "", name: "" }, reserve: async () => "reserved" as const }) }, {}, TOKEN],
    ];
    for (const [overrides, rows, token] of scenarios) {
      const { deps } = makeDeps(USERS, makeDb(rows), { ...overrides, log });
      await createWelcomeHandler(deps)(post(token));
    }
    const events = log.mock.calls.map(([event]) => event);
    expect(events).toEqual(expect.arrayContaining([
      "sent", "skipped", "rejected", "misconfigured", "send_failed", "reserve_failed",
    ]));
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("@");
    expect(logged).not.toContain(EMAIL.split("@")[0]);
    expect(logged).not.toContain(CLIENT_IP);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain("session-del-cliente");
  });
});
