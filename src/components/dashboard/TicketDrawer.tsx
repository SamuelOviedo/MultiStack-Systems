import { useEffect, useRef, useState } from "react";
import {
  getTicketMessages, addTeamMessage, updateTicketStatus, updateTicketPriority,
  notifyTeamReply, getTeamMembers, assignTicket,
} from "@/lib/tickets";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckCircle2, Loader2, UserCheck, FolderGit2 } from "lucide-react";
import ProjectScopingModal from "@/components/dashboard/ProjectScopingModal";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG, ROLE_LABELS,
  type Ticket, type TicketMessage, type TicketStatus, type TicketPriority, type TeamMember,
} from "@/types/tickets";

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
  /**
   * Called after any mutation. Receives the optimistically-patched ticket so
   * parents can splice it into their list/selection without a refetch. Called
   * with no argument when a full reload is required (e.g. after conversion).
   */
  onUpdated: (updated?: Ticket) => void;
  portalBaseUrl: string;
}

function ChatBubble({ msg }: { msg: TicketMessage }) {
  const isTeam = msg.sender_type === "team";
  return (
    <div className={`flex flex-col gap-0.5 ${isTeam ? "items-end" : "items-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
        isTeam
          ? "bg-primary/20 border border-primary/30 text-foreground"
          : "bg-card border border-border text-foreground"
      }`}>
        {msg.message}
      </div>
      <span className="text-[10px] text-muted-foreground font-mono">
        {msg.sender_name} · {new Date(msg.created_at).toLocaleString("es-HN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

export default function TicketDrawer({ ticket, open, onClose, onUpdated, portalBaseUrl }: Props) {
  const { toast } = useToast();
  const { userType } = useAuth();
  const isAdmin = userType === 0;
  // Local synced copy so selectors/badges reflect mutations immediately —
  // no need to close & reopen the drawer or reload the page to see new state.
  const [local, setLocal] = useState<Ticket | null>(ticket);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [updating, setUpdating] = useState<"status" | "priority" | "assign" | null>(null);
  const [showScoping, setShowScoping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    if (!ticket) return;
    try {
      const msgs = await getTicketMessages(ticket.id);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* silent */ }
  };

  // Re-sync the local copy whenever the parent hands us a (different) ticket
  useEffect(() => { setLocal(ticket); }, [ticket]);

  useEffect(() => {
    if (open && ticket) loadMessages();
    else setMessages([]);
  }, [open, ticket?.id]);

  // Apply an optimistic patch locally and bubble the merged ticket upward
  const applyPatch = (patch: Partial<Ticket>) => {
    setLocal(prev => {
      const merged = prev ? { ...prev, ...patch } : prev;
      if (merged) onUpdated(merged);
      return merged;
    });
  };

  // Admin-only: load assignable team members (roles 0 + 1) once per open
  useEffect(() => {
    if (open && isAdmin && team.length === 0) {
      getTeamMembers().then(setTeam).catch(() => {});
    }
  }, [open, isAdmin]);

  const handleStatusChange = async (status: TicketStatus) => {
    if (!local) return;
    setUpdating("status");
    try {
      await updateTicketStatus(local.id, status);
      toast({ title: "Estado actualizado", description: TICKET_STATUS_CONFIG[status].label });
      applyPatch({
        status,
        updated_at: new Date().toISOString(),
        ...(status === "resuelto" ? { resolved_at: new Date().toISOString() } : {}),
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!local) return;
    setUpdating("priority");
    try {
      await updateTicketPriority(local.id, priority);
      applyPatch({ priority, updated_at: new Date().toISOString() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleAssign = async (assigneeId: string) => {
    if (!local) return;
    setUpdating("assign");
    try {
      await assignTicket(local.id, assigneeId || null, local.status);
      const member = team.find(m => m.id === assigneeId);
      toast({
        title: assigneeId ? "Ticket asignado" : "Asignación removida",
        description: assigneeId ? `Responsable: ${member?.email ?? "—"}` : undefined,
      });
      // Mirror assignTicket's auto-advance: early-stage tickets jump to 'asignado'
      const autoStatus: TicketStatus | undefined =
        assigneeId && (local.status === "abierto" || local.status === "en_revision")
          ? "asignado"
          : undefined;
      applyPatch({
        assigned_to: assigneeId || null,
        assignee_email: member?.email ?? null,
        updated_at: new Date().toISOString(),
        ...(autoStatus ? { status: autoStatus } : {}),
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  };

  const handleSend = async () => {
    if (!local || !reply.trim()) return;
    setSending(true);
    try {
      await addTeamMessage(local.id, "MultiStack Team", reply.trim());
      await notifyTeamReply(local, reply.trim(), `${portalBaseUrl}/client/[token]`);
      setReply("");
      loadMessages();
      applyPatch({ updated_at: new Date().toISOString() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!local) return null;

  const statusCfg = TICKET_STATUS_CONFIG[local.status];
  const priorityCfg = TICKET_PRIORITY_CONFIG[local.priority];

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="font-display text-sm text-foreground leading-snug">
            {local.title}
          </SheetTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="font-mono text-[10px] px-2 py-0.5 rounded border text-muted-foreground border-border">
              {TICKET_TYPE_LABELS[local.type]}
            </span>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${priorityCfg.color} ${priorityCfg.pulse ? "animate-pulse" : ""}`}>
              {priorityCfg.label}
            </span>
          </div>
        </SheetHeader>

        <div className="px-6 py-3 border-b border-border space-y-2">
          {/* Status + priority selectors */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">estado:</span>
              <select value={local.status} onChange={e => handleStatusChange(e.target.value as TicketStatus)}
                disabled={updating !== null}
                className="bg-background border border-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
                {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
              {updating === "status" && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground">prioridad:</span>
              <select value={local.priority} onChange={e => handlePriorityChange(e.target.value as TicketPriority)}
                disabled={updating !== null}
                className="bg-background border border-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50">
                {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
              {updating === "priority" && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
            </div>
            {local.status !== "resuelto" && (
              <Button onClick={() => handleStatusChange("resuelto")} size="sm" variant="outline"
                disabled={updating !== null}
                className="font-mono text-[10px] border-primary/30 text-primary hover:bg-primary/10 ml-auto">
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
              </Button>
            )}
          </div>

          {/* Conversion CTA — admin only, tickets under review, not yet linked */}
          {isAdmin && local.status === "en_revision" && !local.project_id && (
            <Button
              onClick={() => setShowScoping(true)}
              disabled={updating !== null}
              size="sm"
              className="w-full font-display text-xs bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 hover:shadow-[0_0_16px_hsl(var(--primary)/0.25)]"
            >
              <FolderGit2 className="h-3.5 w-3.5" />
              [ CONVERTIR A PROYECTO OFICIAL ]
            </Button>
          )}

          {/* Assignment selector — admin (role 0) only */}
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <UserCheck className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono text-[10px] text-muted-foreground">asignar a:</span>
              <select
                value={local.assigned_to ?? ""}
                onChange={e => handleAssign(e.target.value)}
                disabled={updating !== null}
                className="bg-background border border-border rounded px-2 py-0.5 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 max-w-[240px] truncate"
              >
                <option value="">— sin asignar —</option>
                {team.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.email ?? m.id.slice(0, 8)} ({ROLE_LABELS[m.user_type] ?? m.user_type})
                  </option>
                ))}
              </select>
              {updating === "assign" && <Loader2 className="h-3 w-3 text-primary animate-spin" />}
            </div>
          )}

          {/* Description */}
          {local.description && (
            <p className="text-xs text-muted-foreground bg-background/50 rounded p-2 border border-border">
              {local.description}
            </p>
          )}
          {local.client_name && (
            <p className="text-[10px] text-muted-foreground font-mono">
              cliente: {local.client_name}{local.client_email ? ` · ${local.client_email}` : ""}
            </p>
          )}
        </div>

        {/* Messages thread */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Sin mensajes todavía.</p>
          ) : (
            messages.map(m => <ChatBubble key={m.id} msg={m} />)
          )}
          <div ref={bottomRef} />
        </div>

        {/* Reply input */}
        <div className="px-6 py-4 border-t border-border space-y-2">
          <Textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Escribe una respuesta al cliente..."
            className="bg-background border-border font-mono text-sm resize-none"
            rows={3}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</span>
            <Button onClick={handleSend} disabled={sending || !reply.trim()} size="sm"
              className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" />
              {sending ? "Enviando..." : "[ RESPONDER ]"}
            </Button>
          </div>
        </div>
      </SheetContent>

      <ProjectScopingModal
        ticket={local}
        open={showScoping}
        onClose={() => setShowScoping(false)}
        onConverted={() => { onUpdated(); onClose(); }}
      />
    </Sheet>
  );
}
