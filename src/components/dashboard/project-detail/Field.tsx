import { useId, type ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FieldProps {
  label: ReactNode;
  /** Ayuda corta bajo el campo; queda enlazada con `aria-describedby`. */
  hint?: ReactNode;
  /** Mensaje de error ya en español; queda enlazado con `aria-describedby` y se anuncia. */
  error?: ReactNode;
  className?: string;
  /** Recibe el `id` del control y los `aria-*` que lo enlazan con su ayuda y su error. */
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

/**
 * Campo de formulario para los cajones del detalle: etiqueta visible enlazada por `htmlFor`/`id`, ayuda y error
 * enlazados por `aria-describedby`. (Los diálogos usan `ui/form`; estos cajones guardan un estado propio que no
 * encaja con react-hook-form.)
 */
export default function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-describedby": described, ...(error ? { "aria-invalid": true as const } : {}) })}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
