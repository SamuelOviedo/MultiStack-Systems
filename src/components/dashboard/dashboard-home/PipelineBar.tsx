import { memo } from "react";
import { cn } from "@/lib/utils";
import { stageProgress } from "./projectMetrics";

export interface PipelineBarProps {
  /** Etapas registradas del proyecto (0..6). */
  completedCount: number;
  /** Nombre del proyecto, para el nombre accesible de la barra. */
  projectName: string;
  className?: string;
}

/**
 * Avance por etapas de un proyecto. Texto + barra: la etapa que toca, «2 de 6 etapas · 33%», y la
 * barra (6 tramos) es un `progressbar` con valor, mínimo, máximo y texto de valor para lectores de pantalla.
 */
function PipelineBar({ completedCount, projectName, className }: PipelineBarProps) {
  const { done, total, percent, currentLabel } = stageProgress(completedCount);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{currentLabel}</span>
        <span className="tabular shrink-0">
          {done} de {total} etapas · <span className="font-medium text-foreground">{percent}%</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Avance de ${projectName}`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} de ${total} etapas (${percent}%)`}
        className="flex gap-0.5"
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("h-1.5 flex-1 rounded-full", i < done ? "bg-primary" : "bg-muted-foreground/25")}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(PipelineBar);
