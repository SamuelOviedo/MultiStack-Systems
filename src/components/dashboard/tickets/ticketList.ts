import { normalizeText } from "@/components/dashboard/dashboard-home/projectMetrics";
import type { Ticket, TicketPriority, TicketStatus, TicketType } from "@/types/tickets";

/**
 * Reglas de la lista de tickets (`/dashboard/tickets`), sin interfaz: filtros, órdenes y conteos. Son las mismas
 * que tenía la pantalla antes del rediseño (las fija `tickets-characterization.test.tsx`); aquí solo se sacaron
 * del componente para probarlas por separado.
 */

export type ListTicket = Ticket & { nombre_proyecto: string; message_count: number };

export type SortKey = "updated_at" | "created_at" | "priority";
export type SortDir = "asc" | "desc";

/** Valor de «sin filtro» en un selector (Radix no admite la cadena vacía como valor). */
export const ALL = "__all__";
/** Valor de «sin asignar» en el filtro y en el selector de asignación. */
export const UNASSIGNED = "__none__";

const PRIORITY_ORDER: Record<string, number> = { urgente: 4, alta: 3, media: 2, baja: 1 };

/** Un ticket cuenta como abierto en el estado «recibido», «en revisión» o «en progreso» (como la insignia del menú). */
export const OPEN_STATUSES: readonly TicketStatus[] = ["abierto", "en_revision", "en_progreso"];

export interface TicketFilters {
  status: TicketStatus | typeof ALL;
  type: TicketType | typeof ALL;
  priority: TicketPriority | typeof ALL;
  project: string;
  assignee: string;
  /** Búsqueda libre, sin distinguir mayúsculas ni acentos. */
  query: string;
}

export const NO_FILTERS: TicketFilters = { status: ALL, type: ALL, priority: ALL, project: ALL, assignee: ALL, query: "" };

export const isOpen = (t: Pick<Ticket, "status">): boolean => OPEN_STATUSES.includes(t.status);
export const countOpen = (tickets: readonly Pick<Ticket, "status">[]): number => tickets.filter(isOpen).length;
export const countUrgentOpen = (tickets: readonly Pick<Ticket, "status" | "priority">[]): number =>
  tickets.filter((t) => isOpen(t) && t.priority === "urgente").length;

export function hasActiveFilters(f: TicketFilters): boolean {
  return (
    f.status !== ALL || f.type !== ALL || f.priority !== ALL || f.project !== ALL || f.assignee !== ALL ||
    f.query.trim() !== ""
  );
}

/** Proyectos distintos (sin el vacío), en orden alfabético. */
export const distinctProjects = (tickets: readonly ListTicket[]): string[] =>
  Array.from(new Set(tickets.map((t) => t.nombre_proyecto))).filter(Boolean).sort();

/** Correos de responsables distintos, en orden alfabético. */
export const distinctAssignees = (tickets: readonly ListTicket[]): string[] =>
  Array.from(new Set(tickets.map((t) => t.assignee_email).filter(Boolean) as string[])).sort();

function matchesQuery(t: ListTicket, query: string): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  return [t.title, t.nombre_proyecto, t.client_name, t.client_email, t.assignee_email].some(
    (v) => v && normalizeText(v).includes(q),
  );
}

export function applyFilters(tickets: readonly ListTicket[], f: TicketFilters): ListTicket[] {
  return tickets.filter(
    (t) =>
      (f.status === ALL || t.status === f.status) &&
      (f.type === ALL || t.type === f.type) &&
      (f.priority === ALL || t.priority === f.priority) &&
      (f.project === ALL || t.nombre_proyecto === f.project) &&
      (f.assignee === ALL || (f.assignee === UNASSIGNED ? !t.assigned_to : t.assignee_email === f.assignee)) &&
      matchesQuery(t, f.query),
  );
}

/** Ordena una copia. El orden es estable: los empates conservan el orden en que llegaron. */
export function sortTickets(tickets: readonly ListTicket[], key: SortKey, dir: SortDir): ListTicket[] {
  return [...tickets].sort((a, b) => {
    const cmp =
      key === "priority"
        ? (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0)
        : new Date(a[key]).getTime() - new Date(b[key]).getTime();
    return dir === "asc" ? cmp : -cmp;
  });
}

/** Quién atiende el ticket, en palabras (nunca un identificador). */
export function assigneeText(t: ListTicket): string {
  return t.assignee_email ?? (t.assigned_to ? "Asignado" : "Sin asignar");
}

/** Valor de `aria-sort` de una columna ordenable. */
export const ariaSortFor = (column: SortKey, key: SortKey, dir: SortDir): "ascending" | "descending" | "none" =>
  column !== key ? "none" : dir === "asc" ? "ascending" : "descending";
