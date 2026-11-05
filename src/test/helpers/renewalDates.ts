// Apoyo de las pruebas de fechas de renovación (`daysUntil` y `getUpcomingRenewals`): cambio de zona del proceso,
// reloj fijo en hora de Honduras y un cliente Supabase simulado que registra las llamadas y filtra filas ficticias.
// Datos inventados; sin red ni credenciales.

/** Zonas del proceso con las que se prueba. `offset` es lo que debe dar `getTimezoneOffset()` (minutos, signo de JS). */
export const ZONAS = [
  { tz: "UTC", offset: 0 },
  { tz: "America/Tegucigalpa", offset: 360 },
  { tz: "Asia/Tokyo", offset: -540 },
] as const;
export type Zona = (typeof ZONAS)[number];

const TZ_ORIGINAL = process.env.TZ;
// Zona efectiva del proceso al cargar el módulo: `delete process.env.TZ` por sí solo no devuelve Node a ella.
const ZONA_INICIAL = Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Cambia la zona del proceso y comprueba que el cambio surtió efecto. Si no surte efecto (p. ej. un worker que no
 * propaga `process.env.TZ`), lanza: una prueba de zona que corre en la zona equivocada no demuestra nada.
 */
export function aplicarZona(zona: Zona): void {
  process.env.TZ = zona.tz;
  const real = new Date(2026, 0, 1).getTimezoneOffset();
  if (real !== zona.offset) {
    throw new Error(`process.env.TZ=${zona.tz} no surtió efecto: offset ${real}, se esperaba ${zona.offset}`);
  }
}

export function restaurarZona(): void {
  if (TZ_ORIGINAL === undefined) {
    process.env.TZ = ZONA_INICIAL;
    delete process.env.TZ;
  } else process.env.TZ = TZ_ORIGINAL;
}

/** Suma `n` días de calendario a «YYYY-MM-DD» con aritmética UTC pura (independiente de la zona del proceso). */
export function sumarDias(dia: string, n: number): string {
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Instante en que en Honduras (UTC-6, sin horario de verano) son las `hora` («HH:MM», «HH:MM:SS» o
 * «HH:MM:SS.mmm») del día `dia` («YYYY-MM-DD»).
 */
export function instanteHN(dia: string, hora = "00:00"): Date {
  const [hms, ms = "0"] = hora.split(".");
  const [hh, mm, ss = 0] = hms.split(":").map(Number);
  const [y, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + 6, mm, ss, Number(ms.padEnd(3, "0"))));
}

// ── Cliente Supabase simulado ─────────────────────────────────────────────────

export type FilaSimulada = { id: string; renewal_date: string } & Record<string, unknown>;
type Llamada = [metodo: string, args: unknown[]];

const estado = {
  llamadas: [] as Llamada[],
  filas: [] as FilaSimulada[],
  error: null as unknown,
  /** Si no es `undefined`, se devuelve tal cual como `data` (sin filtrar). */
  datos: undefined as unknown,
};

function resolver(): { data: unknown; error: unknown } {
  if (estado.error) return { data: null, error: estado.error };
  if (estado.datos !== undefined) return { data: estado.datos, error: null };
  let filas = [...estado.filas];
  for (const [metodo, args] of estado.llamadas) {
    // Los límites son cadenas «YYYY-MM-DD»: la comparación de texto equivale a la de fechas.
    if (metodo === "gte") filas = filas.filter((f) => String(f[args[0] as string]) >= String(args[1]));
    if (metodo === "lte") filas = filas.filter((f) => String(f[args[0] as string]) <= String(args[1]));
  }
  const orden = estado.llamadas.find(([m]) => m === "order");
  if (orden) {
    const columna = orden[1][0] as string;
    const asc = (orden[1][1] as { ascending?: boolean } | undefined)?.ascending !== false;
    filas.sort((a, b) => (String(a[columna]) < String(b[columna]) ? -1 : String(a[columna]) > String(b[columna]) ? 1 : 0) * (asc ? 1 : -1));
  }
  return { data: filas, error: null };
}

/** Constructor encadenable y «esperable» (thenable), como el de supabase-js. */
function crearConsulta() {
  const consulta = {
    select: (...args: unknown[]) => (estado.llamadas.push(["select", args]), consulta),
    lte: (...args: unknown[]) => (estado.llamadas.push(["lte", args]), consulta),
    gte: (...args: unknown[]) => (estado.llamadas.push(["gte", args]), consulta),
    order: (...args: unknown[]) => (estado.llamadas.push(["order", args]), consulta),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(resolver()).then(resolve, reject),
  };
  return consulta;
}

/** Valor para `vi.mock("@/integrations/supabase/client", ...)`: `{ supabase: clienteSimulado }`. */
export const clienteSimulado = {
  from: (...args: unknown[]) => {
    estado.llamadas = [["from", args]];
    return crearConsulta();
  },
};

export const consultaSimulada = {
  /** Deja el simulado limpio; `filas` son las que existirían en la tabla. */
  reiniciar(opciones: { filas?: FilaSimulada[]; error?: unknown; datos?: unknown } = {}) {
    estado.llamadas = [];
    estado.filas = opciones.filas ?? [];
    estado.error = opciones.error ?? null;
    estado.datos = opciones.datos;
  },
  /** Argumentos de la primera llamada al método (`undefined` si nunca se llamó). */
  args(metodo: string): unknown[] | undefined {
    return estado.llamadas.find(([m]) => m === metodo)?.[1];
  },
  /** Cuántas veces se llamó al método. */
  veces(metodo: string): number {
    return estado.llamadas.filter(([m]) => m === metodo).length;
  },
};
