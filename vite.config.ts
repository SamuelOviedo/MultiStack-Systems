import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { routeHeadPlugin } from "./build/routeHeadPlugin";
import { getSupabaseEnvProblems } from "./src/integrations/supabase/env";

type ViteEnv = Record<string, string>;

/**
 * One safe line in the build log (Vercel included) confirming what the build
 * actually sees: the Supabase host and whether a key is present — never the
 * key itself. Tolerates an undefined or malformed URL without breaking config.
 */
function logSupabaseEnv(env: ViteEnv, mode: string) {
  let host = "not set";
  const rawUrl = env.VITE_SUPABASE_URL?.trim();
  if (rawUrl) {
    try {
      host = new URL(rawUrl).host;
    } catch {
      host = "invalid URL";
    }
  }
  const keySet = Boolean((env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY)?.trim());
  const target = process.env.VERCEL_ENV ?? "local";
  console.log(`[env] Supabase host: ${host} | key set: ${keySet} | mode: ${mode} | target: ${target}`);
}

/**
 * Build-time twin of the runtime guard in src/integrations/supabase/client.ts.
 * On Vercel a missing/placeholder Supabase config FAILS the build, so a deploy
 * that would throw on load never replaces the live one. Elsewhere (CI without
 * secrets, local) it only warns.
 */
function checkSupabaseEnv(env: ViteEnv) {
  const problems = getSupabaseEnvProblems(env);
  if (!problems.length) return;
  const message = `Missing or invalid Supabase environment variables. ${problems.join(" ")}`;
  if (process.env.VERCEL) {
    throw new Error(`${message} Set them in Vercel → Project → Settings → Environment Variables.`);
  }
  console.warn(`\n⚠ ${message} The built app will refuse to start until they are set.\n`);
}

type ModuleLookup = (id: string) => { isEntry: boolean; importers: readonly string[] } | null;

const reachCache = new Map<string, boolean>();

/**
 * True when `id` can be reached from an entry module by walking STATIC importers
 * only (`importers` excludes dynamic `import()`), i.e. it is part of the eager graph.
 */
function reachableFromEntry(id: string, getModuleInfo: ModuleLookup): boolean {
  const cached = reachCache.get(id);
  if (cached !== undefined) return cached;
  const seen = new Set<string>();
  const stack = [id];
  let found = false;
  while (stack.length) {
    const current = stack.pop() as string;
    if (seen.has(current)) continue;
    seen.add(current);
    const info = getModuleInfo(current);
    if (!info) continue;
    if (info.isEntry) {
      found = true;
      break;
    }
    for (const importer of info.importers) stack.push(importer);
  }
  reachCache.set(id, found);
  return found;
}

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, process.cwd(), "VITE_");
    logSupabaseEnv(env, mode); // first, so it shows even when the guard fails
    checkSupabaseEnv(env);
  }
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react(), routeHeadPlugin()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id, { getModuleInfo }) => {
            // React core — cargado en cada página, va primero
            if (id.includes("node_modules/react/") ||
                id.includes("node_modules/react-dom/") ||
                id.includes("node_modules/react-router-dom/") ||
                id.includes("node_modules/scheduler/")) {
              return "vendor-react";
            }
            // Supabase — solo páginas que usan auth/db lo piden
            if (id.includes("node_modules/@supabase/")) {
              return "vendor-supabase";
            }
            // Tanstack Query
            if (id.includes("node_modules/@tanstack/")) {
              return "vendor-query";
            }
            // Lucide icons — grande, se comparte entre páginas
            if (id.includes("node_modules/lucide-react/")) {
              return "vendor-icons";
            }
            // Radix UI primitives + class-variance-authority + clsx + tailwind-merge:
            // `vendor-ui` (eager) holds ONLY what the entry chunk reaches through static
            // imports. Anything used just by lazy routes or lazy widgets (the admin shell,
            // dropdown-menu, select, the AI chat demo...) stays in Rollup's own lazy chunks,
            // so adding a Radix primitive to a lazy page cannot grow the eager bundle.
            // There is no package list to maintain.
            if (id.includes("node_modules/@radix-ui/") ||
                id.includes("node_modules/class-variance-authority/") ||
                id.includes("node_modules/clsx/") ||
                id.includes("node_modules/tailwind-merge/")) {
              return reachableFromEntry(id, getModuleInfo) ? "vendor-ui" : undefined;
            }
          },
        },
      },
    },
  };
});
