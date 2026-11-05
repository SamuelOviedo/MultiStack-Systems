import { useId, useState, type Dispatch, type SetStateAction } from "react";

import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { commercialToday } from "@/lib/calendarDate";
import { upsertStage } from "@/lib/projects";
import { cn } from "@/lib/utils";
import type { PipelineStage, ProjectStage } from "@/types/projects";
import Field from "./Field";
import { isUuid, stageCalendarDay } from "./format";
import { FORM_SHEET_CLASS, OVERLAY_MOTION, useReturnFocus } from "./panelBehavior";

interface Props {
  projectId: string;
  stage: PipelineStage;
  existing: ProjectStage | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const STACKS = ["Next.js", "React", "Vue", "Laravel", "WordPress", "Supabase", "MySQL", "PostgreSQL", "MongoDB", "Node.js", "Otro"];
const DEPLOY_PLATFORMS = ["Vercel", "Render", "Railway", "DigitalOcean", "VPS propio", "Cloudflare Pages", "Otro"];
const DB_OPTIONS = ["Supabase", "PlanetScale", "Railway MySQL", "Amazon RDS", "Ninguna", "Otro"];
const DOMAIN_PROVIDERS = ["Cloudflare", "Namecheap", "GoDaddy", "Otro"];

/**
 * El `metadata` de una etapa es un objeto libre que viaja COMPLETO en cada guardado (upsert de la fila): cada campo
 * escribe solo su clave y conserva las demás, también las de dinero (`precio_anual`, `precio_mensual`, `moneda`,
 * `factura_emitida`) y las que este formulario no conoce. No se quita ni se renombra ninguna clave aquí.
 */
type Meta = Record<string, unknown>;

interface StageFormProps {
  meta: Meta;
  setMeta: Dispatch<SetStateAction<Meta>>;
  notes: string;
  setNotes: (v: string) => void;
}

/** Valor de texto de una clave del metadata (las que no son texto se muestran vacías sin tocarlas). */
const str = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? String(v) : "");

const NONE = "__ninguna__";

function TextField({
  label, value, onChange, placeholder, type = "text", inputMode, step, min, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
  inputMode?: "decimal" | "url"; step?: string; min?: string; hint?: React.ReactNode;
}) {
  return (
    <Field label={label} hint={hint}>
      {(c) => (
        <Input {...c} type={type} inputMode={inputMode} step={step} min={min} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

/**
 * Selector de una lista cerrada. Con `clearable` se puede volver a «Sin elegir» (guarda cadena vacía, como el
 * selector nativo de antes). Si el valor guardado no está en la lista (otro proveedor), se ofrece para no perderlo.
 */
function ChoiceField({
  label, value, onChange, options, clearable = false, placeholder = "Elige una opción",
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; clearable?: boolean; placeholder?: string;
}) {
  const list = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <Field label={label}>
      {(c) => (
        <Select value={value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
          <SelectTrigger id={c.id}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {clearable && <SelectItem value={NONE}>Sin elegir</SelectItem>}
            {list.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean | "indeterminate") => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="cursor-pointer font-normal">{label}</Label>
    </div>
  );
}

function NotesField({ notes, setNotes }: { notes: string; setNotes: (v: string) => void }) {
  return (
    <Field label="Notas">
      {(c) => <Textarea {...c} rows={2} className="resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} />}
    </Field>
  );
}

// ── Formularios por etapa ─────────────────────────────────────────────────────

function AnalisisForm({ meta, setMeta, notes, setNotes }: StageFormProps) {
  const checks = ["Reunión inicial con cliente", "Definición de requerimientos", "Cotización aprobada"];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {checks.map((c) => (
          <CheckField key={c} label={c} checked={!!meta[c]} onChange={(v) => setMeta((m) => ({ ...m, [c]: v }))} />
        ))}
      </div>
      <NotesField notes={notes} setNotes={setNotes} />
    </div>
  );
}

function DominioForm({ meta, setMeta, notes, setNotes }: StageFormProps) {
  const f = (k: string) => (v: string) => setMeta((m) => ({ ...m, [k]: v }));
  return (
    <div className="space-y-4">
      <TextField label="Dominio" value={str(meta.dominio)} onChange={f("dominio")} />
      <ChoiceField label="Proveedor" value={str(meta.proveedor)} onChange={f("proveedor")} options={DOMAIN_PROVIDERS} clearable />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Precio anual"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={str(meta.precio_anual)}
          onChange={f("precio_anual")}
          placeholder="0.00"
        />
        <ChoiceField label="Moneda" value={str(meta.moneda)} onChange={f("moneda")} options={["USD", "HNL"]} placeholder="Sin registrar" />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {!str(meta.moneda) && "Si no eliges la moneda, el precio se guarda sin ella. "}
        <a href="https://tld-list.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
          Consultar precios en tld-list.com<span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Fecha de compra" type="date" value={str(meta.fecha_compra)} onChange={f("fecha_compra")} />
        <TextField label="Fecha de renovación" type="date" value={str(meta.fecha_renovacion)} onChange={f("fecha_renovacion")} />
      </div>
      <NotesField notes={notes} setNotes={setNotes} />
    </div>
  );
}

function DesarrolloForm({ meta, setMeta, notes, setNotes }: StageFormProps) {
  const f = (k: string) => (v: string) => setMeta((m) => ({ ...m, [k]: v }));
  const stack: string[] = Array.isArray(meta.stack) ? (meta.stack as string[]) : [];
  const toggleStack = (s: string) =>
    setMeta((m) => {
      const arr: string[] = Array.isArray(m.stack) ? (m.stack as string[]) : [];
      return { ...m, stack: arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s] };
    });
  const groupId = useId();
  return (
    <div className="space-y-4">
      <div role="group" aria-labelledby={groupId} className="space-y-1.5">
        <p id={groupId} className="text-sm font-medium leading-none">Stack</p>
        <div className="flex flex-wrap gap-2">
          {STACKS.map((s) => {
            const on = stack.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStack(s)}
                className={cn(
                  "inline-flex h-8 items-center rounded-md border px-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  on ? "border-primary bg-primary/10 font-medium text-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <TextField label="URL del repositorio" type="url" inputMode="url" value={str(meta.repo_url)} onChange={f("repo_url")} placeholder="https://…" />
      <TextField label="Desarrollador" value={str(meta.desarrollador)} onChange={f("desarrollador")} placeholder="Nombre de la persona" />
      <TextField label="Fecha estimada de entrega" type="date" value={str(meta.fecha_estimada)} onChange={f("fecha_estimada")} />
      <NotesField notes={notes} setNotes={setNotes} />
    </div>
  );
}

function DespliegueForm({ meta, setMeta, notes, setNotes }: StageFormProps) {
  const f = (k: string) => (v: string) => setMeta((m) => ({ ...m, [k]: v }));
  const cb = (k: string) => (v: boolean | "indeterminate") => setMeta((m) => ({ ...m, [k]: !!v }));
  return (
    <div className="space-y-4">
      <ChoiceField label="Plataforma" value={str(meta.plataforma)} onChange={f("plataforma")} options={DEPLOY_PLATFORMS} clearable />
      <TextField label="URL de producción" type="url" inputMode="url" value={str(meta.url_produccion)} onChange={f("url_produccion")} placeholder="https://…" />
      <ChoiceField label="Base de datos" value={str(meta.base_de_datos)} onChange={f("base_de_datos")} options={DB_OPTIONS} clearable />
      <div className="space-y-2 pt-1">
        <CheckField label="DNS configurado" checked={!!meta.dns_configurado} onChange={cb("dns_configurado")} />
        <CheckField label="SSL activo" checked={!!meta.ssl_activo} onChange={cb("ssl_activo")} />
      </div>
      <NotesField notes={notes} setNotes={setNotes} />
    </div>
  );
}

function EntregaForm({ meta, setMeta, notes, setNotes }: StageFormProps) {
  const cb = (k: string) => (v: boolean | "indeterminate") => setMeta((m) => ({ ...m, [k]: !!v }));
  const items: [string, string][] = [
    ["accesos_entregados", "Accesos entregados al cliente"],
    ["documentacion_entregada", "Documentación entregada"],
    ["factura_emitida", "Factura emitida"],
  ];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map(([k, label]) => (
          <CheckField key={k} label={label} checked={!!meta[k]} onChange={cb(k)} />
        ))}
      </div>
      <NotesField notes={notes} setNotes={setNotes} />
    </div>
  );
}

function MantenimientoForm({ meta, setMeta, notes, setNotes }: StageFormProps) {
  const f = (k: string) => (v: string) => setMeta((m) => ({ ...m, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Precio mensual"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={str(meta.precio_mensual)}
          onChange={f("precio_mensual")}
          placeholder="0.00"
        />
        <ChoiceField label="Moneda" value={str(meta.moneda)} onChange={f("moneda")} options={["HNL", "USD"]} placeholder="Sin registrar" />
      </div>
      {!str(meta.moneda) && <p className="-mt-2 text-xs text-muted-foreground">Si no eliges la moneda, el precio se guarda sin ella.</p>}
      <NotesField notes={notes} setNotes={setNotes} />
    </div>
  );
}

const STAGE_FORMS: Record<string, React.ComponentType<StageFormProps>> = {
  analisis:      AnalisisForm,
  dominio:       DominioForm,
  desarrollo:    DesarrolloForm,
  despliegue:    DespliegueForm,
  entrega:       EntregaForm,
  mantenimiento: MantenimientoForm,
};

// ── Cajón ─────────────────────────────────────────────────────────────────────

export default function StageDrawer({ projectId, stage, existing, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  // Una etapa nueva propone el hoy comercial (día de Honduras): el día UTC ya es el siguiente desde las 18:00. Una etapa
  // guardada se reabre con el mismo día que enseña la lista (`stageCalendarDay`): el guardado de abajo manda la medianoche
  // UTC del día elegido y esa medianoche se lee como fecha de calendario, no como la tarde del día anterior en Honduras.
  const [completedAt, setCompletedAt] = useState(
    () => (existing ? stageCalendarDay(existing.completed_at) : null) ?? commercialToday()
  );
  const [completedBy, setCompletedBy] = useState(existing?.completed_by ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [meta, setMeta] = useState<Record<string, unknown>>(
    (existing?.metadata as Record<string, unknown>) ?? {}
  );
  const focus = useReturnFocus();

  const StageForm = STAGE_FORMS[stage.key];
  // El responsable puede venir como identificador de cuenta (sin nombre): no se enseña, pero se conserva al guardar
  // mientras no se escriba otro.
  const assignedOnly = isUuid(completedBy);

  const handleSave = async () => {
    setLoading(true);
    try {
      await upsertStage(projectId, stage.key, stage.label, {
        completed_at: new Date(completedAt).toISOString(),
        completed_by: completedBy || undefined,
        notes: notes || undefined,
        metadata: meta,
      });
      toast({ title: `${stage.label} — guardado` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "No se pudo guardar la etapa", description: actionErrorMessage(e, "guardar etapa"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent
        closeLabel="Cerrar"
        overlayClassName={OVERLAY_MOTION}
        className={FORM_SHEET_CLASS}
        onOpenAutoFocus={focus.onOpenAutoFocus}
        onCloseAutoFocus={focus.onCloseAutoFocus}
      >
        <SheetHeader className="shrink-0 space-y-1 border-b px-6 pb-4 pt-6 pr-12 text-left">
          <SheetTitle>{stage.label}</SheetTitle>
          <SheetDescription>{stage.description}</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading) void handleSave();
          }}
        >
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Fecha de completado" type="date" value={completedAt} onChange={setCompletedAt} />
              <TextField
                label="Responsable"
                value={assignedOnly ? "" : completedBy}
                onChange={setCompletedBy}
                placeholder={assignedOnly ? "Responsable asignado" : "Nombre de quien la completó"}
                hint={assignedOnly ? "Ya hay un responsable asignado. Escribe un nombre solo si quieres reemplazarlo." : undefined}
              />
            </div>

            <div className="border-t pt-5">
              {StageForm && <StageForm meta={meta} setMeta={setMeta} notes={notes} setNotes={setNotes} />}
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Guardando…" : "Guardar etapa"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
