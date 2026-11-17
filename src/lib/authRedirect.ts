/**
 * Detects what a Supabase Auth e-mail link came back with, BEFORE supabase-js
 * parses and strips the URL hash (implicit flow: `#access_token=…&type=recovery`
 * or `#error=…&error_code=otp_expired&error_description=…`).
 *
 * Must run synchronously at startup — it is called from
 * integrations/supabase/client.ts right before createClient(). Tiny on purpose:
 * it ships in the entry chunk.
 *
 * State lives in sessionStorage (per tab, survives the in-app redirects).
 */
const RECOVERY_KEY = "ms:auth:recovery-pending";
const LINK_ERROR_KEY = "ms:auth:link-error";
const CONFIRMATION_ERROR_KEY = "ms:auth:confirmation-link-error";

/**
 * Where sign-up confirmation links come back (emailRedirectTo, see lib/siteUrl).
 * A rejected link carries no `type`, so the landing path is the only way to tell
 * a confirmation link from a recovery one (those return to /auth/callback or to
 * the Site URL).
 */
export const SIGNUP_CONFIRMATION_PATH = "/solicitudes";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(): StorageLike | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null; // storage disabled (privacy mode, sandboxed iframe…)
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Reads the auth redirect from the current URL (hash first, then query). */
export function captureAuthRedirect(
  location: Pick<Location, "hash" | "search"> & { pathname?: string } = window.location,
  storage: StorageLike | null = store(),
): void {
  if (!storage) return;
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(location.search);

  if (hash.get("type") === "recovery" && hash.get("access_token")) {
    safe(() => storage.setItem(RECOVERY_KEY, "1"), undefined);
  }

  // Supabase signals a bad link with error + error_description (+ error_code).
  const code = hash.get("error_code") ?? query.get("error_code") ?? hash.get("error") ?? query.get("error");
  const described = hash.get("error_description") ?? query.get("error_description");
  if (code && described) {
    // Only the code is kept: error_description never leaves the URL.
    const confirmation = location.pathname?.replace(/\/+$/, "") === SIGNUP_CONFIRMATION_PATH;
    safe(() => storage.setItem(confirmation ? CONFIRMATION_ERROR_KEY : LINK_ERROR_KEY, code.slice(0, 64)), undefined);
  }
}

const AUTH_HASH_KEYS = ["access_token", "refresh_token", "error", "error_code", "error_description"];

type UrlWindow = {
  location: Pick<Location, "hash" | "pathname" | "search">;
  history: Pick<History, "state" | "replaceState">;
};

let authRedirectAtStartup = false;
/**
 * True when this page load arrived with a Supabase Auth hash (tokens or error).
 * Set even if replaceState throws; lasts until the page is reloaded.
 */
export const hadAuthRedirectAtStartup = (): boolean => authRedirectAtStartup;

/**
 * Removes an auth redirect (tokens or error) from the CURRENT history entry.
 * supabase-js clears the hash with `location.hash = ''`, which leaves the
 * original `#access_token=…&refresh_token=…` entry behind (Back), and does not
 * clear an `#error=…` hash at all. Only auth-looking hashes go: anchors such as
 * `#contacto` and the query string are kept. Call it right AFTER createClient(),
 * which has already parsed the URL.
 * Also sets the hadAuthRedirectAtStartup() flag.
 */
export function stripAuthRedirectFromUrl(win: UrlWindow = window): void {
  safe(() => {
    const params = new URLSearchParams(win.location.hash.replace(/^#/, ""));
    if (!AUTH_HASH_KEYS.some((key) => params.has(key))) return;
    authRedirectAtStartup = true;
    win.history.replaceState(win.history.state, "", win.location.pathname + win.location.search);
  }, undefined); // replaceState can throw (sandboxed iframe, privacy modes)
}

export function markRecoveryPending(storage: StorageLike | null = store()): void {
  if (storage) safe(() => storage.setItem(RECOVERY_KEY, "1"), undefined);
}

export function isRecoveryPending(storage: StorageLike | null = store()): boolean {
  return storage ? safe(() => storage.getItem(RECOVERY_KEY) === "1", false) : false;
}

export function clearRecoveryPending(storage: StorageLike | null = store()): void {
  if (storage) safe(() => storage.removeItem(RECOVERY_KEY), undefined);
}

/** Error code of a rejected auth link (e.g. "otp_expired"), if one was captured. */
export function peekAuthLinkError(storage: StorageLike | null = store()): string | null {
  return storage ? safe(() => storage.getItem(LINK_ERROR_KEY), null) : null;
}

export function clearAuthLinkError(storage: StorageLike | null = store()): void {
  if (storage) safe(() => storage.removeItem(LINK_ERROR_KEY), undefined);
}

/**
 * Error code of a rejected sign-up confirmation link, if one was captured. Kept
 * apart from the recovery error above: /login explains it, and RecoveryRedirect
 * must not send it to the new-password screen.
 */
export function peekConfirmationLinkError(storage: StorageLike | null = store()): string | null {
  return storage ? safe(() => storage.getItem(CONFIRMATION_ERROR_KEY), null) : null;
}

export function clearConfirmationLinkError(storage: StorageLike | null = store()): void {
  if (storage) safe(() => storage.removeItem(CONFIRMATION_ERROR_KEY), undefined);
}
