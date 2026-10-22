import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock, MockInstance } from "vitest";
import appSource from "@/App.tsx?raw";

// El App real (export por defecto de src/App.tsx: BrowserRouter, AuthProvider, Suspense, rutas lazy y
// AdsTagRouteSync) con lib/analytics real. Solo se sustituye el cliente de Supabase (como useAuth.test.tsx): sin
// sesión, sin tablas y sin red; cada test comprueba además que no hubo fetch ni XMLHttpRequest. El cliente real
// (con supabase-js) se recorre en app-ads-auth-links.test.tsx.
//
// jsdom no descarga <script src>: el load de gtag.js se simula con fireTagLoad(). Hasta ese evento no existen
// window.gtag ni window.dataLayer (la etiqueta guarda sus comandos en una cola privada).

// Sesión que devuelve getSession(). Por defecto null (nadie ha entrado): solo los tests de la recuperación de
// contraseña la fijan, y resetPage() la devuelve a null. Con `hold`, getSession() espera a esa promesa (como la
// respuesta lenta de /auth/v1/user): el test observa el primer commit y la suelta cuando quiere; resetPage() la quita.
const authSwitch = vi.hoisted(() => ({
  session: null as { user: { id: string } } | null,
  hold: null as Promise<void> | null,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () =>
        authSwitch.hold
          ? authSwitch.hold.then(() => ({ data: { session: authSwitch.session } }))
          : Promise.resolve({ data: { session: authSwitch.session } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve({ error: null }),
      exchangeCodeForSession: () => Promise.resolve({ data: null, error: new Error("intercambio simulado") }),
    },
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    rpc: () => Promise.resolve({ data: null, error: { message: "portal simulado" } }),
    from: () => {
      throw new Error("supabase.from no está simulado: sin sesión nadie debe consultar tablas");
    },
  },
}));

// Identificadores de PRUEBA: nunca los reales de la cuenta de Google Ads.
const TAG_ID = "AW-1000000000";
const SEND_TO = "AW-1000000000/PRUEBA";
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`;
const ORIGIN = window.location.origin;
const GOOGLE_REFERRER = "https://www.google.com/search?q=x";
/** Forma típica de un gclid real, con valor de PRUEBA: 90 caracteres con letras, dígitos, guion y guion bajo. */
const TYPICAL_CLICK_ID = "Cj0KCQiA0eO8BhDfARIsAL6xmuSDEEZqY_tF6nLDmTK-J4hm2Nq7rP1sUvWxYzaB3_-xY9_Qw-ErTy_UiOp-AsDfGh";
/** Tope de espera de los chunks lazy; cada test termina en cuanto aparecen. */
const WAIT = { timeout: 15000 };
const TEST_TIMEOUT = 30000;

const setReferrer = (value: string): void => {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => value });
};

/** next-themes inyecta un <script> en línea; los de Google siempre llevan src. */
const externalScripts = (): HTMLScriptElement[] => Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
/** Compara el host de la URL, no el texto: «https://otro.test/www.googletagmanager.com/…» no es el script de Google. */
const isGoogleTagHost = (src: string): boolean => {
  try {
    return new URL(src).hostname === "www.googletagmanager.com";
  } catch {
    return false;
  }
};
const gtagScripts = (): HTMLScriptElement[] => externalScripts().filter((script) => isGoogleTagHost(script.src));

/** Simula el load de gtag.js sobre NUESTRO script; falla si no hay exactamente uno, para no disparar un evento que nadie escucha. */
function fireTagLoad(): void {
  expect(gtagScripts(), "debe haber un único script de gtag.js").toHaveLength(1);
  gtagScripts()[0].dispatchEvent(new Event("load"));
}

/** Entradas del dataLayer como arreglos: gtag las empuja como objetos Arguments. */
const layerEntries = (): unknown[][] => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

const pageViews = (): Array<{ page_location: string; page_referrer: string }> =>
  layerEntries()
    .filter((entry) => entry[0] === "event" && entry[1] === "page_view")
    .map((entry) => entry[2] as { page_location: string; page_referrer: string });

function expectNothingLoaded(): void {
  expect(externalScripts()).toHaveLength(0);
  expect(window.gtag).toBeUndefined();
  expect(window.dataLayer).toBeUndefined();
}

function resetPage(): void {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
  authSwitch.session = null;
  authSwitch.hold = null;
  document.querySelectorAll("script").forEach((script) => script.remove());
  Reflect.deleteProperty(window, "gtag");
  Reflect.deleteProperty(window, "dataLayer");
  Reflect.deleteProperty(document, "referrer");
  window.history.pushState({}, "", "/");
}

// Los chunks lazy y el getSession() de AuthProvider se resuelven fuera de act() y se esperan con findBy*/waitFor; con
// el entorno de act activo React avisa de cada resolución (ruido, no fallos). render y fireEvent siguen dentro de act.
type ActGlobal = typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let actEnvironmentBefore: boolean | undefined;

beforeAll(() => {
  actEnvironmentBefore = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
});

afterAll(() => {
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnvironmentBefore;
});

let fetchSpy: Mock;
let xhrOpenSpy: MockInstance;

beforeEach(() => {
  resetPage();
  fetchSpy = vi.fn(() => Promise.reject(new Error("sin red en tests")));
  vi.stubGlobal("fetch", fetchSpy);
  xhrOpenSpy = vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => {
    throw new Error("sin red en tests");
  });
});

afterEach(() => {
  const attempts = [
    ...fetchSpy.mock.calls.map((call) => `fetch ${String(call[0])}`),
    ...xhrOpenSpy.mock.calls.map((call) => `XHR ${String(call[1])}`),
  ];
  resetPage();
  expect(attempts, "ningún test del App debe tocar la red").toEqual([]);
});

interface MountOptions {
  /**
   * Aplica lo que src/integrations/supabase/client.ts hace al arrancar y aquí está simulado (captureAuthRedirect y,
   * tras crear el cliente, stripAuthRedirectFromUrl), sobre la MISMA instancia de authRedirect que usará el App:
   * al primer render el hash del enlace de correo ya no está en la URL y hadAuthRedirectAtStartup() queda puesto.
   */
  clientStartup?: boolean;
}

/** Monta el App con módulos nuevos (estado de analytics en cero) y las variables de prueba fijadas. */
async function mountApp(url: string, { clientStartup = false }: MountOptions = {}): Promise<void> {
  vi.stubEnv("VITE_GADS_ID", TAG_ID);
  vi.stubEnv("VITE_GADS_CONTACT_LABEL", SEND_TO);
  vi.resetModules();
  window.history.pushState({}, "", url);
  if (clientStartup) {
    const authRedirect = await import("@/lib/authRedirect"); // mismo registro de módulos que el App de abajo
    authRedirect.captureAuthRedirect();
    authRedirect.stripAuthRedirectFromUrl();
  }
  const { default: App } = await import("@/App");
  await act(async () => {
    render(<App />);
  });
}

const findHome = () => screen.findByRole("heading", { level: 1, name: /Tu operación/ }, WAIT);
const findLanding = () => screen.findByRole("heading", { level: 1, name: "Páginas web en Honduras" }, WAIT);
const findPrivacy = () => screen.findByRole("heading", { level: 1, name: "Política de Privacidad" }, WAIT);
const findTerms = () => screen.findByRole("heading", { level: 1, name: "Términos del Servicio" }, WAIT);
const findLogin = () => screen.findByRole("heading", { level: 2, name: "Iniciar sesión" }, WAIT);
/** /auth/update-password sin sesión de recuperación: la pantalla solo ofrece pedir un enlace nuevo. */
const findNoRecoverySession = () =>
  screen.findByRole("heading", { level: 2, name: "Necesitas un enlace de recuperación" }, WAIT);
/** /auth/update-password con una recuperación pendiente: el formulario para elegir la contraseña nueva. */
const findNewPasswordForm = () => screen.findByRole("heading", { level: 2, name: "Crea una nueva contraseña" }, WAIT);

/** Clic en el primer elemento con ese rol y nombre (la página legal repite «Volver al inicio» arriba y abajo). */
const click = (role: "link" | "button", name: string): void => {
  fireEvent.click(screen.getAllByRole(role, { name })[0]);
};

/** El enlace del logo en el Navbar (href="/"): su nombre accesible incluye el alt de la imagen. */
const clickNavbarLogo = (): void => {
  const logo = within(screen.getByRole("navigation", { name: "Principal" }))
    .getAllByRole("link")
    .find((link) => link.getAttribute("href") === "/");
  expect(logo, "el Navbar debe tener el enlace del logo").toBeDefined();
  if (logo) fireEvent.click(logo);
};

describe("App · /paginas-web (ruta lazy registrada)", () => {
  it(
    "muestra la landing y carga UN script de gtag con config y page_view saneados",
    async () => {
      await mountApp("/paginas-web");
      expect(await findLanding()).toBeInTheDocument();

      const scripts = gtagScripts();
      expect(scripts).toHaveLength(1);
      expect(scripts[0].getAttribute("src")).toBe(GTAG_SRC);
      expect(scripts[0].async).toBe(true);
      expect(externalScripts()).toHaveLength(1);
      expect(window.gtag).toBeUndefined(); // hasta el load, ni gtag ni dataLayer
      expect(window.dataLayer).toBeUndefined();
      fireTagLoad();

      const location = `${ORIGIN}/paginas-web`;
      expect(layerEntries().map((entry) => entry[0])).toEqual(["js", "config", "event"]);
      expect(layerEntries()[1]).toEqual([
        "config",
        TAG_ID,
        {
          send_page_view: false,
          allow_enhanced_conversions: false,
          allow_ad_personalization_signals: false,
          page_location: location,
          page_referrer: "",
        },
      ]);
      expect(layerEntries()[2]).toEqual(["event", "page_view", { page_location: location, page_referrer: "" }]);
    },
    TEST_TIMEOUT,
  );

  it(
    "con parámetros de campaña solo sale el gclid, y el referrer externo se reduce a su origen",
    async () => {
      setReferrer(GOOGLE_REFERRER);
      await mountApp("/paginas-web?gclid=PRUEBA&utm_source=x&token=SECRET");
      expect(await findLanding()).toBeInTheDocument();

      const location = `${ORIGIN}/paginas-web?gclid=PRUEBA`;
      expect(gtagScripts()).toHaveLength(1);
      fireTagLoad();
      expect(pageViews()).toEqual([{ page_location: location, page_referrer: "https://www.google.com/" }]);
      expect((layerEntries()[1][2] as { page_location: string }).page_location).toBe(location);
      expect(JSON.stringify(layerEntries())).not.toMatch(/SECRET|utm_source|search\?q/);
    },
    TEST_TIMEOUT,
  );
});

describe("App · las otras rutas públicas lazy (legales)", () => {
  it.each([
    ["/politica-de-privacidad", findPrivacy],
    ["/terminos-del-servicio", findTerms],
  ])(
    "%s carga UN script con su page_view",
    async (path, findPage) => {
      await mountApp(path);
      expect(await findPage()).toBeInTheDocument();
      expect(gtagScripts()).toHaveLength(1);
      fireTagLoad();
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}${path}`, page_referrer: "" }]);
    },
    TEST_TIMEOUT,
  );
});

describe("App · «/» y navegación dentro del SPA", () => {
  it(
    "«/» muestra la home y carga UN script con un page_view",
    async () => {
      await mountApp("/");
      expect(await findHome()).toBeInTheDocument();
      expect(gtagScripts()).toHaveLength(1);
      expect(gtagScripts()[0].getAttribute("src")).toBe(GTAG_SRC);
      fireTagLoad();
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
    },
    TEST_TIMEOUT,
  );

  it(
    "«/» → Política de Privacidad (clic en el pie) → «/» (Volver al inicio): un solo script y un page_view por visita permitida",
    async () => {
      await mountApp("/");
      await findHome();
      fireTagLoad();
      expect(pageViews()).toHaveLength(1);

      click("button", "Política de Privacidad");
      expect(await findPrivacy()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/politica-de-privacidad");

      click("link", "Volver al inicio");
      expect(await findHome()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/");

      expect(gtagScripts()).toHaveLength(1);
      expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
      expect(pageViews()).toEqual([
        { page_location: `${ORIGIN}/`, page_referrer: "" },
        { page_location: `${ORIGIN}/politica-de-privacidad`, page_referrer: `${ORIGIN}/` },
        { page_location: `${ORIGIN}/`, page_referrer: `${ORIGIN}/politica-de-privacidad` },
      ]);
    },
    TEST_TIMEOUT,
  );

  // Desde la home no hay ningún enlace a /paginas-web (el anuncio apunta directo a esa ruta): la ida se hace con
  // el clic en el logo y la vuelta con el botón Atrás del navegador, que el router atiende por popstate.
  it(
    "/paginas-web → «/» (clic en el logo) → /paginas-web (Atrás): un solo script y un page_view por visita permitida",
    async () => {
      await mountApp("/paginas-web");
      await findLanding();
      fireTagLoad();

      clickNavbarLogo();
      expect(await findHome()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/");

      window.history.back();
      await waitFor(() => expect(pageViews()).toHaveLength(3), WAIT);
      expect(await findLanding()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/paginas-web");

      expect(gtagScripts()).toHaveLength(1);
      expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
      expect(pageViews()).toEqual([
        { page_location: `${ORIGIN}/paginas-web`, page_referrer: "" },
        { page_location: `${ORIGIN}/`, page_referrer: `${ORIGIN}/paginas-web` },
        { page_location: `${ORIGIN}/paginas-web`, page_referrer: `${ORIGIN}/` },
      ]);
    },
    TEST_TIMEOUT,
  );
});

describe("App · rutas privadas y redirecciones: nada se carga", () => {
  it.each(["/dashboard", "/dashboard/tickets", "/dashboard/project/abc", "/solicitudes"])(
    "%s sin sesión: ProtectedRoute redirige a /login y no hay script ni dataLayer",
    async (path) => {
      await mountApp(path);
      expect(await findLogin()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/login");
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );

  it.each([
    ["/login", "Iniciar sesión"],
    ["/signup", "Crear cuenta"],
  ])(
    "%s directo: ni script ni dataLayer",
    async (path, heading) => {
      await mountApp(path);
      expect(await screen.findByRole("heading", { level: 2, name: heading }, WAIT)).toBeInTheDocument();
      expect(window.location.pathname).toBe(path);
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );

  it.each(["/auth/callback", "/auth/callback?code=SECRET"])(
    "%s redirige en su primer efecto a /login: ni script ni dataLayer",
    async (url) => {
      await mountApp(url);
      expect(await findLogin()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/login");
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );

  it(
    "/client/<token>: el portal real se monta y no hay script ni dataLayer",
    async () => {
      await mountApp("/client/SECRET-TOKEN?gclid=ZZZ");
      // El portal pide el proyecto con rpc(): el cliente simulado responde con error y la página lo muestra.
      expect(await screen.findByText("acceso_no_válido", {}, WAIT)).toBeInTheDocument();
      expect(window.location.pathname).toBe("/client/SECRET-TOKEN");
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );

  it(
    "desde la home, ir a /login por un enlace no suma eventos; al volver a «/» la visita nueva sale sin referrer",
    async () => {
      await mountApp("/");
      await findHome();
      fireTagLoad();
      const before = layerEntries().length;
      expect(before).toBe(3); // js, config y el page_view de «/»
      expect(gtagScripts()).toHaveLength(1);

      click("link", "[ ACCEDER ]");
      expect(await findLogin()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/login");
      expect(layerEntries()).toHaveLength(before);
      expect(gtagScripts()).toHaveLength(1);

      click("link", "Volver al inicio");
      expect(await findHome()).toBeInTheDocument();
      expect(gtagScripts()).toHaveLength(1);
      expect(pageViews()).toEqual([
        { page_location: `${ORIGIN}/`, page_referrer: "" },
        { page_location: `${ORIGIN}/`, page_referrer: "" },
      ]);
    },
    TEST_TIMEOUT,
  );

  // El script de Google carga en segundo plano: si la persona ya salió a /login cuando llega el load, gtag.js no debe
  // ver esa URL ni procesar nada. El load descarta la cola y la etiqueta queda inerte el resto de la carga de página.
  it(
    "anónimo en «/», va a /login por un enlace y solo después llega el load del script: no hay gtag ni page_view, tampoco al volver a «/»",
    async () => {
      await mountApp("/");
      await findHome();
      expect(gtagScripts()).toHaveLength(1); // inyectado: la etiqueta está pendiente de su load
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();

      click("link", "[ ACCEDER ]");
      expect(await findLogin()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/login");

      fireTagLoad();
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
      expect(pageViews()).toEqual([]);

      click("link", "Volver al inicio");
      expect(await findHome()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
      fireTagLoad(); // un load tardío o repetido tampoco la resucita
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
      expect(gtagScripts()).toHaveLength(1);
    },
    TEST_TIMEOUT,
  );
});

// La pantalla de la contraseña nueva es una ruta real del App (se llega por el enlace del correo) y no está en la
// lista blanca: ni carga la etiqueta ni suma page_views, entrando directo o viniendo de una ruta permitida.
describe("App · /auth/update-password (recuperación de contraseña): fuera de la lista blanca", () => {
  it.each(["/auth/update-password", "/auth/update-password?gclid=PRUEBA"])(
    "%s directo: la pantalla se ve pero no hay script ni dataLayer",
    async (url) => {
      await mountApp(url);
      expect(await findNoRecoverySession()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/auth/update-password");
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );

  // Desde la home no hay enlace a esta ruta: se deja la entrada en el historial y se vuelve a ella con Atrás, el
  // mismo mecanismo que usa el test de /paginas-web.
  it(
    "«/» → /auth/update-password (Atrás): el page_view de «/» queda como único evento y la pantalla nueva no suma ninguno",
    async () => {
      window.history.pushState({}, "", "/auth/update-password");
      await mountApp("/");
      await findHome();
      fireTagLoad(); // la etiqueta termina de cargar mientras la persona sigue en «/»
      const before = layerEntries();
      expect(before).toHaveLength(3); // js, config y el page_view de «/»
      expect(gtagScripts()).toHaveLength(1);
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);

      window.history.back();
      expect(await findNoRecoverySession()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/auth/update-password");

      expect(gtagScripts()).toHaveLength(1);
      expect(layerEntries()).toEqual(before);
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
    },
    TEST_TIMEOUT,
  );

  // Lo mismo, pero el load del script llega cuando la persona ya está en la pantalla de la contraseña nueva: gtag.js no
  // debe procesar nada con esa URL, así que el load lo descarta todo (antes se habría enviado el page_view de «/»).
  it(
    "«/» → /auth/update-password (Atrás) y solo después el load del script: no hay gtag ni dataLayer",
    async () => {
      window.history.pushState({}, "", "/auth/update-password");
      await mountApp("/");
      await findHome();
      expect(gtagScripts()).toHaveLength(1);
      expect(window.dataLayer).toBeUndefined();

      window.history.back();
      expect(await findNoRecoverySession()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/auth/update-password");

      fireTagLoad();
      expect(window.gtag).toBeUndefined();
      expect(window.dataLayer).toBeUndefined();
      expect(gtagScripts()).toHaveLength(1);
    },
    TEST_TIMEOUT,
  );

  // El flujo real de un enlace de recuperación: aterriza en «/#access_token=…&type=recovery». client.ts (simulado aquí
  // con clientStartup) captura la recuperación y quita el hash ANTES del primer render; supabase-js guarda la sesión
  // en localStorage más tarde, cuando responde /auth/v1/user (el cliente simulado ni siquiera la guarda). En ese hueco
  // ni la URL ni localStorage delatan el enlace: solo hadAuthRedirectAtStartup() lo hace. Después getSession() resuelve
  // y RecoveryRedirect mueve la app a la pantalla de la contraseña nueva. En ningún momento se carga la etiqueta.
  it(
    "llegar a «/» con un enlace de recuperación: no hay script, gtag ni dataLayer, ni en «/» ni tras el salto a /auth/update-password",
    async () => {
      let release!: () => void;
      authSwitch.hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      authSwitch.session = { user: { id: "usuario-prueba" } };
      await mountApp("/#access_token=PRUEBA&refresh_token=PRUEBA&type=recovery", { clientStartup: true });

      // En «/», con getSession() retenido: la URL ya está limpia y no hay sesión guardada, así que las otras tres
      // guardas no frenarían nada (el fallo que esta prueba fija).
      expect(await findHome()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
      expect(window.location.hash).toBe("");
      expect(window.location.href).not.toMatch(/access_token|refresh_token/);
      expect(Object.keys(localStorage).filter((key) => key.startsWith("sb-"))).toEqual([]);
      expectNothingLoaded();

      release();
      expect(await findNewPasswordForm()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/auth/update-password");
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );
});

describe("App · con una sesión guardada en localStorage no se carga nada", () => {
  it.each([
    ["/", findHome],
    ["/paginas-web", findLanding],
  ])(
    "%s: la clave sb-prueba-auth-token deja la etiqueta inerte",
    async (path, findPage) => {
      localStorage.setItem("sb-prueba-auth-token", "PRUEBA");
      await mountApp(path);
      expect(await findPage()).toBeInTheDocument();
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );
});

describe("App · click-ids con forma no válida en la URL: gtag.js los leería por su cuenta", () => {
  it.each([
    ["gclid con @ y espacio", "/paginas-web?gclid=PRUEBA%40example.com%20SUCIO"],
    ["gclid de 600 caracteres", `/paginas-web?gclid=${"G".repeat(600)}`],
    ["click-id inválido en el fragmento", "/paginas-web#gclid=bad%20x"],
  ])(
    "/paginas-web con %s: la landing se ve pero no hay script ni dataLayer",
    async (_case, url) => {
      await mountApp(url);
      expect(await findLanding()).toBeInTheDocument();
      expectNothingLoaded();
    },
    TEST_TIMEOUT,
  );

  it(
    "llegar con un click-id inválido y pasar a una URL limpia dentro del SPA retoma la medición, con page_referrer vacío",
    async () => {
      setReferrer(GOOGLE_REFERRER);
      await mountApp("/paginas-web?gclid=PRUEBA%40example.com%20SUCIO");
      await findLanding();
      expectNothingLoaded();

      clickNavbarLogo();
      expect(await findHome()).toBeInTheDocument();
      expect(window.location.pathname).toBe("/");
      expect(gtagScripts()).toHaveLength(1);
      fireTagLoad();
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
      expect(JSON.stringify(layerEntries())).not.toMatch(/example\.com|SUCIO/);
    },
    TEST_TIMEOUT,
  );

  it(
    "con un gclid válido típico (90 caracteres) todo sigue como antes: UN script y page_location lo conserva",
    async () => {
      await mountApp(`/paginas-web?gclid=${TYPICAL_CLICK_ID}`);
      expect(await findLanding()).toBeInTheDocument();
      expect(gtagScripts()).toHaveLength(1);
      fireTagLoad();
      expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/paginas-web?gclid=${TYPICAL_CLICK_ID}`, page_referrer: "" }]);
    },
    TEST_TIMEOUT,
  );
});

// Con las rutas actuales ninguna redirige en el primer commit, así que el orden de <AdsTagRouteSync /> respecto de
// <AuthProvider> no cambia nada observable. Esta guarda lo fija leyendo el texto del archivo: el listener va después
// del árbol de la aplicación para que un hijo que redirija en su primer efecto lo haga antes de que corra el suyo.
describe("App.tsx · montaje de AdsTagRouteSync (guarda textual)", () => {
  const source = appSource.replace(/\r\n/g, "\n");
  const position = (pattern: RegExp): number => {
    const match = pattern.exec(source);
    expect(match, `no aparece ${pattern}`).not.toBeNull();
    return match ? match.index : -1;
  };

  it("importa AdsTagRouteSync y lo monta una sola vez", () => {
    expect(source).toMatch(/import AdsTagRouteSync from "@\/components\/common\/AdsTagRouteSync";/);
    expect(source.match(/<AdsTagRouteSync\s*\/>/g)).toHaveLength(1);
  });

  it("lo monta dentro de BrowserRouter y DESPUÉS de </AuthProvider>", () => {
    // \b: sigue valiendo si algún día <BrowserRouter> recibe props (p. ej. future={...}); no casa con </BrowserRouter>.
    const routerOpen = position(/<BrowserRouter\b/);
    const authClose = position(/<\/AuthProvider>/);
    const listener = position(/<AdsTagRouteSync\s*\/>/);
    const routerClose = position(/<\/BrowserRouter>/);
    expect(routerOpen).toBeLessThan(authClose);
    expect(authClose).toBeLessThan(listener);
    expect(listener).toBeLessThan(routerClose);
  });
});
