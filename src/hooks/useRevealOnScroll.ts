import { useLayoutEffect, type RefObject } from "react";

/** Marca de los elementos que aparecen al entrar en pantalla. */
export const REVEAL_ATTR = "data-reveal";
/** Atributo del contenedor: solo existe mientras la animación está armada. Sin él, nada se oculta. */
export const REVEAL_READY_ATTR = "data-reveal-ready";
/** Clase que dispara la animación de un elemento ya visible. */
export const REVEAL_IN_CLASS = "is-in";

/**
 * Aparición de secciones al hacer scroll. El CSS oculta `[data-reveal]` SOLO bajo `[data-reveal-ready]`, y este
 * hook es lo único que pone ese atributo: sin IntersectionObserver, sin JavaScript o con
 * `prefers-reduced-motion: reduce` el contenido queda visible y estático desde el primer pintado. Los elementos
 * que ya están en pantalla (o por encima) se marcan antes del primer pintado, así que no parpadean.
 * Solo anima opacity y transform (ver `.ms-home` en index.css).
 */
export function useRevealOnScroll(rootRef: RefObject<HTMLElement>): void {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window.matchMedia !== "function" || typeof IntersectionObserver === "undefined") return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;

    const disarm = () => {
      observer?.disconnect();
      observer = undefined;
      root.removeAttribute(REVEAL_READY_ATTR);
    };

    const arm = () => {
      if (reduce.matches) return;
      const io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add(REVEAL_IN_CLASS);
            io.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
      );
      observer = io;
      const limit = window.innerHeight * 0.92;
      for (const el of root.querySelectorAll<HTMLElement>(`[${REVEAL_ATTR}]`)) {
        if (el.getBoundingClientRect().top < limit) el.classList.add(REVEAL_IN_CLASS);
        else io.observe(el);
      }
      root.setAttribute(REVEAL_READY_ATTR, "");
    };

    const onChange = () => {
      disarm();
      arm();
    };

    arm();
    reduce.addEventListener("change", onChange);
    return () => {
      reduce.removeEventListener("change", onChange);
      disarm();
    };
  }, [rootRef]);
}
