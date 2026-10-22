import { StrictMode, useEffect, useRef, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { BrowserRouter, Link, Route, Routes, useNavigate, type NavigateFunction } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// BrowserRouter, AdsTagRouteSync y lib/analytics reales, con el orden de efectos de src/App.tsx (AuthProvider y
// Routes primero, AdsTagRouteSync después). jsdom no descarga <script src>: no sale ninguna petición a Google.
// Solo lo que depende del router y del orden de los efectos; las rutas reales están en app-ads-wiring.test.tsx y
// la lógica de la etiqueta en ads-tag.test.ts.

type Analytics = typeof import("@/lib/analytics");

// Identificadores de PRUEBA: nunca los reales de la cuenta de Google Ads.
const TAG_ID = "AW-1000000000";
const SEND_TO = "AW-1000000000/PRUEBA";
const GTAG_SRC = `https://www.googletagmanager.com/gtag/js?id=${TAG_ID}`;
const ORIGIN = window.location.origin;
const GOOGLE_REFERRER = "https://www.google.com/search?q=x";

const setUrl = (url: string): void => window.history.pushState({}, "", url);

/**
 * jsdom no descarga <script src>: el load de gtag.js se simula sobre NUESTRO script. Hasta ese evento no existen
 * window.gtag ni window.dataLayer. Falla si el script no está, para no disparar un evento que nadie escucha.
 */
function fireTagLoad(): void {
  const script = document.querySelector<HTMLScriptElement>(`script[src="${GTAG_SRC}"]`);
  expect(script, "debe haber un script de gtag.js al que dispararle el load").not.toBeNull();
  script?.dispatchEvent(new Event("load"));
}

function setReferrer(value: string): void {
  Object.defineProperty(document, "referrer", { configurable: true, get: () => value });
}

const scriptTags = (): HTMLScriptElement[] => Array.from(document.querySelectorAll("script"));

/** Entradas del dataLayer como arreglos: gtag las empuja como objetos Arguments. */
const layerEntries = (): unknown[][] => (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));

const eventsOf = (name: string): unknown[][] => layerEntries().filter((entry) => entry[0] === "event" && entry[1] === name);

const pageViews = (): Array<{ page_location: string; page_referrer: string }> =>
  eventsOf("page_view").map((entry) => entry[2] as { page_location: string; page_referrer: string });

function expectNothingLoaded(): void {
  expect(scriptTags()).toHaveLength(0);
  expect(window.gtag).toBeUndefined();
  expect(window.dataLayer).toBeUndefined();
}

function resetPage(): void {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  localStorage.clear();
  scriptTags().forEach((script) => script.remove());
  Reflect.deleteProperty(window, "gtag");
  Reflect.deleteProperty(window, "dataLayer");
  Reflect.deleteProperty(document, "referrer");
  setUrl("/");
}

beforeEach(resetPage);
afterEach(resetPage);

let navigate: NavigateFunction;
const NavigateGrabber = () => {
  navigate = useNavigate();
  return null;
};

/** Una página vacía en cualquier ruta: AdsTagRouteSync solo mira el pathname. */
const AppRoutes = () => (
  <Routes>
    <Route path="*" element={<main />} />
  </Routes>
);

const NAV_LINKS: Array<{ label: string; to: string }> = [
  { label: "inicio", to: "/" },
  { label: "páginas web", to: "/paginas-web" },
  { label: "portal del cliente", to: "/client/SECRET?gclid=ZZZ#access_token=SECRET" },
  { label: "panel", to: "/dashboard" },
  { label: "entrar", to: "/login" },
];

const NavLinks = () => (
  <nav>
    {NAV_LINKS.map(({ label, to }) => (
      <Link key={label} to={to}>
        {label}
      </Link>
    ))}
  </nav>
);

/** Redirige una sola vez, en un efecto pasivo (como un Login o un ProtectedRoute con sesión). */
const RedirectInEffect = ({ to }: { to: string }) => {
  const go = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    go(to, { replace: true });
  }, [go, to]);
  return null;
};

interface Boot {
  url: string;
  referrer?: string;
  strict?: boolean;
  /** Hijos que se montan ANTES de AdsTagRouteSync (como AuthProvider y Routes en App.tsx). */
  before?: ReactNode;
  /** Hijos que se montan DESPUÉS de AdsTagRouteSync. */
  after?: ReactNode;
}

/** Módulos nuevos por prueba (lastPath, lastLocation y lastReferrer en cero) y variables de prueba fijadas. */
async function boot({ url, referrer, strict, before, after }: Boot): Promise<Analytics> {
  vi.stubEnv("VITE_GADS_ID", TAG_ID);
  vi.stubEnv("VITE_GADS_CONTACT_LABEL", SEND_TO);
  vi.resetModules();
  setUrl(url);
  if (referrer !== undefined) setReferrer(referrer);
  const analytics = await import("@/lib/analytics");
  const { default: AdsTagRouteSync } = await import("@/components/common/AdsTagRouteSync");
  const tree = (
    <BrowserRouter>
      <NavigateGrabber />
      <NavLinks />
      {before}
      <AppRoutes />
      <AdsTagRouteSync />
      {after}
    </BrowserRouter>
  );
  render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  return analytics;
}

/** Navegación programática del router (equivale a un Link o a un redirect de la aplicación). */
const visit = (to: string): void => {
  act(() => {
    navigate(to);
  });
};

const click = (label: string): void => {
  fireEvent.click(screen.getByRole("link", { name: label }));
};

describe("AdsTagRouteSync", () => {
  it("es un listener sin interfaz: no pinta nada", async () => {
    vi.stubEnv("VITE_GADS_ID", TAG_ID);
    vi.stubEnv("VITE_GADS_CONTACT_LABEL", SEND_TO);
    vi.resetModules();
    const { default: AdsTagRouteSync } = await import("@/components/common/AdsTagRouteSync");
    const { container } = render(
      <BrowserRouter>
        <AdsTagRouteSync />
      </BrowserRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("navegación SPA", () => {
  it("/ → /client/SECRET → /dashboard → /paginas-web con enlaces reales: nada sale desde las rutas privadas", async () => {
    await boot({ url: "/", referrer: GOOGLE_REFERRER });
    fireTagLoad();
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "https://www.google.com/" }]);
    const before = layerEntries().length;
    expect(before).toBe(3); // js, config y el page_view de «/»

    click("portal del cliente");
    expect(window.location.pathname).toBe("/client/SECRET");
    expect(layerEntries()).toHaveLength(before);

    click("panel");
    expect(window.location.pathname).toBe("/dashboard");
    expect(layerEntries()).toHaveLength(before);
    expect(scriptTags()).toHaveLength(1);

    click("páginas web");
    expect(window.location.pathname).toBe("/paginas-web");
    expect(pageViews()).toHaveLength(2);
    expect(pageViews()[1]).toEqual({ page_location: `${ORIGIN}/paginas-web`, page_referrer: "" });
    expect(scriptTags()).toHaveLength(1);
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);

    const everything = JSON.stringify(layerEntries());
    expect(everything).not.toContain("SECRET");
    expect(everything).not.toContain("ZZZ");
    expect(everything).not.toMatch(/client|dashboard/);
  });

  it("cambiar solo la query o el ancla de una ruta permitida no cuenta como otra visita", async () => {
    await boot({ url: "/paginas-web?gclid=PRUEBA" });
    fireTagLoad();
    visit("/paginas-web?gclid=PRUEBA#contacto");
    visit("/paginas-web?gclid=OTRO");
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/paginas-web?gclid=PRUEBA`, page_referrer: "" }]);
  });
});

describe("historial y pushState de otro código", () => {
  it("al revés: el router dice ruta privada pero el navegador está en una permitida, sin eventos", async () => {
    const analytics = await boot({ url: "/" });
    fireTagLoad();
    const before = layerEntries().length;
    expect(before).toBe(3); // js, config y el page_view de «/»
    analytics.syncAdsTag("/client/SECRET");
    expect(layerEntries()).toHaveLength(before);
  });
});

describe("redirecciones dentro de efectos hijos", () => {
  // Orden de efectos de React: los de un hijo anterior corren antes que el de AdsTagRouteSync (como los de
  // AuthProvider y Routes en App.tsx) y, para un hijo posterior, después.
  it("«/» → «/dashboard» en el primer efecto de un hijo anterior: no se carga nada", async () => {
    await boot({ url: "/", referrer: GOOGLE_REFERRER, before: <RedirectInEffect to="/dashboard" /> });
    expect(window.location.pathname).toBe("/dashboard");
    expectNothingLoaded();
  });

  // Con la cola hasta el load, la persona sí estuvo en «/» (el script se inyecta y la visita espera), pero el load
  // llega con el navegador ya en /dashboard: la etiqueta lo descarta todo. Antes de la cola, el page_view de «/»
  // salía al instante con la URL de ese momento; ahora nada sale, y gtag.js nunca ve una URL privada.
  it("«/» → «/dashboard» en un hijo posterior: la visita a «/» queda en cola y el load, ya en /dashboard, la descarta: no sale nada", async () => {
    const analytics = await boot({ url: "/", referrer: GOOGLE_REFERRER, after: <RedirectInEffect to="/dashboard" /> });
    expect(window.location.pathname).toBe("/dashboard");
    expect(scriptTags()).toHaveLength(1);
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    fireTagLoad();
    analytics.trackContactConversion();
    expect(window.gtag).toBeUndefined();
    expect(window.dataLayer).toBeUndefined();
    expect(scriptTags()).toHaveLength(1);
  });

  it("«/dashboard» → «/» en el primer efecto de un hijo anterior: un solo page_view, el de «/»", async () => {
    await boot({ url: "/dashboard", referrer: GOOGLE_REFERRER, before: <RedirectInEffect to="/" /> });
    expect(window.location.pathname).toBe("/");
    expect(scriptTags()).toHaveLength(1);
    fireTagLoad();
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
    // La primera visita de la carga fue a una ruta no permitida: no se reutiliza el referrer de entrada.
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
  });

  it("«/dashboard» → «/» en un hijo posterior: un solo page_view, el de «/»", async () => {
    await boot({ url: "/dashboard", referrer: GOOGLE_REFERRER, after: <RedirectInEffect to="/" /> });
    expect(window.location.pathname).toBe("/");
    expect(scriptTags()).toHaveLength(1);
    fireTagLoad();
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/`, page_referrer: "" }]);
  });
});

describe("click-ids con forma no válida en la URL", () => {
  /** Un gclid con un correo y un espacio dentro (%40 y %20): gtag.js lo enviaría tal cual. */
  const DIRTY_CLICK_ID = "PRUEBA%40example.com%20SUCIO";

  // Mientras solo cambie la query el router no vuelve a avisar (el efecto depende del pathname), pero la
  // conversión lee la URL del momento: bloqueada con el click-id dudoso, permitida con uno válido.
  it("si solo cambia la query de la misma ruta, la conversión sigue la URL actual", async () => {
    const analytics = await boot({ url: "/" });
    fireTagLoad();
    visit("/paginas-web?gclid=OK_1");
    expect(pageViews()).toHaveLength(2);

    visit(`/paginas-web?gclid=${DIRTY_CLICK_ID}`);
    analytics.trackContactConversion();
    expect(eventsOf("conversion")).toHaveLength(0);
    expect(pageViews()).toHaveLength(2);

    visit("/paginas-web?gclid=OK_2");
    analytics.trackContactConversion();
    expect(eventsOf("conversion")).toEqual([
      ["event", "conversion", { send_to: SEND_TO, page_location: `${ORIGIN}/paginas-web?gclid=OK_2`, page_referrer: `${ORIGIN}/` }],
    ]);
  });
});

describe("React.StrictMode (efectos dobles)", () => {
  it("un solo script, un config y un page_view", async () => {
    await boot({ url: "/paginas-web?gclid=PRUEBA", strict: true });
    expect(scriptTags()).toHaveLength(1);
    fireTagLoad();
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
    expect(pageViews()).toEqual([{ page_location: `${ORIGIN}/paginas-web?gclid=PRUEBA`, page_referrer: "" }]);
  });

  it("al navegar fuera y de vuelta sigue sin duplicar nada", async () => {
    await boot({ url: "/", strict: true });
    fireTagLoad();
    click("entrar");
    click("inicio");
    expect(pageViews()).toHaveLength(2);
    expect(scriptTags()).toHaveLength(1);
    expect(layerEntries().filter((entry) => entry[0] === "config")).toHaveLength(1);
  });

  it("en una ruta privada no carga nada", async () => {
    await boot({ url: "/dashboard", strict: true });
    expectNothingLoaded();
  });
});
