// Fechas de calendario e instantes, medidos en el día comercial de Honduras.
//
// - Una fecha de calendario («2026-11-04», columna Postgres `date`) es un día sin hora ni zona: se toma literal.
// - Un instante («2026-11-04T03:00:00Z», `timestamptz`) es un punto en el tiempo: su día depende de dónde se mire.
//
// El negocio opera en Honduras, así que «hoy» y el día de un instante se miden siempre en una zona fija
// (`COMMERCIAL_TIME_ZONE`), nunca en la del proceso: CI corre en UTC y un navegador puede estar en cualquier zona.
// La aritmética de días va en UTC puro, donde todos los días duran 24 h.
//
// Dominio: años 0100-9999. Los años 0-99 se rechazan: `Date.UTC` los convierte en 1900-1999 e `Intl` cambia a eras
// antes del año 1, y ninguno es una fecha real del negocio.

export const COMMERCIAL_TIME_ZONE = "America/Tegucigalpa";

const MS_PER_DAY = 86_400_000;
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Fecha y hora (`T` o espacio), segundos y fracción opcionales, zona opcional: `Z`, `±HH:MM`, `±HHMM` o `±HH`. */
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(?:(Z)|([+-])(\d{2})(?::?(\d{2}))?)?$/;

/** Días desde 1970-01-01 de una fecha «YYYY-MM-DD» válida; `NaN` si no lo es (incluidas fechas imposibles). */
function epochDay(text: string): number {
  const match = typeof text === "string" ? CALENDAR_DATE.exec(text) : null;
  if (!match) return NaN;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (y < 100 || m < 1 || m > 12 || d < 1 || d > lastDayOfMonth) return NaN;
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

const isValidDay = (text: string): boolean => !Number.isNaN(epochDay(text));
const atMost = (field: string | undefined, max: number): boolean => field === undefined || Number(field) <= max;

let commercialFormat: Intl.DateTimeFormat | undefined;

/** Día de calendario en que cae el instante `ms` en la zona comercial; `null` fuera del dominio. */
function dayInCommercialZone(ms: number): string | null {
  // Se crea al primer uso: si el motor no conociera la zona, falla la llamada y no la carga del módulo. Calendario
  // gregoriano y dígitos latinos fijados en la etiqueta; las partes se leen con `formatToParts`, no del texto.
  if (!commercialFormat) {
    commercialFormat = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone: COMMERCIAL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    });
  }
  const parts = commercialFormat.formatToParts(ms);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const day = `${part("year").padStart(4, "0")}-${part("month")}-${part("day")}`;
  return isValidDay(day) ? day : null;
}

/** «Hoy comercial»: día de calendario («YYYY-MM-DD») del instante `now` en Honduras, sea cual sea la zona del proceso. */
export function commercialToday(now: number | Date = Date.now()): string {
  const day = dayInCommercialZone(typeof now === "number" ? now : now.getTime());
  if (day === null) throw new RangeError("Instante fuera del dominio de fechas (años 0100-9999)");
  return day;
}

/**
 * Día de calendario («YYYY-MM-DD») que representa `value`, o `null` si no es válido:
 * - «YYYY-MM-DD»: la fecha literal (las imposibles, como «2026-02-30», dan `null`).
 * - Fecha y hora con zona: un instante; su día en Honduras.
 * - Fecha y hora sin zona: hora de pared de Honduras; su parte de fecha.
 */
export function calendarDayOf(value: string): string | null {
  if (typeof value !== "string") return null;
  if (CALENDAR_DATE.test(value)) return isValidDay(value) ? value : null;
  const match = DATE_TIME.exec(value);
  if (!match) return null;
  const [, day, hh, mm, ss, fraction, utc, sign, offsetH, offsetM] = match;
  if (!isValidDay(day) || !atMost(hh, 23) || !atMost(mm, 59) || !atMost(ss, 59)) return null;
  if (!utc && !sign) return day;
  if (!atMost(offsetH, 23) || !atMost(offsetM, 59)) return null;
  // Forma canónica de ECMAScript para no depender de lo que tolere cada motor (Safari es más estricto que V8). La
  // fracción se trunca a milisegundos: redondear podría pasar un «23:59:59.9999» al día siguiente.
  const ms = (fraction ?? "").slice(0, 3).padEnd(3, "0");
  const zone = utc ? "Z" : `${sign}${offsetH}:${offsetM ?? "00"}`;
  const instant = Date.parse(`${day}T${hh}:${mm}:${ss ?? "00"}.${ms}${zone}`);
  return Number.isNaN(instant) ? null : dayInCommercialZone(instant);
}

/**
 * Suma `n` días de calendario a «YYYY-MM-DD». Lanza `RangeError` si la fecha no es válida, si `n` no es entero o si
 * el resultado sale del dominio.
 */
export function addCalendarDays(day: string, n: number): string {
  const start = epochDay(day);
  if (Number.isNaN(start) || !Number.isSafeInteger(n)) throw new RangeError(`Suma de días inválida: ${day} + ${n}`);
  // Medianoche UTC: `toISOString` da exactamente ese día, sin pasar por la zona del proceso.
  const result = new Date((start + n) * MS_PER_DAY).toISOString().slice(0, 10);
  if (!isValidDay(result)) throw new RangeError(`Suma de días fuera del dominio: ${day} + ${n}`);
  return result;
}

/** Días de calendario de `from` a `to` (negativo si `to` es anterior; nunca `-0`); `NaN` si alguna no es válida. */
export function calendarDaysBetween(from: string, to: string): number {
  return epochDay(to) - epochDay(from);
}
