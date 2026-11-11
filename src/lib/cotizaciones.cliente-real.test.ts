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

import { ErrorCotizacion, listarCotizaciones, obtenerCotizacion } from "./cotizaciones";
import type { CodigoErrorCotizacion } from "./cotizaciones";

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
