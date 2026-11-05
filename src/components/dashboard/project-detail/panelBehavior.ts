import { useCallback, useRef } from "react";

/**
 * Movimiento de los cajones del detalle de proyecto (etapa, servicio, mantenimiento): entran en 200 ms y salen en
 * 150 ms (la salida es más rápida porque el sistema responde) con la curva de los cajones; con «reducir movimiento»
 * no hay desplazamiento ni fundido. Es el mismo criterio del cajón de tickets.
 */
export const SHEET_MOTION =
  "data-[state=open]:duration-200 data-[state=closed]:duration-150 [animation-timing-function:cubic-bezier(0.32,0.72,0,1)] " +
  "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none";

export const OVERLAY_MOTION =
  "data-[state=open]:duration-200 data-[state=closed]:duration-150 " +
  "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none";

/** Clases comunes de un cajón de formulario: columna con cabecera, cuerpo que se desplaza y pie fijo. */
export const FORM_SHEET_CLASS = `flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg ${SHEET_MOTION}`;

/**
 * Un cajón controlado no tiene «disparador», así que Radix no sabe a dónde devolver el foco al cerrarlo. Se recuerda
 * el elemento que lo abrió (el botón o la fila) y se le devuelve el foco; si ya no existe, el foco queda en el
 * `fallback` (p. ej. el botón «Agregar» de la misma sección).
 */
export function useReturnFocus(fallback?: () => HTMLElement | null) {
  const opener = useRef<HTMLElement | null>(null);
  const onOpenAutoFocus = useCallback(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);
  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      const target = opener.current?.isConnected ? opener.current : fallback?.();
      target?.focus();
    },
    [fallback],
  );
  return { onOpenAutoFocus, onCloseAutoFocus };
}
