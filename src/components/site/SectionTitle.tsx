import type { ReactNode } from "react";
import { cn } from "./cn";

interface SectionTitleProps {
  /** Etiqueta mono sobre el título (`>_ planes`). */
  tag: string;
  title: ReactNode;
  text?: ReactNode;
  /** Nivel del encabezado: `h2` por omisión (la página ya tiene su `h1`). */
  as?: "h1" | "h2" | "h3";
  /** Id del encabezado, para `aria-labelledby` de la sección. */
  id?: string;
  className?: string;
}

/** Encabezado de sección centrado: etiqueta mono, título y texto de apoyo. */
export function SectionTitle({ tag, title, text, as: Heading = "h2", id, className }: SectionTitleProps) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      <p className="font-mono text-sm text-site-primary-text">
        <span aria-hidden="true">&gt;_ </span>
        {tag}
      </p>
      <Heading id={id} className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </Heading>
      {text && <p className="mt-4 text-site-muted-foreground">{text}</p>}
    </div>
  );
}
