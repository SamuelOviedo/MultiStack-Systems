import { memo } from "react";
import { PIPELINE_STAGES } from "@/types/projects";

const TOTAL_STAGES = PIPELINE_STAGES.length;

/** Compact pipeline progress bar shown on a project card. */
function PipelineBar({ completedCount }: { completedCount: number }) {
  const pct = Math.round((completedCount / TOTAL_STAGES) * 100);
  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] text-muted-foreground font-mono">
          {PIPELINE_STAGES[Math.min(completedCount, TOTAL_STAGES - 1)].label}
        </span>
        <span className="text-[10px] text-primary font-mono">{pct}%</span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex mt-1 gap-0.5">
        {PIPELINE_STAGES.map((s, i) => (
          <div
            key={s.key}
            className={`flex-1 h-0.5 rounded-full ${i < completedCount ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default memo(PipelineBar);
