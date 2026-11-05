import { memo, useId } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Circle, CircleDot } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { PIPELINE_STAGES, type PipelineStage, type ProjectStage } from "@/types/projects";
import { formatStageDay, responsableLabel, stageCalendarDay, stageSummary } from "./format";

type StageState = "completada" | "actual" | "pendiente";

const STATE_TEXT: Record<StageState, string> = {
  completada: "Completada",
  actual: "Actual",
  pendiente: "Pendiente",
};

const STATE_ICON: Record<StageState, { Icon: typeof Circle; className: string }> = {
  completada: { Icon: CheckCircle2, className: "text-success" },
  actual: { Icon: CircleDot, className: "text-primary" },
  pendiente: { Icon: Circle, className: "text-muted-foreground" },
};

export interface PipelineHeaderProps {
  stagesData: ProjectStage[];
  onStageClick: (stage: PipelineStage) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/**
 * Pipeline del proyecto: seis etapas como lista ordenada. Cada etapa dice su estado con TEXTO e icono (completada,
 * actual = la primera que falta, pendiente), su fecha de registro y quién la completó. El bloque se pliega con un
 * botón que informa `aria-expanded`; plegado no es alcanzable con el teclado (`hidden`).
 */
function PipelineHeader({ stagesData, onStageClick, isCollapsed, onToggleCollapse }: PipelineHeaderProps) {
  const listId = useId();
  const headingId = useId();
  const completedKeys = new Set(stagesData.map((s) => s.stage_key));
  const total = PIPELINE_STAGES.length;
  const done = completedKeys.size;
  const progress = Math.round((done / total) * 100);
  const currentKey = PIPELINE_STAGES.find((s) => !completedKeys.has(s.key))?.key;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-lg border bg-card text-card-foreground shadow-card">
      <h2 id={headingId} className="text-base font-semibold leading-tight tracking-tight">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-controls={listId}
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
        >
          <span className="min-w-0 space-y-1">
            <span className="block">Pipeline del proyecto</span>
            <span className="block text-sm font-normal text-muted-foreground">
              <span className="tabular">{done} de {total}</span> etapas registradas ({progress} %)
            </span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform duration-150 motion-reduce:transition-none", !isCollapsed && "rotate-180")}
          />
        </button>
      </h2>
      <Progress value={progress} aria-label={`Avance del proyecto: ${done} de ${total} etapas`} className="h-1 rounded-none" />

      <ol
        id={listId}
        hidden={isCollapsed}
        className="divide-y animate-in fade-in-0 duration-150 motion-reduce:animate-none"
      >
        {PIPELINE_STAGES.map((stage) => {
          const data = stagesData.find((s) => s.stage_key === stage.key) ?? null;
          const state: StageState = data ? "completada" : stage.key === currentKey ? "actual" : "pendiente";
          const { Icon, className: iconClass } = STATE_ICON[state];
          const who = data ? responsableLabel(data.completed_by) : null;
          const summary = data ? stageSummary(stage.key, data.metadata) : [];
          return (
            <li key={stage.key} aria-current={state === "actual" ? "step" : undefined}>
              <button
                type="button"
                onClick={() => onStageClick(stage)}
                className="group flex w-full items-start gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
              >
                <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
                <span className="min-w-0 flex-1 space-y-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium">{stage.label}</span>
                    <span className="text-xs text-muted-foreground">{STATE_TEXT[state]}</span>
                  </span>
                  {data ? (
                    <>
                      <span className="block text-xs text-muted-foreground">
                        <time dateTime={stageCalendarDay(data.completed_at) ?? undefined}>{formatStageDay(data.completed_at)}</time>
                        {who ? ` · ${who}` : ""}
                      </span>
                      {summary.length > 0 && <span className="block break-words text-xs text-foreground/80">{summary.join(" · ")}</span>}
                    </>
                  ) : (
                    <span className="block text-xs text-muted-foreground">{stage.description}</span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <span className="hidden sm:inline">{data ? "Editar" : "Registrar"}</span>
                  <ChevronRight aria-hidden="true" className="size-3.5" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default memo(PipelineHeader);
