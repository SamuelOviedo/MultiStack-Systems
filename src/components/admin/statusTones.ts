import { AlertTriangle, CalendarClock, OctagonAlert } from "lucide-react";
import type { ComponentType, SVGProps } from "react";

import type { ProjectStatus } from "@/types/projects";
import type { TicketPriority, TicketStatus } from "@/types/tickets";

/**
 * Tono visual de cada estado REAL del dominio. Las etiquetas salen de
 * `STATUS_CONFIG`, `TICKET_STATUS_CONFIG` y `TICKET_PRIORITY_CONFIG`; aquí solo
 * se decide el tono. Los `Record` exhaustivos hacen fallar la compilación si
 * alguien añade un estado nuevo sin darle tono.
 *
 * Tonos: `success`/`warning`/`destructive`/`info` usan los tokens de estado
 * (nunca hex). `primary` y `neutral` llevan el texto en `foreground` o
 * `muted-foreground` y solo el punto lleva el color, para no depender del
 * contraste del acento de marca.
 */
export type StatusTone = "neutral" | "primary" | "info" | "success" | "warning" | "destructive";

/**
 * Un solo indicador visual por insignia, siempre con texto al lado: ICONO para las alertas (urgente, próxima,
 * vencida) y PUNTO para los estados ordinarios (en progreso, activo, pausado…). Si un `ToneSpec` trae `icon`, la
 * insignia dibuja el icono y NO el punto; `hollow` y `pulse` solo hablan del punto.
 */
export type IndicatorIcon = ComponentType<SVGProps<SVGSVGElement>>;

export interface ToneSpec {
  tone: StatusTone;
  /** Punto hueco (estado terminado o de baja importancia). */
  hollow?: boolean;
  /** Punto con pulso (solo urgente); se apaga con movimiento reducido. */
  pulse?: boolean;
  /** Icono de alerta; sustituye al punto (nunca van los dos). */
  icon?: IndicatorIcon;
  /** Relleno sólido (solo `destructive`): el énfasis extra de «Vencido», que no se confunde con «Urgente». */
  strong?: boolean;
}

/**
 * LA escala de plazo del panel: una sola tabla para la insignia de estado y «Renovaciones próximas». Los límites en
 * días (`URGENT_RENEWAL_DAYS` = 7, `RENEWAL_WINDOW_DAYS` = 30) viven en `projectMetrics.ts`.
 *
 *   vencido (< 0)     rojo, relleno sólido, OctagonAlert  «Vencido hace N días»
 *   urgente (0–7)     rojo tintado,        AlertTriangle  «Urgente · vence en N días»
 *   próximo (8–30)    ámbar,               CalendarClock  «Vence en N días»
 *   vigente (> 30)    neutro, punto hueco                 «Vence en N días»
 *
 * Vencido y urgente comparten el rojo, así que se separan por texto, forma del icono y énfasis (relleno sólido
 * frente a tinte): el color nunca es la única señal.
 */
export type NivelPlazo = "vencido" | "urgente" | "proximo" | "vigente" | "sin_vencimiento";

export const PLAZO_TONE: Record<NivelPlazo, ToneSpec> = {
  vencido: { tone: "destructive", icon: OctagonAlert, strong: true },
  urgente: { tone: "destructive", icon: AlertTriangle },
  proximo: { tone: "warning", icon: CalendarClock },
  vigente: { tone: "neutral", hollow: true },
  sin_vencimiento: { tone: "neutral", hollow: true },
};

/** Palabra de nivel de las alertas de plazo (los niveles ordinarios no la llevan). */
export const PLAZO_ETIQUETA = {
  vencido: "Vencido",
  urgente: "Urgente",
  proximo: "Próxima",
} as const satisfies Partial<Record<NivelPlazo, string>>;

export const PROJECT_STATUS_TONE: Record<ProjectStatus, ToneSpec> = {
  en_analisis: { tone: "warning" },
  en_desarrollo: { tone: "info" },
  en_despliegue: { tone: "info" },
  activo: { tone: "success" },
  mantenimiento: { tone: "primary" },
  pausado: { tone: "neutral" },
  cancelado: { tone: "destructive" },
};

export const TICKET_STATUS_TONE: Record<TicketStatus, ToneSpec> = {
  abierto: { tone: "info" },
  en_revision: { tone: "warning" },
  asignado: { tone: "primary", hollow: true },
  en_progreso: { tone: "primary" },
  resuelto: { tone: "neutral" },
  cerrado: { tone: "neutral", hollow: true },
  convertido: { tone: "success" },
};

export const TICKET_PRIORITY_TONE: Record<TicketPriority, ToneSpec> = {
  baja: { tone: "neutral", hollow: true },
  media: { tone: "neutral" },
  alta: { tone: "warning" },
  urgente: { tone: "destructive", pulse: true },
};
