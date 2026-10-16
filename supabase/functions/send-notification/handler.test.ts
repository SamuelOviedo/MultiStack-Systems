// @vitest-environment node
/**
 * S2 regression suite — send-notification must not be an open mail relay.
 * Resend is a spy: no e-mail ever leaves the test.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createNotificationHandler,
  MESSAGE_MAX_AGE_MS,
  type CallerContext,
  type NotificationDeps,
  type NotificationMessage,
  type NotificationTicket,
  type OutgoingEmail,
} from "./handler.ts";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const TICKET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_TICKET_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MESSAGE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const ticket: NotificationTicket = {
  id: TICKET_ID,
  title: "Tienda online",
  client_email: "cliente@example.com",
  project_id: null,
};
const teamMessage: NotificationMessage = {
  id: MESSAGE_ID,
  ticket_id: TICKET_ID,
  sender_type: "team",
  message: "Hola, ya revisamos tu solicitud.",
  created_at: new Date(NOW - 30_000).toISOString(),
};

/**
 * Fake "database": each token maps to a user with a role and the set of
 * tickets RLS would let them see.
 */
interface FakeUser {
  id: string;
  userType: number | null;
  visibleTickets: NotificationTicket[];
  messages?: NotificationMessage[];
}

function makeDeps(users: Record<string, FakeUser>, overrides: Partial<NotificationDeps> = {}) {
  const sent: OutgoingEmail[] = [];
  const sendEmail = vi.fn(async (email: OutgoingEmail) => { sent.push(email); });
  const deps: NotificationDeps = {
    authenticate: async (token): Promise<CallerContext | null> => {
      const user = users[token];
      if (!user) return null;
      return {
        userId: user.id,
        getUserType: async () => user.userType,
        getTicket: async (id) => user.visibleTickets.find((t) => t.id === id) ?? null,
        getMessage: async (id, ticketId) =>
          (user.messages ?? [teamMessage]).find((m) => m.id === id && m.ticket_id === ticketId) ?? null,
      };
    },
    sendEmail,
    siteUrl: "https://www.multistacksystems.com",
    emailConfigured: true,
    now: () => NOW,
    ...overrides,
  };
  return { deps, sent, sendEmail };
}

const USERS: Record<string, FakeUser> = {
  "admin-token": { id: "u-admin", userType: 0, visibleTickets: [ticket] },
  "collab-token": { id: "u-collab", userType: 1, visibleTickets: [ticket] },
  "collab-other-token": { id: "u-collab2", userType: 1, visibleTickets: [] },
  "client-token": { id: "u-client", userType: 2, visibleTickets: [ticket] },
};

function post(body: unknown, token?: string, raw?: string): Request {
  return new Request("https://fn.local/send-notification", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? JSON.stringify(body),
  });
}

const validBody = { type: "team_reply", ticket_id: TICKET_ID, message_id: MESSAGE_ID };

describe("send-notification · authentication", () => {
  let ctx: ReturnType<typeof makeDeps>;
  beforeEach(() => { ctx = makeDeps(USERS); });

  it("rejects requests without Authorization (401) and sends nothing", async () => {
    const res = await createNotificationHandler(ctx.deps)(post(validBody));
    expect(res.status).toBe(401);
    expect(ctx.sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid / forged JWT (401)", async () => {
    const res = await createNotificationHandler(ctx.deps)(post(validBody, "forged.jwt.value"));
    expect(res.status).toBe(401);
    expect(ctx.sendEmail).not.toHaveBeenCalled();
  });

  it("treats an authenticate() crash as unauthenticated (401)", async () => {
    const { deps, sendEmail } = makeDeps(USERS, {
      authenticate: async () => { throw new Error("auth server down"); },
    });
    const res = await createNotificationHandler(deps)(post(validBody, "admin-token"));
    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects non-POST methods", async () => {
    const res = await createNotificationHandler(ctx.deps)(
      new Request("https://fn.local/send-notification", { method: "GET" }),
    );
    expect(res.status).toBe(405);
  });
});

describe("send-notification · authorization", () => {
  it("rejects a client (role 2) even for its own ticket (403)", async () => {
    const { deps, sendEmail } = makeDeps(USERS);
    const res = await createNotificationHandler(deps)(post(validBody, "client-token"));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a user whose role cannot be resolved (403)", async () => {
    const { deps, sendEmail } = makeDeps({ t: { id: "u", userType: null, visibleTickets: [ticket] } });
    const res = await createNotificationHandler(deps)(post(validBody, "t"));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects a collaborator without access to the ticket (404, no oracle)", async () => {
    const { deps, sendEmail } = makeDeps(USERS);
    const res = await createNotificationHandler(deps)(post(validBody, "collab-other-token"));
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("lets an assigned collaborator notify", async () => {
    const { deps, sent } = makeDeps(USERS);
    const res = await createNotificationHandler(deps)(post(validBody, "collab-token"));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
  });

  it("refuses to e-mail a client-authored message (403)", async () => {
    const clientMsg = { ...teamMessage, sender_type: "client" };
    const { deps, sendEmail } = makeDeps({
      a: { id: "u", userType: 0, visibleTickets: [ticket], messages: [clientMsg] },
    });
    const res = await createNotificationHandler(deps)(post(validBody, "a"));
    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses a message that belongs to another ticket (404)", async () => {
    const { deps, sendEmail } = makeDeps({
      a: { id: "u", userType: 0, visibleTickets: [ticket], messages: [{ ...teamMessage, ticket_id: OTHER_TICKET_ID }] },
    });
    const res = await createNotificationHandler(deps)(post(validBody, "a"));
    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("refuses to replay an old message (409)", async () => {
    const old = { ...teamMessage, created_at: new Date(NOW - MESSAGE_MAX_AGE_MS - 1000).toISOString() };
    const { deps, sendEmail } = makeDeps({ a: { id: "u", userType: 0, visibleTickets: [ticket], messages: [old] } });
    const res = await createNotificationHandler(deps)(post(validBody, "a"));
    expect(res.status).toBe(409);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("send-notification · admin happy path", () => {
  it("sends one e-mail to the ticket's stored client address", async () => {
    const { deps, sent } = makeDeps(USERS);
    const res = await createNotificationHandler(deps)(post(validBody, "admin-token"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("cliente@example.com");
    expect(sent[0].subject).toBe("Respuesta a tu ticket: Tienda online — MultiStack Systems");
    expect(sent[0].html).toContain("Hola, ya revisamos tu solicitud.");
  });

  it("links solicitudes (no project) to /solicitudes — never a literal [token]", async () => {
    const { deps, sent } = makeDeps(USERS);
    await createNotificationHandler(deps)(post(validBody, "admin-token"));
    expect(sent[0].html).toContain('href="https://www.multistacksystems.com/solicitudes"');
    expect(sent[0].html).not.toContain("[token]");
  });

  it("never e-mails a portal token for project tickets", async () => {
    const projectTicket = { ...ticket, project_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
    const { deps, sent } = makeDeps({ a: { id: "u", userType: 0, visibleTickets: [projectTicket] } });
    await createNotificationHandler(deps)(post(validBody, "a"));
    expect(sent[0].html).not.toContain("/client/");
    expect(sent[0].html).not.toContain("/solicitudes");
    expect(sent[0].html).not.toContain("token");
  });
});

describe("send-notification · tampering", () => {
  it("ignores a recipient, subject, html or portalUrl smuggled in the body", async () => {
    const { deps, sent } = makeDeps(USERS);
    const res = await createNotificationHandler(deps)(post({
      ...validBody,
      to: "victim@evil.test",
      ticket: { client_email: "victim@evil.test", title: "Phish" },
      message: "<a href='https://evil.test'>Reset your password</a>",
      portalUrl: "https://evil.test/login",
      html: "<h1>owned</h1>",
    }, "admin-token"));
    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("cliente@example.com");
    expect(sent[0].html).not.toContain("evil.test");
    expect(sent[0].html).not.toContain("owned");
  });

  it("escapes HTML stored in the ticket title and message", async () => {
    const xssTicket = { ...ticket, title: `<img src=x onerror="alert(1)">` };
    const xssMessage = { ...teamMessage, message: `<script>alert('x')</script><a href="https://evil.test">click</a>` };
    const { deps, sent } = makeDeps({
      a: { id: "u", userType: 0, visibleTickets: [xssTicket], messages: [xssMessage] },
    });
    await createNotificationHandler(deps)(post(validBody, "a"));
    const html = sent[0].html;
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x"); // the layout's own logo <img> is fine
    expect(html).not.toContain('onerror="'); // only the escaped text form may appear
    expect(html).not.toContain('href="https://evil.test"');
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("strips line breaks from the subject (header injection)", async () => {
    const t = { ...ticket, title: "Hola\r\nBcc: victim@evil.test" };
    const { deps, sent } = makeDeps({ a: { id: "u", userType: 0, visibleTickets: [t] } });
    await createNotificationHandler(deps)(post(validBody, "a"));
    expect(sent[0].subject).not.toMatch(/[\r\n]/);
  });

  it("does not send when the stored recipient is missing or invalid (422)", async () => {
    for (const client_email of [null, "", "not-an-email", "a@b.c\r\nBcc: x@y.z"]) {
      const { deps, sendEmail } = makeDeps({
        a: { id: "u", userType: 0, visibleTickets: [{ ...ticket, client_email }] },
      });
      const res = await createNotificationHandler(deps)(post(validBody, "a"));
      expect(res.status).toBe(422);
      expect(sendEmail).not.toHaveBeenCalled();
    }
  });
});

describe("send-notification · incomplete or malformed input", () => {
  const cases: Array<[string, unknown, string | undefined, number]> = [
    ["malformed JSON", undefined, "{not json", 400],
    ["missing type", { ticket_id: TICKET_ID, message_id: MESSAGE_ID }, undefined, 400],
    ["legacy 'new_ticket' type (removed)", { type: "new_ticket", ticket_id: TICKET_ID, message_id: MESSAGE_ID }, undefined, 400],
    ["missing ticket_id", { type: "team_reply", message_id: MESSAGE_ID }, undefined, 400],
    ["missing message_id", { type: "team_reply", ticket_id: TICKET_ID }, undefined, 400],
    ["non-uuid ids", { type: "team_reply", ticket_id: "1 OR 1=1", message_id: MESSAGE_ID }, undefined, 400],
    ["legacy full-ticket payload", { type: "team_reply", ticket: { client_email: "x@y.z" }, message: "hi" }, undefined, 400],
  ];

  it.each(cases)("%s → %i, no e-mail", async (_label, body, raw, status) => {
    const { deps, sendEmail } = makeDeps(USERS);
    const res = await createNotificationHandler(deps)(post(body, "admin-token", raw));
    expect(res.status).toBe(status);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("send-notification · failures do not leak internals", () => {
  it("fails closed when RESEND_API_KEY is missing (503)", async () => {
    const { deps, sendEmail } = makeDeps(USERS, { emailConfigured: false });
    const res = await createNotificationHandler(deps)(post(validBody, "admin-token"));
    expect(res.status).toBe(503);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("returns a generic error when Resend fails", async () => {
    const { deps } = makeDeps(USERS, {
      sendEmail: async () => { throw new Error("Resend 422 — cliente@example.com is invalid; key re_secret"); },
    });
    const res = await createNotificationHandler(deps)(post(validBody, "admin-token"));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain("cliente@example.com");
    expect(text).not.toContain("re_secret");
  });

  it("never logs e-mail addresses", async () => {
    const log = vi.fn();
    const { deps } = makeDeps(USERS, { log });
    await createNotificationHandler(deps)(post(validBody, "admin-token"));
    await createNotificationHandler(deps)(post(validBody, "client-token"));
    expect(JSON.stringify(log.mock.calls)).not.toContain("@");
  });
});
