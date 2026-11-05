import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import NewProjectModal from "@/components/dashboard/dashboard-home/NewProjectModal";
import ProjectScopingModal from "@/components/dashboard/requests/ProjectScopingModal";
import DashboardStats from "@/components/dashboard/dashboard-home/DashboardStats";
import AlertsPanel from "@/components/dashboard/dashboard-home/AlertsPanel";
import RecentProjects from "@/components/dashboard/dashboard-home/RecentProjects";
import QuickAccess from "@/components/dashboard/dashboard-home/QuickAccess";
import RecentActivity from "@/components/dashboard/dashboard-home/RecentActivity";
import UpcomingModules from "@/components/dashboard/dashboard-home/UpcomingModules";
import { isOpenTicket } from "@/components/dashboard/dashboard-home/projectMetrics";
import { loadErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import {
  useDashboardTickets,
  useProjectRequests,
  useProjectsOverview,
  useUpcomingRenewals,
} from "@/components/dashboard/dashboard-home/useDashboardData";
import { type Ticket } from "@/types/tickets";

/** Inicio del panel: «Resumen». La lista completa de proyectos vive en `/dashboard/proyectos`. */
export default function Dashboard() {
  const { userType } = useAuth();
  const isAdmin = userType === 0;
  const [showModal, setShowModal] = useState(false);
  const [scopingTicket, setScopingTicket] = useState<Ticket | null>(null);

  const overview = useProjectsOverview();
  const renewals = useUpcomingRenewals();
  const requests = useProjectRequests();
  const tickets = useDashboardTickets();
  // Tras crear un proyecto o convertir una solicitud se vuelve a pedir todo lo del Resumen.
  const refresh = () => {
    void overview.refetch();
    void renewals.refetch();
    if (isAdmin) void requests.refetch();
    void tickets.refetch();
  };

  const alertsLoading = renewals.isPending || (isAdmin && requests.isPending);
  const alertsFailed = renewals.isError ? renewals : isAdmin && requests.isError ? requests : null;
  const openTickets = tickets.data ? tickets.data.filter((t) => isOpenTicket(t.status)).length : undefined;

  return (
    <div className="container mx-auto max-w-7xl space-y-6 px-4 pb-10 sm:px-6">
      <PageHeader
        title="Resumen"
        description="El estado de tus proyectos y lo que necesita atención hoy."
        actions={
          <Button type="button" size="sm" onClick={() => setShowModal(true)}>
            <Plus aria-hidden="true" />
            Nuevo proyecto
          </Button>
        }
      />

      <DashboardStats
        projects={overview.data?.projects}
        loading={overview.isPending}
        openTickets={openTickets}
        ticketsLoading={tickets.isPending}
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <AlertsPanel
            isAdmin={isAdmin}
            renewals={renewals.data}
            requests={requests.data}
            loading={alertsLoading}
            error={alertsFailed ? loadErrorMessage(alertsFailed.error, "las alertas") : undefined}
            onRetry={() => {
              void renewals.refetch();
              if (isAdmin) void requests.refetch();
            }}
            onSelectRequest={setScopingTicket}
          />
          <RecentProjects
            projects={overview.data?.projects}
            stagesMap={overview.data?.stagesMap}
            loading={overview.isPending}
            error={overview.isError ? loadErrorMessage(overview.error, "los proyectos") : undefined}
            onRetry={() => void overview.refetch()}
            onNewProject={() => setShowModal(true)}
          />
        </div>
        <div className="min-w-0 space-y-6">
          <QuickAccess userType={userType} />
          <RecentActivity
            tickets={tickets.data}
            projects={overview.data?.projects}
            loading={tickets.isPending || overview.isPending}
            error={
              tickets.isError
                ? loadErrorMessage(tickets.error, "la actividad")
                : undefined
            }
            onRetry={() => void tickets.refetch()}
          />
          {isAdmin && <UpcomingModules />}
        </div>
      </div>

      <NewProjectModal open={showModal} onClose={() => setShowModal(false)} onCreated={refresh} />

      {/* Confirmar, completar y guardar un proyecto a partir de una solicitud.
          Si sale bien, el propio modal navega al detalle del proyecto nuevo. */}
      <ProjectScopingModal
        ticket={scopingTicket}
        open={!!scopingTicket}
        onClose={() => setScopingTicket(null)}
        onConverted={refresh}
      />
    </div>
  );
}
