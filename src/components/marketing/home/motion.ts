import type { CSSProperties } from "react";
import { REVEAL_ATTR } from "@/hooks/useRevealOnScroll";

type Staggered = CSSProperties & { "--i": number };

/** Orden dentro de un grupo: el CSS lo multiplica por 70 ms (animation-delay). */
const order = (index: number): Staggered => ({ "--i": index });

/** Props de un elemento que aparece al entrar en pantalla (ver useRevealOnScroll). */
export const reveal = (index = 0): { [REVEAL_ATTR]: string; style: Staggered } => ({
  [REVEAL_ATTR]: "",
  style: order(index),
});

/** Entrada escalonada del hero con CSS puro: clase + orden. */
export const rise = (index: number): { className: string; style: Staggered } => ({
  className: "ms-home-rise",
  style: order(index),
});
