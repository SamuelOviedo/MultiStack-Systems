import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
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
});
