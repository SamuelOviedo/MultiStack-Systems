// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import {
  decodeWebhookSecret,
  verifyStandardWebhook,
  WebhookVerificationError,
} from "./standard-webhooks.ts";

// Reference vector published with the Standard Webhooks / Svix docs.
const SPEC = {
  secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
  timestamp: "1614265330",
  body: '{"test": 2432232314}',
  signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
};
const SPEC_NOW = () => Number(SPEC.timestamp) * 1000;

const headers = (h: Record<string, string>) => new Headers(h);
const specHeaders = (overrides: Record<string, string> = {}) =>
  headers({
    "webhook-id": SPEC.id,
    "webhook-timestamp": SPEC.timestamp,
    "webhook-signature": SPEC.signature,
    ...overrides,
  });

async function rejects(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(WebhookVerificationError);
}

describe("verifyStandardWebhook", () => {
  it("accepts the reference vector", async () => {
    await expect(
      verifyStandardWebhook(SPEC.body, specHeaders(), SPEC.secret, { now: SPEC_NOW }),
    ).resolves.toBeUndefined();
  });

  it("accepts Supabase's 'v1,whsec_' secret format", async () => {
    await expect(
      verifyStandardWebhook(SPEC.body, specHeaders(), `v1,${SPEC.secret}`, { now: SPEC_NOW }),
    ).resolves.toBeUndefined();
  });

  it("agrees with an independent HMAC implementation (node:crypto)", async () => {
    const key = Buffer.from("multistack-test-secret-32-bytes!!");
    const body = JSON.stringify({ user: { email: "a@b.co" } });
    const ts = "1760443200";
    const sig = createHmac("sha256", key).update(`msg_1.${ts}.${body}`).digest("base64");
    await expect(
      verifyStandardWebhook(
        body,
        headers({ "webhook-id": "msg_1", "webhook-timestamp": ts, "webhook-signature": `v1,${sig}` }),
        `v1,whsec_${key.toString("base64")}`,
        { now: () => Number(ts) * 1000 },
      ),
    ).resolves.toBeUndefined();
  });

  it("accepts when any of several space-separated signatures matches (key rotation)", async () => {
    await expect(
      verifyStandardWebhook(
        SPEC.body,
        specHeaders({ "webhook-signature": `v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA= ${SPEC.signature}` }),
        SPEC.secret,
        { now: SPEC_NOW },
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a tampered body", async () => {
    await rejects(verifyStandardWebhook('{"test": 2432232315}', specHeaders(), SPEC.secret, { now: SPEC_NOW }));
  });

  it("rejects a tampered id or timestamp", async () => {
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders({ "webhook-id": "msg_other" }), SPEC.secret, { now: SPEC_NOW }));
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders({ "webhook-timestamp": "1614265331" }), SPEC.secret, { now: SPEC_NOW }));
  });

  it("rejects a signature made with another secret", async () => {
    await rejects(
      verifyStandardWebhook(SPEC.body, specHeaders(), `whsec_${Buffer.from("another-secret-of-32-bytes-long!").toString("base64")}`, { now: SPEC_NOW }),
    );
  });

  it("rejects missing headers", async () => {
    for (const missing of ["webhook-id", "webhook-timestamp", "webhook-signature"]) {
      const h = specHeaders();
      h.delete(missing);
      await rejects(verifyStandardWebhook(SPEC.body, h, SPEC.secret, { now: SPEC_NOW }));
    }
  });

  it("rejects stale or future timestamps (replay window = 5 min)", async () => {
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders(), SPEC.secret, { now: () => SPEC_NOW() + 6 * 60_000 }));
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders(), SPEC.secret, { now: () => SPEC_NOW() - 6 * 60_000 }));
    await expect(
      verifyStandardWebhook(SPEC.body, specHeaders(), SPEC.secret, { now: () => SPEC_NOW() + 4 * 60_000 }),
    ).resolves.toBeUndefined();
  });

  it("rejects unsupported versions and garbage signatures", async () => {
    const sig = SPEC.signature.slice(3);
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders({ "webhook-signature": `v2,${sig}` }), SPEC.secret, { now: SPEC_NOW }));
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders({ "webhook-signature": "v1,%%%not-base64%%%" }), SPEC.secret, { now: SPEC_NOW }));
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders({ "webhook-signature": sig }), SPEC.secret, { now: SPEC_NOW }));
    await rejects(verifyStandardWebhook(SPEC.body, specHeaders({ "webhook-timestamp": "abc" }), SPEC.secret, { now: SPEC_NOW }));
  });
});

describe("decodeWebhookSecret", () => {
  it("rejects malformed or too-short secrets", () => {
    expect(() => decodeWebhookSecret("v1,whsec_%%%")).toThrow(WebhookVerificationError);
    expect(() => decodeWebhookSecret("whsec_c2hvcnQ=")).toThrow(WebhookVerificationError);
  });
});
