import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { campaignSearch } from "@/lib/campaignParams";

/**
 * Rutas de las vistas que antes eran secciones de la home. Son las mismas de `SITE_PATHS` (siteContent.ts); se escriben
 * aquí para que este módulo, que usan el arranque de App y AdsTagRouteSync, no dependa del contenido del sitio. Una
 * prueba (legacy-home-hash.test.tsx) compara ambas.
 */
export const LEGACY_HOME_PATHS = { planes: "/planes", servicios: "/servicios", contacto: "/contacto" } as const;

/**
 * Anclas que tenía la home anterior y que hoy son vistas propias. Las usan el pie y la barra de las páginas antiguas
 * (`/paginas-web`, las legales), anuncios y enlaces externos. Las demás anclas de la home anterior no redirigen:
 * `inicio`, `por-que-elegirnos` y `proceso` tienen su sección en la home nueva (ver `LEGACY_HOME_SCROLL_ANCHORS`) y
 * `preguntas` y `solicitar` ya no tienen equivalente, así que la URL se queda en `/` arriba del todo.
 */
const LEGACY_HOME_ANCHORS: ReadonlyMap<string, string> = new Map([
  ["planes", LEGACY_HOME_PATHS.planes],
  ["combo-emprendedor", LEGACY_HOME_PATHS.planes],
  ["contacto", LEGACY_HOME_PATHS.contacto],
  ["servicios", LEGACY_HOME_PATHS.servicios],
]);

/**
 * Anclas de la home anterior que siguen existiendo como `id` en la home nueva: el hero (`Hero`), «Por qué hacer tu
 * página con nosotros» y la cuadrícula de pasos (`WhyAndProcess`). Un enlace antiguo a ellas se queda en `/` y
 * baja hasta la sección.
 */
export const LEGACY_HOME_SCROLL_ANCHORS: ReadonlySet<string> = new Set(["inicio", "por-que-elegirnos", "proceso"]);

type HomeLocation = { pathname: string; search: string; hash: string };

/** El ancla de la URL sin `#` y decodificada; una con % mal formado se devuelve tal cual (no coincidirá con ninguna). */
function anchorOf(hash: string): string {
  const raw = hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * Destino al que lleva una ancla antigua de la home, o `null` si la URL no es una de ellas. De la query solo conserva
 * los parámetros de campaña (click-ids de Google y `utm_*`, copiados tal cual), la misma regla que los enlaces entre
 * rutas del sitio (`campaignSearch`): `redirect`, `code`, `error`, `token` y demás parámetros funcionales no pasan a la
 * vista nueva. Descarta el hash, que en la vista nueva ya no apunta a nada. Solo mira la home: `/planes#x` no se toca.
 */
export function legacyHomeDestination(location: HomeLocation): string | null {
  const path = legacyHomeDestinationPath(location);
  return path ? `${path}${campaignSearch(location.search)}` : null;
}

/**
 * Solo la ruta (`/planes`, `/contacto`, `/servicios`) a la que lleva una ancla antigua de la home, sin query, o `null`.
 * No lee `search`: quien solo necesita saber qué vista es (la precarga de su chunk) no arrastra la query de la URL.
 */
export function legacyHomeDestinationPath(location: Pick<HomeLocation, "pathname" | "hash">): string | null {
  if (location.pathname !== "/" || location.hash.length < 2) return null;
  return LEGACY_HOME_ANCHORS.get(anchorOf(location.hash)) ?? null;
}

/** El `id` de la home nueva al que apunta un ancla antigua que se queda en `/`, o `null` si la URL no es una de ellas. */
export function legacyHomeScrollId(location: HomeLocation): string | null {
  if (location.pathname !== "/" || location.hash.length < 2) return null;
  const anchor = anchorOf(location.hash);
  return LEGACY_HOME_SCROLL_ANCHORS.has(anchor) ? anchor : null;
}

/**
 * Lleva `/#planes`, `/#combo-emprendedor`, `/#contacto` y `/#servicios` a su vista, reemplazando la entrada del
 * historial para que «atrás» no vuelva a la ancla. Devuelve `true` mientras la URL es una de ellas.
 *
 * Es `useEffect` y no `useLayoutEffect` a propósito: los efectos de layout de un hijo corren antes que el del Router
 * que escucha el historial, y una navegación hecha ahí en el primer render se pierde (la URL no cambia).
 */
export function useLegacyHomeHash(): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const destination = legacyHomeDestination(location);

  useEffect(() => {
    if (destination) navigate(destination, { replace: true });
  }, [destination, navigate]);

  return destination !== null;
}

/**
 * Baja hasta la sección de `/#inicio`, `/#por-que-elegirnos` y `/#proceso`. El navegador no lo hace solo: el ancla
 * llega antes de que React pinte la sección, o la navegación es del SPA y no recorre el documento. Lo ejecuta la puerta
 * de la ruta `/` (LegacyHomeGate), cuyo efecto corre después del montaje de la home, así que el `id` ya existe.
 * El salto es inmediato (ni movimiento ni espera): es una llegada, no una animación.
 *
 * Depende de `location.key`: un segundo clic sobre la misma ancla también vuelve a bajar.
 */
export function useLegacyHomeScroll(): void {
  const location = useLocation();
  const id = legacyHomeScrollId(location);

  useEffect(() => {
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [id, location.key]);
}
