import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  portalGetProject, portalGetTickets, portalCreateTicket,
  portalGetMessages, portalAddMessage,
  type PortalProject,
} from "@/lib/portal";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG,
  type Ticket, type TicketMessage, type TicketType,
} from "@/types/tickets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Plus, X, ChevronLeft } from "lucide-react";

// ── New ticket modal ──────────────────────────────────────────────────────────

interface NewTicketModalProps {
  onClose: () => void;
  onCreated: () => void;
  token: string;
}

function NewTicketModal({ onClose, onCreated, token }: NewTicketModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [type, setType] = useState<TicketType>("consulta");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!clientName.trim() || !title.trim()) { setError("Nombre y título requeridos."); return; }
    setSaving(true);
    setError("");
    try {
      await portalCreateTicket(token, clientName.trim(), clientEmail.trim(), type, title.trim(), description.trim());
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message ?? "Error al crear ticket.");
    } finally {
      setSaving(false);
    }
  };

  const selectClass = "bg-background border border-border rounded px-2 py-1.5 font-display text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full";
  const inputClass = "bg-background border-border font-mono-code text-xs h-8";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm text-foreground">nuevo ticket</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="font-display text-[10px] text-muted-foreground">nombre*</label>
            <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Tu nombre" className={inputClass} />
          </div>
          <div className="space-y-1">
            <label className="font-display text-[10px] text-muted-foreground">email</label>
            <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="tu@email.com" className={inputClass} />
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-display text-[10px] text-muted-foreground">tipo</label>
          <select value={type} onChange={e => setType(e.target.value as TicketType)} className={selectClass}>
            {Object.entries(TICKET_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="font-display text-[10px] text-muted-foreground">título*</label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resumen breve del problema" className={inputClass} />
        </div>

        <div className="space-y-1">
          <label className="font-display text-[10px] text-muted-foreground">descripción</label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Detalla el problema o solicitud..."
            className="bg-background border-border font-mono-code text-xs resize-none" rows={4} />
        </div>

        {error && <p className="text-xs text-red-400 font-mono-code">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={onClose}
            className="font-display text-[10px] border-border text-muted-foreground">
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}
            className="font-display text-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
            {saving ? "Enviando..." : "[ ENVIAR ]"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Ticket thread view ────────────────────────────────────────────────────────

interface TicketThreadProps {
  ticket: Ticket & { message_count: number };
  token: string;
  onBack: () => void;
}

function TicketThread({ ticket, token, onBack }: TicketThreadProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [name, setName] = useState("");
  const statusCfg = TICKET_STATUS_CONFIG[ticket.status];

  const load = async () => {
    try {
      const msgs = await portalGetMessages(token, ticket.id);
      setMessages(msgs);
    } catch { /* silent */ }
  };

  useEffect(() => { load(); }, [ticket.id]);

  const handleSend = async () => {
    if (!reply.trim() || !name.trim()) return;
    setSending(true);
    try {
      await portalAddMessage(token, ticket.id, name.trim(), reply.trim());
      setReply("");
      load();
    } catch { /* silent */ } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-display">
        <ChevronLeft className="h-3.5 w-3.5" /> volver
      </button>

      <div className="rounded-lg border border-border bg-card p-4 space-y-2">
        <h2 className="font-display text-sm text-foreground">{ticket.title}</h2>
        <div className="flex flex-wrap gap-2">
          <span className="font-display text-[10px] px-2 py-0.5 rounded border text-muted-foreground border-border">
            {TICKET_TYPE_LABELS[ticket.type]}
          </span>
          <span className={`font-display text-[10px] px-2 py-0.5 rounded border ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        {ticket.description && (
          <p className="text-xs text-muted-foreground mt-2">{ticket.description}</p>
        )}
      </div>

      {/* Thread */}
      <div className="space-y-3">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6 font-mono-code">sin mensajes todavía.</p>
        ) : messages.map(m => {
          const isTeam = m.sender_type === "team";
          return (
            <div key={m.id} className={`flex flex-col gap-0.5 ${isTeam ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-xs ${
                isTeam
                  ? "bg-primary/20 border border-primary/30 text-foreground"
                  : "bg-card border border-border text-foreground"
              }`}>
                {m.message}
              </div>
              <span className="text-[10px] text-muted-foreground font-mono-code">
                {m.sender_name} · {new Date(m.created_at).toLocaleString("es-HN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
      </div>

      {/* Reply — only if ticket not closed */}
      {ticket.status !== "cerrado" && ticket.status !== "resuelto" && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <p className="font-display text-[10px] text-muted-foreground">responder</p>
          <Input value={name} onChange={e => setName(e.target.value)}
            placeholder="Tu nombre" className="bg-background border-border font-mono-code text-xs h-8" />
          <Textarea value={reply} onChange={e => setReply(e.target.value)}
            placeholder="Escribe tu mensaje..."
            className="bg-background border-border font-mono-code text-xs resize-none" rows={3}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }} />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar</span>
            <Button size="sm" onClick={handleSend} disabled={sending || !reply.trim() || !name.trim()}
              className="font-display text-xs bg-primary text-primary-foreground hover:bg-primary/90">
              <Send className="h-3.5 w-3.5" />
              {sending ? "Enviando..." : "[ ENVIAR ]"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main portal ───────────────────────────────────────────────────────────────

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<PortalProject | null>(null);
  const [tickets, setTickets] = useState<(Ticket & { message_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<(Ticket & { message_count: number }) | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const proj = await portalGetProject(token);
      if (!proj) { setNotFound(true); return; }
      setProject(proj);
      const tkts = await portalGetTickets(token);
      setTickets(tkts);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="font-mono-code text-muted-foreground text-sm animate-pulse">verificando acceso...</p>
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="font-display text-foreground">acceso_no_válido</p>
          <p className="font-mono-code text-xs text-muted-foreground">Este enlace no es válido o ha expirado.</p>
        </div>
      </div>
    );
  }

  const STATUS_MAP: Record<string, string> = {
    en_analisis: "En análisis", en_desarrollo: "En desarrollo",
    en_despliegue: "En despliegue", activo: "Activo",
    mantenimiento: "Mantenimiento", pausado: "Pausado", cancelado: "Cancelado",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card/50 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="font-display text-xs text-muted-foreground">
              <span className="text-primary">$</span> multistack / portal_cliente
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Project card */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <h1 className="font-display text-base text-foreground">{project.nombre_proyecto}</h1>
          {project.descripcion && (
            <p className="text-xs text-muted-foreground">{project.descripcion}</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <span className="font-display text-[10px] px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">
              {STATUS_MAP[project.estado] ?? project.estado}
            </span>
            {project.client_name && (
              <span className="font-mono-code text-[10px] text-muted-foreground">{project.client_name}</span>
            )}
          </div>
        </div>

        {/* Ticket list or thread */}
        {selectedTicket ? (
          <TicketThread
            ticket={selectedTicket}
            token={token!}
            onBack={() => setSelectedTicket(null)}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xs text-muted-foreground">mis tickets</h2>
              <Button size="sm" onClick={() => setShowNewTicket(true)}
                className="font-display text-[10px] bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="h-3.5 w-3.5" /> [ NUEVO TICKET ]
              </Button>
            </div>

            {tickets.length === 0 ? (
              <div className="rounded-lg border border-border bg-card p-6 text-center">
                <p className="text-xs text-muted-foreground font-mono-code">sin tickets todavía.</p>
                <p className="text-[10px] text-muted-foreground mt-1">Crea uno si tienes alguna consulta o solicitud.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => {
                  const statusCfg = TICKET_STATUS_CONFIG[t.status];
                  const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority];
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-primary/30 hover:bg-card/80 transition-colors space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-xs text-foreground leading-snug">{t.title}</span>
                        <span className={`font-display text-[10px] px-2 py-0.5 rounded border shrink-0 ${priorityCfg.color} ${priorityCfg.pulse ? "animate-pulse" : ""}`}>
                          {priorityCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-code text-[10px] text-muted-foreground">
                          {TICKET_TYPE_LABELS[t.type]}
                        </span>
                        <span className={`font-display text-[10px] px-1.5 py-0.5 rounded border ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {t.message_count > 0 && (
                          <span className="font-mono-code text-[10px] text-muted-foreground ml-auto">
                            {t.message_count} msg
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showNewTicket && token && (
        <NewTicketModal
          token={token}
          onClose={() => setShowNewTicket(false)}
          onCreated={load}
        />
      )}
    </div>
  );
}
