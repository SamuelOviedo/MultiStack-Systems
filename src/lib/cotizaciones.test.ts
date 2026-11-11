import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { MockInstance } from "vitest";
import type { Json, Tables } from "@/integrations/supabase/types";
import { ESTADOS_COTIZACION } from "@/types/cotizaciones";
import type {
  Cotizacion,
  CotizacionEvento,
  CotizacionResumen,
  EstadoCotizacion,
  TipoEventoCotizacion,
} from "@/types/cotizaciones";

interface Llamada {
  metodo: string;
  args: unknown[];
}

/**
 * Lo que hace la siguiente consulta a Supabase:
 * - `resuelve`: la cadena termina en una promesa que se resuelve con `valor` (`{ data, error }`).
 * - `rechaza`: esa promesa se rechaza con `valor`.
 * - `lanza`: `from()` lanza `valor` de forma síncrona.
 */
interface Plan {
  tipo: "resuelve" | "rechaza" | "lanza";
  valor: unknown;
}

// Registro de llamadas a la cadena `from().select()...`, en orden y con sus argumentos.
const { from, llamadas } = vi.hoisted(() => {
  const llamadas: Llamada[] = [];
  return { from: vi.fn(), llamadas };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));

import {
  ErrorCotizacion,
  MENSAJE_ERROR_GENERICO,
  PAGINA_MAXIMA,
  TAMANO_PAGINA_MAXIMO,
  TAMANO_PAGINA_PREDETERMINADO,
  esUuid,
  listarCotizaciones,
  obtenerCotizacion,
  traducirErrorCotizacion,
} from "./cotizaciones";
import type { CodigoCotizacionConocido, CodigoErrorCotizacion } from "./cotizaciones";

/* ------------------------------------------------------------------------------------------------
 * Mock de Supabase. Simula la cadena real de PostgREST: cada método devuelve el mismo objeto
 * «constructor», que registra el método y sus argumentos, y el objeto es un thenable (como lo es el
 * PostgrestBuilder real) que resuelve a `{ data, error }`, se rechaza o, antes de eso, `from()` lanza.
 * ---------------------------------------------------------------------------------------------- */

const METODOS_DE_LA_CADENA = ["select", "order", "eq", "range", "maybeSingle"];

function programar(plan: Plan): void {
  from.mockImplementation((tabla: unknown) => {
    llamadas.push({ metodo: "from", args: [tabla] });
    if (plan.tipo === "lanza") throw plan.valor;
    const cadena: Record<string, unknown> = {};
    for (const metodo of METODOS_DE_LA_CADENA) {
      cadena[metodo] = (...args: unknown[]) => {
        llamadas.push({ metodo, args });
        return cadena;
      };
    }
    cadena.then = (alResolver: (valor: unknown) => unknown, alRechazar: (razon: unknown) => unknown) =>
      (plan.tipo === "rechaza" ? Promise.reject(plan.valor) : Promise.resolve(plan.valor)).then(
        alResolver,
        alRechazar,
      );
    return cadena;
  });
}

const resuelve = (valor: unknown): Plan => ({ tipo: "resuelve", valor });
// Una respuesta legítima de PostgREST/supabase-js lleva `status: 200` (también las de «cero filas»):
// con `data: null`, `obtenerCotizacion` solo toma la respuesta por «sin fila» si el status es 200.
const responde = (data: unknown): Plan => resuelve({ data, error: null, status: 200 });
const falla = (error: unknown): Plan => resuelve({ data: null, error });
const rechaza = (razon: unknown): Plan => ({ tipo: "rechaza", valor: razon });
const lanza = (razon: unknown): Plan => ({ tipo: "lanza", valor: razon });

/** Marca para pedir una respuesta SIN la clave `status` (distinta de `status: undefined`). */
const SIN_STATUS = Symbol("sin status");

/** Respuesta sin error con el `status` indicado; con `SIN_STATUS` la clave no existe. */
function respondeConStatus(data: unknown, status: unknown): Plan {
  const respuesta: Record<string, unknown> = { data, error: null };
  if (status !== SIN_STATUS) respuesta.status = status;
  return resuelve(respuesta);
}

// Espías (consola, Date.parse…): se registran aquí y se restauran siempre, pase lo que pase en la prueba.
const espiasActivos: MockInstance[] = [];

function registrar<T extends MockInstance>(espia: T): T {
  espiasActivos.push(espia);
  return espia;
}

beforeEach(() => {
  from.mockReset();
  llamadas.length = 0;
});

afterEach(() => {
  for (const espia of espiasActivos.splice(0)) espia.mockRestore();
});

/**
 * ÚNICO cast del archivo. Mete a propósito un valor que el tipo no permite (un id que no es cadena,
 * opciones que no son un objeto, un código inexistente) para comprobar que la función falla cerrado
 * en tiempo de ejecución, que es lo que ocurre cuando los datos vienen de fuera del sistema de tipos.
 * Es una sola aserción desde `unknown` y solo fabrica ARGUMENTOS de una llamada; nunca se aplica a lo
 * que devuelve el módulo, así que no oculta ningún fallo de tipos de la capa de datos.
 */
function hostil<T>(valor: unknown): T {
  return valor as T;
}

/* ------------------------------------------------------------------------------------------------
 * Datos sintéticos y ayudantes.
 * ---------------------------------------------------------------------------------------------- */

const GENERICO = "No se pudo completar la operación. Inténtalo de nuevo.";

// Textos aprobados, copiados literalmente: si cambia un texto de la tabla del módulo, esta prueba falla.
const TEXTOS: Array<[CodigoCotizacionConocido, string]> = [
  ["SIN_PERMISO", "No tienes permiso para realizar esta acción."],
  ["NO_ENCONTRADA", "Cotización no encontrada."],
  ["ESTADO_INVALIDO", "No puedes realizar esta acción en el estado actual de la cotización."],
  ["CONFLICTO_VERSION", "La cotización cambió mientras la editabas. Recarga para ver la versión más reciente."],
  ["MOTIVO_REQUERIDO", "Indica un motivo de entre 10 y 1 000 caracteres."],
  ["SUSTITUIDA", "Esta cotización fue sustituida por otra versión."],
  ["TOPE_EXCEDIDO", "La cotización supera el límite permitido. Revisa los importes."],
  ["INMUTABLE", "Esta cotización ya no admite cambios."],
];

const ID_A = "c1000000-0000-4000-8000-000000000001";
const ID_B = "c1000000-0000-4000-8000-000000000002";
const USUARIO = "a1000000-0000-4000-8000-000000000001";
const OTRO_USUARIO = "a1000000-0000-4000-8000-000000000002";
const EMOJI = String.fromCodePoint(0x1f600);

const COTIZACION: Cotizacion = {
  id: ID_A,
  referencia_interna: "BOR-1",
  estado: "borrador",
  prospecto_nombre: "Empresa Ficticia S.A.",
  prospecto_contacto: "Persona Ficticia",
  prospecto_email: "contacto@example.test",
  prospecto_telefono: "+00 000 0000",
  creado_por: USUARIO,
  creado_at: "2026-11-10T12:00:00.123456+00:00",
  actualizado_por: OTRO_USUARIO,
  actualizado_at: "2026-11-10T13:30:00+00:00",
  row_version: 3,
};

const CLAVES_COTIZACION = [
  "actualizado_at",
  "actualizado_por",
  "creado_at",
  "creado_por",
  "estado",
  "id",
  "prospecto_contacto",
  "prospecto_email",
  "prospecto_nombre",
  "prospecto_telefono",
  "referencia_interna",
  "row_version",
];

const CLAVES_RESUMEN = ["creado_at", "estado", "id", "prospecto_nombre", "referencia_interna", "row_version"];

const COLUMNAS_COTIZACION =
  "id, referencia_interna, estado, prospecto_nombre, prospecto_contacto, prospecto_email, prospecto_telefono, creado_por, creado_at, actualizado_por, actualizado_at, row_version";
const COLUMNAS_RESUMEN = "id, referencia_interna, estado, prospecto_nombre, creado_at, row_version";

type Fila = Record<string, unknown>;

/** Fila completa de `cotizaciones`, con los cambios indicados. */
function fila(cambios: Fila = {}): Fila {
  return { ...COTIZACION, ...cambios };
}

/** Fila completa sin las claves indicadas. */
function sin(...claves: string[]): Fila {
  const copia: Fila = { ...COTIZACION };
  for (const clave of claves) delete copia[clave];
  return copia;
}

/** Fila del listado número `n`, con id, referencia y fecha propios. */
function resumen(n: number, cambios: Fila = {}): Fila {
  return {
    id: `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    referencia_interna: `BOR-${n}`,
    estado: "borrador",
    prospecto_nombre: `Prospecto ficticio ${n}`,
    creado_at: `2026-11-10T12:00:${String(n % 60).padStart(2, "0")}+00:00`,
    row_version: n,
    ...cambios,
  };
}

/** Lo que el servidor devolvería de más (columnas que no se pidieron): no debe llegar a la salida. */
function conExtras(valor: Fila): Fila {
  // `prospecto_email` es una columna del detalle (la fila ya la trae) pero NO del listado.
  return { prospecto_email: "x@example.test", ...valor, secreto: "x" };
}

/** Espera un rechazo y comprueba que es una `ErrorCotizacion`. */
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

async function esperarFallo(
  promesa: Promise<unknown>,
  codigo: CodigoErrorCotizacion,
  mensaje: string,
): Promise<ErrorCotizacion> {
  const error = await fallo(promesa);
  expect(error.codigo).toBe(codigo);
  expect(error.message).toBe(mensaje);
  return error;
}

// Fragmentos que solo existen en errores crudos de Postgres/PostgREST o en datos del servidor.
const SENSIBLES = [
  "cotizaciones_pkey",
  "permission denied",
  "row-level security",
  "Failing row",
  "secreto-xyz",
  "SELECT",
  "INSERT",
];

function aTexto(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (valor instanceof Error) return `${valor.name} ${valor.message} ${valor.stack ?? ""}`;
  try {
    return JSON.stringify(valor) ?? String(valor);
  } catch {
    return "[no serializable]";
  }
}

/** Todo lo que un registro, un boundary o una serialización podrían leer de un error. */
function superficieDe(error: Error): string[] {
  const propias = Object.getOwnPropertyNames(error).map((nombre) =>
    aTexto(Object.getOwnPropertyDescriptor(error, nombre)?.value),
  );
  return [error.message, String(error), JSON.stringify(error), error.stack ?? "", ...propias];
}

function esperarSinSensibles(error: Error): void {
  const todo = superficieDe(error).join("\n");
  for (const fragmento of SENSIBLES) expect(todo).not.toContain(fragmento);
}

/** Errores hostiles: crudos de la base, objetos de PostgREST, valores raros y getters que lanzan. */
const HOSTILES: Array<[string, unknown]> = [
  ["Error con SQL de clave duplicada", new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')],
  [
    "objeto PostgREST 42501 con details y hint",
    {
      message: "permission denied for table cotizaciones",
      code: "42501",
      details: "Failing row contains (…)",
      hint: "secreto-xyz",
    },
  ],
  ["Error con INSERT", new Error("INSERT INTO cotizaciones (prospecto_email) VALUES ($1)")],
  [
    "objeto PostgREST con SELECT",
    { message: "SELECT * FROM cotizaciones", code: "42P01", details: "Failing row contains (…)", hint: "secreto-xyz" },
  ],
  [
    "objeto PostgREST de RLS",
    { message: 'new row violates row-level security policy for table "cotizaciones"', code: "42501", details: null, hint: null },
  ],
  ["null", null],
  ["undefined", undefined],
  ["número", 42],
  ["cadena suelta COT:SIN_PERMISO", "COT:SIN_PERMISO"],
  ["arreglo", ["COT:SIN_PERMISO"]],
  [
    "getter message que lanza",
    {
      get message(): string {
        throw new Error("fallo con secreto-xyz");
      },
      code: "42501",
      details: "Failing row contains (…)",
    },
  ],
];

/* ------------------------------------------------------------------------------------------------
 * Constantes
 * ---------------------------------------------------------------------------------------------- */

describe("constantes del módulo", () => {
  it("fijan el mensaje genérico y los topes de paginación", () => {
    expect(MENSAJE_ERROR_GENERICO).toBe(GENERICO);
    expect(TAMANO_PAGINA_PREDETERMINADO).toBe(25);
    expect(TAMANO_PAGINA_MAXIMO).toBe(100);
    expect(PAGINA_MAXIMA).toBe(10000);
  });
});

/* ------------------------------------------------------------------------------------------------
 * esUuid
 * ---------------------------------------------------------------------------------------------- */

describe("esUuid", () => {
  const VALIDOS: Array<[string, string]> = [
    ["canónico en minúsculas (inventado)", ID_A],
    ["canónico en MAYÚSCULAS", ID_A.toUpperCase()],
    ["mezcla de mayúsculas y minúsculas", "A1b2C3d4-E5f6-4789-8aBc-0123456789Ab"],
    ["versión 1", "6ba7b810-9dad-11d1-80b4-00c04fd430c8"],
    ["versión 4", "f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    ["versión 4 en MAYÚSCULAS", "F47AC10B-58CC-4372-A567-0E02B2C3D479"],
    ["versión 7", "017f22e2-79b0-7cc3-98c4-dc0c0c07398f"],
    ["versión 0 y variante fuera de RFC (no se restringe)", "12345678-1234-0234-f234-123456789abc"],
    ["nil", "00000000-0000-0000-0000-000000000000"],
    ["máximo", "ffffffff-ffff-ffff-ffff-ffffffffffff"],
  ];

  it.each(VALIDOS)("acepta %s", (_nombre, valor) => {
    expect(esUuid(valor)).toBe(true);
  });

  const INVALIDOS: Array<[string, string]> = [
    ["«catalogo»", "catalogo"],
    ["«xyz»", "xyz"],
    ["cadena vacía", ""],
    ["solo espacios", "   "],
    ["espacio al inicio", ` ${ID_A}`],
    ["espacio al final", `${ID_A} `],
    ["salto de línea al final", `${ID_A}\n`],
    ["salto de línea al inicio", `\n${ID_A}`],
    ["entre llaves", `{${ID_A}}`],
    ["con prefijo urn:uuid:", `urn:uuid:${ID_A}`],
    ["sin guiones", ID_A.split("-").join("")],
    ["con un guion de más", "c1000000-0000-4000-8000-00000000-0001"],
    ["con un carácter no hexadecimal (g)", "g1000000-0000-4000-8000-000000000001"],
    ["de 35 caracteres", ID_A.slice(0, 35)],
    ["de 37 caracteres", `${ID_A}0`],
    ["dos UUID seguidos", `${ID_A}${ID_B}`],
    ["con guiones en otro lugar", "c10000000-000-4000-8000-000000000001"],
  ];

  it.each(INVALIDOS)("rechaza %s", (_nombre, valor) => {
    expect(esUuid(valor)).toBe(false);
  });

  const NO_CADENAS: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["un número", 123],
    ["true", true],
    ["un objeto", {}],
    ["un objeto cuyo toString devuelve un UUID", { toString: () => ID_A }],
    ["un arreglo vacío", []],
    ["un arreglo con un UUID válido", [ID_A]],
    ["un objeto String", new String(ID_A)],
    ["un símbolo", Symbol("id")],
  ];

  it.each(NO_CADENAS)("rechaza %s", (_nombre, valor) => {
    expect(esUuid(valor)).toBe(false);
  });
});

/* ------------------------------------------------------------------------------------------------
 * traducirErrorCotizacion
 * ---------------------------------------------------------------------------------------------- */

describe.each(TEXTOS)("traducirErrorCotizacion · COT:%s", (codigo, texto) => {
  it("devuelve el texto aprobado para un Error", () => {
    expect(traducirErrorCotizacion(new Error(`COT:${codigo}`))).toBe(texto);
  });

  it("devuelve el texto aprobado para un objeto estilo PostgREST (P0001)", () => {
    const error = { message: `COT:${codigo}`, code: "P0001", details: "detalle-sensible-1", hint: "pista-sensible-2" };
    expect(traducirErrorCotizacion(error)).toBe(texto);
  });

  it("un COT: conocido gana aunque el SQLSTATE sea 42501", () => {
    const error = { message: `COT:${codigo}`, code: "42501", details: null, hint: null };
    expect(traducirErrorCotizacion(error)).toBe(texto);
  });
});

describe("traducirErrorCotizacion · COT:DETALLE_INVALIDO es un error interno", () => {
  // Decisión explícita: el detalle de un evento de auditoría que no cumple su esquema es un fallo
  // INTERNO. Su causa no se muestra a la persona, así que no tiene texto propio y cae en el genérico.
  it("devuelve el genérico, no un texto propio", () => {
    expect(traducirErrorCotizacion(new Error("COT:DETALLE_INVALIDO"))).toBe(GENERICO);
    expect(traducirErrorCotizacion({ message: "COT:DETALLE_INVALIDO", code: "P0001" })).toBe(GENERICO);
  });

  it("no deja pasar la causa que venga en details o hint", () => {
    const resultado = traducirErrorCotizacion({
      message: "COT:DETALLE_INVALIDO",
      code: "P0001",
      details: "el campo secreto-xyz no cumple el esquema",
      hint: "pista-interna-123",
    });
    expect(resultado).toBe(GENERICO);
    expect(resultado).not.toContain("secreto-xyz");
    expect(resultado).not.toContain("pista-interna-123");
    expect(resultado).not.toContain("esquema");
  });
});

describe("traducirErrorCotizacion · la tabla tiene exactamente los 8 códigos de F1", () => {
  // Códigos que el contrato (rpc-cotizaciones.md) reserva para fases posteriores: en F1 no tienen texto propio y
  // caen en el genérico. Cuando una fase añada el texto de uno, se pasa a TEXTOS y se quita de esta lista.
  const DE_OTRAS_FASES = [
    "ORIGEN_INVALIDO",
    "NO_EMITIBLE",
    "ORIGEN_NO_ELEGIBLE",
    "NO_REVISABLE",
    "REVISION_EN_CURSO",
    "HISTORIAL_ACEPTACION",
    "NADA_QUE_CONFIRMAR",
    "ACCION_INVALIDA",
    "LINEA_NO_CATALOGO",
    "ELEMENTO_RETIRADO",
  ];

  it.each(DE_OTRAS_FASES)("COT:%s no tiene texto propio: devuelve el genérico", (codigo) => {
    expect(traducirErrorCotizacion(new Error(`COT:${codigo}`))).toBe(GENERICO);
    expect(traducirErrorCotizacion({ message: `COT:${codigo}`, code: "P0001", details: null, hint: null })).toBe(GENERICO);
    expect(new ErrorCotizacion(hostil<CodigoErrorCotizacion>(codigo)).message).toBe(GENERICO);
  });
});

describe("traducirErrorCotizacion · mensajes que no son exactamente un COT: conocido", () => {
  const NO_RECONOCIDOS = [
    "COT:CODIGO_INEXISTENTE",
    "COT:sin_permiso",
    "cot:SIN_PERMISO",
    " COT:SIN_PERMISO",
    "COT:SIN_PERMISO ",
    "COT:SIN_PERMISO: extra",
    "Error: COT:SIN_PERMISO",
    "COT:",
    "COT:SIN_PERMISO\n",
    "\nCOT:SIN_PERMISO",
    "COT:SIN_PERMISO.",
    "COT: SIN_PERMISO",
    "COT:SIN_PERMISO COT:NO_ENCONTRADA",
    "SIN_PERMISO",
    "",
  ];

  it.each(NO_RECONOCIDOS)("«%s» como Error devuelve el genérico", (mensaje) => {
    expect(traducirErrorCotizacion(new Error(mensaje))).toBe(GENERICO);
  });

  it.each(NO_RECONOCIDOS)("«%s» como objeto PostgREST devuelve el genérico", (mensaje) => {
    expect(traducirErrorCotizacion({ message: mensaje, code: "P0001", details: null, hint: null })).toBe(GENERICO);
  });

  it("un message que no es una cadena no se reconoce (objeto String, número)", () => {
    expect(traducirErrorCotizacion({ message: new String("COT:SIN_PERMISO") })).toBe(GENERICO);
    expect(traducirErrorCotizacion({ message: 123 })).toBe(GENERICO);
    expect(traducirErrorCotizacion({ message: ["COT:SIN_PERMISO"] })).toBe(GENERICO);
  });

  it("un arreglo con propiedad message igual a un código no se reconoce", () => {
    expect(traducirErrorCotizacion(Object.assign(["x"], { message: "COT:SIN_PERMISO" }))).toBe(GENERICO);
  });

  it("un objeto que imita una ErrorCotizacion (mismo name y message libre) no se reconoce", () => {
    const imitacion = { name: "ErrorCotizacion", codigo: "SIN_PERMISO", message: "texto libre del atacante" };
    expect(traducirErrorCotizacion(imitacion)).toBe(GENERICO);
  });
});

const CLAVES_DE_PROTOTIPO = ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"];

describe("traducirErrorCotizacion · inmunidad a prototipo", () => {
  it.each(CLAVES_DE_PROTOTIPO)("COT:%s devuelve el genérico (Error y objeto)", (clave) => {
    expect(traducirErrorCotizacion(new Error(`COT:${clave}`))).toBe(GENERICO);
    expect(traducirErrorCotizacion({ message: `COT:${clave}`, code: "P0001" })).toBe(GENERICO);
  });

  it.each([...CLAVES_DE_PROTOTIPO, "DETALLE_INVALIDO"])(
    "una ErrorCotizacion construida con el código «%s» usa el genérico",
    (clave) => {
      const error = new ErrorCotizacion(hostil<CodigoErrorCotizacion>(clave));
      expect(error.message).toBe(GENERICO);
      expect(traducirErrorCotizacion(error)).toBe(GENERICO);
    },
  );
});

describe("inmunidad a prototipo · errores que llegan de Supabase", () => {
  // Con o sin el prefijo `COT:`: ni `COT:constructor` ni `constructor` resuelven contra el prototipo, y el
  // código que sale es el propio DESCONOCIDO (una cadena), nunca un valor del prototipo.
  const MENSAJES = CLAVES_DE_PROTOTIPO.flatMap((clave) => [`COT:${clave}`, clave]);

  it.each(MENSAJES)("listarCotizaciones: un error con message «%s» sale como DESCONOCIDO", async (mensaje) => {
    programar(falla({ message: mensaje, code: "P0001" }));
    const error = await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
    expect(typeof error.codigo).toBe("string");
  });

  it.each(MENSAJES)("obtenerCotizacion: un error con message «%s» sale como DESCONOCIDO", async (mensaje) => {
    programar(falla({ message: mensaje, code: "P0001" }));
    const error = await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
    expect(typeof error.codigo).toBe("string");
  });
});

describe("traducirErrorCotizacion · errores crudos y valores raros", () => {
  it.each(HOSTILES)("%s devuelve exactamente el genérico y no lanza", (_nombre, error) => {
    let resultado = "";
    expect(() => {
      resultado = traducirErrorCotizacion(error);
    }).not.toThrow();
    expect(resultado).toBe(MENSAJE_ERROR_GENERICO);
    for (const fragmento of SENSIBLES) expect(resultado).not.toContain(fragmento);
  });

  it("una cadena suelta no es un error reconocido, aunque sea COT:SIN_PERMISO", () => {
    expect(traducirErrorCotizacion("COT:SIN_PERMISO")).toBe(GENERICO);
  });
});

describe("traducirErrorCotizacion · ErrorCotizacion", () => {
  it.each(TEXTOS)("COT:%s devuelve su propio message", (codigo, texto) => {
    const error = new ErrorCotizacion(codigo);
    expect(traducirErrorCotizacion(error)).toBe(error.message);
    expect(traducirErrorCotizacion(error)).toBe(texto);
  });

  it.each<CodigoErrorCotizacion>(["DESCONOCIDO", "DATOS_INVALIDOS", "PARAMETROS_INVALIDOS"])(
    "%s devuelve el genérico",
    (codigo) => {
      expect(traducirErrorCotizacion(new ErrorCotizacion(codigo))).toBe(GENERICO);
    },
  );
});

/* ------------------------------------------------------------------------------------------------
 * ErrorCotizacion
 * ---------------------------------------------------------------------------------------------- */

describe("ErrorCotizacion", () => {
  it.each(TEXTOS)("COT:%s: instancia, nombre, código y texto aprobado", (codigo, texto) => {
    const error = new ErrorCotizacion(codigo);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ErrorCotizacion);
    expect(error.name).toBe("ErrorCotizacion");
    expect(error.codigo).toBe(codigo);
    expect(error.message).toBe(texto);
  });

  it.each<CodigoErrorCotizacion>(["DESCONOCIDO", "DATOS_INVALIDOS", "PARAMETROS_INVALIDOS"])(
    "%s: instancia, nombre, código y mensaje genérico",
    (codigo) => {
      const error = new ErrorCotizacion(codigo);
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ErrorCotizacion);
      expect(error.name).toBe("ErrorCotizacion");
      expect(error.codigo).toBe(codigo);
      expect(error.message).toBe(GENERICO);
    },
  );

  it("no guarda ninguna causa ni dato del error original: solo el código (y el nombre)", () => {
    const error = new ErrorCotizacion("SIN_PERMISO");
    expect("cause" in error).toBe(false);
    // `name` es una propiedad propia enumerable (se asigna en el constructor); no hay nada más.
    expect(Object.keys(error).sort()).toEqual(["codigo", "name"]);
    expect(Object.getOwnPropertyNames(error).filter((nombre) => nombre !== "stack").sort()).toEqual([
      "codigo",
      "message",
      "name",
    ]);
    expect(JSON.parse(JSON.stringify(error))).toEqual({ codigo: "SIN_PERMISO", name: "ErrorCotizacion" });
  });

  it("String(error) y la traza solo contienen el texto aprobado", () => {
    const error = new ErrorCotizacion("SIN_PERMISO");
    expect(String(error)).toBe("ErrorCotizacion: No tienes permiso para realizar esta acción.");
    expect(error.stack).toContain("No tienes permiso para realizar esta acción.");
  });
});

/* ------------------------------------------------------------------------------------------------
 * Esquema estricto de filas (compartido por obtenerCotizacion y listarCotizaciones)
 * ---------------------------------------------------------------------------------------------- */

/**
 * Reescribe los dígitos ASCII de `texto` con los de otro bloque Unicode (`cero` es el punto de código
 * del «0» de ese bloque). Se construye con `String.fromCharCode` y no con literales para que ninguna
 * herramienta normalice los caracteres.
 */
function conDigitos(texto: string, cero: number): string {
  return texto.replace(/[0-9]/g, (digito) => String.fromCharCode(cero + Number(digito)));
}

const ANCHURA_COMPLETA = 0xff10; // ０１２…９
const ARABIGO_INDICO = 0x0660; // ٠١٢…٩
const SIGNO_MENOS_UNICODE = String.fromCharCode(0x2212); // −

const FECHAS_INVALIDAS = [
  "ayer",
  "2026-11-10T12:00:00",
  "2026-11-10 12:00:00+00:00",
  "2026-02-30T10:00:00Z",
  "2026-13-01T10:00:00Z",
  "2026-00-10T10:00:00Z",
  "2026-11-00T10:00:00Z",
  "2026-11-10T24:00:00Z",
  "2026-11-10T10:60:00Z",
  "2026-11-10T10:00:60Z",
  "2026-11-10T12:00:00+25:00",
  "2026-11-10T12:00:00+00:60",
  "2026-11-10T12:00:00+99:99",
  "2026-04-31T10:00:00Z",
  "2026-06-31T10:00:00Z",
  "2026-09-31T10:00:00Z",
  "2026-11-31T10:00:00Z",
  "2026-01-32T10:00:00Z",
  "2025-02-29T00:00:00Z",
  "2100-02-29T00:00:00Z",
  // Desfase fuera de rango, con y sin dos puntos, y con el signo contrario.
  "2026-11-10T12:00:00+24:00",
  "2026-11-10T12:00:00-24:00",
  "2026-11-10T12:00:00-25:00",
  "2026-11-10T12:00:00+0060",
  "2026-11-10T12:00:00-0060",
  "2026-11-10T12:00:00+2400",
  "2026-11-10T12:00:00-2400",
  "2026-11-10T12:00:00+2500",
  "2026-11-10T12:00:00+9999",
  "2026-11-10T12:00:00+23:60",
  "2026-11-10T12:00:00+2360",
  // Desfase con otra forma: segundos, solo horas, de una cifra, mal separado, repetido.
  "2026-11-10T12:00:00+05:30:15",
  "2026-11-10T12:00:00+00",
  "2026-11-10T12:00:00-06",
  "2026-11-10T12:00:00+0",
  "2026-11-10T12:00:00+000",
  "2026-11-10T12:00:00+00:0",
  "2026-11-10T12:00:00+0:00",
  "2026-11-10T12:00:00+00:00:",
  "2026-11-10T12:00:00+00:00+00:00",
  "2026-11-10T12:00:00+",
  "2026-11-10T12:00:00 +00:00",
  `2026-11-10T12:00:00${SIGNO_MENOS_UNICODE}06:00`,
  // Hora, minuto, segundo, mes y día fuera de rango, también con desfase explícito.
  "2026-11-10T24:00:00+00:00",
  "2026-11-10T24:00:00",
  "2026-11-10T25:00:00Z",
  "2026-11-10T99:00:00Z",
  "2026-11-10T12:60:00+00:00",
  "2026-11-10T12:99:00Z",
  "2026-11-10T12:00:60+00:00",
  "2026-11-10T12:00:99Z",
  "2026-11-10T23:59:60Z",
  "2026-13-10T12:00:00Z",
  "2026-99-10T12:00:00Z",
  "2026-11-00T12:00:00+00:00",
  "2026-11-99T12:00:00Z",
  "2026-02-30T10:00:00+00:00",
  "2026-02-29T10:00:00+00:00",
  "2024-02-30T10:00:00Z",
  "2024-02-30T00:00:00+00:00",
  // Sin zona, texto libre y formas que no son la ISO que emite PostgREST.
  "2026-11-10T12:00:00.123456",
  "2026-11-10",
  "2026-11-10T12:00Z",
  "2026-11-10T12:00:00 ",
  "",
  " ",
  "no es una fecha",
  "Tue Nov 10 2026 12:00:00 GMT+0000",
  "26-11-10T12:00:00Z",
  "2026-1-10T12:00:00Z",
  "2026-11-1T12:00:00Z",
  "2026-11-10T1:00:00Z",
  // Una cifra de más o de menos en cada campo.
  "12026-11-10T12:00:00Z",
  "02026-11-10T12:00:00Z",
  "226-11-10T12:00:00Z",
  "2026-011-10T12:00:00Z",
  "2026-11-010T12:00:00Z",
  "2026-11-10T012:00:00Z",
  "2026-11-10T12:000:00Z",
  "2026-11-10T12:00:000Z",
  "2026-11-10t12:00:00Z",
  "2026-11-10T12:00:00z",
  "2026-11-10T12:00:00ZZ",
  "2026-11-10T12:00:00Z\n",
  "2026-11-10T12:00:00Z ",
  " 2026-11-10T12:00:00Z",
  "\n2026-11-10T12:00:00Z",
  "+002026-11-10T12:00:00Z",
  // Decimales: 10 es demasiado, y un punto sin dígitos o con una letra no es una fracción.
  "2026-11-10T12:00:00.1234567890Z",
  "2026-11-10T12:00:00.12345678901234Z",
  "2026-11-10T12:00:00.Z",
  "2026-11-10T12:00:00.1aZ",
  "2026-11-10T12:00:00,123Z",
  // Dígitos que no son ASCII (anchura completa y arábigo-índicos), en toda la fecha o en una parte.
  conDigitos("2026-11-10T12:00:00Z", ANCHURA_COMPLETA),
  conDigitos("2026-11-10T12:00:00+00:00", ANCHURA_COMPLETA),
  `${conDigitos("2026", ANCHURA_COMPLETA)}-11-10T12:00:00Z`,
  `2026-11-10T12:00:00+${conDigitos("0000", ANCHURA_COMPLETA)}`,
  conDigitos("2026-11-10T12:00:00Z", ARABIGO_INDICO),
  conDigitos("2026-11-10T12:00:00+00:00", ARABIGO_INDICO),
  `2026-11-10T12:00:00+${conDigitos("00:00", ARABIGO_INDICO)}`,
  `2026-11-10T12:00:00.${conDigitos("123", ARABIGO_INDICO)}Z`,
];

const FECHAS_VALIDAS = [
  "2026-11-10T12:00:00.123456+00:00",
  "2026-11-10T12:00:00Z",
  "2024-02-29T00:00:00+00:00",
  "2000-02-29T00:00:00+00:00",
  "2026-11-10T23:59:59-06:00",
  "2026-11-10T12:00:00+05:30",
  "2026-02-28T00:00:00Z",
  "2026-01-31T00:00:00Z",
  "2026-04-30T00:00:00Z",
  "2026-06-30T00:00:00Z",
  "2026-09-30T00:00:00Z",
  "2026-11-30T00:00:00Z",
  "2026-12-31T23:59:59Z",
  // Todas las formas de desfase: `Z`, `±hh:mm` y `±hhmm`, en sus extremos.
  "2026-11-10T12:00:00+00:00",
  "2026-11-10T12:00:00-06:00",
  "2026-11-10T12:00:00+0000",
  "2026-11-10T12:00:00+0530",
  "2026-11-10T12:00:00-0600",
  "2026-11-10T12:00:00-2359",
  "2026-11-10T12:00:00+2359",
  "2026-11-10T12:00:00+23:59",
  "2026-11-10T12:00:00-23:59",
  "2026-11-10T12:00:00+23:00",
  "2026-11-10T12:00:00+00:59",
  // Extremos de hora, minuto y segundo, y el bisiesto.
  "2026-11-10T00:00:00Z",
  "2026-11-10T23:59:59Z",
  "2024-02-29T23:59:59.999999999+23:59",
  "2024-02-29T12:00:00Z",
  "2026-01-01T00:00:00Z",
  "2026-12-31T00:00:00Z",
  // De 1 a 9 decimales.
  ...["1", "12", "123", "1234", "12345", "123456", "1234567", "12345678", "123456789"].map(
    (decimales) => `2026-11-10T12:00:00.${decimales}Z`,
  ),
  "2026-11-10T12:00:00.123456789+05:30",
  "2026-11-10T12:00:00.0-0600",
];

function violacionesDeFecha(campos: string[]): Array<[string, Fila]> {
  return campos.flatMap((campo) =>
    FECHAS_INVALIDAS.map((valor): [string, Fila] => [`${campo} «${valor}»`, { [campo]: valor }]),
  );
}

function violacionesDeNulo(campos: string[]): Array<[string, Fila]> {
  return campos.map((campo): [string, Fila] => [`${campo} nulo`, { [campo]: null }]);
}

// Dígitos que NO son `[0-9]`: se construyen con códigos para que ninguna herramienta los normalice.
const DIGITO_ANCHO_COMPLETO = String.fromCharCode(0xff11);
const DIGITO_ARABIGO_INDICO = String.fromCharCode(0x0661);

/** Violaciones que valen para el listado (`CotizacionResumen`) y para el detalle (`Cotizacion`). */
const VIOLACIONES_COMUNES: Array<[string, Fila]> = [
  ["estado desconocido «vencida»", { estado: "vencida" }],
  ["estado «sustituida» (no es un estado)", { estado: "sustituida" }],
  ["estado «archivada» (no es un estado)", { estado: "archivada" }],
  ["estado numérico", { estado: 1 }],
  ["estado «__proto__»", { estado: "__proto__" }],
  ["estado «BORRADOR» en mayúsculas", { estado: "BORRADOR" }],
  ["estado con un espacio «borrador »", { estado: "borrador " }],
  ["referencia «BOR-»", { referencia_interna: "BOR-" }],
  ["referencia «bor-1» en minúsculas", { referencia_interna: "bor-1" }],
  ["referencia «COT-2026-0001» (número de cotización)", { referencia_interna: "COT-2026-0001" }],
  ["referencia «BOR-1x»", { referencia_interna: "BOR-1x" }],
  ["referencia con un prefijo delante «XBOR-1»", { referencia_interna: "XBOR-1" }],
  ["referencia con un espacio delante « BOR-1»", { referencia_interna: " BOR-1" }],
  ["referencia con salto de línea final", { referencia_interna: "BOR-1\n" }],
  ["referencia con un espacio al final «BOR-1 »", { referencia_interna: "BOR-1 " }],
  ["referencia con un salto de línea delante", { referencia_interna: "\nBOR-1" }],
  ["referencia con un salto de línea CRLF al final", { referencia_interna: "BOR-1\r\n" }],
  ["referencia con un espacio entre el guion y los dígitos «BOR- 1»", { referencia_interna: "BOR- 1" }],
  ["referencia con signo menos «BOR--1»", { referencia_interna: "BOR--1" }],
  ["referencia con signo más «BOR-+1»", { referencia_interna: "BOR-+1" }],
  ["referencia con decimales «BOR-1.5»", { referencia_interna: "BOR-1.5" }],
  ["referencia con un dígito de ancho completo (U+FF11)", { referencia_interna: `BOR-${DIGITO_ANCHO_COMPLETO}` }],
  ["referencia con un dígito arábigo-índico (U+0661)", { referencia_interna: `BOR-${DIGITO_ARABIGO_INDICO}` }],
  // La base genera `'BOR-' || nextval(...)` sobre una secuencia `bigint`: como máximo 19 dígitos.
  ["referencia de 20 dígitos (uno más que los 19 de un bigint)", { referencia_interna: `BOR-${"1".repeat(20)}` }],
  ["referencia de 20 nueves", { referencia_interna: `BOR-${"9".repeat(20)}` }],
  ["referencia de 10 000 dígitos (longitud arbitraria)", { referencia_interna: `BOR-${"9".repeat(10000)}` }],
  ["referencia numérica", { referencia_interna: 1 }],
  ["row_version 0", { row_version: 0 }],
  ["row_version -1", { row_version: -1 }],
  ["row_version 1.5", { row_version: 1.5 }],
  ["row_version «1» (cadena)", { row_version: "1" }],
  ["row_version NaN", { row_version: Number.NaN }],
  ["row_version Infinity", { row_version: Number.POSITIVE_INFINITY }],
  ["row_version MAX_SAFE_INTEGER + 1", { row_version: Number.MAX_SAFE_INTEGER + 1 }],
  ["id que no es un UUID", { id: "xyz" }],
  ["id numérico", { id: 1 }],
  ["prospecto_nombre de 201 caracteres", { prospecto_nombre: "n".repeat(201) }],
  ["prospecto_nombre de 201 emoji", { prospecto_nombre: EMOJI.repeat(201) }],
  ["prospecto_nombre de 100 emoji y 101 letras (201 puntos de código)", { prospecto_nombre: EMOJI.repeat(100) + "a".repeat(101) }],
  ["prospecto_nombre numérico", { prospecto_nombre: 123 }],
  // Un arreglo de un solo elemento se coacciona al texto de ese elemento (`String(["x"])` es `"x"`): ningún
  // campo de texto debe aceptar un arreglo aunque su contenido sea un valor válido.
  ["estado que es un arreglo con un estado válido", { estado: ["borrador"] }],
  ["referencia que es un arreglo con una referencia válida", { referencia_interna: ["BOR-1"] }],
  ["prospecto_nombre que es un arreglo con un texto válido", { prospecto_nombre: ["x"] }],
  ["creado_at que es un arreglo con una fecha válida", { creado_at: ["2026-11-10T12:00:00Z"] }],
  ...violacionesDeNulo(["id", "referencia_interna", "estado", "creado_at", "row_version"]),
  ...violacionesDeFecha(["creado_at"]),
];

/** Violaciones de las columnas que solo trae el detalle. */
const VIOLACIONES_SOLO_DETALLE: Array<[string, Fila]> = [
  ["creado_por que no es un UUID", { creado_por: "xyz" }],
  ["creado_por nulo", { creado_por: null }],
  ["actualizado_por que no es un UUID", { actualizado_por: "xyz" }],
  ["prospecto_contacto de 201 caracteres", { prospecto_contacto: "c".repeat(201) }],
  ["prospecto_contacto numérico", { prospecto_contacto: 123 }],
  ["prospecto_email de 255 caracteres", { prospecto_email: "e".repeat(255) }],
  ["prospecto_email numérico", { prospecto_email: 123 }],
  ["prospecto_telefono de 41 caracteres", { prospecto_telefono: "1".repeat(41) }],
  ["prospecto_telefono numérico", { prospecto_telefono: 123 }],
  ["prospecto_contacto de 201 emoji", { prospecto_contacto: EMOJI.repeat(201) }],
  ["prospecto_contacto que es un arreglo con un texto válido", { prospecto_contacto: ["x"] }],
  ["prospecto_email que es un arreglo con un texto válido", { prospecto_email: ["x"] }],
  ["prospecto_telefono que es un arreglo con un texto válido", { prospecto_telefono: ["1"] }],
  ["actualizado_at que es un arreglo con una fecha válida", { actualizado_at: ["2026-11-10T12:00:00Z"] }],
  ...violacionesDeNulo(["actualizado_at"]),
  ...violacionesDeFecha(["actualizado_at"]),
];

/** Variantes válidas que el esquema debe aceptar. */
const VARIANTES_VALIDAS_COMUNES: Array<[string, Fila]> = [
  ...ESTADOS_COTIZACION.map((estado): [string, Fila] => [`estado «${estado}»`, { estado }]),
  ["prospecto_nombre nulo", { prospecto_nombre: null }],
  ["prospecto_nombre de 200 caracteres", { prospecto_nombre: "n".repeat(200) }],
  ["prospecto_nombre de 200 emoji (400 unidades UTF-16)", { prospecto_nombre: EMOJI.repeat(200) }],
  ["prospecto_nombre de 100 emoji y 100 letras (200 puntos de código)", { prospecto_nombre: EMOJI.repeat(100) + "a".repeat(100) }],
  ["referencia de 1 dígito «BOR-1»", { referencia_interna: "BOR-1" }],
  ["referencia «BOR-12345»", { referencia_interna: "BOR-12345" }],
  ["referencia de 18 dígitos", { referencia_interna: `BOR-${"1".repeat(18)}` }],
  // El máximo de una secuencia `bigint` y el tope de la regex: 19 dígitos.
  ["referencia de 19 dígitos, el máximo de bigint «BOR-9223372036854775807»", { referencia_interna: "BOR-9223372036854775807" }],
  ["referencia de 19 nueves", { referencia_interna: `BOR-${"9".repeat(19)}` }],
  ["row_version 1", { row_version: 1 }],
  ["row_version MAX_SAFE_INTEGER", { row_version: Number.MAX_SAFE_INTEGER }],
  ...FECHAS_VALIDAS.map((valor): [string, Fila] => [`creado_at «${valor}»`, { creado_at: valor }]),
];

const VARIANTES_VALIDAS_SOLO_DETALLE: Array<[string, Fila]> = [
  ["actualizado_por nulo", { actualizado_por: null }],
  ["actualizado_por en MAYÚSCULAS", { actualizado_por: OTRO_USUARIO.toUpperCase() }],
  ["prospecto_contacto nulo", { prospecto_contacto: null }],
  ["prospecto_email nulo", { prospecto_email: null }],
  ["prospecto_telefono nulo", { prospecto_telefono: null }],
  ["prospecto_contacto de 200 caracteres", { prospecto_contacto: "c".repeat(200) }],
  ["prospecto_contacto de 200 emoji", { prospecto_contacto: EMOJI.repeat(200) }],
  ["prospecto_email de 254 caracteres", { prospecto_email: "e".repeat(254) }],
  ["prospecto_telefono de 40 caracteres", { prospecto_telefono: "1".repeat(40) }],
  ...FECHAS_VALIDAS.map((valor): [string, Fila] => [`actualizado_at «${valor}»`, { actualizado_at: valor }]),
];

/* ------------------------------------------------------------------------------------------------
 * obtenerCotizacion
 * ---------------------------------------------------------------------------------------------- */

describe("obtenerCotizacion · el id se valida antes de consultar", () => {
  it.each([["xyz"], ["catalogo"], [""], [`${ID_A}\n`], [` ${ID_A}`], [`urn:uuid:${ID_A}`]])(
    "obtenerCotizacion(%j) devuelve null y no llama a Supabase",
    async (id) => {
      await expect(obtenerCotizacion(id)).resolves.toBeNull();
      expect(from).not.toHaveBeenCalled();
      expect(llamadas).toEqual([]);
    },
  );

  const NO_CADENAS: Array<[string, unknown]> = [
    ["null", null],
    ["undefined", undefined],
    ["un número", 123],
    ["true", true],
    ["un objeto", {}],
    ["un arreglo", []],
    ["un arreglo con un UUID válido", [ID_A]],
    ["un objeto String con un UUID válido", new String(ID_A)],
    ["un objeto cuyo toString devuelve un UUID", { toString: () => ID_A }],
  ];

  it.each(NO_CADENAS)("un id que es %s devuelve null y no llama a Supabase", async (_nombre, id) => {
    await expect(obtenerCotizacion(hostil<string>(id))).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

describe("obtenerCotizacion · la consulta", () => {
  it("con un UUID válido llama a from, select, eq y maybeSingle, en ese orden y con esos argumentos", async () => {
    programar(responde(null));
    await obtenerCotizacion(ID_A);
    expect(from).toHaveBeenCalledTimes(1);
    expect(llamadas).toStrictEqual([
      { metodo: "from", args: ["cotizaciones"] },
      { metodo: "select", args: [COLUMNAS_COTIZACION] },
      { metodo: "eq", args: ["id", ID_A] },
      { metodo: "maybeSingle", args: [] },
    ]);
  });

  it("pasa el id tal como lo recibió (sin cambiar mayúsculas) y nunca pide «*»", async () => {
    programar(responde(null));
    await obtenerCotizacion(ID_A.toUpperCase());
    const select = llamadas.find((llamada) => llamada.metodo === "select");
    expect(select?.args).toStrictEqual([COLUMNAS_COTIZACION]);
    expect(select?.args[0]).not.toContain("*");
    expect(llamadas.find((llamada) => llamada.metodo === "eq")?.args).toStrictEqual(["id", ID_A.toUpperCase()]);
  });
});

describe("obtenerCotizacion · respuesta válida", () => {
  it("devuelve la Cotizacion con los 12 campos y sin claves extra", async () => {
    programar(responde(conExtras(fila())));
    const resultado = await obtenerCotizacion(ID_A);
    expect(resultado).toStrictEqual(COTIZACION);
    expect(Object.keys(resultado ?? {}).sort()).toEqual(CLAVES_COTIZACION);
    expect(resultado).not.toHaveProperty("secreto");
  });

  it("una fila con una clave __proto__ propia no contamina el resultado", async () => {
    // JSON.parse crea `__proto__` como propiedad propia; el spread la copia como propiedad propia también.
    const cruda: Fila = JSON.parse(`{"__proto__": {"polluted": true}, "secreto": "x"}`);
    const delServidor = { ...fila(), ...cruda };
    expect(Object.keys(delServidor)).toContain("__proto__");
    programar(responde(delServidor));
    const resultado = await obtenerCotizacion(ID_A);
    expect(Object.getPrototypeOf(resultado)).toBe(Object.prototype);
    expect(Object.keys(resultado ?? {}).sort()).toEqual(CLAVES_COTIZACION);
    expect(resultado).not.toHaveProperty("polluted");
  });

  it("data null (no hay fila, o RLS la oculta) devuelve null", async () => {
    programar(responde(null));
    await expect(obtenerCotizacion(ID_A)).resolves.toBeNull();
  });

  it.each([...VARIANTES_VALIDAS_COMUNES, ...VARIANTES_VALIDAS_SOLO_DETALLE])("acepta %s", async (_nombre, cambios) => {
    programar(responde(fila(cambios)));
    await expect(obtenerCotizacion(ID_A)).resolves.toStrictEqual({ ...COTIZACION, ...cambios });
  });
});

describe("obtenerCotizacion · el id devuelto debe ser el pedido", () => {
  it("una fila con otro id es DATOS_INVALIDOS, no «no encontrada»", async () => {
    programar(responde(fila({ id: ID_B })));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it("el mismo id en otra capitalización es válido (fila en MAYÚSCULAS, id pedido en minúsculas)", async () => {
    programar(responde(fila({ id: ID_A.toUpperCase() })));
    await expect(obtenerCotizacion(ID_A)).resolves.toStrictEqual({ ...COTIZACION, id: ID_A.toUpperCase() });
  });

  it("el mismo id en otra capitalización es válido (fila en minúsculas, id pedido en MAYÚSCULAS)", async () => {
    programar(responde(fila()));
    await expect(obtenerCotizacion(ID_A.toUpperCase())).resolves.toStrictEqual(COTIZACION);
  });
});

describe("obtenerCotizacion · esquema estricto de la fila", () => {
  it.each([...VIOLACIONES_COMUNES, ...VIOLACIONES_SOLO_DETALLE])("rechaza %s con DATOS_INVALIDOS", async (_nombre, cambios) => {
    programar(responde(fila(cambios)));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it.each(CLAVES_COTIZACION)("rechaza una fila a la que le falta la clave %s", async (clave) => {
    programar(responde(sin(clave)));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it.each<[string, unknown]>([
    ["undefined (sin datos)", undefined],
    ["un objeto vacío", {}],
    ["un arreglo con la fila dentro", [fila()]],
    ["un arreglo vacío", []],
    ["una cadena", "texto"],
    ["un número", 42],
    ["true", true],
  ])("data que es %s es DATOS_INVALIDOS", async (_nombre, data) => {
    programar(responde(data));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["una cadena", "texto"],
    ["un número", 42],
    ["un arreglo", []],
  ])("una respuesta que es %s (no un objeto) es DATOS_INVALIDOS", async (_nombre, respuesta) => {
    programar(resuelve(respuesta));
    await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
  });
});

describe("obtenerCotizacion · fallos de Supabase", () => {
  it.each(TEXTOS)("un error COT:%s sale como ErrorCotizacion con su código y texto aprobado", async (codigo, texto) => {
    programar(falla({ message: `COT:${codigo}`, code: "P0001", details: null, hint: null }));
    await esperarFallo(obtenerCotizacion(ID_A), codigo, texto);
  });

  it("COT:SIN_PERMISO rechaza con SIN_PERMISO y el texto aprobado", async () => {
    programar(falla({ message: "COT:SIN_PERMISO", code: "42501", details: null, hint: null }));
    const error = await esperarFallo(obtenerCotizacion(ID_A), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
    expect(error).toBeInstanceOf(ErrorCotizacion);
  });

  it("si hay error y también datos, manda el error", async () => {
    programar(resuelve({ data: fila(), error: { message: "COT:SIN_PERMISO" } }));
    await esperarFallo(obtenerCotizacion(ID_A), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
  });

  it("COT:DETALLE_INVALIDO se trata como error desconocido: código DESCONOCIDO y texto genérico", async () => {
    programar(falla({ message: "COT:DETALLE_INVALIDO", code: "P0001", details: "campo secreto-xyz", hint: null }));
    const error = await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un error SQL crudo es DESCONOCIDO, con el genérico y sin el texto de la base en ninguna parte", async () => {
    programar(falla(new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')));
    const error = await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un 42501 sin COT: es DESCONOCIDO, no SIN_PERMISO (RLS no devuelve error: devuelve 0 filas)", async () => {
    programar(
      falla({ message: "permission denied for table cotizaciones", code: "42501", details: "Failing row contains (…)", hint: "secreto-xyz" }),
    );
    const error = await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un rechazo de la promesa es DESCONOCIDO y no filtra el original", async () => {
    programar(rechaza(new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')));
    const error = await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un rechazo con COT:NO_ENCONTRADA conserva ese código", async () => {
    programar(rechaza({ message: "COT:NO_ENCONTRADA", code: "P0001" }));
    await esperarFallo(obtenerCotizacion(ID_A), "NO_ENCONTRADA", "Cotización no encontrada.");
  });

  it("una excepción síncrona de from() es DESCONOCIDO y no filtra el original", async () => {
    programar(lanza(new Error("INSERT INTO cotizaciones (prospecto_email) VALUES ($1)")));
    const error = await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un rechazo con una ErrorCotizacion la propaga tal cual", async () => {
    const original = new ErrorCotizacion("CONFLICTO_VERSION");
    programar(rechaza(original));
    await expect(fallo(obtenerCotizacion(ID_A))).resolves.toBe(original);
  });

  it.each<[string, unknown]>([
    ["0", 0],
    ["una cadena vacía", ""],
    ["false", false],
  ])("un error que es %s (falsy pero no nulo) sigue siendo un fallo", async (_nombre, error) => {
    programar(falla(error));
    await esperarFallo(obtenerCotizacion(ID_A), "DESCONOCIDO", GENERICO);
  });
});

/* ------------------------------------------------------------------------------------------------
 * listarCotizaciones
 * ---------------------------------------------------------------------------------------------- */

describe("listarCotizaciones · la consulta", () => {
  it("sin argumentos pide la primera página con el tamaño predeterminado, en este orden", async () => {
    programar(responde([]));
    await listarCotizaciones();
    expect(from).toHaveBeenCalledTimes(1);
    expect(llamadas).toStrictEqual([
      { metodo: "from", args: ["cotizaciones"] },
      { metodo: "select", args: ["id, referencia_interna, estado, prospecto_nombre, creado_at, row_version"] },
      { metodo: "order", args: ["creado_at", { ascending: false }] },
      { metodo: "order", args: ["id", { ascending: false }] },
      { metodo: "range", args: [0, 24] },
    ]);
  });

  it("nunca pide «*» ni columnas del detalle", async () => {
    programar(responde([]));
    await listarCotizaciones();
    const select = llamadas.find((llamada) => llamada.metodo === "select");
    expect(select?.args).toStrictEqual([COLUMNAS_RESUMEN]);
    expect(select?.args[0]).not.toContain("*");
    expect(select?.args[0]).not.toContain("prospecto_email");
  });

  it.each<[string, number, number, Parameters<typeof listarCotizaciones>[0]]>([
    ["{ pagina: 1, tamano: 10 }", 0, 9, { pagina: 1, tamano: 10 }],
    ["{ pagina: 3, tamano: 10 }", 20, 29, { pagina: 3, tamano: 10 }],
    ["{ pagina: 10000, tamano: 100 }", 999900, 999999, { pagina: 10000, tamano: 100 }],
    ["{ pagina: 1, tamano: 1 }", 0, 0, { pagina: 1, tamano: 1 }],
    ["{ pagina: 10000, tamano: 1 }", 9999, 9999, { pagina: 10000, tamano: 1 }],
    ["{ tamano: 100 } (página 1 por defecto)", 0, 99, { tamano: 100 }],
    ["{ pagina: 2 } (tamaño 25 por defecto)", 25, 49, { pagina: 2 }],
    ["{ pagina: undefined } (página 1 por defecto)", 0, 24, { pagina: undefined }],
    ["{ tamano: undefined } (tamaño 25 por defecto)", 0, 24, { tamano: undefined }],
    ["{} (valores por defecto)", 0, 24, {}],
    ["undefined (valores por defecto)", 0, 24, undefined],
  ])("%s pide range(%s, %s)", async (_nombre, desde, hasta, opciones) => {
    programar(responde([]));
    await listarCotizaciones(opciones);
    expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([desde, hasta]);
  });

  it("el orden de las llamadas es from, select, order, order, range", async () => {
    programar(responde([]));
    await listarCotizaciones({ pagina: 2, tamano: 5 });
    expect(llamadas.map((llamada) => llamada.metodo)).toStrictEqual(["from", "select", "order", "order", "range"]);
    expect(llamadas.filter((llamada) => llamada.metodo === "order").map((llamada) => llamada.args[0])).toStrictEqual([
      "creado_at",
      "id",
    ]);
  });
});

describe("listarCotizaciones · parámetros inválidos (no se llama a Supabase)", () => {
  const PAGINAS_INVALIDAS: Array<[string, unknown]> = [
    ["0", 0],
    ["-1", -1],
    ["1.5", 1.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["«1» (cadena)", "1"],
    ["null", null],
    ["10001 (supera PAGINA_MAXIMA)", 10001],
    ["true", true],
    ["[1]", [1]],
  ];

  const TAMANOS_INVALIDOS: Array<[string, unknown]> = [
    ["0", 0],
    ["-5", -5],
    ["101 (supera TAMANO_PAGINA_MAXIMO)", 101],
    ["2.5", 2.5],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["«10» (cadena)", "10"],
    ["null", null],
    ["true", true],
  ];

  const OPCIONES_INVALIDAS: Array<[string, unknown]> = [
    ["null", null],
    ["un arreglo vacío", []],
    ["la cadena «x»", "x"],
    ["el número 42", 42],
    ["true", true],
  ];

  it.each(PAGINAS_INVALIDAS)("pagina %s rechaza con PARAMETROS_INVALIDOS", async (_nombre, pagina) => {
    await esperarFallo(listarCotizaciones({ pagina: hostil<number>(pagina) }), "PARAMETROS_INVALIDOS", GENERICO);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(PAGINAS_INVALIDAS)("pagina %s rechaza aunque tamano sea válido", async (_nombre, pagina) => {
    await esperarFallo(listarCotizaciones({ pagina: hostil<number>(pagina), tamano: 10 }), "PARAMETROS_INVALIDOS", GENERICO);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(TAMANOS_INVALIDOS)("tamano %s rechaza con PARAMETROS_INVALIDOS", async (_nombre, tamano) => {
    await esperarFallo(listarCotizaciones({ tamano: hostil<number>(tamano) }), "PARAMETROS_INVALIDOS", GENERICO);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(TAMANOS_INVALIDOS)("tamano %s rechaza aunque pagina sea válida", async (_nombre, tamano) => {
    await esperarFallo(listarCotizaciones({ pagina: 1, tamano: hostil<number>(tamano) }), "PARAMETROS_INVALIDOS", GENERICO);
    expect(from).not.toHaveBeenCalled();
  });

  it.each(OPCIONES_INVALIDAS)("opciones igual a %s rechaza con PARAMETROS_INVALIDOS", async (_nombre, opciones) => {
    await esperarFallo(listarCotizaciones(hostil<undefined>(opciones)), "PARAMETROS_INVALIDOS", GENERICO);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("listarCotizaciones · respuesta válida", () => {
  it("una página vacía devuelve un arreglo vacío", async () => {
    programar(responde([]));
    await expect(listarCotizaciones()).resolves.toStrictEqual([]);
  });

  it("devuelve las filas en el mismo orden, sin claves extra", async () => {
    const filas = [resumen(3), resumen(1), resumen(2)];
    programar(responde(filas.map(conExtras)));
    const resultado = await listarCotizaciones();
    expect(resultado).toStrictEqual(filas);
    expect(resultado.map((item) => item.id)).toStrictEqual(filas.map((item) => item.id));
    for (const item of resultado) {
      expect(Object.keys(item).sort()).toEqual(CLAVES_RESUMEN);
      expect(item).not.toHaveProperty("prospecto_email");
      expect(item).not.toHaveProperty("secreto");
    }
  });

  it("devuelve objetos nuevos, no las filas del servidor", async () => {
    const cruda = conExtras(resumen(1));
    programar(responde([cruda]));
    const [item] = await listarCotizaciones();
    expect(item).not.toBe(cruda);
  });

  it.each([...VARIANTES_VALIDAS_COMUNES])("acepta una fila con %s", async (_nombre, cambios) => {
    const esperada = resumen(1, cambios);
    programar(responde([esperada]));
    await expect(listarCotizaciones()).resolves.toStrictEqual([esperada]);
  });

  it("acepta exactamente tamano filas", async () => {
    const filas = [resumen(1), resumen(2)];
    programar(responde(filas));
    await expect(listarCotizaciones({ tamano: 2 })).resolves.toStrictEqual(filas);
  });

  it("acepta 25 filas con el tamaño predeterminado", async () => {
    const filas = Array.from({ length: 25 }, (_, i) => resumen(i + 1));
    programar(responde(filas));
    await expect(listarCotizaciones()).resolves.toHaveLength(25);
  });
});

describe("listarCotizaciones · datos inválidos", () => {
  it.each<[string, unknown]>([
    ["null", null],
    ["undefined", undefined],
    ["un objeto", {}],
    ["un objeto con forma de arreglo", { length: 0 }],
    ["una cadena", "texto"],
    // Iterables vacíos que no son un arreglo: sin la comprobación `Array.isArray` se leerían como una página vacía.
    ["una cadena vacía", ""],
    ["un Set vacío", new Set()],
    ["un número", 42],
  ])("data que es %s es DATOS_INVALIDOS", async (_nombre, data) => {
    programar(responde(data));
    await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["null", null],
    ["una cadena", "texto"],
    ["un número", 42],
    ["un arreglo", []],
  ])("una respuesta que es %s (no un objeto) es DATOS_INVALIDOS", async (_nombre, respuesta) => {
    programar(resuelve(respuesta));
    await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  it("más filas que tamano es DATOS_INVALIDOS", async () => {
    programar(responde([resumen(1), resumen(2), resumen(3)]));
    await esperarFallo(listarCotizaciones({ tamano: 2 }), "DATOS_INVALIDOS", GENERICO);
  });

  it("26 filas con el tamaño predeterminado (25) es DATOS_INVALIDOS", async () => {
    programar(responde(Array.from({ length: 26 }, (_, i) => resumen(i + 1))));
    await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
  });

  describe("una sola fila inválida rechaza la página entera (nunca devuelve las válidas ni omite la mala)", () => {
    it.each<[string, number]>([
      ["la primera", 0],
      ["una intermedia", 2],
      ["la última", 4],
    ])("con estado desconocido en %s fila", async (_posicion, indice) => {
      const filas = [1, 2, 3, 4, 5].map((n, i) => (i === indice ? resumen(n, { estado: "vencida" }) : resumen(n)));
      programar(responde(filas));
      await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
    });

    it.each<[string, unknown]>([
      ["null", null],
      ["un arreglo", [resumen(9)]],
      ["una cadena", "texto"],
      ["un número", 7],
      ["undefined", undefined],
    ])("con una fila que es %s", async (_nombre, mala) => {
      programar(responde([resumen(1), mala, resumen(3)]));
      await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
    });

    it.each(["vencida", "sustituida", "archivada"])("con estado «%s» (no es un estado)", async (estado) => {
      programar(responde([resumen(1), resumen(2, { estado }), resumen(3)]));
      await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
    });

    it.each([...VIOLACIONES_COMUNES])("con una fila intermedia con %s", async (_nombre, cambios) => {
      programar(responde([resumen(1), resumen(2, cambios), resumen(3)]));
      await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
    });

    it.each(CLAVES_RESUMEN)("con una fila intermedia a la que le falta la clave %s", async (clave) => {
      const incompleta = resumen(2);
      delete incompleta[clave];
      programar(responde([resumen(1), incompleta, resumen(3)]));
      await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
    });
  });
});

/**
 * El tope de `tamano` no se comprueba solo una vez (`datos.length`): se vuelve a imponer en cada vuelta del
 * bucle. Un arreglo no genuino (un `Proxy` cuyo `length` cambia, o uno con `Symbol.iterator` propio) puede dar
 * más filas de las que declaró; entonces la página ENTERA es DATOS_INVALIDOS (nunca se trunca a `tamano` ni
 * se devuelve una parte) y el módulo deja de consumir en cuanto ve una fila de más.
 */
describe("listarCotizaciones · el tope de tamano también se impone dentro del bucle", () => {
  type Opciones = Parameters<typeof listarCotizaciones>[0];

  /** Filas de listado válidas y distintas, numeradas desde 1. */
  const filasValidas = (cantidad: number): Fila[] => Array.from({ length: cantidad }, (_, i) => resumen(i + 1));

  /**
   * Arreglo REAL (`Array.isArray` es verdadero) que declara `declarada` filas mientras no se itera y, en
   * cuanto el módulo empieza a recorrerlo (pide `Symbol.iterator` o un índice), pasa a decir la verdad:
   * `reales`. `leidos` cuenta los índices que se leyeron, es decir, cuántos elementos consumió el módulo.
   */
  function arregloQueCreceAlIterar(reales: number, declarada: number): { arreglo: Fila[]; leidos: () => number } {
    const base = filasValidas(reales);
    let iterando = false;
    let leidos = 0;
    const arreglo = new Proxy(base, {
      get(objetivo, clave, receptor): unknown {
        const esIndice = typeof clave === "string" && /^[0-9]+$/.test(clave);
        if (clave === Symbol.iterator || esIndice) iterando = true;
        if (esIndice) leidos += 1;
        if (clave === "length" && !iterando) return declarada;
        return Reflect.get(objetivo, clave, receptor);
      },
    });
    return { arreglo, leidos: () => leidos };
  }

  /** Arreglo vacío con un `Symbol.iterator` propio que entrega `entregar` filas válidas y se acaba. */
  function arregloConIteradorPropio(entregar: number): { arreglo: Fila[]; entregadas: () => number } {
    let entregadas = 0;
    const arreglo: Fila[] = [];
    Object.defineProperty(arreglo, Symbol.iterator, {
      value: function* (): Generator<Fila> {
        for (let n = 1; n <= entregar; n += 1) {
          entregadas = n;
          yield resumen(n);
        }
      },
    });
    return { arreglo, entregadas: () => entregadas };
  }

  // Si una regresión quitara el tope, un iterador sin fin colgaría la suite: este contador de seguridad lo
  // hace fallar rápido. Su excepción la convierte `validarRespuesta` en DATOS_INVALIDOS, así que lo que
  // detecta la regresión no es el rechazo sino `desbordado` y el número de elementos consumidos.
  const PASOS_DE_SEGURIDAD = 10000;

  /** Arreglo vacío cuyo `Symbol.iterator` da filas válidas sin fin (hasta el contador de seguridad). */
  function arregloConIteradorInfinito(): { arreglo: Fila[]; consumidas: () => number; desbordado: () => boolean } {
    let consumidas = 0;
    let desbordado = false;
    const arreglo: Fila[] = [];
    Object.defineProperty(arreglo, Symbol.iterator, {
      value: (): Iterator<Fila> => ({
        next(): IteratorResult<Fila> {
          if (consumidas >= PASOS_DE_SEGURIDAD) {
            desbordado = true;
            throw new Error("iterador sin fin consumido sin tope");
          }
          consumidas += 1;
          return { done: false, value: resumen(consumidas) };
        },
      }),
    });
    return { arreglo, consumidas: () => consumidas, desbordado: () => desbordado };
  }

  const TAMANOS: Array<[string, Opciones, number]> = [
    ["tamano 1", { tamano: 1 }, 1],
    ["tamano 25", { tamano: 25 }, 25],
    ["tamano 100 (el máximo)", { tamano: 100 }, 100],
    ["el tamano predeterminado (25)", undefined, 25],
  ];

  describe("un arreglo genuino", () => {
    it.each(TAMANOS)("de exactamente tamano filas válidas se acepta con %s y devuelve esas mismas filas", async (_nombre, opciones, tamano) => {
      const filas = filasValidas(tamano);
      programar(responde(filas));
      const resultado = await listarCotizaciones(opciones);
      expect(resultado).toHaveLength(tamano);
      expect(resultado).toStrictEqual(filas);
    });

    it.each(TAMANOS)("de tamano + 1 filas válidas lo rechaza entero la comprobación previa de longitud con %s (no se trunca a tamano)", async (_nombre, opciones, tamano) => {
      programar(responde(filasValidas(tamano + 1)));
      await esperarFalloSeguro(listarCotizaciones(opciones), "DATOS_INVALIDOS");
    });
  });

  describe("un Proxy de arreglo cuyo length cambia al iterarlo", () => {
    // `length` dice «tamano» (o menos) al comprobarlo y luego deja iterar más filas válidas de las debidas.
    const CRECE: Array<[string, Opciones, number, number, number]> = [
      ["declara 25 (tamano) y da 26", { tamano: 25 }, 25, 25, 26],
      ["declara 1 y da 26", { tamano: 25 }, 25, 1, 26],
      ["declara 0 y da 26", { tamano: 25 }, 25, 0, 26],
      ["declara 100 (tamano) y da 101", { tamano: 100 }, 100, 100, 101],
      ["declara 1 (tamano) y da 2", { tamano: 1 }, 1, 1, 2],
      ["declara 25 (tamano) y da 1000: deja de consumir en cuanto sobra una", { tamano: 25 }, 25, 25, 1000],
      ["declara 25 (el tamano predeterminado) y da 26", undefined, 25, 25, 26],
    ];

    it.each(CRECE)("%s: DATOS_INVALIDOS, no se devuelve ninguna parte y se consume como mucho tamano + 1", async (_nombre, opciones, tamano, declarada, reales) => {
      const { arreglo, leidos } = arregloQueCreceAlIterar(reales, declarada);
      expect(Array.isArray(arreglo)).toBe(true);
      programar(responde(arreglo));
      await esperarFalloSeguro(listarCotizaciones(opciones), "DATOS_INVALIDOS");
      expect(leidos()).toBeLessThanOrEqual(tamano + 1);
    });

    it.each(TAMANOS)("control: si declara tamano y da exactamente tamano se acepta con %s (las filas del ayudante son válidas)", async (_nombre, opciones, tamano) => {
      const { arreglo } = arregloQueCreceAlIterar(tamano, tamano);
      programar(responde(arreglo));
      const resultado = await listarCotizaciones(opciones);
      expect(resultado).toHaveLength(tamano);
      expect(resultado).toStrictEqual(filasValidas(tamano));
    });

    it("control: declara 0 y da 25 con tamano 25 se acepta (el tope es tamano, no lo que se declara)", async () => {
      const { arreglo } = arregloQueCreceAlIterar(25, 0);
      programar(responde(arreglo));
      await expect(listarCotizaciones({ tamano: 25 })).resolves.toStrictEqual(filasValidas(25));
    });
  });

  describe("un arreglo con Symbol.iterator propio", () => {
    it.each(TAMANOS)("que da exactamente tamano filas válidas se acepta con %s", async (_nombre, opciones, tamano) => {
      const { arreglo } = arregloConIteradorPropio(tamano);
      programar(responde(arreglo));
      const resultado = await listarCotizaciones(opciones);
      expect(resultado).toHaveLength(tamano);
      expect(resultado).toStrictEqual(filasValidas(tamano));
    });

    it.each(TAMANOS)("que da tamano + 1 filas válidas es DATOS_INVALIDOS con %s (no se trunca)", async (_nombre, opciones, tamano) => {
      const { arreglo, entregadas } = arregloConIteradorPropio(tamano + 1);
      programar(responde(arreglo));
      await esperarFalloSeguro(listarCotizaciones(opciones), "DATOS_INVALIDOS");
      expect(entregadas()).toBeLessThanOrEqual(tamano + 1);
    });

    it.each(TAMANOS)("que da muchas más filas válidas es DATOS_INVALIDOS con %s y no se consumen todas", async (_nombre, opciones, tamano) => {
      const { arreglo, entregadas } = arregloConIteradorPropio(tamano + 500);
      programar(responde(arreglo));
      await esperarFalloSeguro(listarCotizaciones(opciones), "DATOS_INVALIDOS");
      expect(entregadas()).toBeLessThanOrEqual(tamano + 1);
    });
  });

  describe("un iterador sin fin de filas válidas", () => {
    it.each(TAMANOS)("es DATOS_INVALIDOS con %s, no se cuelga y se consumen como mucho tamano + 1 elementos", async (_nombre, opciones, tamano) => {
      const { arreglo, consumidas, desbordado } = arregloConIteradorInfinito();
      programar(responde(arreglo));
      await esperarFalloSeguro(listarCotizaciones(opciones), "DATOS_INVALIDOS");
      expect(desbordado()).toBe(false);
      expect(consumidas()).toBeLessThanOrEqual(tamano + 1);
    });

    it("control: el contador de seguridad detecta un consumo sin tope (el iterador sin fin sí desborda si se le deja)", () => {
      const { arreglo, consumidas, desbordado } = arregloConIteradorInfinito();
      expect(() => {
        for (const _fila of arreglo) {
          // Se consume sin ningún tope.
        }
      }).toThrow("iterador sin fin consumido sin tope");
      expect(desbordado()).toBe(true);
      expect(consumidas()).toBe(PASOS_DE_SEGURIDAD);
    });
  });
});

describe("listarCotizaciones · fallos de Supabase", () => {
  it.each(TEXTOS)("un error COT:%s sale como ErrorCotizacion con su código y texto aprobado", async (codigo, texto) => {
    programar(falla({ message: `COT:${codigo}`, code: "P0001", details: null, hint: null }));
    await esperarFallo(listarCotizaciones(), codigo, texto);
  });

  it("COT:SIN_PERMISO rechaza con SIN_PERMISO y el texto aprobado", async () => {
    programar(falla({ message: "COT:SIN_PERMISO", code: "P0001", details: null, hint: null }));
    await esperarFallo(listarCotizaciones(), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
  });

  it("si hay error y también datos válidos, manda el error", async () => {
    programar(resuelve({ data: [resumen(1)], error: { message: "COT:SIN_PERMISO" } }));
    await esperarFallo(listarCotizaciones(), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
  });

  it("COT:DETALLE_INVALIDO se trata como error desconocido: código DESCONOCIDO y texto genérico", async () => {
    programar(falla({ message: "COT:DETALLE_INVALIDO", code: "P0001", details: "campo secreto-xyz", hint: null }));
    const error = await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un error SQL crudo es DESCONOCIDO, con el genérico y sin filtrar", async () => {
    programar(falla(new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')));
    const error = await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un 42501 sin COT: es DESCONOCIDO, no SIN_PERMISO, y no filtra", async () => {
    programar(
      falla({ message: "permission denied for table cotizaciones", code: "42501", details: "Failing row contains (…)", hint: "secreto-xyz" }),
    );
    const error = await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un rechazo de la promesa es DESCONOCIDO y no filtra el original", async () => {
    programar(rechaza(new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')));
    const error = await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un rechazo con COT:SIN_PERMISO conserva ese código", async () => {
    programar(rechaza({ message: "COT:SIN_PERMISO", code: "P0001" }));
    await esperarFallo(listarCotizaciones(), "SIN_PERMISO", "No tienes permiso para realizar esta acción.");
  });

  it("una excepción síncrona de from() es DESCONOCIDO y no filtra el original", async () => {
    programar(lanza(new Error("INSERT INTO cotizaciones (prospecto_email) VALUES ($1)")));
    const error = await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
    esperarSinSensibles(error);
  });

  it("un rechazo con una ErrorCotizacion la propaga tal cual", async () => {
    const original = new ErrorCotizacion("CONFLICTO_VERSION");
    programar(rechaza(original));
    await expect(fallo(listarCotizaciones())).resolves.toBe(original);
  });

  it.each<[string, unknown]>([
    ["0", 0],
    ["una cadena vacía", ""],
    ["false", false],
  ])("un error que es %s (falsy pero no nulo) sigue siendo un fallo", async (_nombre, error) => {
    programar(falla(error));
    await esperarFallo(listarCotizaciones(), "DESCONOCIDO", GENERICO);
  });
});

/* ------------------------------------------------------------------------------------------------
 * Garantías transversales: ningún error hostil se filtra por ninguna vía.
 * ---------------------------------------------------------------------------------------------- */

describe("garantías transversales · ningún texto del error original sale por la ErrorCotizacion", () => {
  const FUNCIONES: Array<[string, () => Promise<unknown>]> = [
    ["listarCotizaciones", () => listarCotizaciones()],
    ["obtenerCotizacion", () => obtenerCotizacion(ID_A)],
  ];

  // Un `error` null o undefined en la respuesta significa «sin error»: no es un caso hostil.
  const CANALES: Array<{ nombre: string; plan: (error: unknown) => Plan | null }> = [
    { nombre: "error en la respuesta", plan: (error) => (error === null || error === undefined ? null : falla(error)) },
    { nombre: "rechazo de la promesa", plan: rechaza },
    { nombre: "excepción síncrona de from()", plan: lanza },
  ];

  const CASOS = FUNCIONES.flatMap(([funcion, invocar]) =>
    HOSTILES.flatMap(([hostilNombre, valor]) =>
      CANALES.flatMap((canal) => {
        const plan = canal.plan(valor);
        return plan === null ? [] : [{ titulo: `${funcion} · ${hostilNombre} · ${canal.nombre}`, invocar, plan }];
      }),
    ),
  );

  it("el recorrido cubre las dos funciones, todos los errores hostiles y los tres canales", () => {
    // 2 funciones x (11 hostiles x 3 canales - 2 hostiles nulos sin canal de respuesta)
    expect(CASOS).toHaveLength(2 * (HOSTILES.length * 3 - 2));
  });

  it.each(CASOS)("$titulo", async ({ invocar, plan }) => {
    programar(plan);
    const error = await esperarFallo(invocar(), "DESCONOCIDO", MENSAJE_ERROR_GENERICO);
    esperarSinSensibles(error);
    // No guarda el original: ni `cause` ni ninguna otra propiedad propia además de las del propio error.
    expect("cause" in error).toBe(false);
    expect(Object.getOwnPropertyNames(error).filter((nombre) => nombre !== "stack").sort()).toEqual([
      "codigo",
      "message",
      "name",
    ]);
    expect(JSON.parse(JSON.stringify(error))).toEqual({ codigo: "DESCONOCIDO", name: "ErrorCotizacion" });
  });
});

/* ------------------------------------------------------------------------------------------------
 * Endurecimiento (ronda 2 de la revisión de seguridad)
 *
 * Todo fallo que sale de las dos funciones públicas es una `ErrorCotizacion` con un texto de la tabla
 * fija, también cuando el error, el rechazo o los datos son hostiles (getters que lanzan, `Proxy` con
 * trampas o revocados). El texto original lleva una MARCA única: si aparece en CUALQUIER superficie del
 * error (message, String, JSON, stack, propiedades propias recorridas a mano y con `util.inspect`), la
 * prueba falla.
 * ---------------------------------------------------------------------------------------------- */

const MARCA = "MARCA-SECRETA-7f3a";
// Datos personales 100 % sintéticos: no deben llegar a ninguna superficie del error ni a la consola.
const PII = { correo: "fila@example.test", telefono: "5550100", nombre: "Persona Ficticia" };
const PROHIBIDOS = [MARCA, PII.correo, PII.telefono, PII.nombre, ...SENSIBLES, "revoked", "Cannot perform"];

/** Copia de `base` con una propiedad cuyo getter lanza (por defecto, un Error que lleva la MARCA). */
function conGetterQueLanza(clave: string, base: Fila = {}, lanzado: () => unknown = () => new Error(`${MARCA} al leer ${clave}`)): Fila {
  return Object.defineProperty({ ...base }, clave, {
    enumerable: true,
    configurable: true,
    get(): never {
      throw lanzado();
    },
  });
}

/** Como `conGetterQueLanza` pero con varios getters que lanzan (no se puede copiar un objeto con getters que lanzan). */
function conGettersQueLanzan(claves: string[], base: Fila = {}): Fila {
  const objeto: Fila = { ...base };
  for (const clave of claves) {
    Object.defineProperty(objeto, clave, {
      enumerable: true,
      configurable: true,
      get(): never {
        throw new Error(`${MARCA} al leer ${clave}`);
      },
    });
  }
  return objeto;
}

function proxyConGetPrototypeOfQueLanza(): object {
  return new Proxy({}, {
    getPrototypeOf(): never {
      throw new Error(`${MARCA} en getPrototypeOf`);
    },
  });
}

function proxyConGetQueLanza(): object {
  return new Proxy({}, {
    get(): never {
      throw new Error(`${MARCA} en get`);
    },
  });
}

function proxyRevocado(): object {
  const { proxy, revoke } = Proxy.revocable({}, {});
  revoke();
  return proxy;
}

/** Recorre las propiedades propias (también las no enumerables y los símbolos) sin invocar ningún getter. */
function recorrerPropiedades(valor: unknown, vistos: Set<unknown> = new Set(), profundidad = 0): string[] {
  if (typeof valor === "string") return [valor];
  if (typeof valor === "number" || typeof valor === "boolean" || typeof valor === "bigint") return [String(valor)];
  if (typeof valor !== "object" || valor === null || vistos.has(valor) || profundidad > 4) return [];
  vistos.add(valor);
  const salida: string[] = [];
  for (const clave of Reflect.ownKeys(valor)) {
    salida.push(String(clave));
    const descriptor = Object.getOwnPropertyDescriptor(valor, clave);
    if (descriptor !== undefined && "value" in descriptor) {
      salida.push(...recorrerPropiedades(descriptor.value, vistos, profundidad + 1));
    }
  }
  return salida;
}

/** Todo lo que un registro, un boundary, una serialización o `util.inspect` podrían leer de un error. */
function superficieCompleta(error: Error): string {
  return [
    ...superficieDe(error),
    inspect(error, { showHidden: true, depth: 6 }),
    ...recorrerPropiedades(error),
  ].join("\n");
}

function textoAprobado(codigo: CodigoErrorCotizacion): string {
  return TEXTOS.find(([conocido]) => conocido === codigo)?.[1] ?? GENERICO;
}

function esperarErrorSeguro(error: ErrorCotizacion, codigo: CodigoErrorCotizacion): void {
  expect(error).toBeInstanceOf(ErrorCotizacion);
  expect(error.codigo).toBe(codigo);
  expect(error.message).toBe(textoAprobado(codigo));
  expect("cause" in error).toBe(false);
  expect(Object.getOwnPropertyNames(error).filter((nombre) => nombre !== "stack").sort()).toEqual([
    "codigo",
    "message",
    "name",
  ]);
  expect(Object.getOwnPropertySymbols(error)).toEqual([]);
  expect(JSON.parse(JSON.stringify(error))).toEqual({ codigo, name: "ErrorCotizacion" });
  const todo = superficieCompleta(error);
  for (const fragmento of PROHIBIDOS) expect(todo).not.toContain(fragmento);
}

/** Espera un rechazo con una `ErrorCotizacion` segura de ese código. */
async function esperarFalloSeguro(promesa: Promise<unknown>, codigo: CodigoErrorCotizacion): Promise<ErrorCotizacion> {
  const error = await fallo(promesa);
  esperarErrorSeguro(error, codigo);
  return error;
}

const AMBAS_FUNCIONES: Array<[string, () => Promise<unknown>]> = [
  ["listarCotizaciones", () => listarCotizaciones()],
  ["obtenerCotizacion", () => obtenerCotizacion(ID_A)],
];

describe("ayudantes del endurecimiento (controles: sin ellos las pruebas podrían pasar en vacío)", () => {
  const nuevo = (): ErrorCotizacion => new ErrorCotizacion("DESCONOCIDO");

  const FUGAS: Array<[string, () => Error]> = [
    ["la MARCA en el message", () => Object.assign(nuevo(), { message: MARCA })],
    ["la MARCA en una propiedad propia enumerable", () => Object.assign(nuevo(), { detalle: MARCA })],
    ["la MARCA en una propiedad propia no enumerable", () => Object.defineProperty(nuevo(), "oculta", { value: MARCA })],
    ["la MARCA en una causa", () => Object.defineProperty(nuevo(), "cause", { value: new Error(MARCA) })],
    ["la MARCA en la traza", () => Object.assign(nuevo(), { stack: `Error: ${MARCA}` })],
    ["la MARCA en una propiedad con símbolo", () => Object.defineProperty(nuevo(), Symbol("s"), { value: MARCA })],
    ["datos personales en una propiedad anidada", () => Object.assign(nuevo(), { fila: { correo: PII.correo } })],
  ];

  it.each(FUGAS)("la superficie detecta %s", (_nombre, crear) => {
    const error = crear();
    expect(superficieCompleta(error)).toMatch(new RegExp(`${MARCA}|${PII.correo}`));
  });

  it.each(FUGAS)("esperarErrorSeguro rechaza un error con %s", (_nombre, crear) => {
    expect(() => esperarErrorSeguro(hostil<ErrorCotizacion>(crear()), "DESCONOCIDO")).toThrow();
  });

  it("esperarErrorSeguro acepta una ErrorCotizacion limpia", () => {
    expect(() => esperarErrorSeguro(nuevo(), "DESCONOCIDO")).not.toThrow();
    expect(() => esperarErrorSeguro(new ErrorCotizacion("SIN_PERMISO"), "SIN_PERMISO")).not.toThrow();
  });

  it("los hostiles de las pruebas lanzan de verdad al tocarlos (y la MARCA va en el mensaje)", () => {
    expect(() => Object.getPrototypeOf(proxyConGetPrototypeOfQueLanza())).toThrow(MARCA);
    expect(() => Reflect.get(proxyConGetQueLanza(), "message")).toThrow(MARCA);
    expect(() => Object.getPrototypeOf(proxyRevocado())).toThrow(TypeError);
    expect(() => Array.isArray(proxyRevocado())).toThrow(TypeError);
    expect(() => conGetterQueLanza("error").error).toThrow(MARCA);
  });
});

/* ------------------------------------------------------------------------------------------------
 * B1. `status`: «sin fila» es solo data null con status 200
 * ---------------------------------------------------------------------------------------------- */

// Cualquier `status` que no sea exactamente el número 200.
const STATUS_QUE_NO_SON_200: Array<[string, () => unknown]> = [
  ["204", () => 204],
  ["404", () => 404],
  ["201", () => 201],
  ["206", () => 206],
  ["400", () => 400],
  ["500", () => 500],
  ["199", () => 199],
  ["0", () => 0],
  ["1", () => 1],
  ["-200", () => -200],
  ["200.5", () => 200.5],
  ["undefined (explícito)", () => undefined],
  ["null", () => null],
  ["«200» (cadena)", () => "200"],
  ["«200 OK» (cadena)", () => "200 OK"],
  ["«» (cadena vacía)", () => ""],
  ["NaN", () => Number.NaN],
  ["Infinity", () => Number.POSITIVE_INFINITY],
  ["200n (bigint)", () => BigInt(200)],
  ["new Number(200)", () => new Number(200)],
  ["true", () => true],
  ["false", () => false],
  ["[200]", () => [200]],
  ["un objeto cuyo valueOf devuelve 200", () => ({ valueOf: () => 200 })],
  ["un objeto cuyo toString devuelve «200»", () => ({ toString: () => "200" })],
];

describe("obtenerCotizacion · «sin fila» es solo data null con status 200 (comparación estricta)", () => {
  it("data null con status 200 devuelve null", async () => {
    programar(respondeConStatus(null, 200));
    await expect(obtenerCotizacion(ID_A)).resolves.toBeNull();
  });

  it("data null con status 200 y sin la clave error también devuelve null (error undefined no es un fallo)", async () => {
    programar(resuelve({ data: null, status: 200 }));
    await expect(obtenerCotizacion(ID_A)).resolves.toBeNull();
    programar(resuelve({ data: null, error: undefined, status: 200 }));
    await expect(obtenerCotizacion(ID_A)).resolves.toBeNull();
  });

  it.each(STATUS_QUE_NO_SON_200)("data null con status %s es DATOS_INVALIDOS, no «no encontrada»", async (_nombre, crear) => {
    programar(respondeConStatus(null, crear()));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
  });

  it("data null con la clave status AUSENTE es DATOS_INVALIDOS", async () => {
    programar(respondeConStatus(null, SIN_STATUS));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
  });

  it("data null sin la clave status ni la clave error es DATOS_INVALIDOS", async () => {
    programar(resuelve({ data: null }));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["un arreglo vacío", []],
    ["un objeto vacío", {}],
    ["0", 0],
    ["una cadena vacía", ""],
    ["false", false],
    ["NaN", Number.NaN],
  ])("data %s con status 200 NO es «sin fila» (solo null lo es): DATOS_INVALIDOS", async (_nombre, data) => {
    programar(respondeConStatus(data, 200));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
  });

  it("data con una fila INVÁLIDA y status 200 es DATOS_INVALIDOS", async () => {
    programar(respondeConStatus(fila({ estado: "vencida" }), 200));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
  });

  // Decisión documentada: el `status` solo desambigua `data: null`. Con una fila en `data` lo que decide
  // es la validación de la fila; el `status` no se mira (una fila válida con status 204 o ausente se acepta).
  it.each<[string, () => unknown]>([
    ["204", () => 204],
    ["404", () => 404],
    ["ausente", () => SIN_STATUS],
    ["undefined", () => undefined],
    ["«200» (cadena)", () => "200"],
    ["NaN", () => Number.NaN],
  ])("data con una fila VÁLIDA y status %s: se valida la fila y se devuelve (el status no decide)", async (_nombre, crear) => {
    programar(respondeConStatus(fila(), crear()));
    await expect(obtenerCotizacion(ID_A)).resolves.toStrictEqual(COTIZACION);
  });

  it("data con una fila INVÁLIDA y status 204 o ausente también es DATOS_INVALIDOS", async () => {
    programar(respondeConStatus(fila({ row_version: 0 }), 204));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    programar(respondeConStatus(fila({ row_version: 0 }), SIN_STATUS));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
  });

  it.each([200, 204, 404, 500, SIN_STATUS])("un error en la respuesta manda sobre el status (%s)", async (status) => {
    const respuesta: Fila = { data: null, error: { message: "COT:SIN_PERMISO", code: "P0001" } };
    if (status !== SIN_STATUS) respuesta.status = status;
    programar(resuelve(respuesta));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "SIN_PERMISO");
  });

  it("con error en la respuesta no se leen ni data ni status (un getter que lanza no cambia el código)", async () => {
    const respuesta = conGetterQueLanza("data", { error: { message: "COT:SIN_PERMISO" } });
    Object.defineProperty(respuesta, "status", {
      enumerable: true,
      get(): never {
        throw new Error(`${MARCA} al leer status`);
      },
    });
    programar(resuelve(respuesta));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "SIN_PERMISO");
  });
});

describe("listarCotizaciones · data null es DATOS_INVALIDOS sea cual sea el status", () => {
  it("con status 200 es DATOS_INVALIDOS (una página vacía es [], nunca null)", async () => {
    programar(respondeConStatus(null, 200));
    await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
  });

  it.each(STATUS_QUE_NO_SON_200)("con status %s es DATOS_INVALIDOS", async (_nombre, crear) => {
    programar(respondeConStatus(null, crear()));
    await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
  });

  it("con la clave status ausente es DATOS_INVALIDOS", async () => {
    programar(respondeConStatus(null, SIN_STATUS));
    await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
  });

  it("una página vacía legítima ([] con status 200) sigue devolviendo []", async () => {
    programar(respondeConStatus([], 200));
    await expect(listarCotizaciones()).resolves.toStrictEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------------
 * B2. Hostiles envueltos: error, rechazo, excepción síncrona, lecturas y filas ilegibles
 * ---------------------------------------------------------------------------------------------- */

// Valores hostiles que pueden llegar como `error` de la respuesta, como motivo de rechazo o lanzados por `from()`.
// Son fábricas para que cada prueba tenga su propio objeto y para que el título nunca los inspeccione.
const HOSTILES_ENVUELTOS: Array<[string, () => unknown]> = [
  ["Proxy con trampa getPrototypeOf que lanza", proxyConGetPrototypeOfQueLanza],
  ["Proxy con trampa get que lanza", proxyConGetQueLanza],
  ["Proxy revocado", proxyRevocado],
  ["objeto con getter message que lanza", () => conGetterQueLanza("message", { code: "42501" })],
  ["objeto con getter message que lanza una cadena", () => conGetterQueLanza("message", {}, () => MARCA)],
  ["Error de SQL con la MARCA", () => new Error(`${MARCA} SELECT * FROM cotizaciones WHERE prospecto_email = '${PII.correo}'`)],
  ["objeto PostgREST con la MARCA en todos los campos", () => ({ message: MARCA, code: "42501", details: MARCA, hint: MARCA })],
  ["objeto sin prototipo con la MARCA", () => Object.assign(Object.create(null), { message: MARCA, details: MARCA })],
  ["cadena con la MARCA", () => MARCA],
  ["objeto cuyo toString lanza", () => ({ toString: () => { throw new Error(MARCA); } })],
  ["Error cuya propiedad message es un getter que lanza", () => Object.defineProperty(new Error("x"), "message", {
    get(): never {
      throw new Error(MARCA);
    },
  })],
];

describe("hostiles envueltos · como error de la respuesta, motivo de rechazo o excepción síncrona de from()", () => {
  const CANALES: Array<[string, (valor: unknown) => Plan]> = [
    ["error de la respuesta", falla],
    ["motivo de rechazo", rechaza],
    ["excepción síncrona de from()", lanza],
  ];

  describe.each(AMBAS_FUNCIONES)("%s", (_funcion, invocar) => {
    describe.each(CANALES)("%s", (_canal, plan) => {
      it.each(HOSTILES_ENVUELTOS)("%s: DESCONOCIDO, mensaje seguro y sin rastro del original", async (_nombre, crear) => {
        programar(plan(crear()));
        await esperarFalloSeguro(invocar(), "DESCONOCIDO");
      });
    });
  });

  it("el recorrido cubre los 11 hostiles, los 3 canales y las 2 funciones", () => {
    expect(HOSTILES_ENVUELTOS).toHaveLength(11);
    expect(CANALES).toHaveLength(3);
    expect(AMBAS_FUNCIONES).toHaveLength(2);
  });
});

describe("hostiles envueltos · una respuesta cuya lectura lanza", () => {
  const LECTURAS: Array<[string, () => Plan]> = [
    ["error", () => resuelve(conGetterQueLanza("error", { data: null, status: 200 }))],
    ["data", () => resuelve(conGetterQueLanza("data", { error: null, status: 200 }))],
  ];

  describe.each(AMBAS_FUNCIONES)("%s", (_funcion, invocar) => {
    it.each(LECTURAS)("un getter que lanza en respuesta.%s es DESCONOCIDO, con mensaje seguro", async (_clave, plan) => {
      programar(plan());
      await esperarFalloSeguro(invocar(), "DESCONOCIDO");
    });
  });

  // `status` solo se lee para decidir «sin fila»: es parte del contrato de obtenerCotizacion.
  it("obtenerCotizacion: un getter que lanza en respuesta.status es DESCONOCIDO, con mensaje seguro", async () => {
    programar(resuelve(conGetterQueLanza("status", { data: null, error: null })));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DESCONOCIDO");
  });

  it("obtenerCotizacion: un getter que lanza una cadena en respuesta.status es DESCONOCIDO", async () => {
    programar(resuelve(conGetterQueLanza("status", { data: fila(), error: null }, () => MARCA)));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DESCONOCIDO");
  });

  it.each<[string, () => unknown]>([
    ["una cadena", () => MARCA],
    ["un objeto", () => ({ message: MARCA, code: "42501" })],
    ["null", () => null],
    ["undefined", () => undefined],
    ["un número", () => 42],
    ["un símbolo", () => Symbol(MARCA)],
    ["un objeto con message getter que lanza", () => conGetterQueLanza("message")],
    ["un Proxy revocado", proxyRevocado],
  ])("un getter que lanza %s (no un Error) es DESCONOCIDO, con mensaje seguro", async (_nombre, crear) => {
    for (const [, invocar] of AMBAS_FUNCIONES) {
      programar(resuelve(conGetterQueLanza("error", { data: null, status: 200 }, crear)));
      await esperarFalloSeguro(invocar(), "DESCONOCIDO");
      programar(resuelve(conGetterQueLanza("data", { error: null, status: 200 }, crear)));
      await esperarFalloSeguro(invocar(), "DESCONOCIDO");
    }
  });

  // El COT: conocido se conserva si lo que se lanza lleva exactamente ese message, igual que en un rechazo.
  it.each(AMBAS_FUNCIONES)("%s: un getter que lanza un Error «COT:SIN_PERMISO» conserva ese código", async (_nombre, invocar) => {
    programar(resuelve(conGetterQueLanza("error", { data: null, status: 200 }, () => new Error("COT:SIN_PERMISO"))));
    await esperarFalloSeguro(invocar(), "SIN_PERMISO");
  });

  it.each(AMBAS_FUNCIONES)("%s: un getter que lanza un Error «COT:DETALLE_INVALIDO» es DESCONOCIDO", async (_nombre, invocar) => {
    programar(resuelve(conGetterQueLanza("data", { error: null, status: 200 }, () => new Error("COT:DETALLE_INVALIDO"))));
    await esperarFalloSeguro(invocar(), "DESCONOCIDO");
  });

  it.each(AMBAS_FUNCIONES)("%s: un rechazo con un Proxy que lleva «COT:SIN_PERMISO» por get conserva ese código", async (_nombre, invocar) => {
    programar(rechaza(new Proxy({}, { get: (_objetivo, clave) => (clave === "message" ? "COT:SIN_PERMISO" : undefined) })));
    await esperarFalloSeguro(invocar(), "SIN_PERMISO");
  });
});

describe("hostiles envueltos · datos y filas ilegibles son DATOS_INVALIDOS", () => {
  const filaIlegible = (base: () => Fila, campos: string[]): Array<[string, () => Fila]> =>
    campos.map((campo): [string, () => Fila] => [`un getter que lanza en la columna ${campo}`, () => conGetterQueLanza(campo, base())]);

  // Valores que no son una fila legible, como fila suelta o como `data` entera.
  const ILEGIBLES: Array<[string, () => unknown]> = [
    ["un Proxy revocado", proxyRevocado],
    ["un Proxy con trampa get que lanza", proxyConGetQueLanza],
    [
      "un Proxy que lanza solo al leer estado",
      () =>
        new Proxy(resumen(2), {
          get(objetivo, clave, receptor): unknown {
            if (clave === "estado") throw new Error(`${MARCA} al leer estado`);
            return Reflect.get(objetivo, clave, receptor);
          },
        }),
    ],
    ["un Proxy con trampa getPrototypeOf que lanza (sin campos)", proxyConGetPrototypeOfQueLanza],
  ];

  describe("listarCotizaciones", () => {
    it.each(ILEGIBLES)("data que es %s es DATOS_INVALIDOS", async (_nombre, crear) => {
      programar(responde(crear()));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });

    it.each(ILEGIBLES)("una fila intermedia que es %s rechaza la página entera con DATOS_INVALIDOS", async (_nombre, crear) => {
      programar(responde([resumen(1), crear(), resumen(3)]));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });

    it.each(ILEGIBLES)("la primera fila que es %s es DATOS_INVALIDOS", async (_nombre, crear) => {
      programar(responde([crear()]));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });

    it.each(filaIlegible(() => resumen(2), CLAVES_RESUMEN))("una fila intermedia con %s es DATOS_INVALIDOS", async (_nombre, crear) => {
      programar(responde([resumen(1), crear(), resumen(3)]));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });

    it("un arreglo con un Proxy cuyo length lanza es DATOS_INVALIDOS", async () => {
      const arreglo = new Proxy([resumen(1)], {
        get(objetivo, clave, receptor): unknown {
          if (clave === "length") throw new Error(`${MARCA} al leer length`);
          return Reflect.get(objetivo, clave, receptor);
        },
      });
      programar(responde(arreglo));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });

    it("un arreglo con un elemento cuyo getter lanza es DATOS_INVALIDOS", async () => {
      const arreglo: unknown[] = [resumen(1), resumen(2)];
      Object.defineProperty(arreglo, 1, {
        get(): never {
          throw new Error(`${MARCA} al leer el elemento 1`);
        },
      });
      programar(responde(arreglo));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });

    it("las filas válidas que preceden a una ilegible no se devuelven", async () => {
      programar(responde([resumen(1), resumen(2), conGetterQueLanza("id", resumen(3))]));
      await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    });
  });

  describe("obtenerCotizacion", () => {
    it.each(ILEGIBLES)("data que es %s es DATOS_INVALIDOS", async (_nombre, crear) => {
      programar(responde(crear()));
      await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    });

    it.each(filaIlegible(() => fila(), CLAVES_COTIZACION))("una fila con %s es DATOS_INVALIDOS", async (_nombre, crear) => {
      programar(responde(crear()));
      await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    });

    it("un Proxy que lanza solo al leer una columna del detalle es DATOS_INVALIDOS", async () => {
      const proxy = new Proxy(fila(), {
        get(objetivo, clave, receptor): unknown {
          if (clave === "actualizado_at") throw new Error(`${MARCA} al leer actualizado_at`);
          return Reflect.get(objetivo, clave, receptor);
        },
      });
      programar(responde(proxy));
      await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    });

    it("un getter hostil con status distinto de 200 también es DATOS_INVALIDOS (se valida la fila)", async () => {
      programar(respondeConStatus(conGetterQueLanza("estado", fila()), 204));
      await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    });
  });
});

describe("hostiles envueltos · un id que no es una cadena sigue siendo «sin fila» sin llamar a Supabase", () => {
  it.each<[string, () => unknown]>([
    ["un Proxy revocado", proxyRevocado],
    ["un Proxy con trampa get que lanza", proxyConGetQueLanza],
    ["un objeto cuyo toString lanza", () => ({ toString: () => { throw new Error(MARCA); } })],
    ["un objeto con un getter que lanza", () => conGetterQueLanza("id")],
  ])("obtenerCotizacion(%s) devuelve null", async (_nombre, crear) => {
    await expect(obtenerCotizacion(hostil<string>(crear()))).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------------------------------------
 * B3. Opciones hostiles de listarCotizaciones: se leen una sola vez
 * ---------------------------------------------------------------------------------------------- */

describe("listarCotizaciones · opciones hostiles", () => {
  const OPCIONES_HOSTILES: Array<[string, () => unknown]> = [
    ["un getter que lanza en pagina", () => conGetterQueLanza("pagina", { tamano: 10 })],
    ["un getter que lanza en tamano", () => conGetterQueLanza("tamano", { pagina: 1 })],
    ["un getter que lanza en pagina y en tamano", () => conGettersQueLanzan(["pagina", "tamano"])],
    ["un getter que lanza una cadena con la MARCA", () => conGetterQueLanza("pagina", {}, () => MARCA)],
    ["un getter que lanza un Error «COT:SIN_PERMISO» (no cambia el código)", () => conGetterQueLanza("pagina", {}, () => new Error("COT:SIN_PERMISO"))],
    ["un Proxy revocado", proxyRevocado],
    ["un Proxy con trampa get que lanza", proxyConGetQueLanza],
    [
      "un Proxy que lanza solo al leer tamano",
      () =>
        new Proxy({ pagina: 1, tamano: 10 }, {
          get(objetivo, clave, receptor): unknown {
            if (clave === "tamano") throw new Error(`${MARCA} al leer tamano`);
            return Reflect.get(objetivo, clave, receptor);
          },
        }),
    ],
  ];

  it.each(OPCIONES_HOSTILES)("%s: PARAMETROS_INVALIDOS, mensaje genérico y 0 llamadas a Supabase", async (_nombre, crear) => {
    let promesa: Promise<unknown> = Promise.resolve();
    // La función es `async`: un fallo de lectura nunca debe salir como excepción síncrona.
    expect(() => {
      promesa = listarCotizaciones(hostil<undefined>(crear()));
    }).not.toThrow();
    const error = await esperarFalloSeguro(promesa, "PARAMETROS_INVALIDOS");
    expect(error.message).toBe(GENERICO);
    expect(from).not.toHaveBeenCalled();
    expect(llamadas).toEqual([]);
  });

  describe("cada propiedad se lee UNA sola vez y el valor validado es el que se usa", () => {
    interface Contador {
      opciones: { readonly pagina: unknown; readonly tamano: unknown };
      lecturas: { pagina: number; tamano: number };
    }

    /** Opciones cuyos getters cuentan las lecturas y devuelven `valores[n]` en la lectura número n (el último se repite). */
    function contador(paginas: unknown[], tamanos: unknown[]): Contador {
      const lecturas = { pagina: 0, tamano: 0 };
      const opciones = {
        get pagina(): unknown {
          const valor = paginas[Math.min(lecturas.pagina, paginas.length - 1)];
          lecturas.pagina += 1;
          return valor;
        },
        get tamano(): unknown {
          const valor = tamanos[Math.min(lecturas.tamano, tamanos.length - 1)];
          lecturas.tamano += 1;
          return valor;
        },
      };
      return { opciones, lecturas };
    }

    it("con valores válidos: exactamente 1 lectura de pagina y 1 de tamano", async () => {
      programar(responde([]));
      const { opciones, lecturas } = contador([2], [10]);
      await listarCotizaciones(hostil<undefined>(opciones));
      expect(lecturas).toEqual({ pagina: 1, tamano: 1 });
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([10, 19]);
    });

    it("con una página inválida: también 1 lectura de cada una, y no se llama a Supabase", async () => {
      const { opciones, lecturas } = contador([0], [10]);
      await esperarFalloSeguro(listarCotizaciones(hostil<undefined>(opciones)), "PARAMETROS_INVALIDOS");
      expect(lecturas).toEqual({ pagina: 1, tamano: 1 });
      expect(from).not.toHaveBeenCalled();
    });

    it("con un tamaño inválido: también 1 lectura de cada una, y no se llama a Supabase", async () => {
      const { opciones, lecturas } = contador([1], [101]);
      await esperarFalloSeguro(listarCotizaciones(hostil<undefined>(opciones)), "PARAMETROS_INVALIDOS");
      expect(lecturas).toEqual({ pagina: 1, tamano: 1 });
      expect(from).not.toHaveBeenCalled();
    });

    it("con undefined (valores por defecto): 1 lectura de cada una", async () => {
      programar(responde([]));
      const { opciones, lecturas } = contador([undefined], [undefined]);
      await listarCotizaciones(hostil<undefined>(opciones));
      expect(lecturas).toEqual({ pagina: 1, tamano: 1 });
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([0, 24]);
    });

    it("pagina devuelve 1 la primera vez y 999 después: se usa 1 → range(0, 24)", async () => {
      programar(responde([]));
      const { opciones, lecturas } = contador([1, 999], [undefined]);
      await listarCotizaciones(hostil<undefined>(opciones));
      expect(lecturas.pagina).toBe(1);
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([0, 24]);
    });

    it("tamano devuelve 10 la primera vez y 999 después: se usa 10 → range(0, 9)", async () => {
      programar(responde([]));
      const { opciones, lecturas } = contador([1], [10, 999]);
      await listarCotizaciones(hostil<undefined>(opciones));
      expect(lecturas.tamano).toBe(1);
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([0, 9]);
    });

    it("ambas cambian después de la primera lectura: se usan los validados → range(20, 29)", async () => {
      programar(responde([]));
      const { opciones } = contador([3, 7, 7], [10, 50, 50]);
      await listarCotizaciones(hostil<undefined>(opciones));
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([20, 29]);
    });

    it("pagina inválida la primera vez y válida después se rechaza (no se vuelve a leer para «arreglarla»)", async () => {
      const { opciones } = contador([999999, 1], [10]);
      await esperarFalloSeguro(listarCotizaciones(hostil<undefined>(opciones)), "PARAMETROS_INVALIDOS");
      expect(from).not.toHaveBeenCalled();
    });

    it("pagina válida la primera vez e inválida después se acepta con el valor validado", async () => {
      programar(responde([]));
      const { opciones } = contador([2, "x"], [5]);
      await listarCotizaciones(hostil<undefined>(opciones));
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([5, 9]);
    });

    it("undefined usa el valor por defecto y null no: null es PARAMETROS_INVALIDOS", async () => {
      programar(responde([]));
      await listarCotizaciones(hostil<undefined>(contador([undefined], [undefined]).opciones));
      expect(llamadas.find((llamada) => llamada.metodo === "range")?.args).toStrictEqual([0, 24]);
      const nulo = contador([null], [10]);
      await esperarFalloSeguro(listarCotizaciones(hostil<undefined>(nulo.opciones)), "PARAMETROS_INVALIDOS");
      const tamanoNulo = contador([1], [null]);
      await esperarFalloSeguro(listarCotizaciones(hostil<undefined>(tamanoNulo.opciones)), "PARAMETROS_INVALIDOS");
    });
  });
});

/* ------------------------------------------------------------------------------------------------
 * B4. traducirErrorCotizacion es total
 * ---------------------------------------------------------------------------------------------- */

describe("traducirErrorCotizacion · es total (no lanza nunca) y devuelve el genérico ante un valor hostil", () => {
  /** Una ErrorCotizacion real a la que se le redefine una propiedad propia. */
  function conPropiedad(codigo: CodigoErrorCotizacion, clave: "codigo" | "message", propiedad: PropertyDescriptor): ErrorCotizacion {
    return Object.defineProperty(new ErrorCotizacion(codigo), clave, { configurable: true, ...propiedad });
  }

  const TOTALES: Array<[string, () => unknown]> = [
    ["un objeto con un getter message que lanza", () => conGetterQueLanza("message", { code: "42501" })],
    ["un Error con un getter message que lanza", () => Object.defineProperty(new Error("x"), "message", { get(): never { throw new Error(MARCA); } })],
    ["un Proxy con trampa getPrototypeOf que lanza", proxyConGetPrototypeOfQueLanza],
    ["un Proxy con trampa get que lanza", proxyConGetQueLanza],
    ["un Proxy revocado", proxyRevocado],
    ["una ErrorCotizacion con un getter codigo que lanza", () => conPropiedad("SIN_PERMISO", "codigo", { get(): never { throw new Error(MARCA); } })],
    ["una ErrorCotizacion con un getter codigo que lanza una cadena", () => conPropiedad("NO_ENCONTRADA", "codigo", { get(): never { throw MARCA; } })],
  ];

  it.each(TOTALES)("%s: devuelve el genérico y no lanza", (_nombre, crear) => {
    const valor = crear();
    let resultado = "";
    expect(() => {
      resultado = traducirErrorCotizacion(valor);
    }).not.toThrow();
    expect(resultado).toBe(MENSAJE_ERROR_GENERICO);
    for (const fragmento of PROHIBIDOS) expect(resultado).not.toContain(fragmento);
  });

  it("una ErrorCotizacion con un getter message que lanza se traduce por su código (no lee el message)", () => {
    const error = conPropiedad("SIN_PERMISO", "message", {
      get(): never {
        throw new Error(MARCA);
      },
    });
    expect(traducirErrorCotizacion(error)).toBe("No tienes permiso para realizar esta acción.");
  });

  it("traducir lee el codigo de la ErrorCotizacion una sola vez", () => {
    let lecturas = 0;
    const error = conPropiedad("SIN_PERMISO", "codigo", {
      get(): string {
        lecturas += 1;
        return "SIN_PERMISO";
      },
    });
    expect(traducirErrorCotizacion(error)).toBe("No tienes permiso para realizar esta acción.");
    expect(lecturas).toBe(1);
  });

  describe("falsificación: una instancia de ErrorCotizacion con el message cambiado o fabricada NO manda su message", () => {
    it("Object.create(ErrorCotizacion.prototype, { message: «x» }) devuelve el genérico", () => {
      const falsa = Object.create(ErrorCotizacion.prototype, { message: { value: "x" } });
      expect(falsa).toBeInstanceOf(ErrorCotizacion);
      expect(traducirErrorCotizacion(falsa)).toBe(GENERICO);
    });

    it("Object.create(ErrorCotizacion.prototype, { message: la MARCA }) devuelve el genérico, sin la MARCA", () => {
      const falsa = Object.create(ErrorCotizacion.prototype, { message: { value: MARCA } });
      const resultado = traducirErrorCotizacion(falsa);
      expect(resultado).toBe(GENERICO);
      expect(resultado).not.toContain(MARCA);
    });

    it("Object.create(ErrorCotizacion.prototype, { message: «x», codigo: «SIN_PERMISO» }) devuelve el texto de la tabla", () => {
      const falsa = Object.create(ErrorCotizacion.prototype, { message: { value: "x" }, codigo: { value: "SIN_PERMISO" } });
      expect(traducirErrorCotizacion(falsa)).toBe("No tienes permiso para realizar esta acción.");
    });

    it.each(TEXTOS)("Object.create con codigo «%s» y un message distinto devuelve el texto de la tabla de ese código", (codigo, texto) => {
      const falsa = Object.create(ErrorCotizacion.prototype, { message: { value: MARCA }, codigo: { value: codigo } });
      expect(traducirErrorCotizacion(falsa)).toBe(texto);
    });

    it("err.message = «x» sobre una instancia real sigue dando el texto de la tabla", () => {
      const error = new ErrorCotizacion("SIN_PERMISO");
      error.message = "x";
      expect(error.message).toBe("x");
      expect(traducirErrorCotizacion(error)).toBe("No tienes permiso para realizar esta acción.");
    });

    it.each(TEXTOS)("err.message = la MARCA sobre una instancia real de %s sigue dando su texto de la tabla", (codigo, texto) => {
      const error = new ErrorCotizacion(codigo);
      error.message = `${MARCA} ${PII.correo}`;
      expect(traducirErrorCotizacion(error)).toBe(texto);
    });

    it("err.message = «COT:NO_ENCONTRADA» sobre una instancia SIN_PERMISO manda el codigo, no el message", () => {
      const error = new ErrorCotizacion("SIN_PERMISO");
      error.message = "COT:NO_ENCONTRADA";
      expect(traducirErrorCotizacion(error)).toBe("No tienes permiso para realizar esta acción.");
    });

    it("una instancia de ErrorCotizacion DESCONOCIDO con message «COT:SIN_PERMISO» sigue siendo el genérico", () => {
      const error = new ErrorCotizacion("DESCONOCIDO");
      error.message = "COT:SIN_PERMISO";
      expect(traducirErrorCotizacion(error)).toBe(GENERICO);
    });

    it.each<[string, unknown]>([
      ["undefined", undefined],
      ["null", null],
      ["un número", 42],
      ["«constructor»", "constructor"],
      ["«__proto__»", "__proto__"],
      ["«toString»", "toString"],
      ["«DETALLE_INVALIDO»", "DETALLE_INVALIDO"],
      ["«COT:SIN_PERMISO»", "COT:SIN_PERMISO"],
      ["un objeto", {}],
    ])("Object.create(ErrorCotizacion.prototype, { codigo: %s }) devuelve el genérico", (_nombre, codigo) => {
      const falsa = Object.create(ErrorCotizacion.prototype, { message: { value: "x" }, codigo: { value: codigo } });
      expect(traducirErrorCotizacion(falsa)).toBe(GENERICO);
    });
  });
});

/* ------------------------------------------------------------------------------------------------
 * B5. Las marcas de tiempo se validan de forma explícita: sin Date.parse
 * ---------------------------------------------------------------------------------------------- */

describe("marcas de tiempo · sin Date.parse", () => {
  /** Sustituye Date.parse por una función que lanza: si el módulo la llama, la prueba lo ve (y la llamada se cuenta). */
  function bloquearDateParse(): MockInstance {
    return registrar(
      vi.spyOn(Date, "parse").mockImplementation(() => {
        throw new Error(`${MARCA} Date.parse no debe usarse para validar`);
      }),
    );
  }

  /**
   * Pasa cada fecha de las dos listas por `obtenerCotizacion` y `listarCotizaciones` y AFIRMA el resultado de
   * cada llamada (las válidas se aceptan; las inválidas se rechazan con DATOS_INVALIDOS). Ningún fallo se
   * traga: lo que miden los espías de las pruebas siguientes son llamadas que de verdad validaron la fecha.
   */
  async function validarTodasLasFechas(): Promise<void> {
    for (const valor of FECHAS_VALIDAS) {
      programar(responde(fila({ creado_at: valor, actualizado_at: valor })));
      await expect(obtenerCotizacion(ID_A)).resolves.toMatchObject({ id: ID_A, creado_at: valor, actualizado_at: valor });
      programar(responde([resumen(1, { creado_at: valor })]));
      await expect(listarCotizaciones()).resolves.toMatchObject([{ creado_at: valor }]);
    }
    for (const valor of FECHAS_INVALIDAS) {
      programar(responde(fila({ creado_at: valor, actualizado_at: valor })));
      await esperarFallo(obtenerCotizacion(ID_A), "DATOS_INVALIDOS", GENERICO);
      programar(responde([resumen(1, { creado_at: valor })]));
      await esperarFallo(listarCotizaciones(), "DATOS_INVALIDOS", GENERICO);
    }
  }

  /**
   * Cuenta las construcciones con argumento (`new Date(texto)`) que ocurren mientras corre `accion`. Sustituye
   * `globalThis.Date` por un Proxy que deja pasar todo lo demás y restaura SOLO `Date` al terminar (no usa
   * `vi.unstubAllGlobals()`, que desharía también cualquier otro stub global ajeno a esta prueba).
   */
  async function construccionesDeDate(accion: () => Promise<void> | void): Promise<unknown[]> {
    const original = globalThis.Date;
    const construcciones: unknown[] = [];
    globalThis.Date = new Proxy(original, {
      construct(objetivo, argumentos, nuevoObjetivo) {
        if (argumentos.length > 0) construcciones.push(argumentos[0]);
        return Reflect.construct(objetivo, argumentos, nuevoObjetivo);
      },
    });
    try {
      await accion();
    } finally {
      globalThis.Date = original;
    }
    return construcciones;
  }

  it("validar filas no llama a Date.parse ni a Date.UTC (0 llamadas), con fechas válidas e inválidas", async () => {
    const parse = registrar(vi.spyOn(Date, "parse"));
    const utc = registrar(vi.spyOn(Date, "UTC"));
    await validarTodasLasFechas();
    expect(FECHAS_VALIDAS.length + FECHAS_INVALIDAS.length).toBeGreaterThan(100);
    expect(parse).toHaveBeenCalledTimes(0);
    expect(utc).toHaveBeenCalledTimes(0);
  });

  it("el control de los espías: Date.parse y Date.UTC sí se cuentan cuando alguien los llama", () => {
    const parse = registrar(vi.spyOn(Date, "parse"));
    const utc = registrar(vi.spyOn(Date, "UTC"));
    Date.parse("2026-11-10T12:00:00Z");
    Date.UTC(2026, 10, 10);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(utc).toHaveBeenCalledTimes(1);
  });

  it("validar filas no construye fechas a partir del texto (new Date(cadena)) con fechas válidas e inválidas", async () => {
    const construcciones = await construccionesDeDate(validarTodasLasFechas);
    expect(construcciones).toEqual([]);
  });

  it("el control del contador de construcciones: new Date(cadena) sí se cuenta", async () => {
    const original = globalThis.Date;
    const construcciones = await construccionesDeDate(() => {
      new Date("2026-11-10T12:00:00Z");
    });
    expect(construcciones).toEqual(["2026-11-10T12:00:00Z"]);
    // El contador restaura `Date` al terminar, también si la acción lanza (si no, quedaría el Proxy puesto).
    expect(globalThis.Date).toBe(original);
    await expect(
      construccionesDeDate(() => {
        throw new Error("fallo de la acción");
      }),
    ).rejects.toThrow("fallo de la acción");
    expect(globalThis.Date).toBe(original);
  });

  it.each(FECHAS_VALIDAS)("acepta «%s» aunque Date.parse lance, sin llamarlo (creado_at y actualizado_at)", async (valor) => {
    const parse = bloquearDateParse();
    programar(responde(fila({ creado_at: valor, actualizado_at: valor })));
    await expect(obtenerCotizacion(ID_A)).resolves.toStrictEqual({ ...COTIZACION, creado_at: valor, actualizado_at: valor });
    programar(responde([resumen(1, { creado_at: valor })]));
    await expect(listarCotizaciones()).resolves.toStrictEqual([resumen(1, { creado_at: valor })]);
    expect(parse).toHaveBeenCalledTimes(0);
  });

  it.each(FECHAS_INVALIDAS)("rechaza «%s» aunque Date.parse lance, sin llamarlo (creado_at y actualizado_at)", async (valor) => {
    const parse = bloquearDateParse();
    programar(responde(fila({ creado_at: valor })));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    programar(responde(fila({ actualizado_at: valor })));
    await esperarFalloSeguro(obtenerCotizacion(ID_A), "DATOS_INVALIDOS");
    programar(responde([resumen(1), resumen(2, { creado_at: valor })]));
    await esperarFalloSeguro(listarCotizaciones(), "DATOS_INVALIDOS");
    expect(parse).toHaveBeenCalledTimes(0);
  });

  it("los dígitos que no son ASCII se construyen de verdad (no son los dígitos 0-9)", () => {
    const anchura = conDigitos("2026-11-10T12:00:00Z", ANCHURA_COMPLETA);
    const arabigos = conDigitos("2026-11-10T12:00:00Z", ARABIGO_INDICO);
    expect(anchura).not.toMatch(/[0-9]/);
    expect(arabigos).not.toMatch(/[0-9]/);
    expect(anchura.charCodeAt(0)).toBe(0xff12);
    expect(arabigos.charCodeAt(0)).toBe(0x0662);
    expect(SIGNO_MENOS_UNICODE.charCodeAt(0)).toBe(0x2212);
    expect(FECHAS_INVALIDAS).toContain(anchura);
    expect(FECHAS_INVALIDAS).toContain(arabigos);
  });

  it("la lista de fechas aceptadas cubre cada forma de desfase y de 1 a 9 decimales", () => {
    for (const requerida of [
      "2026-11-10T12:00:00Z",
      "2026-11-10T12:00:00+00:00",
      "2026-11-10T12:00:00-06:00",
      "2026-11-10T12:00:00+05:30",
      "2026-11-10T12:00:00+0000",
      "2026-11-10T12:00:00-2359",
      "2026-11-10T12:00:00+23:59",
      "2024-02-29T12:00:00Z",
    ]) {
      expect(FECHAS_VALIDAS).toContain(requerida);
    }
    for (let decimales = 1; decimales <= 9; decimales += 1) {
      expect(FECHAS_VALIDAS).toContain(`2026-11-10T12:00:00.${"123456789".slice(0, decimales)}Z`);
    }
  });

  it("la lista de fechas rechazadas cubre cada regla pedida", () => {
    for (const requerida of [
      "2026-11-10T12:00:00+24:00",
      "2026-11-10T12:00:00+25:00",
      "2026-11-10T12:00:00+00:60",
      "2026-11-10T12:00:00+99:99",
      "2026-11-10T12:00:00+0060",
      "2026-11-10T12:00:00+2400",
      "2026-11-10T12:00:00+05:30:15",
      "2026-11-10T12:00:00+00",
      "2026-02-30T10:00:00Z",
      "2026-11-10T24:00:00+00:00",
      "2026-11-10T12:00:60+00:00",
      "2026-11-10T12:00:99Z",
      "2026-13-10T12:00:00Z",
      "2026-11-00T12:00:00+00:00",
      "2026-11-10T12:00:00",
      "no es una fecha",
      "2026-11-10T12:00:00.1234567890Z",
    ]) {
      expect(FECHAS_INVALIDAS).toContain(requerida);
    }
  });
});

/* ------------------------------------------------------------------------------------------------
 * B6. Ningún camino escribe en la consola: ni el error, ni la respuesta, ni los datos personales.
 * Evita la regresión de un `console.*` olvidado en la capa de datos, que acabaría volcando el error original
 * del servidor o datos del prospecto en la consola del navegador o en los registros.
 * ---------------------------------------------------------------------------------------------- */

// El resto de métodos de `Console` (table, group, assert, count, timeLog…) escriben a través de log, warn
// o error, que ya se espían; `dir` es la excepción (escribe directo), por eso va en la lista.
const METODOS_DE_CONSOLA = ["log", "info", "warn", "error", "debug", "trace", "dir"] as const;

/** Espía los métodos de la consola (sin dejarlos escribir) y devuelve los nombres de los que se llamaron. */
function espiarConsola(): { llamadas: () => string[] } {
  const espias: Array<[string, MockInstance]> = [
    ["log", registrar(vi.spyOn(console, "log").mockImplementation(() => undefined))],
    ["info", registrar(vi.spyOn(console, "info").mockImplementation(() => undefined))],
    ["warn", registrar(vi.spyOn(console, "warn").mockImplementation(() => undefined))],
    ["error", registrar(vi.spyOn(console, "error").mockImplementation(() => undefined))],
    ["debug", registrar(vi.spyOn(console, "debug").mockImplementation(() => undefined))],
    ["trace", registrar(vi.spyOn(console, "trace").mockImplementation(() => undefined))],
    ["dir", registrar(vi.spyOn(console, "dir").mockImplementation(() => undefined))],
  ];
  return { llamadas: () => espias.flatMap(([metodo, espia]) => espia.mock.calls.map(() => metodo)) };
}

interface EscenarioDeConsola {
  nombre: string;
  plan: () => Plan;
  /** `true` si la función debe rechazar; `false` si debe resolverse. */
  rechaza: boolean;
}

const FILA_CON_PII = {
  prospecto_nombre: PII.nombre,
  prospecto_contacto: PII.nombre,
  prospecto_email: PII.correo,
  prospecto_telefono: PII.telefono,
};

const CANALES_DE_CONSOLA: Array<[string, (valor: unknown) => Plan]> = [
  ["error de la respuesta", falla],
  ["rechazo", rechaza],
  ["excepción síncrona", lanza],
];

/** Escenarios que valen para las dos funciones: todos rechazan. */
const ESCENARIOS_COMUNES_DE_CONSOLA: EscenarioDeConsola[] = [
  { nombre: "error SQL crudo", plan: () => falla(new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')), rechaza: true },
  {
    nombre: "error 42501 de PostgREST con details y hint",
    plan: () => falla({ message: "permission denied for table cotizaciones", code: "42501", details: "Failing row contains (…)", hint: "secreto-xyz" }),
    rechaza: true,
  },
  {
    nombre: "error SQL que repite los datos personales de la fila",
    plan: () =>
      falla({
        message: `duplicate key value violates unique constraint "cotizaciones_pkey"`,
        code: "23505",
        details: `Key (prospecto_email)=(${PII.correo}) already exists. Failing row contains (${PII.nombre}, ${PII.telefono})`,
        hint: null,
      }),
    rechaza: true,
  },
  ...TEXTOS.map(([codigo]): EscenarioDeConsola => ({
    nombre: `COT:${codigo}`,
    plan: () => falla({ message: `COT:${codigo}`, code: "P0001", details: "detalle", hint: "pista" }),
    rechaza: true,
  })),
  { nombre: "COT:DETALLE_INVALIDO", plan: () => falla({ message: "COT:DETALLE_INVALIDO", code: "P0001" }), rechaza: true },
  { nombre: "una ErrorCotizacion como error de la respuesta", plan: () => falla(new ErrorCotizacion("CONFLICTO_VERSION")), rechaza: true },
  { nombre: "error con status 204", plan: () => resuelve({ data: null, error: { message: "x" }, status: 204 }), rechaza: true },
  ...HOSTILES.flatMap(([nombre, valor]) =>
    CANALES_DE_CONSOLA.map(
      ([canal, plan]): EscenarioDeConsola => ({ nombre: `hostil «${nombre}» como ${canal}`, plan: () => plan(valor), rechaza: true }),
    ),
  ),
  ...HOSTILES_ENVUELTOS.flatMap(([nombre, crear]) =>
    CANALES_DE_CONSOLA.map(
      ([canal, plan]): EscenarioDeConsola => ({ nombre: `hostil «${nombre}» como ${canal}`, plan: () => plan(crear()), rechaza: true }),
    ),
  ),
  { nombre: "getter que lanza en respuesta.error", plan: () => resuelve(conGetterQueLanza("error", { data: null, status: 200 })), rechaza: true },
  { nombre: "getter que lanza en respuesta.data", plan: () => resuelve(conGetterQueLanza("data", { error: null, status: 200 })), rechaza: true },
  { nombre: "getter que lanza en respuesta.status", plan: () => resuelve(conGetterQueLanza("status", { data: null, error: null })), rechaza: true },
  { nombre: "respuesta que no es un objeto", plan: () => resuelve("texto"), rechaza: true },
  { nombre: "respuesta null", plan: () => resuelve(null), rechaza: true },
  { nombre: "data null con status 204", plan: () => respondeConStatus(null, 204), rechaza: true },
  { nombre: "data null con status 404", plan: () => respondeConStatus(null, 404), rechaza: true },
  { nombre: "data null con status ausente", plan: () => respondeConStatus(null, SIN_STATUS), rechaza: true },
  { nombre: "data null con status «200» (cadena)", plan: () => respondeConStatus(null, "200"), rechaza: true },
  { nombre: "data null con status NaN", plan: () => respondeConStatus(null, Number.NaN), rechaza: true },
  { nombre: "data que es un Proxy revocado", plan: () => responde(proxyRevocado()), rechaza: true },
  { nombre: "data que es un Proxy con trampa get que lanza", plan: () => responde(proxyConGetQueLanza()), rechaza: true },
];

const ESCENARIOS_DE_CONSOLA_LISTADO: EscenarioDeConsola[] = [
  { nombre: "página válida con datos personales en columnas de más", plan: () => responde([conExtras(resumen(1, FILA_CON_PII))]), rechaza: false },
  { nombre: "página vacía", plan: () => responde([]), rechaza: false },
  { nombre: "fila inválida (estado) con datos personales", plan: () => responde([resumen(1), resumen(2, { ...FILA_CON_PII, estado: "vencida" })]), rechaza: true },
  { nombre: "fila inválida (row_version) con datos personales", plan: () => responde([resumen(1, { ...FILA_CON_PII, row_version: 0 })]), rechaza: true },
  { nombre: "fila inválida (fecha) con datos personales", plan: () => responde([resumen(1, { ...FILA_CON_PII, creado_at: "ayer" })]), rechaza: true },
  { nombre: "fila inválida (nombre demasiado largo, el nombre es personal)", plan: () => responde([resumen(1, { prospecto_nombre: PII.nombre.repeat(20) })]), rechaza: true },
  { nombre: "fila inválida que es una cadena con datos personales", plan: () => responde([`${PII.nombre} ${PII.correo} ${PII.telefono}`]), rechaza: true },
  { nombre: "más filas que tamano", plan: () => responde(Array.from({ length: 26 }, (_, i) => resumen(i + 1, FILA_CON_PII))), rechaza: true },
  { nombre: "data que no es un arreglo (con datos personales)", plan: () => responde({ ...FILA_CON_PII }), rechaza: true },
  { nombre: "fila con un getter que lanza", plan: () => responde([conGetterQueLanza("id", resumen(1, FILA_CON_PII))]), rechaza: true },
];

const ESCENARIOS_DE_CONSOLA_DETALLE: EscenarioDeConsola[] = [
  { nombre: "fila válida con datos personales", plan: () => responde(fila(FILA_CON_PII)), rechaza: false },
  { nombre: "data null con status 200 (sin fila)", plan: () => respondeConStatus(null, 200), rechaza: false },
  { nombre: "fila válida con status 204", plan: () => respondeConStatus(fila(FILA_CON_PII), 204), rechaza: false },
  { nombre: "fila inválida (estado) con datos personales", plan: () => responde(fila({ ...FILA_CON_PII, estado: "vencida" })), rechaza: true },
  { nombre: "fila inválida (row_version) con datos personales", plan: () => responde(fila({ ...FILA_CON_PII, row_version: 0 })), rechaza: true },
  { nombre: "fila inválida (fecha) con datos personales", plan: () => responde(fila({ ...FILA_CON_PII, actualizado_at: "ayer" })), rechaza: true },
  { nombre: "fila inválida (correo demasiado largo)", plan: () => responde(fila({ ...FILA_CON_PII, prospecto_email: PII.correo.repeat(20) })), rechaza: true },
  { nombre: "fila con otro id y datos personales", plan: () => responde(fila({ ...FILA_CON_PII, id: ID_B })), rechaza: true },
  { nombre: "fila a la que le falta una clave, con datos personales", plan: () => responde({ ...FILA_CON_PII, id: ID_A }), rechaza: true },
  { nombre: "data que es una cadena con datos personales", plan: () => responde(`${PII.nombre} ${PII.correo} ${PII.telefono}`), rechaza: true },
  { nombre: "fila con un getter que lanza", plan: () => responde(conGetterQueLanza("prospecto_email", fila(FILA_CON_PII))), rechaza: true },
];

describe("registros · ninguna ruta escribe en la consola", () => {
  it("control: los espías ven una llamada a cada método de la consola", () => {
    const consola = espiarConsola();
    for (const metodo of METODOS_DE_CONSOLA) console[metodo]("control");
    expect(consola.llamadas().sort()).toEqual([...METODOS_DE_CONSOLA].sort());
  });

  it("control: tras restaurar, la consola vuelve a ser la original", () => {
    const original = Reflect.get(console, "log");
    const consola = espiarConsola();
    expect(Reflect.get(console, "log")).not.toBe(original);
    for (const espia of espiasActivos.splice(0)) espia.mockRestore();
    expect(Reflect.get(console, "log")).toBe(original);
    expect(consola.llamadas()).toEqual([]);
  });

  describe("listarCotizaciones", () => {
    const escenarios = [...ESCENARIOS_COMUNES_DE_CONSOLA, ...ESCENARIOS_DE_CONSOLA_LISTADO];

    it("el recorrido es amplio (errores, hostiles, filas inválidas con datos personales, éxito)", () => {
      expect(escenarios.length).toBeGreaterThan(90);
    });

    it.each(escenarios.map((e): [string, EscenarioDeConsola] => [e.nombre, e]))("%s", async (_nombre, escenario) => {
      const consola = espiarConsola();
      programar(escenario.plan());
      const resultado = await listarCotizaciones().then(
        () => "resuelve",
        () => "rechaza",
      );
      expect(resultado).toBe(escenario.rechaza ? "rechaza" : "resuelve");
      expect(consola.llamadas()).toEqual([]);
    });

    it.each<[string, () => unknown]>([
      ["pagina 0", () => ({ pagina: 0 })],
      ["tamano 101", () => ({ tamano: 101 })],
      ["opciones null", () => null],
      ["opciones una cadena", () => "x"],
      ["pagina con un getter que lanza", () => conGetterQueLanza("pagina")],
      ["tamano con un getter que lanza", () => conGetterQueLanza("tamano")],
      ["opciones un Proxy revocado", proxyRevocado],
      ["opciones un Proxy con trampa get que lanza", proxyConGetQueLanza],
    ])("parámetros inválidos: %s", async (_nombre, crear) => {
      const consola = espiarConsola();
      const resultado = await listarCotizaciones(hostil<undefined>(crear())).then(
        () => "resuelve",
        () => "rechaza",
      );
      expect(resultado).toBe("rechaza");
      expect(from).not.toHaveBeenCalled();
      expect(consola.llamadas()).toEqual([]);
    });
  });

  describe("obtenerCotizacion", () => {
    const escenarios = [...ESCENARIOS_COMUNES_DE_CONSOLA, ...ESCENARIOS_DE_CONSOLA_DETALLE];

    it("el recorrido es amplio (errores, hostiles, filas inválidas con datos personales, éxito)", () => {
      expect(escenarios.length).toBeGreaterThan(90);
    });

    it.each(escenarios.map((e): [string, EscenarioDeConsola] => [e.nombre, e]))("%s", async (_nombre, escenario) => {
      const consola = espiarConsola();
      programar(escenario.plan());
      const resultado = await obtenerCotizacion(ID_A).then(
        () => "resuelve",
        () => "rechaza",
      );
      expect(resultado).toBe(escenario.rechaza ? "rechaza" : "resuelve");
      expect(consola.llamadas()).toEqual([]);
    });

    it.each<[string, () => unknown]>([
      ["id «xyz»", () => "xyz"],
      ["id vacío", () => ""],
      ["id que no es una cadena", () => 42],
      ["id un Proxy revocado", proxyRevocado],
      ["id con toString que lanza", () => ({ toString: () => { throw new Error(MARCA); } })],
    ])("id inválido: %s", async (_nombre, crear) => {
      const consola = espiarConsola();
      await expect(obtenerCotizacion(hostil<string>(crear()))).resolves.toBeNull();
      expect(from).not.toHaveBeenCalled();
      expect(consola.llamadas()).toEqual([]);
    });
  });

  describe("traducirErrorCotizacion y ErrorCotizacion", () => {
    const ENTRADAS: Array<[string, () => unknown]> = [
      ["un error SQL crudo", () => new Error('duplicate key value violates unique constraint "cotizaciones_pkey"')],
      ["un objeto PostgREST 42501", () => ({ message: "permission denied for table cotizaciones", code: "42501", details: PII.correo, hint: PII.telefono })],
      ...TEXTOS.map(([codigo]): [string, () => unknown] => [`COT:${codigo}`, () => ({ message: `COT:${codigo}`, code: "P0001" })]),
      ...TEXTOS.map(([codigo]): [string, () => unknown] => [`una ErrorCotizacion ${codigo}`, () => new ErrorCotizacion(codigo)]),
      ...HOSTILES.map(([nombre, valor]): [string, () => unknown] => [`el hostil «${nombre}»`, () => valor]),
      ...HOSTILES_ENVUELTOS,
    ];

    it.each(ENTRADAS)("traducir %s no escribe en la consola", (_nombre, crear) => {
      const consola = espiarConsola();
      traducirErrorCotizacion(crear());
      expect(consola.llamadas()).toEqual([]);
    });

    it.each<CodigoErrorCotizacion>([
      "SIN_PERMISO",
      "NO_ENCONTRADA",
      "ESTADO_INVALIDO",
      "CONFLICTO_VERSION",
      "MOTIVO_REQUERIDO",
      "SUSTITUIDA",
      "TOPE_EXCEDIDO",
      "INMUTABLE",
      "DESCONOCIDO",
      "DATOS_INVALIDOS",
      "PARAMETROS_INVALIDOS",
    ])("construir una ErrorCotizacion %s (y leer sus superficies) no escribe en la consola", (codigo) => {
      const consola = espiarConsola();
      const error = new ErrorCotizacion(codigo);
      String(error);
      JSON.stringify(error);
      superficieCompleta(error);
      expect(error.codigo).toBe(codigo);
      expect(consola.llamadas()).toEqual([]);
    });

    it("construir una ErrorCotizacion con un código hostil no escribe en la consola", () => {
      const consola = espiarConsola();
      for (const codigo of CLAVES_DE_PROTOTIPO) new ErrorCotizacion(hostil<CodigoErrorCotizacion>(codigo));
      new ErrorCotizacion(hostil<CodigoErrorCotizacion>(Symbol(MARCA)));
      expect(consola.llamadas()).toEqual([]);
    });
  });
});

/* ------------------------------------------------------------------------------------------------
 * Tipos. Nada de esto se ejecuta: lo comprueba `tsc` (npx tsc -p tsconfig.app.json --noEmit), que
 * también revisa los tests. Si el esquema generado cambia y los tipos del módulo no, tsc falla aquí.
 *
 * Límite conocido: `tsconfig.app.json` tiene `strict: false`, así que tsc no distingue `string` de
 * `string | null`. La nulabilidad de cada columna la fijan las pruebas de ejecución de arriba (cada
 * campo anulable acepta null y los no anulables lo rechazan).
 * ---------------------------------------------------------------------------------------------- */

describe("tipos del módulo (verificados por tsc)", () => {
  type FilaGenerada = Tables<"cotizaciones">;
  type EventoGenerado = Tables<"cotizacion_eventos">;

  it("Cotizacion no se desincroniza de la fila generada Tables<'cotizaciones'>", () => {
    // Todas las columnas salvo `estado` (que el módulo estrecha de string a la unión) son idénticas.
    expectTypeOf<Omit<Cotizacion, "estado">>().toEqualTypeOf<Omit<FilaGenerada, "estado">>();
    // Mismas claves, ni una más ni una menos.
    expectTypeOf<keyof Cotizacion>().toEqualTypeOf<keyof FilaGenerada>();
    // La unión de estados cabe en el `string` de la base.
    expectTypeOf<Cotizacion["estado"]>().toExtend<FilaGenerada["estado"]>();
    // Una Cotizacion es una fila válida de la base.
    expectTypeOf<Cotizacion>().toExtend<FilaGenerada>();
    // `estado` es exactamente EstadoCotizacion.
    expectTypeOf<Cotizacion["estado"]>().toEqualTypeOf<EstadoCotizacion>();
  });

  it("CotizacionResumen es las cinco columnas de la fila generada más el estado estrechado", () => {
    type Esperado = Pick<
      FilaGenerada,
      "id" | "referencia_interna" | "prospecto_nombre" | "creado_at" | "row_version"
    > & { estado: EstadoCotizacion };
    // Una intersección no es «idéntica» a un objeto plano para expect-type, así que se fija con
    // asignabilidad en ambos sentidos (equivale a igualdad estructural) y con las claves exactas.
    expectTypeOf<CotizacionResumen>().toExtend<Esperado>();
    expectTypeOf<Esperado>().toExtend<CotizacionResumen>();
    expectTypeOf<keyof CotizacionResumen>().toEqualTypeOf<keyof Esperado>();
  });

  it("CotizacionEvento no se desincroniza de Tables<'cotizacion_eventos'>", () => {
    expectTypeOf<Omit<CotizacionEvento, "tipo" | "detalle">>().toEqualTypeOf<
      Omit<EventoGenerado, "tipo" | "detalle">
    >();
    expectTypeOf<keyof CotizacionEvento>().toEqualTypeOf<keyof EventoGenerado>();
    expectTypeOf<TipoEventoCotizacion>().toExtend<EventoGenerado["tipo"]>();
    // El detalle del módulo es un objeto sin claves, que es un Json válido y cabe en la columna.
    expectTypeOf<CotizacionEvento["detalle"]>().toExtend<Json>();
    expectTypeOf<CotizacionEvento["detalle"]>().toExtend<EventoGenerado["detalle"]>();
  });

  it("ESTADOS_COTIZACION cubre exactamente los cinco valores del CHECK de la base", () => {
    expect([...ESTADOS_COTIZACION]).toEqual(["borrador", "emitida", "aceptada_firmada", "rechazada", "cancelada"]);
    expectTypeOf(ESTADOS_COTIZACION).toEqualTypeOf<
      readonly ["borrador", "emitida", "aceptada_firmada", "rechazada", "cancelada"]
    >();
    expectTypeOf<EstadoCotizacion>().toEqualTypeOf<
      "borrador" | "emitida" | "aceptada_firmada" | "rechazada" | "cancelada"
    >();
  });

  it("los códigos conocidos son exactamente los 8 de F1 y las funciones públicas conservan su firma", () => {
    // Un código nuevo en la tabla del módulo cambia esta unión y hace fallar tsc; el comportamiento de los
    // códigos de otras fases lo fija la prueba «la tabla tiene exactamente los 8 códigos de F1».
    expectTypeOf<CodigoCotizacionConocido>().toEqualTypeOf<
      | "SIN_PERMISO"
      | "NO_ENCONTRADA"
      | "ESTADO_INVALIDO"
      | "CONFLICTO_VERSION"
      | "MOTIVO_REQUERIDO"
      | "SUSTITUIDA"
      | "TOPE_EXCEDIDO"
      | "INMUTABLE"
    >();
    expect(TEXTOS.map(([codigo]) => codigo)).toEqual([
      "SIN_PERMISO",
      "NO_ENCONTRADA",
      "ESTADO_INVALIDO",
      "CONFLICTO_VERSION",
      "MOTIVO_REQUERIDO",
      "SUSTITUIDA",
      "TOPE_EXCEDIDO",
      "INMUTABLE",
    ]);
    expectTypeOf(esUuid).guards.toEqualTypeOf<string>();
    expectTypeOf(esUuid).parameter(0).toBeUnknown();
    expectTypeOf(traducirErrorCotizacion).toEqualTypeOf<(error: unknown) => string>();
    expectTypeOf(listarCotizaciones).returns.resolves.toEqualTypeOf<CotizacionResumen[]>();
    expectTypeOf(obtenerCotizacion).returns.resolves.toEqualTypeOf<Cotizacion | null>();
    expectTypeOf(obtenerCotizacion).parameters.toEqualTypeOf<[id: string]>();
  });
});
