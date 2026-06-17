import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import NewProjectModal from "@/components/dashboard/NewProjectModal";
import ProjectScopingModal from "@/components/dashboard/ProjectScopingModal";
import {
  FolderKanban, Plus, AlertTriangle, ChevronRight,
  Activity, Clock, CheckCircle2, PauseCircle, Inbox, FolderGit2,
} from "lucide-react";
import BrandLoader from "@/components/BrandLoader";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getProjects, getUpcomingRenewals, daysUntil } from "@/lib/projects";
import { getProjectStages } from "@/lib/projects";
import { getProjectRequests } from "@/lib/tickets";
import { PIPELINE_STAGES, STATUS_CONFIG, type Project, type ProjectService } from "@/types/projects";
import { type Ticket } from "@/types/tickets";

const TOTAL_STAGES = PIPELINE_STAGES.length;

function PipelineBar({ completedCount }: { completedCount: number }) {
  const pct = Math.round((completedCount / TOTAL_STAGES) * 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground font-mono">
          {PIPELINE_STAGES[Math.min(completedCount, TOTAL_STAGES - 1)].label}
        </span>
        <span className="text-[10px] text-primary font-mono">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex mt-1 gap-0.5">
        {PIPELINE_STAGES.map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 h-0.5 rounded-full ${i < completedCount ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}

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
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("profiles").select("nombre_usuario").eq("id", user.id).single()
      .then(({ data }: any) => setNombreUsuario(data?.nombre_usuario ?? null));
  }, [user]);

  const load = async () => {
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

      const ren = await getUpcomingRenewals(30);
      setRenewals(ren);

      // Admin-only: project requests ('solicitud') awaiting conversion
      if (isAdmin) {
        const reqs = await getProjectRequests();
        setRequests(reqs);
      } else {
        setRequests([]);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // userType resolves async after mount — re-run once it lands so the
  // admin-only requests query fires with the correct role.
  useEffect(() => { if (userType !== null) load(); }, [userType]);

  const statCounts = {
    total:       projects.length,
    activos:     projects.filter(p => p.estado === 'activo' || p.estado === 'mantenimiento').length,
    desarrollo:  projects.filter(p => ['en_analisis','en_desarrollo','en_despliegue'].includes(p.estado)).length,
    pausados:    projects.filter(p => p.estado === 'pausado' || p.estado === 'cancelado').length,
  };

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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { icon: FolderKanban,  label: 'Total',       value: statCounts.total,      color: 'text-foreground' },
            { icon: Activity,      label: 'Activos',      value: statCounts.activos,     color: 'text-primary' },
            { icon: Clock,         label: 'En progreso',  value: statCounts.desarrollo,  color: 'text-accent' },
            { icon: PauseCircle,   label: 'Pausados',     value: statCounts.pausados,    color: 'text-muted-foreground' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-3.5 w-3.5 ${color}`} />
                <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
              </div>
              <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Renewal alerts */}
        {renewals.length > 0 && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="font-mono text-xs text-warning">Renovaciones próximas (30 días)</span>
            </div>
            <div className="space-y-2">
              {renewals.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-foreground">
                    {r.nombre_proyecto} — <span className="text-foreground">{r.name}</span>
                  </span>
                  <span className={`font-mono font-medium ${daysUntil(r.renewal_date!) <= 7 ? 'text-destructive' : 'text-warning'}`}>
                    {daysUntil(r.renewal_date!)}d
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Project requests awaiting conversion — admin only */}
        {isAdmin && requests.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4 mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Inbox className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs text-primary">
                Solicitudes de proyecto pendientes ({requests.length})
              </span>
            </div>
            <div className="space-y-2">
              {requests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-display text-xs text-foreground truncate">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                      {r.client_name || "—"}
                      {r.client_email ? ` · ${r.client_email}` : ""}
                      {` · ${new Date(r.created_at).toLocaleDateString("es-HN")}`}
                    </p>
                  </div>
                  <Button
                    onClick={() => setScopingTicket(r)}
                    size="sm"
                    className="shrink-0 font-display text-[10px] bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20"
                  >
                    <FolderGit2 className="h-3.5 w-3.5" />
                    [ CONFIRMAR PROYECTO ]
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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
            {projects.map((p) => {
              const cfg = STATUS_CONFIG[p.estado] ?? STATUS_CONFIG.en_analisis;
              const completed = stagesMap[p.id] ?? 0;
              return (
                <Link
                  key={p.id}
                  to={`/dashboard/project/${p.id}`}
                  className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors group block"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {p.nombre_proyecto}
                    </h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
                  </div>

                  <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${cfg.color}`}>
                    {cfg.label}
                  </span>

                  {p.client_name && (
                    <p className="text-[11px] text-muted-foreground font-mono mt-2">{p.client_name}</p>
                  )}
                  {p.descripcion && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>
                  )}

                  <PipelineBar completedCount={completed} />

                  <p className="text-[10px] text-muted-foreground font-mono mt-3">
                    {new Date(p.fecha_creacion).toLocaleDateString("es-HN")}
                  </p>
                </Link>
              );
            })}
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
