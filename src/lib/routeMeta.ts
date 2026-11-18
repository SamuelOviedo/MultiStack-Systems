/** Datos de SEO por ruta. La home no está en ROUTE_META: sus metas viven en index.html y HOME_META es su espejo. */

// Import relativo y sin alias a propósito: el plugin de build (build/routeHeadPlugin.ts) carga este archivo desde
// Node, donde «@/» no se resuelve, y webPackages.ts es una hoja sin dependencias.
import { lempiras, SITE_PLANS, type PaginasWebPackage } from "./webPackages";

/**
 * Origen de las URLs absolutas de estas rutas (canonical, og:url, og:image): el host principal, con www
 * (el dominio sin www redirige a él). index.html, sitemap.xml, robots.txt y las páginas legales usan el mismo.
 */
export const SITE_ORIGIN = "https://www.multistacksystems.com";

export interface OgImage {
  /** Ruta dentro de public/, con barra inicial. */
  readonly path: string;
  readonly alt: string;
}

export interface OgImages {
  /** Imagen de la home. */
  readonly default: OgImage;
  readonly paginasWeb: OgImage;
}

export const OG_IMAGES: OgImages = {
  default: {
    path: "/assets/images/og/og-home.v3.1200x630.png",
    alt: "MultiStack Systems: páginas web para negocios en Honduras.",
  },
  paginasWeb: {
    path: "/assets/images/og/og-paginas-web.v2.png",
    alt: "MultiStack Systems — Páginas web para negocios de Honduras. Diseño a medida, código propio y precio claro antes de empezar.",
  },
};

/** Imagen de /paginas-web (og:image y twitter:image): PNG propio de 1200×630, no la de la home. */
export const PAGINAS_WEB_OG: OgImage = OG_IMAGES.paginasWeb;

export interface RouteMeta {
  readonly title: string;
  readonly description: string;
  readonly canonical: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
  /** Igual que canonical. */
  readonly ogUrl: string;
  /** URL absoluta. */
  readonly ogImage: string;
  readonly ogImageAlt: string;
}

/** Rutas con metas propias. Suma aquí cada ruta nueva. */
export type RouteMetaPath = "/paginas-web" | "/planes" | "/servicios" | "/contacto";

/** Los textos de SEO de las cuatro vistas del sitio público (home, planes, servicios y contacto). */
export interface ViewMetaCopy {
  /** Hasta 60 caracteres. */
  readonly title: string;
  /** Hasta 155 caracteres. */
  readonly description: string;
  readonly ogTitle: string;
  readonly ogDescription: string;
}

export type SiteView = "home" | "planes" | "servicios" | "contacto";

/** Los datos que entran en los textos de los metas. Todos tienen su fuente en otro módulo; ver ROUTE_META_FACTS. */
export interface ViewMetaFacts {
  /** Planes del sitio en su orden de pantalla: el precio «desde» es el más bajo. */
  readonly plans: readonly Pick<PaginasWebPackage, "name" | "priceLempiras">[];
  /** Nombre del producto de soporte (PRODUCTS en src/lib/products.ts). */
  readonly techonName: string;
  /** Teléfono visible (CHANNELS.phoneDisplay). */
  readonly phoneDisplay: string;
  /** Horas hábiles de respuesta al formulario (COMMITMENTS.responseBusinessHours). */
  readonly responseBusinessHours: number;
}

/** «A, B y C»; con dos, «A y B»; con uno, «A». */
const joinWithY = (items: readonly string[]): string =>
  items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} y ${items[items.length - 1] ?? ""}`;

/**
 * Textos de los metas de las cuatro vistas, copiados de los `head()` del diseño de referencia. Los precios, el
 * teléfono y las horas llegan por parámetro: ningún número se escribe aquí. Es una función para que
 * `src/pages/marketing/siteContent.ts` la llame con los valores reales y una prueba pueda compararlos con los de
 * ROUTE_META_FACTS.
 */
export function buildViewMetas(facts: ViewMetaFacts): Readonly<Record<SiteView, ViewMetaCopy>> {
  const lowest = lempiras(Math.min(...facts.plans.map((plan) => plan.priceLempiras)));
  const planPrices = joinWithY(facts.plans.map((plan) => `${plan.name} ${lempiras(plan.priceLempiras)}`));
  const hours = `${facts.responseBusinessHours} ${facts.responseBusinessHours === 1 ? "hora hábil" : "horas hábiles"}`;

  return {
    home: {
      title: "MultiStack Systems | Páginas web para negocios en Honduras",
      description: `Páginas web con código propio en React, soporte técnico, IA y herramientas a medida. Desde ${lowest}, hecho en Siguatepeque.`,
      ogTitle: "MultiStack Systems | Páginas web para negocios en Honduras",
      ogDescription: `Páginas web con código propio, IA y soporte técnico para negocios hondureños. Desde ${lowest}.`,
    },
    planes: {
      title: "Planes de páginas web en Honduras | MultiStack Systems",
      description: `${planPrices}. Compara qué incluye cada uno.`,
      ogTitle: "Planes de páginas web | MultiStack Systems",
      ogDescription: `Compara los planes de páginas web de MultiStack Systems, desde ${lowest}.`,
    },
    servicios: {
      title: "Servicios: web, soporte técnico e IA | MultiStack Systems",
      description: `Páginas web, soporte técnico ${facts.techonName}, productos con inteligencia artificial y herramientas a medida para negocios en Honduras.`,
      ogTitle: "Servicios tecnológicos | MultiStack Systems",
      ogDescription: "Web, soporte técnico, IA y herramientas a medida con código propio.",
    },
    contacto: {
      title: "Contacto | MultiStack Systems",
      description: `Cotiza gratis tu página web. Escríbenos por WhatsApp o llama al ${facts.phoneDisplay}. Siguatepeque, Honduras.`,
      ogTitle: "Contacto | MultiStack Systems",
      ogDescription: `Cotiza gratis y sin compromiso. Respondemos en menos de ${hours}.`,
    },
  };
}

/**
 * Los datos de los metas. Planes: SITE_PLANS (el import es relativo y sin dependencias). El resto no se puede
 * importar sin arrastrar al plugin de build y al chunk de entrada el contenido de las páginas, así que son espejo
 * de su fuente y una prueba debe compararlos:
 * - techonName con getProduct("techon").name (src/lib/products.ts);
 * - phoneDisplay con CHANNELS.phoneDisplay y responseBusinessHours con COMMITMENTS.responseBusinessHours
 *   (src/pages/marketing/paginasWebContent.ts).
 */
export const ROUTE_META_FACTS: ViewMetaFacts = {
  plans: SITE_PLANS,
  techonName: "TechOn",
  phoneDisplay: "+504 3302-3042",
  responseBusinessHours: 24,
};

const VIEW_METAS = buildViewMetas(ROUTE_META_FACTS);

const PAGINAS_WEB_URL = `${SITE_ORIGIN}/paginas-web`;

/** Meta de una vista del sitio con la imagen social de la home (todavía no tienen una propia). */
function siteViewMeta(path: "/planes" | "/servicios" | "/contacto", copy: ViewMetaCopy): RouteMeta {
  const url = `${SITE_ORIGIN}${path}`;
  return {
    title: copy.title,
    description: copy.description,
    canonical: url,
    ogTitle: copy.ogTitle,
    ogDescription: copy.ogDescription,
    ogUrl: url,
    ogImage: `${SITE_ORIGIN}${OG_IMAGES.default.path}`,
    ogImageAlt: OG_IMAGES.default.alt,
  };
}

export const ROUTE_META: Readonly<Record<RouteMetaPath, RouteMeta>> = {
  "/planes": siteViewMeta("/planes", VIEW_METAS.planes),
  "/servicios": siteViewMeta("/servicios", VIEW_METAS.servicios),
  "/contacto": siteViewMeta("/contacto", VIEW_METAS.contacto),
  "/paginas-web": {
    title: "Páginas web en Honduras | MultiStack Systems",
    description:
      "Páginas web en Honduras: diseño y desarrollo de landing pages a medida con código propio en React y precio claro. Cotiza gratis y sin compromiso.",
    canonical: PAGINAS_WEB_URL,
    ogTitle: "Páginas web en Honduras: diseño a medida y precio claro",
    ogDescription:
      "Landing pages a medida con código propio en React, hechas en Honduras. Precio claro desde el inicio y cotización gratis y sin compromiso.",
    ogUrl: PAGINAS_WEB_URL,
    ogImage: `${SITE_ORIGIN}${PAGINAS_WEB_OG.path}`,
    ogImageAlt: PAGINAS_WEB_OG.alt,
  },
};

/**
 * Metas de la home, tal como están en index.html: el destino al que una ruta de ROUTE_META devuelve el
 * head al salir por el SPA (ver `restoreTo` en pageMeta.ts). Debe coincidir con index.html; un test lo
 * compara. El canonical y el og:url de la home no llevan «/» final.
 *
 * No está en ROUTE_META ni en RouteMetaPath a propósito: el plugin de build (build/routeHeadPlugin.ts)
 * emite un `<ruta>/index.html` por cada entrada de ROUTE_META, y para la home duplicaría index.html.
 */
export const HOME_META: RouteMeta = {
  title: VIEW_METAS.home.title,
  description: VIEW_METAS.home.description,
  canonical: SITE_ORIGIN,
  ogTitle: VIEW_METAS.home.ogTitle,
  ogDescription: VIEW_METAS.home.ogDescription,
  ogUrl: SITE_ORIGIN,
  ogImage: `${SITE_ORIGIN}${OG_IMAGES.default.path}`,
  ogImageAlt: OG_IMAGES.default.alt,
};
