import { memo, useMemo } from "react";
import { FolderKanban, Activity, Clock, PauseCircle } from "lucide-react";
import { type Project } from "@/types/projects";

/** Four headline counters summarizing the project portfolio. */
function DashboardStats({ projects }: { projects: Project[] }) {
  const tiles = useMemo(() => {
    const counts = {
      total:      projects.length,
      activos:    projects.filter(p => p.estado === "activo" || p.estado === "mantenimiento").length,
      desarrollo: projects.filter(p => ["en_analisis", "en_desarrollo", "en_despliegue"].includes(p.estado)).length,
      pausados:   projects.filter(p => p.estado === "pausado" || p.estado === "cancelado").length,
    };
    return [
      { icon: FolderKanban, label: "Total",       value: counts.total,      color: "text-foreground" },
      { icon: Activity,     label: "Activos",      value: counts.activos,     color: "text-primary" },
      { icon: Clock,        label: "En progreso",  value: counts.desarrollo,  color: "text-accent" },
      { icon: PauseCircle,  label: "Pausados",     value: counts.pausados,    color: "text-muted-foreground" },
    ];
  }, [projects]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {tiles.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-3.5 w-3.5 ${color}`} />
            <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
          </div>
          <p className={`font-display text-2xl font-bold ${color}`}>{value}</p>
        </div>
      ))}
    </div>
  );
}

export default memo(DashboardStats);
