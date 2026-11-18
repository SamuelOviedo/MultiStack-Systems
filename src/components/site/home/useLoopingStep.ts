import { useEffect, useRef, useState, type RefObject } from "react";
import { useInView } from "@/hooks/useInView";
import { useReducedMotion } from "../useReducedMotion";

/**
 * Repite una secuencia de `total` pasos (0 … total - 1) solo mientras `ref` está a la vista; fuera de pantalla el
 * reloj se detiene y no cuesta nada. Con movimiento reducido no hay reloj: se muestra el último paso, que en las
 * secuencias de la home es el estado final (terminal completa, conversación completa).
 */
export function useLoopingStep<T extends HTMLElement = HTMLDivElement>(
  total: number,
  intervalMs: number,
): { ref: RefObject<T>; step: number } {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => setStep((s) => (s >= total - 1 ? 0 : s + 1)), intervalMs);
    return () => window.clearInterval(id);
  }, [inView, reduced, total, intervalMs]);

  return { ref, step: reduced ? total - 1 : step };
}

/**
 * Entrada de un grupo escalonado (chips, barras): `false` hasta que el grupo se ve por primera vez, `true` después.
 * Con movimiento reducido es `true` desde el principio: nada empieza oculto.
 */
export function useEnterOnView<T extends HTMLElement = HTMLElement>(amount = 0.6): { ref: RefObject<T>; shown: boolean } {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { amount, once: true });
  const reduced = useReducedMotion();
  return { ref, shown: reduced || seen };
}
