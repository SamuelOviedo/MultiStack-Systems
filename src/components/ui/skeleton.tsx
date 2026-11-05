import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Barra gris plana del tamaño final del contenido (sin brillo ni degradado).
 * El pulso solo anima `opacity` y se apaga con movimiento reducido.
 * Es decorativo: el contenedor que carga debe anunciar el estado
 * (`aria-busy` o un texto «Cargando…» solo para lectores).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted-foreground/15 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
