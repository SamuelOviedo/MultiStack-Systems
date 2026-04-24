import { useEffect, useRef, useState } from "react";
import {
  getTicketMessages, addTeamMessage, updateTicketStatus, updateTicketPriority,
  notifyTeamReply,
} from "@/lib/tickets";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, CheckCircle2 } from "lucide-react";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG,
  type Ticket, type TicketMessage, type TicketStatus, type TicketPriority,
} from "@/types/tickets";

interface Props {
  ticket: Ticket | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
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
      <span className="text-[10px] text-muted-foreground font-mono-code">
        {msg.sender_name} · {new Date(msg.created_at).toLocaleString("es-HN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

export default function TicketDrawer({ ticket, open, onClose, onUpdated, portalBaseUrl }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    if (!ticket) return;
    try {
      const msgs = await getTicketMessages(ticket.id);
      setMessages(msgs);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch { /* silent */ }
  };

  useEffect(() => {
    if (open && ticket) loadMessages();
    else setMessages([]);
  }, [open, ticket?.id]);

  const handleStatusChange = async (status: TicketStatus) => {
    if (!ticket) return;
    try {
      await updateTicketStatus(ticket.id, status);
      onUpdated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!ticket) return;
    try {
      await updateTicketPriority(ticket.id, priority);
      onUpdated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleSend = async () => {
    if (!ticket || !reply.trim()) return;
    setSending(true);
    try {
      await addTeamMessage(ticket.id, "MultiStack Team", reply.trim());
      await notifyTeamReply(ticket, reply.trim(), `${portalBaseUrl}/client/[token]`);
      setReply("");
      loadMessages();
      onUpdated();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!ticket) return null;

  const statusCfg = TICKET_STATUS_CONFIG[ticket.status];
  const priorityCfg = TICKET_PRIORITY_CONFIG[ticket.priority];

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg flex flex-col p-0 overflow-hidden">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="font-display text-sm text-foreground leading-snug">
            {ticket.title}
          </SheetTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="font-display text-[10px] px-2 py-0.5 rounded border text-muted-foreground border-border">
              {TICKET_TYPE_LABELS[ticket.type]}
            </span>
            <span className={`font-display text-[10px] px-2 py-0.5 rounded border ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            <span className={`font-display text-[10px] px-2 py-0.5 rounded border ${priorityCfg.color} ${priorityCfg.pulse ? "animate-pulse" : ""}`}>
              {priorityCfg.label}
            </span>
          </div>
        </SheetHeader>

        <div className="px-6 py-3 border-b border-border space-y-2">
          {/* Status + priority selectors */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[10px] text-muted-foreground">estado:</span>
              <select value={ticket.status} onChange={e => handleStatusChange(e.target.value as TicketStatus)}
                className="bg-background border border-border rounded px-2 py-0.5 font-display text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-display text-[10px] text-muted-foreground">prioridad:</span>
              <select value={ticket.priority} onChange={e => handlePriorityChange(e.target.value as TicketPriority)}
                className="bg-background border border-border rounded px-2 py-0.5 font-display text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
            {ticket.status !== "resuelto" && (
              <Button onClick={() => handleStatusChange("resuelto")} size="sm" variant="outline"
                className="font-display text-[10px] border-primary/30 text-primary hover:bg-primary/10 ml-auto">
                <CheckCircle2 className="h-3.5 w-3.5" /> Resolver
              </Button>
            )}
          </div>

          {/* Description */}
          {ticket.description && (
            <p className="text-xs text-muted-foreground bg-background/50 rounded p-2 border border-border">
              {ticket.description}
            </p>
          )}
          {ticket.client_name && (
            <p className="text-[10px] text-muted-foreground font-mono-code">
              cliente: {ticket.client_name}{ticket.client_email ? ` · ${ticket.client_email}` : ""}
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
            className="bg-background border-border font-mono-code text-sm resize-none"
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
    </Sheet>
  );
}
