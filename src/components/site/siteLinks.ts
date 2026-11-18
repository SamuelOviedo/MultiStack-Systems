import { useCallback } from "react";
import { useLocation } from "react-router-dom";
import { isCampaignParam, keyOf, rawPairs } from "@/lib/campaignParams";

/**
 * Atribución de Google Ads en la navegación interna del sitio público.
 *
 * La navegación interna tiene que conservar la query de campaña: sin gclid en la URL de la página donde se envía el
 * formulario, la conversión sale sin atribución. Vale para los enlaces del encabezado, el pie y los CTA entre vistas
 * (/, /planes, /servicios, /contacto) y para las anclas de la misma página (la home anterior lo hacía al ir a #contacto).
 *
 * Regla, en `withPreservedSearch`:
 * - Misma página (ancla `#x` o la misma ruta): se conserva TODA la query, como al ir a un ancla de la home.
 * - Otra ruta: solo los parámetros de campaña (click-ids de Google y `utm_*`). Nunca se arrastran parámetros
 *   funcionales de otras pantallas (`redirect`, `error`, `code`, `token`…) hacia /login, /solicitudes o /dashboard.
 * - Los pares se copian TAL CUAL, sin decodificar ni volver a codificar: la analítica descarta un click-id con
 *   `%xx` o `+`, y `URLSearchParams` re-codificaría `=` o `~` de un gclid válido.
 * - Si el destino ya trae un parámetro con la misma clave (p. ej. `?paquete=`), manda el del destino.
 * - Enlaces externos (https:, mailto:, tel:) no se tocan. Cualquier otro esquema no es un enlace (`isSafeExternalTarget`).
 *
 * Los click-ids y `isCampaignParam` están en `@/lib/campaignParams`, que también usa la redirección de las anclas
 * antiguas de la home.
 */

/** Barra invertida o carácter de control (tabulador, salto de línea…): el navegador los normaliza al resolver la URL. */
function hasUnsafePathChar(to: string): boolean {
  for (let i = 0; i < to.length; i += 1) {
    const code = to.charCodeAt(i);
    if (code === 0x5c || code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Ruta de la app: `/algo`, `/algo?x=1#y` o un ancla `#y`. No lo son «//host» (protocolo implícito) ni lo que lleve una
 * barra invertida o un carácter de control: el navegador convierte `/\host` y `/<tab>/host` en `//host` y navegaría a
 * otro sitio.
 */
export function isInternalTarget(to: string): boolean {
  if (hasUnsafePathChar(to)) return false;
  return (to.startsWith("/") && !to.startsWith("//")) || to.startsWith("#");
}

const EXTERNAL_PROTOCOLS: ReadonlySet<string> = new Set(["https:", "mailto:", "tel:"]);

/**
 * Destino externo que puede pintarse como enlace: solo `https:`, `mailto:` y `tel:`. La decisión se toma sobre el
 * protocolo que analiza `new URL` y no sobre un prefijo de texto: el analizador descarta espacios y tabuladores
 * iniciales o internos y no distingue mayúsculas, así que `" javascript:x"` o `"java\tscript:x"` no se cuelan. React 18
 * no filtra `href="javascript:…"`.
 */
export function isSafeExternalTarget(to: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(to).protocol);
  } catch {
    return false;
  }
}

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
