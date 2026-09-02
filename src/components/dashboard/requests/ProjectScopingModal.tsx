import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FolderGit2 } from "lucide-react";
import { convertTicketToProject } from "@/lib/projects";
import { getTeamMembers } from "@/lib/tickets";
import { ROLE_LABELS, type Ticket, type TeamMember } from "@/types/tickets";

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
  onConverted: () => void;
}

const fieldLabel = "font-mono text-[10px] text-muted-foreground uppercase tracking-widest";
const inputCls = "bg-background border-border font-mono text-sm";

export default function ProjectScopingModal({ ticket, open, onClose, onConverted }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Scoping form state — pre-filled from the trigger ticket
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [leadDev, setLeadDev] = useState("");
  const [deadline, setDeadline] = useState("");
  const [stack, setStack] = useState("");
  const [alcance, setAlcance] = useState("");
  const [entregables, setEntregables] = useState("");
  const [googleDocs, setGoogleDocs] = useState("");

  useEffect(() => {
    if (open && ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description ?? "");
      setLeadDev("");
      setDeadline("");
      setStack("");
      setAlcance("");
      setEntregables("");
      setGoogleDocs("");
      getTeamMembers().then(setTeam).catch(() => {});
    }
  }, [open, ticket?.id]);

  const canSubmit = title.trim().length >= 3 && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !canSubmit) return;
    setSubmitting(true);
    try {
      const projectId = await convertTicketToProject({
        ticketId: ticket.id,
        title: title.trim(),
        description: description.trim(),
        leadDeveloperId: leadDev || null,
        deadline: deadline || null,
        requirements: {
          stack: stack.trim() || undefined,
          alcance: alcance.trim() || undefined,
          entregables: entregables.trim() || undefined,
        },
        googleDocsUrl: googleDocs.trim() || null,
      });
      toast({ title: "Proyecto creado", description: "Ticket convertido a proyecto oficial." });
      onConverted();
      onClose();
      navigate(`/dashboard/project/${projectId}`);
    } catch (err: any) {
      toast({ title: "Error en la conversión", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && !submitting && onClose()}>
      <DialogContent className="bg-card border-border sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-sm text-foreground flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-primary" />
            <span><span className="text-primary">$</span> convertir a proyecto oficial</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <label className={fieldLabel}>Título del proyecto</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} required />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className={fieldLabel}>Descripción objetivo</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={3} className={`${inputCls} resize-none`} />
          </div>

          {/* Lead dev + deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={fieldLabel}>Lead developer</label>
              <select value={leadDev} onChange={e => setLeadDev(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-10">
                <option value="">— sin asignar —</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.email ?? m.id.slice(0, 8)} ({ROLE_LABELS[m.user_type] ?? m.user_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabel}>Fecha límite</label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Google Docs requirements link */}
          <div className="space-y-1.5">
            <label className={fieldLabel}>Google Docs de requerimientos</label>
            <Input type="url" value={googleDocs} onChange={e => setGoogleDocs(e.target.value)}
              placeholder="https://docs.google.com/document/d/..." className={inputCls} />
          </div>

          {/* Requirements (→ jsonb) */}
          <div className="rounded-lg border border-border bg-background/40 p-4 space-y-3">
            <p className="font-mono text-[10px] text-primary uppercase tracking-widest">
              {"// requerimientos técnicos"}
            </p>
            <div className="space-y-1.5">
              <label className={fieldLabel}>Stack propuesto</label>
              <Input value={stack} onChange={e => setStack(e.target.value)}
                placeholder="React + Supabase + Vercel..." className={inputCls} />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabel}>Alcance / especificaciones</label>
              <Textarea value={alcance} onChange={e => setAlcance(e.target.value)}
                rows={3} placeholder="Módulos, features, integraciones..." className={`${inputCls} resize-none`} />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabel}>Entregables</label>
              <Textarea value={entregables} onChange={e => setEntregables(e.target.value)}
                rows={2} placeholder="App en producción, documentación, accesos..." className={`${inputCls} resize-none`} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}
              className="font-mono text-xs border-border">
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}
              className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Convirtiendo...</>
              ) : (
                "[ CREAR PROYECTO ]"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
