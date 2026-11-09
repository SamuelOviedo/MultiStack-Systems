import { useCallback, useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent } from "react";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TICKET_TYPE_LABELS } from "@/types/tickets";
import { emailLocalPart, formatLongDateTime, formatRelative, formatShortDate } from "./ticketFormat";
import { ariaSortFor, assigneeText, type ListTicket, type SortDir, type SortKey } from "./ticketList";

export interface TicketListProps {
  tickets: ListTicket[];
  /** Reloj de la pantalla (las fechas relativas se calculan contra él). */
  now: Date;
  onOpen: (ticket: ListTicket) => void;
}

/**
 * Anchos de la tabla (diseño fijo: cada columna mide lo que dice aquí y el texto largo se corta con `title`).
 * Ticket no lleva ancho: absorbe lo que sobra, pero nunca baja de ~13 rem. Proyecto y Asignado son porcentaje del
 * ancho de la tabla para que crezcan un poco en pantallas anchas; el resto es fijo porque su contenido (insignias,
 * fechas, cabeceras ordenables) tiene un tamaño conocido. Con el mínimo de la tabla (59,5 rem = 952 px) las ocho
 * columnas caben en 1 280 px con la barra lateral (≈ 960 px de contenido, con barra de desplazamiento incluida).
 * Por debajo se desplaza dentro de su región.
 */
const TABLE_MIN_WIDTH = "min-w-[59.5rem]";
const COL = {
  project: "w-[10.5%]",
  status: "w-[10.75rem]",
  priority: "w-[6.25rem]",
  assignee: "w-[11%]",
  created: "w-20",
  activity: "w-[6.25rem]",
  messages: "w-[5.25rem]",
} as const;
/** Relleno horizontal de las celdas: más justo que el de `ui/table` (12 px) para que quepan ocho columnas. */
const PAD = "px-2.5";

/** Sombra del borde de la columna «Ticket» fija: solo cuando hay contenido desplazado bajo ella. */
const PINNED_SHADOW = "group-data-[scrolled=true]/scroll:shadow-[4px_0_6px_-4px_hsl(var(--foreground)/0.2)]";

interface ScrollEdges {
  /** Hay contenido oculto a la izquierda (la tabla ya se desplazó). */
  left: boolean;
  /** Hay contenido oculto a la derecha. */
  right: boolean;
}

/**
 * Mide la región que desplaza en horizontal (su ancho visible frente al de la tabla) y avisa de qué lado queda
 * contenido oculto. Se recalcula al desplazar y cuando cambia el tamaño de la región o de la tabla.
 */
function useScrollEdges() {
  const tableRef = useRef<HTMLTableElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  const measure = useCallback(() => {
    const box = tableRef.current?.parentElement;
    if (!box) return;
    const hidden = box.scrollWidth - box.clientWidth;
    const next = { left: box.scrollLeft > 1, right: hidden - box.scrollLeft > 1 };
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);

  useLayoutEffect(() => {
    measure();
    const box = tableRef.current?.parentElement;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    if (tableRef.current) observer.observe(tableRef.current);
    return () => observer.disconnect();
  }, [measure]);

  return { tableRef, edges, measure };
}

/** Actividad en dos líneas: lo relativo arriba (lo que se lee de un vistazo) y la fecha corta debajo; la exacta, en `title`. */
function ActivityDate({ iso, now }: { iso: string; now: Date }) {
  return (
    <time dateTime={iso} title={formatLongDateTime(iso)} className="flex flex-col whitespace-nowrap">
      <span className="text-sm text-foreground">{formatRelative(iso, now)}</span>
      <span className="text-xs text-muted-foreground">{formatShortDate(iso, now)}</span>
    </time>
  );
}

/**
 * Fecha de creación (se compara entre filas); la exacta, en `title`. Cabe en una línea («23 oct»); si trae el año
 * («23 oct 2025») el año pasa a la línea de abajo en vez de salirse de la columna.
 */
function CreatedDate({ iso, now }: { iso: string; now: Date }) {
  return (
    <time dateTime={iso} title={formatLongDateTime(iso)} className="text-foreground">
      {formatShortDate(iso, now)}
    </time>
  );
}

/**
 * Responsable: se ve la parte local del correo («ana»), porque el dominio es el mismo para todo el equipo y no
 * aporta nada en una columna estrecha. El correo completo queda en `title` (ratón) y como texto solo para lectores
 * de pantalla (la parte visible se oculta para que no se lea dos veces).
 */
function AssigneeCell({ ticket }: { ticket: ListTicket }) {
  const email = ticket.assignee_email;
  if (!email) {
    return <span className={ticket.assigned_to ? "text-foreground" : "text-muted-foreground"}>{assigneeText(ticket)}</span>;
  }
  return (
    <span className="relative block truncate text-foreground" title={email}>
      <span aria-hidden="true">{emailLocalPart(email)}</span>
      <span className="sr-only">{email}</span>
    </span>
  );
}

function SortHead({
  column, label, sortKey, sortDir, onSort, className,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  const Icon = !active ? ChevronsUpDown : sortDir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead aria-sort={ariaSortFor(column, sortKey, sortDir)} className={cn(PAD, className)}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "-ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 transition-colors hover:text-foreground motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon aria-hidden="true" className={cn("h-3.5 w-3.5", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

/**
 * Tabla de tickets (tableta y escritorio). Las ocho columnas tienen ancho propio y caben en 1 280 px con la barra
 * lateral. Con menos espacio, la región que desplaza en horizontal (con nombre y `tabindex` para moverla con el
 * teclado) deja la columna «Ticket» fija a la izquierda y marca con una sombra el borde por el que hay más
 * contenido; `onScrollableChange` avisa a la pantalla para que muestre el texto de ayuda solo cuando de verdad
 * se desplaza. Cada fila se abre con clic, Enter o Espacio.
 */
export function TicketTable({
  tickets, now, onOpen, sortKey, sortDir, onSort, selectedId, onScrollableChange,
}: TicketListProps & {
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  /** Se llama con `true` mientras la tabla es más ancha que su región (hay columnas fuera de vista). */
  onScrollableChange?: (scrollable: boolean) => void;
}) {
  const { tableRef, edges, measure } = useScrollEdges();
  const scrollable = edges.left || edges.right;

  useEffect(() => {
    onScrollableChange?.(scrollable);
  }, [scrollable, onScrollableChange]);
  useEffect(() => () => onScrollableChange?.(false), [onScrollableChange]);

  const onRowKey = (e: KeyboardEvent<HTMLTableRowElement>, t: ListTicket) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onOpen(t);
    }
  };

  // `data-*` como texto («true»/«false»): Tailwind los lee con `group-data-[…]` y las pruebas, con `dataset`.
  const containerProps: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string> = {
    role: "region",
    tabIndex: 0,
    "aria-label": "Tabla de tickets, se desplaza en horizontal",
    onScroll: measure,
    "data-scrolled": String(edges.left),
    "data-more-right": String(edges.right),
    className: cn(
      "group/scroll overscroll-x-contain",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
    ),
  };

  return (
    <div className="relative overflow-hidden">
      <Table ref={tableRef} className={cn("table-fixed", TABLE_MIN_WIDTH)} containerProps={containerProps}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn("sticky left-0 z-10 bg-subtle pl-4 pr-2.5", PINNED_SHADOW)}>Ticket</TableHead>
            <TableHead className={cn(PAD, COL.project)}>Proyecto</TableHead>
            <TableHead className={cn(PAD, COL.status)}>Estado</TableHead>
            <SortHead column="priority" label="Prioridad" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={COL.priority} />
            <TableHead className={cn(PAD, COL.assignee)}>Asignado</TableHead>
            <SortHead column="created_at" label="Creado" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={COL.created} />
            <SortHead column="updated_at" label="Actividad" sortKey={sortKey} sortDir={sortDir} onSort={onSort} className={COL.activity} />
            <TableHead className={cn(PAD, "pr-4 text-right", COL.messages)}>Mensajes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.map((t) => (
            <TableRow
              key={t.id}
              tabIndex={0}
              data-state={selectedId === t.id ? "selected" : undefined}
              onClick={() => onOpen(t)}
              onKeyDown={(e) => onRowKey(e, t)}
              className="group cursor-pointer hover:bg-transparent data-[state=selected]:bg-[hsl(var(--row-selected))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <TableCell
                className={cn(
                  "sticky left-0 z-[1] bg-card pl-4 pr-2.5 group-data-[state=selected]:bg-[hsl(var(--row-selected))]",
                  // Marca de la fila seleccionada: el fondo oscuro ya no se distingue de la tarjeta, así que la fila
                  // lleva además una barra de 3 px en el color de marca (el estado no depende solo del tono del fondo).
                  "before:absolute before:inset-y-0 before:left-0 before:w-[3px] group-data-[state=selected]:before:bg-primary",
                  PINNED_SHADOW,
                )}
              >
                <p className="line-clamp-2 break-words font-medium text-foreground group-hover:underline" title={t.title}>
                  {t.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">{TICKET_TYPE_LABELS[t.type]}</p>
              </TableCell>
              <TableCell className={cn(PAD, "truncate text-muted-foreground")} title={t.nombre_proyecto || undefined}>
                {t.nombre_proyecto || "—"}
              </TableCell>
              <TableCell className={PAD}>
                <StatusBadge kind="ticket" value={t.status} />
              </TableCell>
              <TableCell className={PAD}>
                <StatusBadge kind="priority" value={t.priority} />
              </TableCell>
              <TableCell className={PAD}>
                <AssigneeCell ticket={t} />
              </TableCell>
              <TableCell className={PAD}>
                <CreatedDate iso={t.created_at} now={now} />
              </TableCell>
              <TableCell className={PAD}>
                <ActivityDate iso={t.updated_at} now={now} />
              </TableCell>
              <TableCell className={cn(PAD, "tabular pr-4 text-right text-muted-foreground")}>{t.message_count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {/* Marca del borde derecho: hay más columnas fuera de vista. Decorativa; el aviso en texto lo da la pantalla. */}
      {edges.right && (
        <span
          aria-hidden="true"
          data-edge="right"
          className="pointer-events-none absolute inset-y-0 right-0 z-20 w-px shadow-[-6px_0_10px_6px_hsl(var(--foreground)/0.1)]"
        />
      )}
    </div>
  );
}
