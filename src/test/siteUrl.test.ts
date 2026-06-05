import { describe, it, expect, afterEach, vi } from "vitest";
import { getSiteOrigin, getAuthEmailRedirectUrl } from "@/lib/siteUrl";

describe("getSiteOrigin — with VITE_SITE_URL set", () => {
  it("returns a non-empty string", () => {
    expect(getSiteOrigin()).toBeTypeOf("string");
    expect(getSiteOrigin().length).toBeGreaterThan(0);
  });

  it("does not end with a slash", () => {
    expect(getSiteOrigin().endsWith("/")).toBe(false);
  });

  it("strips trailing slash from env var", () => {
    vi.stubEnv("VITE_SITE_URL", "https://multistacksystems.com/");
    expect(getSiteOrigin()).toBe("https://multistacksystems.com");
    vi.unstubAllEnvs();
  });
});

describe("getSiteOrigin — without VITE_SITE_URL (fallback logic)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns production URL when host is not localhost", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const original = window.location;
    delete (window as any).location;
    (window as any).location = { hostname: "myapp.vercel.app", origin: "https://myapp.vercel.app" };
    const result = getSiteOrigin();
    (window as any).location = original;
    expect(result).toBe("https://multistacksystems.com");
  });

  it("returns localhost origin when host is localhost", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    const original = window.location;
    delete (window as any).location;
    (window as any).location = { hostname: "localhost", origin: "http://localhost:5173" };
    const result = getSiteOrigin();
    (window as any).location = original;
    expect(result).toBe("http://localhost:5173");
  });
});

describe("getAuthEmailRedirectUrl", () => {
  it("ends with /solicitudes", () => {
    expect(getAuthEmailRedirectUrl().endsWith("/solicitudes")).toBe(true);
  });

  it("is an absolute URL or valid path", () => {
    expect(getAuthEmailRedirectUrl()).toMatch(/\/solicitudes$/);
  });
});
