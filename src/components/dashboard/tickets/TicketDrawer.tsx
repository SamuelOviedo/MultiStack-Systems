import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, FolderGit2, Loader2, Send } from "lucide-react";

import { StatusDot } from "@/components/admin/StatusBadge";
import { TICKET_PRIORITY_TONE, TICKET_STATUS_TONE } from "@/components/admin/statusTones";
import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import ProjectScopingModal from "@/components/dashboard/requests/ProjectScopingModal";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  addTeamMessage, assignTicket, getTeamMembers, getTicketMessages, notifyTeamReply, updateTicketPriority,
  updateTicketStatus,
} from "@/lib/tickets";
import {
  ROLE_LABELS, TICKET_PRIORITY_CONFIG, TICKET_STATUS_CONFIG, TICKET_TYPE_LABELS,
  type TeamMember, type Ticket, type TicketMessage, type TicketPriority, type TicketStatus,
} from "@/types/tickets";
import { formatLongDateTime, formatRelative } from "./ticketFormat";
import { UNASSIGNED } from "./ticketList";
import { TicketThread, type ThreadState } from "./TicketThread";

/** El ticket del cajón; la lista global le pasa además el nombre del proyecto (el detalle de proyecto no). */
type DrawerTicket = Ticket & { nombre_proyecto?: string };

interface Props {
  ticket: DrawerTicket | null;
  open: boolean;
  onClose: () => void;
  /**
   * Called after any mutation. Receives the optimistically-patched ticket so
   * parents can splice it into their list/selection without a refetch. Called
   * with no argument when a full reload is required (e.g. after conversion).
   */
  onUpdated: (updated?: Ticket) => void;
}

/** Límite de la base de datos para un mensaje (`ticket_messages_message_len`). */
const MESSAGE_MAX = 10_000;

const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Control({ label, id, busy, children }: { label: string; id: string; busy: boolean; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {busy && <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin motion-reduce:animate-none" />}
        {busy && <span className="sr-only">Guardando…</span>}
      </Label>
      {children}
    </div>
  );
}

function Detail({ term, children, wide = false }: { term: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0", wide && "col-span-2 sm:col-span-1")}>
      <dt className="text-xs text-muted-foreground">{term}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

// Movimiento del cajón: entra en 200 ms y sale en 150 ms (la salida es más rápida porque el sistema responde),
// con la curva de arrastre de los cajones; con «reducir movimiento» no hay desplazamiento ni fundido.
const SHEET_MOTION =
  "data-[state=open]:duration-200 data-[state=closed]:duration-150 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)] " +
  "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none";
const OVERLAY_MOTION =
  "data-[state=open]:duration-200 data-[state=closed]:duration-150 " +
  "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none";

export default function TicketDrawer({ ticket, open, onClose, onUpdated }: Props) {
  const { toast } = useToast();
  const { userType } = useAuth();
  const isAdmin = userType === 0;
  const ids = { status: useId(), priority: useId(), assign: useId(), reply: useId(), replyHint: useId() };

  // Local synced copy so selectors/badges reflect mutations immediately —
  // no need to close & reopen the drawer or reload the page to see new state.
  const [local, setLocal] = useState<DrawerTicket | null>(ticket);
  const localRef = useRef<DrawerTicket | null>(ticket);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [thread, setThread] = useState<ThreadState>("loading");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [updating, setUpdating] = useState<"status" | "priority" | "assign" | null>(null);
  const [showScoping, setShowScoping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const latestMessages = useRef(0);
  const now = new Date();

  const loadMessages = useCallback(async (ticketId: string) => {
    const mine = ++latestMessages.current;
    try {
      const msgs = await getTicketMessages(ticketId);
      if (mine !== latestMessages.current) return;
      setMessages(msgs);
      setThread("ready");
    } catch {
      if (mine !== latestMessages.current) return;
      // Si ya había mensajes se conservan (un fallo al recargar no borra la conversación).
      setThread((s) => (s === "ready" ? s : "error"));
    }
  }, []);

  // Re-sync the local copy whenever the parent hands us a (different) ticket
  useEffect(() => {
    setLocal(ticket);
    localRef.current = ticket;
  }, [ticket]);

  const ticketId = ticket?.id;
  useEffect(() => {
    if (open && ticketId) {
      setThread("loading");
      setMessages([]);
      void loadMessages(ticketId);
    } else {
      latestMessages.current++;
      setMessages([]);
    }
  }, [open, ticketId, loadMessages]);

  // Al abrir, el cajón muestra primero los datos y la descripción del ticket. Cuando LLEGA un mensaje nuevo (por
  // ejemplo, tras responder) el hilo baja hasta él; sin animación si la persona pidió reducir el movimiento.
  const shownCount = useRef(0);
  useEffect(() => {
    if (shownCount.current > 0 && messages.length > shownCount.current) {
      endRef.current?.scrollIntoView?.({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "end" });
    }
    shownCount.current = messages.length;
  }, [messages]);

  // Admin-only: load assignable team members (roles 0 + 1) once per open
  const needsTeam = open && isAdmin && team.length === 0;
  useEffect(() => {
    if (needsTeam) getTeamMembers().then(setTeam).catch(() => {});
  }, [needsTeam]);

  // Aplica un parche optimista al ticket local y lo sube al padre ya combinado. Si mientras tanto el cajón pasó a
  // otro ticket, el parche no se mezcla con ese: se pide al padre que recargue.
  const applyPatch = (ticketId: string, patch: Partial<Ticket>) => {
    const prev = localRef.current;
    if (!prev || prev.id !== ticketId) {
      onUpdated();
      return;
    }
    const merged = { ...prev, ...patch };
    localRef.current = merged;
    setLocal(merged);
    onUpdated(merged);
  };

  const fail = (e: unknown, action: string) =>
    toast({ title: "Error", description: actionErrorMessage(e, action), variant: "destructive" });

  const handleStatusChange = async (status: TicketStatus) => {
    if (!local) return;
    const id = local.id;
    setUpdating("status");
    try {
      await updateTicketStatus(id, status);
      toast({ title: "Estado actualizado", description: TICKET_STATUS_CONFIG[status].label });
      applyPatch(id, {
        status,
        updated_at: new Date().toISOString(),
        ...(status === "resuelto" ? { resolved_at: new Date().toISOString() } : {}),
      });
    } catch (e) {
      fail(e, "cambiar el estado del ticket");
    } finally {
      setUpdating(null);
    }
  };

  const handlePriorityChange = async (priority: TicketPriority) => {
    if (!local) return;
    const id = local.id;
    setUpdating("priority");
    try {
      await updateTicketPriority(id, priority);
      applyPatch(id, { priority, updated_at: new Date().toISOString() });
    } catch (e) {
      fail(e, "cambiar la prioridad del ticket");
    } finally {
      setUpdating(null);
    }
  };

  const handleAssign = async (assigneeId: string) => {
    if (!local) return;
    const id = local.id;
    setUpdating("assign");
    try {
      await assignTicket(id, assigneeId || null, local.status);
      const member = team.find((m) => m.id === assigneeId);
      toast({
        title: assigneeId ? "Ticket asignado" : "Asignación removida",
        description: assigneeId ? `Responsable: ${member?.email ?? "—"}` : undefined,
      });
      // Mirror assignTicket's auto-advance: early-stage tickets jump to 'asignado'
      const autoStatus: TicketStatus | undefined =
        assigneeId && (local.status === "abierto" || local.status === "en_revision") ? "asignado" : undefined;
      applyPatch(id, {
        assigned_to: assigneeId || null,
        assignee_email: member?.email ?? null,
        updated_at: new Date().toISOString(),
        ...(autoStatus ? { status: autoStatus } : {}),
      });
    } catch (e) {
      fail(e, "asignar el ticket");
    } finally {
      setUpdating(null);
    }
  };

  const handleSend = async () => {
    if (!local || sending || !reply.trim()) return;
    const id = local.id;
    setSending(true);
    try {
      const messageId = await addTeamMessage(id, "MultiStack Team", reply.trim());
      // Internal sub-tickets have no client e-mail: nothing to notify.
      if (local.client_email && !(await notifyTeamReply(id, messageId))) {
        toast({ title: "Respuesta guardada", description: "No se pudo enviar el aviso por correo al cliente." });
      }
      setReply("");
      void loadMessages(id);
      applyPatch(id, { updated_at: new Date().toISOString() });
    } catch (e) {
      fail(e, "enviar la respuesta");
    } finally {
      setSending(false);
    }
  };

  if (!local) return null;

  const hasClientEmail = !!local.client_email;
  const canConvert = isAdmin && local.status === "en_revision" && !local.project_id;
  const project = local.nombre_proyecto;
  // El responsable actual puede no estar (todavía) en la lista del equipo: se ofrece igualmente para que el
  // selector no quede en blanco.
  const unlisted = local.assigned_to && !team.some((m) => m.id === local.assigned_to) ? local.assigned_to : null;

  const actions =
    local.status !== "resuelto" || canConvert ? (
      <div className="flex flex-wrap gap-2">
        {local.status !== "resuelto" && (
          <Button type="button" variant="outline" size="sm" onClick={() => void handleStatusChange("resuelto")} disabled={updating !== null}>
            <CheckCircle2 aria-hidden="true" />
            Resolver
          </Button>
        )}
        {/* Conversion CTA — admin only, tickets under review, not yet linked */}
        {canConvert && (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowScoping(true)} disabled={updating !== null}>
            <FolderGit2 aria-hidden="true" />
            Convertir en proyecto
          </Button>
        )}
      </div>
    ) : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        closeLabel="Cerrar"
        overlayClassName={OVERLAY_MOTION}
        className={`flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl ${SHEET_MOTION}`}
        // Un diálogo controlado no tiene «disparador», así que Radix no sabe a dónde devolver el foco: se recuerda
        // el elemento que lo abrió (la fila o la tarjeta) y se le devuelve al cerrar.
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
      >
        {/* Cabecera fija: título y los controles de estado, prioridad y responsable siempre a la vista. */}
        <div className="shrink-0 space-y-4 border-b px-5 pb-4 pt-5">
          <SheetHeader className="space-y-1 pr-8 text-left">
            <SheetTitle className="line-clamp-3 break-words text-lg leading-snug">{local.title}</SheetTitle>
            <SheetDescription>{project ? `Proyecto ${project}` : "Sin proyecto asociado"}</SheetDescription>
          </SheetHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Control label="Estado" id={ids.status} busy={updating === "status"}>
                <Select value={local.status} onValueChange={(v) => void handleStatusChange(v as TicketStatus)} disabled={updating !== null}>
                  <SelectTrigger id={ids.status}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>
                        <span className="flex items-center gap-2">
                          <StatusDot spec={TICKET_STATUS_TONE[v as TicketStatus]} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Control>
              <Control label="Prioridad" id={ids.priority} busy={updating === "priority"}>
                <Select value={local.priority} onValueChange={(v) => void handlePriorityChange(v as TicketPriority)} disabled={updating !== null}>
                  <SelectTrigger id={ids.priority}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>
                        <span className="flex items-center gap-2">
                          <StatusDot spec={{ ...TICKET_PRIORITY_TONE[v as TicketPriority], pulse: false }} />
                          {c.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Control>
            </div>

            {/* Assignment selector — admin (role 0) only; las acciones van a su lado para ahorrar altura */}
            {isAdmin ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[14rem] flex-1">
                  <Control label="Asignado a" id={ids.assign} busy={updating === "assign"}>
                    <Select
                      value={local.assigned_to ?? UNASSIGNED}
                      onValueChange={(v) => void handleAssign(v === UNASSIGNED ? "" : v)}
                      disabled={updating !== null}
                    >
                      <SelectTrigger id={ids.assign}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
                        {unlisted && <SelectItem value={unlisted}>{local.assignee_email ?? unlisted.slice(0, 8)}</SelectItem>}
                        {team.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.email ?? m.id.slice(0, 8)} ({ROLE_LABELS[m.user_type] ?? m.user_type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Control>
                </div>
                {actions}
              </div>
            ) : (
              actions
            )}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section aria-label="Datos del ticket">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3">
              {local.client_name && <Detail term="Cliente">{local.client_name}</Detail>}
              {local.client_email && <Detail term="Correo" wide>{local.client_email}</Detail>}
              <Detail term="Tipo">{TICKET_TYPE_LABELS[local.type]}</Detail>
              {!isAdmin && <Detail term="Asignado" wide>{local.assignee_email ?? (local.assigned_to ? "Asignado" : "Sin asignar")}</Detail>}
              <Detail term="Creado" wide>
                <time dateTime={local.created_at}>{formatLongDateTime(local.created_at)}</time>
              </Detail>
              <Detail term="Última actividad">
                <time dateTime={local.updated_at} title={formatLongDateTime(local.updated_at)}>
                  {formatRelative(local.updated_at, now)}
                </time>
              </Detail>
              {local.resolved_at && (
                <Detail term="Resuelto">
                  <time dateTime={local.resolved_at}>{formatLongDateTime(local.resolved_at)}</time>
                </Detail>
              )}
            </dl>
          </section>

          {local.description && (
            <section aria-label="Descripción">
              <h3 className="mb-2 text-sm font-semibold">Descripción</h3>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{local.description}</p>
            </section>
          )}

          <TicketThread
            state={thread}
            messages={messages}
            now={now}
            endRef={endRef}
            onRetry={() => {
              setThread("loading");
              void loadMessages(local.id);
            }}
          />
        </div>

        {/* Reply input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="shrink-0 space-y-2 border-t bg-card px-5 py-3"
        >
          <Label htmlFor={ids.reply} className="text-sm font-medium">
            {hasClientEmail ? "Respuesta al cliente" : "Mensaje"}
          </Label>
          <Textarea
            id={ids.reply}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={MESSAGE_MAX}
            rows={2}
            aria-describedby={ids.replyHint}
            className="min-h-[4.5rem] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p id={ids.replyHint} className="text-xs text-muted-foreground">
              {hasClientEmail ? "Se avisa al cliente por correo. " : "Queda solo en la conversación. "}
              Ctrl+Enter para enviar.
            </p>
            <Button type="submit" size="sm" disabled={sending || !reply.trim()}>
              {sending ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Send aria-hidden="true" />}
              {sending ? "Enviando…" : "Responder"}
            </Button>
          </div>
        </form>
      </SheetContent>

      <ProjectScopingModal
        ticket={local}
        open={showScoping}
        onClose={() => setShowScoping(false)}
        onConverted={() => {
          onUpdated();
          onClose();
        }}
      />
    </Sheet>
  );
}
