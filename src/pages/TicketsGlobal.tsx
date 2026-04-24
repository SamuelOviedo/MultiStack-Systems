import { useEffect, useState } from "react";
import { getAllTickets } from "@/lib/tickets";
import { useToast } from "@/hooks/use-toast";
import TicketDrawer from "@/components/dashboard/TicketDrawer";
import {
  TICKET_TYPE_LABELS, TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG,
  type Ticket, type TicketStatus, type TicketType, type TicketPriority,
} from "@/types/tickets";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

type SortKey = "updated_at" | "created_at" | "priority";
type SortDir = "asc" | "desc";

const PRIORITY_ORDER: Record<string, number> = { urgente: 4, alta: 3, media: 2, baja: 1 };

const ALL = "__all__";

export default function TicketsGlobal() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<(Ticket & { nombre_proyecto: string; message_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [filterStatus, setFilterStatus] = useState<TicketStatus | typeof ALL>(ALL);
  const [filterType, setFilterType] = useState<TicketType | typeof ALL>(ALL);
  const [filterPriority, setFilterPriority] = useState<TicketPriority | typeof ALL>(ALL);
  const [filterProject, setFilterProject] = useState<string>(ALL);

  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const load = async () => {
    try {
      const data = await getAllTickets();
      setTickets(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const projects = Array.from(new Set(tickets.map(t => t.nombre_proyecto))).filter(Boolean).sort();

  const filtered = tickets.filter(t =>
    (filterStatus === ALL || t.status === filterStatus) &&
    (filterType === ALL || t.type === filterType) &&
    (filterPriority === ALL || t.priority === filterPriority) &&
    (filterProject === ALL || t.nombre_proyecto === filterProject)
  ).sort((a, b) => {
    let cmp = 0;
    if (sortKey === "priority") {
      cmp = (PRIORITY_ORDER[a.priority] ?? 0) - (PRIORITY_ORDER[b.priority] ?? 0);
    } else {
      cmp = new Date(a[sortKey]).getTime() - new Date(b[sortKey]).getTime();
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  const openCount = tickets.filter(t => ["abierto", "en_revision", "en_progreso"].includes(t.status)).length;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronsUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const selectClass = "bg-background border border-border rounded px-2 py-1 font-display text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg text-foreground">
            <span className="text-primary">$</span> tickets
          </h1>
          <p className="text-xs text-muted-foreground font-mono-code mt-0.5">
            {openCount} abiertos · {tickets.length} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[10px] text-muted-foreground">estado:</span>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className={selectClass}>
            <option value={ALL}>todos</option>
            {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[10px] text-muted-foreground">tipo:</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className={selectClass}>
            <option value={ALL}>todos</option>
            {Object.entries(TICKET_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-display text-[10px] text-muted-foreground">prioridad:</span>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)} className={selectClass}>
            <option value={ALL}>todas</option>
            {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>
        {projects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="font-display text-[10px] text-muted-foreground">proyecto:</span>
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className={selectClass}>
              <option value={ALL}>todos</option>
              {projects.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <th className="text-left px-4 py-2.5 font-display text-[10px] text-muted-foreground">proyecto</th>
              <th className="text-left px-4 py-2.5 font-display text-[10px] text-muted-foreground">título</th>
              <th className="text-left px-4 py-2.5 font-display text-[10px] text-muted-foreground">tipo</th>
              <th className="text-left px-4 py-2.5 font-display text-[10px] text-muted-foreground">estado</th>
              <th className="px-4 py-2.5 font-display text-[10px] text-muted-foreground">
                <button onClick={() => toggleSort("priority")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  prioridad <SortIcon k="priority" />
                </button>
              </th>
              <th className="px-4 py-2.5 font-display text-[10px] text-muted-foreground">
                <button onClick={() => toggleSort("created_at")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  creado <SortIcon k="created_at" />
                </button>
              </th>
              <th className="px-4 py-2.5 font-display text-[10px] text-muted-foreground">
                <button onClick={() => toggleSort("updated_at")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                  actividad <SortIcon k="updated_at" />
                </button>
              </th>
              <th className="px-4 py-2.5 font-display text-[10px] text-muted-foreground text-right">msg</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground font-mono-code text-xs">
                  cargando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground font-mono-code text-xs">
                  sin tickets.
                </td>
              </tr>
            ) : filtered.map(t => {
              const statusCfg = TICKET_STATUS_CONFIG[t.status];
              const priorityCfg = TICKET_PRIORITY_CONFIG[t.priority];
              return (
                <tr
                  key={t.id}
                  onClick={() => { setSelected(t); setDrawerOpen(true); }}
                  className="border-b border-border/50 hover:bg-card/60 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono-code text-muted-foreground truncate max-w-[120px]">
                    {t.nombre_proyecto || "—"}
                  </td>
                  <td className="px-4 py-2.5 font-display text-foreground max-w-[200px] truncate">
                    {t.title}
                  </td>
                  <td className="px-4 py-2.5 font-mono-code text-muted-foreground whitespace-nowrap">
                    {TICKET_TYPE_LABELS[t.type]}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-display text-[10px] px-2 py-0.5 rounded border ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`font-display text-[10px] px-2 py-0.5 rounded border ${priorityCfg.color} ${priorityCfg.pulse ? "animate-pulse" : ""}`}>
                      {priorityCfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono-code text-muted-foreground text-[10px] whitespace-nowrap">
                    {new Date(t.created_at).toLocaleDateString("es-HN", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 font-mono-code text-muted-foreground text-[10px] whitespace-nowrap">
                    {new Date(t.updated_at).toLocaleDateString("es-HN", { month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 font-mono-code text-muted-foreground text-[10px] text-right">
                    {t.message_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TicketDrawer
        ticket={selected}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUpdated={() => { load(); }}
        portalBaseUrl={window.location.origin}
      />
    </div>
  );
}
