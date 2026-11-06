import { test, expect, type BrowserContext, type Page, type Route } from "@playwright/test";

// Acceso al panel por rol, con Supabase SIMULADO: ninguna petición sale a la red. Todo lo que no es el origen de la
// app se intercepta (auth, REST, funciones) y el resto se aborta. Datos ficticios. Solo prueba la INTERFAZ: la API
// real se protege con RLS, que esta prueba no toca.
//
// Necesita que la app arranque con cualquier VITE_SUPABASE_URL/clave de prueba (no se contacta); el host del
// proyecto da igual porque se intercepta por ruta (/auth/v1, /rest/v1, /functions/v1), no por host.

type Role = 0 | 1 | 2;
const USERS: Record<Role, { id: string; email: string }> = {
  0: { id: "00000000-0000-4000-8000-000000000000", email: "admin@example.test" },
  1: { id: "00000000-0000-4000-8000-000000000001", email: "colaborador@example.test" },
  2: { id: "00000000-0000-4000-8000-000000000002", email: "cliente@example.test" },
};

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const fakeJwt = (sub: string) =>
  `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub, role: "authenticated", exp: 4102444800 })}.firma-de-prueba`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
  "access-control-expose-headers": "*",
};

interface Mock {
  /**
   * Peticiones REST a algo que no es `profiles`, con la ruta de la página que las lanzó. Solo cuentan las que salen
   * de /dashboard*: la landing pública tiene su propio contador de tickets para el personal (asunto del Navbar).
   */
  dataQueries: { query: string; from: string }[];
}

/** Consultas de datos lanzadas desde una pantalla del panel. */
const fromPanel = (mock: Mock) =>
  mock.dataQueries.filter((q) => q.from.startsWith("/dashboard")).map((q) => `${q.query} (desde ${q.from})`);

/**
 * Simula Supabase para `role`. `profileDelayMs` retrasa la respuesta del rol: es la ventana en la que hay sesión
 * pero `userType` aún es null.
 */
async function mockSupabase(context: BrowserContext, baseURL: string, role: Role, profileDelayMs = 0): Promise<Mock> {
  const origin = new URL(baseURL).origin;
  const user = USERS[role];
  const mock: Mock = { dataQueries: [] };

  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const json = (body: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });

    if (url.pathname.endsWith("/auth/v1/token")) {
      return json({
        access_token: fakeJwt(user.id),
        refresh_token: "refresco-de-prueba",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: user.id,
          aud: "authenticated",
          role: "authenticated",
          email: user.email,
          email_confirmed_at: "2026-01-01T00:00:00Z",
          app_metadata: {},
          user_metadata: {},
          created_at: "2026-01-01T00:00:00Z",
        },
      });
    }
    if (url.pathname.includes("/auth/v1/")) return json({});
    if (url.pathname.includes("/functions/v1/")) return json({});
    if (url.pathname.includes("/rest/v1/")) {
      if (url.pathname.endsWith("/rest/v1/profiles")) {
        if (profileDelayMs) await new Promise((resolve) => setTimeout(resolve, profileDelayMs));
        return json({ user_type: role }, { "content-type": "application/vnd.pgrst.object+json" });
      }
      const from = new URL(request.frame().url()).pathname;
      mock.dataQueries.push({ query: `${request.method()} ${url.pathname.replace(/^.*\/rest\/v1\//, "")}`, from });
      return json([], { "content-range": "*/0" });
    }
    return route.abort();
  });
  return mock;
}

/** Registra, desde antes de que cargue la app, si en algún instante existió contenido del panel en el DOM. */
async function watchForAdminContent(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __panelSeen: string[] };
    w.__panelSeen = [];
    const check = () => {
      // Marcas propias del panel: la barra lateral y el contenido del shell, y el título de la pantalla de tickets.
      if (document.querySelector("#admin-sidebar")) w.__panelSeen.push("#admin-sidebar");
      if (document.querySelector("#contenido")) w.__panelSeen.push("#contenido");
      if (Array.from(document.querySelectorAll("h1")).some((h) => h.textContent?.trim() === "$ tickets")) w.__panelSeen.push("$ tickets");
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
    check();
  });
}

const panelSeen = (page: Page) => page.evaluate(() => (window as unknown as { __panelSeen: string[] }).__panelSeen);

async function signIn(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByLabel(/Email de trabajo/i).fill(USERS[role].email);
  await page.getByLabel(/^Contraseña$/i).fill("clave-de-prueba-1");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Destino propio del rol (el panel solo para el administrador).
  const home = role === 0 ? "/dashboard" : role === 2 ? "/solicitudes" : "/";
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(home);
}

const PANEL_PATHS = ["/dashboard", "/dashboard/tickets"] as const;

/** Lo que solo existe cuando el panel está montado, por ruta. */
const panelReady = (page: Page, path: (typeof PANEL_PATHS)[number]) =>
  path === "/dashboard" ? page.locator("#contenido") : page.getByRole("heading", { level: 1, name: "$ tickets" });
const DENIED: ReadonlyArray<readonly [Role, string]> = [
  [1, "/"],
  [2, "/solicitudes"],
];

test.describe("Dashboard is administrator-only (UI)", () => {
  for (const path of PANEL_PATHS) {
    test(`administrator (0) opens ${path} directly`, async ({ page, context, baseURL }) => {
      await mockSupabase(context, baseURL!, 0);
      await signIn(page, 0);
      await page.goto(path);
      await expect(panelReady(page, path)).toBeVisible({ timeout: 15000 });
      expect(new URL(page.url()).pathname).toBe(path);
    });

    for (const [role, destination] of DENIED) {
      test(`role ${role} typing ${path} ends on ${destination} and never sees the panel`, async ({ page, context, baseURL }) => {
        const mock = await mockSupabase(context, baseURL!, role);
        await watchForAdminContent(page);
        await signIn(page, role);
        mock.dataQueries.length = 0;

        await page.goto(path);
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destination);

        await expect(panelReady(page, path)).toHaveCount(0);
        expect(await panelSeen(page)).toEqual([]);
        // Ninguna consulta de datos lanzada desde una pantalla del panel.
        expect(fromPanel(mock)).toEqual([]);
      });
    }
  }

  // El hueco real: sesión nueva en la misma pestaña, con el rol aún por resolver (la respuesta del perfil tarda).
  for (const path of PANEL_PATHS) {
    for (const role of [0, 1, 2] as const) {
      test(`role ${role} navigating to ${path} while the role is still resolving`, async ({ page, context, baseURL }) => {
        const mock = await mockSupabase(context, baseURL!, role, 2500);
        await watchForAdminContent(page);

        await page.goto("/login");
        await page.getByLabel(/Email de trabajo/i).fill(USERS[role].email);
        await page.getByLabel(/^Contraseña$/i).fill("clave-de-prueba-1");
        const tokenResponse = page.waitForResponse((r) => r.url().includes("/auth/v1/token"));
        await page.getByRole("button", { name: "Iniciar sesión" }).click();
        await tokenResponse;

        // Navegación dentro de la SPA (como un enlace o el botón «atrás»), con la sesión ya guardada pero el rol sin llegar.
        await page.evaluate((target) => {
          window.history.pushState({}, "", target);
          window.dispatchEvent(new PopStateEvent("popstate"));
        }, path);
        expect(new URL(page.url()).pathname).toBe(path);

        // Captura del DOM durante la resolución: solo el cargador de marca, nada del panel.
        const sampled: string[] = [];
        const deadline = Date.now() + 1500;
        while (Date.now() < deadline) {
          sampled.push(
            await page.evaluate(() => {
              const sidebar = document.querySelector("#admin-sidebar") ? "panel" : "";
              const content = document.querySelector("#contenido") ? "panel" : "";
              const tickets = Array.from(document.querySelectorAll("h1")).some((h) => h.textContent?.trim() === "$ tickets") ? "panel" : "";
              const logo = document.querySelector('img[alt="MultiStack Systems Logo"]') ? "logo" : "";
              return [sidebar, content, tickets, logo].filter(Boolean).join("+") || "vacío";
            }),
          );
          await page.waitForTimeout(100);
        }
        expect(sampled.filter((s) => s.includes("panel"))).toEqual([]);
        expect(sampled).toContain("logo");
        expect(fromPanel(mock)).toEqual([]);

        // El rol llega: el administrador ve el panel; los demás terminan en su destino sin haberlo visto.
        if (role === 0) {
          await expect(panelReady(page, path)).toBeVisible({ timeout: 15000 });
          expect(new URL(page.url()).pathname).toBe(path);
        } else {
          const destination = role === 1 ? "/" : "/solicitudes";
          await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(destination);
          expect(await panelSeen(page)).toEqual([]);
        }
      });
    }
  }
});
