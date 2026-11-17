import { useEffect, type RefObject } from "react";

/**
 * Inclinación sutil de una escena 3D con el puntero: escribe `--rx` y `--ry` (de -0.5 a 0.5) en el elemento y el
 * CSS los convierte en grados. Solo con ratón (`(pointer: fine)`) y sin `prefers-reduced-motion: reduce`: en táctil
 * y con movimiento reducido la escena queda en su pose fija. Una escritura por fotograma, sin estado de React.
 */
export function usePointerTilt(ref: RefObject<HTMLElement>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== "function") return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const apply = () => {
      frame = 0;
      el.style.setProperty("--rx", x.toFixed(3));
      el.style.setProperty("--ry", y.toFixed(3));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(apply);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      x = Math.min(0.5, Math.max(-0.5, (event.clientX - rect.left) / rect.width - 0.5));
      y = Math.min(0.5, Math.max(-0.5, (event.clientY - rect.top) / rect.height - 0.5));
      schedule();
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      schedule();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    };
  }, [ref]);
}
