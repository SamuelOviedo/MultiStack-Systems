import { Check } from "lucide-react";

const FEATURES = [
  "Gestiona pipelines y entregas en tiempo real",
  "Tickets, servicios y accesos centralizados",
  "Portal de cliente con actualizaciones automáticas",
];

const LOG_LINES = [
  { time: "14:23", icon: "✓", iconClass: "text-success",     text: <>deploy <span className="text-foreground">proyecto-matys</span> completado</> },
  { time: "14:19", icon: "↻", iconClass: "text-primary",     text: <>ticket <span className="text-foreground">#t-089</span> asignado a dev-01</> },
  { time: "14:11", icon: "⚠", iconClass: "text-warning",     text: <>ssl-cert vence en <span className="text-foreground">12d</span></> },
];

export default function AuthBrandPanel() {
  return (
    <div className="dark relative overflow-hidden border-r border-border px-12 py-8 flex flex-col lg:min-h-screen bg-[linear-gradient(180deg,_hsl(218_56%_14%)_0%,_hsl(222_43%_7%)_100%)]">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute top-[-120px] left-[-120px] w-[480px] h-[480px]"
        style={{ background: "radial-gradient(circle, hsl(199 89% 48% / 0.18) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute bottom-[-160px] right-[-120px] w-[520px] h-[520px]"
        style={{ background: "radial-gradient(circle, hsl(187 92% 43% / 0.12) 0%, transparent 70%)" }}
      />

      {/* Header: logo + status pill */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src="/logo-white.png"
            alt="MultiStack Systems Logo"
            className="h-7 w-auto object-contain shrink-0"
          />
          <span className="font-display font-bold text-[18px] tracking-[-0.01em] text-foreground">
            MultiStack Systems
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border border-success/30 bg-success/12 text-success text-[10px] font-mono font-medium uppercase tracking-[0.05em]">
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-blink" />
          v2.4 · ESTABLE
        </div>
      </div>

      {/* Main brand content */}
      <div className="relative flex-1 flex flex-col justify-center py-12">
        <h1 className="font-display font-semibold text-[44px] leading-[1.05] tracking-tight text-foreground mb-4">
          Tu stack de proyectos,{" "}
          <span className="text-primary">en una sola consola.</span>
        </h1>
        <p className="font-sans text-base text-[hsl(var(--body-foreground))] leading-relaxed mb-8 max-w-sm">
          Gestiona proyectos, servicios y clientes desde un solo panel. Hecho para equipos que entregan.
        </p>
        <ul className="flex flex-col gap-3">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-3">
              <span className="w-[22px] h-[22px] rounded-md bg-success/15 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-success" />
              </span>
              <span className="text-sm text-foreground">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Activity log terminal (bottom, desktop only) */}
      <div className="relative mt-auto hidden lg:block">
        <div className="rounded-lg border border-border bg-background/70 overflow-hidden">
          <div className="flex items-center gap-2 px-3.5 py-2 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-[9px] h-[9px] rounded-full" style={{ background: "#FF5F56" }} />
              <div className="w-[9px] h-[9px] rounded-full" style={{ background: "#FFBD2E" }} />
              <div className="w-[9px] h-[9px] rounded-full" style={{ background: "#27C93F" }} />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground ml-1">
              ~/multistack/activity.log
            </span>
          </div>
          <div className="p-3.5 space-y-0.5">
            {LOG_LINES.map((l, i) => (
              <div key={i} className="flex items-center gap-2 font-mono text-xs leading-[1.8]">
                <span className="text-muted-foreground shrink-0 tabular-nums">{l.time}</span>
                <span className={`${l.iconClass} shrink-0 w-3 text-center`}>{l.icon}</span>
                <span className="text-[hsl(var(--body-foreground))]">{l.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
