import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FolderKanban, Plus } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import NewProjectModal from "@/components/dashboard/dashboard-home/NewProjectModal";
import ProjectScopingModal from "@/components/dashboard/requests/ProjectScopingModal";
import BrandLoader from "@/components/common/BrandLoader";
import { Button } from "@/components/ui/button";
import DashboardStats from "@/components/dashboard/dashboard-home/DashboardStats";
import RenewalAlerts from "@/components/dashboard/dashboard-home/RenewalAlerts";
import PendingRequests from "@/components/dashboard/dashboard-home/PendingRequests";
import ProjectCard from "@/components/dashboard/dashboard-home/ProjectCard";
import { useToast } from "@/hooks/use-toast";
import { getProjects, getUpcomingRenewals, getProjectStages } from "@/lib/projects";
import { getProjectRequests } from "@/lib/tickets";
import { type Project, type ProjectService } from "@/types/projects";
import { type Ticket } from "@/types/tickets";

export default function Dashboard() {
  const { user, userType } = useAuth();
  const isAdmin = userType === 0;
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stagesMap, setStagesMap] = useState<Record<string, number>>({});
  const [renewals, setRenewals] = useState<(ProjectService & { nombre_proyecto: string })[]>([]);
  const [requests, setRequests] = useState<(Ticket & { message_count: number })[]>([]);
  const [scopingTicket, setScopingTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(data);

      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (p) => {
          const stages = await getProjectStages(p.id);
          counts[p.id] = stages.length;
        })
      );
      setStagesMap(counts);

      setRenewals(await getUpcomingRenewals(30));

      // Admin-only: project requests ('solicitud') awaiting conversion.
      setRequests(isAdmin ? await getProjectRequests() : []);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, toast]);

  // userType resolves async after mount — re-run once it lands so the
  // admin-only requests query fires with the correct role.
  useEffect(() => { if (userType !== null) load(); }, [userType, load]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-24 pb-10 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="font-display text-xs text-primary mb-1">$ multistack dashboard --list-projects</p>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
              <FolderKanban className="h-6 w-6 text-primary" />
              Proyectos
            </h1>
            <p className="text-xs text-muted-foreground font-mono mt-1">session: {user?.email}</p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            size="sm"
            className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            [ NUEVO ]
          </Button>
        </div>

        <DashboardStats projects={projects} />

        <RenewalAlerts renewals={renewals} />

        {isAdmin && <PendingRequests requests={requests} onSelect={setScopingTicket} />}

        {/* Projects grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <BrandLoader />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-display text-sm">No hay proyectos todavía.</p>
            <p className="text-xs text-muted-foreground mt-1">Crea tu primer proyecto para comenzar.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} completedStages={stagesMap[p.id] ?? 0} />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={load}
      />

      {/* Confirm/populate/save a project from a pending request.
          On success the modal navigates to the new project detail view. */}
      <ProjectScopingModal
        ticket={scopingTicket}
        open={!!scopingTicket}
        onClose={() => setScopingTicket(null)}
        onConverted={load}
      />
    </div>
  );
}
