import { expect, type BrowserContext, type Page, type Route } from "@playwright/test";

// Ayudantes de las pruebas e2e del panel, con Supabase SIMULADO: ninguna petición sale a la red. Todo lo que no es el
// origen de la app se intercepta (auth, REST, funciones) y el resto se aborta. Datos ficticios (usuarios
// `@example.test`). Solo prueba la INTERFAZ: la API real se protege con RLS, que estas pruebas no tocan.
//
// Necesita que la app arranque con cualquier VITE_SUPABASE_URL/clave de prueba (no se contacta); el host del
// proyecto da igual porque se intercepta por ruta (/auth/v1, /rest/v1, /functions/v1), no por host.
//
// Este archivo no es una especificación (no termina en `.spec.ts`): Playwright no lo ejecuta, solo lo importan.

declare global {
  interface Window {
    /** Lo que vio `watchForAdminContent` en el documento actual (se crea desde antes de que cargue la app). */
    __panelSeen: string[];
  }
}

export type Role = 0 | 1 | 2;
export const USERS: Record<Role, { id: string; email: string }> = {
  0: { id: "00000000-0000-4000-8000-000000000000", email: "admin@example.test" },
  1: { id: "00000000-0000-4000-8000-000000000001", email: "colaborador@example.test" },
  2: { id: "00000000-0000-4000-8000-000000000002", email: "cliente@example.test" },
};

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
export const fakeJwt = (sub: string) =>
  `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ sub, role: "authenticated", exp: 4102444800 })}.firma-de-prueba`;

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS",
  "access-control-expose-headers": "*",
};

export interface Mock {
  /**
   * Peticiones REST a algo que no es `profiles`, con la ruta de la página que las lanzó. Solo cuentan las que salen
   * de /dashboard*: la landing pública tiene su propio contador de tickets para el personal (asunto del Navbar).
   */
  dataQueries: { query: string; from: string }[];
}

/** Consultas de datos lanzadas desde una pantalla del panel. */
export const fromPanel = (mock: Mock) =>
  mock.dataQueries.filter((q) => q.from.startsWith("/dashboard")).map((q) => `${q.query} (desde ${q.from})`);

/** Una petición REST a una tabla distinta de `profiles` (el rol lo resuelve el propio simulacro). */
export interface RestRequest {
  /** Tabla o vista, sin el prefijo `/rest/v1/` (por ejemplo `cotizaciones`). */
  table: string;
  method: string;
  url: URL;
}

/** Respuesta a una petición REST. */
export interface RestResponse {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

/**
 * Sirve datos sintéticos de una tabla. Devuelve `undefined` para dejar la respuesta por defecto (`[]`, como si RLS no
 * dejara ver ninguna fila). Se llama para CUALQUIER rol: si una pantalla pidiera datos que no debe, los recibiría y
 * la prueba lo vería en el DOM, no solo en el contador de consultas.
 */
export type RestHandler = (request: RestRequest) => RestResponse | undefined;

/**
 * Simula Supabase. `role` es la cuenta por defecto; si la petición de acceso trae el correo de otra cuenta de USERS,
 * se entrega esa. `profileDelayMs` retrasa la respuesta del rol (la ventana en la que hay sesión pero `userType` aún
 * es null), para todas las cuentas o solo para `delayedRoles`. `rest` sirve datos sintéticos de otras tablas.
 */
export async function mockSupabase(
  context: BrowserContext,
  baseURL: string,
  role: Role,
  profileDelayMs = 0,
  delayedRoles?: readonly Role[],
  rest?: RestHandler,
): Promise<Mock> {
  const origin = new URL(baseURL).origin;
  const roles = [0, 1, 2] as const;
  const mock: Mock = { dataQueries: [] };

  await context.route("**/*", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:") return route.continue();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });

    const json = (body: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({ status: 200, headers: { ...CORS, "content-type": "application/json", ...extra }, body: JSON.stringify(body) });

    const authUser = (user: { id: string; email: string }) => ({
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: "2026-01-01T00:00:00Z",
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-01-01T00:00:00Z",
    });

    if (url.pathname.endsWith("/auth/v1/token")) {
      const email = (request.postDataJSON() as { email?: string } | null)?.email;
      const user = USERS[roles.find((r) => USERS[r].email === email) ?? role];
      return json({
        access_token: fakeJwt(user.id),
        refresh_token: "refresco-de-prueba",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: authUser(user),
      });
    }
    // Usuario de un enlace de acceso: se deduce del `sub` del token que manda el cliente.
    if (url.pathname.endsWith("/auth/v1/user")) {
      const sub = (request.headers()["authorization"] ?? "").split(".")[1];
      const id = sub ? (JSON.parse(Buffer.from(sub, "base64url").toString()) as { sub?: string }).sub : undefined;
      return json(authUser(USERS[roles.find((r) => USERS[r].id === id) ?? role]));
    }
    if (url.pathname.includes("/auth/v1/")) return json({});
    if (url.pathname.includes("/functions/v1/")) return json({});
    if (url.pathname.includes("/rest/v1/")) {
      if (url.pathname.endsWith("/rest/v1/profiles")) {
        const id = url.searchParams.get("id")?.replace(/^eq\./, "");
        const answered = roles.find((r) => USERS[r].id === id) ?? role;
        if (profileDelayMs && (!delayedRoles || delayedRoles.includes(answered))) {
          await new Promise((resolve) => setTimeout(resolve, profileDelayMs));
        }
        return json({ user_type: answered }, { "content-type": "application/vnd.pgrst.object+json" });
      }
      const from = new URL(request.frame().url()).pathname;
      const table = url.pathname.replace(/^.*\/rest\/v1\//, "");
      mock.dataQueries.push({ query: `${request.method()} ${table}`, from });
      const served = rest?.({ table, method: request.method(), url });
      if (served) {
        return route.fulfill({
          status: served.status ?? 200,
          headers: { ...CORS, "content-type": "application/json", ...served.headers },
          body: JSON.stringify(served.body),
        });
      }
      return json([], { "content-range": "*/0" });
    }
    return route.abort();
  });
  return mock;
}

/**
 * Algo que solo existe cuando una pantalla protegida está montada: un elemento que coincide con `selector` y, si hay
 * `text`, cuyo texto (recortado) es exactamente ese.
 */
export interface ContentMark {
  name: string;
  selector: string;
  text?: string;
}

/** Marcas propias del panel: la barra lateral y el contenido del shell, y el título de la pantalla de tickets. */
export const PANEL_MARKS: readonly ContentMark[] = [
  { name: "#admin-sidebar", selector: "#admin-sidebar" },
  { name: "#contenido", selector: "#contenido" },
  { name: "$ tickets", selector: "h1", text: "$ tickets" },
];

/**
 * Registra, desde antes de que cargue la app, si en algún instante existió contenido del panel en el DOM (las marcas
 * del panel y las `extraMarks` que pase cada especificación).
 */
export async function watchForAdminContent(page: Page, extraMarks: readonly ContentMark[] = []) {
  await page.addInitScript((marks: readonly ContentMark[]) => {
    window.__panelSeen = [];
    const check = () => {
      for (const mark of marks) {
        const present = Array.from(document.querySelectorAll(mark.selector)).some(
          (element) => mark.text === undefined || element.textContent?.trim() === mark.text,
        );
        if (present) window.__panelSeen.push(mark.name);
      }
    };
    new MutationObserver(check).observe(document, { childList: true, subtree: true, characterData: true });
    check();
  }, [...PANEL_MARKS, ...extraMarks]);
}

export const panelSeen = (page: Page) => page.evaluate(() => window.__panelSeen);

/** Vacía el registro de `watchForAdminContent` (por ejemplo, tras cerrar sesión, para vigilar solo lo que viene después). */
export const resetPanelSeen = (page: Page) =>
  page.evaluate(() => {
    window.__panelSeen = [];
  });

/** Lo que había en el DOM en un instante: las marcas presentes y si se veía el cargador de marca (el logotipo). */
export interface DomSample {
  marks: string[];
  logo: boolean;
}

/** Muestrea el DOM cada 100 ms durante `durationMs`. Sirve para la ventana en la que el rol aún no llegó. */
export async function sampleDom(page: Page, marks: readonly ContentMark[], durationMs: number): Promise<DomSample[]> {
  const samples: DomSample[] = [];
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    samples.push(
      await page.evaluate((watched: readonly ContentMark[]) => {
        const present = watched
          .filter((mark) =>
            Array.from(document.querySelectorAll(mark.selector)).some(
              (element) => mark.text === undefined || element.textContent?.trim() === mark.text,
            ),
          )
          .map((mark) => mark.name);
        return { marks: present, logo: document.querySelector('img[alt="MultiStack Systems Logo"]') !== null };
      }, marks),
    );
    await page.waitForTimeout(100);
  }
  return samples;
}

export async function signIn(page: Page, role: Role) {
  await page.goto("/login");
  await page.getByLabel(/Email de trabajo/i).fill(USERS[role].email);
  await page.getByLabel(/^Contraseña$/i).fill("clave-de-prueba-1");
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  // Destino propio del rol (el panel solo para el administrador).
  const home = role === 0 ? "/dashboard" : role === 2 ? "/solicitudes" : "/";
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe(home);
}
