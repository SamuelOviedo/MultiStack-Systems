import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Título nominal de la pantalla (un `h1` por página). */
  title: string;
  /** Una frase que explique para qué sirve la pantalla. */
  description?: string;
  /** Acciones de la pantalla (botones). Se alinean a la derecha y pasan debajo en móvil. */
  actions?: ReactNode;
  /** Migas de pan u otra navegación contextual, encima del título. */
  breadcrumb?: ReactNode;
  /** Datos de estado junto al título (una insignia, la fecha de alta), debajo del título. */
  meta?: ReactNode;
  className?: string;
}

/** Cabecera de página: título, descripción opcional y acciones. */
export function PageHeader({ title, description, actions, breadcrumb, meta, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3 pb-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {breadcrumb}
        <h1 className="break-words text-2xl font-semibold leading-tight tracking-tight">{title}</h1>
        {meta && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5 text-sm text-muted-foreground">{meta}</div>}
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
