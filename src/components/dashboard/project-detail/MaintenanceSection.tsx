import { useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, CircleDot, Clock, Plus, Wrench } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { upsertMaintenance, firstDayOfMonth } from "@/lib/projects";
import type { MaintenanceStatus, ProjectMaintenance } from "@/types/projects";
import Field from "./Field";
import { formatMonthLabel } from "./format";
import { FORM_SHEET_CLASS, OVERLAY_MOTION, useReturnFocus } from "./panelBehavior";

interface Props {
  projectId: string;
  records: ProjectMaintenance[];
  onRefresh: () => void;
}

const STATUS_BADGE: Record<MaintenanceStatus, { label: string; tone: "success" | "info" | "neutral"; icon: typeof Clock }> = {
  completado: { label: "Completado", tone: "success", icon: CheckCircle2 },
  en_proceso: { label: "En proceso", tone: "info", icon: CircleDot },
  pendiente: { label: "Pendiente", tone: "neutral", icon: Clock },
};

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string }[] = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_proceso", label: "En proceso" },
  { value: "completado", label: "Completado" },
];

/** El registro mensual no guarda la moneda del importe: el rótulo lo dice en vez de suponer una. */
const AMOUNT_LABEL = "Importe cobrado (moneda no registrada)";

interface FormState {
  month: string;
  status: string;
  tasks: string;
  notes: string;
  billed: boolean;
  billed_amount: string;
}

const tasksText = (n: number): ReactNode => `${n} ${n === 1 ? "tarea" : "tareas"}`;

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
  const billedId = useId();
  const registerRef = useRef<HTMLButtonElement>(null);
  const focus = useReturnFocus(() => registerRef.current);

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
        status: form.status as MaintenanceStatus,
        tasks_done: form.tasks ? form.tasks.split("\n").map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes || null,
        billed: form.billed,
        billed_amount: form.billed_amount ? parseFloat(form.billed_amount) : null,
      });
      toast({ title: "Mantenimiento guardado" });
      onRefresh();
      setOpen(false);
    } catch (e) {
      toast({ title: "No se pudo guardar el mantenimiento", description: actionErrorMessage(e, "guardar mantenimiento"), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Panel
        title="Mantenimiento mensual"
        description="Un registro por mes con las tareas hechas y el importe cobrado."
        flush
        actions={
          <Button ref={registerRef} type="button" variant="outline" size="sm" onClick={openNew}>
            <Plus aria-hidden="true" />
            Registrar mes
          </Button>
        }
        isEmpty={records.length === 0}
        empty={
          <div className="p-5 pt-0">
            <EmptyState
              icon={Wrench}
              title="Sin registros de mantenimiento todavía"
              description="Registra el primer mes para llevar el historial de tareas y cobros."
            />
          </div>
        }
      >
        <Table containerProps={{ tabIndex: 0, role: "region", "aria-label": "Registros de mantenimiento" }}>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Mes</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">Estado</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">Tareas</TableHead>
              <TableHead scope="col" className="min-w-28 whitespace-normal text-right">{AMOUNT_LABEL}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map(r => {
              const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.pendiente;
              return (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="rounded-sm text-left font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {formatMonthLabel(r.month)}
                      <span className="sr-only"> (editar registro)</span>
                    </button>
                    {/* En pantallas angostas la cuenta de tareas baja al mes (la columna se oculta). */}
                    {r.tasks_done?.length ? (
                      <span className="block text-xs font-normal text-muted-foreground sm:hidden">{tasksText(r.tasks_done.length)}</span>
                    ) : null}
                    {/* En pantallas angostas el estado baja al mes (la columna se oculta). */}
                    <span className="mt-1 block sm:hidden">
                      <StatusBadge kind="custom" tone={badge.tone} label={badge.label} icon={badge.icon} />
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <StatusBadge kind="custom" tone={badge.tone} label={badge.label} icon={badge.icon} />
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                    {r.tasks_done?.length ? tasksText(r.tasks_done.length) : "—"}
                  </TableCell>
                  <TableCell className="tabular text-right">
                    {r.billed && r.billed_amount != null ? r.billed_amount : <span className="text-muted-foreground">—<span className="sr-only">Sin importe cobrado</span></span>}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      <Sheet open={open} onOpenChange={v => !v && setOpen(false)}>
        <SheetContent
          closeLabel="Cerrar"
          overlayClassName={OVERLAY_MOTION}
          className={FORM_SHEET_CLASS}
          onOpenAutoFocus={focus.onOpenAutoFocus}
          onCloseAutoFocus={focus.onCloseAutoFocus}
        >
          <SheetHeader className="shrink-0 space-y-1 border-b px-6 pb-4 pt-6 pr-12 text-left">
            <SheetTitle>{editing ? `Editar ${formatMonthLabel(editing.month)}` : "Registrar mes de mantenimiento"}</SheetTitle>
            <SheetDescription>Hay un registro por mes: si ya existe uno para el mes elegido, se actualiza.</SheetDescription>
          </SheetHeader>

          <form
            noValidate
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (!loading) void handleSave();
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <Field label="Mes">
                {(c) => (
                  <Input {...c} type="month" value={form.month.slice(0, 7)}
                    onChange={e => setForm(f => ({ ...f, month: `${e.target.value}-01` }))} />
                )}
              </Field>

              <Field label="Estado">
                {(c) => (
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger id={c.id}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field label="Tareas realizadas" hint="Escribe una tarea por línea.">
                {(c) => (
                  <Textarea {...c} rows={4} className="resize-none" value={form.tasks}
                    placeholder={"Actualización de plugins\nCopia de seguridad\nMonitoreo de disponibilidad"}
                    onChange={e => setForm(f => ({ ...f, tasks: e.target.value }))} />
                )}
              </Field>

              <Field label="Notas">
                {(c) => (
                  <Textarea {...c} rows={2} className="resize-none" value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                )}
              </Field>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Checkbox id={billedId} checked={form.billed} onCheckedChange={v => setForm(f => ({ ...f, billed: !!v }))} />
                  <Label htmlFor={billedId} className="cursor-pointer">Cobrado al cliente</Label>
                </div>
                {form.billed && (
                  <Field label={AMOUNT_LABEL} hint="Solo el número: el sistema no registra la moneda de este importe.">
                    {(c) => (
                      <Input {...c} type="number" inputMode="decimal" step="0.01" min="0" value={form.billed_amount}
                        placeholder="0.00"
                        onChange={e => setForm(f => ({ ...f, billed_amount: e.target.value }))} />
                    )}
                  </Field>
                )}
              </div>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Guardando…" : "Guardar registro"}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
