import { defineConfig, devices } from "@playwright/test";

// Puerto del servidor de Vite de las pruebas. Por defecto, 8080 (el de `npm run dev`, que se reutiliza si ya está
// levantado). Con `E2E_PORT=<otro>` se arranca un servidor propio en ese puerto, con `--strictPort`, y NUNCA se reutiliza
// uno existente: así se puede ejecutar la suite mientras otra sesión tiene su propio servidor en el 8080 sin tocarlo ni
// apuntar las pruebas a él.
const PORT = Number(process.env.E2E_PORT ?? 8080);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error(`E2E_PORT debe ser un puerto entre 1024 y 65535 (recibido: ${process.env.E2E_PORT}).`);
}
const PUERTO_PROPIO = process.env.E2E_PORT !== undefined;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: PUERTO_PROPIO ? `npm run dev -- --port ${PORT} --strictPort` : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI && !PUERTO_PROPIO,
    timeout: 30000,
  },
});
