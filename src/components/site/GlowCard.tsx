import { useCallback, useEffect, useRef, type CSSProperties, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import { useRevealInView } from "@/hooks/useRevealInView";
import { cn } from "./cn";

type GlowCardProps = {
  className?: string;
  contentClassName?: string;
  /** Fondo de la tarjeta (por defecto `bg-site-card`). */
  faceClassName?: string;
  /** Color del borde en reposo (por defecto `bg-site-border`). */
  edgeClassName?: string;
  /** Radio de la esquina: `2xl` o `3xl` (por defecto). */
  radius?: "2xl" | "3xl";
  /** Entrada al aparecer en pantalla; solo donde suma (p. ej. el bento de servicios). */
  reveal?: boolean;
  /** Posición en la cuadrícula, para escalonar la entrada (60 ms por posición). */
  index?: number;
  children: ReactNode;
};

/** Teclado: el foco de luz se centra. Con el ratón ya lo lleva el puntero. */
function isKeyboardFocus(target: EventTarget): boolean {
  try {
    return (target as Element).matches(":focus-visible");
  } catch {
    return true; // entornos sin soporte del selector
  }
}

/**
 * Tarjeta con brillo que sigue al cursor: borde, foco de luz y cuadrícula. Sin re-render al mover el puntero:
 * `pointermove` escribe `--gx`/`--gy` directamente en el DOM, a lo más una vez por cuadro (requestAnimationFrame), y
 * el CSS de `.gc-*` (site.css) hace el resto. El estado de brillo es el atributo `data-glow` de la capa de efectos.
 *
 * Es un `div` sin semántica, sin tabindex y sin capturar el foco: el contenido (enlaces, botones) sigue siendo
 * lo único enfocable. Con el teclado, el brillo se centra al enfocar algo dentro y se apaga al salir. En pantallas
 * táctiles no hay brillo (sería un destello al empezar cada desplazamiento).
 */
export function GlowCard({
  className,
  contentClassName,
  faceClassName,
  edgeClassName,
  radius = "3xl",
  reveal = false,
  index = 0,
  children,
}: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const point = useRef({ x: 0, y: 0 });
  // Dos causas independientes del brillo: puntero encima y foco de teclado dentro.
  const lit = useRef({ pointer: false, focus: false });

  useRevealInView(cardRef, reveal);

  const apply = useCallback(() => {
    const fx = fxRef.current;
    if (!fx) return;
    if (lit.current.pointer || lit.current.focus) fx.setAttribute("data-glow", "");
    else fx.removeAttribute("data-glow");
  }, []);

  const flush = useCallback(() => {
    frame.current = 0;
    const card = cardRef.current;
    const fx = fxRef.current;
    if (!card || !fx) return;
    const rect = card.getBoundingClientRect();
    fx.style.setProperty("--gx", `${point.current.x - rect.left}px`);
    fx.style.setProperty("--gy", `${point.current.y - rect.top}px`);
  }, []);

  const track = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      point.current = { x: e.clientX, y: e.clientY };
      if (!frame.current) frame.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const onPointerEnter = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    lit.current.pointer = true;
    track(e);
    apply();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    track(e);
  };

  const onPointerLeave = () => {
    lit.current.pointer = false;
    apply();
  };

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    if (!isKeyboardFocus(e.target)) return;
    const fx = fxRef.current;
    const card = cardRef.current;
    if (fx && card) {
      fx.style.setProperty("--gx", `${card.offsetWidth / 2}px`);
      fx.style.setProperty("--gy", `${card.offsetHeight / 2}px`);
    }
    lit.current.focus = true;
    apply();
  };

  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    lit.current.focus = false;
    apply();
  };

  const style: CSSProperties | undefined =
    reveal && index > 0 ? ({ "--reveal-delay": `${index * 0.06}s` } as CSSProperties) : undefined;

  return (
    <div
      ref={cardRef}
      className={cn("gc group relative", className)}
      data-radius={radius}
      style={style}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div ref={fxRef} aria-hidden="true" className="gc-fx">
        <div className={cn("gc-base bg-site-border", edgeClassName)} />
        <div className="gc-edge" />
        <div className={cn("gc-face bg-site-card", faceClassName)}>
          <div className="gc-spot" />
          <div className="gc-grid" />
        </div>
      </div>
      <div className={cn("relative z-10 flex h-full flex-col p-6", contentClassName)}>{children}</div>
    </div>
  );
}
