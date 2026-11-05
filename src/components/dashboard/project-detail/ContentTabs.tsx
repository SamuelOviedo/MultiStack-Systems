import { useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Database, Globe, Link2, Plus, Server, Ticket as TicketIcon, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { actionErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import { isUrgentRenewal, renewalWhen, RENEWAL_WINDOW_DAYS } from "@/components/dashboard/dashboard-home/projectMetrics";
import ClientAccessSection from "@/components/dashboard/project-detail/ClientAccessSection";
import MaintenanceSection from "@/components/dashboard/project-detail/MaintenanceSection";
import SubTicketForm from "@/components/dashboard/project-detail/SubTicketForm";
import TicketDrawer from "@/components/dashboard/tickets/TicketDrawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { daysUntil } from "@/lib/projects";
import { cn } from "@/lib/utils";
import { SERVICE_TYPE_LABELS, type ProjectService, type ProjectMaintenance } from "@/types/projects";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG,
  type Ticket, type TicketStatus, type ClientAccessToken,
} from "@/types/tickets";
import { formatDateOnly, formatInstantDay, formatMoney } from "./format";

const SERVICE_ICON: Record<string, typeof Globe> = {
  domain: Globe,
  hosting: Server,
  database: Database,
  cdn: Globe,
  other: Server,
};

export interface ContentTabsProps {
  services: ProjectService[];
  tickets: (Ticket & { message_count: number })[];
  tokens: ClientAccessToken[];
  maintenance: ProjectMaintenance[];
  projectId: string;
  showMaintenance: boolean;
  onRefresh: () => void;
  /** Puede ser asíncrona: si falla, se avisa con un mensaje claro. */
  onDeleteService: (id: string) => void | Promise<void>;
  onShowServiceForm: () => void;
}

const TAB =
  "gap-1.5 data-[state=active]:shadow-sm";

function Count({ children, label }: { children: number; label: string }) {
  return (
    <>
      <span aria-hidden="true" className="tabular rounded-full bg-muted-foreground/15 px-1.5 text-xs font-medium leading-5">
        {children}
      </span>
      <span className="sr-only"> ({children} {label})</span>
    </>
  );
}

/** Cuándo vence un servicio: insignia con texto (Vencida / Urgente / Próxima) y la fecha; lejos, solo la fecha. */
function Renewal({ date }: { date: string }) {
  const days = daysUntil(date);
  // Fecha que no se puede leer (`daysUntil` da NaN): sin insignia de plazo ni texto relativo; se enseña el valor tal
  // cual llegó, sin reinterpretarlo.
  if (!Number.isFinite(days)) {
    return (
      <span className="text-xs text-muted-foreground">
        Fecha no válida: <span className="tabular break-all">{date}</span>
      </span>
    );
  }
  const overdue = days < 0;
  const urgent = isUrgentRenewal(days);
  const near = days <= RENEWAL_WINDOW_DAYS;
  const when = overdue ? `hace ${-days} ${-days === 1 ? "día" : "días"}` : renewalWhen(days);
  return (
    <div className="flex flex-col items-start gap-1">
      {near && (
        <StatusBadge
          kind="custom"
          tone={urgent || overdue ? "destructive" : "warning"}
          label={overdue ? "Vencida" : urgent ? "Urgente" : "Próxima"}
          icon={urgent || overdue ? AlertTriangle : CalendarClock}
        />
      )}
      <span className="text-xs text-muted-foreground">
        <span className="tabular">{when}</span> · {formatDateOnly(date)}
      </span>
    </div>
  );
}

/** Tabbed body of the project detail page: services, tickets, and client access. */
export default function ContentTabs({
  services, tickets, tokens, maintenance, projectId,
  showMaintenance, onRefresh, onDeleteService, onShowServiceForm,
}: ContentTabsProps) {
  const { toast } = useToast();
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectService | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const filterId = "project-tickets-filter";

  const openCount = tickets.filter(t => ["abierto", "en_revision", "en_progreso"].includes(t.status)).length;
  const filteredTickets = ticketFilter === "all" ? tickets : tickets.filter(t => t.status === ticketFilter);

  const askDelete = (s: ProjectService) => {
    setDeleteTarget(s);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    try {
      await onDeleteService(target.id);
    } catch (error) {
      toast({
        title: "No se pudo eliminar el servicio",
        description: actionErrorMessage(error, "eliminar servicio"),
        variant: "destructive",
      });
    }
  };

  const addButton = (
    <Button ref={addRef} type="button" variant="outline" size="sm" onClick={onShowServiceForm}>
      <Plus aria-hidden="true" />
      Agregar servicio
    </Button>
  );

  return (
    <>
      <Tabs defaultValue="servicios" className="w-full">
        <TabsList className="h-auto max-w-full justify-start gap-1 overflow-x-auto">
          <TabsTrigger value="servicios" className={TAB}>
            <Server aria-hidden="true" className="size-3.5" />
            Servicios{" "}
            {services.length > 0 && <Count label="en total">{services.length}</Count>}
          </TabsTrigger>
          <TabsTrigger value="tickets" className={TAB}>
            <TicketIcon aria-hidden="true" className="size-3.5" />
            Tickets{" "}
            {openCount > 0 && <Count label="abiertos">{openCount}</Count>}
          </TabsTrigger>
          <TabsTrigger value="acceso" className={TAB}>
            <Link2 aria-hidden="true" className="size-3.5" />
            Acceso{" "}
            {tokens.length > 0 && <Count label="enlaces">{tokens.length}</Count>}
          </TabsTrigger>
        </TabsList>

        {/* ── Pestaña Servicios ── */}
        <TabsContent value="servicios" className="mt-4 space-y-4">
          <Panel
            title="Servicios externos"
            description="Dominio, hosting, base de datos y otros servicios contratados para este proyecto."
            actions={addButton}
            flush
            isEmpty={services.length === 0}
            empty={
              <div className="p-5 pt-0">
                <EmptyState
                  icon={Server}
                  title="Aún no hay servicios registrados"
                  description="Agrega el dominio, el hosting o la base de datos para seguir sus renovaciones."
                />
              </div>
            }
          >
            <Table containerProps={{ tabIndex: 0, role: "region", "aria-label": "Servicios del proyecto" }}>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="sticky left-0 bg-subtle">Servicio</TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell">Proveedor</TableHead>
                  <TableHead scope="col">Renovación</TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell">Costo anual</TableHead>
                  <TableHead scope="col" className="w-12"><span className="sr-only">Acciones</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map(s => {
                  const Icon = SERVICE_ICON[s.service_type] ?? Server;
                  // Solo el costo anual, como siempre. El mensual se captura en el formulario pero esta lista no lo muestra.
                  const yearly = s.cost_yearly ? formatMoney(s.cost_yearly, s.currency) : null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="sticky left-0 bg-card font-medium">
                        <span className="flex min-w-36 items-center gap-2">
                          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0">
                            <span className="block break-words">{s.name}</span>
                            {/* En pantallas angostas el tipo y el proveedor bajan al nombre (las columnas se ocultan). */}
                            <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                              {s.provider} · {SERVICE_TYPE_LABELS[s.service_type]}
                            </span>
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">{SERVICE_TYPE_LABELS[s.service_type]}</TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">{s.provider}</TableCell>
                      <TableCell className="sm:whitespace-nowrap">
                        {s.renewal_date ? <Renewal date={s.renewal_date} /> : <span className="text-muted-foreground">—<span className="sr-only">Sin renovación registrada</span></span>}
                        {/* En pantallas angostas el costo baja a la renovación (la columna se oculta). */}
                        {yearly && (
                          <span className="tabular mt-1 block text-xs text-muted-foreground sm:hidden">{yearly}/año</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular hidden whitespace-nowrap sm:table-cell">
                        {yearly ? (
                          `${yearly}/año`
                        ) : (
                          <span className="text-muted-foreground">—<span className="sr-only">Sin costo anual registrado</span></span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 text-muted-foreground hover:text-destructive"
                          aria-label={`Eliminar ${s.name}`}
                          onClick={() => askDelete(s)}
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>

          {showMaintenance && (
            <MaintenanceSection projectId={projectId} records={maintenance} onRefresh={onRefresh} />
          )}
        </TabsContent>

        {/* ── Pestaña Tickets ── */}
        <TabsContent value="tickets" className="mt-4">
          <Panel
            title="Tickets del proyecto"
            description={tickets.length === 0 ? undefined : `${openCount} ${openCount === 1 ? "abierto" : "abiertos"} de ${tickets.length}.`}
            actions={
              <div className="flex items-center gap-2">
                <Label htmlFor={filterId} className="text-muted-foreground">Estado</Label>
                <Select value={ticketFilter} onValueChange={setTicketFilter}>
                  <SelectTrigger id={filterId} className="h-9 w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
                      <SelectItem key={v} value={v}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            }
          >
            <SubTicketForm projectId={projectId} onCreated={onRefresh} />
            {filteredTickets.length === 0 ? (
              <EmptyState
                icon={TicketIcon}
                title={tickets.length === 0 ? "Este proyecto no tiene tickets" : "Ningún ticket con este estado"}
                description={tickets.length === 0 ? "Crea uno con «Nuevo ticket» para dar seguimiento a una tarea." : "Elige otro estado para ver el resto."}
              />
            ) : (
              <ul className="divide-y rounded-md border">
                {filteredTickets.map(t => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTicket(t)}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                    >
                      <span className="min-w-0 space-y-0.5">
                        <span className="block break-words text-sm font-medium">{t.title}</span>
                        <span className="block text-xs text-muted-foreground">
                          {TICKET_TYPE_LABELS[t.type]} · <time dateTime={t.created_at}>{formatInstantDay(t.created_at)}</time>
                          {t.message_count > 0 && ` · ${t.message_count} ${t.message_count === 1 ? "mensaje" : "mensajes"}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2">
                        <StatusBadge kind="priority" value={t.priority} />
                        <StatusBadge kind="ticket" value={t.status as TicketStatus} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {/* ── Pestaña Acceso ── */}
        <TabsContent value="acceso" className="mt-4">
          <ClientAccessSection projectId={projectId} tokens={tokens} onRefresh={onRefresh} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            // La fila ya no existe: el foco pasa al botón «Agregar servicio» de la misma sección.
            e.preventDefault();
            addRef.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar el servicio «{deleteTarget?.name}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Se quitará de este proyecto
              {deleteTarget ? ` (${deleteTarget.provider} · ${SERVICE_TYPE_LABELS[deleteTarget.service_type]})` : ""} junto con su
              fecha de renovación. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn("bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              onClick={() => void confirmDelete()}
            >
              Eliminar servicio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TicketDrawer
        ticket={selectedTicket}
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={onRefresh}
      />
    </>
  );
}
