import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FolderKanban, Search, TicketCheck } from "lucide-react";

import { EmptyState } from "@/components/admin/EmptyState";
import { KpiTile } from "@/components/admin/KpiTile";
import { PageHeader } from "@/components/admin/PageHeader";
import { loadErrorMessage, withLoggedCode } from "@/components/dashboard/dashboard-home/loadErrors";
import { TicketCards } from "@/components/dashboard/tickets/TicketCards";
import { TicketFilterBar } from "@/components/dashboard/tickets/TicketFilterBar";
import { TicketTable } from "@/components/dashboard/tickets/TicketTable";
import TicketDrawer from "@/components/dashboard/tickets/TicketDrawer";
import {
  applyFilters, countOpen, countUrgentOpen, distinctAssignees, distinctProjects, hasActiveFilters, NO_FILTERS,
  sortTickets, type ListTicket, type SortKey, type SortDir, type TicketFilters,
} from "@/components/dashboard/tickets/ticketList";
import { useNarrowViewport } from "@/components/dashboard/tickets/useNarrowViewport";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { getAllTickets } from "@/lib/tickets";
import type { Ticket } from "@/types/tickets";

type LoadState = "loading" | "ready" | "error";

const countLabel = (n: number): string => (n === 1 ? "1 ticket" : `${n} tickets`);

/**
 * Soporte · Tickets (`/dashboard/tickets`). El administrador ve todos los tickets; el colaborador, solo los que
 * tiene asignados (la consulta lo pide de forma explícita y RLS lo vuelve a exigir). Búsqueda, filtros y orden se
 * aplican en el navegador sobre lo ya cargado: no hay consultas nuevas.
 */
export default function TicketsGlobal() {
  const { user, userType } = useAuth();
  const isCollaborator = userType === 1;
  const narrow = useNarrowViewport();
  // /dashboard/tickets?ticket=<id> abre el cajón de ese ticket (enlace directo y recarga). Solo se abre si el id está
  // entre los tickets que esta sesión ya pudo cargar; si no, se ignora y se quita de la dirección.
  const [searchParams, setSearchParams] = useSearchParams();
  const ticketParam = searchParams.get("ticket");
  const setTicketParam = useCallback(
    (id: string | null) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("ticket", id);
          else next.delete("ticket");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const [tickets, setTickets] = useState<ListTicket[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [error, setError] = useState<unknown>(null);
  const [selected, setSelected] = useState<ListTicket | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tableScrolls, setTableScrolls] = useState(false);

  const [filters, setFilters] = useState<TicketFilters>(NO_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Una respuesta tardía de una petición anterior no pisa a la más reciente ni llega tras desmontar.
  const latest = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const userId = user?.id;
  const load = useCallback(async () => {
    const mine = ++latest.current;
    setState((s) => (s === "error" ? "loading" : s));
    try {
      // Colaborador: filtro explícito por responsable (RLS exige lo mismo; así la intención se ve en el código
      // y sobrevive a un cambio de políticas).
      const data = await withLoggedCode("tickets", () =>
        getAllTickets(isCollaborator && userId ? { assignedTo: userId } : undefined),
      );
      if (!alive.current || mine !== latest.current) return;
      setTickets(data);
      setState("ready");
    } catch (e) {
      if (!alive.current || mine !== latest.current) return;
      setError(e);
      setState("error");
    }
  }, [isCollaborator, userId]);

  // Se vuelve a pedir cuando el rol se resuelve (`userType` llega después de montar) o cambia la sesión.
  useEffect(() => {
    if (userType === null) return;
    setTickets([]);
    setState("loading");
    void load();
  }, [userType, userId, load]);

  const patchFilters = (patch: Partial<TicketFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const clearFilters = () => setFilters(NO_FILTERS);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };
  const chooseSortKey = (key: SortKey) => {
    setSortKey(key);
    setSortDir("desc");
  };

  const projects = useMemo(() => distinctProjects(tickets), [tickets]);
  const assignees = useMemo(() => distinctAssignees(tickets), [tickets]);
  const visible = useMemo(
    () => sortTickets(applyFilters(tickets, filters), sortKey, sortDir),
    [tickets, filters, sortKey, sortDir],
  );
  const filtering = hasActiveFilters(filters);

  const loading = state === "loading";
  const ready = state === "ready";
  const now = new Date();

  const open = (t: ListTicket) => {
    setSelected(t);
    setDrawerOpen(true);
    setTicketParam(t.id);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTicketParam(null);
  };

  useEffect(() => {
    if (state !== "ready" || !ticketParam) return;
    const found = tickets.find((t) => t.id === ticketParam);
    if (!found) {
      setTicketParam(null);
      return;
    }
    setSelected((s) => (s?.id === found.id ? s : found));
    setDrawerOpen(true);
  }, [state, ticketParam, tickets, setTicketParam]);

  let body;
  if (loading) {
    body = (
      <div role="status" aria-busy="true" className="space-y-3 p-4">
        <span className="sr-only">Cargando tickets…</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  } else if (state === "error") {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <p>{loadErrorMessage(error, "los tickets")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  } else if (tickets.length === 0) {
    body = (
      <div className="p-4">
        <EmptyState
          icon={TicketCheck}
          title="Aún no hay tickets"
          description={
            isCollaborator
              ? "Cuando te asignen un ticket aparecerá aquí."
              : "Las solicitudes de los clientes y los tickets de cada proyecto aparecerán aquí."
          }
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/proyectos">
                <FolderKanban aria-hidden="true" />
                Ver proyectos
              </Link>
            </Button>
          }
        />
      </div>
    );
  } else if (visible.length === 0) {
    body = (
      <div className="p-4">
        <EmptyState
          icon={Search}
          title="Ningún ticket coincide"
          description="Prueba con otra palabra o quita los filtros."
          action={
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              Quitar filtros
            </Button>
          }
        />
      </div>
    );
  } else if (narrow) {
    body = <TicketCards tickets={visible} now={now} onOpen={open} />;
  } else {
    body = (
      <TicketTable
        tickets={visible}
        now={now}
        onOpen={open}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        selectedId={drawerOpen ? (selected?.id ?? null) : null}
        onScrollableChange={setTableScrolls}
      />
    );
  }

  const total = tickets.length;

  return (
    <div className="container mx-auto max-w-7xl space-y-5 px-4 pb-10 sm:px-6">
      <PageHeader
        title="Tickets"
        description={
          isCollaborator
            ? "Los tickets que tienes asignados, con su estado y su prioridad."
            : "Solicitudes y tareas de todos los proyectos, con su estado y su prioridad."
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiTile
          label="Abiertos"
          value={ready ? countOpen(tickets) : null}
          loading={loading}
          hint="Recibidos, en revisión o en progreso"
        />
        <KpiTile label="Urgentes abiertos" value={ready ? countUrgentOpen(tickets) : null} loading={loading} />
        <KpiTile
          label="Total de tickets"
          value={ready ? total : null}
          loading={loading}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <section aria-labelledby="tickets-lista" className="overflow-hidden rounded-lg border bg-card shadow-card">
        <h2 id="tickets-lista" className="sr-only">
          Lista de tickets
        </h2>
        {ready && total > 0 && (
          <>
            <TicketFilterBar
              filters={filters}
              onChange={patchFilters}
              onClear={clearFilters}
              hasActiveFilters={filtering}
              projects={projects}
              assignees={assignees}
              showAssignee={!isCollaborator}
              narrow={narrow}
              sortKey={sortKey}
              sortDir={sortDir}
              onSortKey={chooseSortKey}
              onToggleDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            />
            <div className="flex items-center justify-between gap-3 border-b px-4 py-2 text-sm text-muted-foreground">
              <p aria-live="polite">{filtering ? `Mostrando ${visible.length} de ${countLabel(total)}` : countLabel(total)}</p>
              {/* Solo cuando la tabla es más ancha que su región (la mide ella misma): si cabe entera, no se avisa. */}
              {!narrow && visible.length > 0 && tableScrolls && (
                <p className="shrink-0 text-xs">Desliza la tabla para ver más columnas</p>
              )}
            </div>
          </>
        )}
        {body}
      </section>

      <TicketDrawer
        ticket={selected}
        open={drawerOpen}
        onClose={closeDrawer}
        onUpdated={(u?: Ticket) => {
          // Optimista: se inserta el ticket modificado en la lista y en la selección para que la tabla refleje el
          // cambio al instante, sin volver a pedir datos. Sin parche (p. ej. tras convertir en proyecto) se
          // recarga todo.
          if (u) {
            setTickets((ts) => ts.map((t) => (t.id === u.id ? { ...t, ...u } : t)));
            setSelected((s) => (s && s.id === u.id ? { ...s, ...u } : s));
          } else {
            void load();
          }
        }}
      />
    </div>
  );
}
