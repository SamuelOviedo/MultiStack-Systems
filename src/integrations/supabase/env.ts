/**
 * Validation of the Supabase client configuration (VITE_SUPABASE_*).
 *
 * Pure module (no browser APIs): used at runtime by client.ts AND at build
 * time by vite.config.ts, so a misconfigured deploy fails the build instead of
 * shipping a site that redirects auth to a placeholder host.
 *
 * Never put the key's value in a message: only variable names and the URL host.
 */

export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

type EnvLike = Record<string, unknown>;

/** Values copied verbatim from .env.example or typical "fill me" markers. */
const PLACEHOLDER = /your[_-]?project[_-]?ref|your[_-]?supabase|your[_-]?anon|placeholder|changeme|<[^>]+>/i;

const read = (env: EnvLike, key: string): string => {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
};

/** Human-readable problems with the configuration; empty array = valid. */
export function getSupabaseEnvProblems(env: EnvLike): string[] {
  const problems: string[] = [];
  const url = read(env, "VITE_SUPABASE_URL");
  // Canonical name in this repo; VITE_SUPABASE_ANON_KEY accepted as an alias.
  const key = read(env, "VITE_SUPABASE_PUBLISHABLE_KEY") || read(env, "VITE_SUPABASE_ANON_KEY");

  if (!url) {
    problems.push("VITE_SUPABASE_URL is missing or empty.");
  } else if (PLACEHOLDER.test(url)) {
    problems.push(`VITE_SUPABASE_URL still holds the .env.example placeholder (${safeHost(url)}).`);
  } else {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        problems.push("VITE_SUPABASE_URL must be an http(s) URL.");
      }
    } catch {
      problems.push("VITE_SUPABASE_URL is not a valid URL.");
    }
  }

  if (!key) {
    problems.push("VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) is missing or empty.");
  } else if (PLACEHOLDER.test(key)) {
    problems.push("VITE_SUPABASE_PUBLISHABLE_KEY still holds the .env.example placeholder.");
  }

  return problems;
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unparseable URL";
  }
}

export class SupabaseConfigError extends Error {
  constructor(problems: string[]) {
    super(
      `Missing or invalid Supabase environment variables. ${problems.join(" ")} ` +
        "Copy the project URL and the publishable (anon) key from Supabase → Project Settings → API " +
        "into .env (see .env.example) and restart the dev server.",
    );
    this.name = "SupabaseConfigError";
  }
}

/** Returns the validated configuration or throws a descriptive SupabaseConfigError. */
export function resolveSupabaseEnv(env: EnvLike): SupabaseEnv {
  const problems = getSupabaseEnvProblems(env);
  if (problems.length > 0) throw new SupabaseConfigError(problems);
  return {
    url: read(env, "VITE_SUPABASE_URL"),
    publishableKey: read(env, "VITE_SUPABASE_PUBLISHABLE_KEY") || read(env, "VITE_SUPABASE_ANON_KEY"),
  };
}
