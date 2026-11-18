import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "./cn";
import { SiteFooter, type SiteFooterProps } from "./SiteFooter";
import { SiteHeader, type SiteHeaderProps } from "./SiteHeader";
import "./site.css";

export interface SiteLayoutProps {
  header: SiteHeaderProps;
  footer: SiteFooterProps;
  /** Texto del enlace «saltar al contenido» (el primero en recibir el foco con el teclado). */
  skipLabel?: string;
  /** Clase extra del contenedor `.ms-site`. */
  className?: string;
  children: ReactNode;
}

/**
 * Envoltorio del sitio público: abre el ámbito `.ms-site` (paleta, tipografía y utilidades de site.css, solo oscuro),
 * con la cabecera, el `<main>` y el pie. Ninguna regla de site.css actúa fuera de este elemento.
 *
 * La cabecera es `sticky`: ningún ancestro de este contenedor puede tener `overflow` distinto de `visible`.
 * El enlace de salto mueve el foco a `<main>` sin tocar la URL (ni la query de Ads ni el ancla).
 */
export function SiteLayout({ header, footer, skipLabel = "Saltar al contenido", className, children }: SiteLayoutProps) {
  const mainRef = useRef<HTMLElement>(null);

  const skip = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    mainRef.current?.focus({ preventScroll: true });
    mainRef.current?.scrollIntoView();
  };

  return (
    <div className={cn("ms-site flex min-h-screen w-full flex-col", className)}>
      <a
        href="#contenido-principal"
        onClick={skip}
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-site-primary-deep focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-site-primary-foreground"
      >
        {skipLabel}
      </a>
      <SiteHeader {...header} />
      <main ref={mainRef} id="contenido-principal" tabIndex={-1} className="flex-1 scroll-mt-16 focus:outline-none">
        {children}
      </main>
      <SiteFooter {...footer} />
    </div>
  );
}
