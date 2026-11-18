import { useEffect, useState, type RefObject } from "react";

interface UseInViewOptions {
  /** Fracción del elemento que debe verse (0 a 1) para contar como «a la vista». */
  amount?: number;
  /** Una vez visto, queda en `true` y se deja de observar. */
  once?: boolean;
}

/**
 * ¿Está el elemento a la vista? Un IntersectionObserver por elemento; se desconecta al desmontar.
 *
 * Empieza en `false` (hasta el primer aviso del observador no se sabe). Sin IntersectionObserver devuelve `true`:
 * lo que dependa de esto (bucles, entradas) no se queda a medias en un entorno que no puede observar.
 * Para el estado de reposo con movimiento reducido, combínalo con `useReducedMotion`.
 */
export function useInView(ref: RefObject<Element>, { amount = 0, once = false }: UseInViewOptions = {}): boolean {
  const supported = typeof IntersectionObserver !== "undefined";
  const [inView, setInView] = useState(!supported);

  useEffect(() => {
    const el = ref.current;
    if (!supported || !el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // El último aviso manda: el observador entrega los cambios en orden.
        const entry = entries[entries.length - 1];
        if (!entry) return;
        setInView(entry.isIntersecting);
        if (once && entry.isIntersecting) observer.disconnect();
      },
      { threshold: amount },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, amount, once, supported]);

  return inView;
}
