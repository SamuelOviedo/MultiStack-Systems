import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Navbar from "@/components/common/Navbar";
import BrandLoader from "@/components/common/BrandLoader";
import StageDrawer from "@/components/dashboard/project-detail/StageDrawer";
import ServiceForm from "@/components/dashboard/project-detail/ServiceForm";
import PipelineHeader from "@/components/dashboard/project-detail/PipelineHeader";
import ProjectIdentityCard, {
  type ProjectEditForm,
} from "@/components/dashboard/project-detail/ProjectIdentityCard";
import ContentTabs from "@/components/dashboard/project-detail/ContentTabs";
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
    <div className="min-h-screen bg-background flex items-center justify-center">
      <BrandLoader />
    </div>
  );

  if (!project) return null;

  const showMaintenance = project.estado === "activo" || project.estado === "mantenimiento";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 pt-24 pb-16 max-w-5xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link to="/dashboard"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-display">
            <ArrowLeft className="h-3.5 w-3.5" />Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-foreground font-display truncate max-w-[200px]">
            {project.nombre_proyecto}
          </span>
        </div>

        <div className="space-y-6">
          <PipelineHeader
            stagesData={stages}
            onStageClick={setActiveStage}
            isCollapsed={pipelineCollapsed}
            onToggleCollapse={toggleCollapse}
          />

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
