import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import BrandLoader from "@/components/common/BrandLoader";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { safeProjectStatus } from "@/components/dashboard/dashboard-home/projectStatus";
import StageDrawer from "@/components/dashboard/project-detail/StageDrawer";
import ServiceForm from "@/components/dashboard/project-detail/ServiceForm";
import PipelineHeader from "@/components/dashboard/project-detail/PipelineHeader";
import ProjectIdentityCard, {
  type ProjectEditForm,
} from "@/components/dashboard/project-detail/ProjectIdentityCard";
import ContentTabs from "@/components/dashboard/project-detail/ContentTabs";
import { formatInstantDay } from "@/components/dashboard/project-detail/format";
import { useToast } from "@/hooks/use-toast";
import {
  getProject, getProjectStages, getProjectServices, getProjectMaintenance,
  deleteService, updateProject,
} from "@/lib/projects";
import { getProjectTickets, getProjectTokens } from "@/lib/tickets";
import {
  PIPELINE_STAGES,
  type Project, type ProjectStage, type ProjectService,
  type ProjectMaintenance, type ProjectStatus, type PipelineStage,
} from "@/types/projects";
import { type Ticket, type ClientAccessToken } from "@/types/tickets";

const EMPTY_EDIT_FORM: ProjectEditForm = {
  nombre_proyecto: "", descripcion: "", client_name: "",
  client_email: "", client_phone: "", estado: "" as ProjectStatus,
  google_docs_requirements_url: "",
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [services, setServices] = useState<ProjectService[]>([]);
  const [maintenance, setMaintenance] = useState<ProjectMaintenance[]>([]);
  const [tickets, setTickets] = useState<(Ticket & { message_count: number })[]>([]);
  const [tokens, setTokens] = useState<ClientAccessToken[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [pipelineCollapsed, setPipelineCollapsed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<ProjectEditForm>(EMPTY_EDIT_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [p, stg, svc, mnt, tix, tok] = await Promise.all([
        getProject(id),
        getProjectStages(id),
        getProjectServices(id),
        getProjectMaintenance(id),
        getProjectTickets(id),
        getProjectTokens(id),
      ]);
      setProject(p); setStages(stg); setServices(svc);
      setMaintenance(mnt); setTickets(tix); setTokens(tok);
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => { load(); }, [load]);

  // Auto-colapsar pipeline cuando el proyecto está completo o casi.
  useEffect(() => {
    if (stages.length >= PIPELINE_STAGES.length - 1) {
      setPipelineCollapsed(true);
    }
  }, [stages]);

  const startEdit = useCallback(() => {
    if (!project) return;
    setEditForm({
      nombre_proyecto: project.nombre_proyecto,
      descripcion: project.descripcion ?? "",
      client_name: project.client_name ?? "",
      client_email: project.client_email ?? "",
      client_phone: project.client_phone ?? "",
      estado: project.estado,
      google_docs_requirements_url: project.google_docs_requirements_url ?? "",
    });
    setEditing(true);
  }, [project]);

  const saveEdit = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateProject(id, {
        nombre_proyecto: editForm.nombre_proyecto,
        descripcion: editForm.descripcion || null,
        client_name: editForm.client_name || null,
        client_email: editForm.client_email || null,
        client_phone: editForm.client_phone || null,
        estado: editForm.estado,
        google_docs_requirements_url: editForm.google_docs_requirements_url.trim() || null,
      });
      toast({ title: "Proyecto actualizado" });
      setEditing(false);
      load();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [id, editForm, toast, load]);

  const cancelEdit = useCallback(() => setEditing(false), []);
  const toggleCollapse = useCallback(() => setPipelineCollapsed(c => !c), []);
  const showForm = useCallback(() => setShowServiceForm(true), []);
  const handleDeleteService = useCallback(async (sid: string) => {
    await deleteService(sid);
    load();
  }, [load]);

  if (loading) return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center">
      <BrandLoader />
      <span className="sr-only">Cargando el proyecto…</span>
    </div>
  );

  if (!project) return null;

  const showMaintenance = project.estado === "activo" || project.estado === "mantenimiento";

  return (
    <div className="container mx-auto max-w-6xl space-y-2 px-4 pb-16 sm:px-6">
      <PageHeader
        breadcrumb={
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Volver al resumen
          </Link>
        }
        title={project.nombre_proyecto}
        meta={
          <>
            <StatusBadge kind="project" value={safeProjectStatus(project.estado)} />
            <span>
              Creado el <time dateTime={project.fecha_creacion}>{formatInstantDay(project.fecha_creacion)}</time>
            </span>
          </>
        }
      />

      {/* En pantallas anchas el pipeline queda a la derecha; en las angostas va primero, como resumen del avance. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <div className="lg:col-start-2 lg:row-start-1">
          <PipelineHeader
            stagesData={stages}
            onStageClick={setActiveStage}
            isCollapsed={pipelineCollapsed}
            onToggleCollapse={toggleCollapse}
          />
        </div>

        <div className="min-w-0 space-y-6 lg:col-start-1 lg:row-start-1">
          <ProjectIdentityCard
            project={project}
            editing={editing}
            editForm={editForm}
            setEditForm={setEditForm}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            saving={saving}
          />

          <ContentTabs
            services={services}
            tickets={tickets}
            tokens={tokens}
            maintenance={maintenance}
            projectId={project.id}
            showMaintenance={showMaintenance}
            onRefresh={load}
            onDeleteService={handleDeleteService}
            onShowServiceForm={showForm}
          />
        </div>
      </div>

      {activeStage && (
        <StageDrawer
          projectId={project.id}
          stage={activeStage}
          existing={stages.find(s => s.stage_key === activeStage.key) ?? null}
          open={!!activeStage}
          onClose={() => setActiveStage(null)}
          onSaved={load}
        />
      )}
      <ServiceForm
        projectId={project.id}
        open={showServiceForm}
        onClose={() => setShowServiceForm(false)}
        onSaved={load}
      />
    </div>
  );
}
