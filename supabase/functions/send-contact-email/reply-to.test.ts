import { describe, expect, it } from "vitest";
import { SUPPORT_REPLY_TO, replyToFor } from "./reply-to";

describe("replyToFor", () => {
  it("replies to the visitor's plain address", () => {
    expect(replyToFor("ana.perez+web@empresa.com.hn")).toBe("ana.perez+web@empresa.com.hn");
  });

  it("replies to support when the visitor left no e-mail", () => {
    expect(replyToFor("")).toBe(SUPPORT_REPLY_TO);
  });

  it("never uses an address that could inject headers or add recipients", () => {
    for (const bad of [
      "a@b.co\r\nBcc: x@evil.com",
      "a@b.co\nx",
      "a b@c.co",
      "a@b.co,x@evil.com",
      "a@b.co;x@evil.com",
      '"Ana" <a@b.co>',
      "<a@b.co>",
      "a(x)@b.co",
      "a@b.co\\",
      "a:b@c.co",
      "a@b@c.co",
      "nodomain@",
      `${"a".repeat(250)}@b.co`,
    ]) {
      expect(replyToFor(bad)).toBe(SUPPORT_REPLY_TO);
    }
  });
});
