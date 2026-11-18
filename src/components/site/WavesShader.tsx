import { useCallback, useEffect, useState, type ComponentType } from "react";
import { cn } from "./cn";
import { useReducedMotion } from "./useReducedMotion";
import type { WavesShaderCanvasProps } from "./WavesShaderCanvas";

export type WavesColors = readonly [string, string, string, string];

/** Paleta del manual de marca, de abajo hacia arriba: teal claro, teal, transición y azul medianoche. */
const BRAND_WAVES: WavesColors = ["#068DB3", "#137590", "#0B2533", "#080D13"];

interface WavesShaderProps {
  /** Cuatro colores en hex, de abajo hacia arriba (por defecto, la paleta de la marca). */
  colors?: WavesColors;
  className?: string;
  /** Escala de resolución interna (0.5 = la mitad); las ondas son suaves y no lo notan. */
  resolution?: number;
}

type CanvasComponent = ComponentType<WavesShaderCanvasProps>;

/** Ejecuta `task` después del primer pintado, cuando el navegador queda libre (o a los 1,5 s como máximo). */
function afterFirstPaint(task: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(task, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }
  // Safari: dos cuadros después de pedir el primero ya hubo pintado.
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(task);
  });
  return () => {
    cancelAnimationFrame(first);
    if (second) cancelAnimationFrame(second);
  };
}

/**
 * Fondo de ondas WebGL. Pensado para ir `absolute inset-0` dentro de una sección `relative` (usa `className` para
 * el z-index, p. ej. `-z-10`). Decorativo: `aria-hidden` y sin eventos de puntero.
 *
 * - El degradado CSS de respaldo (site.css, `.waves`) se pinta desde el primer cuadro: es lo que se ve antes de que
 *   cargue el shader, sin WebGL, con el shader roto o con movimiento reducido.
 * - El shader (GLSL y bucle de dibujo) está en su propio chunk (`WavesShaderCanvas`) y se pide con `import()` después
 *   del primer pintado: no entra en el chunk de entrada ni compite con el LCP. Si el chunk falla (sin red), se queda
 *   el degradado.
 * - Con `prefers-reduced-motion: reduce` no se monta el lienzo ni se descarga el chunk.
 * - El lienzo dibuja solo a la vista y con la pestaña visible, a una resolución interna reducida (DPR máximo 2 ×
 *   `resolution`), y devuelve el contexto WebGL al navegador al desmontarse.
 * - `data-state`: `fallback` (degradado), `loading` (lienzo montado, sin primer cuadro) o `live`.
 */
export function WavesShader({ colors = BRAND_WAVES, className, resolution = 0.5 }: WavesShaderProps) {
  const reduced = useReducedMotion();
  const [Canvas, setCanvas] = useState<CanvasComponent | null>(null);
  const [state, setState] = useState<"fallback" | "loading" | "live">("fallback");
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (reduced) setState("fallback");
    if (reduced || unavailable) return;
    let alive = true;
    const cancel = afterFirstPaint(() => {
      import("./WavesShaderCanvas")
        .then((module) => {
          if (!alive) return;
          setState((current) => (current === "fallback" ? "loading" : current));
          setCanvas(() => module.default);
        })
        .catch(() => {
          // Sin chunk no hay shader: queda el degradado.
        });
    });
    return () => {
      alive = false;
      cancel();
    };
  }, [reduced, unavailable]);

  const onLive = useCallback(() => setState("live"), []);
  const onUnavailable = useCallback(() => {
    setUnavailable(true);
    setState("fallback");
  }, []);

  const showCanvas = Canvas !== null && !reduced && !unavailable;

  return (
    <div aria-hidden="true" data-state={showCanvas ? state : "fallback"} className={cn("waves", className)}>
      {showCanvas && <Canvas colors={colors} resolution={resolution} onLive={onLive} onUnavailable={onUnavailable} />}
    </div>
  );
}
