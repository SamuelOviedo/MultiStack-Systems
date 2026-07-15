import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    // Build output, generated artifacts, Deno edge functions (own runtime +
    // globals — not part of the browser app), and design-reference snippets.
    ignores: ["dist", "graph", "supabase/functions", "claude_design"],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // The app casts to `any` at the Supabase/PostgREST boundary because the
      // generated Database types are intentionally partial. Keep this visible
      // as a warning rather than a hard error (project-wide convention).
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // Node/Vite config files legitimately use CommonJS `require()` for plugins.
    files: ["*.config.{ts,js}", "**/*.config.{ts,js}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
