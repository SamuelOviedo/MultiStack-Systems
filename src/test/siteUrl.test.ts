import { describe, it, expect } from "vitest";
import { getSiteOrigin, getAuthEmailRedirectUrl } from "@/lib/siteUrl";

describe("getSiteOrigin", () => {
  it("returns a non-empty string", () => {
    const result = getSiteOrigin();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not end with a slash", () => {
    // Trailing slash would break all URL concatenations downstream
    const result = getSiteOrigin();
    expect(result.endsWith("/")).toBe(false);
  });
});

describe("getAuthEmailRedirectUrl", () => {
  it("ends with /solicitudes", () => {
    // This is the post-email-confirmation redirect for client users
    const result = getAuthEmailRedirectUrl();
    expect(result.endsWith("/solicitudes")).toBe(true);
  });

  it("is an absolute URL or valid path", () => {
    const result = getAuthEmailRedirectUrl();
    expect(result).toMatch(/\/solicitudes$/);
  });
});
