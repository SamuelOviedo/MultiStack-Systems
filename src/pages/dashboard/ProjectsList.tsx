import { useMemo, useState } from "react";
import { FolderKanban, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LazyNewProjectModal } from "@/components/dashboard/dashboard-home/LazyModals";
import { preloadNewProjectModal, useLazyModal } from "@/components/dashboard/dashboard-home/modalLoaders";
import ProjectCard from "@/components/dashboard/dashboard-home/ProjectCard";
import { loadErrorMessage } from "@/components/dashboard/dashboard-home/loadErrors";
import {
  inStatusGroup,
  matchesQuery,
  projectCounts,
  type StatusGroup,
} from "@/components/dashboard/dashboard-home/projectMetrics";
import { useProjectsOverview } from "@/components/dashboard/dashboard-home/useDashboardData";

const FILTERS: { group: StatusGroup; label: string }[] = [
  { group: "todos", label: "Todos" },
  { group: "activos", label: "Activos" },
  { group: "enProgreso", label: "En progreso" },
  { group: "pausados", label: "Pausados o cancelados" },
];

const countLabel = (n: number): string => (n === 1 ? "1 proyecto" : `${n} proyectos`);

/**
 * Lista completa de proyectos (`/dashboard/proyectos`). Mismas tarjetas y mismos datos que tenía el panel
 * principal; además, búsqueda y filtro por estado SOBRE los proyectos ya cargados (en el navegador: no hay
 * consulta nueva). Los grupos de estado son los de los contadores del Resumen.
 */
export default function ProjectsList() {
  const overview = useProjectsOverview();
  const newProject = useLazyModal();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<StatusGroup>("todos");

  const projects = overview.data?.projects;
  const stagesMap = overview.data?.stagesMap ?? {};

  // Los números de cada filtro cuentan lo que la búsqueda deja pasar, para que sumen lo que se ve.
  const searched = useMemo(() => (projects ?? []).filter((p) => matchesQuery(p, query)), [projects, query]);
  const counts = useMemo(() => projectCounts(searched), [searched]);
  const visible = useMemo(() => searched.filter((p) => inStatusGroup(p.estado, group)), [searched, group]);
  const filtering = query.trim() !== "" || group !== "todos";

  const clearFilters = () => {
    setQuery("");
    setGroup("todos");
  };

  let body;
  if (overview.isPending) {
    body = (
      <div aria-busy="true" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <span className="sr-only">Cargando proyectos…</span>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  } else if (overview.isError) {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm">
        <p>{loadErrorMessage(overview.error, "los proyectos")}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void overview.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  } else if ((projects ?? []).length === 0) {
    body = (
      <EmptyState
        icon={FolderKanban}
        title="Aún no hay proyectos"
        description="Crea el primero para empezar a seguir su avance."
        action={
          <Button type="button" size="sm" onClick={newProject.show} onPointerEnter={preloadNewProjectModal} onFocus={preloadNewProjectModal}>
            <Plus aria-hidden="true" />
            Nuevo proyecto
          </Button>
        }
      />
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={Search}
        title="Ningún proyecto coincide"
        description="Prueba con otra palabra o quita los filtros."
        action={
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            Quitar filtros
          </Button>
        }
      />
    );
  } else {
    body = (
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((p) => (
          <li key={p.id} className="min-w-0">
            <ProjectCard project={p} completedStages={stagesMap[p.id] ?? 0} />
          </li>
        ))}
      </ul>
    );
  }

  const total = projects?.length ?? 0;
  const loaded = overview.isSuccess && (projects ?? []).length > 0;

  return (
    <div className="container mx-auto max-w-7xl space-y-5 px-4 pb-10 sm:px-6">
      <PageHeader
        title="Proyectos"
        description="Todos los proyectos, con su estado y su avance por etapas."
        actions={
          <Button type="button" size="sm" onClick={newProject.show} onPointerEnter={preloadNewProjectModal} onFocus={preloadNewProjectModal}>
            <Plus aria-hidden="true" />
            Nuevo proyecto
          </Button>
        }
      />

      {loaded && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <label htmlFor="buscar-proyectos" className="sr-only">
                Buscar proyectos
              </label>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="buscar-proyectos"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, cliente o descripción"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
              {FILTERS.map(({ group: g, label }) => (
                <Button
                  key={g}
                  type="button"
                  size="sm"
                  variant="outline"
                  aria-pressed={group === g}
                  onClick={() => setGroup(g)}
                  className={cn(
                    "gap-1.5 transition-colors motion-reduce:transition-none",
                    group === g ? "border-foreground bg-card font-semibold" : "text-muted-foreground",
                  )}
                >
                  {label}
                  <span className="tabular text-xs font-normal">{counts[g]}</span>
                </Button>
              ))}
            </div>
          </div>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {filtering
              ? `Mostrando ${visible.length} de ${countLabel(total)}`
              : countLabel(total)}
          </p>
        </div>
      )}

      {body}

      <LazyNewProjectModal
        armed={newProject.armed}
        open={newProject.open}
        onClose={newProject.hide}
        onCreated={() => void overview.refetch()}
      />
    </div>
  );
}
