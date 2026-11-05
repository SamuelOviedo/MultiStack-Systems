import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Startup order of src/integrations/supabase/client.ts, with the REAL supabase-js
 * (only `fetch` is faked):
 *
 *   captureAuthRedirect()  ->  createClient()  ->  stripAuthRedirectFromUrl()
 *
 * The GoTrueClient constructor parses window.location.href synchronously, so the
 * tokens in the hash must still be there when createClient() runs and gone right
 * after it. Stripping BEFORE createClient() would silently lose the recovery
 * session; never stripping leaves the token (or the #error=…) in the history entry.
 */

const HOST = "https://qa-startup.supabase.co";
const USER = {
  id: "qa-user-id",
  aud: "authenticated",
  role: "authenticated",
  email: "cliente@example.test",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

// Built at runtime (fake, unsigned) so no JWT-looking literal lands in a public repo.
const b64url = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fakeAccessToken = [b64url({ alg: "none" }), b64url({ sub: USER.id, role: "authenticated" }), "sig"].join(".");

const RECOVERY_HASH =
  `#access_token=${fakeAccessToken}&refresh_token=x&expires_in=3600&token_type=bearer&type=recovery`;
const EXPIRED_LINK_HASH =
  "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

const original = window.location.href;
const requested: { url: string; method: string; authorization: string | null }[] = [];

function installFetch() {
  requested.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method ?? "GET").toUpperCase();
      requested.push({ url, method, authorization: new Headers(init?.headers).get("authorization") });
      if (method === "GET" && url === `${HOST}/auth/v1/user`) {
        return new Response(JSON.stringify(USER), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      throw new Error(`unexpected request in test: ${method} ${url}`);
    }),
  );
}

let replaceState: ReturnType<typeof vi.spyOn>;

/** Loads a fresh copy of the client module at the given URL (as a page load would). */
async function bootAt(pathSearchHash: string) {
  window.history.replaceState(null, "", pathSearchHash);
  replaceState = vi.spyOn(window.history, "replaceState"); // only calls made by the client module count
  vi.resetModules();
  return (await import("@/integrations/supabase/client")).supabase;
}

let supabase: Awaited<ReturnType<typeof bootAt>> | undefined;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubEnv("VITE_SUPABASE_URL", HOST);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "qa-fake-publishable-key");
  // Every module reload builds another GoTrueClient: silence the "multiple instances" warning.
  vi.spyOn(console, "warn").mockImplementation(() => {});
  installFetch();
});

afterEach(async () => {
  await supabase?.auth.stopAutoRefresh();
  supabase = undefined;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", original);
});

describe("supabase client startup — recovery link (#access_token…&type=recovery)", () => {
  it("still detects the session from the URL, and the tokens are gone from the URL right after startup", async () => {
    supabase = await bootAt(`/auth/callback${RECOVERY_HASH}`);

    // The current history entry was rewritten in place without the tokens. (jsdom cannot list
    // history entries, and its `location.hash = ''` pushes one — unlike Chromium — so the
    // "no token in any entry" check lives in the real-browser run, not here.)
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toMatch(/access_token|refresh_token/);
    expect(window.location.pathname).toBe("/auth/callback");

    // (a) supabase-js read the tokens BEFORE they were stripped.
    const { data, error } = await supabase.auth.getSession();
    expect(error).toBeNull();
    expect(data.session?.access_token).toBe(fakeAccessToken);
    expect(data.session?.refresh_token).toBe("x");
    expect(data.session?.user.id).toBe(USER.id);
    expect(requested).toEqual([{ url: `${HOST}/auth/v1/user`, method: "GET", authorization: `Bearer ${fakeAccessToken}` }]);

    // (b) still clean once supabase-js finished (its own `location.hash = ''` must not bring anything back).
    expect(window.location.href).not.toMatch(/access_token|refresh_token/);
  });

  it("captures the recovery marker BEFORE stripping (the app needs it after the hash is gone)", async () => {
    supabase = await bootAt(`/auth/callback${RECOVERY_HASH}`);
    expect(sessionStorage.getItem("ms:auth:recovery-pending")).toBe("1");
    await supabase.auth.getSession();
  });

  it("emits PASSWORD_RECOVERY for the session it found", async () => {
    supabase = await bootAt(`/auth/callback${RECOVERY_HASH}`);
    const events: string[] = [];
    supabase.auth.onAuthStateChange((event) => { events.push(event); });
    await vi.waitFor(() => expect(events).toContain("PASSWORD_RECOVERY"));
  });
});

describe("supabase client startup — expired / invalid link (#error=…&error_code=otp_expired)", () => {
  it("records the error code, then removes the #error hash (supabase-js leaves it in the URL)", async () => {
    supabase = await bootAt(`/auth/callback${EXPIRED_LINK_HASH}`);

    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toMatch(/error_code|error_description|access_denied/);
    // captureAuthRedirect ran first, so the app can still explain what happened.
    expect(sessionStorage.getItem("ms:auth:link-error")).toBe("otp_expired");

    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
    expect(requested).toEqual([]);
  });
});

describe("supabase client startup — pages that are not auth redirects", () => {
  it("keeps a plain anchor and the query string untouched", async () => {
    supabase = await bootAt("/?x=1#contacto");
    expect(replaceState).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("#contacto");
    const { data } = await supabase.auth.getSession();
    expect(data.session).toBeNull();
    expect(requested).toEqual([]);
  });
});
