import { memo, type ReactNode } from "react";
import { ExternalLink, Pencil } from "lucide-react";

import { Panel } from "@/components/admin/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Project, ProjectStatus } from "@/types/projects";
import Field from "./Field";
import { formatInstantDay } from "./format";

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

function Item({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children}</dd>
    </div>
  );
}

const Missing = ({ children = "No registrado" }: { children?: string }) => <span className="text-muted-foreground">{children}</span>;

/**
 * Datos del proyecto y del cliente como lista de definición; el botón «Editar proyecto» convierte la tarjeta en
 * un formulario con etiquetas visibles. El nombre y el estado también salen en la cabecera de la página.
 */
function ProjectIdentityCard({
  project, editing, editForm, setEditForm,
  onStartEdit, onSaveEdit, onCancelEdit, saving,
}: ProjectIdentityCardProps) {
  const noClient = !project.client_name && !project.client_email && !project.client_phone;

  if (editing) {
    return (
      <Panel title="Editar proyecto" description="Los cambios se aplican al guardar.">
        <form
          noValidate
          aria-label="Editar proyecto"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) onSaveEdit();
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre del proyecto" className="sm:col-span-2">
              {(c) => (
                <Input {...c} value={editForm.nombre_proyecto}
                  onChange={(e) => setEditForm((f) => ({ ...f, nombre_proyecto: e.target.value }))} />
              )}
            </Field>
            <Field label="Estado">
              {(c) => (
                <Select value={editForm.estado} onValueChange={(v) => setEditForm((f) => ({ ...f, estado: v as ProjectStatus }))}>
                  <SelectTrigger id={c.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Documento de requerimientos" hint="Enlace al documento (https://…).">
              {(c) => (
                <Input {...c} type="url" inputMode="url" placeholder="https://docs.google.com/document/d/…" value={editForm.google_docs_requirements_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, google_docs_requirements_url: e.target.value }))} />
              )}
            </Field>
            <Field label="Descripción" className="sm:col-span-2">
              {(c) => (
                <Textarea {...c} rows={3} className="resize-none" placeholder="Descripción del proyecto" value={editForm.descripcion}
                  onChange={(e) => setEditForm((f) => ({ ...f, descripcion: e.target.value }))} />
              )}
            </Field>
          </div>

          <fieldset className="space-y-3 border-t pt-4">
            <legend className="text-sm font-medium">Datos del cliente</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nombre del cliente">
                {(c) => (
                  <Input {...c} autoComplete="off" value={editForm.client_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, client_name: e.target.value }))} />
                )}
              </Field>
              <Field label="Correo del cliente">
                {(c) => (
                  <Input {...c} inputMode="email" autoComplete="off" value={editForm.client_email}
                    onChange={(e) => setEditForm((f) => ({ ...f, client_email: e.target.value }))} />
                )}
              </Field>
              <Field label="Teléfono del cliente">
                {(c) => (
                  <Input {...c} type="tel" inputMode="tel" autoComplete="off" value={editForm.client_phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, client_phone: e.target.value }))} />
                )}
              </Field>
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onCancelEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </form>
      </Panel>
    );
  }

  return (
    <Panel
      title="Datos del proyecto"
      actions={
        <Button type="button" variant="outline" size="sm" onClick={onStartEdit}>
          <Pencil aria-hidden="true" />
          Editar proyecto
        </Button>
      }
    >
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Item label="Descripción" wide>
          {project.descripcion ? <span className="whitespace-pre-line">{project.descripcion}</span> : <Missing />}
        </Item>
        {noClient ? (
          <Item label="Cliente" wide>
            <Missing>Sin datos de cliente registrados</Missing>
          </Item>
        ) : (
          <>
            <Item label="Cliente">{project.client_name || <Missing />}</Item>
            <Item label="Correo">
              {project.client_email ? (
                <a href={`mailto:${project.client_email}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {project.client_email}
                </a>
              ) : <Missing />}
            </Item>
            <Item label="Teléfono">
              {project.client_phone ? (
                <a href={`tel:${project.client_phone.replace(/[^\d+]/g, "")}`} className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {project.client_phone}
                </a>
              ) : <Missing />}
            </Item>
          </>
        )}
        <Item label="Documento de requerimientos">
          {project.google_docs_requirements_url ? (
            <a
              href={project.google_docs_requirements_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Documento de requerimientos
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only">(se abre en otra pestaña)</span>
            </a>
          ) : (
            <Missing>Sin documento de requerimientos vinculado</Missing>
          )}
        </Item>
        <Item label="Creado">
          <time dateTime={project.fecha_creacion}>{formatInstantDay(project.fecha_creacion)}</time>
        </Item>
      </dl>
    </Panel>
  );
}

export default memo(ProjectIdentityCard);
