import { MessageSquare } from "lucide-react";

import { StatusBadge } from "@/components/admin/StatusBadge";
import { cn } from "@/lib/utils";
import { TICKET_TYPE_LABELS } from "@/types/tickets";
import { formatLongDateTime, formatRelative, formatShortDate } from "./ticketFormat";
import { assigneeText } from "./ticketList";
import type { TicketListProps } from "./TicketTable";

/**
 * Lista apilada para pantallas angostas (≤ 640 px). Cada ticket es un botón de ancho completo con cuatro líneas:
 * título y mensajes; tipo, proyecto y fecha de creación; estado y prioridad; y quién lo atiende con la última actividad. No se
 * pierde ningún dato de la tabla (prioridad y estado siempre visibles, con texto).
 */
export function TicketCards({ tickets, now, onOpen }: TicketListProps) {
  return (
    <ul className="divide-y">
      {tickets.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onOpen(t)}
            className={cn(
              "flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors motion-reduce:transition-none",
              "active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            )}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="line-clamp-2 min-w-0 break-words font-medium text-foreground">{t.title}</span>
              <span className="tabular flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare aria-hidden="true" className="h-3.5 w-3.5" />
                {t.message_count}
                <span className="sr-only">{t.message_count === 1 ? "mensaje" : "mensajes"}</span>
              </span>
            </span>
            <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">
                {TICKET_TYPE_LABELS[t.type]}
                {t.nombre_proyecto ? ` en ${t.nombre_proyecto}` : ""}
              </span>
              <time dateTime={t.created_at} title={formatLongDateTime(t.created_at)} className="shrink-0">
                Creado {formatShortDate(t.created_at, now)}
              </time>
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="ticket" value={t.status} />
              <StatusBadge kind="priority" value={t.priority} />
            </span>
            <span className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span className="min-w-0 truncate">{assigneeText(t)}</span>
              <time dateTime={t.updated_at} title={formatLongDateTime(t.updated_at)} className="shrink-0">
                Actividad {formatRelative(t.updated_at, now)}
              </time>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
