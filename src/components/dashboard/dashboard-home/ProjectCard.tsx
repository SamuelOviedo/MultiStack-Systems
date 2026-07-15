import { memo } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import PipelineBar from "@/components/dashboard/dashboard-home/PipelineBar";
import { STATUS_CONFIG, type Project } from "@/types/projects";

export interface ProjectCardProps {
  project: Project;
  completedStages: number;
}

/** A single project tile in the dashboard grid. */
function ProjectCard({ project: p, completedStages }: ProjectCardProps) {
  const cfg = STATUS_CONFIG[p.estado] ?? STATUS_CONFIG.en_analisis;
  return (
    <Link
      to={`/dashboard/project/${p.id}`}
      className="rounded-lg border border-border bg-card p-5 hover:border-primary/40 transition-colors group block"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-display text-sm font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
          {p.nombre_proyecto}
        </h3>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2" />
      </div>

      <span className={`inline-block font-mono text-[10px] px-2 py-0.5 rounded border ${cfg.color}`}>
        {cfg.label}
      </span>

      {p.client_name && (
        <p className="text-[11px] text-muted-foreground font-mono mt-2">{p.client_name}</p>
      )}
      {p.descripcion && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.descripcion}</p>
      )}

      <PipelineBar completedCount={completedStages} />

      <p className="text-[10px] text-muted-foreground font-mono mt-3">
        {new Date(p.fecha_creacion).toLocaleDateString("es-HN")}
      </p>
    </Link>
  );
}

export default memo(ProjectCard);
