import { memo } from "react";
import {
  Activity, CheckCircle2, Circle, ChevronRight, ChevronDown, ChevronUp,
} from "lucide-react";
import { PIPELINE_STAGES, type ProjectStage, type PipelineStage } from "@/types/projects";

/** One-line metadata preview shown under a completed pipeline stage. */
function MetaSummary({ stageKey, metadata }: { stageKey: string; metadata: Record<string, unknown> }) {
  if (!metadata || Object.keys(metadata).length === 0) return null;
  const m = metadata as Record<string, string | number | boolean | string[] | undefined>;
  const summaries: Record<string, unknown[]> = {
    analisis:      [],
    dominio:       [m.dominio, m.proveedor, m.precio_anual && `${m.precio_anual} ${m.moneda ?? "USD"}/año`].filter(Boolean),
    desarrollo:    [(m.stack as string[] ?? []).join(", "), m.desarrollador].filter(Boolean),
    despliegue:    [m.plataforma, m.url_produccion].filter(Boolean),
    entrega:       [m.accesos_entregados && "Accesos ✓", m.documentacion_entregada && "Docs ✓", m.factura_emitida && "Factura ✓"].filter(Boolean),
    mantenimiento: [m.precio_mensual && `${m.precio_mensual} ${m.moneda ?? "HNL"}/mes`].filter(Boolean),
  };
  const parts = summaries[stageKey] ?? [];
  if (!parts.length) return null;
  return <p className="text-[10px] text-muted-foreground font-mono mt-1 line-clamp-1">{parts.join(" · ")}</p>;
}

export interface PipelineHeaderProps {
  stagesData: ProjectStage[];
  onStageClick: (stage: PipelineStage) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

/** Collapsible pipeline progress panel for a project's lifecycle stages. */
function PipelineHeader({ stagesData, onStageClick, isCollapsed, onToggleCollapse }: PipelineHeaderProps) {
  const completedKeys = new Set(stagesData.map(s => s.stage_key));
  const progress = Math.round((completedKeys.size / PIPELINE_STAGES.length) * 100);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="h-1 bg-border">
        <div
          className="h-full bg-primary transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-display text-xs text-foreground">
            PIPELINE <span className="text-muted-foreground">·</span>{" "}
            <span className="text-primary">{completedKeys.size}/{PIPELINE_STAGES.length}</span>{" "}
            <span className="text-muted-foreground">etapas</span>
          </span>
          <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">
            {progress}%
          </span>
        </div>
        {isCollapsed
          ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
          : <ChevronUp className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCollapsed ? "max-h-0" : "max-h-[600px]"}`}>
        <div className="px-4 pb-4 space-y-1">
          {PIPELINE_STAGES.map((stage, i) => {
            const done = completedKeys.has(stage.key);
            const stageData = stagesData.find(s => s.stage_key === stage.key) ?? null;
            return (
              <div key={stage.key}>
                <button
                  onClick={() => onStageClick(stage)}
                  className={`w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    done
                      ? "hover:bg-primary/5 border border-primary/20"
                      : "hover:bg-muted/20 border border-transparent"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {done
                      ? <CheckCircle2 className="h-4 w-4 text-primary" />
                      : <Circle className="h-4 w-4 text-border" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-display text-xs font-medium ${done ? "text-foreground" : "text-muted-foreground"}`}>
                      {stage.label}
                    </p>
                    {done && stageData ? (
                      <>
                        <p className="text-[10px] text-primary font-mono mt-0.5">
                          {new Date(stageData.completed_at).toLocaleDateString("es-HN")}
                          {stageData.completed_by ? ` · ${stageData.completed_by}` : ""}
                        </p>
                        <MetaSummary stageKey={stage.key} metadata={stageData.metadata as Record<string, unknown>} />
                      </>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{stage.description}</p>
                    )}
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                </button>
                {i < PIPELINE_STAGES.length - 1 && <div className="ml-5 w-px h-2 bg-border" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(PipelineHeader);
