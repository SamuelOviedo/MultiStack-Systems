import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// El App real con el supabase-js REAL: solo se falsea `fetch` (como en supabase-client-startup.test.ts). Reproduce el
// hueco que cerraba mal la medición de Google Ads con los enlaces de correo de Supabase Auth:
//
//   1. El enlace aterriza en «/» o en «/paginas-web» con `#access_token=…` (o `#error=…`).
//   2. src/integrations/supabase/client.ts lee el hash con supabase-js y quita el hash de la URL ANTES del primer render.
//   3. supabase-js guarda la sesión en localStorage MÁS TARDE, cuando responde /auth/v1/user.
//
// Entre el paso 2 y el 3 la URL está limpia y localStorage vacío: ni hasAuthCredentialsInUrl() ni hasStoredSession()
// frenan nada, y solo hadAuthRedirectAtStartup() delata el enlace. Aquí /auth/v1/user queda retenido en una promesa
// diferida y se suelta después del primer commit, como haría una red lenta. Todo con valores de PRUEBA.
//
// Independiente del orden de ejecución: cada test usa su propio host de Supabase y el `fetch` falso es el mismo todo el
// archivo. Una petición que llega tarde de un cliente de un test anterior (postgrest-js reintenta los GET/HEAD que
// fallan, p. ej. el conteo de tickets del Navbar) se reconoce por su host y se ignora, en vez de contaminar el test
// siguiente. Las peticiones legítimas de la app dentro del propio test (perfil, correo de bienvenida, conteo de
// tickets) se responden; cualquier otra cosa hace fallar el test.

/**
 * Cada test tiene SU host (qa-links-<n>.supabase.co) y supabase-js lo lee de VITE_SUPABASE_URL al crear el cliente. Así
 * una petición tardía de un cliente de un test anterior (p. ej. el conteo de tickets del Navbar, que espera el candado
 * de la sesión) se reconoce por su host y no contamina las aserciones del test que corre después, sea cual sea el orden.
 */
const HOST_PATTERN = /^https:\/\/qa-links-\d+\.supabase\.co(?=\/|$)/;
let testNumber = 0;
/** Host del test en curso (el del último test mientras no empiece otro). */
let HOST = "";
const USER = {
  id: "usuario-prueba",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

// Identificadores de PRUEBA: nunca los reales de la cuenta de Google Ads.
const TAG_ID = "AW-1000000000";
const SEND_TO = "AW-1000000000/PRUEBA";
const ORIGIN = window.location.origin;
/** Tope de espera de los chunks lazy y de supabase-js; cada test termina en cuanto aparece lo que espera. */
const WAIT = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

const tokenFragment = (type: string): string =>
  `#access_token=PRUEBA&refresh_token=PRUEBA&expires_in=3600&token_type=bearer&type=${type}`;
const EXPIRED_FRAGMENT = "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired";

interface AuthLink {
  /** Tipo de enlace (el `type` del hash, u `otp_expired` para el enlace caducado). */
  name: string;
  hash: string;
  /** "session": trae tokens y supabase-js acaba guardando una sesión. "error": no hay sesión nunca. */
  kind: "session" | "error";
}

const LINKS: AuthLink[] = [
  { name: "recovery", hash: tokenFragment("recovery"), kind: "session" },
  { name: "signup", hash: tokenFragment("signup"), kind: "session" },
  { name: "invite", hash: tokenFragment("invite"), kind: "session" },
  { name: "magiclink", hash: tokenFragment("magiclink"), kind: "session" },
  { name: "email_change", hash: tokenFragment("email_change"), kind: "session" },
  { name: "otp_expired", hash: EXPIRED_FRAGMENT, kind: "error" },
];

// ---- red: solo fetch, y /auth/v1/user retenido hasta que el test lo suelte ----

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

/** Peticiones del cliente del test en curso (las únicas que cuentan para las aserciones). */
const requests: Array<{ method: string; url: string }> = [];
/** Peticiones a cualquier sitio que no sea un host qa-links-<n>: eso sí es un fallo del test. */
const unexpected: string[] = [];
/** Peticiones tardías de clientes de tests anteriores (o del propio test ya terminado): se ignoran. */
const stale: string[] = [];
let releaseUser: () => void = () => {};
let gate: Promise<void> = Promise.resolve();
let testInProgress = false;

/**
 * El único `fetch` del archivo, instalado en beforeAll y retirado en afterAll: ninguna petición de un cliente que
 * sobrevive a su test puede escapar a la red real. supabase-js lee el `fetch` global en CADA llamada, así que sin el
 * host único por test una petición tardía de un cliente viejo caería en el stub del test siguiente.
 */
function dispatchFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? "GET").toUpperCase();
  const host = HOST_PATTERN.exec(url)?.[0];
  if (host === undefined) {
    unexpected.push(`${method} ${url}`);
    return Promise.reject(new Error(`petición inesperada en el test: ${method} ${url}`));
  }
  if (host !== HOST || !testInProgress) {
    stale.push(`${method} ${url}`);
    return new Promise<Response>(() => {}); // el cliente viejo se queda esperando: ya nadie lo escucha
  }
  requests.push({ method, url });
  if (method === "GET" && url === `${HOST}/auth/v1/user`) return gate.then(() => json(USER));
  if (method === "GET" && url.startsWith(`${HOST}/rest/v1/profiles?`)) return Promise.resolve(json({ user_type: 2 }));
  if (method === "POST" && url === `${HOST}/functions/v1/send-welcome-email`) return Promise.resolve(json({}));
  // El Navbar pide el conteo de tickets en el hueco entre setUser y setUserType de useAuth: es ajeno a la etiqueta.
  if (method === "HEAD" && url.startsWith(`${HOST}/rest/v1/tickets?`)) {
    return Promise.resolve(new Response(null, { status: 200, headers: { "Content-Range": "*/0" } }));
  }
  unexpected.push(`${method} ${url}`);
  return Promise.reject(new Error(`petición inesperada en el test: ${method} ${url}`));
}

/** Empieza un test: host nuevo, listas vacías y /auth/v1/user retenido hasta que el test lo suelte. */
function startTestNetwork(): void {
  testNumber += 1;
  HOST = `https://qa-links-${testNumber}.supabase.co`;
  requests.length = 0;
  stale.length = 0;
  gate = new Promise<void>((resolve) => {
    releaseUser = resolve;
  });
  testInProgress = true;
}

const profileRequested = (): boolean => requests.some((request) => request.url.startsWith(`${HOST}/rest/v1/profiles?`));

// ---- DOM de la etiqueta ----

const gtagScripts = (): HTMLScriptElement[] =>
  Array.from(document.querySelectorAll<HTMLScriptElement>("script[src*=googletagmanager]"));

/** Entradas del dataLayer como arreglos: gtag las empuja como objetos Arguments. */
const layerEntries = (): unknown[][] => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

const pageViews = (): Array<{ page_location: string; page_referrer: string }> =>
  layerEntries()
    .filter((entry) => entry[0] === "event" && entry[1] === "page_view")
    .map((entry) => entry[2] as { page_location: string; page_referrer: string });

/** Ni script de Google, ni window.gtag, ni window.dataLayer. */
function expectNoTag(): void {
  expect(gtagScripts()).toHaveLength(0);
  expect(window.gtag).toBeUndefined();
  expect(window.dataLayer).toBeUndefined();
}

/** jsdom no descarga <script src>: el load de gtag.js se simula sobre NUESTRO script (debe haber exactamente uno). */
function fireTagLoad(): void {
  expect(gtagScripts(), "debe haber un único script de gtag.js").toHaveLength(1);
  gtagScripts()[0].dispatchEvent(new Event("load"));
}

const storedSessionKeys = (): string[] => Object.keys(localStorage).filter((key) => /^sb-.+-auth-token$/.test(key));

/** Deja correr los temporizadores de 0 ms de supabase-js y de React (los eventos de auth se notifican con setTimeout). */
const settle = (): Promise<void> =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

// ---- montaje ----

function resetPage(): void {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
  sessionStorage.clear();
  document.querySelectorAll("script").forEach((script) => script.remove());
  Reflect.deleteProperty(window, "gtag");
  Reflect.deleteProperty(window, "dataLayer");
  Reflect.deleteProperty(document, "referrer");
  window.history.pushState({}, "", "/");
}

// Los chunks lazy y los eventos de supabase-js se resuelven fuera de act() y se esperan con findBy*/waitFor; con el
// entorno de act activo React avisa de cada resolución (ruido, no fallos). render y fireEvent siguen dentro de act.
type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let actEnvironmentBefore: boolean | undefined;

beforeAll(() => {
  actEnvironmentBefore = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
  vi.stubGlobal("fetch", dispatchFetch);
});

afterAll(() => {
  vi.unstubAllGlobals();
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironmentBefore;
  expect(unexpected.splice(0), "ninguna petición fuera de las simuladas, tampoco después del último test").toEqual([]);
});

type SupabaseClient = typeof import("@/integrations/supabase/client").supabase;
let client: SupabaseClient | undefined;

beforeEach(() => {
  resetPage();
  // Cada recarga de módulos crea otro GoTrueClient: se silencia el aviso de «varias instancias».
  vi.spyOn(console, "warn").mockImplementation(() => {});
  startTestNetwork();
});

afterEach(async () => {
  releaseUser(); // un test que falló antes de soltarlo no deja la promesa colgada
  cleanup();
  // dispose(): para el temporizador de renovación, quita el listener de visibilitychange, cierra el BroadcastChannel y
  // vacía los suscriptores del GoTrueClient de este test.
  await client?.auth.dispose();
  client = undefined;
  testInProgress = false; // desde aquí, lo que aún llegue de este cliente es una petición tardía
  const stray = unexpected.splice(0);
  resetPage();
  expect(stray, "ningún test debe hacer peticiones fuera de las simuladas").toEqual([]);
});

/**
 * Monta el App con módulos nuevos (una carga de página nueva) en `url`, que puede llevar el hash del enlace. Al importar
 * el App se ejecuta client.ts de verdad: captureAuthRedirect -> createClient (supabase-js lee la URL) -> stripAuthRedirectFromUrl.
 */
async function mountApp(url: string): Promise<void> {
  vi.stubEnv("VITE_SUPABASE_URL", HOST);
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "qa-fake-publishable-key");
  vi.stubEnv("VITE_GADS_ID", TAG_ID);
  vi.stubEnv("VITE_GADS_CONTACT_LABEL", SEND_TO);
  vi.resetModules();
  window.history.pushState({}, "", url);
  const { default: App } = await import("@/App");
  ({ supabase: client } = await import("@/integrations/supabase/client"));
  await act(async () => {
    render(<App />);
  });
}

const findHome = () => screen.findByRole("heading", { level: 1, name: /Tu operación/ }, WAIT);
const findLanding = () => screen.findByRole("heading", { level: 1, name: "Páginas web en Honduras" }, WAIT);
const findLogin = () => screen.findByRole("heading", { level: 2, name: "Iniciar sesión" }, WAIT);
/** /auth/update-password con una recuperación pendiente: el formulario para elegir la contraseña nueva. */
const findNewPasswordForm = () => screen.findByRole("heading", { level: 2, name: "Crea una nueva contraseña" }, WAIT);
/** /auth/update-password con un enlace rechazado (otp_expired). */
const findInvalidLink = () => screen.findByRole("heading", { level: 2, name: "Enlace no válido" }, WAIT);

const click = (role: "link" | "button", name: string): void => {
  fireEvent.click(screen.getAllByRole(role, { name })[0]);
};

const LANDINGS: Array<{ path: string; find: () => Promise<HTMLElement> }> = [
  { path: "/", find: findHome },
  { path: "/paginas-web", find: findLanding },
];

const CASES = LINKS.flatMap((link) => LANDINGS.map((landing) => ({ link, landing })));

describe("App con supabase-js real · un enlace de correo de auth aterriza en una ruta de la lista blanca", () => {
  it.each(CASES)(
    "$link.name en $landing.path: la etiqueta de Google no se carga en ningún momento",
    async ({ link, landing }) => {
      await mountApp(`${landing.path}${link.hash}`);

      // Momento 1: tras el primer commit, con /auth/v1/user retenido. La precondición del fallo: client.ts ya limpió la
      // URL y todavía no hay sesión guardada, así que las otras tres guardas no frenarían la medición.
      expect(window.location.hash).toBe("");
      expect(window.location.href).not.toMatch(/access_token|refresh_token|error_code|error_description/);
      expect(storedSessionKeys()).toEqual([]);
      expectNoTag();

      if (link.kind === "error") {
        // El enlace caducado no trae sesión: RecoveryRedirect lleva a la pantalla de «enlace no válido» en su primer efecto.
        expect(await findInvalidLink()).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/update-password");
        expectNoTag();

        // Ya sin hash, sin sesión y de vuelta en una ruta de la lista blanca por el SPA: solo la marca de arranque frena.
        click("link", "Volver al inicio de sesión");
        expect(await findLogin()).toBeInTheDocument();
        click("link", "Volver al inicio");
        expect(await findHome()).toBeInTheDocument();
        expect(window.location.pathname).toBe("/");
        expect(storedSessionKeys()).toEqual([]);
        expectNoTag();
        return;
      }

      // La pantalla de destino se ve mientras /auth/v1/user sigue retenido.
      expect(await landing.find()).toBeInTheDocument();
      expect(window.location.pathname).toBe(landing.path);
      expectNoTag();

      // Momento 2: supabase-js recibe la respuesta y guarda la sesión en localStorage.
      releaseUser();
      await waitFor(() => expect(storedSessionKeys()).toHaveLength(1), WAIT);
      expectNoTag();
      await waitFor(() => expect(profileRequested()).toBe(true), WAIT);
      await settle();
      expectNoTag();

      if (link.name === "recovery") {
        // Momento 3: RecoveryRedirect salta a la pantalla de la contraseña nueva.
        expect(await findNewPasswordForm()).toBeInTheDocument();
        expect(window.location.pathname).toBe("/auth/update-password");
        expectNoTag();
      } else {
        expect(window.location.pathname).toBe(landing.path);
      }
    },
    TEST_TIMEOUT,
  );

  // Sin este control los 12 casos de arriba podrían pasar porque la etiqueta nunca se carga en esta configuración.
  it.each(LANDINGS)(
    "control: un anónimo en $path sin hash sí inyecta el script y, tras el load, envía el page_view",
    async ({ path, find }) => {
      await mountApp(path);
      expect(await find()).toBeInTheDocument();

      expect(gtagScripts()).toHaveLength(1);
      expect(gtagScripts()[0].getAttribute("src")).toBe(`https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`);
      expect(window.gtag).toBeUndefined(); // hasta el load no existe nada más
      expect(window.dataLayer).toBeUndefined();

      fireTagLoad();
      expect(layerEntries().map((entry) => entry[0])).toEqual(["js", "config", "event"]);
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}${path}`, page_referrer: "" }]);
      expect(requests).toEqual([]); // sin enlace no hay llamadas a Supabase
    },
    TEST_TIMEOUT,
  );
});

// El stub de red es parte de lo que se prueba aquí: postgrest-js reintenta (con espera) los GET y HEAD que fallan, y
// supabase-js lee el `fetch` global en cada llamada. Si el stub dejara de aislar lo que llega tarde de otro test, los
// casos de arriba pasarían o fallarían según el orden de ejecución.
describe("stub de red del archivo", () => {
  it("una petición tardía de un cliente de otro test se ignora; una a un sitio ajeno cuenta como inesperada", async () => {
    const otherTestHost = `https://qa-links-${testNumber + 1000}.supabase.co`;
    const lateRequest = `HEAD ${otherTestHost}/rest/v1/tickets?select=*`;
    let settled = false;
    const finish = (): void => {
      settled = true;
    };
    void fetch(`${otherTestHost}/rest/v1/tickets?select=*`, { method: "HEAD" }).then(finish, finish);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false); // el cliente viejo se queda esperando: no recibe respuesta ni error que reintentar
    // Por contención: en esta ventana también puede llegar una petición tardía REAL del test anterior, que es justo lo
    // que el stub aísla y acaba en `stale`. Solo se exige que la nuestra esté (una vez) y que no cuente como otra cosa.
    expect(stale.filter((entry) => entry === lateRequest)).toHaveLength(1);
    expect(unexpected).not.toContain(lateRequest);
    expect(requests).toEqual([]); // este test no tiene cliente: nada puede ser del host en curso

    const foreignRequest = "GET https://example.test/x";
    await expect(fetch("https://example.test/x")).rejects.toThrow("petición inesperada");
    expect(unexpected.filter((entry) => entry === foreignRequest)).toHaveLength(1);
    expect(stale).not.toContain(foreignRequest);
    // Provocada a propósito: se consume SOLO esa entrada, para que el afterEach siga fallando ante cualquier otra.
    unexpected.splice(unexpected.indexOf(foreignRequest), 1);
  });
});
