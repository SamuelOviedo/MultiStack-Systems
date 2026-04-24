import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import StageDrawer from "@/components/dashboard/StageDrawer";
import ServiceForm from "@/components/dashboard/ServiceForm";
import MaintenanceSection from "@/components/dashboard/MaintenanceSection";
import { useToast } from "@/hooks/use-toast";
import {
  getProject, getProjectStages, getProjectServices, getProjectMaintenance,
  deleteService, updateProject, daysUntil,
} from "@/lib/projects";
import {
  PIPELINE_STAGES, STATUS_CONFIG, SERVICE_TYPE_LABELS,
  type Project, type ProjectStage, type ProjectService,
  type ProjectMaintenance, type ProjectStatus, type PipelineStage,
} from "@/types/projects";
import {
  Terminal, ArrowLeft, CheckCircle2, Circle, ChevronRight,
  Globe, Server, Database, Plus, Trash2, Edit2, X, Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SERVICE_ICON: Record<string, React.ReactNode> = {
  domain:   <Globe className="h-3.5 w-3.5" />,
  hosting:  <Server className="h-3.5 w-3.5" />,
  database: <Database className="h-3.5 w-3.5" />,
  cdn:      <Globe className="h-3.5 w-3.5" />,
  other:    <Server className="h-3.5 w-3.5" />,
};

function MetaSummary({ stageKey, metadata }: { stageKey: string; metadata: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const m = metadata as any;

  const summaries: Record<string, string[]> = {
    analisis:   [],
    dominio:    [m.dominio, m.proveedor, m.precio_anual && `${m.precio_anual} ${m.moneda ?? 'USD'}/año`].filter(Boolean),
    desarrollo: [(m.stack as string[] ?? []).join(", "), m.desarrollador, m.repo_url].filter(Boolean),
    despliegue: [m.plataforma, m.url_produccion, m.base_de_datos].filter(Boolean),
    entrega:    [m.accesos_entregados && "Accesos ✓", m.documentacion_entregada && "Docs ✓", m.factura_emitida && "Factura ✓"].filter(Boolean),
    mantenimiento: [m.precio_mensual && `${m.precio_mensual} ${m.moneda ?? 'HNL'}/mes`].filter(Boolean),
  };

  const parts = summaries[stageKey] ?? [];
  if (parts.length === 0) return null;

  return (
    <p className="text-[10px] text-muted-foreground font-mono-code mt-1 line-clamp-1">
      {parts.join(" · ")}
    </p>
  );
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: "en_analisis",   label: "En análisis" },
  { value: "en_desarrollo", label: "En desarrollo" },
  { value: "en_despliegue", label: "En despliegue" },
  { value: "activo",        label: "Activo" },
  { value: "mantenimiento", label: "Mantenimiento" },
  { value: "pausado",       label: "Pausado" },
  { value: "cancelado",     label: "Cancelado" },
];

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [services, setServices] = useState<ProjectService[]>([]);
  const [maintenance, setMaintenance] = useState<ProjectMaintenance[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    nombre_proyecto: "", descripcion: "", client_name: "",
    client_email: "", client_phone: "", estado: "" as ProjectStatus,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const [p, stg, svc, mnt] = await Promise.all([
        getProject(id),
        getProjectStages(id),
        getProjectServices(id),
        getProjectMaintenance(id),
      ]);
      setProject(p);
      setStages(stg);
      setServices(svc);
      setMaintenance(mnt);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const startEdit = () => {
    if (!project) return;
    setEditForm({
      nombre_proyecto: project.nombre_proyecto,
      descripcion: project.descripcion ?? "",
      client_name: project.client_name ?? "",
      client_email: project.client_email ?? "",
      client_phone: project.client_phone ?? "",
      estado: project.estado,
    });
    setEditing(true);
  };

  const saveEdit = async () => {
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
      });
      toast({ title: "Proyecto actualizado" });
      setEditing(false);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      await deleteService(serviceId);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Terminal className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!project) return null;

  const completedKeys = new Set(stages.map(s => s.stage_key));
  const cfg = STATUS_CONFIG[project.estado] ?? STATUS_CONFIG.en_analisis;
  const showMaintenance = project.estado === "activo" || project.estado === "mantenimiento";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-6 pt-24 pb-16 max-w-7xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <Link to="/dashboard" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors font-display">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-foreground font-display">{project.nombre_proyecto}</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_380px] gap-8">
          {/* ── LEFT: info + services ── */}
          <div className="space-y-6">
            {/* Project card */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  {editing ? (
                    <Input value={editForm.nombre_proyecto}
                      onChange={e => setEditForm(f => ({ ...f, nombre_proyecto: e.target.value }))}
                      className="bg-background border-border font-display text-lg font-bold mb-2" />
                  ) : (
                    <h1 className="font-display text-xl font-bold text-foreground mb-1">{project.nombre_proyecto}</h1>
                  )}
                  {editing ? (
                    <select value={editForm.estado}
                      onChange={e => setEditForm(f => ({ ...f, estado: e.target.value as ProjectStatus }))}
                      className="rounded-md border border-border bg-background font-mono-code text-sm text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary">
                      {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <span className={`inline-block font-display text-[10px] px-2 py-0.5 rounded border ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {editing ? (
                    <>
                      <Button onClick={saveEdit} disabled={saving} size="sm"
                        className="font-display text-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
                        <Save className="h-3.5 w-3.5" />{saving ? "..." : "Guardar"}
                      </Button>
                      <Button onClick={() => setEditing(false)} variant="outline" size="sm"
                        className="font-display text-[10px]">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button onClick={startEdit} variant="outline" size="sm"
                      className="font-display text-[10px] border-border hover:border-primary/40">
                      <Edit2 className="h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                </div>
              </div>

              {/* Description */}
              {editing ? (
                <Textarea value={editForm.descripcion}
                  onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
                  className="bg-background border-border font-mono-code text-sm resize-none mb-4" rows={2} />
              ) : project.descripcion ? (
                <p className="text-sm text-muted-foreground mb-4">{project.descripcion}</p>
              ) : null}

              {/* Client info */}
              <div className="border-t border-border pt-4 space-y-2">
                <p className="font-display text-[10px] text-muted-foreground mb-2">— cliente —</p>
                {editing ? (
                  <div className="space-y-2">
                    {[
                      ["client_name", "Nombre"],
                      ["client_email", "Email"],
                      ["client_phone", "Teléfono"],
                    ].map(([k, label]) => (
                      <div key={k} className="grid grid-cols-[80px_1fr] items-center gap-2">
                        <span className="font-display text-[10px] text-muted-foreground">{label}:</span>
                        <Input value={(editForm as any)[k]}
                          onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))}
                          className="bg-background border-border font-mono-code text-xs h-7" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {project.client_name  && <p className="text-xs font-mono-code"><span className="text-muted-foreground">nombre:</span> {project.client_name}</p>}
                    {project.client_email && <p className="text-xs font-mono-code"><span className="text-muted-foreground">email:</span> {project.client_email}</p>}
                    {project.client_phone && <p className="text-xs font-mono-code"><span className="text-muted-foreground">tel:</span> {project.client_phone}</p>}
                    {!project.client_name && !project.client_email && !project.client_phone && (
                      <p className="text-xs text-muted-foreground italic">Sin datos de cliente</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Services */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xs text-muted-foreground">$ servicios externos</h2>
                <Button onClick={() => setShowServiceForm(true)} variant="outline" size="sm"
                  className="font-display text-[10px] border-primary/30 text-primary hover:bg-primary/10">
                  <Plus className="h-3 w-3" /> Agregar
                </Button>
              </div>

              {services.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                  Sin servicios registrados.
                </p>
              ) : (
                <div className="space-y-2">
                  {services.map(s => {
                    const days = s.renewal_date ? daysUntil(s.renewal_date) : null;
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-muted-foreground">{SERVICE_ICON[s.service_type]}</span>
                          <div>
                            <p className="font-display text-xs text-foreground">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.provider} · {SERVICE_TYPE_LABELS[s.service_type]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {days !== null && (
                            <span className={`font-display text-[10px] ${days <= 7 ? 'text-red-400' : days <= 30 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                              {days}d
                            </span>
                          )}
                          {s.cost_yearly && (
                            <span className="font-display text-[10px] text-primary">
                              {s.cost_yearly} {s.currency}/año
                            </span>
                          )}
                          <button onClick={() => handleDeleteService(s.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Maintenance */}
            {showMaintenance && (
              <div className="rounded-lg border border-border bg-card p-6">
                <MaintenanceSection projectId={project.id} records={maintenance} onRefresh={load} />
              </div>
            )}
          </div>

          {/* ── RIGHT: pipeline ── */}
          <div className="rounded-lg border border-border bg-card p-6 h-fit sticky top-24">
            <h2 className="font-display text-xs text-muted-foreground mb-5">$ pipeline del proyecto</h2>

            <div className="space-y-1">
              {PIPELINE_STAGES.map((stage, i) => {
                const done = completedKeys.has(stage.key);
                const stageData = stages.find(s => s.stage_key === stage.key) ?? null;
                const isLast = i === PIPELINE_STAGES.length - 1;

                return (
                  <div key={stage.key}>
                    <button
                      onClick={() => setActiveStage(stage)}
                      className={`w-full flex items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${
                        done
                          ? "hover:bg-primary/5 border border-primary/20"
                          : "hover:bg-muted/20 border border-transparent"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {done
                          ? <CheckCircle2 className="h-4 w-4 text-primary" />
                          : <Circle className="h-4 w-4 text-border" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-display text-xs font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                          {stage.label}
                        </p>
                        {done && stageData ? (
                          <>
                            <p className="text-[10px] text-primary font-mono-code mt-0.5">
                              {new Date(stageData.completed_at).toLocaleDateString("es-HN")}
                              {stageData.completed_by ? ` · ${stageData.completed_by}` : ""}
                            </p>
                            <MetaSummary stageKey={stage.key} metadata={stageData.metadata as any} />
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{stage.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    </button>
                    {!isLast && <div className="ml-5 w-px h-3 bg-border" />}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono-code mb-1">
                <span>{completedKeys.size}/{PIPELINE_STAGES.length} etapas</span>
                <span>{Math.round((completedKeys.size / PIPELINE_STAGES.length) * 100)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(completedKeys.size / PIPELINE_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
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
