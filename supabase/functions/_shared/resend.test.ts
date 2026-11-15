// @vitest-environment node
/**
 * _shared/resend.ts (used by send-welcome-email and send-contact-email): rule 5 of CLAUDE.md, no recipient, sender,
 * subject, key or other personal data in the logs, a redacted, structured error, and the optional Idempotency-Key. The
 * module reads Deno.env when it loads, so every test stubs `Deno` and `fetch` and imports a fresh copy. Nothing reaches
 * the network.
 */
import { inspect } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createContactHandler, type ContactStore } from "../send-contact-email/handler";
import { contactSubject } from "../send-contact-email/templates";

const RECIPIENT = "destinatario.privado@example.com";
const OWNER = "owner@example.invalid";
const SENDER_ADDRESS = "remitente@mail.example.test";
const SENDER = `Remitente Prueba <${SENDER_ADDRESS}>`;
const VISITOR_REPLY_TO = "visitante@correo.example.test";
const API_KEY = "re_test_key_abcdef123456";
const VISITOR_NAME = "Ana Pérez Visitante";
const USER_ID = "3f2c9a1e-5b7d-4c8e-9f01-23456789abcd";

const CONSOLE_METHODS = ["log", "error", "warn", "info", "debug", "trace"] as const;
type ConsoleMethod = (typeof CONSOLE_METHODS)[number];

interface FetchCall {
  url: string;
  init: RequestInit;
}

interface ConsoleCall {
  method: ConsoleMethod;
  text: string;
}

/** Every argument as the console would print it (objects and errors too), so nothing hides behind "[object Object]". */
const printed = (args: unknown[]) =>
  args.map((arg) => (typeof arg === "string" ? arg : inspect(arg, { depth: 10, breakLength: Infinity }))).join(" ");

async function loadResend(respond: () => Response, env: Record<string, string | undefined> = { RESEND_API_KEY: API_KEY }) {
  vi.resetModules();
  vi.stubGlobal("Deno", { env: { get: (name: string) => env[name] } });
  const calls: FetchCall[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }));
  const logs: string[] = [];
  const consoleCalls: ConsoleCall[] = [];
  for (const method of CONSOLE_METHODS) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      const text = printed(args);
      logs.push(text);
      consoleCalls.push({ method, text });
    });
  }
  const mod = await import("./resend.ts");
  return { mod, calls, logs, consoleCalls };
}

const ok = () => new Response(JSON.stringify({ id: "email-id-123" }), { status: 200, headers: { "Content-Type": "application/json" } });
const resendError = (status: number, body: unknown) =>
  () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

const headersOf = (call: FetchCall) => call.init.headers as Record<string, string>;
const message = { to: RECIPIENT, subject: `Mensaje web de ${VISITOR_NAME}`, html: "<p>hola</p>" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("_shared/resend · logs carry no personal data (rule 5)", () => {
  it("a successful send logs neither the recipient, the sender, the subject nor the key", async () => {
    const { mod, calls, logs } = await loadResend(ok);
    await mod.sendEmail(message);
    expect(calls).toHaveLength(1);
    expect(logs.length).toBeGreaterThan(0);
    const text = logs.join("\n");
    for (const fragment of ["@", RECIPIENT, VISITOR_NAME, "Mensaje web", API_KEY]) expect(text).not.toContain(fragment);
    expect(text).toContain("email-id-123"); // the provider's id stays: it is how a send is traced
  });

  it("a Resend error that echoes an address is redacted in the log AND in the thrown error", async () => {
    const { mod, logs } = await loadResend(resendError(403, {
      statusCode: 403,
      name: "validation_error",
      message: `You can only send testing emails to your own email address (${OWNER}).`,
    }));
    const error = await mod.sendEmail(message).then(() => null, (e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    // Diagnostic value kept: status, Resend's error name and the redacted text.
    expect(error!.message).toContain("Resend 403");
    expect(error!.message).toContain("validation_error");
    expect(error!.message).toContain("[address]");
    for (const text of [error!.message, logs.join("\n")]) {
      for (const fragment of ["@", OWNER, RECIPIENT, VISITOR_NAME, API_KEY]) expect(text).not.toContain(fragment);
    }
  });

  it("a non-JSON error body is redacted too (addresses, key-like tokens, line breaks)", async () => {
    const { mod, logs } = await loadResend(resendError(500, `upstream failed for ${RECIPIENT}\r\nkey ${API_KEY}`));
    const error = await mod.sendEmail(message).then(() => null, (e: Error) => e);
    expect(error!.message).toBe("Resend 500 — upstream failed for [address] key [key]");
    for (const line of logs) expect(line).not.toMatch(/@|re_test_key|[\r\n]/);
  });

  it("redactProviderDetail strips addresses and keys, joins lines and caps the length", async () => {
    const { mod } = await loadResend(ok);
    expect(mod.redactProviderDetail(`a <${OWNER}>, b ${RECIPIENT}\nre_live_123456789 done`))
      .toBe("a <[address]>, b [address] [key] done");
    expect(mod.redactProviderDetail("x".repeat(1000))).toHaveLength(200);
  });

  it("a 100 000-character body is redacted fast and still loses its addresses (linear pass over the first 4 KB)", async () => {
    const { mod } = await loadResend(ok);
    const huge = 100_000;
    const bodies: Array<[string, string]> = [
      // No separator and no "@": the shape that makes a backtracking address pattern retry from every position.
      ["a".repeat(huge), ""],
      [`${OWNER} ${"b".repeat(huge)}`, "[address]"],
      [`error for ${RECIPIENT}: ${"c ".repeat(huge / 2)}`, "error for [address]"],
      ["d@".repeat(huge / 2), ""],
    ];
    const started = performance.now();
    const redacted = bodies.map(([body]) => mod.redactProviderDetail(body));
    const elapsed = performance.now() - started;
    expect(elapsed).toBeLessThan(200);
    bodies.forEach(([, expected], i) => {
      expect(redacted[i].startsWith(expected)).toBe(true);
      expect(redacted[i]).not.toContain("@");
      expect(redacted[i].length).toBeLessThanOrEqual(200);
    });
  });

  it("a long local part is replaced whole, and a token split by the 4 KB cut is dropped, not shown in part", async () => {
    const { mod } = await loadResend(ok);
    expect(mod.redactProviderDetail(`to ${"x".repeat(100)}@example.com.`)).toBe("to [address]");
    // The cut falls inside the recipient's local part: its "@" lies past the cut, so the fragment must go too.
    const split = mod.redactProviderDetail(`${"\n".repeat(4090)}${RECIPIENT} tail`);
    expect(split).toBe("");
    // A token that ends exactly at the cut is whole: it is kept, and redacted.
    expect(mod.redactProviderDetail(`${" ".repeat(4096 - RECIPIENT.length)}${RECIPIENT} tail`)).toBe("[address]");
  });

  it("a huge Resend error body reaches the log and the thrown error redacted, in one line", async () => {
    const { mod, logs } = await loadResend(resendError(500, `rejected ${RECIPIENT}\n${"z".repeat(100_000)}`));
    const started = performance.now();
    const error = await mod.sendEmail(message).then(() => null, (e: Error) => e);
    expect(performance.now() - started).toBeLessThan(200);
    expect(error!.message).toBe("Resend 500 — rejected [address]");
    for (const line of logs) expect(line).not.toMatch(/@|destinatario|[\r\n]/);
  });
});

describe("_shared/resend · no console.* call carries personal data or the key", () => {
  it("in a failed and in a successful send, no call contains the recipient, the sender, the reply-to, the subject or the key", async () => {
    const opts = { ...message, from: SENDER, replyTo: VISITOR_REPLY_TO };
    // A FROM_EMAIL outside our sending domains is logged when the module loads: only the reason, never the value.
    const foreignFromEmail = "Ajeno <ajeno@foreign.example.test>";
    const forbidden = [RECIPIENT, SENDER, SENDER_ADDRESS, VISITOR_REPLY_TO, message.subject, VISITOR_NAME, API_KEY, foreignFromEmail];

    // Failed: the worst case Resend's error bodies can take, echoing every address of the request and the key.
    const failed = await loadResend(
      resendError(422, {
        name: "validation_error",
        message: `Rejected from ${SENDER_ADDRESS} to <${RECIPIENT}> reply ${VISITOR_REPLY_TO}; key ${API_KEY}`,
      }),
      { RESEND_API_KEY: API_KEY, FROM_EMAIL: foreignFromEmail },
    );
    const error = await failed.mod.sendEmail(opts).then(() => null, (e: Error) => e);
    expect(error!.message).toMatch(/^Resend 422 — validation_error: /);

    // Successful: with an explicit sender and reply-to, and with the module's default sender.
    const sent = await loadResend(ok);
    await sent.mod.sendEmail(opts);
    await sent.mod.sendEmail(message);
    expect(sent.calls).toHaveLength(2);

    for (const fragment of [...forbidden, sent.mod.FROM_VERIFIED]) {
      expect(error!.message).not.toContain(fragment);
      for (const { method, text } of [...failed.consoleCalls, ...sent.consoleCalls]) {
        expect(text, `console.${method}: ${text}`).not.toContain(fragment);
      }
    }
    for (const { method, text } of [...failed.consoleCalls, ...sent.consoleCalls]) {
      expect(text, `console.${method}: ${text}`).not.toContain("@");
    }

    // Not vacuous: both sends did log, through the methods that the checks above went over.
    expect(failed.consoleCalls.some(({ method, text }) => method === "error" && text.includes("FROM_EMAIL foreign-domain"))).toBe(true);
    expect(failed.consoleCalls.some(({ method, text }) => method === "error" && text.includes("HTTP 422"))).toBe(true);
    expect(sent.consoleCalls.filter(({ method, text }) => method === "log" && text.includes("email-id-123"))).toHaveLength(2);
  });
});

describe("_shared/resend · structured error (ResendError)", () => {
  it("throws a ResendError with the HTTP status and Resend's code; the message keeps its shape, with a \"name: message\" detail", async () => {
    const { mod } = await loadResend(resendError(429, { statusCode: 429, name: "rate_limit_exceeded", message: "Too many requests" }));
    const error = await mod.sendEmail(message).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(mod.ResendError);
    expect(error).toBeInstanceOf(Error); // send-contact-email keeps logging it as before
    const { httpStatus, providerCode, message: text } = error as InstanceType<typeof mod.ResendError>;
    expect(httpStatus).toBe(429);
    expect(providerCode).toBe("rate_limit_exceeded");
    expect(text).toBe("Resend 429 — rate_limit_exceeded: Too many requests");
  });

  it("an error with an empty body still throws a ResendError, with \"no detail\" in place of the detail", async () => {
    const { mod, logs } = await loadResend(resendError(502, ""));
    const error = await mod.sendEmail(message).then(() => null, (e: unknown) => e) as InstanceType<typeof mod.ResendError>;
    expect(error).toBeInstanceOf(mod.ResendError);
    expect(error.message).toBe("Resend 502 — no detail");
    expect(error.httpStatus).toBe(502);
    expect(error.providerCode).toBeNull();
    expect(logs).toContain("[resend] ❌ HTTP 502: no detail");
  });

  it("keeps the code only when it has Resend's snake_case shape, never an address, a name or free text", async () => {
    const cases: Array<[body: unknown, code: string | null]> = [
      [{ name: "daily_quota_exceeded", message: "x" }, "daily_quota_exceeded"],
      ["upstream failed", null], // not JSON
      [{ message: "no name" }, null],
      [{ name: 42, message: "x" }, null],
      [{ name: `validation_error ${RECIPIENT}`, message: "x" }, null],
      [{ name: RECIPIENT, message: "x" }, null],
      [{ name: VISITOR_NAME, message: "x" }, null],
      [{ name: "maria", message: "x" }, null], // one word, as a first name would be
      [{ name: "validation_error\n", message: "x" }, null],
      [{ name: `a_${"b".repeat(63)}`, message: "x" }, null], // longer than 64 characters
    ];
    for (const [body, code] of cases) {
      const { mod } = await loadResend(resendError(422, body));
      const error = await mod.sendEmail(message).then(() => null, (e: unknown) => e) as InstanceType<typeof mod.ResendError>;
      expect(error).toBeInstanceOf(mod.ResendError);
      expect(error.httpStatus).toBe(422);
      expect(error.providerCode).toBe(code);
    }
  });

  it("a refusal before any request (no RESEND_API_KEY) is a plain error: no HTTP status to report", async () => {
    const { mod, calls } = await loadResend(ok, {});
    const error = await mod.sendEmail(message).then(() => null, (e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(mod.ResendError);
    expect(error).not.toHaveProperty("httpStatus");
    expect(calls).toHaveLength(0);
  });
});

describe("_shared/resend · the request", () => {
  it("is the request it always was: POST to Resend, the payload as given, only the Authorization and Content-Type headers", async () => {
    const { mod, calls } = await loadResend(ok);
    await mod.sendEmail({ ...message, from: mod.FROM_DEV, replyTo: VISITOR_REPLY_TO });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(calls[0])).toEqual({ Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" });
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      from: mod.FROM_DEV,
      to: RECIPIENT,
      subject: message.subject,
      html: message.html,
      reply_to: VISITOR_REPLY_TO,
    });
  });

  it("a 2xx answer without a JSON body still counts as sent: the e-mail went out, so it must not throw", async () => {
    const { mod, calls, logs } = await loadResend(() => new Response("accepted", { status: 200 }));
    await expect(mod.sendEmail(message)).resolves.toBeUndefined();
    expect(calls).toHaveLength(1);
    expect(logs.some((line) => line.includes("Sent. ID: unknown"))).toBe(true);
  });
});

describe("_shared/resend · Idempotency-Key", () => {
  it("sends the header when idempotencyKey is given", async () => {
    const { mod, calls } = await loadResend(ok);
    await mod.sendEmail({ ...message, idempotencyKey: `welcome/${USER_ID}` });
    expect(headersOf(calls[0])["Idempotency-Key"]).toBe(`welcome/${USER_ID}`);
    expect(headersOf(calls[0]).Authorization).toBe(`Bearer ${API_KEY}`);
  });

  it("without it the request is exactly as before (send-contact-email keeps working unchanged)", async () => {
    const { mod, calls } = await loadResend(ok);
    await mod.sendEmail({ ...message, from: mod.FROM_DEV, replyTo: "soporte@multistacksystems.com" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].init.method).toBe("POST");
    expect(Object.keys(headersOf(calls[0])).sort()).toEqual(["Authorization", "Content-Type"]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      from: mod.FROM_DEV,
      to: RECIPIENT,
      subject: message.subject,
      html: message.html,
      reply_to: "soporte@multistacksystems.com",
    });
  });

  it("refuses an unsafe key before sending, without echoing it", async () => {
    for (const key of ["", `welcome/${RECIPIENT}`, "a".repeat(257), "welcome/x\r\nBcc: y", "tab\there"]) {
      const { mod, calls, logs } = await loadResend(ok);
      await expect(mod.sendEmail({ ...message, idempotencyKey: key })).rejects.toThrow("invalid idempotency key");
      expect(calls).toHaveLength(0);
      if (key) expect(logs.join("\n")).not.toContain(key);
    }
  });

  it("accepts the 256-character limit", async () => {
    const { mod, calls } = await loadResend(ok);
    await mod.sendEmail({ ...message, idempotencyKey: "k".repeat(256) });
    expect(calls).toHaveLength(1);
  });
});

describe("_shared/resend · configuration", () => {
  it("throws without RESEND_API_KEY and never calls Resend", async () => {
    const { mod, calls } = await loadResend(ok, {});
    await expect(mod.sendEmail(message)).rejects.toThrow("RESEND_API_KEY not set");
    expect(calls).toHaveLength(0);
  });
});

describe("_shared/resend · a network failure", () => {
  it("propagates the fetch error as it is and logs no personal data (it is not a ResendError: there is no HTTP status)", async () => {
    const { mod, logs } = await loadResend(ok);
    const networkError = new TypeError("fetch failed");
    vi.stubGlobal("fetch", vi.fn(async () => { throw networkError; }));
    const error = await mod.sendEmail({ ...message, from: SENDER, replyTo: VISITOR_REPLY_TO }).then(() => null, (e: unknown) => e);
    expect(error).toBe(networkError);
    expect(error).not.toBeInstanceOf(mod.ResendError);
    expect(logs.length).toBeGreaterThan(0); // the "sending" line was logged before the attempt
    for (const fragment of ["@", RECIPIENT, SENDER_ADDRESS, VISITOR_REPLY_TO, message.subject, VISITOR_NAME, API_KEY]) {
      for (const line of logs) expect(line).not.toContain(fragment);
    }
  });
});

describe("_shared/resend · wired into send-contact-email, as index.ts wires it", () => {
  const TEAM = "equipo@example.test";
  const TEAM_FROM = "MultiStack <soporte@mail.example.test>";
  const GENERIC = { error: "No se pudo enviar el mensaje. Intenta de nuevo más tarde." };

  const store: ContactStore = {
    recordAndCount: async () => 1,
    record: async () => {},
    purge: async () => {},
    countLeads: async () => 0,
    insertLead: async () => null,
  };
  const request = () => new Request("https://f.test/", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.7" },
    body: JSON.stringify({ name: VISITOR_NAME, email: "Visitante@Correo.Example.Test", message: "Necesito una web" }),
  });
  async function contact(respond: () => Response) {
    const r = await loadResend(respond);
    const handlerLogs: Array<[string, string]> = [];
    const handle = createContactHandler({
      openStore: () => store,
      secretSource: "SUPABASE_SECRET_KEYS.edge_functions",
      rateSalt: "a".repeat(64),
      resendConfigured: true,
      fromAddress: TEAM_FROM,
      dest: TEAM,
      sendEmail: r.mod.sendEmail,
      log: (level, line) => handlerLogs.push([level, line]),
    });
    return { ...r, handle, handlerLogs };
  }

  it("a correct send reaches Resend with the sender, the team destination, the visitor's reply-to and the subject; nothing personal is logged", async () => {
    const t = await contact(ok);
    const res = await t.handle(request());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(t.calls).toHaveLength(1);
    expect(t.calls[0].url).toBe("https://api.resend.com/emails");
    const sent = JSON.parse(String(t.calls[0].init.body));
    expect(sent).toMatchObject({
      from: TEAM_FROM,
      to: TEAM,
      reply_to: "visitante@correo.example.test",
      subject: contactSubject(VISITOR_NAME),
    });
    expect(sent.html).toContain("Necesito una web");
    const everyLine = [...t.logs, ...t.handlerLogs.map(([, line]) => line)];
    for (const line of everyLine) {
      for (const fragment of [TEAM, "example.test", VISITOR_NAME, API_KEY, "@"]) expect(line).not.toContain(fragment);
    }
  });

  it("a Resend failure answers the generic 500 and logs the HTTP status and the redacted detail", async () => {
    const t = await contact(resendError(403, {
      statusCode: 403,
      name: "validation_error",
      message: `You can only send testing emails to your own email address (${OWNER}).`,
    }));
    const res = await t.handle(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC);
    const line = t.handlerLogs.find(([level, text]) => level === "error" && text.startsWith("[contact] ❌"))?.[1];
    expect(line).toBeDefined();
    expect(line).toContain("Resend 403");
    expect(line).toContain("validation_error");
    expect(line).toContain("[address]");
    expect(line).not.toMatch(/[\r\n]/);
    for (const text of [line!, ...t.logs]) {
      for (const fragment of ["@", OWNER, TEAM, VISITOR_NAME, API_KEY]) expect(text).not.toContain(fragment);
    }
  });

  it("a network failure also answers the generic 500 with one error line and no personal data", async () => {
    const t = await contact(ok);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
    const res = await t.handle(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(GENERIC);
    const errors = t.handlerLogs.filter(([level]) => level === "error");
    expect(errors).toHaveLength(1);
    for (const line of [errors[0][1], ...t.logs]) {
      for (const fragment of ["@", TEAM, VISITOR_NAME, API_KEY]) expect(line).not.toContain(fragment);
    }
  });
});
