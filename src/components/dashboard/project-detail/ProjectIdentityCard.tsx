import { memo } from "react";
import { X, Save, Edit2, User, Mail, Phone, FileText, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_CONFIG, type Project, type ProjectStatus } from "@/types/projects";

/** Editable fields for the project identity card. */
export interface ProjectEditForm {
  nombre_proyecto: string;
  descripcion: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  estado: ProjectStatus;
  google_docs_requirements_url: string;
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

const STATUS_DOT: Record<string, string> = {
  activo:        "bg-success animate-pulse",
  en_desarrollo: "bg-primary",
  en_despliegue: "bg-accent",
  pausado:       "bg-warning",
  cancelado:     "bg-destructive",
};

export interface ProjectIdentityCardProps {
  project: Project;
  editing: boolean;
  editForm: ProjectEditForm;
  setEditForm: React.Dispatch<React.SetStateAction<ProjectEditForm>>;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  saving: boolean;
}

/** Header card: status, name, description, client contact + requirements doc. */
function ProjectIdentityCard({
  project, editing, editForm, setEditForm,
  onStartEdit, onSaveEdit, onCancelEdit, saving,
}: ProjectIdentityCardProps) {
  const cfg = STATUS_CONFIG[project.estado] ?? STATUS_CONFIG.en_analisis;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-6 pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              {editing ? (
                <select
                  value={editForm.estado}
                  onChange={e => setEditForm(f => ({ ...f, estado: e.target.value as ProjectStatus }))}
                  className="rounded-md border border-border bg-background font-mono text-xs text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <span className={`inline-flex items-center gap-1.5 font-mono text-[10px] px-2.5 py-1 rounded-md border ${cfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[project.estado] ?? "bg-primary"}`} />
                  {cfg.label.toUpperCase()}
                </span>
              )}
            </div>

            {editing ? (
              <Input
                value={editForm.nombre_proyecto}
                onChange={e => setEditForm(f => ({ ...f, nombre_proyecto: e.target.value }))}
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
                onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))}
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
                  value={editForm[k]}
                  onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))}
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

      {/* Google Docs requirements link */}
      <div className="border-t border-border px-6 py-3">
        {editing ? (
          <div className="flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="url"
              value={editForm.google_docs_requirements_url}
              onChange={e => setEditForm(f => ({ ...f, google_docs_requirements_url: e.target.value }))}
              placeholder="https://docs.google.com/document/d/..."
              className="bg-background border-border font-mono text-xs h-8"
            />
          </div>
        ) : project.google_docs_requirements_url ? (
          <a
            href={project.google_docs_requirements_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            Documento de requerimientos
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Sin documento de requerimientos vinculado
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(ProjectIdentityCard);
