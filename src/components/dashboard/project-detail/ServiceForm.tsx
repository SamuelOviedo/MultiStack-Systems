import { useState } from "react";

import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createService } from "@/lib/projects";
import type { ServiceType } from "@/types/projects";
import Field from "./Field";
import { FORM_SHEET_CLASS, OVERLAY_MOTION, useReturnFocus } from "./panelBehavior";

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

const EMPTY_FORM = {
  service_type: "domain" as ServiceType,
  provider: "",
  name: "",
  url: "",
  cost_monthly: "",
  cost_yearly: "",
  currency: "USD",
  renewal_date: "",
  notes: "",
};

const Required = () => <span className="font-normal text-muted-foreground"> (obligatorio)</span>;

export default function ServiceForm({ projectId, open, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const focus = useReturnFocus();

  const set = <K extends keyof typeof EMPTY_FORM>(k: K) => (v: (typeof EMPTY_FORM)[K]) =>
    setForm(f => ({ ...f, [k]: v }));
  const onText = (k: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const canSave = !loading && !!form.provider && !!form.name;

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
      // El formulario no se vuelve a abrir con los datos del servicio anterior.
      setForm(EMPTY_FORM);
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: "No se pudo agregar el servicio", description: actionErrorMessage(e, "agregar servicio"), variant: "destructive" });
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
          <SheetTitle>Agregar servicio externo</SheetTitle>
          <SheetDescription>Dominio, hosting, base de datos u otro servicio contratado para este proyecto.</SheetDescription>
        </SheetHeader>

        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) void handleSave();
          }}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <Field label="Tipo">
              {(c) => (
                <Select value={form.service_type} onValueChange={(v) => set("service_type")(v as ServiceType)}>
                  <SelectTrigger id={c.id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label={<>Proveedor<Required /></>}>
              {(c) => (
                <Select value={form.provider} onValueChange={set("provider")}>
                  <SelectTrigger id={c.id} aria-required="true">
                    <SelectValue placeholder="Elige un proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label={<>Nombre<Required /></>} hint="Por ejemplo, el dominio o el nombre del plan.">
              {(c) => <Input {...c} aria-required="true" value={form.name} onChange={onText("name")} />}
            </Field>

            <Field label="URL">
              {(c) => <Input {...c} type="url" inputMode="url" value={form.url} onChange={onText("url")} placeholder="https://…" />}
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Costo mensual">
                {(c) => (
                  <Input {...c} type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_monthly}
                    onChange={onText("cost_monthly")} placeholder="0.00" />
                )}
              </Field>
              <Field label="Costo anual">
                {(c) => (
                  <Input {...c} type="number" inputMode="decimal" step="0.01" min="0" value={form.cost_yearly}
                    onChange={onText("cost_yearly")} placeholder="0.00" />
                )}
              </Field>
              <Field label="Moneda">
                {(c) => (
                  <Select value={form.currency} onValueChange={set("currency")}>
                    <SelectTrigger id={c.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="HNL">HNL</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>

            <Field label="Fecha de renovación">
              {(c) => <Input {...c} type="date" value={form.renewal_date} onChange={onText("renewal_date")} />}
            </Field>

            <Field label="Notas">
              {(c) => <Textarea {...c} rows={2} className="resize-none" value={form.notes} onChange={onText("notes")} />}
            </Field>
          </div>

          <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={!canSave}>
              {loading ? "Guardando…" : "Guardar servicio"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
