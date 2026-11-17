import type { StatusTone } from "@/components/admin/statusTones";
import { COMMERCIAL_TIME_ZONE } from "@/lib/calendarDate";
import type { EstadoCotizacion } from "@/types/cotizaciones";

/**
 * Presentación compartida por el listado y el detalle de cotizaciones, sin React. Solo textos y formatos:
 * ningún valor guardado cambia, y todo se muestra como texto plano.
 */

/** Marcador de un dato que no se registró (valor `null` o vacío). */
export const SIN_DATO = "Sin dato";

/** Marcador del nombre del prospecto en el listado, donde la columna es «Prospecto». */
export const SIN_NOMBRE = "Sin nombre";

/** El valor si tiene texto; `null` si es `null` o solo espacios (para mostrar el marcador). */
export function textoONulo(valor: string | null): string | null {
  return valor !== null && valor.trim() !== "" ? valor : null;
}

export interface PresentacionEstado {
  label: string;
  tone: StatusTone;
  hollow?: boolean;
}

/**
 * Etiqueta en español y tono de cada estado, para `<StatusBadge kind="custom" {...} />`. El `Record` es exhaustivo:
 * añadir un estado a `ESTADOS_COTIZACION` sin darle etiqueta y tono no compila. Los tonos son los del panel
 * (tokens, nunca hex) y el estado nunca depende solo del color: la insignia lleva siempre el texto.
 */
const PRESENTACION_ESTADO: Record<EstadoCotizacion, PresentacionEstado> = {
  borrador: { label: "Borrador", tone: "neutral", hollow: true },
  emitida: { label: "Emitida", tone: "info" },
  aceptada_firmada: { label: "Aceptada y firmada", tone: "success" },
  rechazada: { label: "Rechazada", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "neutral" },
};

export function presentacionDeEstado(estado: EstadoCotizacion): PresentacionEstado {
  return PRESENTACION_ESTADO[estado];
}

// Las fechas se muestran en el día comercial de Honduras (`COMMERCIAL_TIME_ZONE`), no en la zona del navegador ni
// del proceso: una cotización creada a las 9 p. m. del 9 de noviembre cae en el 10 en UTC, y el negocio la
// reconoce como del 9. Los formateadores se crean al primer uso (como en `calendarDate.ts`).
let formatoDia: Intl.DateTimeFormat | undefined;
let formatoDiaYHora: Intl.DateTimeFormat | undefined;
let formatoHora: Intl.DateTimeFormat | undefined;

function leerInstante(iso: string): Date | null {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** «9 nov 2026». Un valor que no es una fecha da `SIN_DATO` (nunca «Invalid Date»). */
export function formatearDia(iso: string): string {
  const fecha = leerInstante(iso);
  if (fecha === null) return SIN_DATO;
  if (!formatoDia) {
    formatoDia = new Intl.DateTimeFormat("es-HN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: COMMERCIAL_TIME_ZONE,
    });
  }
  return formatoDia.format(fecha);
}

/** «9:00 p. m. GMT-6» (la hora de `formatearDiaYHora`, sin el día). Un valor que no es una fecha da `null`. */
export function formatearHora(iso: string): string | null {
  const fecha = leerInstante(iso);
  if (fecha === null) return null;
  if (!formatoHora) {
    formatoHora = new Intl.DateTimeFormat("es-HN", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: COMMERCIAL_TIME_ZONE,
    });
  }
  return formatoHora.format(fecha);
}

/** «9 nov 2026, 9:00 p. m. GMT-6»: con la zona a la vista, porque no es necesariamente la de quien mira. */
export function formatearDiaYHora(iso: string): string {
  const fecha = leerInstante(iso);
  if (fecha === null) return SIN_DATO;
  if (!formatoDiaYHora) {
    formatoDiaYHora = new Intl.DateTimeFormat("es-HN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: COMMERCIAL_TIME_ZONE,
    });
  }
  return formatoDiaYHora.format(fecha);
}
