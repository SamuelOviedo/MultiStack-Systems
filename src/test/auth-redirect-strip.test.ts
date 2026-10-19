import { afterEach, describe, expect, it, vi } from "vitest";
import { stripAuthRedirectFromUrl } from "@/lib/authRedirect";

type UrlWindow = NonNullable<Parameters<typeof stripAuthRedirectFromUrl>[0]>;

/** A window double that records history.replaceState calls instead of touching jsdom. */
function fakeWindow({ hash = "", pathname = "/auth/callback", search = "", state = null as unknown } = {}) {
  const replaceState = vi.fn();
  const win = { location: { hash, pathname, search }, history: { state, replaceState } } as unknown as UrlWindow;
  return { win, replaceState };
}

// Fake values assembled at runtime so no JWT-looking literal lands in a public repo.
const fakeToken = ["header", "payload", "signature"].join(".");

describe("stripAuthRedirectFromUrl — keeps auth tokens / errors out of the history entry", () => {
  it("replaces the entry (no new one) with the URL minus the hash when it carries tokens", () => {
    const state = { idx: 3 };
    const { win, replaceState } = fakeWindow({
      hash: `#access_token=${fakeToken}&refresh_token=r&expires_in=3600&token_type=bearer&type=recovery`,
      state,
    });
    stripAuthRedirectFromUrl(win);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(state, "", "/auth/callback");
    // The router's own history state must survive (react-router keeps its key there).
    expect(replaceState.mock.calls[0][0]).toBe(state);
  });

  it("strips an expired-link error hash (supabase-js never clears this one)", () => {
    const { win, replaceState } = fakeWindow({
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    });
    stripAuthRedirectFromUrl(win);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
  });

  it.each(["access_token", "refresh_token", "error", "error_code", "error_description"])(
    "strips a hash whose only auth key is %s",
    (key) => {
      const { win, replaceState } = fakeWindow({ hash: `#${key}=x`, pathname: "/" });
      stripAuthRedirectFromUrl(win);
      expect(replaceState).toHaveBeenCalledWith(null, "", "/");
    },
  );

  it("strips when the auth keys sit next to unrelated hash params", () => {
    const { win, replaceState } = fakeWindow({ hash: "#foo=1&access_token=a&bar=2" });
    stripAuthRedirectFromUrl(win);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback");
  });

  it("keeps the query string (only the hash goes)", () => {
    const { win, replaceState } = fakeWindow({
      pathname: "/auth/callback",
      search: "?x=1",
      hash: `#access_token=${fakeToken}&refresh_token=r`,
    });
    stripAuthRedirectFromUrl(win);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/auth/callback?x=1");
  });

  it.each(["#contacto", "#productos", "#errores", "#access", "#refresh_tokens=1", "#type=recovery"])(
    "leaves the plain anchor / unrelated hash %s alone",
    (hash) => {
      const { win, replaceState } = fakeWindow({ hash, pathname: "/" });
      stripAuthRedirectFromUrl(win);
      expect(replaceState).not.toHaveBeenCalled();
    },
  );

  it.each(["", "#"])("does nothing for an empty hash (%j)", (hash) => {
    const { win, replaceState } = fakeWindow({ hash });
    stripAuthRedirectFromUrl(win);
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("never throws when history.replaceState does (sandboxed iframe, privacy modes)", () => {
    const { win, replaceState } = fakeWindow({ hash: "#access_token=a&refresh_token=r" });
    replaceState.mockImplementation(() => { throw new DOMException("denied", "SecurityError"); });
    expect(() => stripAuthRedirectFromUrl(win)).not.toThrow();
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});

describe("stripAuthRedirectFromUrl — against the real jsdom window", () => {
  const original = window.location.href;
  afterEach(() => window.history.replaceState(null, "", original));

  it("defaults to window: tokens leave location, the query stays, and no history entry is added", () => {
    window.history.replaceState(null, "", `/auth/callback?x=1#access_token=${fakeToken}&refresh_token=r`);
    const entries = window.history.length;

    stripAuthRedirectFromUrl();

    expect(window.location.pathname).toBe("/auth/callback");
    expect(window.location.search).toBe("?x=1");
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toMatch(/access_token|refresh_token/);
    expect(window.history.length).toBe(entries);
  });

  it("defaults to window: an anchor such as #contacto is untouched", () => {
    window.history.replaceState(null, "", "/?x=1#contacto");
    stripAuthRedirectFromUrl();
    expect(window.location.hash).toBe("#contacto");
    expect(window.location.search).toBe("?x=1");
  });
});
