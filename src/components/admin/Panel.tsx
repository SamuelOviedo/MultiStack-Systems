import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type HeadingLevel = "h2" | "h3" | "h4";

export interface PanelProps {
  title: string;
  description?: string;
  /** Acciones del encabezado (botones, enlaces). */
  actions?: ReactNode;
  /** Pie opcional (paginación, totales). */
  footer?: ReactNode;
  /** Nivel del título según la jerarquía de la página. Por defecto `h2`. */
  headingLevel?: HeadingLevel;
  /** Mientras carga se muestran barras con el ritmo del contenido final. */
  loading?: boolean;
  /** Cantidad de barras en el estado de carga. */
  skeletonRows?: number;
  /** Mensaje de error ya en español (nunca el crudo de Supabase). */
  error?: string;
  /** Si se pasa con `error`, aparece «Reintentar». */
  onRetry?: () => void;
  /** Cuando es `true` se muestra `empty` en lugar de `children`. */
  isEmpty?: boolean;
  /** Normalmente un `<EmptyState />`. */
  empty?: ReactNode;
  /** Quita el relleno del cuerpo (para tablas a sangre). */
  flush?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Tarjeta con título para agrupar una sección. Es una región con nombre
 * (`aria-labelledby`). Estados: carga (`aria-busy` + barras planas), error
 * dentro del bloque con reintento, y vacío que conserva el marco y el título.
 */
export function Panel({
  title,
  description,
  actions,
  footer,
  headingLevel = "h2",
  loading = false,
  skeletonRows = 3,
  error,
  onRetry,
  isEmpty = false,
  empty,
  flush = false,
  className,
  children,
}: PanelProps) {
  const titleId = useId();

  let body: ReactNode;
  if (loading) {
    body = (
      <div className="space-y-3" data-testid="panel-loading">
        <span className="sr-only">Cargando…</span>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  } else if (error) {
    body = (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <p className="text-foreground">{error}</p>
        {onRetry && (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    );
  } else if (isEmpty && empty) {
    body = empty;
  } else {
    body = children;
  }

  return (
    <Card role="region" aria-labelledby={titleId} aria-busy={loading || undefined} className={className}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <CardTitle as={headingLevel} id={titleId}>
            {title}
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn(flush && "p-0")}>{body}</CardContent>
      {footer && <CardFooter className="border-t pt-4">{footer}</CardFooter>}
    </Card>
  );
}
