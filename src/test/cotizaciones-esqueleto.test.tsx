// T019 · Esqueleto de Cotizaciones (F1): listado, detalle y catálogo, solo lectura.
// Se montan las tres pantallas reales con `MemoryRouter` y `Routes` propios, aisladas de `App` (las rutas reales se
// prueban en `admin-routes.test.tsx` y `cotizaciones-rutas.test.tsx`). Solo se
// simulan `useAuth` (la sesión de cada caso), la capa de datos (`listarPaginaCotizaciones` y `obtenerCotizacion`;
// `ErrorCotizacion`, `esUuid` y `traducirErrorCotizacion` son los reales) y el cliente de Supabase, que nunca debe
// usarse. Todos los datos son sintéticos y cada respuesta la entrega la prueba a mano: sin red ni temporizadores.
import { Profiler, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaginaCotizaciones } from "@/lib/cotizaciones";
import type { Cotizacion, CotizacionResumen, EstadoCotizacion } from "@/types/cotizaciones";

/* ------------------------------------------------------------------------------------------------
 * Sesión simulada. Un almacén externo (como el contexto real) vuelve a pintar a quien la lee en cuanto cambia,
 * sin depender de que el padre se repinte.
 * ---------------------------------------------------------------------------------------------- */

interface EstadoDeSesion {
  user: { id: string } | null;
  userType: number | null;
  loading: boolean;
}

const sesion = vi.hoisted(() => {
  let estado: EstadoDeSesion = { user: null, userType: null, loading: false };
  const oyentes = new Set<() => void>();
  return {
    leer: () => estado,
    suscribir: (oyente: () => void) => {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    fijar: (nuevo: EstadoDeSesion) => {
      estado = nuevo;
      oyentes.forEach((oyente) => oyente());
    },
  };
});

vi.mock("@/hooks/useAuth", async () => {
  const { useSyncExternalStore } = await import("react");
  return { useAuth: () => useSyncExternalStore(sesion.suscribir, sesion.leer) };
});

const supabaseFrom = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("supabase.from no está simulado: toda consulta debe pasar por la capa de datos simulada");
  }),
);
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: supabaseFrom } }));

const lib = vi.hoisted(() => ({
  listarPaginaCotizaciones: vi.fn<typeof import("@/lib/cotizaciones").listarPaginaCotizaciones>(),
  obtenerCotizacion: vi.fn<typeof import("@/lib/cotizaciones").obtenerCotizacion>(),
}));
vi.mock("@/lib/cotizaciones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cotizaciones")>()),
  listarPaginaCotizaciones: lib.listarPaginaCotizaciones,
  obtenerCotizacion: lib.obtenerCotizacion,
}));

import CotizacionDetalle from "@/pages/dashboard/CotizacionDetalle";
import CotizacionesCatalogo from "@/pages/dashboard/CotizacionesCatalogo";
import CotizacionesList from "@/pages/dashboard/CotizacionesList";
import { ErrorCotizacion, MENSAJE_ERROR_GENERICO, traducirErrorCotizacion } from "@/lib/cotizaciones";

const ADMIN_1 = { id: "usuario-admin-sintetico-1" };
const ADMIN_2 = { id: "usuario-admin-sintetico-2" };

function iniciarSesion(user: { id: string } | null = ADMIN_1, userType: number | null = 0, loading = false) {
  act(() => sesion.fijar({ user, userType, loading }));
}

/* ------------------------------------------------------------------------------------------------
 * Datos sintéticos
 * ---------------------------------------------------------------------------------------------- */

/** UUID válido y distinto por número. */
function idDe(n: number): string {
  return `0a1b2c3d-${String(n).padStart(4, "0")}-4000-8000-${String(n).padStart(12, "0")}`;
}

// 03:00 UTC del 10 de nov = 21:00 del 9 de nov en Honduras (UTC-6, sin horario de verano).
const CREADA_NOCHE = "2026-11-10T03:00:00.000Z";

function resumen(n: number, cambios: Partial<CotizacionResumen> = {}): CotizacionResumen {
  return {
    id: idDe(n),
    referencia_interna: `BOR-${n}`,
    estado: "borrador",
    prospecto_nombre: `Prospecto sintético ${n}`,
    creado_at: CREADA_NOCHE,
    row_version: 3,
    ...cambios,
  };
}

function pagina(cotizaciones: CotizacionResumen[], haySiguiente = false): PaginaCotizaciones {
  return { cotizaciones, haySiguiente };
}

const ID_DETALLE = idDe(7);
const CREADO_POR = "cafe0000-0000-4000-8000-00000000c0de";
const ACTUALIZADO_POR = "beef0000-0000-4000-8000-00000000b0b0";

function cotizacion(cambios: Partial<Cotizacion> = {}): Cotizacion {
  return {
    id: ID_DETALLE,
    referencia_interna: "BOR-7",
    estado: "emitida",
    prospecto_nombre: "Prospecto Sintético Siete",
    prospecto_contacto: "Contacto Sintético Siete",
    prospecto_email: "siete@example.test",
    prospecto_telefono: "+504 5550-0107",
    creado_por: CREADO_POR,
    creado_at: CREADA_NOCHE,
    actualizado_por: ACTUALIZADO_POR,
    actualizado_at: "2026-11-10T15:30:00.000Z",
    row_version: 48271,
    ...cambios,
  };
}

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

async function entregar<T>(pendiente: { resolver: (valor: T) => void }, valor: T) {
  await act(async () => {
    pendiente.resolver(valor);
  });
}

/** Sirve la página pedida (`pagina` de las opciones) desde la tabla; las que no están, vacías. */
function servirPaginas(paginas: Record<number, PaginaCotizaciones>) {
  lib.listarPaginaCotizaciones.mockImplementation(
    async (opciones) => paginas[opciones?.pagina ?? 1] ?? pagina([], false),
  );
}

/** Los números de página pedidos hasta ahora, en orden. */
function paginasPedidas(): Array<number | undefined> {
  return lib.listarPaginaCotizaciones.mock.calls.map(([opciones]) => opciones?.pagina);
}

/* ------------------------------------------------------------------------------------------------
 * Montaje
 * ---------------------------------------------------------------------------------------------- */

interface OpcionesDeMontaje {
  /** `detalle`: solo `/dashboard/cotizaciones/:id` (así `catalogo` llega como `:id`). */
  rutas?: "completas" | "detalle";
  extra?: ReactNode;
}

/**
 * Monta las pantallas bajo `MemoryRouter` y devuelve, además, en cada confirmación (`commit`) de React: el texto del
 * documento (`instantaneas`: sirve para comprobar que NINGUNA confirmación posterior a un cambio muestra datos
 * ajenos) y el texto de la región en vivo del listado (`avisos`, `null` si no hay ninguna).
 */
function montar(ruta: string, { rutas = "completas", extra }: OpcionesDeMontaje = {}) {
  const instantaneas: string[] = [];
  const avisos: Array<string | null> = [];
  const alConfirmar = () => {
    instantaneas.push(document.body.textContent ?? "");
    avisos.push(document.body.querySelector("[aria-live]")?.textContent ?? null);
  };
  const vista = render(
    <MemoryRouter initialEntries={[ruta]}>
      <Profiler id="cotizaciones" onRender={alConfirmar}>
        <Routes>
          {rutas === "completas" && (
            <>
              <Route path="/dashboard/cotizaciones" element={<CotizacionesList />} />
              <Route path="/dashboard/cotizaciones/catalogo" element={<CotizacionesCatalogo />} />
            </>
          )}
          <Route path="/dashboard/cotizaciones/:id" element={<CotizacionDetalle />} />
        </Routes>
      </Profiler>
      {extra}
    </MemoryRouter>,
  );
  return { ...vista, instantaneas, avisos };
}

const RUTA_LISTA = "/dashboard/cotizaciones";
const rutaDetalle = (id: string) => `/dashboard/cotizaciones/${id}`;

/* ------------------------------------------------------------------------------------------------
 * Guardas globales: sin red, sin consulta directa a Supabase y sin avisos en la consola
 * ---------------------------------------------------------------------------------------------- */

const fetchEspia = vi.fn(() => {
  throw new Error("red real no permitida en estas pruebas");
});
let consolaError: ReturnType<typeof vi.spyOn>;
let consolaAviso: ReturnType<typeof vi.spyOn>;
let xhrEspia: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  lib.listarPaginaCotizaciones.mockReset();
  lib.obtenerCotizacion.mockReset();
  supabaseFrom.mockClear();
  fetchEspia.mockClear();
  vi.stubGlobal("fetch", fetchEspia);
  xhrEspia = vi.spyOn(XMLHttpRequest.prototype, "open").mockImplementation(() => {
    throw new Error("red real no permitida en estas pruebas");
  });
  consolaError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  consolaAviso = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  act(() => sesion.fijar({ user: ADMIN_1, userType: 0, loading: false }));
});

afterEach(() => {
  cleanup();
  const errores = consolaError.mock.calls;
  // React Router 6 avisa UNA vez por carga de módulo de sus banderas «future» de la v7. No es un fallo de las
  // pantallas, y activarlas aquí cambiaría el comportamiento de la navegación respecto a `App.tsx`: se descartan
  // esos dos avisos conocidos y cualquier otro sigue haciendo fallar la prueba.
  const avisos = consolaAviso.mock.calls.filter(([mensaje]) => !String(mensaje).includes("React Router Future Flag Warning"));
  const llamadasAFetch = fetchEspia.mock.calls.length;
  const llamadasAXhr = xhrEspia.mock.calls.length;
  const consultasDirectas = supabaseFrom.mock.calls.length;
  consolaError.mockRestore();
  consolaAviso.mockRestore();
  xhrEspia.mockRestore();
  vi.unstubAllGlobals();
  // Ninguna prueba produce avisos de React ni del router, ni toca la red ni consulta Supabase por su cuenta.
  expect(errores).toEqual([]);
  expect(avisos).toEqual([]);
  expect(llamadasAFetch).toBe(0);
  expect(llamadasAXhr).toBe(0);
  expect(consultasDirectas).toBe(0);
});

/* ------------------------------------------------------------------------------------------------
 * Utilidades de comprobación
 * ---------------------------------------------------------------------------------------------- */

/** Espacios (incluidos los de ancho fijo que pone `Intl`) como un solo espacio. */
const normalizar = (texto: string | null | undefined) => (texto ?? "").replace(/\s+/g, " ").trim();

/**
 * Fechas y horas de Honduras tal como las escribe `Intl` (es-HN). La forma exacta depende de la versión de ICU del
 * Node que corra la prueba: la coma entre fecha y hora («9 nov 2026, 9:00 p. m.» o «9 nov 2026 9:00 p. m.»), el punto
 * tras el mes («nov» o «nov.»), «p. m.» o «p.m.» y la zona (`GMT-6` o `CST`). Se aceptan esas variantes, pero cada
 * parte se afirma por separado contra un valor escrito a mano (sin volver a usar `Intl`) y la fecha y la hora tienen
 * que aparecer juntas y en ese orden. Cualquier otra zona (UTC, GMT+9…) o el día de otra zona hace fallar la prueba.
 */
const DIA_SOLO = /^(\d{1,2}) ([a-zñ]{3})\.? (\d{4})$/i;
const HORA_Y_ZONA = /^(\d{1,2}:\d{2}) ([ap])\. ?m\. (GMT-6|CST)$/i;
const DIA_HORA_Y_ZONA = /^(\d{1,2}) ([a-zñ]{3})\.? (\d{4})(?:, | )(\d{1,2}:\d{2}) ([ap])\. ?m\. (GMT-6|CST)$/i;
const ZONAS_DE_HONDURAS = ["GMT-6", "CST"];

/** «9 nov 2026» o «9 nov. 2026» como «9 nov 2026»; `null` si el texto no es solo un día. */
function leerDia(texto: string | null | undefined): string | null {
  const partes = DIA_SOLO.exec(normalizar(texto));
  return partes === null ? null : `${Number(partes[1])} ${partes[2].toLowerCase()} ${partes[3]}`;
}

interface HoraEsperada {
  /** «9:00», tal como se escribe a mano. */
  hora: string;
  /** `true` para «p. m.», `false` para «a. m.». */
  tarde: boolean;
}

/** Afirma por separado cada parte de una hora con su indicador y su zona («9:00 p. m. GMT-6»). */
function expectaHora(texto: string | null | undefined, esperada: HoraEsperada) {
  const partes = HORA_Y_ZONA.exec(normalizar(texto));
  expect(partes, `hora, indicador y zona de Honduras en «${texto}»`).not.toBeNull();
  if (partes === null) return;
  expect(partes[1]).toBe(esperada.hora);
  expect(partes[2].toLowerCase()).toBe(esperada.tarde ? "p" : "a");
  expect(ZONAS_DE_HONDURAS).toContain(partes[3].toUpperCase());
}

/** Afirma por separado el día, la hora, el indicador y la zona, y que fecha y hora van juntas y en ese orden. */
function expectaDiaYHora(texto: string | null | undefined, esperada: HoraEsperada & { dia: string }) {
  const partes = DIA_HORA_Y_ZONA.exec(normalizar(texto));
  expect(partes, `día, hora, indicador y zona de Honduras, en ese orden, en «${texto}»`).not.toBeNull();
  if (partes === null) return;
  expect(`${Number(partes[1])} ${partes[2].toLowerCase()} ${partes[3]}`).toBe(esperada.dia);
  expect(partes[4]).toBe(esperada.hora);
  expect(partes[5].toLowerCase()).toBe(esperada.tarde ? "p" : "a");
  expect(ZONAS_DE_HONDURAS).toContain(partes[6].toUpperCase());
}

// Nada de esto debe verse nunca en una pantalla de Cotizaciones.
const TEXTO_TECNICO: RegExp[] = [
  /undefined/i,
  /\bnull\b/i,
  /\[object/i,
  /\bNaN\b/,
  /Invalid Date/i,
  /PGRST/i,
  /COT:/,
  /supabase/i,
  /TypeError/,
  /ErrorCotizacion/,
  /row_version/i,
  /\bjwt\b/i,
  /\bstack\b/i,
  /\buuid\b/i,
  /\bstatus\b/i,
  /\bHTTP\b/i,
];

function sinTextoTecnico(texto: string | null | undefined) {
  for (const patron of TEXTO_TECNICO) expect(texto ?? "").not.toMatch(patron);
}

/** Niveles de los encabezados del documento, en orden de aparición. */
function nivelesDeEncabezado(): number[] {
  return Array.from(document.body.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => Number(h.tagName[1]));
}

/** Un `h1` por página y sin saltos de nivel hacia abajo (h1, h2, h2, h3…). */
function expectaEncabezadosEnOrden() {
  const niveles = nivelesDeEncabezado();
  expect(niveles.filter((n) => n === 1)).toHaveLength(1);
  expect(niveles[0]).toBe(1);
  niveles.forEach((nivel, i) => {
    if (i > 0) expect(nivel).toBeLessThanOrEqual(niveles[i - 1] + 1);
  });
}

/** Todo control con nombre accesible y ninguna imagen vectorial expuesta a lectores de pantalla. */
function expectaControlesConNombre() {
  for (const control of [...screen.queryAllByRole("button"), ...screen.queryAllByRole("link")]) {
    expect(control).toHaveAccessibleName();
  }
  expect(document.body.querySelectorAll("svg:not([aria-hidden='true'])")).toHaveLength(0);
}

/** Nada ejecutable ni activo salió del texto del prospecto. */
function expectaSinMarcadoActivo() {
  const peligrosos = document.body.querySelectorAll(
    "img, script, iframe, object, embed, [onerror], [onload], [onclick], a[href^='javascript:' i]",
  );
  expect(Array.from(peligrosos).map((nodo) => nodo.outerHTML)).toEqual([]);
}

/**
 * El valor del prospecto es texto literal dentro de un único `bdi` (que aísla el sentido de escritura del valor para
 * que un control bidi no invierta lo de alrededor): un solo hijo, `BDI`, sin hijos propios y con el mismo
 * `textContent` que el contenedor.
 */
function expectaSoloTextoEnBdi(contenedor: HTMLElement, literal: string) {
  expect(contenedor.children).toHaveLength(1);
  const bdi = contenedor.children[0];
  expect(bdi.tagName).toBe("BDI");
  expect(bdi.children).toHaveLength(0);
  expect(bdi.textContent).toBe(literal);
  expect(contenedor.textContent).toBe(literal);
}

/** El `dd` de la lista de definición del detalle cuyo `dt` es `etiqueta`. */
function valorDe(etiqueta: string): HTMLElement {
  const dt = screen.getByText(etiqueta, { selector: "dt" });
  const dd = dt.nextElementSibling;
  if (!(dd instanceof HTMLElement) || dd.tagName !== "DD") throw new Error(`«${etiqueta}» no tiene su dd`);
  return dd;
}

const botonAnterior = () => screen.getByRole("button", { name: /anterior/i });
const botonSiguiente = () => screen.getByRole("button", { name: /siguiente/i });

/** La región en vivo del listado: tiene que haber exactamente una `aria-live` en toda la pantalla. */
function avisoEnVivo(): HTMLElement {
  const regiones = document.body.querySelectorAll<HTMLElement>("[aria-live]");
  expect(regiones).toHaveLength(1);
  return regiones[0];
}
const textoDelAviso = () => normalizar(avisoEnVivo().textContent);

/** Las únicas frases que puede decir la región en vivo: la página y si cargó. Nunca datos del prospecto. */
const FRASE_DEL_AVISO = /^(Cargando página [0-9]+…|Página [0-9]+( cargada)?)$/;

/** Cada valor distinto, en orden, que tomó una serie (sin repetir consecutivos). */
const sinRepetidos = <T,>(serie: T[]): T[] => serie.filter((valor, i) => i === 0 || valor !== serie[i - 1]);

/**
 * «Anterior»/«Siguiente» no disponibles: `aria-disabled="true"` y SIN `disabled` nativo (un botón que se deshabilita
 * estando enfocado pierde el foco), con `pointer-events-none` para que el ratón no lo active.
 */
function expectaNoDisponible(boton: HTMLElement) {
  expect(boton).toHaveAttribute("aria-disabled", "true");
  expect(boton).not.toBeDisabled();
  expect(boton).toHaveClass("pointer-events-none");
}

function expectaDisponible(boton: HTMLElement) {
  expect(boton).not.toHaveAttribute("aria-disabled", "true");
  expect(boton).not.toBeDisabled();
  expect(boton).not.toHaveClass("pointer-events-none");
}

/**
 * Activa un control que no procede de todas las formas posibles (clic del usuario, `click()` y las teclas Enter y
 * espacio) y comprueba que no pide ninguna página, no cambia el aviso y conserva el foco. En el navegador Enter y
 * espacio sobre un `<button>` terminan en un `click`; jsdom no lo emula, por eso el `click` también se envía directo.
 */
async function activarSinEfecto(boton: HTMLElement) {
  const pedidasAntes = paginasPedidas();
  const avisoAntes = textoDelAviso();
  boton.focus();
  expect(document.activeElement).toBe(boton);

  fireEvent.click(boton);
  act(() => boton.click());
  for (const tecla of ["Enter", " "]) {
    fireEvent.keyDown(boton, { key: tecla });
    fireEvent.keyUp(boton, { key: tecla });
  }
  await act(async () => {});

  expect(paginasPedidas()).toEqual(pedidasAntes);
  expect(textoDelAviso()).toBe(avisoAntes);
  expect(document.activeElement).toBe(boton);
}

/* ------------------------------------------------------------------------------------------------
 * Controles de la propia suite
 * ---------------------------------------------------------------------------------------------- */

describe("controles de la suite", () => {
  it("la sesión simulada repinta a quien la lee y el espía de consola ve los avisos", () => {
    servirPaginas({ 1: pagina([resumen(1)]) });
    montar(RUTA_LISTA);
    expect(lib.listarPaginaCotizaciones).toHaveBeenCalledTimes(1);

    iniciarSesion(null, null);
    expect(screen.queryByRole("link", { name: "BOR-1" })).toBeNull();

    // Control positivo de los espías: lo que se escriba ahora lo verá la comprobación de `afterEach`.
    console.warn("control");
    console.error("control");
    expect(consolaAviso.mock.calls).toContainEqual(["control"]);
    expect(consolaError.mock.calls).toEqual([["control"]]);
    consolaAviso.mockClear();
    consolaError.mockClear();
  });
});

/* ------------------------------------------------------------------------------------------------
 * T013 · Listado
 * ---------------------------------------------------------------------------------------------- */

describe("T013 · listado", () => {
  it("pide la primera página con tamano 25 y una AbortSignal", async () => {
    servirPaginas({ 1: pagina([resumen(1)]) });
    montar(RUTA_LISTA);
    await screen.findByRole("table");

    expect(lib.listarPaginaCotizaciones).toHaveBeenCalledTimes(1);
    const [opciones] = lib.listarPaginaCotizaciones.mock.calls[0];
    expect(Object.keys(opciones ?? {}).sort()).toEqual(["pagina", "signal", "tamano"]);
    expect(opciones?.pagina).toBe(1);
    expect(opciones?.tamano).toBe(25);
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
    expect(opciones?.signal?.aborted).toBe(false);
  });

  it("mientras carga: región ocupada, texto para lectores de pantalla y sin tabla ni alerta", () => {
    lib.listarPaginaCotizaciones.mockReturnValue(diferida<PaginaCotizaciones>().promesa);
    const { container } = montar(RUTA_LISTA);

    const ocupada = container.querySelector('[aria-busy="true"]');
    expect(ocupada).not.toBeNull();
    expect(ocupada).toHaveTextContent("Cargando cotizaciones…");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Cotizaciones" })).toBeInTheDocument();
    sinTextoTecnico(container.textContent);
  });

  it("vacío: EmptyState claro, sin tabla, sin paginación y sin texto técnico", async () => {
    servirPaginas({ 1: pagina([]) });
    const { container } = montar(RUTA_LISTA);

    const titulo = await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });
    expect(titulo).toBeInTheDocument();
    expect(screen.getByText("Las cotizaciones que se creen aparecerán aquí.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("navigation", { name: /paginación/i })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    sinTextoTecnico(container.textContent);
  });

  it("éxito: tabla con nombre accesible, columnas y una fila por cotización, en el orden recibido", async () => {
    servirPaginas({ 1: pagina([resumen(3), resumen(2), resumen(1)]) });
    montar(RUTA_LISTA);

    const tabla = await screen.findByRole("table", { name: "Cotizaciones, de la más reciente a la más antigua." });
    const cabeceras = within(tabla)
      .getAllByRole("columnheader")
      .map((c) => c.textContent);
    expect(cabeceras).toEqual(["Referencia", "Prospecto", "Estado", "Fecha de creación"]);

    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas).toHaveLength(3);
    expect(filas.map((fila) => within(fila).getAllByRole("cell")[0].textContent)).toEqual(["BOR-3", "BOR-2", "BOR-1"]);
    expect(within(filas[0]).getAllByRole("cell")[1].textContent).toBe("Prospecto sintético 3");
    expect(screen.getByRole("region", { name: /tabla de cotizaciones/i })).toBeInTheDocument();
  });

  it("la referencia enlaza al detalle de su cotización", async () => {
    servirPaginas({ 1: pagina([resumen(1), resumen(2)]) });
    montar(RUTA_LISTA);

    await screen.findByRole("table");
    expect(screen.getByRole("link", { name: "BOR-1" })).toHaveAttribute("href", `/dashboard/cotizaciones/${idDe(1)}`);
    expect(screen.getByRole("link", { name: "BOR-2" })).toHaveAttribute("href", `/dashboard/cotizaciones/${idDe(2)}`);
  });

  it("los cinco estados salen con su etiqueta en español, siempre como texto", async () => {
    const estados: Array<[EstadoCotizacion, string]> = [
      ["borrador", "Borrador"],
      ["emitida", "Emitida"],
      ["aceptada_firmada", "Aceptada y firmada"],
      ["rechazada", "Rechazada"],
      ["cancelada", "Cancelada"],
    ];
    servirPaginas({ 1: pagina(estados.map(([estado], i) => resumen(i + 1, { estado }))) });
    const { container } = montar(RUTA_LISTA);

    const tabla = await screen.findByRole("table");
    const filas = within(tabla).getAllByRole("row").slice(1);
    estados.forEach(([, etiqueta], i) => {
      expect(within(filas[i]).getAllByRole("cell")[2].textContent).toBe(etiqueta);
    });
    // Nunca se pinta el valor guardado.
    expect(container.textContent).not.toContain("aceptada_firmada");
  });

  it("la fecha sale en el día comercial de Honduras, no en el de UTC ni el del navegador", async () => {
    servirPaginas({
      1: pagina([
        resumen(1, { creado_at: CREADA_NOCHE }),
        resumen(2, { creado_at: "2026-11-10T05:59:59.000Z" }),
        resumen(3, { creado_at: "2026-11-10T06:00:00.000Z" }),
        resumen(4, { creado_at: "2027-01-01T05:59:59.000Z" }),
      ]),
    });
    const { container } = montar(RUTA_LISTA);
    await screen.findByRole("table");

    const tiempos = Array.from(container.querySelectorAll("tbody time"));
    expect(tiempos.map((t) => leerDia(t.textContent))).toEqual(["9 nov 2026", "9 nov 2026", "10 nov 2026", "31 dic 2026"]);
    expect(tiempos[0]).toHaveAttribute("datetime", CREADA_NOCHE);
    // La zona va a la vista en el título (el texto de ayuda de la fecha).
    expectaDiaYHora(tiempos[0].getAttribute("title"), { dia: "9 nov 2026", hora: "9:00", tarde: true });
    expectaDiaYHora(tiempos[2].getAttribute("title"), { dia: "10 nov 2026", hora: "12:00", tarde: false });
  });

  it("la hora exacta con su zona también va en un texto sólo para lectores de pantalla, junto a la fecha", async () => {
    servirPaginas({
      1: pagina([
        resumen(1, { creado_at: CREADA_NOCHE }),
        resumen(2, { creado_at: "2026-11-10T05:59:59.000Z" }),
        resumen(3, { creado_at: "2026-11-10T06:00:00.000Z" }),
      ]),
    });
    const { container } = montar(RUTA_LISTA);
    await screen.findByRole("table");

    const tiempos = Array.from(container.querySelectorAll("tbody time"));
    const horas = tiempos.map((tiempo) => tiempo.nextElementSibling);
    // El elemento de la hora es el hermano inmediato de <time>, sólo para lectores de pantalla.
    for (const hora of horas) {
      expect(hora?.tagName).toBe("SPAN");
      expect(hora).toHaveClass("sr-only");
    }
    // El texto de la hora empieza con la coma propia del componente; lo demás es la hora con su indicador y zona.
    const esperadas: HoraEsperada[] = [
      { hora: "9:00", tarde: true },
      { hora: "11:59", tarde: true },
      { hora: "12:00", tarde: false },
    ];
    horas.forEach((hora, i) => {
      expect(hora?.textContent ?? "").toMatch(/^, /);
      expectaHora((hora?.textContent ?? "").replace(/^, /, ""), esperadas[i]);
    });
    // Lo que se lee de la celda: el día y, enseguida y en ese orden, la hora con su zona.
    const celdas = tiempos.map((tiempo) => tiempo.closest("td"));
    expectaDiaYHora(celdas[0]?.textContent, { dia: "9 nov 2026", ...esperadas[0] });
    expectaDiaYHora(celdas[1]?.textContent, { dia: "9 nov 2026", ...esperadas[1] });
    expectaDiaYHora(celdas[2]?.textContent, { dia: "10 nov 2026", ...esperadas[2] });
    // Lo que se VE no cambia: <time> sigue mostrando sólo el día.
    expect(tiempos.map((tiempo) => leerDia(tiempo.textContent))).toEqual(["9 nov 2026", "9 nov 2026", "10 nov 2026"]);
  });

  it("una fecha que no lo es sale como «Sin dato», nunca como «Invalid Date», y no añade texto de hora", async () => {
    servirPaginas({ 1: pagina([resumen(1, { creado_at: "no-es-una-fecha" })]) });
    const { container } = montar(RUTA_LISTA);
    await screen.findByRole("table");

    expect(container.querySelector("tbody time")).toHaveTextContent("Sin dato");
    expect(container.querySelector("tbody .sr-only")).toBeNull();
    expect(container.querySelector("tbody time")?.closest("td")?.textContent).toBe("Sin dato");
    sinTextoTecnico(container.textContent);
  });

  it("un prospecto sin nombre (null, vacío o solo espacios) sale como «Sin nombre»", async () => {
    servirPaginas({
      1: pagina([
        resumen(1, { prospecto_nombre: null }),
        resumen(2, { prospecto_nombre: "" }),
        resumen(3, { prospecto_nombre: "   " }),
        resumen(4, { prospecto_nombre: "Con nombre" }),
      ]),
    });
    montar(RUTA_LISTA);

    const tabla = await screen.findByRole("table");
    const celdas = within(tabla)
      .getAllByRole("row")
      .slice(1)
      .map((fila) => within(fila).getAllByRole("cell")[1].textContent);
    expect(celdas).toEqual(["Sin nombre", "Sin nombre", "Sin nombre", "Con nombre"]);
  });

  it("no muestra la versión de fila ni ningún dato interno", async () => {
    servirPaginas({ 1: pagina([resumen(1, { row_version: 90210 })]) });
    const { container } = montar(RUTA_LISTA);
    await screen.findByRole("table");

    expect(container.textContent).not.toContain("90210");
    sinTextoTecnico(container.textContent);
  });

  it("el enlace «Ver catálogo» lleva al catálogo", async () => {
    servirPaginas({ 1: pagina([]) });
    montar(RUTA_LISTA);
    await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });

    const enlace = screen.getByRole("link", { name: "Ver catálogo" });
    expect(enlace).toHaveAttribute("href", "/dashboard/cotizaciones/catalogo");
    fireEvent.click(enlace);
    expect(await screen.findByText("El catálogo se habilita en la siguiente fase")).toBeInTheDocument();
  });

  it("seguir una referencia abre el detalle y pide esa cotización", async () => {
    servirPaginas({ 1: pagina([resumen(1)]) });
    lib.obtenerCotizacion.mockResolvedValue(cotizacion({ id: idDe(1), referencia_interna: "BOR-1" }));
    montar(RUTA_LISTA);

    fireEvent.click(await screen.findByRole("link", { name: "BOR-1" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Cotización BOR-1" })).toBeInTheDocument();
    expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(1);
    expect(lib.obtenerCotizacion.mock.calls[0][0]).toBe(idDe(1));
  });

  describe("error", () => {
    it("muestra el mensaje genérico en una alerta con «Reintentar», sin texto crudo", async () => {
      const crudo = new Error("PGRST301 JWT expired · tabla cotizaciones · prospecto.sintetico@example.test");
      lib.listarPaginaCotizaciones.mockRejectedValue(crudo);
      const { container } = montar(RUTA_LISTA);

      const alerta = await screen.findByRole("alert");
      expect(alerta).toHaveTextContent(MENSAJE_ERROR_GENERICO);
      expect(alerta.querySelector("p")?.textContent).toBe(traducirErrorCotizacion(crudo));
      expect(alerta.querySelector("p")?.textContent).toBe(
        "No se pudo completar la operación. Inténtalo de nuevo.",
      );
      expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/PGRST|JWT|prospecto\.sintetico/);
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.getAllByRole("alert")).toHaveLength(1);
    });

    it("un código conocido sale con su texto aprobado", async () => {
      lib.listarPaginaCotizaciones.mockRejectedValue(new ErrorCotizacion("SIN_PERMISO"));
      montar(RUTA_LISTA);

      expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
    });

    it.each<[string, unknown]>([
      ["DATOS_INVALIDOS", new ErrorCotizacion("DATOS_INVALIDOS")],
      ["una cadena suelta", "boom"],
      ["null", null],
    ])("un fallo sin texto aprobado (%s) sale con el genérico", async (_nombre, fallo) => {
      lib.listarPaginaCotizaciones.mockRejectedValue(fallo);
      montar(RUTA_LISTA);

      expect(await screen.findByRole("alert")).toHaveTextContent(MENSAJE_ERROR_GENERICO);
    });

    it("«Reintentar» vuelve a pedir la misma página con otra señal y aborta la anterior", async () => {
      const segunda = diferida<PaginaCotizaciones>();
      lib.listarPaginaCotizaciones
        .mockRejectedValueOnce(new Error("fallo sintético"))
        .mockReturnValueOnce(segunda.promesa);
      const { container } = montar(RUTA_LISTA);

      fireEvent.click(await within(await screen.findByRole("alert")).findByRole("button", { name: "Reintentar" }));
      expect(lib.listarPaginaCotizaciones).toHaveBeenCalledTimes(2);
      const [primera, repetida] = lib.listarPaginaCotizaciones.mock.calls.map(([opciones]) => opciones);
      expect(repetida?.pagina).toBe(primera?.pagina);
      expect(repetida?.tamano).toBe(25);
      expect(repetida?.signal).not.toBe(primera?.signal);
      expect(primera?.signal?.aborted).toBe(true);
      expect(repetida?.signal?.aborted).toBe(false);

      // Mientras reintenta no queda la alerta anterior y sí el estado de carga.
      expect(screen.queryByRole("alert")).toBeNull();
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

      await entregar(segunda, pagina([resumen(1)]));
      expect(await screen.findByRole("table")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("sin sesión de administrador no pide ni muestra nada", () => {
    const SIN_ACCESO: Array<[string, () => void]> = [
      ["la sesión aún se resuelve", () => iniciarSesion(ADMIN_1, 0, true)],
      ["sin usuario", () => iniciarSesion(null, 0)],
      ["colaborador (userType 1)", () => iniciarSesion(ADMIN_1, 1)],
      ["cliente (userType 2)", () => iniciarSesion(ADMIN_1, 2)],
      ["rol desconocido (userType null)", () => iniciarSesion(ADMIN_1, null)],
    ];

    it.each(SIN_ACCESO)("%s", async (_nombre, preparar) => {
      servirPaginas({ 1: pagina([resumen(1)]) });
      preparar();
      const { container } = montar(RUTA_LISTA);
      await act(async () => {});

      expect(lib.listarPaginaCotizaciones).not.toHaveBeenCalled();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByText("Prospecto sintético 1")).toBeNull();
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
  });
});

/* ------------------------------------------------------------------------------------------------
 * T013 · Paginación del listado
 * ---------------------------------------------------------------------------------------------- */

describe("T013 · paginación del listado", () => {
  it("en la página 1: «Anterior» no disponible y «Siguiente» según haySiguiente", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true) });
    montar(RUTA_LISTA);
    await screen.findByRole("table");

    expectaNoDisponible(botonAnterior());
    expectaDisponible(botonSiguiente());
    expect(botonAnterior()).toHaveTextContent("Anterior");
    expect(botonSiguiente()).toHaveTextContent("Siguiente");
    // «Anterior» no retrocede de la página 1 por ninguna vía.
    await activarSinEfecto(botonAnterior());
    expect(paginasPedidas()).toEqual([1]);
  });

  it("«Siguiente» no está disponible cuando no hay página siguiente, y activarlo no pide nada", async () => {
    servirPaginas({ 1: pagina([resumen(1)], false) });
    montar(RUTA_LISTA);
    await screen.findByRole("table");

    expectaNoDisponible(botonSiguiente());
    expectaNoDisponible(botonAnterior());
    await activarSinEfecto(botonSiguiente());
    await activarSinEfecto(botonAnterior());
    expect(paginasPedidas()).toEqual([1]);
    expect(screen.getByRole("link", { name: "BOR-1" })).toBeInTheDocument();
  });

  it("durante la carga de la página 1 ambos controles no están disponibles y activarlos no pide nada", async () => {
    lib.listarPaginaCotizaciones.mockReturnValue(diferida<PaginaCotizaciones>().promesa);
    montar(RUTA_LISTA);

    expectaNoDisponible(botonAnterior());
    expectaNoDisponible(botonSiguiente());
    await activarSinEfecto(botonSiguiente());
    await activarSinEfecto(botonAnterior());
    expect(paginasPedidas()).toEqual([1]);
  });

  it("tras un error, «Siguiente» no está disponible y activarlo no pide nada", async () => {
    lib.listarPaginaCotizaciones.mockRejectedValue(new Error("fallo sintético"));
    montar(RUTA_LISTA);
    await screen.findByRole("alert");

    expectaNoDisponible(botonSiguiente());
    expectaNoDisponible(botonAnterior());
    await activarSinEfecto(botonSiguiente());
    expect(paginasPedidas()).toEqual([1]);
  });

  it("avanzar y retroceder pide la página correcta, de a 25, y cambia las filas", async () => {
    servirPaginas({
      1: pagina([resumen(1)], true),
      2: pagina([resumen(2)], true),
      3: pagina([resumen(3)], false),
    });
    montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });

    fireEvent.click(botonSiguiente());
    await screen.findByRole("link", { name: "BOR-2" });
    expect(screen.queryByRole("link", { name: "BOR-1" })).toBeNull();
    expectaDisponible(botonAnterior());

    fireEvent.click(botonSiguiente());
    await screen.findByRole("link", { name: "BOR-3" });
    // En la última página «Siguiente» no procede y no pide la 4.
    expectaNoDisponible(botonSiguiente());
    await activarSinEfecto(botonSiguiente());

    fireEvent.click(botonAnterior());
    await screen.findByRole("link", { name: "BOR-2" });
    fireEvent.click(botonAnterior());
    await screen.findByRole("link", { name: "BOR-1" });
    // De vuelta en la primera, «Anterior» no procede y no pide la 0.
    expectaNoDisponible(botonAnterior());
    await activarSinEfecto(botonAnterior());

    expect(paginasPedidas()).toEqual([1, 2, 3, 2, 1]);
    for (const [opciones] of lib.listarPaginaCotizaciones.mock.calls) {
      expect(opciones?.tamano).toBe(25);
      expect(opciones?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("al cambiar de página no queda ninguna fila de la anterior; «Siguiente» no está disponible mientras carga", async () => {
    const segunda = diferida<PaginaCotizaciones>();
    lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(1)], true)).mockReturnValueOnce(segunda.promesa);
    const { container } = montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });

    fireEvent.click(botonSiguiente());

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Prospecto sintético 1")).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expectaNoDisponible(botonSiguiente());
    // Pulsarlo de nuevo mientras carga no pide una tercera página.
    await activarSinEfecto(botonSiguiente());
    expect(paginasPedidas()).toEqual([1, 2]);
    // Se puede volver atrás mientras carga.
    expectaDisponible(botonAnterior());
  });

  it("la región en vivo es única, queda fuera del nav, es siempre la misma y anuncia carga y página", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true), 2: pagina([resumen(2)], false) });
    const vista = montar(RUTA_LISTA);

    const region = avisoEnVivo();
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region.closest("nav")).toBeNull();
    expect(region.parentElement).not.toHaveClass("sr-only");
    expect(textoDelAviso()).toBe("Cargando página 1…");

    await screen.findByRole("table");
    expect(textoDelAviso()).toBe("Página 1 cargada");

    fireEvent.click(botonSiguiente());
    expect(textoDelAviso()).toBe("Cargando página 2…");
    await screen.findByRole("link", { name: "BOR-2" });
    expect(textoDelAviso()).toBe("Página 2 cargada");

    // Siempre el mismo nodo (si se volviera a montar, el lector de pantalla no anunciaría el cambio).
    expect(avisoEnVivo()).toBe(region);
    expect(screen.getByRole("navigation", { name: "Paginación de cotizaciones" })).not.toContainElement(region);

    // La secuencia completa, confirmación a confirmación, y solo con frases de página: sin datos del prospecto.
    const secuencia = sinRepetidos(vista.avisos.map((aviso) => normalizar(aviso)));
    expect(secuencia).toEqual(["Cargando página 1…", "Página 1 cargada", "Cargando página 2…", "Página 2 cargada"]);
    for (const aviso of vista.avisos) expect(normalizar(aviso)).toMatch(FRASE_DEL_AVISO);
    for (const aviso of vista.avisos) expect(aviso).not.toContain("Prospecto");
  });

  it("la región en vivo con un error dice solo «Página N» (el error lo anuncia su alerta) y sigue siendo la misma", async () => {
    lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(1)], true)).mockRejectedValueOnce(new Error("fallo sintético"));
    const vista = montar(RUTA_LISTA);
    await screen.findByRole("table");
    const region = avisoEnVivo();

    fireEvent.click(botonSiguiente());
    await screen.findByRole("alert");

    expect(avisoEnVivo()).toBe(region);
    expect(textoDelAviso()).toBe("Página 2");
    expect(region.parentElement).not.toHaveClass("sr-only");
    for (const aviso of vista.avisos) expect(normalizar(aviso)).toMatch(FRASE_DEL_AVISO);
    expect(sinRepetidos(vista.avisos.map((aviso) => normalizar(aviso)))).toEqual([
      "Cargando página 1…",
      "Página 1 cargada",
      "Cargando página 2…",
      "Página 2",
    ]);
  });

  it("una página posterior vacía ofrece volver a la primera y mantiene la paginación", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true), 2: pagina([], false) });
    montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });

    fireEvent.click(botonSiguiente());
    expect(await screen.findByRole("heading", { level: 2, name: "Esta página no tiene cotizaciones" })).toBeInTheDocument();
    expect(screen.getByText("Puede que ya no haya más resultados.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
    // La paginación sigue ahí y se puede retroceder.
    expectaDisponible(botonAnterior());
    expectaNoDisponible(botonSiguiente());
    await activarSinEfecto(botonSiguiente());
    expect(textoDelAviso()).toBe("Página 2 cargada");
    expect(avisoEnVivo().parentElement).not.toHaveClass("sr-only");

    fireEvent.click(screen.getByRole("button", { name: "Volver a la primera página" }));
    expect(await screen.findByRole("link", { name: "BOR-1" })).toBeInTheDocument();
    expect(textoDelAviso()).toBe("Página 1 cargada");
    expect(paginasPedidas()).toEqual([1, 2, 1]);
  });

  it("una respuesta tardía de otra página no se pinta", async () => {
    const segunda = diferida<PaginaCotizaciones>();
    lib.listarPaginaCotizaciones
      .mockResolvedValueOnce(pagina([resumen(1)], true))
      .mockReturnValueOnce(segunda.promesa)
      .mockResolvedValueOnce(pagina([resumen(1)], true));
    montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });

    fireEvent.click(botonSiguiente()); // pide la 2 (pendiente)
    fireEvent.click(botonAnterior()); // vuelve a la 1 antes de que llegue la 2
    await screen.findByRole("link", { name: "BOR-1" });

    await entregar(segunda, pagina([resumen(2)], false));
    expect(screen.queryByRole("link", { name: "BOR-2" })).toBeNull();
    expect(screen.getByRole("link", { name: "BOR-1" })).toBeInTheDocument();
    expect(textoDelAviso()).toBe("Página 1 cargada");
    expect(paginasPedidas()).toEqual([1, 2, 1]);
  });

  it("volver a una página ya vista (1 → 2 → 1) no pinta las filas viejas: carga de nuevo y la región en vivo lo anuncia", async () => {
    const otraVez = diferida<PaginaCotizaciones>();
    lib.listarPaginaCotizaciones
      .mockResolvedValueOnce(pagina([resumen(1)], true)) // página 1
      .mockReturnValueOnce(diferida<PaginaCotizaciones>().promesa) // página 2, sin respuesta
      .mockReturnValueOnce(otraVez.promesa); // página 1 otra vez
    const vista = montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });
    expect(textoDelAviso()).toBe("Página 1 cargada");

    const desde = vista.instantaneas.length;
    fireEvent.click(botonSiguiente());
    fireEvent.click(botonAnterior());

    // Se pidió otra vez la página 1 y todavía no hay respuesta: nada de las filas viejas, y se anuncia la carga.
    expect(paginasPedidas()).toEqual([1, 2, 1]);
    expect(screen.queryByRole("link", { name: "BOR-1" })).toBeNull();
    expect(screen.queryByText("Prospecto sintético 1")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    expect(vista.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(textoDelAviso()).toBe("Cargando página 1…");
    expect(textoDelAviso()).not.toBe("Página 1 cargada");

    await entregar(otraVez, pagina([resumen(1, { prospecto_nombre: "Prospecto sintético 1 (nuevo)" })], true));
    expect(await screen.findByText("Prospecto sintético 1 (nuevo)")).toBeInTheDocument();
    expect(textoDelAviso()).toBe("Página 1 cargada");

    // En ninguna confirmación desde que se dejó la página 1 se vieron sus filas viejas ni «Página 1 cargada» antes
    // de tiempo: la secuencia de avisos es la de dos cargas, sin atajos.
    expect(
      vista.instantaneas.slice(desde).filter((texto) => texto.includes("Prospecto sintético 1") && !texto.includes("(nuevo)")),
    ).toEqual([]);
    expect(sinRepetidos(vista.avisos.slice(desde).map((aviso) => normalizar(aviso)))).toEqual([
      "Cargando página 2…",
      "Cargando página 1…",
      "Página 1 cargada",
    ]);
  });

  it("cada cambio de página aborta la petición anterior", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true), 2: pagina([resumen(2)], false) });
    montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });
    fireEvent.click(botonSiguiente());
    await screen.findByRole("link", { name: "BOR-2" });

    const [primera, segunda] = lib.listarPaginaCotizaciones.mock.calls.map(([opciones]) => opciones?.signal);
    expect(primera?.aborted).toBe(true);
    expect(segunda?.aborted).toBe(false);
  });

  it("la primera página vacía no muestra ni nav ni botones; la región en vivo sigue montada solo para lectores", async () => {
    servirPaginas({ 1: pagina([]) });
    const vista = montar(RUTA_LISTA);
    const region = avisoEnVivo();
    expect(textoDelAviso()).toBe("Cargando página 1…");
    await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });

    expect(screen.queryByRole("navigation")).toBeNull();
    expect(screen.queryByRole("button", { name: /anterior|siguiente/i })).toBeNull();
    // La misma región (no se desmonta), con su aviso y oculta a la vista.
    expect(avisoEnVivo()).toBe(region);
    expect(textoDelAviso()).toBe("Página 1 cargada");
    expect(region.parentElement).toHaveClass("sr-only");
    expect(sinRepetidos(vista.avisos.map((aviso) => normalizar(aviso)))).toEqual(["Cargando página 1…", "Página 1 cargada"]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * T014 · Detalle
 * ---------------------------------------------------------------------------------------------- */

describe("T014 · detalle", () => {
  const IDS_NO_VALIDOS: Array<[string, string]> = [
    ["xyz", "xyz"],
    ["catalogo", "catalogo"],
    ["un UUID con un dígito de menos", "0a1b2c3d-0007-4000-8000-00000000000"],
    ["un UUID con un dígito de más", "0a1b2c3d-0007-4000-8000-0000000000007"],
    ["un UUID con un carácter que no es hexadecimal", "0a1b2c3d-0007-4000-8000-00000000000g"],
    ["un UUID sin guiones", "0a1b2c3d00074000800000000000007"],
    ["un UUID entre llaves", "{0a1b2c3d-0007-4000-8000-000000000007}"],
    ["un UUID con prefijo urn:uuid:", "urn:uuid:0a1b2c3d-0007-4000-8000-000000000007"],
    ["un UUID con un espacio al final", "0a1b2c3d-0007-4000-8000-000000000007 "],
    ["un número", "12345"],
    ["una cadena con apariencia de SQL", "1' OR '1'='1"],
  ];

  it.each(IDS_NO_VALIDOS)("%s: «Cotización no encontrada» sin consultar la base", async (_nombre, id) => {
    const { container } = montar(rutaDetalle(encodeURIComponent(id)), { rutas: "detalle" });

    expect(await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" })).toBeInTheDocument();
    expect(screen.getByText("Revisa el enlace o vuelve al listado de cotizaciones.")).toBeInTheDocument();
    await act(async () => {});
    expect(lib.obtenerCotizacion).not.toHaveBeenCalled();
    expect(lib.listarPaginaCotizaciones).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    sinTextoTecnico(container.textContent);
  });

  it("un UUID válido que no existe (null) muestra EXACTAMENTE el mismo contenido que un id inválido", async () => {
    const invalido = montar(rutaDetalle("xyz"), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    const htmlInvalido = invalido.container.innerHTML;
    invalido.unmount();

    lib.obtenerCotizacion.mockResolvedValue(null);
    const inexistente = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    const htmlInexistente = inexistente.container.innerHTML;

    expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(1);
    expect(htmlInexistente).toBe(htmlInvalido);
    // Y el contenido no delata el id pedido.
    expect(htmlInexistente).not.toContain(ID_DETALLE);
    sinTextoTecnico(inexistente.container.textContent);
  });

  it("un UUID válido pide la cotización una vez, con su id exacto y una AbortSignal", async () => {
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(1);
    const [id, opciones] = lib.obtenerCotizacion.mock.calls[0];
    expect(id).toBe(ID_DETALLE);
    expect(Object.keys(opciones ?? {})).toEqual(["signal"]);
    expect(opciones?.signal).toBeInstanceOf(AbortSignal);
    expect(opciones?.signal?.aborted).toBe(false);
  });

  it("un UUID en mayúsculas también es válido y se pide tal cual", async () => {
    const mayusculas = ID_DETALLE.toUpperCase();
    lib.obtenerCotizacion.mockResolvedValue(cotizacion({ id: mayusculas }));
    montar(rutaDetalle(mayusculas), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    expect(lib.obtenerCotizacion.mock.calls[0][0]).toBe(mayusculas);
  });

  it("mientras carga: región ocupada y texto para lectores de pantalla", () => {
    lib.obtenerCotizacion.mockReturnValue(diferida<Cotizacion | null>().promesa);
    const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });

    const ocupada = container.querySelector('[aria-busy="true"]');
    expect(ocupada).not.toBeNull();
    expect(ocupada).toHaveTextContent("Cargando la cotización…");
    expect(screen.getByRole("heading", { level: 1, name: "Cotización" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    sinTextoTecnico(container.textContent);
  });

  it("éxito: referencia, estado, fechas y los cuatro datos del prospecto", async () => {
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    expect(screen.getByRole("heading", { level: 2, name: "Datos de la cotización" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Prospecto" })).toBeInTheDocument();
    expect(valorDe("Referencia interna").textContent).toBe("BOR-7");
    expect(valorDe("Estado").textContent).toBe("Emitida");
    expectaDiaYHora(valorDe("Creada").textContent, { dia: "9 nov 2026", hora: "9:00", tarde: true });
    expectaDiaYHora(valorDe("Última actualización").textContent, { dia: "10 nov 2026", hora: "9:30", tarde: false });
    expect(valorDe("Creada").querySelector("time")).toHaveAttribute("datetime", CREADA_NOCHE);
    expect(valorDe("Nombre").textContent).toBe("Prospecto Sintético Siete");
    expect(valorDe("Contacto").textContent).toBe("Contacto Sintético Siete");
    expect(valorDe("Correo").textContent).toBe("siete@example.test");
    expect(valorDe("Teléfono").textContent).toBe("+504 5550-0107");
  });

  it("cada uno de los cinco estados sale con su etiqueta en español", async () => {
    const estados: Array<[EstadoCotizacion, string]> = [
      ["borrador", "Borrador"],
      ["emitida", "Emitida"],
      ["aceptada_firmada", "Aceptada y firmada"],
      ["rechazada", "Rechazada"],
      ["cancelada", "Cancelada"],
    ];
    for (const [estado, etiqueta] of estados) {
      lib.obtenerCotizacion.mockResolvedValue(cotizacion({ estado }));
      const { container, unmount } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
      await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });
      expect(valorDe("Estado").textContent).toBe(etiqueta);
      expect(container.textContent).not.toContain(estado);
      unmount();
    }
  });

  it("«Sin dato» para cada dato del prospecto que es null, vacío o solo espacios; los demás siguen", async () => {
    lib.obtenerCotizacion.mockResolvedValue(
      cotizacion({ prospecto_nombre: null, prospecto_contacto: "", prospecto_email: "   ", prospecto_telefono: null }),
    );
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    for (const etiqueta of ["Nombre", "Contacto", "Correo", "Teléfono"]) {
      expect(valorDe(etiqueta).textContent).toBe("Sin dato");
    }
    expect(valorDe("Referencia interna").textContent).toBe("BOR-7");
  });

  it.each<[string, Partial<Cotizacion>]>([
    ["Nombre", { prospecto_nombre: null }],
    ["Contacto", { prospecto_contacto: null }],
    ["Correo", { prospecto_email: null }],
    ["Teléfono", { prospecto_telefono: null }],
  ])(
    "solo %s en null: ese dato sale como «Sin dato» y los otros tres conservan el suyo",
    async (etiqueta, cambios) => {
      lib.obtenerCotizacion.mockResolvedValue(cotizacion(cambios));
      montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
      await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

      const esperado: Record<string, string> = {
        Nombre: "Prospecto Sintético Siete",
        Contacto: "Contacto Sintético Siete",
        Correo: "siete@example.test",
        Teléfono: "+504 5550-0107",
      };
      for (const [campo, texto] of Object.entries(esperado)) {
        expect(valorDe(campo).textContent).toBe(campo === etiqueta ? "Sin dato" : texto);
      }
    },
  );

  it("una fecha inválida sale como «Sin dato», nunca como «Invalid Date»", async () => {
    lib.obtenerCotizacion.mockResolvedValue(cotizacion({ creado_at: "ayer", actualizado_at: "" }));
    const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    expect(valorDe("Creada").textContent).toBe("Sin dato");
    expect(valorDe("Última actualización").textContent).toBe("Sin dato");
    sinTextoTecnico(container.textContent);
  });

  it("el correo y el teléfono son texto: ningún enlace mailto: ni tel:, y el único enlace es «Volver»", async () => {
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    expect(container.querySelectorAll('a[href^="mailto:" i], a[href^="tel:" i]')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/mailto:|tel:/i);
    expect(valorDe("Correo").querySelector("a")).toBeNull();
    expect(valorDe("Teléfono").querySelector("a")).toBeNull();
    expect(Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([RUTA_LISTA]);
  });

  it("no pinta quién creó o actualizó la cotización ni su versión de fila", async () => {
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    const html = container.innerHTML;
    for (const prohibido of ["creado_por", "actualizado_por", "row_version", "row version", CREADO_POR, ACTUALIZADO_POR, "48271"]) {
      expect(html).not.toContain(prohibido);
      expect(container.textContent).not.toContain(prohibido);
    }
    expect(html).not.toContain(ID_DETALLE);
    sinTextoTecnico(container.textContent);
  });

  describe("error", () => {
    it("muestra el mensaje genérico en una alerta con «Reintentar», sin texto crudo", async () => {
      lib.obtenerCotizacion.mockRejectedValue(new Error("PGRST302 permission denied for relation cotizaciones"));
      const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });

      const alerta = await screen.findByRole("alert");
      expect(alerta.querySelector("p")?.textContent).toBe(
        "No se pudo completar la operación. Inténtalo de nuevo.",
      );
      expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/PGRST|permission denied|relation/);
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1, name: "Cotización" })).toBeInTheDocument();
    });

    it("un código conocido sale con su texto aprobado", async () => {
      lib.obtenerCotizacion.mockRejectedValue(new ErrorCotizacion("SIN_PERMISO"));
      montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });

      expect(await screen.findByRole("alert")).toHaveTextContent("No tienes permiso para realizar esta acción.");
    });

    it("«Reintentar» vuelve a pedir la misma cotización con otra señal y puede terminar bien", async () => {
      lib.obtenerCotizacion.mockRejectedValueOnce(new Error("fallo sintético")).mockResolvedValueOnce(cotizacion());
      montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });

      fireEvent.click(await within(await screen.findByRole("alert")).findByRole("button", { name: "Reintentar" }));
      expect(await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" })).toBeInTheDocument();
      expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(2);
      const [primera, segunda] = lib.obtenerCotizacion.mock.calls;
      expect(primera[0]).toBe(ID_DETALLE);
      expect(segunda[0]).toBe(ID_DETALLE);
      expect(segunda[1]?.signal).not.toBe(primera[1]?.signal);
      expect(primera[1]?.signal?.aborted).toBe(true);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("«Volver a cotizaciones»", () => {
    const ESTADOS: Array<[string, () => void, string]> = [
      ["mientras carga", () => lib.obtenerCotizacion.mockReturnValue(diferida<Cotizacion | null>().promesa), "cargando"],
      ["con la cotización", () => lib.obtenerCotizacion.mockResolvedValue(cotizacion()), "listo"],
      ["con la cotización no encontrada", () => lib.obtenerCotizacion.mockResolvedValue(null), "nula"],
      ["con un error", () => lib.obtenerCotizacion.mockRejectedValue(new Error("fallo sintético")), "error"],
    ];

    it.each(ESTADOS)("enlaza al listado %s", async (_nombre, preparar, estado) => {
      preparar();
      montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
      if (estado === "listo") await screen.findByRole("heading", { name: "Cotización BOR-7" });
      if (estado === "nula") await screen.findByRole("heading", { name: "Cotización no encontrada" });
      if (estado === "error") await screen.findByRole("alert");

      expect(screen.getByRole("link", { name: "Volver a cotizaciones" })).toHaveAttribute("href", RUTA_LISTA);
    });

    it("con un id inválido también enlaza al listado", () => {
      montar(rutaDetalle("xyz"), { rutas: "detalle" });
      expect(screen.getByRole("link", { name: "Volver a cotizaciones" })).toHaveAttribute("href", RUTA_LISTA);
    });

    it("al seguirlo se abre el listado y se pide su primera página", async () => {
      lib.obtenerCotizacion.mockResolvedValue(cotizacion());
      servirPaginas({ 1: pagina([resumen(1)]) });
      montar(rutaDetalle(ID_DETALLE));
      await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

      fireEvent.click(screen.getByRole("link", { name: "Volver a cotizaciones" }));
      expect(await screen.findByRole("heading", { level: 1, name: "Cotizaciones" })).toBeInTheDocument();
      expect(await screen.findByRole("link", { name: "BOR-1" })).toBeInTheDocument();
      expect(paginasPedidas()).toEqual([1]);
    });
  });

  it("al pasar a otra cotización no queda nada de la anterior mientras carga la nueva", async () => {
    const otra = diferida<Cotizacion | null>();
    lib.obtenerCotizacion.mockResolvedValueOnce(cotizacion()).mockReturnValueOnce(otra.promesa);
    montar(rutaDetalle(ID_DETALLE), {
      rutas: "detalle",
      extra: <Link to={rutaDetalle(idDe(8))}>ir a la otra</Link>,
    });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    fireEvent.click(screen.getByRole("link", { name: "ir a la otra" }));
    expect(screen.queryByText("Prospecto Sintético Siete")).toBeNull();
    expect(screen.queryByText("siete@example.test")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Cotización BOR-7" })).toBeNull();
    expect(document.body.querySelector('[aria-busy="true"]')).not.toBeNull();

    await entregar(otra, cotizacion({ id: idDe(8), referencia_interna: "BOR-8", prospecto_nombre: "Prospecto Ocho" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Cotización BOR-8" })).toBeInTheDocument();
    expect(valorDe("Nombre").textContent).toBe("Prospecto Ocho");
    expect(lib.obtenerCotizacion.mock.calls.map(([id]) => id)).toEqual([ID_DETALLE, idDe(8)]);
  });

  it("volver a una cotización ya vista (X → Y → X) no pinta los datos viejos: carga de nuevo", async () => {
    const otraVez = diferida<Cotizacion | null>();
    lib.obtenerCotizacion
      .mockResolvedValueOnce(cotizacion()) // X
      .mockReturnValueOnce(diferida<Cotizacion | null>().promesa) // Y, sin respuesta
      .mockReturnValueOnce(otraVez.promesa); // X otra vez
    const vista = montar(rutaDetalle(ID_DETALLE), {
      rutas: "detalle",
      extra: (
        <>
          <Link to={rutaDetalle(idDe(8))}>ir a Y</Link>
          <Link to={rutaDetalle(ID_DETALLE)}>volver a X</Link>
        </>
      ),
    });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });
    expect(valorDe("Nombre").textContent).toBe("Prospecto Sintético Siete");

    const desde = vista.instantaneas.length;
    fireEvent.click(screen.getByRole("link", { name: "ir a Y" }));
    fireEvent.click(screen.getByRole("link", { name: "volver a X" }));

    // Se pidió X otra vez y todavía no hay respuesta: nada de los datos viejos, y se ve que carga.
    expect(lib.obtenerCotizacion.mock.calls.map(([id]) => id)).toEqual([ID_DETALLE, idDe(8), ID_DETALLE]);
    expect(screen.queryByText("Prospecto Sintético Siete")).toBeNull();
    expect(screen.queryByText("siete@example.test")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Cotización BOR-7" })).toBeNull();
    expect(vista.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText("Cargando la cotización…")).toBeInTheDocument();

    await entregar(otraVez, cotizacion({ prospecto_nombre: "Prospecto Siete (actualizado)" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" })).toBeInTheDocument();
    expect(valorDe("Nombre").textContent).toBe("Prospecto Siete (actualizado)");

    // Ninguna confirmación desde que se dejó X mostró sus datos viejos.
    expect(vista.instantaneas.slice(desde).filter((texto) => texto.includes("Prospecto Sintético Siete"))).toEqual([]);
  });

  it("sin sesión de administrador no pide la cotización ni muestra datos", async () => {
    for (const preparar of [
      () => iniciarSesion(ADMIN_1, 0, true),
      () => iniciarSesion(null, 0),
      () => iniciarSesion(ADMIN_1, 1),
      () => iniciarSesion(ADMIN_1, 2),
      () => iniciarSesion(ADMIN_1, null),
    ]) {
      lib.obtenerCotizacion.mockResolvedValue(cotizacion());
      preparar();
      const { container, unmount } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
      await act(async () => {});

      expect(lib.obtenerCotizacion).not.toHaveBeenCalled();
      expect(screen.queryByText("Prospecto Sintético Siete")).toBeNull();
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
      unmount();
    }
  });
});

/* ------------------------------------------------------------------------------------------------
 * T015 · Catálogo
 * ---------------------------------------------------------------------------------------------- */

describe("T015 · catálogo", () => {
  it("estado vacío honesto, con el texto exacto, y sin ninguna llamada a la capa de datos", async () => {
    const { container } = montar("/dashboard/cotizaciones/catalogo");
    await act(async () => {});

    expect(screen.getByRole("heading", { level: 1, name: "Catálogo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "El catálogo se habilita en la siguiente fase" })).toBeInTheDocument();
    expect(lib.listarPaginaCotizaciones).not.toHaveBeenCalled();
    expect(lib.obtenerCotizacion).not.toHaveBeenCalled();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
    sinTextoTecnico(container.textContent);
  });

  it("se muestra igual aunque no haya sesión (la protección es de la ruta, no de la página) y sin pedir nada", async () => {
    iniciarSesion(null, null, true);
    montar("/dashboard/cotizaciones/catalogo");
    await act(async () => {});

    expect(screen.getByText("El catálogo se habilita en la siguiente fase")).toBeInTheDocument();
    expect(lib.listarPaginaCotizaciones).not.toHaveBeenCalled();
    expect(lib.obtenerCotizacion).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------------------------------------
 * Texto seguro: lo que escribe un prospecto se pinta como texto, nunca como marcado
 * ---------------------------------------------------------------------------------------------- */

const CONTROL = String.fromCharCode(0x0001, 0x0007, 0x001b);
const BIDI = String.fromCharCode(0x202e, 0x2066, 0x2069, 0x200f);

const NOMBRE_HOSTIL =
  `<img src=x onerror="window.__xss_nombre=1"> <script>window.__xss_nombre=2</script> javascript:alert(1) ` +
  `&lt;b&gt;&amp; ${CONTROL}${BIDI}fin`;
const CONTACTO_HOSTIL = `<svg onload="window.__xss_contacto=1"></svg><b>negrita</b> ${BIDI}`;
const CORREO_HOSTIL = `"><a href="javascript:alert(2)">correo</a>@example.test ${CONTROL}`;
const TELEFONO_HOSTIL = `<iframe src="javascript:alert(3)"></iframe> +504 ${BIDI}5550-0199`;
const REFERENCIA_HOSTIL = "BOR-1<b>x</b>";

describe("texto seguro", () => {
  it("listado: nombre y referencia hostiles salen como texto literal", async () => {
    servirPaginas({
      1: pagina([resumen(1, { prospecto_nombre: NOMBRE_HOSTIL, referencia_interna: REFERENCIA_HOSTIL })]),
    });
    montar(RUTA_LISTA);
    const tabla = await screen.findByRole("table");

    const celdas = within(within(tabla).getAllByRole("row")[1]).getAllByRole("cell");
    expectaSoloTextoEnBdi(celdas[1], NOMBRE_HOSTIL);
    expect(celdas[0].textContent).toBe(REFERENCIA_HOSTIL);
    expect(within(celdas[0]).getByRole("link").children).toHaveLength(0);
    expectaSinMarcadoActivo();
    expect(Reflect.get(window, "__xss_nombre")).toBeUndefined();
  });

  it("detalle: los cuatro datos del prospecto y la referencia hostiles salen como texto literal", async () => {
    lib.obtenerCotizacion.mockResolvedValue(
      cotizacion({
        referencia_interna: REFERENCIA_HOSTIL,
        prospecto_nombre: NOMBRE_HOSTIL,
        prospecto_contacto: CONTACTO_HOSTIL,
        prospecto_email: CORREO_HOSTIL,
        prospecto_telefono: TELEFONO_HOSTIL,
      }),
    );
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1 });
    await screen.findByText("Nombre", { selector: "dt" });

    expectaSoloTextoEnBdi(valorDe("Nombre"), NOMBRE_HOSTIL);
    expectaSoloTextoEnBdi(valorDe("Contacto"), CONTACTO_HOSTIL);
    expectaSoloTextoEnBdi(valorDe("Correo"), CORREO_HOSTIL);
    expectaSoloTextoEnBdi(valorDe("Teléfono"), TELEFONO_HOSTIL);
    expect(valorDe("Referencia interna").textContent).toBe(REFERENCIA_HOSTIL);
    expect(valorDe("Referencia interna").children).toHaveLength(0);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(`Cotización ${REFERENCIA_HOSTIL}`);
    expectaSinMarcadoActivo();
    expect(Reflect.get(window, "__xss_nombre")).toBeUndefined();
    expect(Reflect.get(window, "__xss_contacto")).toBeUndefined();
    expect(Array.from(document.body.querySelectorAll("a")).map((a) => a.getAttribute("href"))).toEqual([RUTA_LISTA]);
  });

  it("listado: el nombre del prospecto va dentro de un bdi; el marcador «Sin nombre» y la referencia, no", async () => {
    servirPaginas({
      1: pagina([
        resumen(1, { prospecto_nombre: "Prospecto con nombre" }),
        resumen(2, { prospecto_nombre: null }),
        resumen(3, { prospecto_nombre: "   " }),
      ]),
    });
    const { container } = montar(RUTA_LISTA);
    const tabla = await screen.findByRole("table");

    const filas = within(tabla).getAllByRole("row").slice(1);
    const celdasDe = (i: number) => within(filas[i]).getAllByRole("cell");
    expectaSoloTextoEnBdi(celdasDe(0)[1], "Prospecto con nombre");
    for (const i of [1, 2]) {
      expect(celdasDe(i)[1].querySelector("bdi")).toBeNull();
      expect(celdasDe(i)[1].textContent).toBe("Sin nombre");
    }
    // Un solo bdi por fila con nombre, y ninguno fuera de la columna del prospecto.
    expect(container.querySelectorAll("tbody bdi")).toHaveLength(1);
    expect(celdasDe(0)[0].querySelector("bdi")).toBeNull();
  });

  it("detalle: nombre, contacto, correo y teléfono van dentro de un bdi; «Sin dato» y la referencia, no", async () => {
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    expectaSoloTextoEnBdi(valorDe("Nombre"), "Prospecto Sintético Siete");
    expectaSoloTextoEnBdi(valorDe("Contacto"), "Contacto Sintético Siete");
    expectaSoloTextoEnBdi(valorDe("Correo"), "siete@example.test");
    expectaSoloTextoEnBdi(valorDe("Teléfono"), "+504 5550-0107");
    expect(container.querySelectorAll("bdi")).toHaveLength(4);
    // La referencia, el estado y las fechas no van en bdi.
    for (const etiqueta of ["Referencia interna", "Estado", "Creada", "Última actualización"]) {
      expect(valorDe(etiqueta).querySelector("bdi")).toBeNull();
    }
    expect(screen.getByRole("heading", { level: 1 }).querySelector("bdi")).toBeNull();
  });

  it("detalle: un dato del prospecto sin valor sale como «Sin dato» fuera del bdi", async () => {
    lib.obtenerCotizacion.mockResolvedValue(
      cotizacion({ prospecto_nombre: null, prospecto_contacto: "", prospecto_email: "   ", prospecto_telefono: "Solo teléfono" }),
    );
    const { container } = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });

    for (const etiqueta of ["Nombre", "Contacto", "Correo"]) {
      expect(valorDe(etiqueta).querySelector("bdi")).toBeNull();
      expect(valorDe(etiqueta).textContent).toBe("Sin dato");
    }
    expectaSoloTextoEnBdi(valorDe("Teléfono"), "Solo teléfono");
    expect(container.querySelectorAll("bdi")).toHaveLength(1);
  });

  it("control: el comprobador de marcado activo sí detecta un img y un script", () => {
    const intruso = document.createElement("div");
    intruso.innerHTML = '<img src="x" onerror="1"><script></script>';
    document.body.appendChild(intruso);
    expect(() => expectaSinMarcadoActivo()).toThrow();
    intruso.remove();
  });
});

/* ------------------------------------------------------------------------------------------------
 * Sesión en pantalla: cambiar de usuario o perder el rol retira de inmediato los datos del prospecto
 * ---------------------------------------------------------------------------------------------- */

/**
 * Una pantalla que pinta datos del prospecto, con lo necesario para probarla igual que a la otra. El `sufijo`
 * identifica la sesión que pidió los datos («uno», «dos»…) y va dentro de cada texto del prospecto.
 */
interface PantallaConDatos {
  nombre: string;
  ruta: string;
  rutas: "completas" | "detalle";
  /** La próxima petición devuelve ya resuelta la respuesta de la sesión `sufijo`. */
  servir: (sufijo: string) => void;
  /** La próxima petición queda pendiente; devuelve cómo entregar después la respuesta de la sesión `sufijo`. */
  pendiente: () => (sufijo: string) => Promise<void>;
  /** La próxima petición falla con `fallo`. */
  fallar: (fallo: unknown) => void;
  /** Los textos del prospecto que no pueden quedar a la vista cuando cambia la sesión. */
  datos: (sufijo: string) => string[];
  peticiones: () => number;
  esperarDatos: (sufijo: string) => Promise<unknown>;
}

function listadoDe(sufijo: string): PaginaCotizaciones {
  return pagina([resumen(1, { prospecto_nombre: `Prospecto de la sesión ${sufijo}` })]);
}

function detalleDe(sufijo: string): Cotizacion {
  return cotizacion({
    prospecto_nombre: `Nombre de la sesión ${sufijo}`,
    prospecto_contacto: `Contacto de la sesión ${sufijo}`,
    prospecto_email: `correo-${sufijo}@example.test`,
    prospecto_telefono: `+504 5550-${sufijo}`,
  });
}

const PANTALLAS: PantallaConDatos[] = [
  {
    nombre: "listado",
    ruta: RUTA_LISTA,
    rutas: "completas",
    servir: (sufijo) => {
      lib.listarPaginaCotizaciones.mockResolvedValueOnce(listadoDe(sufijo));
    },
    pendiente: () => {
      const d = diferida<PaginaCotizaciones>();
      lib.listarPaginaCotizaciones.mockReturnValueOnce(d.promesa);
      return (sufijo) => entregar(d, listadoDe(sufijo));
    },
    fallar: (fallo) => {
      lib.listarPaginaCotizaciones.mockRejectedValueOnce(fallo);
    },
    datos: (sufijo) => [`Prospecto de la sesión ${sufijo}`],
    peticiones: () => lib.listarPaginaCotizaciones.mock.calls.length,
    esperarDatos: (sufijo) => screen.findByText(`Prospecto de la sesión ${sufijo}`),
  },
  {
    nombre: "detalle",
    ruta: rutaDetalle(ID_DETALLE),
    rutas: "detalle",
    servir: (sufijo) => {
      lib.obtenerCotizacion.mockResolvedValueOnce(detalleDe(sufijo));
    },
    pendiente: () => {
      const d = diferida<Cotizacion | null>();
      lib.obtenerCotizacion.mockReturnValueOnce(d.promesa);
      return (sufijo) => entregar(d, detalleDe(sufijo));
    },
    fallar: (fallo) => {
      lib.obtenerCotizacion.mockRejectedValueOnce(fallo);
    },
    datos: (sufijo) => [
      `Nombre de la sesión ${sufijo}`,
      `Contacto de la sesión ${sufijo}`,
      `correo-${sufijo}@example.test`,
      `+504 5550-${sufijo}`,
    ],
    peticiones: () => lib.obtenerCotizacion.mock.calls.length,
    esperarDatos: (sufijo) => screen.findByText(`Nombre de la sesión ${sufijo}`),
  },
];

/** Ninguna confirmación de React desde `desde` deja a la vista alguno de los textos. */
function expectaSinRastro(instantaneas: string[], desde: number, textos: string[]) {
  expect(instantaneas.length).toBeGreaterThan(desde);
  for (const instantanea of instantaneas.slice(desde)) {
    for (const texto of textos) expect(instantanea).not.toContain(texto);
  }
  for (const texto of textos) expect(document.body.textContent).not.toContain(texto);
}

describe.each(PANTALLAS)("sesión en pantalla · $nombre", (pantalla) => {
  it("con la sesión resuelta de otro usuario, los datos del anterior desaparecen de inmediato", async () => {
    pantalla.servir("uno");
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    await pantalla.esperarDatos("uno");

    const entregarSegunda = pantalla.pendiente();
    const desde = vista.instantaneas.length;
    iniciarSesion(ADMIN_2, 0);

    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
    expect(vista.container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(pantalla.peticiones()).toBe(2);

    await entregarSegunda("dos");
    await pantalla.esperarDatos("dos");
    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
  });

  it("una respuesta tardía de la sesión anterior no vuelve a pintar sus datos", async () => {
    const entregarPrimera = pantalla.pendiente();
    const entregarSegunda = pantalla.pendiente();
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    expect(pantalla.peticiones()).toBe(1);

    const desde = vista.instantaneas.length;
    iniciarSesion(ADMIN_2, 0);
    expect(pantalla.peticiones()).toBe(2);

    await entregarPrimera("uno");
    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
    expect(vista.container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await entregarSegunda("dos");
    await pantalla.esperarDatos("dos");
    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
  });

  it("una respuesta tardía de la sesión anterior que llega DESPUÉS de la nueva tampoco las pisa", async () => {
    const entregarPrimera = pantalla.pendiente();
    const entregarSegunda = pantalla.pendiente();
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    iniciarSesion(ADMIN_2, 0);

    await entregarSegunda("dos");
    await pantalla.esperarDatos("dos");
    const desde = vista.instantaneas.length;
    await entregarPrimera("uno");

    expect(document.body.textContent).toContain(pantalla.datos("dos")[0]);
    for (const instantanea of vista.instantaneas.slice(desde)) {
      for (const texto of pantalla.datos("uno")) expect(instantanea).not.toContain(texto);
    }
  });

  it.each<[string, number | null]>([
    ["colaborador (1)", 1],
    ["cliente (2)", 2],
    ["rol desconocido (null)", null],
  ])("al perder el rol de administrador (%s) los datos desaparecen y no se vuelve a pedir", async (_nombre, rol) => {
    pantalla.servir("uno");
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    await pantalla.esperarDatos("uno");

    const desde = vista.instantaneas.length;
    iniciarSesion(ADMIN_1, rol);

    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
    await act(async () => {});
    expect(pantalla.peticiones()).toBe(1);
  });

  it("al recuperar el rol los datos anteriores no reaparecen: se vuelve a pedir y se espera la respuesta", async () => {
    pantalla.servir("uno");
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    await pantalla.esperarDatos("uno");

    const desde = vista.instantaneas.length;
    iniciarSesion(ADMIN_1, 1);
    const entregarSegunda = pantalla.pendiente();
    iniciarSesion(ADMIN_1, 0);

    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
    expect(pantalla.peticiones()).toBe(2);
    expect(vista.container.querySelector('[aria-busy="true"]')).not.toBeNull();

    await entregarSegunda("tres");
    await pantalla.esperarDatos("tres");
    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
  });

  it("al cerrar la sesión los datos desaparecen de inmediato", async () => {
    pantalla.servir("uno");
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    await pantalla.esperarDatos("uno");

    const desde = vista.instantaneas.length;
    iniciarSesion(null, null);

    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
    await act(async () => {});
    expect(pantalla.peticiones()).toBe(1);
  });

  it("usuario 1, luego usuario 2 sin respuesta y de vuelta al 1: los datos viejos no reaparecen", async () => {
    pantalla.servir("uno");
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    await pantalla.esperarDatos("uno");

    const desde = vista.instantaneas.length;
    pantalla.pendiente();
    iniciarSesion(ADMIN_2, 0);
    pantalla.pendiente();
    iniciarSesion(ADMIN_1, 0);

    expectaSinRastro(vista.instantaneas, desde, pantalla.datos("uno"));
    expect(pantalla.peticiones()).toBe(3);
  });

  it("un error de la sesión anterior tampoco queda a la vista de la siguiente", async () => {
    pantalla.fallar(new ErrorCotizacion("SIN_PERMISO"));
    const vista = montar(pantalla.ruta, { rutas: pantalla.rutas });
    await screen.findByRole("alert");

    pantalla.pendiente();
    iniciarSesion(ADMIN_2, 0);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(vista.container.textContent).not.toContain("No tienes permiso");
  });
});

/* ------------------------------------------------------------------------------------------------
 * Foco del teclado en el listado y el detalle.
 *
 * En un navegador, un botón que pasa a `disabled` estando enfocado pierde el foco (cae a `<body>`) y, si se
 * rehabilita después, no lo recupera; un botón que se desmonta al pulsarlo («Reintentar», «Volver a la primera
 * página») también manda el foco a `<body>`.
 *
 * Por eso «Anterior» y «Siguiente» usan `aria-disabled` (conservan el foco) y, tras «Reintentar» o «Volver a la
 * primera página», el foco pasa a una región estable (`role="group"`, `tabIndex={-1}`) cuando el estado llega a
 * `listo` o `error`, siempre que el foco siga perdido (si la persona ya eligió otro control, se respeta). jsdom no
 * aplica la regla de «focus fixup» del navegador, así que aquí se comprueba la invariante que la causaría: el
 * elemento enfocado no está deshabilitado ni es `<body>`.
 * ---------------------------------------------------------------------------------------------- */

/** El foco está en un elemento operable: ni `<body>` ni un control deshabilitado. */
function expectaFocoUtil() {
  const foco = document.activeElement;
  expect(foco).not.toBeNull();
  expect(foco).not.toBe(document.body);
  expect(foco?.matches(":disabled")).toBe(false);
}

const grupoDelListado = () => screen.getByRole("group", { name: "Listado de cotizaciones" });
const grupoDelDetalle = () => screen.getByRole("group", { name: "Detalle de la cotización" });

/** Desde la página 2, con el foco en «Anterior», lo pulsa y espera la página 1. */
async function pulsarAnteriorConElFoco() {
  servirPaginas({ 1: pagina([resumen(1)], true), 2: pagina([resumen(2)], false) });
  montar(RUTA_LISTA);
  await screen.findByRole("link", { name: "BOR-1" });
  fireEvent.click(botonSiguiente());
  await screen.findByRole("link", { name: "BOR-2" });
  const anterior = botonAnterior();
  anterior.focus();
  expect(document.activeElement).toBe(anterior);
  fireEvent.click(anterior);
  await screen.findByRole("link", { name: "BOR-1" });
  return anterior;
}

/** Con el foco en «Siguiente», lo pulsa y deja la página 2 cargando (se entrega con `segunda`). */
async function pulsarSiguienteConElFoco() {
  const segunda = diferida<PaginaCotizaciones>();
  lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(1)], true)).mockReturnValueOnce(segunda.promesa);
  montar(RUTA_LISTA);
  await screen.findByRole("link", { name: "BOR-1" });
  const siguiente = botonSiguiente();
  siguiente.focus();
  expect(document.activeElement).toBe(siguiente);
  fireEvent.click(siguiente);
  return { siguiente, segunda };
}

/** Con el foco en «Reintentar», lo pulsa; la segunda respuesta la entrega la prueba con `segunda`. */
async function pulsarReintentarConElFoco() {
  const segunda = diferida<PaginaCotizaciones>();
  lib.listarPaginaCotizaciones.mockRejectedValueOnce(new Error("fallo sintético")).mockReturnValueOnce(segunda.promesa);
  montar(RUTA_LISTA);
  const reintentar = await screen.findByRole("button", { name: "Reintentar" });
  reintentar.focus();
  expect(document.activeElement).toBe(reintentar);
  fireEvent.click(reintentar);
  return { reintentar, segunda };
}

/** Con el foco en «Volver a la primera página», lo pulsa; la página 1 la entrega la prueba con `primera`. */
async function pulsarVolverConElFoco() {
  const primera = diferida<PaginaCotizaciones>();
  lib.listarPaginaCotizaciones
    .mockResolvedValueOnce(pagina([resumen(1)], true))
    .mockResolvedValueOnce(pagina([]))
    .mockReturnValueOnce(primera.promesa);
  montar(RUTA_LISTA);
  await screen.findByRole("link", { name: "BOR-1" });
  fireEvent.click(botonSiguiente());
  const volver = await screen.findByRole("button", { name: "Volver a la primera página" });
  volver.focus();
  expect(document.activeElement).toBe(volver);
  fireEvent.click(volver);
  return { volver, primera };
}

describe("foco del teclado en los controles de paginación y de reintento del listado", () => {
  it("escenario: «Anterior» enfocado, al llegar a la página 1 queda no disponible y es el mismo nodo", async () => {
    const anterior = await pulsarAnteriorConElFoco();
    expect(botonAnterior()).toBe(anterior);
    expectaNoDisponible(anterior);
    expect(paginasPedidas()).toEqual([1, 2, 1]);
  });

  it("al llegar a la página 1 el foco se queda en «Anterior» (ni <body> ni un control deshabilitado)", async () => {
    const anterior = await pulsarAnteriorConElFoco();
    expectaFocoUtil();
    expect(document.activeElement).toBe(anterior);
    // Y desde ahí, activarlo no hace nada.
    await activarSinEfecto(anterior);
  });

  it("escenario: «Siguiente» enfocado queda no disponible mientras carga la página siguiente", async () => {
    const { siguiente } = await pulsarSiguienteConElFoco();
    expect(botonSiguiente()).toBe(siguiente);
    expectaNoDisponible(siguiente);
    expect(paginasPedidas()).toEqual([1, 2]);
  });

  it("«Siguiente» conserva el foco mientras carga y al terminar sigue ahí, disponible para seguir avanzando", async () => {
    const { siguiente, segunda } = await pulsarSiguienteConElFoco();
    expectaFocoUtil();
    expect(document.activeElement).toBe(siguiente);

    await entregar(segunda, pagina([resumen(2)], true));
    await screen.findByRole("link", { name: "BOR-2" });
    expect(botonSiguiente()).toBe(siguiente);
    expect(document.activeElement).toBe(siguiente);
    expectaDisponible(siguiente);

    // Un segundo Enter/clic avanza otra vez sin volver a tabular hasta el botón.
    lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(3)], false));
    fireEvent.click(siguiente);
    await screen.findByRole("link", { name: "BOR-3" });
    expect(paginasPedidas()).toEqual([1, 2, 3]);
    expect(document.activeElement).toBe(siguiente);
  });

  it("escenario: «Reintentar» desaparece al pulsarlo", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    await entregar(segunda, pagina([resumen(1)]));
    await screen.findByRole("table");
    expect(paginasPedidas()).toEqual([1, 1]);
  });

  it("tras «Reintentar» el foco pasa al grupo del listado cuando llegan los datos (no cae a <body>)", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    await entregar(segunda, pagina([resumen(1)]));
    await screen.findByRole("table");
    expectaFocoUtil();
    expect(document.activeElement).toBe(grupoDelListado());
  });

  it("escenario: «Volver a la primera página» desaparece al pulsarlo", async () => {
    const { primera } = await pulsarVolverConElFoco();
    expect(screen.queryByRole("button", { name: "Volver a la primera página" })).toBeNull();
    await entregar(primera, pagina([resumen(1)], true));
    await screen.findByRole("link", { name: "BOR-1" });
    expect(paginasPedidas()).toEqual([1, 2, 1]);
  });

  it("tras «Volver a la primera página» el foco pasa al grupo del listado cuando llegan los datos", async () => {
    const { primera } = await pulsarVolverConElFoco();
    await entregar(primera, pagina([resumen(1)], true));
    await screen.findByRole("link", { name: "BOR-1" });
    expectaFocoUtil();
    expect(document.activeElement).toBe(grupoDelListado());
  });

  it("control: expectaFocoUtil rechaza <body> y un control deshabilitado y acepta un botón operable", () => {
    const boton = document.createElement("button");
    document.body.appendChild(boton);
    boton.focus();
    expect(() => expectaFocoUtil()).not.toThrow();
    boton.disabled = true;
    expect(() => expectaFocoUtil()).toThrow();
    boton.remove();
    expect(() => expectaFocoUtil()).toThrow();
  });
});

describe("foco gestionado del listado", () => {
  it("el grupo existe en todos los estados, con su nombre y tabindex -1, y es siempre el mismo nodo", async () => {
    const segunda = diferida<PaginaCotizaciones>();
    lib.listarPaginaCotizaciones
      .mockResolvedValueOnce(pagina([resumen(1)], true))
      .mockRejectedValueOnce(new Error("fallo sintético"))
      .mockResolvedValueOnce(pagina([]))
      .mockReturnValueOnce(segunda.promesa);
    montar(RUTA_LISTA);

    // Cargando.
    const grupo = grupoDelListado();
    expect(grupo).toHaveAttribute("tabindex", "-1");
    expect(grupo).toHaveAttribute("role", "group");

    // Listo.
    await screen.findByRole("table");
    expect(grupoDelListado()).toBe(grupo);
    expect(grupo).toContainElement(screen.getByRole("table"));

    // Error (de la página 2).
    fireEvent.click(botonSiguiente());
    await screen.findByRole("alert");
    expect(grupoDelListado()).toBe(grupo);
    expect(grupo).toContainElement(screen.getByRole("alert"));

    // Página 2 vacía.
    fireEvent.click(within(grupo).getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("heading", { level: 2, name: "Esta página no tiene cotizaciones" });
    expect(grupoDelListado()).toBe(grupo);

    // De nuevo cargando (la 1).
    fireEvent.click(screen.getByRole("button", { name: "Volver a la primera página" }));
    expect(grupoDelListado()).toBe(grupo);
    expect(grupo).toHaveAttribute("tabindex", "-1");
    await entregar(segunda, pagina([resumen(1)]));
  });

  it("el grupo existe también con la primera página vacía y con el listado inactivo", async () => {
    servirPaginas({ 1: pagina([]) });
    montar(RUTA_LISTA);
    await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });
    expect(grupoDelListado()).toHaveAttribute("tabindex", "-1");
    cleanup();

    iniciarSesion(ADMIN_1, 1);
    montar(RUTA_LISTA);
    expect(grupoDelListado()).toHaveAttribute("tabindex", "-1");
  });

  it("la carga inicial no mueve el foco (listo, vacío ni error)", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true) });
    montar(RUTA_LISTA);
    await screen.findByRole("table");
    expect(document.activeElement).toBe(document.body);
    cleanup();

    servirPaginas({ 1: pagina([]) });
    montar(RUTA_LISTA);
    await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });
    expect(document.activeElement).toBe(document.body);
    cleanup();

    lib.listarPaginaCotizaciones.mockReset();
    lib.listarPaginaCotizaciones.mockRejectedValue(new Error("fallo sintético"));
    montar(RUTA_LISTA);
    await screen.findByRole("alert");
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
  });

  it("«Siguiente» y «Anterior» no mueven el foco al grupo (sin foco previo siguen en <body>)", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true), 2: pagina([resumen(2)], true) });
    montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });

    fireEvent.click(botonSiguiente());
    await screen.findByRole("link", { name: "BOR-2" });
    expect(document.activeElement).toBe(document.body);

    fireEvent.click(botonAnterior());
    await screen.findByRole("link", { name: "BOR-1" });
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(grupoDelListado());
  });

  it("tras «Reintentar» el foco no se mueve mientras carga y pasa al grupo al llegar los datos", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    await act(async () => {});
    expect(screen.getByText("Cargando cotizaciones…")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(grupoDelListado());
    expect(document.activeElement).toBe(document.body);

    await entregar(segunda, pagina([resumen(1)]));
    await screen.findByRole("table");
    expect(document.activeElement).toBe(grupoDelListado());
  });

  it("tras «Reintentar» que vuelve a fallar el foco pasa al grupo, no al botón nuevo", async () => {
    const { reintentar, segunda } = await pulsarReintentarConElFoco();
    await act(async () => {
      segunda.rechazar(new Error("segundo fallo"));
    });

    const alerta = await screen.findByRole("alert");
    const nuevo = within(alerta).getByRole("button", { name: "Reintentar" });
    expect(nuevo).not.toBe(reintentar);
    expect(document.activeElement).toBe(grupoDelListado());
    expect(document.activeElement).not.toBe(nuevo);
  });

  it("el foco que se pidió con «Reintentar» se consume una sola vez: una carga posterior ya no lo mueve", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    await entregar(segunda, pagina([resumen(1)], true));
    await screen.findByRole("table");
    expect(document.activeElement).toBe(grupoDelListado());

    // La persona lleva el foco a otro control y la carga se repite sin que pulse «Reintentar» (cambia la sesión):
    // el grupo no se lo vuelve a quitar.
    const catalogo = screen.getByRole("link", { name: "Ver catálogo" });
    catalogo.focus();
    lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(2)], true));
    iniciarSesion(ADMIN_2, 0);
    await screen.findByRole("link", { name: "BOR-2" });
    expect(paginasPedidas()).toEqual([1, 1, 1]);
    expect(document.activeElement).toBe(catalogo);
  });

  it("escenario: la persona puede llevar el foco a otro control mientras se reintenta", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    const catalogo = screen.getByRole("link", { name: "Ver catálogo" });
    catalogo.focus();
    expect(document.activeElement).toBe(catalogo);

    await entregar(segunda, pagina([resumen(1)]));
    await screen.findByRole("table");
    expect(paginasPedidas()).toEqual([1, 1]);
  });

  // El foco solo se devuelve al grupo si sigue perdido (en `<body>`). Si la persona ya eligió otro control mientras
  // cargaba, se respeta, y la marca de devolución se consume igual.
  it.each<[string, () => HTMLElement]>([
    ["un enlace («Ver catálogo»)", () => screen.getByRole("link", { name: "Ver catálogo" })],
    ["un botón («Anterior», inerte en la página 1)", () => botonAnterior()],
  ])(
    "si la persona llevó el foco a otro control durante la carga (%s), el grupo no se lo quita",
    async (_nombre, elegir) => {
      const { segunda } = await pulsarReintentarConElFoco();
      const elegido = elegir();
      elegido.focus();
      expect(document.activeElement).toBe(elegido);

      await entregar(segunda, pagina([resumen(1)]));
      await screen.findByRole("table");
      expect(document.activeElement).toBe(elegido);
    },
  );

  it("lo mismo tras «Volver a la primera página»: el control elegido durante la carga se respeta", async () => {
    const { primera } = await pulsarVolverConElFoco();
    const catalogo = screen.getByRole("link", { name: "Ver catálogo" });
    catalogo.focus();

    await entregar(primera, pagina([resumen(1)], true));
    await screen.findByRole("link", { name: "BOR-1" });
    expect(document.activeElement).toBe(catalogo);
    expect(document.activeElement).not.toBe(grupoDelListado());
  });

  it("la marca se consume aunque el foco no se mueva: una carga posterior tampoco lo mueve", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    const catalogo = screen.getByRole("link", { name: "Ver catálogo" });
    catalogo.focus();
    await entregar(segunda, pagina([resumen(1)], true));
    await screen.findByRole("table");
    expect(document.activeElement).toBe(catalogo);

    // El foco queda perdido por otra vía (en <body>). Una carga que no pulsa nadie (cambia la sesión) no tiene nada
    // pendiente que devolver: «Siguiente» no sirve para probarlo, porque limpia la marca por su cuenta.
    catalogo.blur();
    expect(document.activeElement).toBe(document.body);
    lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(2)], true));
    iniciarSesion(ADMIN_2, 0);
    await screen.findByRole("link", { name: "BOR-2" });
    expect(paginasPedidas()).toEqual([1, 1, 1]);
    expect(document.activeElement).toBe(document.body);

    // Y tampoco al pasar de página después.
    lib.listarPaginaCotizaciones.mockResolvedValueOnce(pagina([resumen(3)], false));
    fireEvent.click(botonSiguiente());
    await screen.findByRole("link", { name: "BOR-3" });
    expect(paginasPedidas()).toEqual([1, 1, 1, 2]);
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(grupoDelListado());
  });

  it("un «Anterior» inerte (página 1) pulsado mientras se reintenta no cancela la devolución del foco", async () => {
    const { segunda } = await pulsarReintentarConElFoco();
    fireEvent.click(botonAnterior());
    expect(paginasPedidas()).toEqual([1, 1]);

    await entregar(segunda, pagina([resumen(1)]));
    await screen.findByRole("table");
    expect(document.activeElement).toBe(grupoDelListado());
  });

  it("pulsar «Anterior» mientras se reintenta cancela la devolución del foco", async () => {
    const reintento = diferida<PaginaCotizaciones>();
    lib.listarPaginaCotizaciones
      .mockResolvedValueOnce(pagina([resumen(1)], true))
      .mockRejectedValueOnce(new Error("fallo sintético"))
      .mockReturnValueOnce(reintento.promesa)
      .mockResolvedValueOnce(pagina([resumen(1)], true));
    montar(RUTA_LISTA);
    await screen.findByRole("link", { name: "BOR-1" });
    fireEvent.click(botonSiguiente());
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    // Mientras el reintento está en curso, la persona vuelve a la página anterior.
    fireEvent.click(botonAnterior());
    await screen.findByRole("link", { name: "BOR-1" });
    await entregar(reintento, pagina([resumen(2)], false));

    expect(paginasPedidas()).toEqual([1, 2, 2, 1]);
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(grupoDelListado());
  });

  it("tras «Volver a la primera página» el foco no se mueve mientras carga y pasa al grupo al llegar los datos", async () => {
    const { primera } = await pulsarVolverConElFoco();
    await act(async () => {});
    expect(document.activeElement).not.toBe(grupoDelListado());
    expect(document.activeElement).toBe(document.body);

    await entregar(primera, pagina([resumen(1)], true));
    await screen.findByRole("link", { name: "BOR-1" });
    expect(document.activeElement).toBe(grupoDelListado());
  });
});

/** Lo que la prueba puede hacer con una respuesta pendiente del detalle. */
interface PendienteDeCotizacion {
  resolver: (valor: Cotizacion | null) => void;
  rechazar: (motivo: unknown) => void;
}

/** Espera a que el detalle deje de estar cargando y a que se asienten los efectos. */
async function esperarFinDeCarga() {
  await waitFor(() => expect(document.body.querySelector('[aria-busy="true"]')).toBeNull());
  await act(async () => {});
}

describe("foco gestionado del detalle", () => {
  // Cómo puede terminar la carga inicial o el reintento: con la cotización, con un error o con «no encontrada».
  const TERMINA_EN: Array<[string, (pendiente: PendienteDeCotizacion) => void]> = [
    ["la cotización", (pendiente) => pendiente.resolver(cotizacion())],
    ["un error", (pendiente) => pendiente.rechazar(new Error("fallo sintético"))],
    ["«no encontrada» (null)", (pendiente) => pendiente.resolver(null)],
  ];

  it("el grupo existe en todos los estados, con su nombre y tabindex -1, y es siempre el mismo nodo", async () => {
    const reintento = diferida<Cotizacion | null>();
    lib.obtenerCotizacion.mockRejectedValueOnce(new Error("fallo sintético")).mockReturnValueOnce(reintento.promesa);
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });

    // Cargando y luego error.
    const grupo = grupoDelDetalle();
    expect(grupo).toHaveAttribute("tabindex", "-1");
    expect(grupo).toHaveAttribute("role", "group");
    await screen.findByRole("alert");
    expect(grupoDelDetalle()).toBe(grupo);

    // Cargando de nuevo y luego la cotización.
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(grupoDelDetalle()).toBe(grupo);
    await entregar(reintento, cotizacion());
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });
    expect(grupoDelDetalle()).toBe(grupo);
    expect(grupo).toContainElement(screen.getByRole("heading", { level: 2, name: "Prospecto" }));
    cleanup();

    // «No encontrada»: un id inválido y un UUID inexistente.
    montar(rutaDetalle("xyz"), { rutas: "detalle" });
    expect(grupoDelDetalle()).toHaveAttribute("tabindex", "-1");
    expect(grupoDelDetalle()).toContainElement(screen.getByRole("heading", { level: 2, name: "Cotización no encontrada" }));
    cleanup();

    lib.obtenerCotizacion.mockReset();
    lib.obtenerCotizacion.mockResolvedValue(null);
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    expect(grupoDelDetalle()).toHaveAttribute("tabindex", "-1");
  });

  it.each(TERMINA_EN)("la carga inicial no mueve el foco (termina en %s)", async (_nombre, terminar) => {
    const inicial = diferida<Cotizacion | null>();
    lib.obtenerCotizacion.mockReturnValueOnce(inicial.promesa);
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    expect(document.activeElement).toBe(document.body);

    await act(async () => {
      terminar(inicial);
    });
    await esperarFinDeCarga();
    expect(document.activeElement).toBe(document.body);
  });

  it("el foco pedido con «Reintentar» se consume una sola vez: una carga posterior ya no lo mueve", async () => {
    const reintento = diferida<Cotizacion | null>();
    lib.obtenerCotizacion.mockRejectedValueOnce(new Error("primer fallo")).mockReturnValueOnce(reintento.promesa);
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await entregar(reintento, cotizacion());
    await esperarFinDeCarga();
    expect(document.activeElement).toBe(grupoDelDetalle());

    // La persona lleva el foco a otro control y la carga se repite sin que pulse «Reintentar» (cambia la sesión).
    const volver = screen.getByRole("link", { name: "Volver a cotizaciones" });
    volver.focus();
    lib.obtenerCotizacion.mockResolvedValueOnce(cotizacion({ prospecto_nombre: "Prospecto de la segunda sesión" }));
    iniciarSesion(ADMIN_2, 0);
    await screen.findByText("Prospecto de la segunda sesión");
    expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(3);
    expect(document.activeElement).toBe(volver);
  });

  it.each(TERMINA_EN)(
    "el control elegido durante la carga se respeta y la marca se consume (termina en %s)",
    async (_nombre, terminar) => {
      const reintento = diferida<Cotizacion | null>();
      lib.obtenerCotizacion.mockRejectedValueOnce(new Error("primer fallo")).mockReturnValueOnce(reintento.promesa);
      montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
      fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

      // Mientras reintenta, la persona lleva el foco a «Volver a cotizaciones».
      const volver = screen.getByRole("link", { name: "Volver a cotizaciones" });
      volver.focus();
      await act(async () => {
        terminar(reintento);
      });
      await esperarFinDeCarga();
      expect(document.activeElement).toBe(volver);
      expect(document.activeElement).not.toBe(grupoDelDetalle());

      // La marca se consumió sin mover el foco: con el foco perdido, una carga posterior (otra sesión) no lo mueve.
      volver.blur();
      expect(document.activeElement).toBe(document.body);
      lib.obtenerCotizacion.mockResolvedValueOnce(cotizacion({ prospecto_nombre: "Prospecto de la segunda sesión" }));
      iniciarSesion(ADMIN_2, 0);
      await screen.findByText("Prospecto de la segunda sesión");
      expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(3);
      expect(document.activeElement).toBe(document.body);
    },
  );

  it("un id inválido tampoco mueve el foco", async () => {
    montar(rutaDetalle("xyz"), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    await act(async () => {});
    expect(document.activeElement).toBe(document.body);
  });

  it.each(TERMINA_EN)("tras «Reintentar» el foco no se mueve mientras carga y pasa al grupo al terminar en %s", async (_nombre, terminar) => {
    const reintento = diferida<Cotizacion | null>();
    lib.obtenerCotizacion.mockRejectedValueOnce(new Error("primer fallo")).mockReturnValueOnce(reintento.promesa);
    montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    const boton = await screen.findByRole("button", { name: "Reintentar" });
    boton.focus();
    expect(document.activeElement).toBe(boton);
    fireEvent.click(boton);

    await act(async () => {});
    expect(screen.getByText("Cargando la cotización…")).toBeInTheDocument();
    expect(document.activeElement).not.toBe(grupoDelDetalle());
    expect(document.activeElement).toBe(document.body);

    await act(async () => {
      terminar(reintento);
    });
    await esperarFinDeCarga();
    expect(document.activeElement).toBe(grupoDelDetalle());
    expectaFocoUtil();
    expect(lib.obtenerCotizacion).toHaveBeenCalledTimes(2);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Accesibilidad básica
 * ---------------------------------------------------------------------------------------------- */

describe("accesibilidad básica", () => {
  it("listado en cada estado: un h1, encabezados en orden, controles con nombre y errores con role=alert", async () => {
    // Cargando.
    lib.listarPaginaCotizaciones.mockReturnValueOnce(diferida<PaginaCotizaciones>().promesa);
    let vista = montar(RUTA_LISTA);
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    vista.unmount();

    // Vacío.
    servirPaginas({ 1: pagina([]) });
    vista = montar(RUTA_LISTA);
    await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    vista.unmount();

    // Con datos y página siguiente.
    servirPaginas({ 1: pagina([resumen(1), resumen(2)], true), 2: pagina([]) });
    vista = montar(RUTA_LISTA);
    await screen.findByRole("table", { name: /cotizaciones/i });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    expect(screen.getByRole("navigation", { name: "Paginación de cotizaciones" })).toBeInTheDocument();

    // Página posterior vacía.
    fireEvent.click(botonSiguiente());
    await screen.findByRole("heading", { level: 2, name: "Esta página no tiene cotizaciones" });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    vista.unmount();

    // Error.
    lib.listarPaginaCotizaciones.mockReset();
    lib.listarPaginaCotizaciones.mockRejectedValue(new Error("fallo sintético"));
    vista = montar(RUTA_LISTA);
    await screen.findByRole("alert");
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
  });

  it("listado en cada estado: una sola región en vivo (cortés y atómica) y un grupo con nombre accesible", async () => {
    const expectaRegionesDelListado = () => {
      const aviso = avisoEnVivo();
      expect(aviso).toHaveAttribute("aria-live", "polite");
      expect(aviso).toHaveAttribute("aria-atomic", "true");
      expect(grupoDelListado()).toHaveAccessibleName("Listado de cotizaciones");
      // Ni el grupo ni la región en vivo anidan una región en vivo más.
      expect(grupoDelListado().querySelector("[aria-live]")).toBeNull();
    };

    // Cargando.
    lib.listarPaginaCotizaciones.mockReturnValueOnce(diferida<PaginaCotizaciones>().promesa);
    let vista = montar(RUTA_LISTA);
    expectaRegionesDelListado();
    vista.unmount();

    // Vacío.
    servirPaginas({ 1: pagina([]) });
    vista = montar(RUTA_LISTA);
    await screen.findByRole("heading", { level: 2, name: "Aún no hay cotizaciones" });
    expectaRegionesDelListado();
    vista.unmount();

    // Con datos y página siguiente vacía.
    servirPaginas({ 1: pagina([resumen(1)], true), 2: pagina([]) });
    vista = montar(RUTA_LISTA);
    await screen.findByRole("table");
    expectaRegionesDelListado();
    fireEvent.click(botonSiguiente());
    await screen.findByRole("heading", { level: 2, name: "Esta página no tiene cotizaciones" });
    expectaRegionesDelListado();
    vista.unmount();

    // Error.
    lib.listarPaginaCotizaciones.mockReset();
    lib.listarPaginaCotizaciones.mockRejectedValue(new Error("fallo sintético"));
    vista = montar(RUTA_LISTA);
    await screen.findByRole("alert");
    expectaRegionesDelListado();
  });

  it("detalle en cada estado: un grupo con nombre accesible y ninguna región en vivo propia (el error usa role=alert)", async () => {
    const expectaGrupoSinRegionEnVivo = () => {
      expect(grupoDelDetalle()).toHaveAccessibleName("Detalle de la cotización");
      expect(document.body.querySelectorAll("[aria-live]")).toHaveLength(0);
    };

    // Cargando.
    lib.obtenerCotizacion.mockReturnValueOnce(diferida<Cotizacion | null>().promesa);
    let vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    expectaGrupoSinRegionEnVivo();
    vista.unmount();

    // La cotización.
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });
    expectaGrupoSinRegionEnVivo();
    vista.unmount();

    // «No encontrada»: UUID inexistente e id inválido.
    lib.obtenerCotizacion.mockReset();
    lib.obtenerCotizacion.mockResolvedValue(null);
    vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    expectaGrupoSinRegionEnVivo();
    vista.unmount();

    vista = montar(rutaDetalle("xyz"), { rutas: "detalle" });
    expectaGrupoSinRegionEnVivo();
    vista.unmount();

    // Error.
    lib.obtenerCotizacion.mockReset();
    lib.obtenerCotizacion.mockRejectedValue(new Error("fallo sintético"));
    vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("alert");
    expectaGrupoSinRegionEnVivo();
  });

  it("la tabla tiene nombre, cabeceras de columna y una región con nombre que se puede enfocar", async () => {
    servirPaginas({ 1: pagina([resumen(1)]) });
    montar(RUTA_LISTA);

    const tabla = await screen.findByRole("table");
    expect(tabla).toHaveAccessibleName("Cotizaciones, de la más reciente a la más antigua.");
    expect(within(tabla).getAllByRole("columnheader")).toHaveLength(4);
    const region = screen.getByRole("region", { name: "Tabla de cotizaciones, se desplaza en horizontal" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toContainElement(tabla);
  });

  it("detalle en cada estado: un h1, encabezados en orden, controles con nombre y errores con role=alert", async () => {
    // Cargando.
    lib.obtenerCotizacion.mockReturnValueOnce(diferida<Cotizacion | null>().promesa);
    let vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    vista.unmount();

    // Con la cotización.
    lib.obtenerCotizacion.mockResolvedValue(cotizacion());
    vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    expect(nivelesDeEncabezado()).toEqual([1, 2, 2]);
    // Cada dd tiene su dt.
    expect(document.body.querySelectorAll("dt")).toHaveLength(8);
    expect(document.body.querySelectorAll("dd")).toHaveLength(8);
    vista.unmount();

    // No encontrada (id inválido y UUID inexistente).
    vista = montar(rutaDetalle("xyz"), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    vista.unmount();

    lib.obtenerCotizacion.mockReset();
    lib.obtenerCotizacion.mockResolvedValue(null);
    vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("heading", { level: 2, name: "Cotización no encontrada" });
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    vista.unmount();

    // Error.
    lib.obtenerCotizacion.mockReset();
    lib.obtenerCotizacion.mockRejectedValue(new Error("fallo sintético"));
    vista = montar(rutaDetalle(ID_DETALLE), { rutas: "detalle" });
    await screen.findByRole("alert");
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
  });

  it("catálogo: un h1, encabezados en orden", () => {
    montar("/dashboard/cotizaciones/catalogo");
    expectaEncabezadosEnOrden();
    expectaControlesConNombre();
    expect(nivelesDeEncabezado()).toEqual([1, 2]);
  });

  it("los botones y enlaces de la paginación y del reintento contienen su texto visible en su nombre accesible", async () => {
    servirPaginas({ 1: pagina([resumen(1)], true) });
    montar(RUTA_LISTA);
    await screen.findByRole("table");

    // 2.5.3 Etiqueta en el nombre: el nombre accesible incluye el texto visible.
    expect(botonAnterior().getAttribute("aria-label")?.toLowerCase()).toContain("anterior");
    expect(botonSiguiente().getAttribute("aria-label")?.toLowerCase()).toContain("siguiente");
  });
});
