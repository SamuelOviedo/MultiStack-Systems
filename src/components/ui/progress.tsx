import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

/**
 * Barra de progreso (`role="progressbar"`). Pasa siempre un nombre accesible
 * (`aria-label` o `aria-labelledby`). El valor se acota a 0-`max`. El relleno
 * se desplaza con `transform` (no anima el ancho) y no se mueve con movimiento
 * reducido. Sin `value` es indeterminado.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, max = 100, ...props }, ref) => {
  const clamped = typeof value === "number" ? Math.min(max, Math.max(0, value)) : value;
  const percent = typeof clamped === "number" ? (clamped / max) * 100 : 0;
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={clamped}
      max={max}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-muted-foreground/20", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 bg-primary transition-transform duration-200 ease-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - percent}%)` }}
      />
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
