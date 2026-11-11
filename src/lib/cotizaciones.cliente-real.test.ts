import { fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cotizacion } from "@/types/cotizaciones";

/**
 * Contrato con el cliente REAL de Supabase (sin red).
 *
 * `cotizaciones.test.ts` simula la respuesta de `supabase.from(...)`. Aquí, en cambio, la capa de datos
 * habla con el cliente que de verdad se usa en producción (`createClient` de `@supabase/supabase-js`,
 * con su PostgREST real por dentro) y lo único simulado es `fetch`, la frontera de red. Así queda
 * fijado el supuesto de seguridad central de `obtenerCotizacion`: que «no hay fila» (respuesta HTTP 200
 * con `[]`) llega al módulo como `data: null` con `status: 200`, y que cualquier otra respuesta sin
 * cuerpo (204, 404 vacío) NO se toma por «no encontrada».
 *
 * Todo es sintético: URL de un dominio reservado, clave falsa, UUID y filas inventados.
 */

const { URL_FALSA, CLAVE_FALSA, fetchSimulado } = vi.hoisted(() => ({
  URL_FALSA: "https://proyecto-ficticio.example.test",
  CLAVE_FALSA: "clave-publicable-ficticia-0000",
  fetchSimulado: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient(URL_FALSA, CLAVE_FALSA, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchSimulado },
    }),
  };
});

// Solo para la pantalla del listado que se monta al final del archivo: una sesión de administrador ya resuelta. La capa
// de datos y el cliente de Supabase siguen siendo los REALES (lo único simulado es `fetch`).
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "usuario-admin-sintetico" }, userType: 0, loading: false }),
}));

import CotizacionesList from "@/pages/dashboard/CotizacionesList";
import {
  ErrorCotizacion,
  listarCotizaciones,
  listarPaginaCotizaciones,
  obtenerCotizacion,
  TAMANO_PAGINA_MAXIMO,
  TAMANO_PAGINA_PREDETERMINADO,
} from "./cotizaciones";
import type { CodigoErrorCotizacion, PaginaCotizaciones } from "./cotizaciones";

/* ------------------------------------------------------------------------------------------------
 * Datos sintéticos y ayudantes
 * ---------------------------------------------------------------------------------------------- */

const GENERICO = "No se pudo completar la operación. Inténtalo de nuevo.";
const MARCA = "MARCA-SECRETA-7f3a";

const ID_A = "c1000000-0000-4000-8000-000000000001";
const ID_B = "c1000000-0000-4000-8000-000000000002";
const USUARIO = "a1000000-0000-4000-8000-000000000001";

const FILA: Cotizacion = {
  id: ID_A,
  referencia_interna: "BOR-1",
  estado: "borrador",
  prospecto_nombre: "Empresa Ficticia S.A.",
  prospecto_contacto: "Persona Ficticia",
  prospecto_email: "contacto@example.test",
  prospecto_telefono: "+00 000 0000",
  creado_por: USUARIO,
  creado_at: "2026-11-10T12:00:00.123456+00:00",
  actualizado_por: null,
  actualizado_at: "2026-11-10T13:30:00+00:00",
  row_version: 3,
};

const TEXTOS: Array<[CodigoErrorCotizacion, string]> = [
  ["SIN_PERMISO", "No tienes permiso para realizar esta acción."],
  ["NO_ENCONTRADA", "Cotización no encontrada."],
  ["ESTADO_INVALIDO", "No puedes realizar esta acción en el estado actual de la cotización."],
  ["CONFLICTO_VERSION", "La cotización cambió mientras la editabas. Recarga para ver la versión más reciente."],
  ["MOTIVO_REQUERIDO", "Indica un motivo de entre 10 y 1 000 caracteres."],
  ["SUSTITUIDA", "Esta cotización fue sustituida por otra versión."],
  ["TOPE_EXCEDIDO", "La cotización supera el límite permitido. Revisa los importes."],
  ["INMUTABLE", "Esta cotización ya no admite cambios."],
];

const COLUMNAS_COTIZACION =
  "id,referencia_interna,estado,prospecto_nombre,prospecto_contacto,prospecto_email,prospecto_telefono,creado_por,creado_at,actualizado_por,actualizado_at,row_version";
const COLUMNAS_RESUMEN = "id,referencia_interna,estado,prospecto_nombre,creado_at,row_version";

/** Lo que el servidor haría llegar por la red: un cuerpo JSON con su código HTTP. */
function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

function texto(cuerpo: string, status: number, tipo = "text/plain"): Response {
  return new Response(cuerpo, { status, headers: { "content-type": tipo } });
}

/** Programa lo que devuelve la red; `fabrica` se llama en cada petición (una `Response` solo se lee una vez). */
function red(fabrica: () => Response): void {
  fetchSimulado.mockImplementation(async () => fabrica());
}

beforeEach(() => {
  fetchSimulado.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

async function fallo(promesa: Promise<unknown>): Promise<ErrorCotizacion> {
  let razon: unknown;
  let resolvio = false;
  try {
    await promesa;
    resolvio = true;
  } catch (e) {
    razon = e;
  }
  if (resolvio) throw new Error("Se esperaba un rechazo y la promesa se resolvió");
  if (!(razon instanceof ErrorCotizacion)) throw new Error("El rechazo no es una ErrorCotizacion");
  return razon;
}

/** Espera una `ErrorCotizacion` con ese código y ese texto, sin rastro del original en ninguna superficie. */
async function esperarFallo(
  promesa: Promise<unknown>,
  codigo: CodigoErrorCotizacion,
  mensaje: string,
  prohibidos: string[] = [],
): Promise<void> {
  const error = await fallo(promesa);
  expect(error.codigo).toBe(codigo);
  expect(error.message).toBe(mensaje);
  expect("cause" in error).toBe(false);
  const superficie = [error.message, String(error), JSON.stringify(error), error.stack ?? ""].join("\n");
  for (const fragmento of [MARCA, "permission denied", "cotizaciones_pkey", "<html>", "PGRST", ...prohibidos]) {
    expect(superficie).not.toContain(fragmento);
  }
}

interface Peticion {
  url: URL;
  metodo: string | undefined;
  cuerpo: unknown;
  cabeceras: Headers;
}

/** Las peticiones que el cliente real hizo a `fetch`, ya leídas. */
function peticiones(): Peticion[] {
  return fetchSimulado.mock.calls.map((llamada: unknown[]) => {
    const [entrada, init] = llamada;
    const direccion = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : String(entrada);
    const opciones: { method?: string; body?: unknown; headers?: HeadersInit } =
      typeof init === "object" && init !== null ? init : {};
    return {
      url: new URL(direccion),
      metodo: opciones.method,
      cuerpo: opciones.body,
      cabeceras: new Headers(opciones.headers),
    };
  });
}

/** Parámetros de la URL ya decodificados y ordenados, para comparar de forma exacta sin depender del orden. */
function parametros(url: URL): Array<[string, string]> {
  return [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/* ------------------------------------------------------------------------------------------------
 * (a) El supuesto central: «sin fila» solo es un 200 con cero filas
 * ---------------------------------------------------------------------------------------------- */

describe("obtenerCotizacion con el cliente real · qué respuesta es «sin fila»", () => {
  it("HTTP 200 con [] (cero filas legítimas, p. ej. RLS la oculta) resuelve null", async () => {
    red(() => json([]));
    await expect(obtenerCotizacion(ID_A)).resolves.toBeNull();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it("HTTP 200 con una fila resuelve la Cotizacion de 12 campos", async () => {
    red(() => json([FILA]));
    await expect(obtenerCotizacion(ID_A)).resolves.toStrictEqual(FILA);
  });

  it("HTTP 200 con una fila con columnas de más no deja pasar las extras", async () => {
    red(() => json([{ ...FILA, secreto: MARCA, rol_interno: "admin" }]));
    const resultado = await obtenerCotizacion(ID_A);
    expect(resultado).toStrictEqual(FILA);
    expect(JSON.stringify(resultado)).not.toContain(MARCA);
  });

  it("HTTP 200 con dos filas (el cliente lo trata como error de cardinalidad) es DESCONOCIDO y sin su texto", async () => {
    red(() => json([FILA, { ...FILA, id: ID_B }]));
    await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO, ["multiple", "rows returned"]);
  });

  it("HTTP 200 con la fila de OTRO id es DATOS_INVALIDOS, no «no encontrada»", async () => {
    red(() => json([{ ...FILA, id: ID_B }]));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it("HTTP 200 con una fila inválida es DATOS_INVALIDOS", async () => {
    red(() => json([{ ...FILA, estado: "vencida" }]));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it("HTTP 204 sin cuerpo NO es «sin fila»: DATOS_INVALIDOS", async () => {
    red(() => new Response(null, { status: 204 }));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it("HTTP 404 con cuerpo vacío (el cliente lo reescribe como 204) NO es «sin fila»: DATOS_INVALIDOS", async () => {
    red(() => texto("", 404));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  // Limitación documentada en el módulo: un 200 con cuerpo vacío es indistinguible de cero filas.
  it("HTTP 200 con cuerpo vacío es indistinguible de cero filas y resuelve null (limitación documentada)", async () => {
    red(() => texto("", 200));
    await expect(obtenerCotizacion(ID_A)).resolves.toBeNull();
  });
});

describe("listarCotizaciones con el cliente real · una respuesta sin cuerpo no es una página vacía", () => {
  it("HTTP 200 con [] es una página vacía legítima", async () => {
    red(() => json([]));
    await expect(listarCotizaciones()).resolves.toStrictEqual([]);
  });

  it("HTTP 204 sin cuerpo es DATOS_INVALIDOS, no una página vacía", async () => {
    red(() => new Response(null, { status: 204 }));
    await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  it("HTTP 404 con cuerpo vacío es DATOS_INVALIDOS, no una página vacía", async () => {
    red(() => texto("", 404));
    await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  it("HTTP 200 con una sola fila inválida rechaza la página entera", async () => {
    red(() => json([{ ...FILA, id: ID_A }, { ...FILA, id: ID_B, estado: "vencida" }]));
    await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });
});

describe("el cliente real ante fallos HTTP sin JSON · DESCONOCIDO genérico y sin el texto del cuerpo", () => {
  const FALLOS: Array<[string, () => Response]> = [
    ["401 con cuerpo vacío", () => texto("", 401)],
    ["403 con cuerpo vacío", () => texto("", 403)],
    ["500 con cuerpo vacío", () => texto("", 500)],
    ["401 con HTML", () => texto(`<html><body>${MARCA}</body></html>`, 401, "text/html")],
    ["403 con HTML", () => texto(`<html><body>${MARCA}</body></html>`, 403, "text/html")],
    ["500 con HTML", () => texto(`<html><body>${MARCA}</body></html>`, 500, "text/html")],
    ["500 con texto plano", () => texto(`${MARCA} permission denied for table cotizaciones`, 500)],
    ["404 con HTML (no es un 404 vacío)", () => texto(`<html><body>${MARCA}</body></html>`, 404, "text/html")],
    ["200 con un cuerpo que no es JSON", () => texto(`${MARCA} <html>`, 200, "text/html")],
  ];

  it.each(FALLOS)("obtenerCotizacion · %s", async (_nombre, respuesta) => {
    red(respuesta);
    await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
  });

  it.each(FALLOS)("listarCotizaciones · %s", async (_nombre, respuesta) => {
    red(respuesta);
    await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
  });
});

describe("el cliente real ante un fallo de red · DESCONOCIDO genérico y sin el texto de la excepción", () => {
  // El cliente reintenta las lecturas ante un fallo de red con esperas reales y crecientes entre intentos (las fija postgrest-js): se usan
  // temporizadores simulados para no esperar. Se protege el resultado final, no el número de intentos.
  it.each([
    ["obtenerCotizacion", () => obtenerCotizacion(ID_A)],
    ["listarCotizaciones", () => listarCotizaciones()],
  ])("%s", async (_nombre, invocar) => {
    vi.useFakeTimers();
    fetchSimulado.mockRejectedValue(new TypeError(`${MARCA} fetch failed`));
    const resultado = fallo(invocar());
    await vi.runAllTimersAsync();
    const error = await resultado;
    expect(error.codigo).toBe("DESCONOCIDO");
    expect(error.message).toBe(GENERICO);
    expect([error.message, String(error), JSON.stringify(error), error.stack ?? ""].join("\n")).not.toContain(MARCA);
    // El número de reintentos es del cliente (postgrest-js) y no de esta capa: por eso no se fija. Basta con
    // que `fetch` se haya llamado y con que la promesa se haya asentado tras drenar los temporizadores.
    expect(fetchSimulado.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("el cliente real ante un fallo de red TRANSITORIO · el reintento del cliente lo absorbe", () => {
  // Si una versión futura del cliente (postgrest-js) dejara de reintentar las lecturas, estas pruebas
  // lo señalarían como un cambio de comportamiento del cliente (intencionado): habría que revisarlo a
  // propósito. No dependen del número de reintentos: basta con que `fetch` se llame al menos dos veces.
  const PAGINA = [
    {
      id: ID_A,
      referencia_interna: "BOR-1",
      estado: "borrador",
      prospecto_nombre: "Empresa Ficticia S.A.",
      creado_at: "2026-11-10T12:00:00.123456+00:00",
      row_version: 3,
    },
    {
      id: ID_B,
      referencia_interna: "BOR-2",
      estado: "emitida",
      prospecto_nombre: null,
      creado_at: "2026-11-09T08:15:30Z",
      row_version: 1,
    },
  ];

  it("obtenerCotizacion devuelve la cotización correcta y fetch se llamó al menos dos veces", async () => {
    vi.useFakeTimers();
    fetchSimulado.mockRejectedValueOnce(new TypeError(`${MARCA} fetch failed`));
    fetchSimulado.mockImplementation(async () => json([FILA]));
    const asentada = Promise.allSettled([obtenerCotizacion(ID_A)]);
    await vi.runAllTimersAsync();
    expect(await asentada).toStrictEqual([{ status: "fulfilled", value: FILA }]);
    expect(fetchSimulado.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("listarCotizaciones devuelve la página correcta y fetch se llamó al menos dos veces", async () => {
    vi.useFakeTimers();
    fetchSimulado.mockRejectedValueOnce(new TypeError(`${MARCA} fetch failed`));
    fetchSimulado.mockImplementation(async () => json(PAGINA));
    const asentada = Promise.allSettled([listarCotizaciones()]);
    await vi.runAllTimersAsync();
    expect(await asentada).toStrictEqual([{ status: "fulfilled", value: PAGINA }]);
    expect(fetchSimulado.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

/* ------------------------------------------------------------------------------------------------
 * (b) Errores JSON estilo PostgREST
 * ---------------------------------------------------------------------------------------------- */

describe("el cliente real ante un error JSON de PostgREST", () => {
  const FUNCIONES: Array<[string, () => Promise<unknown>]> = [
    ["obtenerCotizacion", () => obtenerCotizacion(ID_A)],
    ["listarCotizaciones", () => listarCotizaciones()],
  ];

  describe.each(FUNCIONES)("%s", (_nombre, invocar) => {
    it("COT:SIN_PERMISO con code P0001 (HTTP 400) sale como SIN_PERMISO con el texto aprobado", async () => {
      red(() => json({ message: "COT:SIN_PERMISO", code: "P0001", details: null, hint: null }, 400));
      await esperarFallo(invocar(), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
    });

    it("COT:SIN_PERMISO con code 42501 (HTTP 403) sale como SIN_PERMISO: un COT: conocido gana al SQLSTATE", async () => {
      red(() => json({ message: "COT:SIN_PERMISO", code: "42501", details: null, hint: null }, 403));
      await esperarFallo(invocar(), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
    });

    it.each(TEXTOS)("COT:%s sale con su código y el texto aprobado", async (codigo, texto) => {
      red(() => json({ message: `COT:${codigo}`, code: "P0001", details: `detalle-${MARCA}`, hint: `pista-${MARCA}` }, 400));
      await esperarFallo(invocar(), codigo, texto);
    });

    it("«permission denied for table cotizaciones» con code 42501 (HTTP 403) es DESCONOCIDO y genérico", async () => {
      red(() =>
        json(
          { message: "permission denied for table cotizaciones", code: "42501", details: null, hint: `pista-${MARCA}` },
          403,
        ),
      );
      await esperarFallo(invocar(), "DESCONOCIDO", GENERICO);
    });

    it("COT:DETALLE_INVALIDO es un error interno: DESCONOCIDO y genérico, sin su detalle", async () => {
      red(() => json({ message: "COT:DETALLE_INVALIDO", code: "P0001", details: `campo-${MARCA}`, hint: null }, 400));
      await esperarFallo(invocar(), "DESCONOCIDO", GENERICO);
    });

    it("un error SQL de clave duplicada es DESCONOCIDO y genérico", async () => {
      red(() =>
        json(
          {
            message: 'duplicate key value violates unique constraint "cotizaciones_pkey"',
            code: "23505",
            details: `Key (id)=(${MARCA}) already exists.`,
            hint: null,
          },
          409,
        ),
      );
      await esperarFallo(invocar(), "DESCONOCIDO", GENERICO);
    });

    it("un error de PostgREST sin COT: (PGRST…) es DESCONOCIDO y genérico", async () => {
      red(() => json({ code: "PGRST205", message: `tabla ${MARCA} no encontrada`, details: null, hint: null }, 404));
      await esperarFallo(invocar(), "DESCONOCIDO", GENERICO);
    });
  });
});

/* ------------------------------------------------------------------------------------------------
 * (c) Forma de la petición que sale hacia la red
 * ---------------------------------------------------------------------------------------------- */

describe("la petición real de listarCotizaciones", () => {
  it("{ pagina: 3, tamano: 10 } hace UN GET a /rest/v1/cotizaciones con select, order, offset y limit exactos", async () => {
    red(() => json([]));
    await listarCotizaciones({ pagina: 3, tamano: 10 });

    const hechas = peticiones();
    expect(hechas).toHaveLength(1);
    const [peticion] = hechas;
    expect(peticion.metodo).toBe("GET");
    expect(peticion.cuerpo).toBeUndefined();
    expect(peticion.url.origin + peticion.url.pathname).toBe(`${URL_FALSA}/rest/v1/cotizaciones`);
    expect(parametros(peticion.url)).toStrictEqual([
      ["limit", "10"],
      ["offset", "20"],
      ["order", "creado_at.desc,id.desc"],
      ["select", COLUMNAS_RESUMEN],
    ]);
  });

  it("sin argumentos pide la primera página de 25 (offset 0, limit 25)", async () => {
    red(() => json([]));
    await listarCotizaciones();
    const [peticion] = peticiones();
    expect(peticiones()).toHaveLength(1);
    expect(parametros(peticion.url)).toStrictEqual([
      ["limit", "25"],
      ["offset", "0"],
      ["order", "creado_at.desc,id.desc"],
      ["select", COLUMNAS_RESUMEN],
    ]);
  });

  it("{ pagina: 10000, tamano: 100 } pide offset 999900 y limit 100", async () => {
    red(() => json([]));
    await listarCotizaciones({ pagina: 10000, tamano: 100 });
    const [peticion] = peticiones();
    expect(peticion.url.searchParams.get("offset")).toBe("999900");
    expect(peticion.url.searchParams.get("limit")).toBe("100");
  });

  it("nunca pide «*» ni columnas del detalle", async () => {
    red(() => json([]));
    await listarCotizaciones();
    const [peticion] = peticiones();
    const select = peticion.url.searchParams.get("select") ?? "";
    expect(select).not.toContain("*");
    expect(select).not.toContain("prospecto_email");
    expect(select).not.toContain("prospecto_telefono");
  });

  it.each<[string, Parameters<typeof listarCotizaciones>[0]]>([
    ["pagina 0", { pagina: 0 }],
    ["tamano 101", { tamano: 101 }],
    ["pagina 1.5", { pagina: 1.5 }],
    ["pagina 10001", { pagina: 10001 }],
  ])("con %s no se llama a fetch", async (_nombre, opciones) => {
    red(() => json([]));
    await fallo(listarCotizaciones(opciones));
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe("la petición real de obtenerCotizacion", () => {
  it("con un UUID en MAYÚSCULAS hace UN GET con id=eq.<el id tal cual> y las 12 columnas", async () => {
    red(() => json([]));
    const id = ID_A.toUpperCase();
    await obtenerCotizacion(id);

    const hechas = peticiones();
    expect(hechas).toHaveLength(1);
    const [peticion] = hechas;
    expect(peticion.metodo).toBe("GET");
    expect(peticion.cuerpo).toBeUndefined();
    expect(peticion.url.origin + peticion.url.pathname).toBe(`${URL_FALSA}/rest/v1/cotizaciones`);
    expect(parametros(peticion.url)).toStrictEqual([
      ["id", `eq.${id}`],
      ["select", COLUMNAS_COTIZACION],
    ]);
  });

  it("con un UUID en minúsculas pide exactamente ese id", async () => {
    red(() => json([]));
    await obtenerCotizacion(ID_A);
    const [peticion] = peticiones();
    expect(peticion.url.searchParams.get("id")).toBe(`eq.${ID_A}`);
  });

  it("nunca pide «*»", async () => {
    red(() => json([]));
    await obtenerCotizacion(ID_A);
    const [peticion] = peticiones();
    expect(peticion.url.searchParams.get("select") ?? "").not.toContain("*");
  });

  it.each([["xyz"], ["catalogo"], [""], [`${ID_A}\n`], [` ${ID_A}`], [`urn:uuid:${ID_A}`], [`${ID_A}&select=*`], [`eq.${ID_A},or=(id.neq.${ID_B})`]])(
    "con el id inválido %j devuelve null y NO llama a fetch",
    async (id) => {
      red(() => json([FILA]));
      await expect(obtenerCotizacion(id)).resolves.toBeNull();
      expect(fetchSimulado).not.toHaveBeenCalled();
    },
  );
});

describe("las credenciales que el cliente real envía", () => {
  const CASOS: Array<[string, () => Promise<unknown>]> = [
    ["listarCotizaciones", () => listarCotizaciones()],
    ["obtenerCotizacion", () => obtenerCotizacion(ID_A)],
  ];

  it.each(CASOS)("%s: apikey y Authorization son la clave falsa y nada más, y no aparece service_role", async (_nombre, invocar) => {
    red(() => json([]));
    await invocar();

    const hechas = peticiones();
    expect(hechas).toHaveLength(1);
    const [peticion] = hechas;
    expect(peticion.cabeceras.get("apikey")).toBe(CLAVE_FALSA);
    expect(peticion.cabeceras.get("authorization")).toBe(`Bearer ${CLAVE_FALSA}`);

    const todo = [peticion.url.href, ...[...peticion.cabeceras.entries()].flat()].join("\n").toLowerCase();
    expect(todo).not.toContain("service_role");
    // La clave falsa solo viaja en las dos cabeceras de credenciales.
    for (const [nombre, valor] of peticion.cabeceras.entries()) {
      if (nombre !== "apikey" && nombre !== "authorization") expect(valor).not.toContain(CLAVE_FALSA);
    }
    expect(peticion.url.href).not.toContain(CLAVE_FALSA);
  });
});

/* ------------------------------------------------------------------------------------------------
 * listarPaginaCotizaciones y la cancelación con el cliente REAL
 *
 * `listarPaginaCotizaciones` pide `tamano + 1` filas (offset y limit en la URL) y la señal de cancelación
 * llega a `fetch` como `init.signal`. Lo simulado sigue siendo solo `fetch`.
 * ---------------------------------------------------------------------------------------------- */

/** Fila de listado válida número `n` (id, referencia y fecha propios). */
function filaDeLista(n: number): Record<string, unknown> {
  return {
    id: `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    referencia_interna: `BOR-${n}`,
    estado: "borrador",
    prospecto_nombre: `Prospecto ficticio ${n}`,
    creado_at: `2026-11-10T12:00:${String(n % 60).padStart(2, "0")}+00:00`,
    row_version: n,
  };
}

const filasDeLista = (cantidad: number): Array<Record<string, unknown>> =>
  Array.from({ length: cantidad }, (_, i) => filaDeLista(i + 1));

/** El `init.signal` con el que el cliente real llamó a `fetch`, petición por petición. */
function senalesDeFetch(): unknown[] {
  return fetchSimulado.mock.calls.map((llamada: unknown[]) => {
    const init = llamada[1];
    return typeof init === "object" && init !== null && "signal" in init ? init.signal : undefined;
  });
}

/**
 * Un `fetch` que no responde hasta que su señal se cancela y entonces rechaza con lo que indique `comoRechaza`.
 * Un `fetch` de verdad rechaza con el motivo de la señal (`signal.reason`); los navegadores antiguos, con un AbortError.
 */
function fetchQueEsperaLaCancelacion(comoRechaza: (senal: AbortSignal) => unknown): (entrada: unknown, init?: RequestInit) => Promise<Response> {
  return (_entrada, init) =>
    new Promise<Response>((_resolver, rechazar) => {
      const senal = init?.signal;
      if (!senal) return;
      if (senal.aborted) {
        rechazar(comoRechaza(senal));
        return;
      }
      senal.addEventListener("abort", () => rechazar(comoRechaza(senal)), { once: true });
    });
}

const COMO_ABORT_ERROR = (): unknown => new DOMException(`${MARCA} The user aborted a request.`, "AbortError");
const COMO_MOTIVO_DE_LA_SENAL = (senal: AbortSignal): unknown => senal.reason;

describe("la petición real de listarPaginaCotizaciones · pide UNA fila de más", () => {
  // [nombre, opciones, offset, limit]
  const CASOS: Array<[string, Parameters<typeof listarPaginaCotizaciones>[0], string, string]> = [
    ["sin argumentos", undefined, "0", "26"],
    ["{}", {}, "0", "26"],
    ["{ tamano: 100 }", { tamano: 100 }, "0", "101"],
    ["{ tamano: 1 }", { tamano: 1 }, "0", "2"],
    ["{ pagina: 2, tamano: 25 }", { pagina: 2, tamano: 25 }, "25", "26"],
    ["{ pagina: 3, tamano: 10 }", { pagina: 3, tamano: 10 }, "20", "11"],
    ["{ pagina: 2, tamano: 100 }", { pagina: 2, tamano: 100 }, "100", "101"],
    ["{ pagina: 10000, tamano: 1 }", { pagina: 10000, tamano: 1 }, "9999", "2"],
    ["{ pagina: 10000, tamano: 100 }", { pagina: 10000, tamano: 100 }, "999900", "101"],
  ];

  it.each(CASOS)("%s hace UN GET a /rest/v1/cotizaciones con offset %s y limit %s", async (_nombre, opciones, offset, limit) => {
    red(() => json([]));
    await listarPaginaCotizaciones(opciones);

    const hechas = peticiones();
    expect(hechas).toHaveLength(1);
    const [peticion] = hechas;
    expect(peticion.metodo).toBe("GET");
    expect(peticion.cuerpo).toBeUndefined();
    expect(peticion.url.origin + peticion.url.pathname).toBe(`${URL_FALSA}/rest/v1/cotizaciones`);
    expect(parametros(peticion.url)).toStrictEqual([
      ["limit", limit],
      ["offset", offset],
      ["order", "creado_at.desc,id.desc"],
      ["select", COLUMNAS_RESUMEN],
    ]);
  });

  it("la URL lleva offset y limit contiguos: página 2, tamaño 25 → offset=25&limit=26", async () => {
    red(() => json([]));
    await listarPaginaCotizaciones({ pagina: 2, tamano: 25 });
    const [peticion] = peticiones();
    expect(peticion.url.search).toContain("offset=25&limit=26");
  });

  it("el limit supera en uno al de listarCotizaciones para los mismos parámetros, con el mismo offset", async () => {
    red(() => json([]));
    await listarCotizaciones({ pagina: 3, tamano: 10 });
    await listarPaginaCotizaciones({ pagina: 3, tamano: 10 });
    const [listado, pagina] = peticiones();
    expect(listado.url.searchParams.get("offset")).toBe(pagina.url.searchParams.get("offset"));
    expect(listado.url.searchParams.get("limit")).toBe("10");
    expect(pagina.url.searchParams.get("limit")).toBe("11");
    expect(listado.url.searchParams.get("order")).toBe(pagina.url.searchParams.get("order"));
    expect(listado.url.searchParams.get("select")).toBe(pagina.url.searchParams.get("select"));
  });

  it("nunca pide «*» ni columnas del detalle", async () => {
    red(() => json([]));
    await listarPaginaCotizaciones();
    const [peticion] = peticiones();
    const select = peticion.url.searchParams.get("select") ?? "";
    expect(select).not.toContain("*");
    expect(select).not.toContain("prospecto_email");
    expect(select).not.toContain("prospecto_telefono");
  });

  it.each<[string, Parameters<typeof listarPaginaCotizaciones>[0]]>([
    ["pagina 0", { pagina: 0 }],
    ["tamano 101", { tamano: 101 }],
    ["tamano 0", { tamano: 0 }],
    ["pagina 1.5", { pagina: 1.5 }],
    ["pagina 10001", { pagina: 10001 }],
  ])("con %s no se llama a fetch", async (_nombre, opciones) => {
    red(() => json([]));
    await fallo(listarPaginaCotizaciones(opciones));
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it("apikey y Authorization son la clave falsa y nada más, y no aparece service_role", async () => {
    red(() => json([]));
    await listarPaginaCotizaciones({ signal: new AbortController().signal });
    const [peticion] = peticiones();
    expect(peticion.cabeceras.get("apikey")).toBe(CLAVE_FALSA);
    expect(peticion.cabeceras.get("authorization")).toBe(`Bearer ${CLAVE_FALSA}`);
    const todo = [peticion.url.href, ...[...peticion.cabeceras.entries()].flat()].join("\n").toLowerCase();
    expect(todo).not.toContain("service_role");
  });
});

describe("listarPaginaCotizaciones con el cliente real · filas, fila de más y respuestas sin cuerpo", () => {
  it("HTTP 200 con [] es una página vacía legítima", async () => {
    red(() => json([]));
    await expect(listarPaginaCotizaciones()).resolves.toStrictEqual({ cotizaciones: [], haySiguiente: false });
  });

  it("tamano 100 con 101 filas: devuelve 100, haySiguiente true y la fila 101 no sale", async () => {
    red(() => json(filasDeLista(101)));
    const resultado = await listarPaginaCotizaciones({ tamano: 100 });
    expect(resultado.cotizaciones).toStrictEqual(filasDeLista(100));
    expect(resultado.haySiguiente).toBe(true);
    expect(resultado.cotizaciones.map((item) => item.referencia_interna)).not.toContain("BOR-101");
    const [peticion] = peticiones();
    expect(peticion.url.searchParams.get("limit")).toBe("101");
  });

  it("tamano 100 con 100 filas: devuelve las 100 y haySiguiente false", async () => {
    red(() => json(filasDeLista(100)));
    await expect(listarPaginaCotizaciones({ tamano: 100 })).resolves.toStrictEqual({
      cotizaciones: filasDeLista(100),
      haySiguiente: false,
    });
  });

  it("tamano 100 con 102 filas (el servidor ignora el limit): DATOS_INVALIDOS, no se trunca", async () => {
    red(() => json(filasDeLista(102)));
    await esperarFallo(listarPaginaCotizaciones({ tamano: 100 }), "DATOS_INVALIDOS", GENERICO);
  });

  it("el tamano predeterminado (25) con 26 filas: devuelve 25 y haySiguiente true", async () => {
    red(() => json(filasDeLista(26)));
    await expect(listarPaginaCotizaciones()).resolves.toStrictEqual({ cotizaciones: filasDeLista(25), haySiguiente: true });
  });

  it("página 2, tamaño 25 con 26 filas: devuelve 25 y haySiguiente true", async () => {
    red(() => json(filasDeLista(26)));
    const resultado = await listarPaginaCotizaciones({ pagina: 2, tamano: 25 });
    expect(resultado.cotizaciones).toHaveLength(25);
    expect(resultado.haySiguiente).toBe(true);
    const [peticion] = peticiones();
    expect(peticion.url.searchParams.get("offset")).toBe("25");
    expect(peticion.url.searchParams.get("limit")).toBe("26");
  });

  it("la última página (menos de tamano filas) no tiene siguiente", async () => {
    red(() => json(filasDeLista(7)));
    await expect(listarPaginaCotizaciones({ pagina: 3, tamano: 25 })).resolves.toStrictEqual({
      cotizaciones: filasDeLista(7),
      haySiguiente: false,
    });
  });

  it("PAGINA_MAXIMA con 101 filas: 100 filas y sin siguiente (la siguiente se rechazaría como parámetro)", async () => {
    red(() => json(filasDeLista(101)));
    await expect(listarPaginaCotizaciones({ pagina: 10000, tamano: 100 })).resolves.toStrictEqual({
      cotizaciones: filasDeLista(100),
      haySiguiente: false,
    });
  });

  it("la fila de más inválida rechaza la página entera; también la que sobra con columnas de más se descarta", async () => {
    red(() => json([...filasDeLista(100), { ...filaDeLista(101), estado: "vencida" }]));
    await esperarFallo(listarPaginaCotizaciones({ tamano: 100 }), "DATOS_INVALIDOS", GENERICO);

    red(() => json([...filasDeLista(1), { ...filaDeLista(2), secreto: MARCA }]));
    const resultado = await listarPaginaCotizaciones({ tamano: 1 });
    expect(resultado).toStrictEqual({ cotizaciones: filasDeLista(1), haySiguiente: true });
    expect(JSON.stringify(resultado)).not.toContain(MARCA);
  });

  it("HTTP 204 sin cuerpo es DATOS_INVALIDOS, no una página vacía", async () => {
    red(() => new Response(null, { status: 204 }));
    await esperarFallo(listarPaginaCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  it("HTTP 404 con cuerpo vacío es DATOS_INVALIDOS, no una página vacía", async () => {
    red(() => texto("", 404));
    await esperarFallo(listarPaginaCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  it.each(TEXTOS)("un error JSON COT:%s (HTTP 400) sale con su código y texto aprobado", async (codigo, textoAprobado) => {
    red(() => json({ message: `COT:${codigo}`, code: "P0001", details: `detalle-${MARCA}`, hint: `pista-${MARCA}` }, 400));
    await esperarFallo(listarPaginaCotizaciones(), codigo, textoAprobado);
  });

  it.each([
    ["401 con cuerpo vacío", () => texto("", 401)],
    ["500 con HTML", () => texto(`<html><body>${MARCA}</body></html>`, 500, "text/html")],
    ["403 con JSON de permiso denegado", () => json({ message: "permission denied for table cotizaciones", code: "42501", details: null, hint: `pista-${MARCA}` }, 403)],
    ["200 con un cuerpo que no es JSON", () => texto(`${MARCA} <html>`, 200, "text/html")],
  ])("%s es DESCONOCIDO genérico y sin el texto del cuerpo", async (_nombre, respuesta) => {
    red(respuesta);
    await esperarFallo(listarPaginaCotizaciones(), "DESCONOCIDO", GENERICO);
  });
});

describe("la cancelación con el cliente real · init.signal es la misma señal", () => {
  it("listarPaginaCotizaciones: fetch recibe EXACTAMENTE la señal del llamador", async () => {
    red(() => json([]));
    const controlador = new AbortController();
    await listarPaginaCotizaciones({ signal: controlador.signal });
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(senalesDeFetch()[0]).toBe(controlador.signal);
  });

  it("obtenerCotizacion: fetch recibe EXACTAMENTE la señal del llamador", async () => {
    red(() => json([FILA]));
    const controlador = new AbortController();
    await expect(obtenerCotizacion(ID_A, { signal: controlador.signal })).resolves.toStrictEqual(FILA);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(senalesDeFetch()[0]).toBe(controlador.signal);
  });

  it("sin señal, fetch no recibe ninguna (las tres funciones públicas)", async () => {
    red(() => json([]));
    await listarPaginaCotizaciones();
    await listarCotizaciones();
    await obtenerCotizacion(ID_A);
    await obtenerCotizacion(ID_A, {});
    expect(fetchSimulado).toHaveBeenCalledTimes(4);
    expect(senalesDeFetch()).toStrictEqual([undefined, undefined, undefined, undefined]);
  });

  it("listarCotizaciones no es cancelable: aunque se le pase una señal (fuera de su tipo), fetch no la recibe", async () => {
    red(() => json([]));
    const controlador = new AbortController();
    await listarCotizaciones(Object.assign({ tamano: 1 }, { signal: controlador.signal }));
    expect(senalesDeFetch()).toStrictEqual([undefined]);
  });

  it("dos llamadas con señales distintas entregan cada una la suya", async () => {
    red(() => json([]));
    const a = new AbortController();
    const b = new AbortController();
    await listarPaginaCotizaciones({ signal: a.signal });
    await obtenerCotizacion(ID_A, { signal: b.signal });
    expect(senalesDeFetch()[0]).toBe(a.signal);
    expect(senalesDeFetch()[1]).toBe(b.signal);
  });

  it("una señal ya cancelada no llega a fetch: CANCELADA sin petición (las dos funciones)", async () => {
    red(() => json([]));
    const controlador = new AbortController();
    controlador.abort(new Error(`${MARCA} motivo`));
    await esperarFallo(listarPaginaCotizaciones({ signal: controlador.signal }), "CANCELADA", GENERICO, ["motivo"]);
    await esperarFallo(obtenerCotizacion(ID_A, { signal: controlador.signal }), "CANCELADA", GENERICO, ["motivo"]);
    expect(fetchSimulado).not.toHaveBeenCalled();
  });
});

describe("la cancelación con el cliente real · abortar durante la petición es CANCELADA", () => {
  // La respuesta `[FILA]` es la fila del detalle (12 campos): el detalle la devuelve entera y el listado se queda con sus 6 columnas.
  const RESUMEN_DE_FILA = {
    id: FILA.id,
    referencia_interna: FILA.referencia_interna,
    estado: FILA.estado,
    prospecto_nombre: FILA.prospecto_nombre,
    creado_at: FILA.creado_at,
    row_version: FILA.row_version,
  };

  const FUNCIONES: Array<[string, (signal: AbortSignal) => Promise<unknown>, unknown]> = [
    ["listarPaginaCotizaciones", (signal) => listarPaginaCotizaciones({ signal }), { cotizaciones: [RESUMEN_DE_FILA], haySiguiente: false }],
    ["obtenerCotizacion", (signal) => obtenerCotizacion(ID_A, { signal }), FILA],
  ];

  describe.each(FUNCIONES)("%s", (_nombre, invocar, esperado) => {
    it("abortar con el motivo por defecto: fetch rechaza con AbortError, sale CANCELADA y fetch se llamó UNA sola vez", async () => {
      fetchSimulado.mockImplementation(fetchQueEsperaLaCancelacion(COMO_ABORT_ERROR));
      const controlador = new AbortController();
      const resultado = fallo(invocar(controlador.signal));
      await vi.waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1), { timeout: 5000 });
      expect(senalesDeFetch()[0]).toBe(controlador.signal);
      controlador.abort();
      const error = await resultado;
      expect(error.codigo).toBe("CANCELADA");
      expect(error.message).toBe(GENERICO);
      expect("cause" in error).toBe(false);
      expect([error.message, String(error), JSON.stringify(error), error.stack ?? ""].join("\n")).not.toContain(MARCA);
      // Un AbortError no se reintenta.
      expect(fetchSimulado).toHaveBeenCalledTimes(1);
    });

    it("abortar con un motivo propio: fetch rechaza con ESE motivo, sale CANCELADA, sin su texto y sin reintentos infinitos", async () => {
      fetchSimulado.mockImplementation(fetchQueEsperaLaCancelacion(COMO_MOTIVO_DE_LA_SENAL));
      const controlador = new AbortController();
      const resultado = fallo(invocar(controlador.signal));
      await vi.waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1), { timeout: 5000 });
      controlador.abort(new Error(`${MARCA} ${"motivo-de-la-interfaz"}`));
      const error = await resultado;
      expect(error.codigo).toBe("CANCELADA");
      expect(error.message).toBe(GENERICO);
      expect([error.message, String(error), JSON.stringify(error), error.stack ?? ""].join("\n")).not.toContain(MARCA);
      expect([error.message, String(error), JSON.stringify(error), error.stack ?? ""].join("\n")).not.toContain("motivo-de-la-interfaz");
      // El cliente reintenta una lectura cuyo rechazo no es un AbortError (3 reintentos como mucho, sin esperas con la señal
      // cancelada): el número es del cliente, así que solo se exige que termine.
      expect(fetchSimulado.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(fetchSimulado.mock.calls.length).toBeLessThanOrEqual(4);
    });

    it("abortar con una cadena como motivo también es CANCELADA y no deja la cadena", async () => {
      fetchSimulado.mockImplementation(fetchQueEsperaLaCancelacion(COMO_MOTIVO_DE_LA_SENAL));
      const controlador = new AbortController();
      const resultado = fallo(invocar(controlador.signal));
      await vi.waitFor(() => expect(fetchSimulado).toHaveBeenCalled(), { timeout: 5000 });
      controlador.abort(MARCA);
      const error = await resultado;
      expect(error.codigo).toBe("CANCELADA");
      expect([error.message, String(error), JSON.stringify(error), error.stack ?? ""].join("\n")).not.toContain(MARCA);
    });

    it("sin abortar, el mismo AbortError de transporte NO es CANCELADA: es DESCONOCIDO (la señal sigue viva)", async () => {
      fetchSimulado.mockRejectedValue(new DOMException(`${MARCA} The user aborted a request.`, "AbortError"));
      const controlador = new AbortController();
      await esperarFallo(invocar(controlador.signal), "DESCONOCIDO", GENERICO);
      expect(controlador.signal.aborted).toBe(false);
    });

    it("sin abortar, un fallo de red NO es CANCELADA: es DESCONOCIDO", async () => {
      vi.useFakeTimers();
      fetchSimulado.mockRejectedValue(new TypeError(`${MARCA} fetch failed`));
      const controlador = new AbortController();
      const resultado = fallo(invocar(controlador.signal));
      await vi.runAllTimersAsync();
      const error = await resultado;
      expect(error.codigo).toBe("DESCONOCIDO");
      expect(error.message).toBe(GENERICO);
      expect(fetchSimulado.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it("sin abortar, un error JSON COT:SIN_PERMISO sale con su código de siempre", async () => {
      red(() => json({ message: "COT:SIN_PERMISO", code: "P0001", details: null, hint: null }, 400));
      await esperarFallo(invocar(new AbortController().signal), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
    });

    it("una respuesta que llega después de cancelar se entrega tal cual si el fetch la resolvió (decisión documentada)", async () => {
      const controlador = new AbortController();
      fetchSimulado.mockImplementation(async () => {
        controlador.abort();
        return json([FILA]);
      });
      await expect(invocar(controlador.signal)).resolves.toStrictEqual(esperado);
      expect(controlador.signal.aborted).toBe(true);
    });
  });
});

/* ------------------------------------------------------------------------------------------------
 * `max_rows` de PostgREST y la fila de más del listado
 *
 * `listarPaginaCotizaciones` pide `tamano + 1` filas para saber si hay página siguiente. Si PostgREST tuviera
 * `max_rows` (`db-max-rows`) por debajo de `tamano + 1`, recortaría la respuesta SIN avisar (HTTP 200, sin error) y
 * `haySiguiente` saldría falso con filas todavía por mostrar. El cliente no puede detectarlo: `postgrest-js` solo lee
 * `Content-Range` cuando se pide `count`, y la capa de datos no lo pide. Por eso `max_rows >= 101` (el mayor pedido
 * posible, `TAMANO_PAGINA_MAXIMO + 1`) es una COMPROBACIÓN PREVIA OBLIGATORIA a la publicación: este archivo fija qué
 * pasa por encima y por debajo de ese límite, con el cliente real y un `fetch` que se comporta como PostgREST.
 * ---------------------------------------------------------------------------------------------- */

/** El `max_rows` mínimo que se exige del servidor antes de publicar. Es `TAMANO_PAGINA_MAXIMO + 1`. */
const MAX_ROWS_MINIMO_EXIGIDO = 101;

/**
 * Un `fetch` que se comporta como PostgREST con `max_rows`: de las `total` filas del servidor (de la más reciente a la
 * más antigua) entrega, a partir de `offset`, como mucho `min(limit, max_rows)`. Si recorta no lo dice: HTTP 200.
 */
function servidorConMaxRows(total: number, maxRows: number): void {
  const todas = filasDeLista(total);
  fetchSimulado.mockImplementation(async (entrada: unknown) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : String(entrada));
    const desde = Number(url.searchParams.get("offset") ?? "0");
    const pedidas = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : Number.POSITIVE_INFINITY;
    return json(todas.slice(desde, desde + Math.min(pedidas, maxRows)));
  });
}

/** Recorre las páginas como una pantalla: sigue mientras `haySiguiente` es verdadero y se detiene en la primera falsa. */
async function recorrerPaginas(tamano: number): Promise<PaginaCotizaciones[]> {
  const paginas: PaginaCotizaciones[] = [];
  for (let pagina = 1; pagina <= 1000; pagina += 1) {
    const actual = await listarPaginaCotizaciones({ pagina, tamano });
    paginas.push(actual);
    if (!actual.haySiguiente) return paginas;
  }
  throw new Error("haySiguiente nunca fue falso: la secuencia no termina");
}

const referenciasDeLista = (cantidad: number): unknown[] => filasDeLista(cantidad).map((fila) => fila.referencia_interna);

describe("listarPaginaCotizaciones con un servidor que aplica max_rows · el tamaño predeterminado de las pantallas", () => {
  const T = TAMANO_PAGINA_PREDETERMINADO;
  const enPaginas = (completas: number, resto: number): number[] => [
    ...Array.from({ length: completas }, () => T),
    ...(resto > 0 ? [resto] : []),
  ];

  // [filas en el servidor, filas de cada página recorrida]: la última página nunca tiene siguiente.
  const SECUENCIAS: Array<[number, number[]]> = [
    [0, [0]],
    [1, [1]],
    [T - 1, [T - 1]],
    [T, [T]],
    [T + 1, [T, 1]],
    [2 * T, [T, T]],
    [2 * T + 1, [T, T, 1]],
    [2 * T + 10, enPaginas(2, 10)],
    [10 * T, enPaginas(10, 0)],
  ];

  // 1000 es el valor por defecto de Supabase; 100 es un valor bajo plausible que aún cubre `T + 1`.
  describe.each([1000, 100])("max_rows %i", (maxRows) => {
    it.each(SECUENCIAS)(
      "%i filas en el servidor: páginas de %j, siguiente verdadero salvo en la última y nunca más de tamano",
      async (total, esperadas) => {
        servidorConMaxRows(total, maxRows);
        const paginas = await recorrerPaginas(T);

        expect(paginas.map((pagina) => pagina.cotizaciones.length)).toStrictEqual(esperadas);
        expect(paginas.map((pagina) => pagina.haySiguiente)).toStrictEqual(esperadas.map((_, i) => i < esperadas.length - 1));
        for (const pagina of paginas) expect(pagina.cotizaciones.length).toBeLessThanOrEqual(T);
        // Contiguas, sin saltos ni repetidas, y la fila de más nunca sale en ninguna página.
        expect(paginas.flatMap((pagina) => pagina.cotizaciones.map((item) => item.referencia_interna))).toStrictEqual(
          referenciasDeLista(total),
        );
        // Cada petición pidió UNA fila de más y arrancó donde terminó la anterior.
        const hechas = peticiones();
        expect(hechas.map((peticion) => peticion.url.searchParams.get("limit"))).toStrictEqual(esperadas.map(() => String(T + 1)));
        expect(hechas.map((peticion) => peticion.url.searchParams.get("offset"))).toStrictEqual(esperadas.map((_, i) => String(i * T)));
      },
    );
  });
});

describe("la pantalla del listado con un servidor que aplica max_rows · pide exactamente el tamaño predeterminado", () => {
  it("el tamaño predeterminado + 1, y el mayor tamaño posible + 1, caben en el max_rows mínimo exigido (101)", () => {
    // Si alguien sube el tamaño de las pantallas (o el tope de la capa de datos) por encima, esta prueba lo señala: el
    // mínimo exigido al servidor tendría que subir con él, y la comprobación previa a la publicación también.
    expect(TAMANO_PAGINA_PREDETERMINADO + 1).toBeLessThanOrEqual(MAX_ROWS_MINIMO_EXIGIDO);
    expect(TAMANO_PAGINA_MAXIMO + 1).toBeLessThanOrEqual(MAX_ROWS_MINIMO_EXIGIDO);
  });

  it.each([1000, 100])(
    "con max_rows %i la pantalla pagina de TAMANO_PAGINA_PREDETERMINADO en TAMANO_PAGINA_PREDETERMINADO hasta la última",
    async (maxRows) => {
      const T = TAMANO_PAGINA_PREDETERMINADO;
      servidorConMaxRows(2 * T + 10, maxRows);
      render(createElement(MemoryRouter, { initialEntries: ["/dashboard/cotizaciones"] }, createElement(CotizacionesList)));

      const filasVisibles = () => within(screen.getByRole("table")).getAllByRole("row").length - 1; // sin la fila de títulos
      const siguiente = () => screen.getByRole("button", { name: "Página siguiente" });

      await screen.findByRole("link", { name: "BOR-1" }, { timeout: 5000 });
      expect(filasVisibles()).toBe(T);
      expect(siguiente()).not.toHaveAttribute("aria-disabled");

      fireEvent.click(siguiente());
      await screen.findByRole("link", { name: `BOR-${T + 1}` }, { timeout: 5000 });
      expect(filasVisibles()).toBe(T);
      expect(siguiente()).not.toHaveAttribute("aria-disabled");

      fireEvent.click(siguiente());
      await screen.findByRole("link", { name: `BOR-${2 * T + 1}` }, { timeout: 5000 });
      expect(filasVisibles()).toBe(10);
      expect(siguiente()).toHaveAttribute("aria-disabled", "true");

      // Exactamente el tamaño predeterminado + 1 en cada petición, y nunca por encima del mínimo exigido al servidor.
      const hechas = peticiones();
      const limites = hechas.map((peticion) => peticion.url.searchParams.get("limit"));
      expect(limites).toStrictEqual([String(T + 1), String(T + 1), String(T + 1)]);
      for (const limite of limites) expect(Number(limite)).toBeLessThanOrEqual(MAX_ROWS_MINIMO_EXIGIDO);
      expect(hechas.map((peticion) => peticion.url.searchParams.get("offset"))).toStrictEqual(["0", String(T), String(2 * T)]);
    },
  );
});

describe("LIMITACIÓN CONOCIDA, NO DESEADA · tamano 100 con un servidor de max_rows 100", () => {
  // Caracterización de un límite, no el comportamiento que se quiere: la fila de más (la 101) nunca llega y la capa de
  // datos no tiene cómo saberlo, así que da la página por última. Mientras la capa de datos no cuente filas (o el
  // servidor no cumpla `max_rows >= 101`) esto es lo que ocurre; por eso `max_rows >= 101` es una comprobación previa
  // obligatoria a la publicación. Las pantallas usan 25, que no lo alcanza, pero cualquier llamador con `tamano: 100` sí.
  it("CARACTERIZACIÓN: con max_rows 100 y tamano 100, haySiguiente sale FALSO aunque haya más filas (debería ser verdadero)", async () => {
    servidorConMaxRows(250, 100);
    const pagina = await listarPaginaCotizaciones({ tamano: 100 });

    expect(pagina.cotizaciones).toHaveLength(100); // nunca más de tamano
    expect(pagina.haySiguiente).toBe(false); // LIMITACIÓN: quedan 150 filas por mostrar
    const [peticion] = peticiones();
    expect(peticion.url.searchParams.get("limit")).toBe("101"); // sí pidió la fila de más; el servidor la recortó
  });

  it("CARACTERIZACIÓN: la consecuencia es que las filas 101 en adelante no se alcanzan al recorrer las páginas", async () => {
    servidorConMaxRows(250, 100);
    const paginas = await recorrerPaginas(100);

    expect(paginas).toHaveLength(1);
    expect(paginas[0].cotizaciones.map((item) => item.referencia_interna)).toStrictEqual(referenciasDeLista(100));
  });

  it("con max_rows 101 (el mínimo exigido) el mismo escenario es correcto: 100, 100, 50 y siguiente solo mientras quedan filas", async () => {
    servidorConMaxRows(250, MAX_ROWS_MINIMO_EXIGIDO);
    const paginas = await recorrerPaginas(100);

    expect(paginas.map((pagina) => pagina.cotizaciones.length)).toStrictEqual([100, 100, 50]);
    expect(paginas.map((pagina) => pagina.haySiguiente)).toStrictEqual([true, true, false]);
    expect(paginas.flatMap((pagina) => pagina.cotizaciones.map((item) => item.referencia_interna))).toStrictEqual(
      referenciasDeLista(250),
    );
  });

  it("con max_rows 1000 (el valor por defecto de Supabase) el mismo escenario también es correcto", async () => {
    servidorConMaxRows(250, 1000);
    const paginas = await recorrerPaginas(100);

    expect(paginas.map((pagina) => pagina.cotizaciones.length)).toStrictEqual([100, 100, 50]);
    expect(paginas.map((pagina) => pagina.haySiguiente)).toStrictEqual([true, true, false]);
  });
});
