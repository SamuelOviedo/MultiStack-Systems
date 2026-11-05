import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { Panel } from "@/components/admin/Panel";
import ProjectRow from "@/components/dashboard/dashboard-home/ProjectRow";
import { recentProjects } from "@/components/dashboard/dashboard-home/projectMetrics";
import { Button } from "@/components/ui/button";
import { type Project } from "@/types/projects";

const MAX_RECENT = 6;

export interface RecentProjectsProps {
  projects?: readonly Project[];
  stagesMap?: Record<string, number>;
  loading: boolean;
  error?: string;
  onRetry: () => void;
  onNewProject: () => void;
}

/** Los 6 proyectos con novedad más reciente y el camino a la lista completa. */
export default function RecentProjects({ projects, stagesMap = {}, loading, error, onRetry, onNewProject }: RecentProjectsProps) {
  const recent = useMemo(() => recentProjects(projects ?? [], MAX_RECENT), [projects]);
  return (
    <Panel
      title="Proyectos recientes"
      description="Ordenados por su última actualización."
      actions={
        <Button asChild variant="outline" size="sm">
          <Link to="/dashboard/proyectos">Ver todos los proyectos</Link>
        </Button>
      }
      loading={loading}
      skeletonRows={4}
      error={error}
      onRetry={onRetry}
      isEmpty={recent.length === 0}
      empty={
        <EmptyState
          icon={FolderKanban}
          title="Aún no hay proyectos"
          description="Crea el primero para empezar a seguir su avance."
          headingLevel="h3"
          action={
            <Button type="button" size="sm" onClick={onNewProject}>
              <Plus aria-hidden="true" />
              Nuevo proyecto
            </Button>
          }
        />
      }
      flush={recent.length > 0}
      className="overflow-hidden"
    >
      <ul className="divide-y">
        {recent.map((p) => (
          <li key={p.id}>
            <ProjectRow project={p} completedStages={stagesMap[p.id] ?? 0} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
