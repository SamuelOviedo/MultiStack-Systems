import { Pause, Play } from "lucide-react";
import { cn } from "./cn";
import { useMotionPaused } from "./motionPause";
import { SiteButton } from "./SiteButton";
import { useReducedMotion } from "./useReducedMotion";

export interface MotionToggleLabels {
  /** Texto del botón con las animaciones en marcha («Pausar animaciones»). */
  pause: string;
  /** Texto del botón con las animaciones pausadas («Reanudar animaciones»). */
  resume: string;
}

export interface MotionToggleProps {
  labels: MotionToggleLabels;
  className?: string;
}

/**
 * Botón para pausar y reanudar las animaciones en bucle del sitio (WCAG 2.2.2). El texto visible dice lo que hará al
 * pulsarlo, así que es también el nombre accesible y no lleva `aria-pressed` (con la etiqueta cambiante, el estado
 * ya está en el texto). Mide 32 px de alto. Con `prefers-reduced-motion: reduce` no se dibuja: ya no hay nada en
 * movimiento que pausar.
 */
export function MotionToggle({ labels, className }: MotionToggleProps) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useMotionPaused();
  if (reduced) return null;
  const Icon = paused ? Play : Pause;
  return (
    <SiteButton
      variant="glass"
      size="sm"
      className={cn("rounded-full text-site-foreground", className)}
      onClick={() => setPaused(!paused)}
    >
      <Icon aria-hidden="true" />
      {paused ? labels.resume : labels.pause}
    </SiteButton>
  );
}
