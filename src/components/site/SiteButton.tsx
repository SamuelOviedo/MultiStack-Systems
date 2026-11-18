import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Slot, Slottable } from "@radix-ui/react-slot";
import { ArrowRight } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { cn } from "./cn";
import { siteButtonVariants } from "./siteButtonVariants";

export interface SiteButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof siteButtonVariants> {
  /** Aplica el estilo al hijo (un `SiteLink`, un `<a>`) en vez de renderizar un `<button>`. */
  asChild?: boolean;
}

export const SiteButton = forwardRef<HTMLButtonElement, SiteButtonProps>(function SiteButton(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      // Un <button> dentro de un formulario envía por omisión: aquí solo si se pide.
      type={asChild ? undefined : (type ?? "button")}
      className={cn(siteButtonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export interface HeroCtaProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Aplica el estilo al hijo (un `SiteLink`, un `<a>`). El contenido del hijo queda entre el brillo (detrás) y la flecha. */
  asChild?: boolean;
  /** Clase de la cápsula exterior (márgenes, ancho). */
  capsuleClassName?: string;
  /** Sin flecha. */
  hideArrow?: boolean;
  children: ReactNode;
}

/**
 * Botón doble del hero: una cápsula metálica con el botón de degradado dentro, la flecha que avanza al pasar el
 * puntero y un brillo de fondo. Ver la entrada del hero en site.css (`hero-in`) para animarlo con el resto.
 */
export const HeroCta = forwardRef<HTMLButtonElement, HeroCtaProps>(function HeroCta(
  { asChild = false, capsuleClassName, className, hideArrow = false, children, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot : "button";
  return (
    <div
      className={cn(
        "rounded-full bg-[linear-gradient(180deg,oklch(0.28_0.03_240),oklch(0.17_0.02_245))] p-[6px] shadow-[0_10px_24px_rgba(0,0,0,0.55),0_2px_6px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.12)] ring-1 ring-white/10",
        capsuleClassName,
      )}
    >
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(
          "group relative isolate flex h-12 cursor-pointer items-center gap-2 overflow-hidden rounded-full bg-brand px-7 text-[15px] font-medium text-site-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring active:scale-[0.97]",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,oklch(0.54_0.12_222),oklch(0.5_0.1_222)_50%,oklch(0.54_0.12_222))] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
        <Slottable>{children}</Slottable>
        {!hideArrow && (
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        )}
      </Comp>
    </div>
  );
});
