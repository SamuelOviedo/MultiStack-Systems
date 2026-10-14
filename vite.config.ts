import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { getSupabaseEnvProblems } from "./src/integrations/supabase/env";

/**
 * Build-time twin of the runtime guard in src/integrations/supabase/client.ts.
 * On Vercel a missing/placeholder Supabase config FAILS the build, so a deploy
 * that would throw on load never replaces the live one. Elsewhere (CI without
 * secrets, local) it only warns.
 */
function checkSupabaseEnv(mode: string) {
  const problems = getSupabaseEnvProblems(loadEnv(mode, process.cwd(), "VITE_"));
  if (!problems.length) return;
  const message = `Missing or invalid Supabase environment variables. ${problems.join(" ")}`;
  if (process.env.VERCEL) {
    throw new Error(`${message} Set them in Vercel → Project → Settings → Environment Variables.`);
  }
  console.warn(`
⚠ ${message} The built app will refuse to start until they are set.
`);
}

export default defineConfig(({ command, mode }) => {
  if (command === "build") checkSupabaseEnv(mode);
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
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
            // Radix used only by the lazy AI chat demo: no manual chunk, so Rollup
            // keeps them in its lazy chunk instead of the eager vendor-ui.
            if (id.includes("node_modules/@radix-ui/react-scroll-area/") ||
                id.includes("node_modules/@radix-ui/react-avatar/") ||
                id.includes("node_modules/@radix-ui/react-use-is-hydrated/") ||
                id.includes("node_modules/@radix-ui/number/")) {
              return undefined;
            }
            // Radix UI primitives + class-variance-authority + clsx
            if (id.includes("node_modules/@radix-ui/") ||
                id.includes("node_modules/class-variance-authority/") ||
                id.includes("node_modules/clsx/") ||
                id.includes("node_modules/tailwind-merge/")) {
              return "vendor-ui";
            }
          },
        },
      },
    },
  };
});
