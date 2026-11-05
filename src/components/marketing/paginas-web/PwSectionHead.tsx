import type { ReactNode } from "react";
import type { PaginasWebSectionHead } from "@/pages/marketing/paginasWebContent";
import { titleId } from "./ids";

/**
 * Rótulo «// …» en mono y color acento. El prefijo es decorativo (aria-hidden) y la minúscula la
 * aplica el CSS: el texto del DOM es exactamente el eyebrow del contenido.
 */
export const PwEyebrow = ({ children }: { children: string }) => (
  <p className="ms-pw-eyebrow">
    <span aria-hidden="true">{"// "}</span>
    {children}
  </p>
);

interface PwSectionHeadProps {
  head: PaginasWebSectionHead;
  /** Lo que va bajo el título (introducción, ubicación…). */
  children?: ReactNode;
}

/** Encabezado de sección: rótulo + h2. El h1 de la página lo pinta PwHero. */
const PwSectionHead = ({ head, children }: PwSectionHeadProps) => (
  <div>
    <PwEyebrow>{head.eyebrow}</PwEyebrow>
    <h2 id={titleId(head.id)} className="ms-pw-h2">
      {head.title}
    </h2>
    {children}
  </div>
);

export default PwSectionHead;
