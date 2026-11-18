/**
 * Navegación y texto del pie de las páginas antiguas (`/paginas-web`, las legales y el portal), que antes salían del
 * contenido de la home anterior. Los textos y las anclas son los mismos de entonces: las anclas que hoy son otra vista
 * (`#combo-emprendedor`, `#planes`, `#contacto`) las redirige LegacyHomeGate (lib/legacyHomeHash.ts) y las demás
 * (`#proceso`, `#preguntas`) existen en `/paginas-web`. Este archivo no es contenido del sitio nuevo
 * (pages/marketing/siteContent.ts).
 */

import { packageRequestPath } from "@/lib/packageIntent";
import { PACKAGES, type PaginasWebPackage } from "@/lib/webPackages";
import { CHANNELS, type PaginasWebLink } from "@/pages/marketing/paginasWebContent";

export interface HomeNavItem {
  readonly label: string;
  /** Ancla dentro de la home: `#combo-emprendedor`. */
  readonly href: string;
}

export interface HomeNav {
  readonly items: readonly HomeNavItem[];
  /** CTA de la barra. Su `ariaLabel` empieza con el texto visible (WCAG 2.5.3). */
  readonly cta: PaginasWebLink;
  /** Paquete que pide el CTA: la barra guarda esta intención antes de navegar. */
  readonly packageId: PaginasWebPackage["id"];
}

const COMBO_ID = "combo-emprendedor";
const combo = PACKAGES.find((pkg) => pkg.id === COMBO_ID);
if (!combo) throw new Error(`Falta el paquete «${COMBO_ID}» en PACKAGES.`);

/** Enlaces de sección del pie (y de la barra, si una página le pasa `homeNav`) con su CTA. */
export const LEGACY_HOME_NAV: HomeNav = {
  items: [
    { label: "Combo", href: "#combo-emprendedor" },
    { label: "Planes", href: "#planes" },
    { label: "Proceso", href: "#proceso" },
    { label: "Preguntas", href: "#preguntas" },
    { label: "Contacto", href: "#contacto" },
  ],
  cta: { label: "Solicitar Combo", href: packageRequestPath(combo.id), ariaLabel: `Solicitar ${combo.name}` },
  packageId: combo.id,
};

/** Descripción y ubicación de la columna de marca del pie. */
export const LEGACY_FOOTER = {
  description: "Páginas web a medida para negocios en Honduras, con código propio en React.",
  location: CHANNELS.location,
} as const;
