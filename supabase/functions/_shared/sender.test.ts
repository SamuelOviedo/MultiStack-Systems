// @vitest-environment node
import { describe, it, expect } from "vitest";
import { DEFAULT_SENDER, SUPPORT_REPLY_TO, resolveSender } from "./sender.ts";

describe("resolveSender (FROM_EMAIL → From address)", () => {
  it("keeps today's sender while FROM_EMAIL is unset", () => {
    expect(resolveSender(undefined)).toEqual({ from: DEFAULT_SENDER, source: "default" });
    expect(resolveSender("  ")).toEqual({ from: DEFAULT_SENDER, source: "default" });
    expect(DEFAULT_SENDER).toBe("MultiStack Systems <soporte@mail.multistacksystems.com>");
  });

  it("accepts the current production value (mail. subdomain)", () => {
    const v = "MultiStack Systems <soporte@mail.multistacksystems.com>";
    expect(resolveSender(v)).toEqual({ from: v, source: "FROM_EMAIL" });
  });

  it("accepts the target root-domain sender", () => {
    const v = "MultiStack Systems <soporte@multistacksystems.com>";
    expect(resolveSender(v)).toEqual({ from: v, source: "FROM_EMAIL" });
    expect(resolveSender("soporte@multistacksystems.com").source).toBe("FROM_EMAIL");
  });

  it("is case-insensitive on the domain and trims", () => {
    expect(resolveSender("  MultiStack Systems <soporte@MultiStackSystems.com>  ").from)
      .toBe("MultiStack Systems <soporte@MultiStackSystems.com>");
  });

  it("rejects foreign domains, look-alikes and the Resend sandbox", () => {
    for (const v of [
      "MultiStack Systems <soporte@evil.com>",
      "soporte@multistacksystems.com.evil.com",
      "soporte@evilmultistacksystems.com",
      "onboarding@resend.dev",
    ]) {
      expect(resolveSender(v)).toEqual({ from: DEFAULT_SENDER, source: "default", rejected: "foreign-domain" });
    }
  });

  it("rejects malformed or multi-line values (header injection)", () => {
    for (const v of [
      "MultiStack Systems <soporte@multistacksystems.com>\r\nBcc: x@evil.com",
      "a@b@multistacksystems.com",
      "<soporte@multistacksystems.com",
      "\"Quoted\" <soporte@multistacksystems.com>",
      "soporte@multistacksystems.com, x@evil.com",
    ]) {
      expect(resolveSender(v).rejected).toBe("malformed");
      expect(resolveSender(v).from).toBe(DEFAULT_SENDER);
    }
  });

  it("support Reply-To is the SpaceMail mailbox on the root domain", () => {
    expect(SUPPORT_REPLY_TO).toBe("soporte@multistacksystems.com");
  });
});
