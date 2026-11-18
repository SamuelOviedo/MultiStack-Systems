import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { rememberPackageIntent, type PackageIntentId } from "@/lib/packageIntent";
import { isInternalTarget, isSafeExternalTarget, withPreservedSearch } from "./siteLinks";

export interface SiteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Ruta de la app (`/planes`, `/#contacto`, `#contacto`) o URL externa (https:, mailto:, tel:). */
  to: string;
  /**
   * CTA de un paquete: guarda la intención (24 h) antes de navegar, con clic y con clic medio, como `PwRequestLink`.
   * El destino sigue llevando su `?paquete=<id>`.
   */
  packageId?: PackageIntentId;
}

/**
 * Enlace del sitio público. Interno: un `<Link>` de react-router (navega sin recargar) con la query de atribución de
 * Ads aplicada (ver siteLinks.ts). Externo (https:, mailto: o tel:): un `<a>` normal; con `target="_blank"` añade
 * `rel="noopener noreferrer"`. Cualquier otro destino se pinta como texto, sin enlace.
 * Úsalo en el encabezado, el pie y todo CTA entre vistas del sitio.
 */
export const SiteLink = forwardRef<HTMLAnchorElement, SiteLinkProps>(function SiteLink(
  { to, packageId, onClick, onAuxClick, rel, target, ...rest },
  ref,
) {
  const { pathname, search } = useLocation();

  const remember = () => {
    if (packageId) rememberPackageIntent(packageId);
  };

  if (!isInternalTarget(to)) {
    // Ni ruta de la app ni https:, mailto: o tel:: se pinta solo el texto, sin enlace (`javascript:`, `data:` y `http:`
    // no llegan a un `href`). Hoy todos los destinos son constantes; es defensa en profundidad.
    if (!isSafeExternalTarget(to)) {
      if (import.meta.env.DEV) console.warn(`SiteLink: destino no permitido, se pinta como texto: ${to}`);
      return <>{rest.children}</>;
    }
    return (
      <a
        ref={ref}
        href={to}
        target={target}
        rel={target === "_blank" ? [rel, "noopener", "noreferrer"].filter(Boolean).join(" ") : rel}
        onClick={onClick}
        onAuxClick={onAuxClick}
        {...rest}
      />
    );
  }

  return (
    <Link
      ref={ref}
      to={withPreservedSearch(to, search, pathname)}
      target={target}
      rel={rel}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        remember();
        onClick?.(e);
      }}
      onAuxClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.button === 1) remember();
        onAuxClick?.(e);
      }}
      {...rest}
    />
  );
});
