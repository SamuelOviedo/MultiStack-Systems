import Logo from "@/components/common/Logo";
import { DevCredit } from "../../../snippets/credito-multistack/DevCredit";
import { SiteLink } from "./SiteLink";

export interface SiteFooterLink {
  label: string;
  /** Ruta de la app (`/planes`, `/politica-de-privacidad`) o URL externa (`https://wa.me/…`, `tel:…`). */
  to: string;
  /** Abrir en otra pestaña (WhatsApp, mapas). */
  newTab?: boolean;
  /** Nombre accesible cuando el texto visible no basta (avisa que abre otra pestaña). Empieza con el texto visible. */
  ariaLabel?: string;
}

export interface SiteFooterColumn {
  /** Rótulo mono de la columna (`// sitio`). */
  title: string;
  links?: readonly SiteFooterLink[];
  /** Líneas de texto sin enlace (p. ej. la ubicación). */
  lines?: readonly string[];
}

export interface SiteFooterProps {
  tagline: string;
  columns: readonly SiteFooterColumn[];
  /** Línea final, completa (`© 2026 MultiStack Systems. …`). */
  copyright: string;
  /** Nombre accesible del logotipo. */
  logoLabel?: string;
}

const LINK = "rounded-sm transition-colors duration-200 hover:text-site-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring";

/**
 * Pie del sitio público (port del `Footer` de la referencia): logotipo oficial, texto de marca y columnas de
 * enlaces. Todos los textos y enlaces llegan por props (los trae siteContent.ts); el pie del sitio enlaza a
 * `/politica-de-privacidad` y `/terminos-del-servicio` desde esas columnas. Los enlaces internos conservan la
 * query de atribución de Ads (SiteLink). La barra inferior lleva el copyright y el crédito «Desarrollado por MultiStack
 * Systems» (DevCredit en modo sitio propio, estándar docs/standards/CREDITO-MULTISTACK.md); su ubicación está en site.css.
 */
export function SiteFooter({ tagline, columns, copyright, logoLabel = "MultiStack Systems" }: SiteFooterProps) {
  return (
    <footer className="border-t border-site-border bg-site-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          {/* Logotipo completo oficial (isotipo sobre el rótulo), versión para fondo oscuro. Altura suficiente para
              que «SYSTEMS» siga legible; el ancho sigue la proporción del archivo. El `flex` del contenedor quita la línea de
              texto que un `<span>` en línea deja bajo la imagen (unos 7 px de más). */}
          <div className="flex">
            <Logo variant="full" tone="light" alt={logoLabel} className="h-24" />
          </div>
          <p className="mt-4 max-w-sm text-sm text-site-muted-foreground">{tagline}</p>
        </div>
        {columns.map((column) => (
          <div key={column.title} className="text-sm">
            <p className="font-mono text-xs text-site-primary-text">{column.title}</p>
            <ul className="mt-3 space-y-2 text-site-muted-foreground">
              {column.links?.map((link) => (
                <li key={`${link.to}|${link.label}`}>
                  <SiteLink
                    to={link.to}
                    target={link.newTab ? "_blank" : undefined}
                    aria-label={link.ariaLabel}
                    className={LINK}
                  >
                    {link.label}
                  </SiteLink>
                </li>
              ))}
              {column.lines?.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
        ))}
      </div>
      {/* Barra inferior. `.site-foot-bar` (site.css) es el contenedor de la container query en `em` que decide si el crédito
          va al lado del copyright o debajo; el copyright conserva su caja y su centrado en los dos casos. */}
      <div className="site-foot-bar border-t border-site-border py-5 text-center text-xs text-site-muted-foreground">
        <div className="site-foot-line">
          <p className="site-foot-copy">{copyright}</p>
          <span className="site-foot-sep" aria-hidden="true" />
          {/* Sitio propio (estándar del crédito, sección 15): enlace a la home, misma pestaña, sin UTM ni rel. */}
          <DevCredit ownSite className="site-foot-credit" />
        </div>
      </div>
    </footer>
  );
}
