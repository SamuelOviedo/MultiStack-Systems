import { useId, type ReactNode } from "react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Peso del indicador dentro de un grupo. `lead` es el dato que pide una acción (cifra grande, etiqueta en tinta
 * principal, borde con el acento); `context` es el resto (cifra media, etiqueta atenuada). Es solo jerarquía visual:
 * el rol, el nombre accesible y el orden del DOM son los mismos.
 */
export type KpiEmphasis = "lead" | "context";

export interface KpiTileProps {
  /** Qué mide, en minúscula inicial de frase («Proyectos activos»). */
  label: string;
  /** Cifra. Un cero real se muestra como `0`; `null`/`undefined` = sin dato. */
  value?: number | string | null;
  /** Unidad pequeña junto a la cifra («días», «%»). */
  unit?: string;
  /** Contexto de la cifra, con su ventana en palabras («vs. 30 días anteriores»). */
  hint?: ReactNode;
  /** Carga: conserva la etiqueta y reserva el tamaño de la cifra. */
  loading?: boolean;
  /**
   * La cifra no corresponde mostrarla a este rol. Lo decide el padre según
   * `userType`; esto es solo presentación: la barrera real es RLS.
   */
  restricted?: boolean;
  /** Jerarquía visual; por defecto `context`. */
  emphasis?: KpiEmphasis;
  className?: string;
}

function formatValue(value: number | string): string {
  return typeof value === "number" ? value.toLocaleString("es-HN") : value;
}

/**
 * Cada variante reserva el alto exacto de su cifra (`leading-none`): cargando, sin dato y con dato miden lo mismo
 * y la fila no salta. En `context` la etiqueta reserva dos líneas para que las cifras de una fila queden a la
 * misma altura aunque una etiqueta pase a una segunda línea en un ancho estrecho.
 */
const STYLES: Record<
  KpiEmphasis,
  { tile: string; label: string; figure: string; skeleton: string; unit: string; hint: string }
> = {
  lead: {
    tile: "gap-3 border-primary/40 p-5",
    label: "font-medium text-foreground",
    figure: "min-h-9 text-4xl",
    skeleton: "h-9 w-24",
    unit: "text-base",
    hint: "text-sm",
  },
  context: {
    tile: "gap-2 p-4",
    label: "min-h-10 text-muted-foreground",
    figure: "min-h-5 text-xl",
    skeleton: "h-5 w-16",
    unit: "text-sm",
    hint: "text-xs",
  },
};

/**
 * Indicador numérico. Sin icono ni degradado: etiqueta arriba, cifra tabular
 * debajo. Un grupo con nombre accesible («etiqueta») que lee etiqueta y cifra.
 */
export function KpiTile({
  label,
  value,
  unit,
  hint,
  loading = false,
  restricted = false,
  emphasis = "context",
  className,
}: KpiTileProps) {
  const labelId = useId();
  const hasValue = value !== null && value !== undefined;
  const s = STYLES[emphasis];

  let figure: ReactNode;
  if (loading) {
    figure = (
      <>
        <span className="sr-only">Cargando…</span>
        <Skeleton className={s.skeleton} />
      </>
    );
  } else if (restricted) {
    figure = (
      <p className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", s.figure)}>
        <Lock aria-hidden="true" className="h-3.5 w-3.5" />
        Restringido
      </p>
    );
  } else if (!hasValue) {
    figure = (
      <p className={cn("leading-none text-muted-foreground", s.figure)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sin datos</span>
      </p>
    );
  } else {
    figure = (
      <p className={cn("tabular font-semibold leading-none tracking-tight text-foreground", s.figure)}>
        {formatValue(value)}
        {unit && <span className={cn("ml-1 font-normal text-muted-foreground", s.unit)}>{unit}</span>}
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-busy={loading || undefined}
      data-emphasis={emphasis}
      className={cn("flex flex-col rounded-lg border bg-card shadow-card", s.tile, className)}
    >
      <p id={labelId} className={cn("text-sm", s.label)}>
        {label}
      </p>
      {figure}
      {hint && !loading && !restricted && <p className={cn("text-muted-foreground", s.hint)}>{hint}</p>}
    </div>
  );
}
