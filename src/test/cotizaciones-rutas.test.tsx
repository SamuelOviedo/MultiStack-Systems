// Rutas de Cotizaciones con el `App` real, el `ProtectedRoute` real y el `AuthProvider` real. Solo se simulan el cliente
// de Supabase (sesión, perfil y eventos de autenticación) y las dos lecturas de `src/lib/cotizaciones`, cuyas respuestas
// entrega la prueba a mano. Todos los datos son sintéticos.
//
// Cubre lo que le importa a quien administra el panel: el acceso directo por URL a las tres rutas, los identificadores
// no válidos, el cierre de sesión, el cambio de cuenta y las respuestas que llegan tarde. Donde la sesión cambia se
// comprueba que NINGUNA confirmación (`commit`) de React posterior al cambio pinta datos del prospecto de la sesión
// anterior: un `Profiler` guarda el texto del documento en cada una. Los datos de cada sesión llevan un nombre distinto
// solo para poder ver una filtración.
import { Profiler } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaginaCotizaciones } from "@/lib/cotizaciones";
import type { Cotizacion, CotizacionResumen } from "@/types/cotizaciones";

const WAIT = { timeout: 15000 };
// Los chunks lazy (el armazón y las tres páginas) tardan en transformarse la primera vez.
vi.setConfig({ testTimeout: 30000 });

/* ------------------------------------------------------------------------------------------------
 * Supabase simulado: sesión inicial, eventos de autenticación y el perfil (rol) de cada cuenta.
 * Un perfil puede quedar pendiente (`manual`) para ver qué pasa mientras el rol se resuelve.
 * ---------------------------------------------------------------------------------------------- */

type Oyente = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  listener: undefined as ((event: string, session: unknown) => void) | undefined,
  initialSession: null as unknown,
  /** Rol que responde `profiles` por usuario. Si el usuario está en `manual`, la respuesta queda pendiente. */
  roles: {} as Record<string, number>,
  manual: new Set<string>(),
  calls: [] as { userId: string; resolve: (role: number) => void; reject: (error: Error) => void }[],
  /** Tablas distintas de `profiles` que alguien consultó directamente (ninguna debe haberse consultado). */
  otherTables: [] as string[],
  signOuts: 0,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: h.initialSession } }),
      onAuthStateChange: (cb: Oyente) => {
        h.listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      // Como el cliente real: cerrar sesión avisa a quien escucha con SIGNED_OUT.
      signOut: () => {
        h.signOuts += 1;
        h.listener?.("SIGNED_OUT", null);
        return Promise.resolve({ error: null });
      },
    },
    functions: { invoke: () => Promise.resolve({}) },
    from: (table: string) => {
      if (table !== "profiles") {
        h.otherTables.push(table);
        throw new Error(`supabase.from(${table}) no está simulado: cada consulta debe pasar por un mock de src/lib`);
      }
      return {
        select: () => ({
          eq: (_column: string, userId: string) => ({
            single: () =>
              h.manual.has(userId)
                ? new Promise((resolve, reject) => {
                    h.calls.push({ userId, resolve: (role) => resolve({ data: { user_type: role } }), reject });
                  })
                : Promise.resolve({ data: { user_type: h.roles[userId] } }),
          }),
        }),
      };
    },
  },
}));

const lib = vi.hoisted(() => ({
  listarPaginaCotizaciones: vi.fn<typeof import("@/lib/cotizaciones").listarPaginaCotizaciones>(),
  obtenerCotizacion: vi.fn<typeof import("@/lib/cotizaciones").obtenerCotizacion>(),
  getOpenTicketsCount: vi.fn(),
}));
vi.mock("@/lib/cotizaciones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cotizaciones")>()),
  listarPaginaCotizaciones: lib.listarPaginaCotizaciones,
  obtenerCotizacion: lib.obtenerCotizacion,
}));
// El armazón lee el conteo de tickets abiertos en cada ruta; aquí no es lo que se prueba.
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getOpenTicketsCount: lib.getOpenTicketsCount,
}));

// Pantallas ajenas al módulo: sustitutas mínimas (solo interesa a dónde llega cada cuenta).
vi.mock("@/pages/client/MisSolicitudes.tsx", () => ({ default: () => <h1>Mis solicitudes (simulada)</h1> }));
vi.mock("@/pages/auth/Login.tsx", () => ({ default: () => <h1>Login (simulado)</h1> }));
vi.mock("@/pages/marketing/Index.tsx", () => ({ default: () => <h1>Landing (simulada)</h1> }));

import App from "@/App";
import { ErrorCotizacion } from "@/lib/cotizaciones";

/* ------------------------------------------------------------------------------------------------
 * Cuentas y datos sintéticos
 * ---------------------------------------------------------------------------------------------- */

const NOW = "2026-11-10T15:00:00.000Z";
const sesionDe = (id: string) => ({ access_token: `t-${id}`, user: { id, email: `${id}@example.test`, email_confirmed_at: NOW } });
const SESIONES = {
  admin: sesionDe("u-admin"),
  otroAdmin: sesionDe("u-otro-admin"),
  colaborador: sesionDe("u-colab"),
  cliente: sesionDe("u-client"),
};
type Cuenta = keyof typeof SESIONES;
const ROLES: Record<Cuenta, number> = { admin: 0, otroAdmin: 0, colaborador: 1, cliente: 2 };
const idDe = (cuenta: Cuenta) => SESIONES[cuenta].user.id;

/** Adónde termina quien no puede abrir el panel (el mismo destino que hoy tiene `/dashboard`). */
const DESTINO = {
  colaborador: { ruta: "/", encabezado: "Landing (simulada)" },
  cliente: { ruta: "/solicitudes", encabezado: "Mis solicitudes (simulada)" },
} as const;

/** UUID válido por número. */
const uuidDe = (n: number) => `0a1b2c3d-${String(n).padStart(4, "0")}-4000-8000-${String(n).padStart(12, "0")}`;

const RUTA_LISTA = "/dashboard/cotizaciones";
const RUTA_CATALOGO = "/dashboard/cotizaciones/catalogo";
const ID_URL = uuidDe(7);
const RUTA_DETALLE = `/dashboard/cotizaciones/${ID_URL}`;

/** Todo lo del prospecto `n` que una pantalla puede pintar. */
const datosDelProspecto = (n: number) => [
  `Prospecto Sintético ${n}`,
  `Contacto Sintético ${n}`,
  `s${n}@example.test`,
  `+504 5550-01${String(n).padStart(2, "0")}`,
  `BOR-${n}`,
];
/** Lo del prospecto `n` que hay hoy en el documento (vacío si no hay nada). */
const enElDocumento = (n: number) => filtraciones(document.body.textContent ?? "", n);
const filtraciones = (texto: string, n: number) => datosDelProspecto(n).filter((dato) => texto.includes(dato));

const resumenDe = (n: number): CotizacionResumen => ({
  id: uuidDe(n),
  referencia_interna: `BOR-${n}`,
  estado: "borrador",
  prospecto_nombre: `Prospecto Sintético ${n}`,
  creado_at: NOW,
  row_version: 1,
});
const paginaDe = (n: number): PaginaCotizaciones => ({ cotizaciones: [resumenDe(n)], haySiguiente: false });
/** El detalle que ve la URL `ID_URL`; `n` solo cambia lo que dice del prospecto. */
const cotizacionDe = (n: number): Cotizacion => ({
  ...resumenDe(n),
  id: ID_URL,
  prospecto_contacto: `Contacto Sintético ${n}`,
  prospecto_email: `s${n}@example.test`,
  prospecto_telefono: `+504 5550-01${String(n).padStart(2, "0")}`,
  creado_por: uuidDe(1),
  actualizado_por: null,
  actualizado_at: NOW,
});

/** Una respuesta que la prueba resuelve o rechaza cuando quiere. */
function diferida<T>() {
  let resolver!: (valor: T) => void;
  let rechazar!: (motivo: unknown) => void;
  const promesa = new Promise<T>((alResolver, alRechazar) => {
    resolver = alResolver;
    rechazar = alRechazar;
  });
  return { promesa, resolver, rechazar };
}

/** Cómo entregar (o rechazar) ahora, fuera de turno, una respuesta que se dejó pendiente. */
interface Pendiente {
  entregar: (n: number) => Promise<void>;
  rechazar: (motivo: unknown) => Promise<void>;
}

/* ------------------------------------------------------------------------------------------------
 * Las pantallas del módulo y sus consultas
 * ---------------------------------------------------------------------------------------------- */

const consultasHechas = () => lib.listarPaginaCotizaciones.mock.calls.length + lib.obtenerCotizacion.mock.calls.length;

const PANTALLAS = [
  {
    nombre: "la lista",
    ruta: RUTA_LISTA,
    consultas: 1,
    preparar: () => lib.listarPaginaCotizaciones.mockResolvedValue(paginaDe(7)),
    listo: () => screen.findByRole("link", { name: "BOR-7" }, WAIT),
    verificarConsulta: () => expect(lib.listarPaginaCotizaciones.mock.calls[0][0]).toMatchObject({ pagina: 1, tamano: 25 }),
  },
  {
    nombre: "el catálogo",
    ruta: RUTA_CATALOGO,
    consultas: 0,
    preparar: () => undefined,
    listo: () => screen.findByRole("heading", { level: 2, name: "El catálogo se habilita en la siguiente fase" }, WAIT),
    verificarConsulta: () => undefined,
  },
  {
    nombre: "el detalle",
    ruta: RUTA_DETALLE,
    consultas: 1,
    preparar: () => lib.obtenerCotizacion.mockResolvedValue(cotizacionDe(7)),
    listo: () => screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" }, WAIT),
    verificarConsulta: () => expect(lib.obtenerCotizacion.mock.calls[0][0]).toBe(ID_URL),
  },
];

/** Las dos pantallas que muestran datos del prospecto, con lo necesario para dirigir su consulta desde la prueba. */
const CON_DATOS = [
  {
    nombre: "la lista",
    ruta: RUTA_LISTA,
    /** La próxima consulta responde en seguida con los datos del prospecto `n`. */
    responderCon: (n: number) => void lib.listarPaginaCotizaciones.mockResolvedValueOnce(paginaDe(n)),
    /** La próxima consulta queda sin respuesta hasta que la prueba la entregue. */
    dejarPendiente: (): Pendiente => {
      const d = diferida<PaginaCotizaciones>();
      lib.listarPaginaCotizaciones.mockReturnValueOnce(d.promesa);
      return {
        entregar: (n) => act(async () => d.resolver(paginaDe(n))),
        rechazar: (motivo) => act(async () => d.rechazar(motivo)),
      };
    },
    consultas: () => lib.listarPaginaCotizaciones.mock.calls.length,
    senales: () => lib.listarPaginaCotizaciones.mock.calls.map(([opciones]) => opciones?.signal),
    listo: (n: number) => screen.findByRole("link", { name: `BOR-${n}` }, WAIT),
  },
  {
    nombre: "el detalle",
    ruta: RUTA_DETALLE,
    responderCon: (n: number) => void lib.obtenerCotizacion.mockResolvedValueOnce(cotizacionDe(n)),
    dejarPendiente: (): Pendiente => {
      const d = diferida<Cotizacion | null>();
      lib.obtenerCotizacion.mockReturnValueOnce(d.promesa);
      return {
        entregar: (n) => act(async () => d.resolver(cotizacionDe(n))),
        rechazar: (motivo) => act(async () => d.rechazar(motivo)),
      };
    },
    consultas: () => lib.obtenerCotizacion.mock.calls.length,
    senales: () => lib.obtenerCotizacion.mock.calls.map(([, opciones]) => opciones?.signal),
    listo: (n: number) => screen.findByRole("heading", { level: 1, name: `Cotización BOR-${n}` }, WAIT),
  },
];

/* ------------------------------------------------------------------------------------------------
 * Montaje y ayudantes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Abre `ruta` con la cuenta indicada (o sin sesión). Devuelve, además, el texto del documento en cada confirmación de
 * React (`instantaneas`): sirve para afirmar que NINGUNA posterior a un cambio de sesión muestra datos ajenos.
 */
function abrir(ruta: string, cuenta: Cuenta | null) {
  h.initialSession = cuenta === null ? null : SESIONES[cuenta];
  window.history.pushState({}, "", ruta);
  const instantaneas: string[] = [];
  const alConfirmar = () => {
    instantaneas.push(document.body.textContent ?? "");
  };
  const vista = render(
    <Profiler id="app" onRender={alConfirmar}>
      <App />
    </Profiler>,
  );
  return { ...vista, instantaneas };
}

const emitir = (evento: string, sesion: unknown) => act(() => h.listener?.(evento, sesion));
const settle = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
const rutaActual = () => window.location.pathname;
const perfilesPedidos = (cuenta: Cuenta) => h.calls.filter((c) => c.userId === idDe(cuenta));

/** ¿Hay algo del panel en pantalla? La barra lateral o el contenido del armazón. */
const panelVisible = () => document.querySelector("#admin-sidebar") !== null || document.querySelector("#contenido") !== null;
/** El cargador de marca que pinta `ProtectedRoute` mientras no sabe quién es la cuenta. */
const cargadorVisible = () => screen.queryAllByAltText("MultiStack Systems Logo").length > 0;

/** Ninguna confirmación posterior a `desde` mostró algo del prospecto `n`. */
const sinFiltracionesDesde = (instantaneas: string[], desde: number, n: number) =>
  instantaneas.slice(desde).flatMap((texto) => filtraciones(texto, n));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  h.listener = undefined;
  h.initialSession = null;
  h.roles = Object.fromEntries((Object.keys(SESIONES) as Cuenta[]).map((cuenta) => [idDe(cuenta), ROLES[cuenta]]));
  h.manual.clear();
  h.calls.length = 0;
  h.otherTables.length = 0;
  h.signOuts = 0;
  window.localStorage.clear();
  const sinPreparar = async () => {
    throw new Error("respuesta no preparada por la prueba");
  };
  lib.listarPaginaCotizaciones.mockReset().mockImplementation(sinPreparar);
  lib.obtenerCotizacion.mockReset().mockImplementation(sinPreparar);
  lib.getOpenTicketsCount.mockReset().mockResolvedValue(0);
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
  // Ninguna pantalla consulta Supabase por su cuenta: toda lectura pasa por `src/lib` (simulado arriba).
  expect(h.otherTables).toEqual([]);
});

/* ------------------------------------------------------------------------------------------------
 * Acceso directo por URL
 * ---------------------------------------------------------------------------------------------- */

describe.each(PANTALLAS.map((pantalla) => [pantalla.nombre, pantalla.ruta, pantalla] as const))("acceso directo a %s (%s) con el AuthProvider real", (_nombre, _ruta, { ruta, consultas, preparar, listo, verificarConsulta }) => {
  it("sin sesión: va a /login, no ve nada del panel y no pide nada", async () => {
    abrir(ruta, null);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    expect(rutaActual()).toBe("/login");
    expect(panelVisible()).toBe(false);
    expect(consultasHechas()).toBe(0);
  });

  it("administrador: se queda en la ruta, pinta la página dentro del panel y pide lo suyo una sola vez", async () => {
    preparar();
    abrir(ruta, "admin");
    await listo();
    expect(rutaActual()).toBe(ruta);
    expect(panelVisible()).toBe(true);
    expect(screen.getByRole("link", { name: "Cotizaciones", current: "page" })).toBeInTheDocument();
    await settle(50);
    expect(consultasHechas()).toBe(consultas);
    if (consultas > 0) verificarConsulta();
  });

  it.each(["colaborador", "cliente"] as const)("%s: termina en su destino, nunca ve el panel y no pide nada", async (cuenta) => {
    const { instantaneas } = abrir(ruta, cuenta);
    expect(await screen.findByRole("heading", { name: DESTINO[cuenta].encabezado }, WAIT)).toBeInTheDocument();
    expect(rutaActual()).toBe(DESTINO[cuenta].ruta);
    await settle(50);
    expect(panelVisible()).toBe(false);
    expect(consultasHechas()).toBe(0);
    // En ningún momento se pintó el panel ni la página.
    expect(instantaneas.filter((texto) => texto.includes("Saltar al contenido"))).toEqual([]);
  });

  it("sesión guardada con el perfil sin responder: solo el cargador y ninguna consulta; al llegar el rol 0 se pinta la página", async () => {
    preparar();
    h.manual.add(idDe("admin"));
    abrir(ruta, "admin");
    await waitFor(() => expect(perfilesPedidos("admin")).toHaveLength(1), WAIT);
    await settle(150);
    expect(cargadorVisible()).toBe(true);
    expect(panelVisible()).toBe(false);
    expect(rutaActual()).toBe(ruta);
    expect(consultasHechas()).toBe(0);

    await act(async () => perfilesPedidos("admin")[0].resolve(0));
    await listo();
    expect(panelVisible()).toBe(true);
    await settle(50);
    expect(consultasHechas()).toBe(consultas);
  });

  it("sesión guardada con el perfil sin responder que resuelve a colaborador: termina en / sin haber pedido nada", async () => {
    preparar();
    h.manual.add(idDe("colaborador"));
    abrir(ruta, "colaborador");
    await waitFor(() => expect(perfilesPedidos("colaborador")).toHaveLength(1), WAIT);
    await settle(150);
    expect(cargadorVisible()).toBe(true);
    expect(panelVisible()).toBe(false);
    expect(consultasHechas()).toBe(0);

    await act(async () => perfilesPedidos("colaborador")[0].resolve(1));
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expect(rutaActual()).toBe("/");
    expect(consultasHechas()).toBe(0);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Identificadores no válidos
 * ---------------------------------------------------------------------------------------------- */

describe("identificadores no válidos en el detalle (administrador)", () => {
  const NO_VALIDOS = [
    "xyz",
    "123",
    "catalogo2",
    "NO-ES-UN-UUID",
    "0a1b2c3d-0007-4000-8000-00000000000",
    "0a1b2c3d-0007-4000-8000-0000000000007",
    "a%2Fb",
    "..%2F..%2Fdashboard",
    "%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E",
  ];

  it.each(NO_VALIDOS)("/dashboard/cotizaciones/%s: «Cotización no encontrada», sin consulta y sin repetir el identificador", async (id) => {
    abrir(`/dashboard/cotizaciones/${id}`, "admin");
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 2, name: "Cotización no encontrada" }, WAIT)).toBeInTheDocument();
    await settle(50);
    expect(consultasHechas()).toBe(0);
    expect(within(main).queryByRole("alert")).toBeNull();
    expect(main.querySelector('[aria-busy="true"]')).toBeNull();
    // El identificador de la URL nunca se pinta: ni como texto ni como marcado.
    expect(main.textContent).not.toMatch(/onerror|alert\(1\)|\.\.\/|NO-ES-UN-UUID|xyz/);
    expect(main.querySelector("img, script, [onerror]")).toBeNull();
  });

  it("un UUID válido que no existe dice lo mismo, y esa sí es una consulta", async () => {
    lib.obtenerCotizacion.mockResolvedValue(null);
    abrir(`/dashboard/cotizaciones/${uuidDe(404)}`, "admin");
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 2, name: "Cotización no encontrada" }, WAIT)).toBeInTheDocument();
    expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(1);
    expect(lib.obtenerCotizacion.mock.calls[0][0]).toBe(uuidDe(404));
    expect(lib.listarPaginaCotizaciones).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------------------------------------
 * Cierre de sesión
 * ---------------------------------------------------------------------------------------------- */

describe.each(CON_DATOS.map((pantalla) => [pantalla.nombre, pantalla] as const))("%s con datos: cierre de sesión", (_nombre, pantalla) => {
  it("SIGNED_OUT (otra pestaña o sesión vencida): sale del panel y no queda ningún dato del prospecto, en ningún momento", async () => {
    pantalla.responderCon(7);
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await pantalla.listo(7);
    // Control: los datos sí estaban en pantalla antes de cerrar la sesión.
    expect(enElDocumento(7)).toContain("Prospecto Sintético 7");
    const consultasAntes = pantalla.consultas();
    const desde = instantaneas.length;

    emitir("SIGNED_OUT", null);

    // En la misma confirmación del cierre, sin esperar a nada más: ni panel ni datos.
    expect(panelVisible()).toBe(false);
    expect(enElDocumento(7)).toEqual([]);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    await settle(100);
    expect(rutaActual()).toBe("/login");
    expect(panelVisible()).toBe(false);
    expect(enElDocumento(7)).toEqual([]);
    expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
    expect(pantalla.consultas()).toBe(consultasAntes);
  });

  it("«Cerrar sesión» del menú de cuenta: sale del panel y no queda ningún dato del prospecto, en ningún momento", async () => {
    pantalla.responderCon(7);
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await pantalla.listo(7);
    fireEvent.keyDown(screen.getByRole("button", { name: /Cuenta/ }), { key: "Enter" });
    const salir = await screen.findByRole("menuitem", { name: "Cerrar sesión" }, WAIT);
    const desde = instantaneas.length;
    const consultasAntes = pantalla.consultas();

    await act(async () => {
      fireEvent.click(salir);
    });
    await waitFor(() => expect(panelVisible()).toBe(false), WAIT);
    await settle(100);

    expect(h.signOuts).toBe(1);
    expect(rutaActual().startsWith("/dashboard")).toBe(false);
    expect(enElDocumento(7)).toEqual([]);
    expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
    expect(pantalla.consultas()).toBe(consultasAntes);
  });

  it("con la carga en curso al cerrar la sesión: se aborta y su respuesta tardía no se pinta", async () => {
    const pendiente = pantalla.dejarPendiente();
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await waitFor(() => expect(pantalla.consultas()).toBe(1), WAIT);
    expect(pantalla.senales()[0]?.aborted).toBe(false);
    const desde = instantaneas.length;

    emitir("SIGNED_OUT", null);
    // En la misma confirmación del cierre: la página se desmontó y su carga ya está abortada.
    expect(panelVisible()).toBe(false);
    expect(pantalla.senales()[0]?.aborted).toBe(true);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();

    await pendiente.entregar(7);
    await settle(50);
    expect(rutaActual()).toBe("/login");
    expect(panelVisible()).toBe(false);
    expect(enElDocumento(7)).toEqual([]);
    expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
    expect(pantalla.consultas()).toBe(1);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Cambio de sesión
 * ---------------------------------------------------------------------------------------------- */

describe.each(CON_DATOS.map((pantalla) => [pantalla.nombre, pantalla] as const))("%s con datos: cambio de sesión", (_nombre, pantalla) => {
  it.each(["colaborador", "cliente"] as const)(
    "administrador → %s: el panel se desmonta de inmediato, sin datos ni consultas, y termina en su destino",
    async (cuenta) => {
      pantalla.responderCon(7);
      const { instantaneas } = abrir(pantalla.ruta, "admin");
      await pantalla.listo(7);
      await settle(30);
      const consultasAntes = pantalla.consultas();
      h.manual.add(idDe(cuenta));
      const desde = instantaneas.length;

      emitir("SIGNED_IN", SESIONES[cuenta]);

      // En la misma confirmación del cambio: ni panel ni datos, solo el cargador, y ninguna consulta nueva.
      expect(panelVisible()).toBe(false);
      expect(cargadorVisible()).toBe(true);
      expect(enElDocumento(7)).toEqual([]);
      await waitFor(() => expect(perfilesPedidos(cuenta)).toHaveLength(1), WAIT);
      await settle(150);
      expect(panelVisible()).toBe(false);
      expect(cargadorVisible()).toBe(true);
      expect(rutaActual()).toBe(pantalla.ruta);
      expect(pantalla.consultas()).toBe(consultasAntes);

      await act(async () => perfilesPedidos(cuenta)[0].resolve(ROLES[cuenta]));
      expect(await screen.findByRole("heading", { name: DESTINO[cuenta].encabezado }, WAIT)).toBeInTheDocument();
      expect(rutaActual()).toBe(DESTINO[cuenta].ruta);
      expect(panelVisible()).toBe(false);
      expect(enElDocumento(7)).toEqual([]);
      expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
      expect(pantalla.consultas()).toBe(consultasAntes);
    },
  );

  it("administrador A → administrador B: no queda nada de A y la página vuelve a pedir y pinta lo de B", async () => {
    pantalla.responderCon(7);
    pantalla.responderCon(9);
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await pantalla.listo(7);
    await settle(30);
    h.manual.add(idDe("otroAdmin"));
    const desde = instantaneas.length;

    emitir("SIGNED_IN", SESIONES.otroAdmin);

    expect(panelVisible()).toBe(false);
    expect(cargadorVisible()).toBe(true);
    expect(enElDocumento(7)).toEqual([]);
    await waitFor(() => expect(perfilesPedidos("otroAdmin")).toHaveLength(1), WAIT);
    await settle(150);
    expect(panelVisible()).toBe(false);
    expect(pantalla.consultas()).toBe(1);

    await act(async () => perfilesPedidos("otroAdmin")[0].resolve(0));
    await pantalla.listo(9);
    expect(rutaActual()).toBe(pantalla.ruta);
    expect(panelVisible()).toBe(true);
    expect(enElDocumento(9)).toContain("Prospecto Sintético 9");
    expect(enElDocumento(7)).toEqual([]);
    expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
    // La carga de A se abortó y la de B es nueva y vigente.
    expect(pantalla.consultas()).toBe(2);
    expect(pantalla.senales().map((senal) => senal?.aborted)).toEqual([true, false]);
  });

  it("administrador A → administrador B con la carga de A en curso: se aborta y su respuesta tardía no se pinta sobre la de B", async () => {
    const deA = pantalla.dejarPendiente();
    pantalla.responderCon(9);
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await waitFor(() => expect(pantalla.consultas()).toBe(1), WAIT);
    h.manual.add(idDe("otroAdmin"));
    const desde = instantaneas.length;

    emitir("SIGNED_IN", SESIONES.otroAdmin);
    await waitFor(() => expect(perfilesPedidos("otroAdmin")).toHaveLength(1), WAIT);
    await act(async () => perfilesPedidos("otroAdmin")[0].resolve(0));
    await pantalla.listo(9);
    expect(pantalla.senales()[0]?.aborted).toBe(true);

    // La respuesta de A llega ahora, con B ya en pantalla.
    await deA.entregar(7);
    await settle(50);
    expect(enElDocumento(9)).toContain("Prospecto Sintético 9");
    expect(enElDocumento(7)).toEqual([]);
    expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
    expect(pantalla.consultas()).toBe(2);
  });

  it("administrador A → administrador B con la carga de A en curso: el fallo tardío de A no aparece como alerta en la sesión de B", async () => {
    const deA = pantalla.dejarPendiente();
    pantalla.responderCon(9);
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await waitFor(() => expect(pantalla.consultas()).toBe(1), WAIT);
    h.manual.add(idDe("otroAdmin"));
    const desde = instantaneas.length;

    emitir("SIGNED_IN", SESIONES.otroAdmin);
    await waitFor(() => expect(perfilesPedidos("otroAdmin")).toHaveLength(1), WAIT);
    await act(async () => perfilesPedidos("otroAdmin")[0].resolve(0));
    await pantalla.listo(9);

    await deA.rechazar(new ErrorCotizacion("SIN_PERMISO"));
    await settle(50);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body.textContent).not.toContain("No tienes permiso");
    expect(enElDocumento(9)).toContain("Prospecto Sintético 9");
    expect(instantaneas.slice(desde).filter((texto) => texto.includes("No tienes permiso"))).toEqual([]);
  });

  it("administrador → colaborador con la carga en curso: la respuesta tardía no se pinta y no hay consultas nuevas", async () => {
    const deA = pantalla.dejarPendiente();
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await waitFor(() => expect(pantalla.consultas()).toBe(1), WAIT);
    h.manual.add(idDe("colaborador"));
    const desde = instantaneas.length;

    emitir("SIGNED_IN", SESIONES.colaborador);
    await waitFor(() => expect(perfilesPedidos("colaborador")).toHaveLength(1), WAIT);
    expect(pantalla.senales()[0]?.aborted).toBe(true);
    await act(async () => perfilesPedidos("colaborador")[0].resolve(1));
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();

    await deA.entregar(7);
    await settle(50);
    expect(rutaActual()).toBe("/");
    expect(panelVisible()).toBe(false);
    expect(enElDocumento(7)).toEqual([]);
    expect(sinFiltracionesDesde(instantaneas, desde, 7)).toEqual([]);
    expect(pantalla.consultas()).toBe(1);
  });

  it("renovar el token del mismo administrador no desmonta la página, no vuelve a pedir y conserva los datos", async () => {
    pantalla.responderCon(7);
    const { instantaneas } = abrir(pantalla.ruta, "admin");
    await pantalla.listo(7);
    await settle(30);
    const desde = instantaneas.length;

    emitir("TOKEN_REFRESHED", { ...SESIONES.admin, access_token: "renovado" });
    emitir("SIGNED_IN", { ...SESIONES.admin, access_token: "recuperado" });
    expect(enElDocumento(7)).toContain("Prospecto Sintético 7");
    await settle(150);

    expect(rutaActual()).toBe(pantalla.ruta);
    expect(panelVisible()).toBe(true);
    expect(enElDocumento(7)).toContain("Prospecto Sintético 7");
    // Ninguna confirmación posterior dejó la página sin datos ni mostró el cargador.
    expect(instantaneas.slice(desde).filter((texto) => !texto.includes("Prospecto Sintético 7"))).toEqual([]);
    expect(pantalla.consultas()).toBe(1);
    expect(pantalla.senales()[0]?.aborted).toBe(false);
  });

  it("renovar el token con la carga en curso no la aborta ni la repite, y su respuesta se pinta", async () => {
    const pendiente = pantalla.dejarPendiente();
    abrir(pantalla.ruta, "admin");
    await waitFor(() => expect(pantalla.consultas()).toBe(1), WAIT);

    emitir("TOKEN_REFRESHED", { ...SESIONES.admin, access_token: "renovado" });
    await settle(100);
    expect(pantalla.consultas()).toBe(1);
    expect(pantalla.senales()[0]?.aborted).toBe(false);

    await pendiente.entregar(7);
    await pantalla.listo(7);
    expect(enElDocumento(7)).toContain("Prospecto Sintético 7");
    expect(pantalla.consultas()).toBe(1);
  });
});
