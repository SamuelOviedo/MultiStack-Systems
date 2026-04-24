import { useState } from "react";
import { createService } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceType } from "@/types/projects";

interface Props {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const SERVICE_TYPES: { value: ServiceType; label: string }[] = [
  { value: "domain",   label: "Dominio" },
  { value: "hosting",  label: "Hosting" },
  { value: "database", label: "Base de datos" },
  { value: "cdn",      label: "CDN" },
  { value: "other",    label: "Otro" },
];

const PROVIDERS = ["Cloudflare", "Namecheap", "GoDaddy", "Vercel", "Render", "Railway", "Supabase", "DigitalOcean", "Otro"];

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="font-display text-xs text-muted-foreground mb-1.5 block">{label}:</label>
      {children}
    </div>
  );
}

export default function ServiceForm({ projectId, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    service_type: "domain" as ServiceType,
    provider: "",
    name: "",
    url: "",
    cost_monthly: "",
    cost_yearly: "",
    currency: "USD",
    renewal_date: "",
    notes: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSave = async () => {
    if (!form.provider || !form.name) return;
    setLoading(true);
    try {
      await createService(projectId, {
        service_type: form.service_type,
        provider: form.provider,
        name: form.name,
        url: form.url || null,
        cost_monthly: form.cost_monthly ? parseFloat(form.cost_monthly) : null,
        cost_yearly: form.cost_yearly ? parseFloat(form.cost_yearly) : null,
        currency: form.currency,
        renewal_date: form.renewal_date || null,
        notes: form.notes || null,
      });
      toast({ title: "Servicio agregado" });
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
      <SheetContent className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="font-display text-sm text-foreground">
            <span className="text-primary">+ </span>Agregar Servicio Externo
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          <FieldRow label="tipo">
            <select value={form.service_type} onChange={set("service_type")}
              className="w-full rounded-md border border-border bg-background font-mono-code text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary">
              {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </FieldRow>

          <FieldRow label="proveedor *">
            <select value={form.provider} onChange={set("provider")}
              className="w-full rounded-md border border-border bg-background font-mono-code text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="">Seleccionar...</option>
              {PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </FieldRow>

          <FieldRow label="nombre *">
            <Input value={form.name} onChange={set("name")} placeholder="confeccionesmatys.com"
              className="bg-background border-border font-mono-code text-sm" />
          </FieldRow>

          <FieldRow label="url">
            <Input value={form.url} onChange={set("url")} placeholder="https://..."
              className="bg-background border-border font-mono-code text-sm" />
          </FieldRow>

          <div className="grid grid-cols-3 gap-2">
            <FieldRow label="costo_mensual">
              <Input type="number" value={form.cost_monthly} onChange={set("cost_monthly")} placeholder="0.00"
                className="bg-background border-border font-mono-code text-sm" />
            </FieldRow>
            <FieldRow label="costo_anual">
              <Input type="number" value={form.cost_yearly} onChange={set("cost_yearly")} placeholder="0.00"
                className="bg-background border-border font-mono-code text-sm" />
            </FieldRow>
            <FieldRow label="moneda">
              <select value={form.currency} onChange={set("currency")}
                className="w-full rounded-md border border-border bg-background font-mono-code text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary">
                <option>USD</option>
                <option>HNL</option>
              </select>
            </FieldRow>
          </div>

          <FieldRow label="fecha_renovacion">
            <Input type="date" value={form.renewal_date} onChange={set("renewal_date")}
              className="bg-background border-border font-mono-code text-sm" />
          </FieldRow>

          <FieldRow label="notas">
            <Textarea value={form.notes} onChange={set("notes")}
              className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
          </FieldRow>

          <div className="flex gap-2 pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={loading || !form.provider || !form.name} size="sm"
              className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              {loading ? "Guardando..." : "[ GUARDAR ]"}
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
