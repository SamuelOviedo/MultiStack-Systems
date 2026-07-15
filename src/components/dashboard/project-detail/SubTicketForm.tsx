import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/** Inline form to create a micro-ticket (task) scoped to the project. */
export default function SubTicketForm({ projectId, onCreated }: SubTicketFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<TicketType>("modificacion");
  const [priority, setPriority] = useState<TicketPriority>("media");
  const [description, setDescription] = useState("");

  const selectCls = "bg-background border border-border rounded px-2 py-1.5 font-mono text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

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
      toast({ title: "Error", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mb-3 rounded-lg border border-dashed border-primary/30 px-4 py-2.5 font-mono text-[11px] text-primary hover:bg-primary/5 hover:border-primary/50 transition-colors text-left"
      >
        + nuevo ticket del proyecto
      </button>
    );
  }

  return (
    <form onSubmit={handleCreate} className="mb-4 rounded-lg border border-primary/20 bg-background/40 p-4 space-y-3">
      <Input value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Título del ticket (ej: diseño del módulo de pagos)"
        className="bg-background border-border font-mono text-sm" autoFocus />
      <div className="flex flex-wrap gap-2">
        <select value={type} onChange={e => setType(e.target.value as TicketType)} className={selectCls}>
          {Object.entries(TICKET_TYPE_LABELS).filter(([v]) => v !== "solicitud").map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as TicketPriority)} className={selectCls}>
          {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
      </div>
      <Textarea value={description} onChange={e => setDescription(e.target.value)}
        rows={2} placeholder="Detalle opcional..." className="bg-background border-border font-mono text-xs resize-none" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}
          className="font-mono text-[10px] border-border">
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving || title.trim().length < 3}
          className="font-display text-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
          {saving ? "Creando..." : "[ CREAR ]"}
        </Button>
      </div>
    </form>
  );
}
