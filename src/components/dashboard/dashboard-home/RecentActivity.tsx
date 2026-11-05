import { useMemo } from "react";
import { History } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buildActivity } from "@/components/dashboard/dashboard-home/projectMetrics";
import { type Project } from "@/types/projects";
import { type Ticket } from "@/types/tickets";

const MAX_ITEMS = 6;

type ActivityTicket = Ticket & { nombre_proyecto?: string };

export interface RecentActivityProps {
  tickets?: readonly ActivityTicket[];
  projects?: readonly Project[];
  loading: boolean;
  error?: string;
  onRetry: () => void;
}

const WHEN: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };

/**
 * No hay un registro de eventos en la base: lo que se muestra se deriva de datos reales (tickets por su última
 * actualización y proyectos por su fecha de alta). Si no hay nada, lo dice.
 */
export default function RecentActivity({ tickets, projects, loading, error, onRetry }: RecentActivityProps) {
  const items = useMemo(() => buildActivity(tickets ?? [], projects ?? [], MAX_ITEMS), [tickets, projects]);
  return (
    <Panel
      title="Actividad reciente"
      description="Tickets y proyectos con novedades."
      loading={loading}
      skeletonRows={4}
      error={error}
      onRetry={onRetry}
      isEmpty={items.length === 0}
      empty={<EmptyState icon={History} title="Aún no hay actividad que mostrar" headingLevel="h3" />}
    >
      <ol className="space-y-4">
        {items.map((a) => (
          <li key={a.id} className="space-y-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words text-sm font-medium">{a.what}</p>
              {a.ticketStatus && <StatusBadge kind="ticket" value={a.ticketStatus} />}
            </div>
            <p className="break-words text-sm">{a.subject}</p>
            <p className="break-words text-xs text-muted-foreground">
              {a.context ? `${a.context} · ` : ""}
              <time dateTime={a.at}>{new Date(a.at).toLocaleString("es-HN", WHEN)}</time>
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
