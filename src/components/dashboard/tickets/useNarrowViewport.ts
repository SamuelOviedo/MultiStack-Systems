import { useSyncExternalStore } from "react";

/** Debajo de este ancho (px) la lista de tickets pasa de tabla a tarjetas apiladas (≤ 640 px). */
export const NARROW_MAX_WIDTH = 640;
const QUERY = `(max-width: ${NARROW_MAX_WIDTH}px)`;

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = (): boolean =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/**
 * ¿La pantalla es angosta? Se usa en lugar de ocultar con CSS para que solo exista UNA versión de la lista en el
 * DOM (sin filas duplicadas para los lectores de pantalla ni para las pruebas).
 */
export function useNarrowViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
