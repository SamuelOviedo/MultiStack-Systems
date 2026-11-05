import { CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { Panel } from "@/components/admin/Panel";
import PendingRequests from "@/components/dashboard/dashboard-home/PendingRequests";
import RenewalAlerts from "@/components/dashboard/dashboard-home/RenewalAlerts";
import { RENEWAL_WINDOW_DAYS } from "@/components/dashboard/dashboard-home/projectMetrics";
import { type ProjectService } from "@/types/projects";
import { type Ticket } from "@/types/tickets";

type Renewal = ProjectService & { nombre_proyecto: string };
type Request = Ticket & { message_count: number };

export interface AlertsPanelProps {
  isAdmin: boolean;
  renewals?: readonly Renewal[];
  requests?: readonly Request[];
  loading: boolean;
  /** Mensaje ya en español si alguna de las lecturas falló. */
  error?: string;
  onRetry: () => void;
  onSelectRequest: (ticket: Ticket) => void;
}

/** Lo que necesita atención: solicitudes por confirmar (solo administrador) y renovaciones próximas. */
export default function AlertsPanel({
  isAdmin,
  renewals = [],
  requests = [],
  loading,
  error,
  onRetry,
  onSelectRequest,
}: AlertsPanelProps) {
  const visibleRequests = isAdmin ? requests : [];
  return (
    <Panel
      title="Alertas"
      description={
        isAdmin
          ? `Proyectos por confirmar y renovaciones de los próximos ${RENEWAL_WINDOW_DAYS} días.`
          : `Renovaciones de los próximos ${RENEWAL_WINDOW_DAYS} días.`
      }
      loading={loading}
      skeletonRows={4}
      error={error}
      onRetry={onRetry}
      isEmpty={visibleRequests.length === 0 && renewals.length === 0}
      empty={
        <EmptyState
          icon={CheckCircle2}
          title="Todo al día"
          description={
            isAdmin
              ? `No hay renovaciones en los próximos ${RENEWAL_WINDOW_DAYS} días ni proyectos por confirmar.`
              : `No hay renovaciones en los próximos ${RENEWAL_WINDOW_DAYS} días.`
          }
          headingLevel="h3"
        />
      }
    >
      <div className="space-y-5">
        {isAdmin && <PendingRequests requests={visibleRequests} onSelect={onSelectRequest} />}
        <RenewalAlerts renewals={renewals} />
      </div>
    </Panel>
  );
}
