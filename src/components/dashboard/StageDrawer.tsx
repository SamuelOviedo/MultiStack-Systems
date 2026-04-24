import { useState } from "react";
import { upsertStage } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { PipelineStage, ProjectStage } from "@/types/projects";

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

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-display text-xs text-muted-foreground mb-1.5 block">{label}:</label>
      {children}
    </div>
  );
}

function inp(value: string, onChange: (v: string) => void, placeholder = "", type = "text") {
  return (
    <Input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-background border-border font-mono-code text-sm"
    />
  );
}

function sel(value: string, onChange: (v: string) => void, options: string[]) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md border border-border bg-background font-mono-code text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
    >
      <option value="">Seleccionar...</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── Stage-specific forms ──────────────────────────────────────────────────────

function AnalisisForm({ meta, setMeta, notes, setNotes }: any) {
  const checks = ["Reunión inicial con cliente", "Definición de requerimientos", "Cotización aprobada"];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {checks.map(c => (
          <div key={c} className="flex items-center gap-2">
            <Checkbox
              id={c}
              checked={!!meta[c]}
              onCheckedChange={v => setMeta((m: any) => ({ ...m, [c]: v }))}
            />
            <Label htmlFor={c} className="text-xs text-foreground cursor-pointer">{c}</Label>
          </div>
        ))}
      </div>
      <FieldRow label="notas">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
      </FieldRow>
    </div>
  );
}

function DominioForm({ meta, setMeta, notes, setNotes }: any) {
  const f = (k: string) => (v: string) => setMeta((m: any) => ({ ...m, [k]: v }));
  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground font-mono-code">
        💡 Buscar precio en{" "}
        <a href="https://tld-list.com" target="_blank" rel="noopener noreferrer" className="text-accent underline">
          tld-list.com
        </a>
      </p>
      <FieldRow label="dominio">{inp(meta.dominio ?? "", f("dominio"), "confeccionesmatys.com")}</FieldRow>
      <FieldRow label="proveedor">{sel(meta.proveedor ?? "", f("proveedor"), DOMAIN_PROVIDERS)}</FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="precio_anual">{inp(meta.precio_anual ?? "", f("precio_anual"), "12.00", "number")}</FieldRow>
        <FieldRow label="moneda">
          {sel(meta.moneda ?? "USD", f("moneda"), ["USD", "HNL"])}
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="fecha_compra">{inp(meta.fecha_compra ?? "", f("fecha_compra"), "", "date")}</FieldRow>
        <FieldRow label="fecha_renovacion">{inp(meta.fecha_renovacion ?? "", f("fecha_renovacion"), "", "date")}</FieldRow>
      </div>
      <FieldRow label="notas">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
      </FieldRow>
    </div>
  );
}

function DesarrolloForm({ meta, setMeta, notes, setNotes }: any) {
  const f = (k: string) => (v: string) => setMeta((m: any) => ({ ...m, [k]: v }));
  const toggleStack = (s: string) =>
    setMeta((m: any) => {
      const arr: string[] = m.stack ?? [];
      return { ...m, stack: arr.includes(s) ? arr.filter((x: string) => x !== s) : [...arr, s] };
    });
  return (
    <div className="space-y-3">
      <FieldRow label="stack">
        <div className="flex flex-wrap gap-2 mt-1">
          {STACKS.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => toggleStack(s)}
              className={`font-display text-[10px] px-2 py-1 rounded border transition-colors ${
                (meta.stack ?? []).includes(s)
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-transparent border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </FieldRow>
      <FieldRow label="repo_url">{inp(meta.repo_url ?? "", f("repo_url"), "https://github.com/...")}</FieldRow>
      <FieldRow label="desarrollador">{inp(meta.desarrollador ?? "", f("desarrollador"), "Nombre del desarrollador")}</FieldRow>
      <FieldRow label="fecha_estimada_entrega">{inp(meta.fecha_estimada ?? "", f("fecha_estimada"), "", "date")}</FieldRow>
      <FieldRow label="notas">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
      </FieldRow>
    </div>
  );
}

function DespliegueForm({ meta, setMeta, notes, setNotes }: any) {
  const f = (k: string) => (v: string) => setMeta((m: any) => ({ ...m, [k]: v }));
  const cb = (k: string) => (v: boolean) => setMeta((m: any) => ({ ...m, [k]: v }));
  return (
    <div className="space-y-3">
      <FieldRow label="plataforma">{sel(meta.plataforma ?? "", f("plataforma"), DEPLOY_PLATFORMS)}</FieldRow>
      <FieldRow label="url_produccion">{inp(meta.url_produccion ?? "", f("url_produccion"), "https://miapp.vercel.app")}</FieldRow>
      <FieldRow label="base_de_datos">{sel(meta.base_de_datos ?? "", f("base_de_datos"), DB_OPTIONS)}</FieldRow>
      <div className="space-y-2 pt-1">
        {[["dns_configurado", "DNS configurado"], ["ssl_activo", "SSL activo"]].map(([k, label]) => (
          <div key={k} className="flex items-center gap-2">
            <Checkbox id={k} checked={!!meta[k]} onCheckedChange={v => cb(k)(!!v)} />
            <Label htmlFor={k} className="text-xs text-foreground cursor-pointer">{label}</Label>
          </div>
        ))}
      </div>
      <FieldRow label="notas">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
      </FieldRow>
    </div>
  );
}

function EntregaForm({ meta, setMeta, notes, setNotes }: any) {
  const cb = (k: string) => (v: boolean) => setMeta((m: any) => ({ ...m, [k]: v }));
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {[
          ["accesos_entregados", "Accesos entregados al cliente"],
          ["documentacion_entregada", "Documentación entregada"],
          ["factura_emitida", "Factura emitida"],
        ].map(([k, label]) => (
          <div key={k} className="flex items-center gap-2">
            <Checkbox id={k} checked={!!meta[k]} onCheckedChange={v => cb(k)(!!v)} />
            <Label htmlFor={k} className="text-xs text-foreground cursor-pointer">{label}</Label>
          </div>
        ))}
      </div>
      <FieldRow label="notas">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
      </FieldRow>
    </div>
  );
}

function MantenimientoForm({ meta, setMeta, notes, setNotes }: any) {
  const f = (k: string) => (v: string) => setMeta((m: any) => ({ ...m, [k]: v }));
  return (
    <div className="space-y-3">
      <FieldRow label="precio_mensual">{inp(meta.precio_mensual ?? "", f("precio_mensual"), "500.00", "number")}</FieldRow>
      <FieldRow label="moneda">{sel(meta.moneda ?? "HNL", f("moneda"), ["HNL", "USD"])}</FieldRow>
      <FieldRow label="notas">
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
      </FieldRow>
    </div>
  );
}

const STAGE_FORMS: Record<string, React.ComponentType<any>> = {
  analisis:      AnalisisForm,
  dominio:       DominioForm,
  desarrollo:    DesarrolloForm,
  despliegue:    DespliegueForm,
  entrega:       EntregaForm,
  mantenimiento: MantenimientoForm,
};

// ── Main drawer ───────────────────────────────────────────────────────────────

export default function StageDrawer({ projectId, stage, existing, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [completedAt, setCompletedAt] = useState(
    existing?.completed_at?.split("T")[0] ?? new Date().toISOString().split("T")[0]
  );
  const [completedBy, setCompletedBy] = useState(existing?.completed_by ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [meta, setMeta] = useState<Record<string, unknown>>(
    (existing?.metadata as Record<string, unknown>) ?? {}
  );

  const StageForm = STAGE_FORMS[stage.key];

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
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-sm text-foreground">
            <span className="text-primary">✓ </span>{stage.label}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{stage.description}</p>
        </SheetHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="fecha_completado">
              {inp(completedAt, setCompletedAt, "", "date")}
            </FieldRow>
            <FieldRow label="completado_por">
              {inp(completedBy, setCompletedBy, "Nombre")}
            </FieldRow>
          </div>

          <div className="border-t border-border pt-4">
            {StageForm && (
              <StageForm meta={meta} setMeta={setMeta} notes={notes} setNotes={setNotes} />
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button
              onClick={handleSave}
              disabled={loading}
              size="sm"
              className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {loading ? "Guardando..." : "[ GUARDAR ETAPA ]"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose} className="font-display text-xs">
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
