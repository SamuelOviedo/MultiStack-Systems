import { memo } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/admin/StatusBadge";
import PipelineBar from "@/components/dashboard/dashboard-home/PipelineBar";
import { lastTouched } from "@/components/dashboard/dashboard-home/projectMetrics";
import { safeProjectStatus } from "@/components/dashboard/dashboard-home/projectStatus";
import { type Project } from "@/types/projects";

export interface ProjectRowProps {
  project: Project;
  completedStages: number;
}

/** Un proyecto en el resumen: una fila compacta que enlaza al detalle. */
function ProjectRow({ project: p, completedStages }: ProjectRowProps) {
  const touched = lastTouched(p);
  return (
    <Link
      to={`/dashboard/project/${p.id}`}
      className="flex flex-col gap-2 px-4 py-3 transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium">{p.nombre_proyecto}</p>
        {/* Sin recorte: si no cabe en una línea pasa a la siguiente, y la fecha se mueve entera. */}
        <p className="break-words text-xs text-muted-foreground">
          {p.client_name ? `${p.client_name} · ` : ""}
          <span className="whitespace-nowrap">
            Actualizado el <time dateTime={touched}>{new Date(touched).toLocaleDateString("es-HN")}</time>
          </span>
        </p>
      </div>
      <StatusBadge kind="project" value={safeProjectStatus(p.estado)} />
      <PipelineBar completedCount={completedStages} projectName={p.nombre_proyecto} className="sm:w-64 sm:shrink-0" />
    </Link>
  );
}

export default memo(ProjectRow);
