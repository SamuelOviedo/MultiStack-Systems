// @vitest-environment node
import { describe, expect, it } from "vitest";
import { checkLead, clientIp, decideThrottle, HONEYPOT_FIELD, LEAD_LIMITS, THROTTLE } from "./lead";

const valid = { name: "Ana Pérez", email: "Ana@Example.com", message: "Necesito una web" };

describe("checkLead (S4)", () => {
  it("accepts a normal lead and normalizes it", () => {
    expect(checkLead({ ...valid, name: "  Ana \n Pérez " })).toEqual({
      kind: "ok",
      lead: { name: "Ana Pérez", email: "ana@example.com", phone: "", message: "Necesito una web" },
    });
  });

  it("accepts phone-only leads", () => {
    const r = checkLead({ name: "Ana", phone: "+504 9999-9999", message: "Hola, info" });
    expect(r.kind).toBe("ok");
  });

  it("flags the honeypot before anything else", () => {
    expect(checkLead({ ...valid, [HONEYPOT_FIELD]: "http://spam.example" })).toEqual({ kind: "honeypot" });
    expect(checkLead({ [HONEYPOT_FIELD]: "x" })).toEqual({ kind: "honeypot" });
  });

  it("ignores an empty honeypot", () => {
    expect(checkLead({ ...valid, [HONEYPOT_FIELD]: "   " }).kind).toBe("ok");
  });

  it.each([
    ["no contact method", { name: "Ana", message: "Hola, info" }, "contact method"],
    ["short message", { ...valid, message: "hey" }, "message"],
    ["message over the limit", { ...valid, message: "x".repeat(LEAD_LIMITS.messageMax + 1) }, "message"],
    ["name over the limit", { ...valid, name: "x".repeat(LEAD_LIMITS.nameMax + 1) }, "name"],
    ["e-mail over the limit", { ...valid, email: `${"a".repeat(250)}@x.com` }, "email"],
    ["malformed e-mail", { ...valid, email: "ana@" }, "email"],
    ["phone with letters", { ...valid, phone: "call me" }, "phone"],
    ["phone over the limit", { ...valid, phone: "1".repeat(8) + " ".repeat(40) + "2" }, "phone"],
  ])("rejects %s", (_label, body, field) => {
    const r = checkLead(body);
    expect(r.kind).toBe("invalid");
    expect(r.kind === "invalid" && r.reason).toContain(field);
  });

  it("accepts a message exactly at the limit", () => {
    expect(checkLead({ ...valid, message: "x".repeat(LEAD_LIMITS.messageMax) }).kind).toBe("ok");
  });

  it("tolerates non-object bodies", () => {
    expect(checkLead(null).kind).toBe("invalid");
    expect(checkLead("text").kind).toBe("invalid");
    expect(checkLead({ name: 42, message: ["x"] }).kind).toBe("invalid");
  });

  it("keeps a lead within the database limits (tickets title/description)", () => {
    const r = checkLead({
      name: "x".repeat(LEAD_LIMITS.nameMax),
      phone: "+504 9999-9999",
      message: "x".repeat(LEAD_LIMITS.messageMax),
    });
    if (r.kind !== "ok") throw new Error("expected ok");
    expect(`Mensaje web de ${r.lead.name}`.length).toBeLessThanOrEqual(200);
    expect(`Teléfono: ${r.lead.phone}\n\n${r.lead.message}`.length).toBeLessThanOrEqual(10000);
  });
});

describe("decideThrottle (S4)", () => {
  const calm = { perIp: 1, perEmail: 1, global10Min: 0, global1Hour: 0 };

  it("allows normal traffic", () => {
    expect(decideThrottle(calm)).toBe("allow");
    expect(decideThrottle({ ...calm, perIp: null, perEmail: null })).toBe("allow");
  });

  it("rejects a single IP above its hourly limit, whatever e-mail it uses", () => {
    expect(decideThrottle({ ...calm, perIp: THROTTLE.perIpPerHour })).toBe("allow");
    expect(decideThrottle({ ...calm, perIp: THROTTLE.perIpPerHour + 1, perEmail: 1 })).toBe("reject");
  });

  it("allows up to perEmailPerHour attempts per e-mail (current one included), rejects the next", () => {
    expect(decideThrottle({ ...calm, perEmail: THROTTLE.perEmailPerHour })).toBe("allow");
    expect(decideThrottle({ ...calm, perEmail: THROTTLE.perEmailPerHour + 1 })).toBe("reject");
  });

  it("never rejects a legitimate sender because of a flood: stores without e-mail", () => {
    expect(decideThrottle({ ...calm, global10Min: THROTTLE.globalSoftPer10Min })).toBe("store-only");
    expect(decideThrottle({ ...calm, global10Min: 10_000, global1Hour: THROTTLE.globalHardPerHour - 1 })).toBe("store-only");
  });

  it("only the hard hourly cap rejects everyone (database protection)", () => {
    expect(decideThrottle({ ...calm, global1Hour: THROTTLE.globalHardPerHour })).toBe("reject");
  });
});

describe("clientIp", () => {
  const h = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null });

  it("uses cf-connecting-ip (infrastructure-controlled), IPv4 or IPv6", () => {
    expect(clientIp(h({ "cf-connecting-ip": "198.51.100.2", "x-forwarded-for": "203.0.113.7" }))).toBe("198.51.100.2");
    expect(clientIp(h({ "cf-connecting-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("never falls back to client-influenced or proxy headers", () => {
    // Measured: the last X-Forwarded-For entry is an infrastructure address.
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7, 203.0.113.7, 198.51.100.250" }))).toBeNull();
    expect(clientIp(h({ "x-real-ip": "203.0.113.8" }))).toBeNull();
    expect(clientIp(h({ "true-client-ip": "203.0.113.9", forwarded: "for=203.0.113.10" }))).toBeNull();
  });

  it("returns null for missing or malformed values", () => {
    expect(clientIp(h({}))).toBeNull();
    expect(clientIp(h({ "cf-connecting-ip": "<script>" }))).toBeNull();
    expect(clientIp(h({ "cf-connecting-ip": "1.2.3.4, 5.6.7.8" }))).toBeNull();
  });
});
