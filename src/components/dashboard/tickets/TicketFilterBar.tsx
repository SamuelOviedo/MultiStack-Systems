import { useId, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TICKET_PRIORITY_CONFIG, TICKET_STATUS_CONFIG, TICKET_TYPE_LABELS } from "@/types/tickets";
import { cn } from "@/lib/utils";
import { ALL, UNASSIGNED, type SortDir, type SortKey, type TicketFilters } from "./ticketList";

function Field({
  label, value, onValueChange, children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

const SORT_LABELS: Record<SortKey, string> = { updated_at: "Actividad", created_at: "Creado", priority: "Prioridad" };

export interface TicketFilterBarProps {
  filters: TicketFilters;
  onChange: (patch: Partial<TicketFilters>) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  projects: string[];
  assignees: string[];
  /** El colaborador solo ve lo suyo: no se le ofrece filtrar por responsable. */
  showAssignee: boolean;
  /**
   * Pantalla angosta: los filtros se recogen tras un botón «Filtros» (para que los tickets queden a la vista) y,
   * como no hay encabezados de tabla, el orden se elige aquí.
   */
  narrow: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortKey: (key: SortKey) => void;
  onToggleDir: () => void;
}

/**
 * Búsqueda y los cinco filtros de siempre (estado, tipo, prioridad, proyecto y responsable) sobre los tickets ya
 * cargados. «Proyecto» solo aparece si hay algún proyecto en los datos; «Asignado» solo para el administrador.
 */
export function TicketFilterBar({
  filters, onChange, onClear, hasActiveFilters, projects, assignees, showAssignee,
  narrow, sortKey, sortDir, onSortKey, onToggleDir,
}: TicketFilterBarProps) {
  const searchId = useId();
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const activeCount = [filters.status, filters.type, filters.priority, filters.project, filters.assignee].filter((v) => v !== ALL).length;
  const showFields = !narrow || expanded;
  return (
    <div className="space-y-3 border-b p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Label htmlFor={searchId} className="sr-only">
            Buscar tickets
          </Label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={searchId}
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Buscar por título, proyecto o cliente"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <div className="flex items-center gap-2">
          {narrow && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setExpanded((v) => !v)}
            >
              Filtros y orden
              {activeCount > 0 && (
                <span className="tabular rounded-full bg-primary/15 px-1.5 text-xs text-foreground">
                  {activeCount}
                  <span className="sr-only"> {activeCount === 1 ? "filtro activo" : "filtros activos"}</span>
                </span>
              )}
              <ChevronDown aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", expanded && "rotate-180")} />
            </Button>
          )}
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              Quitar filtros
            </Button>
          )}
        </div>
      </div>

      <div id={panelId} className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5", !showFields && "hidden")}>
        <Field label="Estado" value={filters.status} onValueChange={(v) => onChange({ status: v as TicketFilters["status"] })}>
          <SelectItem value={ALL}>Todos</SelectItem>
          {Object.entries(TICKET_STATUS_CONFIG).map(([v, c]) => (
            <SelectItem key={v} value={v}>
              {c.label}
            </SelectItem>
          ))}
        </Field>
        <Field label="Tipo" value={filters.type} onValueChange={(v) => onChange({ type: v as TicketFilters["type"] })}>
          <SelectItem value={ALL}>Todos</SelectItem>
          {Object.entries(TICKET_TYPE_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </Field>
        <Field label="Prioridad" value={filters.priority} onValueChange={(v) => onChange({ priority: v as TicketFilters["priority"] })}>
          <SelectItem value={ALL}>Todas</SelectItem>
          {Object.entries(TICKET_PRIORITY_CONFIG).map(([v, c]) => (
            <SelectItem key={v} value={v}>
              {c.label}
            </SelectItem>
          ))}
        </Field>
        {projects.length > 0 && (
          <Field label="Proyecto" value={filters.project} onValueChange={(v) => onChange({ project: v })}>
            <SelectItem value={ALL}>Todos</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </Field>
        )}
        {showAssignee && (
          <Field label="Asignado" value={filters.assignee} onValueChange={(v) => onChange({ assignee: v })}>
            <SelectItem value={ALL}>Todos</SelectItem>
            <SelectItem value={UNASSIGNED}>Sin asignar</SelectItem>
            {assignees.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </Field>
        )}
        {narrow && (
          <div className="col-span-2 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Ordenar por" value={sortKey} onValueChange={(v) => onSortKey(v as SortKey)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {SORT_LABELS[k]}
                  </SelectItem>
                ))}
              </Field>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onToggleDir}
              aria-label={sortDir === "desc" ? "Orden descendente, cambiar a ascendente" : "Orden ascendente, cambiar a descendente"}
            >
              {sortDir === "desc" ? <ArrowDown aria-hidden="true" /> : <ArrowUp aria-hidden="true" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
