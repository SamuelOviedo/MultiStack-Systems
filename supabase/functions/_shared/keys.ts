/**
 * Server-side Supabase key for Edge Functions.
 *
 * The runtime injects every secret API key as a JSON dictionary keyed by key
 * name (SUPABASE_SECRET_KEYS), and also one of them as SUPABASE_SERVICE_ROLE_KEY
 * (which one is a platform decision, not documented). Functions select the
 * dedicated key by NAME so a key can be added, rotated or deleted (e.g. after
 * a leak) without depending on that implicit mapping or on dictionary order.
 */

/** Name of the secret API key reserved for Edge Functions (Settings → API Keys). */
export const EDGE_FUNCTIONS_KEY_NAME = "edge_functions";

export interface SelectedKey {
  /** "" when the named key is not configured. */
  key: string;
  /** Logical name of the configuration used — safe to log (never log the key). */
  source: string;
}

/**
 * Picks `name` from the injected dictionary. There is deliberately NO fallback
 * (not SUPABASE_SERVICE_ROLE_KEY, not "default", not the first entry): a
 * missing key must surface as a logged error, never as a silent switch to
 * another privileged key.
 */
export function pickNamedKey(raw: string | undefined, name: string): SelectedKey {
  const source = `SUPABASE_SECRET_KEYS.${name}`;
  const value = raw?.trim();
  if (value?.startsWith("{")) {
    try {
      const named = (JSON.parse(value) as Record<string, unknown>)[name];
      if (typeof named === "string" && named.trim()) return { key: named.trim(), source };
    } catch {
      // malformed → missing
    }
  }
  return { key: "", source };
}

/** Server-side key that bypasses RLS. Never send it to a browser. */
export function edgeFunctionsKey(): SelectedKey {
  return pickNamedKey(Deno.env.get("SUPABASE_SECRET_KEYS"), EDGE_FUNCTIONS_KEY_NAME);
}
