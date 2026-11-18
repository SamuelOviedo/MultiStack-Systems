import { LEGACY_HOME_PATHS, legacyHomeDestinationPath } from "@/lib/legacyHomeHash";

/** Los cargadores de los chunks de las vistas del sitio que se precargan; los entrega App (`() => import(...)`). */
export type SiteViewLoaders = {
  planes: () => Promise<unknown>;
  servicios: () => Promise<unknown>;
  contacto: () => Promise<unknown>;
};

/** La ruta sin la barra final (`/planes/` pasa a `/planes`); `/` se queda como está. */
function withoutTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

/**
 * Visita directa a una vista del sitio público: pide su chunk ya, en paralelo con el arranque, para que el BrandLoader
 * dure lo menos posible. Una ancla antigua de la home que hoy es otra vista (`/#planes`) pide el chunk de esa vista.
 * Cualquier otra ruta (la home, `/planes/x`, `/login`) no precarga nada; la home va en el chunk de entrada.
 *
 * Cada caso llama a su cargador de forma explícita: el valor que viene de la URL solo se compara, nunca elige la función
 * que se ejecuta (nada de `Map.get(ruta)()` ni de objeto indexado por la ruta).
 *
 * Los errores se tragan: si el chunk falla, el `lazy` de la ruta lo reintenta y lo muestra.
 */
export function preloadSiteView(
  location: { pathname: string; hash: string },
  loaders: SiteViewLoaders,
): void {
  const path = withoutTrailingSlash(legacyHomeDestinationPath(location) ?? location.pathname);
  let pending: Promise<unknown> | undefined;
  switch (path) {
    case LEGACY_HOME_PATHS.planes:
      pending = loaders.planes();
      break;
    case LEGACY_HOME_PATHS.servicios:
      pending = loaders.servicios();
      break;
    case LEGACY_HOME_PATHS.contacto:
      pending = loaders.contacto();
      break;
    default:
      return;
  }
  pending.catch(() => undefined);
}
