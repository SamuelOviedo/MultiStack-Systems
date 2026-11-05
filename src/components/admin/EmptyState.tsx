import type { ComponentType, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

type HeadingLevel = "h2" | "h3" | "h4";

export interface EmptyStateProps {
  /** Qué falta, en una frase corta (p. ej. «Aún no hay tickets»). */
  title: string;
  /** Qué hacer a continuación, en lenguaje llano. */
  description?: string;
  /** Icono de lucide-react u otro componente SVG; es decorativo. */
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  /** Acción principal (un botón o enlace). */
  action?: ReactNode;
  /** Nivel del título según el lugar en la página. Por defecto `h3`. */
  headingLevel?: HeadingLevel;
  className?: string;
}

/**
 * Estado vacío: conserva el marco de la sección (borde discontinuo), dice qué
 * falta y ofrece la siguiente acción. Es contenido estático, no una alerta:
 * no se anuncia a los lectores de pantalla salvo que la persona navegue a él.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  headingLevel: Heading = "h3",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-10 text-center",
        className,
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground" />}
      <div className="max-w-sm space-y-1">
        <Heading className="text-sm font-semibold leading-snug tracking-normal">{title}</Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
