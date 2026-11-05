/** Datos de SEO por ruta. La home no está en ROUTE_META: sus metas viven en index.html y HOME_META es su espejo. */

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
  readonly default: OgImage;
  readonly paginasWeb: OgImage;
}

export const OG_IMAGES: OgImages = {
  default: {
    path: "/assets/images/og/og-ai.1200x630.png",
    alt: "MultiStack Systems — Tu operación, en piloto automático. Servicios productizados de IA y automatización.",
  },
  paginasWeb: {
    path: "/assets/images/og/og-paginas-web.png",
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
export type RouteMetaPath = "/paginas-web";

const PAGINAS_WEB_URL = `${SITE_ORIGIN}/paginas-web`;

export const ROUTE_META: Readonly<Record<RouteMetaPath, RouteMeta>> = {
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
  title: "MultiStack Systems | Servicios de IA y Automatización B2B",
  description:
    "Servicios productizados de IA para empresas: agentes de atención 24/7 con RAG, automatización cero papel con n8n e integración con tus sistemas. Desde Honduras.",
  canonical: SITE_ORIGIN,
  ogTitle: "Servicios Productizados de IA y Automatización B2B | MultiStack Systems",
  ogDescription:
    "Agentes de IA que atienden 24/7 con la información de tu negocio y automatizaciones cero papel con n8n. Implementados en semanas, no en meses.",
  ogUrl: SITE_ORIGIN,
  ogImage: `${SITE_ORIGIN}${OG_IMAGES.default.path}`,
  ogImageAlt: OG_IMAGES.default.alt,
};
