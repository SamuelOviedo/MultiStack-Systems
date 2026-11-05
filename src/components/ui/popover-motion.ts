/**
 * Movimiento de los elementos flotantes anclados (select, menú desplegable).
 *
 * - Entrada con fundido y escala desde 0,95 (nunca desde 0), 150 ms; salida más
 *   rápida (100 ms). Curva `cubic-bezier(0.23, 1, 0.32, 1)` (ease-out fuerte).
 * - Solo `opacity` y `transform`. Sin deslizamiento: menos movimiento, más calma.
 * - El origen de la escala lo fija cada primitiva con la variable
 *   `--radix-*-content-transform-origin` (el menú crece desde su disparador).
 * - `prefers-reduced-motion`: se conserva el fundido y se anula la escala.
 */
export const POPOVER_MOTION = [
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
  "data-[state=open]:duration-150 data-[state=closed]:duration-100",
  "[animation-timing-function:cubic-bezier(0.23,1,0.32,1)]",
  "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
].join(" ");
