import { useState } from "react";
import { upsertMaintenance, formatMonth, firstDayOfMonth } from "@/lib/projects";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Clock, Loader2, Plus } from "lucide-react";
import type { ProjectMaintenance } from "@/types/projects";

interface Props {
  projectId: string;
  records: ProjectMaintenance[];
  onRefresh: () => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  completado: <CheckCircle2 className="h-3.5 w-3.5 text-primary" />,
  en_proceso: <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />,
  pendiente:  <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
};

const STATUS_LABEL = { completado: "Completado", en_proceso: "En proceso", pendiente: "Pendiente" };

interface FormState {
  month: string;
  status: string;
  tasks: string;
  notes: string;
  billed: boolean;
  billed_amount: string;
}

export default function MaintenanceSection({ projectId, records, onRefresh }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectMaintenance | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<FormState>({
    month: firstDayOfMonth(),
    status: "completado",
    tasks: "",
    notes: "",
    billed: false,
    billed_amount: "",
  });

  const openNew = () => {
    setEditing(null);
    setForm({ month: firstDayOfMonth(), status: "completado", tasks: "", notes: "", billed: false, billed_amount: "" });
    setOpen(true);
  };

  const openEdit = (r: ProjectMaintenance) => {
    setEditing(r);
    setForm({
      month: r.month,
      status: r.status,
      tasks: (r.tasks_done ?? []).join("\n"),
      notes: r.notes ?? "",
      billed: r.billed,
      billed_amount: r.billed_amount?.toString() ?? "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await upsertMaintenance(projectId, form.month, {
        status: form.status as any,
        tasks_done: form.tasks ? form.tasks.split("\n").map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes || null,
        billed: form.billed,
        billed_amount: form.billed_amount ? parseFloat(form.billed_amount) : null,
      });
      toast({ title: "Mantenimiento guardado" });
      onRefresh();
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-xs text-muted-foreground">$ registro de mantenimiento</h3>
        <Button onClick={openNew} size="sm" variant="outline"
          className="font-display text-[10px] border-primary/30 text-primary hover:bg-primary/10">
          <Plus className="h-3 w-3" />
          Registrar mes
        </Button>
      </div>

      {records.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
          Sin registros de mantenimiento todavía.
        </p>
      ) : (
        <div className="space-y-2">
          {records.map(r => (
            <button
              key={r.id}
              onClick={() => openEdit(r)}
              className="w-full flex items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-3 hover:border-primary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                {STATUS_ICON[r.status]}
                <div>
                  <p className="font-display text-xs text-foreground capitalize">{formatMonth(r.month)}</p>
                  {r.tasks_done?.length ? (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.tasks_done.length} tarea(s)</p>
                  ) : null}
                </div>
              </div>
              <div className="text-right">
                {r.billed && r.billed_amount != null && (
                  <p className="font-display text-xs text-primary">{r.billed_amount} {/* currency not stored per record */}</p>
                )}
                <p className="font-display text-[10px] text-muted-foreground">{STATUS_LABEL[r.status]}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet open={open} onOpenChange={v => !v && setOpen(false)}>
        <SheetContent className="bg-card border-border w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="font-display text-sm text-foreground">
              <span className="text-primary">$ </span>
              {editing ? `Editar — ${formatMonth(editing.month)}` : "Nuevo registro de mantenimiento"}
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-4">
            <div>
              <label className="font-display text-xs text-muted-foreground mb-1.5 block">mes:</label>
              <Input type="month" value={form.month.slice(0, 7)}
                onChange={e => setForm(f => ({ ...f, month: `${e.target.value}-01` }))}
                className="bg-background border-border font-mono-code text-sm" />
            </div>

            <div>
              <label className="font-display text-xs text-muted-foreground mb-1.5 block">estado:</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full rounded-md border border-border bg-background font-mono-code text-sm text-foreground px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En proceso</option>
                <option value="completado">Completado</option>
              </select>
            </div>

            <div>
              <label className="font-display text-xs text-muted-foreground mb-1.5 block">
                tareas_realizadas <span className="text-[10px]">(una por línea)</span>:
              </label>
              <Textarea value={form.tasks} onChange={e => setForm(f => ({ ...f, tasks: e.target.value }))}
                placeholder={"Actualización de plugins\nBackup realizado\nMonitoreo de uptime"}
                className="bg-background border-border font-mono-code text-sm resize-none" rows={4} />
            </div>

            <div>
              <label className="font-display text-xs text-muted-foreground mb-1.5 block">notas:</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="bg-background border-border font-mono-code text-sm resize-none" rows={2} />
            </div>

            <div className="border-t border-border pt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="billed" checked={form.billed} onCheckedChange={v => setForm(f => ({ ...f, billed: !!v }))} />
                <Label htmlFor="billed" className="text-xs text-foreground cursor-pointer">Cobrado al cliente</Label>
              </div>
              {form.billed && (
                <div>
                  <label className="font-display text-xs text-muted-foreground mb-1.5 block">monto_cobrado:</label>
                  <Input type="number" value={form.billed_amount}
                    onChange={e => setForm(f => ({ ...f, billed_amount: e.target.value }))}
                    placeholder="500.00" className="bg-background border-border font-mono-code text-sm" />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-border">
              <Button onClick={handleSave} disabled={loading} size="sm"
                className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                {loading ? "Guardando..." : "[ GUARDAR ]"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} className="font-display text-xs">
                Cancelar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
