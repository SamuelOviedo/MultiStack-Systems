import { useId, useState } from "react";
import { Plus } from "lucide-react";

import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createProjectTicket } from "@/lib/tickets";
import {
  TICKET_TYPE_LABELS, TICKET_PRIORITY_CONFIG,
  type TicketType, type TicketPriority,
} from "@/types/tickets";

export interface SubTicketFormProps {
  projectId: string;
  onCreated: () => void;
}

/** Límites de la base de datos: título ≤ 200 y descripción ≤ 10 000 caracteres. */
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 10_000;

/** Inline form to create a micro-ticket (task) scoped to the project. */
export default function SubTicketForm({ projectId, onCreated }: SubTicketFormProps) {
  const { toast } = useToast();
  const ids = { title: useId(), type: useId(), priority: useId(), detail: useId() };
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TicketType>("modificacion");
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [description, setDescription] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || title.trim().length < 3) return;
    setSaving(true);
    try {
      await createProjectTicket(projectId, {
        type, priority,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast({ title: "Ticket creado", description: "Micro-ticket añadido al proyecto." });
      setTitle(""); setDescription(""); setType("modificacion"); setPriority("media");
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: "Error", description: actionErrorMessage(err, "crear el ticket del proyecto"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="mb-3 w-full justify-start border-dashed text-muted-foreground">
        <Plus aria-hidden="true" />
        Nuevo ticket
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleCreate}
      aria-label="Nuevo ticket del proyecto"
      className="mb-4 space-y-4 rounded-lg border bg-subtle p-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor={ids.title}>Título</Label>
        <Input
          id={ids.title}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          placeholder="Por ejemplo: diseño del módulo de pagos"
          autoFocus
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={ids.type}>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as TicketType)}>
            <SelectTrigger id={ids.type}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TICKET_TYPE_LABELS).filter(([v]) => v !== "solicitud").map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={ids.priority}>Prioridad</Label>
          <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
            <SelectTrigger id={ids.priority}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
                <SelectItem key={v} value={v}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={ids.detail}>
          Detalle <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id={ids.detail}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          className="resize-none"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving || title.trim().length < 3}>
          {saving ? "Creando…" : "Crear ticket"}
        </Button>
      </div>
    </form>
  );
}
