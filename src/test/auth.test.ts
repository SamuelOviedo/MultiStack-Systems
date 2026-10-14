import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithOAuthMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: signInWithOAuthMock } },
}));

import { getAuthCallbackUrl, signInWithOAuth } from "@/lib/auth";

/** Temporarily replaces window.location (jsdom) without `any`. */
function withLocation<T>(location: { hostname: string; origin: string }, run: () => T): T {
  const original = window.location;
  Reflect.deleteProperty(window, "location");
  Reflect.set(window, "location", location);
  try {
    return run();
  } finally {
    Reflect.set(window, "location", original);
  }
}

afterEach(() => {
  signInWithOAuthMock.mockClear();
  vi.unstubAllEnvs();
});

describe("OAuth redirect — dynamic origin", () => {
  it("a Vercel Preview returns to the same Preview, even with VITE_SITE_URL set to production", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://multistacksystems.com");
    const preview = "https://multi-stack-systems-abc123-samueloviedos-projects.vercel.app";
    await withLocation({ hostname: new URL(preview).hostname, origin: preview }, () => signInWithOAuth("google"));
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${preview}/auth/callback` },
    });
  });

  it("production returns to production and localhost to localhost", () => {
    expect(
      withLocation({ hostname: "multistacksystems.com", origin: "https://multistacksystems.com" }, getAuthCallbackUrl),
    ).toBe("https://multistacksystems.com/auth/callback");
    expect(withLocation({ hostname: "localhost", origin: "http://localhost:8080" }, getAuthCallbackUrl)).toBe(
      "http://localhost:8080/auth/callback",
    );
  });
});
