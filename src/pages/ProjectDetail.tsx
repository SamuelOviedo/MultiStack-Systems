import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import StageDrawer from "@/components/dashboard/StageDrawer";
import ServiceForm from "@/components/dashboard/ServiceForm";
import MaintenanceSection from "@/components/dashboard/MaintenanceSection";
import TicketDrawer from "@/components/dashboard/TicketDrawer";
import ClientAccessSection from "@/components/dashboard/ClientAccessSection";
import { useToast } from "@/hooks/use-toast";
import {
  getProject, getProjectStages, getProjectServices, getProjectMaintenance,
  deleteService, updateProject, daysUntil,
} from "@/lib/projects";
import { getProjectTickets, getProjectTokens } from "@/lib/tickets";
import {
  PIPELINE_STAGES, STATUS_CONFIG, SERVICE_TYPE_LABELS,
  type Project, type ProjectStage, type ProjectService,
  type ProjectMaintenance, type ProjectStatus, type PipelineStage,
} from "@/types/projects";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG,
  type Ticket, type ClientAccessToken,
} from "@/types/tickets";
import {
  Terminal, ArrowLeft, CheckCircle2, Circle, ChevronRight,
  Globe, Server, Database, Plus, Trash2, Edit2, X, Save,
  Ticket as TicketIcon, Link2, ChevronDown, ChevronUp,
  User, Mail, Phone, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BrandLoader from "@/components/BrandLoader";

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
    analisis:      [],
    dominio:       [m.dominio, m.proveedor, m.precio_anual && `${m.precio_anual} ${m.moneda ?? "USD"}/año`].filter(Boolean),
    desarrollo:    [(m.stack as string[] ?? []).join(", "), m.desarrollador].filter(Boolean),
    despliegue:    [m.plataforma, m.url_produccion].filter(Boolean),
    entrega:       [m.accesos_entregados && "Accesos ✓", m.documentacion_entregada && "Docs ✓", m.factura_emitida && "Factura ✓"].filter(Boolean),
    mantenimiento: [m.precio_mensual && `${m.precio_mensual} ${m.moneda ?? "HNL"}/mes`].filter(Boolean),
  };
  const parts = summaries[stageKey] ?? [];
  if (!parts.length) return null;
  return <p className="text-[10px] text-muted-foreground font-mono mt-1 line-clamp-1">{parts.join(" · ")}</p>;
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

// ── PipelineHeader ─────────────────────────────────────────────────────────────

function PipelineHeader({
  stagesData,
  onStageClick,
  isCollapsed,
  onToggleCollapse,
}: {
  stagesData: ProjectStage[];
  onStageClick: (stage: PipelineStage) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const completedKeys = new Set(stagesData.map(s => s.stage_key));
  const progress = Math.round((completedKeys.size / PIPELINE_STAGES.length) * 100);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="h-1 bg-border">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-display text-xs text-foreground">
            PIPELINE <span className="text-muted-foreground">·</span>{" "}
            <span className="text-primary">{completedKeys.size}/{PIPELINE_STAGES.length}</span>{" "}
            <span className="text-muted-foreground">etapas</span>
          </span>
          <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {progress}%
          </span>
        </div>
        {isCollapsed
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronUp className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? "max-h-0" : "max-h-[600px]"}`}>
        <div className="px-4 pb-4 space-y-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = completedKeys.has(stage.key);
            const stageData = stagesData.find(s => s.stage_key === stage.key) ?? null;
            return (
              <div key={stage.key}>
                <button
                  onClick={() => onStageClick(stage)}
                  className={`w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
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
                        <p className="text-[10px] text-primary font-mono mt-0.5">
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
                {i < PIPELINE_STAGES.length - 1 && <div className="ml-5 w-px h-2 bg-border" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── ProjectIdentityCard ────────────────────────────────────────────────────────

function ProjectIdentityCard({
  project,
  editing,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  saving,
}: {
  project: Project;
  editing: boolean;
  editForm: any;
  setEditForm: React.Dispatch<React.SetStateAction<any>>;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  saving: boolean;
}) {
  const cfg = STATUS_CONFIG[project.estado] ?? STATUS_CONFIG.en_analisis;
  const statusDot: Record<string, string> = {
    activo:        "bg-success animate-pulse",
    en_desarrollo: "bg-primary",
    en_despliegue: "bg-accent",
    pausado:       "bg-warning",
    cancelado:     "bg-destructive",
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              {editing ? (
                <select
                  value={editForm.estado}
                  onChange={e => setEditForm((f: any) => ({ ...f, estado: e.target.value as ProjectStatus }))}
                  className="rounded-md border border-border bg-background font-mono text-xs text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-md border ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusDot[project.estado] ?? "bg-primary"}`} />
                  {cfg.label.toUpperCase()}
                </span>
              )}
            </div>

            {editing ? (
              <Input
                value={editForm.nombre_proyecto}
                onChange={e => setEditForm((f: any) => ({ ...f, nombre_proyecto: e.target.value }))}
                className="bg-background border-border font-display text-xl font-bold"
              />
            ) : (
              <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
                {project.nombre_proyecto}
              </h1>
            )}

            {editing ? (
              <Textarea
                value={editForm.descripcion}
                onChange={e => setEditForm((f: any) => ({ ...f, descripcion: e.target.value }))}
                className="bg-background border-border font-mono text-sm resize-none mt-3"
                rows={2}
                placeholder="Descripción del proyecto..."
              />
            ) : project.descripcion ? (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{project.descripcion}</p>
            ) : null}
          </div>

          <div className="shrink-0">
            {editing ? (
              <div className="flex gap-2">
                <Button onClick={onSaveEdit} disabled={saving} size="sm"
                  className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saving ? "..." : "Guardar"}
                </Button>
                <Button onClick={onCancelEdit} variant="outline" size="sm" className="font-display text-xs">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button onClick={onStartEdit} variant="outline" size="sm"
                className="font-display text-xs border-border hover:border-primary/40 hover:bg-primary/5">
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Editar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Client bar */}
      <div className="border-t border-border bg-primary/[0.02] px-6 py-3">
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([["client_name", "Nombre", User], ["client_email", "Email", Mail], ["client_phone", "Teléfono", Phone]] as const).map(([k, label, Icon]) => (
              <div key={k} className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  value={(editForm as any)[k]}
                  onChange={e => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))}
                  placeholder={label}
                  className="bg-background border-border font-mono text-xs h-8"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            {project.client_name && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs text-foreground font-medium">{project.client_name}</span>
              </div>
            )}
            {project.client_email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">{project.client_email}</span>
              </div>
            )}
            {project.client_phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">{project.client_phone}</span>
              </div>
            )}
            {!project.client_name && !project.client_email && !project.client_phone && (
              <span className="text-xs text-muted-foreground italic font-mono">Sin datos de cliente registrados</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ContentTabs ────────────────────────────────────────────────────────────────

function ContentTabs({
  services,
  tickets,
  tokens,
  maintenance,
  projectId,
  showMaintenance,
  onRefresh,
  onDeleteService,
  onShowServiceForm,
}: {
  services: ProjectService[];
  tickets: (Ticket & { message_count: number })[];
  tokens: ClientAccessToken[];
  maintenance: ProjectMaintenance[];
  projectId: string;
  showMaintenance: boolean;
  onRefresh: () => void;
  onDeleteService: (id: string) => void;
  onShowServiceForm: () => void;
}) {
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const openCount = tickets.filter(t => ["abierto", "en_revision", "en_progreso"].includes(t.status)).length;
  const filteredTickets = ticketFilter === "all" ? tickets : tickets.filter(t => t.status === ticketFilter);

  return (
    <>
      <Tabs defaultValue="servicios" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start h-auto p-1 gap-1 rounded-lg">
          <TabsTrigger value="servicios"
            className="font-display text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-md px-4 py-2 transition-all">
            <Server className="h-3 w-3 mr-1.5" />
            Servicios
            {services.length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary font-mono text-[10px] px-1.5 py-0.5 rounded-full">
                {services.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="tickets"
            className="font-display text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-md px-4 py-2 transition-all">
            <TicketIcon className="h-3 w-3 mr-1.5" />
            Tickets
            {openCount > 0 && (
              <span className="ml-1.5 bg-accent/20 text-accent font-mono text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {openCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="acceso"
            className="font-display text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-md px-4 py-2 transition-all">
            <Link2 className="h-3 w-3 mr-1.5" />
            Acceso
            {tokens.length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary font-mono text-[10px] px-1.5 py-0.5 rounded-full">
                {tokens.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Servicios ── */}
        <TabsContent value="servicios" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <h2 className="font-display text-xs text-muted-foreground">$ servicios externos</h2>
              </div>
              <Button onClick={onShowServiceForm} variant="outline" size="sm"
                className="font-mono text-[10px] border-primary/30 text-primary hover:bg-primary/10">
                <Plus className="h-3 w-3 mr-1" />Agregar
              </Button>
            </div>
            <div className="p-5">
              {services.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-lg">
                  <Server className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-mono">Sin servicios registrados</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Agrega dominios, hosting, bases de datos...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map(s => {
                    const days = s.renewal_date ? daysUntil(s.renewal_date) : null;
                    return (
                      <div key={s.id}
                        className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:border-primary/20 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground group-hover:text-primary transition-colors">
                            {SERVICE_ICON[s.service_type]}
                          </span>
                          <div>
                            <p className="font-display text-xs text-foreground">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.provider} · {SERVICE_TYPE_LABELS[s.service_type]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {days !== null && (
                            <span className={`font-mono text-[10px] ${days <= 7 ? "text-destructive font-medium" : days <= 30 ? "text-warning" : "text-muted-foreground"}`}>
                              {days}d
                            </span>
                          )}
                          {s.cost_yearly && (
                            <span className="font-mono text-[10px] text-primary">{s.cost_yearly} {s.currency}/año</span>
                          )}
                          <button onClick={() => onDeleteService(s.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {showMaintenance && (
              <div className="border-t border-border p-5">
                <MaintenanceSection projectId={projectId} records={maintenance} onRefresh={onRefresh} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab: Tickets ── */}
        <TabsContent value="tickets" className="mt-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <h2 className="font-display text-xs text-muted-foreground">$ tickets del proyecto</h2>
              </div>
              <select value={ticketFilter} onChange={e => setTicketFilter(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="all">Todos</option>
                {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="p-5">
              {filteredTickets.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-lg">
                  <TicketIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-mono">Sin tickets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTickets.map(t => {
                    const sc = TICKET_STATUS_CONFIG[t.status];
                    const pc = TICKET_PRIORITY_CONFIG[t.priority];
                    return (
                      <button key={t.id} onClick={() => setSelectedTicket(t)}
                        className="w-full flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 hover:border-primary/30 transition-colors text-left">
                        <TicketIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-xs text-foreground truncate">{t.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {TICKET_TYPE_LABELS[t.type]} · {new Date(t.created_at).toLocaleDateString("es-HN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${pc.color} ${pc.pulse ? "animate-pulse" : ""}`}>
                            {pc.label}
                          </span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${sc.color}`}>
                            {sc.label}
                          </span>
                          {t.message_count > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">{t.message_count}msg</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Acceso ── */}
        <TabsContent value="acceso" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <ClientAccessSection projectId={projectId} tokens={tokens} onRefresh={onRefresh} />
          </div>
        </TabsContent>
      </Tabs>

      <TicketDrawer
        ticket={selectedTicket}
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={onRefresh}
        portalBaseUrl={window.location.origin}
      />
    </>
  );
}

// ── ProjectDetail (page) ───────────────────────────────────────────────────────

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
  const [editForm, setEditForm] = useState({
    nombre_proyecto: "", descripcion: "", client_name: "",
    client_email: "", client_phone: "", estado: "" as ProjectStatus,
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
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
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Auto-colapsar pipeline cuando el proyecto está completo o casi
  useEffect(() => {
    if (stages.length >= PIPELINE_STAGES.length - 1) {
      setPipelineCollapsed(true);
    }
  }, [stages]);

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
            onToggleCollapse={() => setPipelineCollapsed(c => !c)}
          />

          <ProjectIdentityCard
            project={project}
            editing={editing}
            editForm={editForm}
            setEditForm={setEditForm}
            onStartEdit={startEdit}
            onSaveEdit={saveEdit}
            onCancelEdit={() => setEditing(false)}
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
            onDeleteService={async (sid) => { await deleteService(sid); load(); }}
            onShowServiceForm={() => setShowServiceForm(true)}
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
