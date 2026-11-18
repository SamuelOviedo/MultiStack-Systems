import { useLayoutEffect, type RefObject } from "react";

/** Atributo que gobierna la entrada de un elemento (ver `[data-site-reveal]` en components/site/site.css). */
export const SITE_REVEAL_ATTR = "data-site-reveal";

/**
 * Entrada de UN elemento al aparecer en pantalla, con su propio IntersectionObserver (una sola vez).
 *
 * - Antes del primer pintado, si el elemento está por debajo del pliegue, queda oculto (`hidden`) y al cruzarlo
 *   pasa a `in`, que dispara la animación CSS. Si ya está a la vista, pasa directo a `in` y no parpadea.
 * - Sin IntersectionObserver, sin `matchMedia` o con `prefers-reduced-motion: reduce` no pone ningún atributo: el
 *   elemento queda visible y quieto. Sin JavaScript tampoco se oculta nada: el CSS solo oculta `hidden`.
 * - El estado va en un atributo `data-*` y no en `className`: React puede reescribir `className` en un render y
 *   borraría una clase añadida a mano.
 * - Funciona con elementos que se montan tarde (datos, rutas diferidas): no depende de un contenedor armado.
 *
 * El retardo del escalonado se pone con la variable `--reveal-delay` en el propio elemento.
 */
export function useRevealInView(ref: RefObject<HTMLElement>, enabled = true): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    if (typeof window.matchMedia !== "function" || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
      el.setAttribute(SITE_REVEAL_ATTR, "in");
      return () => el.removeAttribute(SITE_REVEAL_ATTR);
    }

    el.setAttribute(SITE_REVEAL_ATTR, "hidden");
    // Umbral 0 con margen inferior del 8 %: un elemento más alto que cinco pantallas también acaba apareciendo.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        el.setAttribute(SITE_REVEAL_ATTR, "in");
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.removeAttribute(SITE_REVEAL_ATTR);
    };
  }, [ref, enabled]);
}
