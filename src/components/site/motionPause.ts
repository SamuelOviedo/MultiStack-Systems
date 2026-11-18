import { useCallback, useSyncExternalStore } from "react";

/**
 * Pausa de las animaciones en bucle del sitio (WCAG 2.2.2, nivel A: el movimiento que arranca solo y dura más de 5 s
 * necesita una forma de pausarlo). Un solo interruptor para todo lo que se repite: las píldoras del hero, el shader de
 * ondas, la terminal y el chat del bento y los `@keyframes` infinitos de site.css (estos por el atributo
 * `data-motion="paused"` que SiteLayout pone en `.ms-site`).
 *
 * La elección se recuerda en `localStorage`. Si el navegador no deja leerlo o escribirlo (modo privado, cookies
 * bloqueadas), la elección vale mientras dure la página.
 */

export const MOTION_STORAGE_KEY = "ms-site-motion";
const PAUSED = "paused";
const RUNNING = "running";

/** Valor de reserva cuando `localStorage` no está disponible. */
let fallback = false;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    // Con almacenamiento que funciona manda lo guardado; sin valor guardado, en marcha.
    return window.localStorage.getItem(MOTION_STORAGE_KEY) === PAUSED;
  } catch {
    return fallback;
  }
}

function write(paused: boolean): void {
  fallback = paused;
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, paused ? PAUSED : RUNNING);
  } catch {
    // Sin almacenamiento: queda `fallback`.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  // Otra pestaña del sitio cambia la elección: esta la sigue.
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === MOTION_STORAGE_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * `[pausado, fijar]`: `pausado` es `true` mientras la persona haya pedido pausar las animaciones. No tiene en cuenta
 * `prefers-reduced-motion` (eso lo resuelve `useReducedMotion` en cada animación).
 */
export function useMotionPaused(): readonly [boolean, (paused: boolean) => void] {
  const paused = useSyncExternalStore(subscribe, read, () => false);
  const set = useCallback((next: boolean) => write(next), []);
  return [paused, set] as const;
}
