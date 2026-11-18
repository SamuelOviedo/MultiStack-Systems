/**
 * Parámetros de campaña de la URL (click-ids de Google y `utm_*`) y su filtrado.
 *
 * Vive en `lib/` y sin dependencias porque lo cargan el arranque de la app (`legacyHomeHash`) y los enlaces del sitio
 * (`siteLinks`). Es la única regla de qué parámetros pueden viajar a otra ruta: nunca se arrastran los funcionales
 * (`redirect`, `error`, `code`, `token`, `access_token`…) hacia /login, /solicitudes o /dashboard.
 *
 * Los pares se copian TAL CUAL, sin decodificar ni volver a codificar: la analítica descarta un click-id con `%xx` o
 * `+`, y `URLSearchParams` re-codificaría `=` o `~` de un gclid válido.
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

/** Los pares `clave=valor` de una query (con o sin `?`), sin tocar su codificación y sin los vacíos. */
export const rawPairs = (query: string): string[] => query.replace(/^\?/, "").split("&").filter(Boolean);

/** La clave de un par sin decodificar. */
export const keyOf = (pair: string): string => {
  const eq = pair.indexOf("=");
  return eq < 0 ? pair : pair.slice(0, eq);
};

/** Solo los pares de campaña de una query, tal cual y con su `?`; `""` si no queda ninguno. */
export function campaignSearch(query: string): string {
  const kept = rawPairs(query).filter((pair) => isCampaignParam(keyOf(pair)));
  return kept.length > 0 ? `?${kept.join("&")}` : "";
}
