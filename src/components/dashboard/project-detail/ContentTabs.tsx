import { useState } from "react";
import {
  Terminal, Globe, Server, Database, Plus, Trash2,
  Ticket as TicketIcon, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MaintenanceSection from "@/components/dashboard/project-detail/MaintenanceSection";
import TicketDrawer from "@/components/dashboard/tickets/TicketDrawer";
import ClientAccessSection from "@/components/dashboard/project-detail/ClientAccessSection";
import SubTicketForm from "@/components/dashboard/project-detail/SubTicketForm";
import { daysUntil } from "@/lib/projects";
import { SERVICE_TYPE_LABELS, type ProjectService, type ProjectMaintenance } from "@/types/projects";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG,
  type Ticket, type ClientAccessToken,
} from "@/types/tickets";

const SERVICE_ICON: Record<string, React.ReactNode> = {
  domain:   <Globe className="h-3.5 w-3.5" />,
  hosting:  <Server className="h-3.5 w-3.5" />,
  database: <Database className="h-3.5 w-3.5" />,
  cdn:      <Globe className="h-3.5 w-3.5" />,
  other:    <Server className="h-3.5 w-3.5" />,
};

export interface ContentTabsProps {
  services: ProjectService[];
  tickets: (Ticket & { message_count: number })[];
  tokens: ClientAccessToken[];
  maintenance: ProjectMaintenance[];
  projectId: string;
  showMaintenance: boolean;
  onRefresh: () => void;
  onDeleteService: (id: string) => void;
  onShowServiceForm: () => void;
}

/** Tabbed body of the project detail page: services, tickets, and client access. */
export default function ContentTabs({
  services, tickets, tokens, maintenance, projectId,
  showMaintenance, onRefresh, onDeleteService, onShowServiceForm,
}: ContentTabsProps) {
  const [ticketFilter, setTicketFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const openCount = tickets.filter(t => ["abierto", "en_revision", "en_progreso"].includes(t.status)).length;
  const filteredTickets = ticketFilter === "all" ? tickets : tickets.filter(t => t.status === ticketFilter);

  return (
    <>
      <Tabs defaultValue="servicios" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start h-auto p-1 gap-1 rounded-lg">
          <TabsTrigger value="servicios"
            className="font-display text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-md px-4 py-2 transition-all">
            <Server className="h-3 w-3 mr-1.5" />
            Servicios
            {services.length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary font-mono text-[10px] px-1.5 py-0.5 rounded-full">
                {services.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="tickets"
            className="font-display text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-md px-4 py-2 transition-all">
            <TicketIcon className="h-3 w-3 mr-1.5" />
            Tickets
            {openCount > 0 && (
              <span className="ml-1.5 bg-accent/20 text-accent font-mono text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {openCount}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="acceso"
            className="font-display text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/30 border border-transparent rounded-md px-4 py-2 transition-all">
            <Link2 className="h-3 w-3 mr-1.5" />
            Acceso
            {tokens.length > 0 && (
              <span className="ml-1.5 bg-primary/10 text-primary font-mono text-[10px] px-1.5 py-0.5 rounded-full">
                {tokens.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Servicios ── */}
        <TabsContent value="servicios" className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <h2 className="font-display text-xs text-muted-foreground">$ servicios externos</h2>
              </div>
              <Button onClick={onShowServiceForm} variant="outline" size="sm"
                className="font-mono text-[10px] border-primary/30 text-primary hover:bg-primary/10">
                <Plus className="h-3 w-3 mr-1" />Agregar
              </Button>
            </div>
            <div className="p-5">
              {services.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-lg">
                  <Server className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-mono">Sin servicios registrados</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">Agrega dominios, hosting, bases de datos...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {services.map(s => {
                    const days = s.renewal_date ? daysUntil(s.renewal_date) : null;
                    return (
                      <div key={s.id}
                        className="flex items-center justify-between rounded-md border border-border px-4 py-3 hover:border-primary/20 transition-colors group">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground group-hover:text-primary transition-colors">
                            {SERVICE_ICON[s.service_type]}
                          </span>
                          <div>
                            <p className="font-display text-xs text-foreground">{s.name}</p>
                            <p className="text-[10px] text-muted-foreground">{s.provider} · {SERVICE_TYPE_LABELS[s.service_type]}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {days !== null && (
                            <span className={`font-mono text-[10px] ${days <= 7 ? "text-destructive font-medium" : days <= 30 ? "text-warning" : "text-muted-foreground"}`}>
                              {days}d
                            </span>
                          )}
                          {s.cost_yearly && (
                            <span className="font-mono text-[10px] text-primary">{s.cost_yearly} {s.currency}/año</span>
                          )}
                          <button onClick={() => onDeleteService(s.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {showMaintenance && (
              <div className="border-t border-border p-5">
                <MaintenanceSection projectId={projectId} records={maintenance} onRefresh={onRefresh} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Tab: Tickets ── */}
        <TabsContent value="tickets" className="mt-4">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <h2 className="font-display text-xs text-muted-foreground">$ tickets del proyecto</h2>
              </div>
              <select value={ticketFilter} onChange={e => setTicketFilter(e.target.value)}
                className="bg-background border border-border rounded px-2 py-1 font-mono text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                <option value="all">Todos</option>
                {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
                  <option key={v} value={v}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="p-5">
              <SubTicketForm projectId={projectId} onCreated={onRefresh} />
              {filteredTickets.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-border rounded-lg">
                  <TicketIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-mono">Sin tickets</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTickets.map(t => {
                    const sc = TICKET_STATUS_CONFIG[t.status];
                    const pc = TICKET_PRIORITY_CONFIG[t.priority];
                    return (
                      <button key={t.id} onClick={() => setSelectedTicket(t)}
                        className="w-full flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-3 hover:border-primary/30 transition-colors text-left">
                        <TicketIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-xs text-foreground truncate">{t.title}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {TICKET_TYPE_LABELS[t.type]} · {new Date(t.created_at).toLocaleDateString("es-HN")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${pc.color} ${pc.pulse ? "animate-pulse" : ""}`}>
                            {pc.label}
                          </span>
                          <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${sc.color}`}>
                            {sc.label}
                          </span>
                          {t.message_count > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">{t.message_count}msg</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab: Acceso ── */}
        <TabsContent value="acceso" className="mt-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <ClientAccessSection projectId={projectId} tokens={tokens} onRefresh={onRefresh} />
          </div>
        </TabsContent>
      </Tabs>

      <TicketDrawer
        ticket={selectedTicket}
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdated={onRefresh}
        portalBaseUrl={window.location.origin}
      />
    </>
  );
}
