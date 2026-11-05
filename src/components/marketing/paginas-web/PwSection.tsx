import type { ReactNode } from "react";
import type { PaginasWebSectionHead } from "@/pages/marketing/paginasWebContent";
import { titleId } from "./ids";

interface PwSectionProps {
  /** Aporta el id (ancla estable) y el encabezado que da nombre a la región. */
  head: Pick<PaginasWebSectionHead, "id">;
  /** Fondo --surface-2 en lugar de --bg: las secciones contiguas se alternan. */
  alt?: boolean;
  /** Relleno vertical reducido, para las franjas cortas. */
  tight?: boolean;
  className?: string;
  children: ReactNode;
}

/** Región de la landing: <section> con nombre accesible y el contenedor de 1200 px. */
const PwSection = ({ head, alt, tight, className, children }: PwSectionProps) => {
  const classes = ["ms-pw-section", tight && "ms-pw-section--tight", alt && "ms-pw-section--alt", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section id={head.id} aria-labelledby={titleId(head.id)} className={classes}>
      <div className="ms-pw-wrap">{children}</div>
    </section>
  );
};

export default PwSection;
