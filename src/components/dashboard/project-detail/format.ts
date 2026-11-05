/**
 * Formatos del detalle de proyecto, sin React. Solo presentación: ningún valor guardado cambia.
 * Todas las fechas salen en `es-HN`.
 */

import { calendarDayOf } from "@/lib/calendarDate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Texto neutro cuando el responsable de una etapa es un identificador y no un nombre. */
export const RESPONSABLE_ASIGNADO = "Responsable asignado";

/**
 * Quién completó una etapa, para mostrar. El campo guarda texto libre (un nombre que se escribe en el cajón), pero
 * hay filas que traen el identificador de una cuenta: eso nunca se enseña crudo. Sin dato devuelve `null`.
 */
export function responsableLabel(completedBy: string | null | undefined): string | null {
  const value = completedBy?.trim();
  if (!value) return null;
  return UUID.test(value) ? RESPONSABLE_ASIGNADO : value;
}

export const isUuid = (value: string | null | undefined): boolean => UUID.test((value ?? "").trim());

function validDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

/**
 * Mes de un registro de mantenimiento («noviembre de 2026»), en minúscula natural. El valor es una fecha sin hora
 * (`2026-11-01`): se interpreta como UTC y se muestra en UTC. Con la hora local de Honduras (UTC-6) esa fecha
 * caería en el mes anterior.
 */
export function formatMonthLabel(date: string): string {
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00Z` : date);
  if (!validDate(d)) return date;
  return new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Día de calendario de una fecha sin hora (`2026-11-07` → «7 nov 2026»), sin correr por la zona horaria. */
export function formatDateOnly(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  if (!validDate(d)) return date;
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

/** Día de un instante (`completed_at`, `created_at`): «5 oct 2026», en la hora de quien lo mira. */
export function formatInstantDay(iso: string): string {
  const d = new Date(iso);
  if (!validDate(d)) return "—";
  return new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

const MS_PER_DAY = 86_400_000;

/**
 * Día de calendario («YYYY-MM-DD») de la fecha de una etapa (`completed_at`), o `null` si el valor no es una fecha.
 *
 * La columna es `timestamptz`, pero el cajón de etapas guarda ahí el día que se elige como la medianoche UTC de ese
 * día (`2026-10-05T00:00:00.000Z`; Supabase la devuelve como `2026-10-05T00:00:00+00:00`). Medida en hora local, esa
 * medianoche cae en la tarde del día anterior en Honduras (UTC-6). Por eso:
 * - un instante exactamente en 00:00:00.000 UTC es una fecha de calendario codificada por el cajón: su día es el día UTC;
 * - cualquier otro instante es un momento real (p. ej. el `DEFAULT now()` de la columna): su día es el de Honduras,
 *   igual que el resto de las fechas del panel.
 * Solo presentación: lo que se guarda no cambia.
 */
export function stageCalendarDay(completedAt: string | null | undefined): string | null {
  if (typeof completedAt !== "string") return null;
  const honduras = calendarDayOf(completedAt);
  if (honduras === null) return null;
  const ms = Date.parse(completedAt);
  if (Number.isNaN(ms)) return honduras;
  return ms % MS_PER_DAY === 0 ? new Date(ms).toISOString().slice(0, 10) : honduras;
}

/** Fecha de una etapa como día de calendario («5 oct 2026»), igual en cualquier zona; «—» si el valor no es una fecha. */
export function formatStageDay(completedAt: string | null | undefined): string {
  const day = stageCalendarDay(completedAt);
  return day === null ? "—" : formatDateOnly(day);
}

/** Día y hora de un instante: «31 oct 2026, 9:00 a. m.». */
export function formatInstantDateTime(iso: string): string {
  const d = new Date(iso);
  if (!validDate(d)) return "—";
  return new Intl.DateTimeFormat("es-HN", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

/**
 * Importe con su moneda SOLO si está registrada. Sin moneda no se inventa una: el importe sale tal cual y quien
 * lo lee ve que falta el dato (el rótulo de la columna o del campo lo dice).
 */
export function formatMoney(amount: number | string | null | undefined, currency?: string | null): string | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const cur = currency?.trim();
  return cur ? `${amount} ${cur}` : String(amount);
}

type Meta = Record<string, string | number | boolean | string[] | undefined>;

/**
 * Resumen de una línea de los datos de una etapa completada. El importe sale con su moneda SOLO si está
 * registrada (la clave `moneda` no siempre se guarda): sin ella se dice «moneda no registrada» en lugar de
 * suponer USD o HNL. Los valores no se modifican; es solo presentación.
 */
export function stageSummary(stageKey: string, metadata: Record<string, unknown> | null | undefined): string[] {
  if (!metadata || Object.keys(metadata).length === 0) return [];
  const m = metadata as Meta;
  const money = (amount: Meta[string], suffix: string): string | null => {
    if (!amount) return null;
    const cur = typeof m.moneda === "string" ? m.moneda : null;
    return cur?.trim() ? `${formatMoney(amount as string | number, cur)}${suffix}` : `${amount}${suffix} (moneda no registrada)`;
  };
  const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  const parts: Record<string, (string | null)[]> = {
    analisis: [],
    dominio: [text(m.dominio), text(m.proveedor), money(m.precio_anual, "/año")],
    desarrollo: [Array.isArray(m.stack) && m.stack.length ? m.stack.join(", ") : null, text(m.desarrollador)],
    despliegue: [text(m.plataforma), text(m.url_produccion)],
    entrega: [
      m.accesos_entregados ? "Accesos entregados" : null,
      m.documentacion_entregada ? "Documentación entregada" : null,
      m.factura_emitida ? "Factura emitida" : null,
    ],
    mantenimiento: [money(m.precio_mensual, "/mes")],
  };
  return (parts[stageKey] ?? []).filter((p): p is string => Boolean(p));
}
