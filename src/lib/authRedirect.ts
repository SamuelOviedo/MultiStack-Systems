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
  location: Pick<Location, "hash" | "search"> = window.location,
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
    safe(() => storage.setItem(LINK_ERROR_KEY, code.slice(0, 64)), undefined);
  }
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
