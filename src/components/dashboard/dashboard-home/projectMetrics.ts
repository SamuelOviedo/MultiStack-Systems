import { PIPELINE_STAGES, type Project, type ProjectStatus } from "@/types/projects";
import type { Ticket, TicketStatus } from "@/types/tickets";

/**
 * Reglas del Inicio y de la lista de proyectos, en un solo sitio y sin React.
 * Son las que ya aplicaba `DashboardStats` / `RenewalAlerts` / `PipelineBar`;
 * `dashboard-home-characterization.test.tsx` las fija.
 */

// ── Grupos de estado (los cuatro contadores y el filtro de la lista) ─────────

export type StatusGroup = "todos" | "activos" | "enProgreso" | "pausados";

const GROUP_STATES: Record<Exclude<StatusGroup, "todos">, readonly ProjectStatus[]> = {
  activos: ["activo", "mantenimiento"],
  enProgreso: ["en_analisis", "en_desarrollo", "en_despliegue"],
  // «Pausados» incluye los cancelados desde siempre.
  pausados: ["pausado", "cancelado"],
};

export function inStatusGroup(estado: ProjectStatus, group: StatusGroup): boolean {
  return group === "todos" || GROUP_STATES[group].includes(estado);
}

export type ProjectCounts = Record<StatusGroup, number>;

export function projectCounts(projects: readonly Project[]): ProjectCounts {
  return {
    todos: projects.length,
    activos: projects.filter((p) => inStatusGroup(p.estado, "activos")).length,
    enProgreso: projects.filter((p) => inStatusGroup(p.estado, "enProgreso")).length,
    pausados: projects.filter((p) => inStatusGroup(p.estado, "pausados")).length,
  };
}

// ── Proyectos recientes ───────────────────────────────────────────────────────

/** Instante de la última novedad de un proyecto: `updated_at` si existe, si no su alta. */
export function lastTouched(p: Pick<Project, "updated_at" | "fecha_creacion">): string {
  return p.updated_at ?? p.fecha_creacion;
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** Los más recientes primero por última actualización; a igual fecha se conserva el orden recibido. */
export function recentProjects(projects: readonly Project[], limit = 6): Project[] {
  return [...projects].sort((a, b) => time(lastTouched(b)) - time(lastTouched(a))).slice(0, limit);
}

// ── Progreso por etapas ───────────────────────────────────────────────────────

export const TOTAL_STAGES = PIPELINE_STAGES.length;

export interface StageProgress {
  /** Etapas registradas, acotadas a 0..6. */
  done: number;
  total: number;
  percent: number;
  /** Nombre de la etapa que toca (la última cuando ya están todas). */
  currentLabel: string;
}

export function stageProgress(completedCount: number): StageProgress {
  const done = Math.min(Math.max(completedCount, 0), TOTAL_STAGES);
  return {
    done,
    total: TOTAL_STAGES,
    percent: Math.round((done / TOTAL_STAGES) * 100),
    currentLabel: PIPELINE_STAGES[Math.min(done, TOTAL_STAGES - 1)].label,
  };
}

// ── Renovaciones ──────────────────────────────────────────────────────────────

/** Ventana de la consulta de renovaciones, en días. */
export const RENEWAL_WINDOW_DAYS = 30;
/** Hasta cuántos días faltan para considerar urgente una renovación (límite incluido). */
export const URGENT_RENEWAL_DAYS = 7;

export const isUrgentRenewal = (days: number): boolean => days <= URGENT_RENEWAL_DAYS;

export function renewalWhen(days: number): string {
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  return `en ${days} días`;
}

/**
 * Día de calendario «2 nov» de una fecha `yyyy-mm-dd`. Se arma en hora local a propósito: `new Date("2026-11-14")`
 * es medianoche UTC y en Honduras (UTC-6) se vería un día antes.
 */
export function formatCalendarDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("es-HN", { day: "numeric", month: "short" });
}

// ── Tickets ───────────────────────────────────────────────────────────────────

/** Mismo conjunto que `getOpenTicketsCount` (insignia del menú) y el contador de `TicketsGlobal`. */
const OPEN_TICKET_STATUSES: readonly TicketStatus[] = ["abierto", "en_revision", "en_progreso"];

export const isOpenTicket = (status: TicketStatus): boolean => OPEN_TICKET_STATUSES.includes(status);

// ── Actividad reciente (derivada de datos reales) ────────────────────────────

export interface ActivityItem {
  id: string;
  kind: "ticket" | "project";
  /** Instante ISO del hecho. */
  at: string;
  /** Qué pasó, en una frase («Ticket actualizado»). */
  what: string;
  /** Sobre qué (título del ticket o nombre del proyecto). */
  subject: string;
  /** Contexto corto: proyecto del ticket o cliente del proyecto. */
  context: string | null;
  ticketStatus?: TicketStatus;
}

type ActivityTicket = Pick<Ticket, "id" | "title" | "status" | "created_at" | "updated_at"> & {
  nombre_proyecto?: string;
};

/**
 * No existe una bitácora de eventos en la base: se deriva de lo que sí hay.
 * Un ticket aporta su `updated_at` («nuevo» si nunca cambió desde que entró) y un proyecto su fecha de alta.
 */
export function buildActivity(
  tickets: readonly ActivityTicket[],
  projects: readonly Pick<Project, "id" | "nombre_proyecto" | "client_name" | "fecha_creacion">[],
  limit = 6,
): ActivityItem[] {
  const fromTickets: ActivityItem[] = tickets.map((t) => ({
    id: `ticket-${t.id}`,
    kind: "ticket",
    at: t.updated_at,
    what: t.updated_at === t.created_at ? "Ticket nuevo" : "Ticket actualizado",
    subject: t.title,
    context: t.nombre_proyecto || null,
    ticketStatus: t.status,
  }));
  const fromProjects: ActivityItem[] = projects.map((p) => ({
    id: `project-${p.id}`,
    kind: "project",
    at: p.fecha_creacion,
    what: "Proyecto creado",
    subject: p.nombre_proyecto,
    context: p.client_name,
  }));
  return [...fromTickets, ...fromProjects].sort((a, b) => time(b.at) - time(a.at)).slice(0, limit);
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────

/** Minúsculas y sin acentos, para buscar «analisis» y encontrar «Análisis». */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function matchesQuery(p: Pick<Project, "nombre_proyecto" | "client_name" | "descripcion">, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return [p.nombre_proyecto, p.client_name, p.descripcion].some((v) => v && normalizeText(v).includes(q));
}
