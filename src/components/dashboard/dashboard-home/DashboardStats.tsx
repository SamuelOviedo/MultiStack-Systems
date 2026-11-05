import { memo, useMemo } from "react";
import { KpiTile } from "@/components/admin/KpiTile";
import { type Project } from "@/types/projects";
import { projectCounts } from "./projectMetrics";

export interface DashboardStatsProps {
  /** `undefined` mientras carga o si la carga falló (se muestra «—», nunca un 0 inventado). */
  projects?: readonly Project[];
  loading?: boolean;
  /** Tickets abiertos reales; `undefined` o `null` = sin dato. */
  openTickets?: number | null;
  ticketsLoading?: boolean;
}

/**
 * Indicadores del resumen. Los cuatro de proyectos usan las reglas de siempre (`projectCounts`);
 * «Tickets abiertos» sale de `getAllTickets` y muestra «—» si esa lectura falla.
 *
 * Jerarquía: «Tickets abiertos» es lo que pide una acción, así que va primero y pesa más (`lead`); los cuatro de
 * proyectos son contexto. La cuadrícula nunca deja un indicador suelto: en dos columnas el principal ocupa la fila
 * entera y los cuatro restantes forman 2 × 2; desde `xl` son cinco columnas (el principal 1,5 veces más ancha).
 */
function DashboardStats({ projects, loading = false, openTickets, ticketsLoading = false }: DashboardStatsProps) {
  const counts = useMemo(() => (projects ? projectCounts(projects) : null), [projects]);
  return (
    <section
      aria-label="Indicadores"
      className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]"
    >
      <KpiTile
        label="Tickets abiertos"
        value={openTickets}
        hint="Recibidos, en revisión o en progreso"
        loading={ticketsLoading}
        emphasis="lead"
        className="col-span-2 xl:col-span-1"
      />
      <KpiTile label="Total de proyectos" value={counts?.todos} loading={loading} />
      <KpiTile label="Proyectos activos" value={counts?.activos} hint="Activos y en mantenimiento" loading={loading} />
      <KpiTile
        label="Proyectos en progreso"
        value={counts?.enProgreso}
        hint="En análisis, desarrollo o despliegue"
        loading={loading}
      />
      <KpiTile label="Pausados o cancelados" value={counts?.pausados} loading={loading} />
    </section>
  );
}

export default memo(DashboardStats);
