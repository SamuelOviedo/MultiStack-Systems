import { memo } from "react";
import { AlertTriangle } from "lucide-react";
import { daysUntil } from "@/lib/projects";
import { type ProjectService } from "@/types/projects";

type Renewal = ProjectService & { nombre_proyecto: string };

/** Warning panel listing service renewals due within the next 30 days. */
function RenewalAlerts({ renewals }: { renewals: Renewal[] }) {
  if (renewals.length === 0) return null;
  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <span className="font-mono text-xs text-warning">Renovaciones próximas (30 días)</span>
      </div>
      <div className="space-y-2">
        {renewals.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-xs">
            <span className="font-mono text-muted-foreground">
              {r.nombre_proyecto} — <span className="text-foreground">{r.name}</span>
            </span>
            <span className={`font-mono font-medium ${daysUntil(r.renewal_date!) <= 7 ? "text-destructive" : "text-warning"}`}>
              {daysUntil(r.renewal_date!)}d
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(RenewalAlerts);
