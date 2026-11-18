import { useCallback } from "react";
import { useLocation } from "react-router-dom";

/**
 * Atribución de Google Ads en la navegación interna del sitio público.
 *
 * Hoy la home conserva la query al ir a #contacto (`requestService` en Index.tsx hace `navigate({ search, hash })`):
 * sin gclid en la URL de la página donde se envía el formulario, la conversión sale sin atribución. Los enlaces del
 * encabezado, el pie y los CTA entre vistas (/, /planes, /servicios, /contacto) tienen que hacer lo mismo.
 *
 * Regla, en `withPreservedSearch`:
 * - Misma página (ancla `#x` o la misma ruta): se conserva TODA la query, igual que `requestService`.
 * - Otra ruta: solo los parámetros de campaña (click-ids de Google y `utm_*`). Nunca se arrastran parámetros
 *   funcionales de otras pantallas (`redirect`, `error`, `code`, `token`…) hacia /login, /solicitudes o /dashboard.
 * - Los pares se copian TAL CUAL, sin decodificar ni volver a codificar: la analítica descarta un click-id con
 *   `%xx` o `+`, y `URLSearchParams` re-codificaría `=` o `~` de un gclid válido.
 * - Si el destino ya trae un parámetro con la misma clave (p. ej. `?paquete=`), manda el del destino.
 * - Enlaces externos (https:, mailto:, tel:) no se tocan.
 */

/** Click-ids que gtag.js lee de la URL (misma lista que `GTAG_CLICK_PARAM_KEYS` de lib/analytics). */
export const CLICK_ID_PARAMS: readonly string[] = [
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "gclsrc",
  "gad_source",
  "gad_campaignid",
];

/** true si es un parámetro de campaña que viaja entre rutas distintas. */
export function isCampaignParam(key: string): boolean {
  const lower = key.toLowerCase();
  return CLICK_ID_PARAMS.includes(lower) || lower.startsWith("utm_");
}

/** Ruta de la app: `/algo`, `/algo?x=1#y` o un ancla `#y`. «//host» es una URL con protocolo implícito: no. */
export function isInternalTarget(to: string): boolean {
  return (to.startsWith("/") && !to.startsWith("//")) || to.startsWith("#");
}

const rawPairs = (query: string): string[] => query.replace(/^\?/, "").split("&").filter(Boolean);
const keyOf = (pair: string): string => {
  const eq = pair.indexOf("=");
  return eq < 0 ? pair : pair.slice(0, eq);
};

/** Destino con la query de atribución de `currentSearch` aplicada según la regla del encabezado de este módulo. */
export function withPreservedSearch(to: string, currentSearch: string, currentPathname: string): string {
  if (!isInternalTarget(to)) return to;

  const hashAt = to.indexOf("#");
  const hash = hashAt < 0 ? "" : to.slice(hashAt);
  const beforeHash = hashAt < 0 ? to : to.slice(0, hashAt);
  const queryAt = beforeHash.indexOf("?");
  const targetPath = (queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt)) || currentPathname;
  const targetPairs = queryAt < 0 ? [] : rawPairs(beforeHash.slice(queryAt));

  const samePage = targetPath === currentPathname;
  const own = new Set(targetPairs.map((pair) => keyOf(pair).toLowerCase()));
  const carried = rawPairs(currentSearch).filter(
    (pair) => (samePage || isCampaignParam(keyOf(pair))) && !own.has(keyOf(pair).toLowerCase()),
  );

  const query = [...targetPairs, ...carried].join("&");
  return `${targetPath}${query ? `?${query}` : ""}${hash}`;
}

/** Para navegación imperativa (`navigate(href(to))`): la misma regla que SiteLink con la ubicación actual. */
export function useSiteHref(): (to: string) => string {
  const { pathname, search } = useLocation();
  return useCallback((to: string) => withPreservedSearch(to, search, pathname), [pathname, search]);
}
