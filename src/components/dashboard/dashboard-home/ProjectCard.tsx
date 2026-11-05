import { memo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import PipelineBar from "@/components/dashboard/dashboard-home/PipelineBar";
import { safeProjectStatus } from "@/components/dashboard/dashboard-home/projectStatus";
import { type Project } from "@/types/projects";

export interface ProjectCardProps {
  project: Project;
  completedStages: number;
}

/** Un proyecto en la lista completa: todo el bloque es el enlace al detalle. */
function ProjectCard({ project: p, completedStages }: ProjectCardProps) {
  return (
    <Link
      to={`/dashboard/project/${p.id}`}
      className="group flex h-full flex-col gap-3 rounded-lg border bg-card p-4 shadow-card transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="line-clamp-1 text-base font-semibold leading-snug">{p.nombre_proyecto}</h2>
        <ChevronRight aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="space-y-1.5">
        <StatusBadge kind="project" value={safeProjectStatus(p.estado)} />
        {p.client_name && <p className="text-sm text-muted-foreground">{p.client_name}</p>}
        {p.descripcion && <p className="line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>}
      </div>

      <div className="mt-auto space-y-3 pt-1">
        <PipelineBar completedCount={completedStages} projectName={p.nombre_proyecto} />
        <p className="text-xs text-muted-foreground">
          Creado el <time dateTime={p.fecha_creacion}>{new Date(p.fecha_creacion).toLocaleDateString("es-HN")}</time>
        </p>
      </div>
    </Link>
  );
}

export default memo(ProjectCard);
