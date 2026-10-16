// @vitest-environment node
/**
 * S3 regression suite — send-auth-email only acts on requests signed by
 * Supabase Auth. Signatures are produced with node:crypto (independent of the
 * implementation under test); Resend is a spy, nothing is ever sent.
 */
import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";
import { createAuthEmailHandler, type AuthEmail, type AuthEmailDeps } from "./handler.ts";

const KEY = Buffer.from("multistack-hook-secret-for-tests!");
const SECRET = `v1,whsec_${KEY.toString("base64")}`;
const NOW = Date.parse("2026-10-14T12:00:00Z");
const TS = String(Math.floor(NOW / 1000));
const SUPABASE_URL = "https://ckyqrdemgssbrqfnkxsr.supabase.co";

function payload(action = "signup", overrides: Record<string, unknown> = {}) {
  return {
    user: { id: "u1", email: "nuevo@cliente.com" },
    email_data: {
      token: "123456",
      token_hash: "pkce_4f0e2b9c1a",
      redirect_to: "https://www.multistacksystems.com/auth/callback",
      email_action_type: action,
      site_url: "https://www.multistacksystems.com",
      token_new: "",
      token_hash_new: "",
      ...overrides,
    },
  };
}

function sign(body: string, id = "msg_1", ts = TS, key = KEY) {
  return `v1,${createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

function hookRequest(body: string, opts: { signature?: string | null; id?: string; ts?: string } = {}) {
  const id = opts.id ?? "msg_1";
  const ts = opts.ts ?? TS;
  const h: Record<string, string> = { "Content-Type": "application/json", "webhook-id": id, "webhook-timestamp": ts };
  const signature = opts.signature === undefined ? sign(body, id, ts) : opts.signature;
  if (signature !== null) h["webhook-signature"] = signature;
  return new Request("https://fn.local/send-auth-email", { method: "POST", headers: h, body });
}

function setup(overrides: Partial<AuthEmailDeps> = {}) {
  const sent: AuthEmail[] = [];
  const sendEmail = vi.fn(async (e: AuthEmail) => { sent.push(e); });
  const log = vi.fn();
  const handler = createAuthEmailHandler({
    hookSecret: SECRET,
    emailConfigured: true,
    supabaseUrl: SUPABASE_URL,
    sendEmail,
    now: () => NOW,
    log,
    ...overrides,
  });
  return { handler, sent, sendEmail, log };
}

const bodyOf = (p: unknown) => JSON.stringify(p);

describe("send-auth-email · signed requests (legit Supabase Auth)", () => {
  it("signup → branded confirmation e-mail to the user", async () => {
    const { handler, sent } = setup();
    const res = await handler(hookRequest(bodyOf(payload("signup"))));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("nuevo@cliente.com");
    expect(sent[0].subject).toBe("Confirmá tu cuenta — MultiStack Systems");
    // Template preserved: brand markers + escaped verify link
    expect(sent[0].html).toContain("[ CONFIRM_SIGNUP ]");
    expect(sent[0].html).toContain("[ CONFIRMAR CUENTA ]");
    expect(sent[0].html).toContain("https://multistacksystems.com/logo-white.png");
    expect(sent[0].html).toContain(
      'href="https://ckyqrdemgssbrqfnkxsr.supabase.co/auth/v1/verify?token=pkce_4f0e2b9c1a&amp;type=signup&amp;redirect_to=https%3A%2F%2Fwww.multistacksystems.com%2Fauth%2Fcallback"',
    );
  });

  it("recovery → password reset e-mail", async () => {
    const { handler, sent } = setup();
    const res = await handler(hookRequest(bodyOf(payload("recovery"))));
    expect(res.status).toBe(200);
    expect(sent[0].subject).toBe("Recuperar contraseña — MultiStack Systems");
    expect(sent[0].html).toContain("[ RESET_PASSWORD ]");
    expect(sent[0].html).toContain("type=recovery");
  });

  it("invite → invitation e-mail (confirmation template)", async () => {
    const { handler, sent } = setup();
    await handler(hookRequest(bodyOf(payload("invite"))));
    expect(sent[0].subject).toBe("Fuiste invitado a MultiStack Systems");
    expect(sent[0].html).toContain("type=invite");
  });

  it("actions without a template are acknowledged without e-mail (unchanged)", async () => {
    for (const action of ["magiclink", "email_change", "reauthentication", "password_changed_notification"]) {
      const { handler, sendEmail } = setup();
      const res = await handler(hookRequest(bodyOf(payload(action))));
      expect(res.status).toBe(200);
      expect(sendEmail).not.toHaveBeenCalled();
    }
  });

  it("falls back to site_url when redirect_to is empty, drops non-http redirects", async () => {
    const { handler, sent } = setup();
    await handler(hookRequest(bodyOf(payload("signup", { redirect_to: "" }))));
    // `"` closes the href attribute right after the parameter value
    expect(sent[0].html).toContain('redirect_to=https%3A%2F%2Fwww.multistacksystems.com"');

    const second = setup();
    await second.handler(hookRequest(bodyOf(payload("signup", { redirect_to: "javascript:alert(1)", site_url: "" }))));
    expect(second.sent[0].html).not.toContain("javascript");
    expect(second.sent[0].html).toContain('redirect_to="');
  });
});

describe("send-auth-email · forged requests are rejected without sending", () => {
  const expectRejected = async (res: Response, status: number, sendEmail: ReturnType<typeof vi.fn>) => {
    expect(res.status).toBe(status);
    const json = await res.json();
    expect(json.error.http_code).toBe(status);
    expect(typeof json.error.message).toBe("string");
    expect(sendEmail).not.toHaveBeenCalled();
  };

  it("missing signature → 401", async () => {
    const { handler, sendEmail } = setup();
    await expectRejected(await handler(hookRequest(bodyOf(payload()), { signature: null })), 401, sendEmail);
  });

  it("signature made with another secret → 401", async () => {
    const { handler, sendEmail } = setup();
    const body = bodyOf(payload());
    const forged = sign(body, "msg_1", TS, Buffer.from("attacker-guessed-secret-32-bytes"));
    await expectRejected(await handler(hookRequest(body, { signature: forged })), 401, sendEmail);
  });

  it("payload altered after signing (recipient swapped) → 401", async () => {
    const { handler, sendEmail } = setup();
    const original = bodyOf(payload());
    const tampered = original.replace("nuevo@cliente.com", "victim@evil.test");
    await expectRejected(await handler(hookRequest(tampered, { signature: sign(original) })), 401, sendEmail);
  });

  it("replayed request outside the 5-minute window → 401", async () => {
    const { handler, sendEmail } = setup();
    const old = String(Number(TS) - 600);
    const body = bodyOf(payload());
    await expectRejected(await handler(hookRequest(body, { ts: old, signature: sign(body, "msg_1", old) })), 401, sendEmail);
  });

  it("the pre-fix attack (unsigned JSON with any recipient) → 401", async () => {
    const { handler, sendEmail } = setup();
    const req = new Request("https://fn.local/send-auth-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyOf(payload("recovery", { redirect_to: "https://evil.test" })),
    });
    await expectRejected(await handler(req), 401, sendEmail);
  });

  it("non-POST → 405", async () => {
    const { handler, sendEmail } = setup();
    await expectRejected(await handler(new Request("https://fn.local/x", { method: "GET" })), 405, sendEmail);
  });

  it("oversized body → 413", async () => {
    const { handler, sendEmail } = setup();
    const big = bodyOf({ ...payload(), pad: "x".repeat(70 * 1024) });
    await expectRejected(await handler(hookRequest(big)), 413, sendEmail);
  });
});

describe("send-auth-email · signed but malformed payloads → 400", () => {
  const cases: Array<[string, string]> = [
    ["not JSON", "{oops"],
    ["empty object", "{}"],
    ["no user", bodyOf({ email_data: payload().email_data })],
    ["invalid e-mail", bodyOf({ ...payload(), user: { email: "<script>@x" } })],
    ["no token_hash", bodyOf(payload("signup", { token_hash: "" }))],
    ["token_hash with markup", bodyOf(payload("signup", { token_hash: '"><img src=x>' }))],
    ["unknown action format", bodyOf(payload("SIGNUP<b>"))],
  ];
  it.each(cases)("%s", async (_label, body) => {
    const { handler, sendEmail } = setup();
    const res = await handler(hookRequest(body));
    expect(res.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("send-auth-email · configuration and failures", () => {
  it("missing SEND_EMAIL_HOOK_SECRET → 500, fails closed even for 'valid-looking' requests", async () => {
    const { handler, sendEmail } = setup({ hookSecret: "" });
    const res = await handler(hookRequest(bodyOf(payload())));
    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("malformed secret → 500 (misconfiguration, not 'bad signature')", async () => {
    const { handler, sendEmail } = setup({ hookSecret: "v1,whsec_%%%" });
    const res = await handler(hookRequest(bodyOf(payload())));
    expect(res.status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("missing RESEND_API_KEY is only revealed to signed callers", async () => {
    const { handler, sendEmail } = setup({ emailConfigured: false });
    expect((await handler(hookRequest(bodyOf(payload()), { signature: null }))).status).toBe(401);
    expect((await handler(hookRequest(bodyOf(payload())))).status).toBe(500);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("Resend failure → generic 500 without internals", async () => {
    const { handler } = setup({
      sendEmail: async () => { throw new Error("Resend 403: nuevo@cliente.com, key re_live_secret"); },
    });
    const res = await handler(hookRequest(bodyOf(payload())));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("nuevo@cliente.com");
    expect(text).not.toContain("re_live_secret");
  });

  it("never logs e-mail addresses or token hashes", async () => {
    const { handler, log } = setup();
    await handler(hookRequest(bodyOf(payload())));
    await handler(hookRequest(bodyOf(payload()), { signature: null }));
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain("@");
    expect(logged).not.toContain("pkce_4f0e2b9c1a");
  });
});
