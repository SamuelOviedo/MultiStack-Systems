/**
 * Medición de Google Ads (gtag.js) para las rutas públicas de marketing.
 *
 * La etiqueta NO va en index.html: allí se cargaría en todas las rutas y gtag.js enviaría a Google la
 * URL completa de /client/:token (token del portal público), de /auth/* (hash #access_token del flujo
 * implícito de Supabase), de /dashboard y de /solicitudes. Por eso se inyecta desde este módulo, solo en
 * una lista blanca de rutas, y lo que sale hacia Google pasa por los sanitizadores de aquí (salvo los
 * click-ids que gtag lee de la URL y el referrer de los page_view). Ante la duda se falla cerrado: no se
 * carga y no se envía.
 *
 * Además de la ruta, tres guardas (hasAuthCredentialsInUrl, hasUnsafeClickIdsInUrl y hasStoredSession)
 * cuentan como «ruta no permitida»; cada una explica su motivo en su doc.
 *
 * Referrer: la conversión respeta page_referrer (con "" el `ref` sale vacío), pero el `dr` de los
 * page_view y del config sale SIEMPRE de document.referrer y page_referrer no lo sobrescribe. Se controla
 * con <meta name="referrer" content="strict-origin"> en index.html: en una navegación completa de
 * /client/<token> a «/», document.referrer queda reducido al origen y la ruta con el token no llega.
 *
 * Variables VITE_* públicas; sin un valor bien formado no se crea nada (ni script, ni window.gtag, ni consola):
 *   VITE_GADS_ID             AW-<dígitos>              p. ej. AW-1000000000
 *   VITE_GADS_CONTACT_LABEL  AW-<dígitos>/<etiqueta>   p. ej. AW-1000000000/PRUEBA
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Únicas rutas donde se carga la etiqueta y se envían eventos (lista blanca). */
export const ADS_ROUTES = ["/", "/paginas-web", "/politica-de-privacidad", "/terminos-del-servicio"] as const;

const TAG_ID_RE = /^AW-\d{6,15}$/;
const SEND_TO_RE = /^(AW-\d{6,15})\/[A-Za-z0-9_-]{4,64}$/;
/** Identificadores de clic de Google: lo único de la query que sale hacia Google. */
const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid"];
const CLICK_ID_VALUE_RE = /^[A-Za-z0-9_.~=-]{1,512}$/;
/** Parámetros de click-id que gtag.js lee de la URL por su cuenta y envía a Google (ver hasUnsafeClickIdsInUrl). */
const GTAG_CLICK_PARAM_KEYS = ["gclid", "gbraid", "wbraid", "dclid", "gclsrc", "gad_source", "gad_campaignid"];
/** Claves de auth de Supabase (flujo implícito, PKCE, enlaces de correo y errores), en minúsculas. */
const AUTH_PARAM_KEYS = [
  "access_token",
  "refresh_token",
  "provider_token",
  "provider_refresh_token",
  "token_hash",
  "token_type",
  "expires_in",
  "expires_at",
  "code",
  "error",
  "error_code",
  "error_description",
  "type",
];
/** Clave de sesión por defecto de supabase-js (client.ts no define storageKey): sb-<ref>-auth-token. */
const SESSION_KEY_RE = /^sb-.+-auth-token$/;

// Estado de la carga de página actual:
//  - lastPath: última ruta enviada; absorbe el doble efecto de React StrictMode.
//  - lastLocation: page_location de la visita anterior. null = aún no hubo ninguna; "" = la anterior no
//    fue permitida (ruta no permitida o guarda activa), incluso si fue la primera.
//  - lastReferrer: page_referrer del page_view de la visita actual, ya saneado; la conversión lo reutiliza.
let lastPath: string | null = null;
let lastLocation: string | null = null;
let lastReferrer = "";

/**
 * Coincidencia exacta con la lista blanca (nunca prefijos ni lista negra). Acepta
 * una «/» final salvo en la raíz, distingue mayúsculas y rechaza lo que no sea string.
 */
export function isAdsRoute(pathname: unknown): boolean {
  return (
    typeof pathname === "string" &&
    ADS_ROUTES.some((route) => pathname === route || (route !== "/" && pathname === `${route}/`))
  );
}

const clean = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** ID de la etiqueta (VITE_GADS_ID) si tiene la forma AW-<6 a 15 dígitos>; si no, null. */
export function getAdsTagId(): string | null {
  const id = clean(import.meta.env.VITE_GADS_ID);
  return TAG_ID_RE.test(id) ? id : null;
}

/**
 * Destino de la conversión de contacto (VITE_GADS_CONTACT_LABEL), solo si está bien
 * formado y su parte AW-<dígitos> coincide con el ID de la etiqueta; si no, null.
 */
export function getContactSendTo(): string | null {
  const label = clean(import.meta.env.VITE_GADS_CONTACT_LABEL);
  const match = SEND_TO_RE.exec(label);
  return match && match[1] === getAdsTagId() ? label : null;
}

/** Solo URLs absolutas http(s): cualquier otra cosa cuenta como inválida. */
function parseWebUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * origin + pathname y, de la query, únicamente gclid, gbraid y wbraid (en el orden en
 * que aparecen, la primera ocurrencia de cada clave, con valor URL-safe de 1 a 512
 * caracteres). El hash siempre se descarta. URL inválida, no http(s) o con un pathname
 * fuera de la lista blanca (isAdsRoute) → "".
 * Se valida el texto crudo de la query: un valor con %xx o + se descarta.
 */
export function sanitizePageLocation(href: string): string {
  const url = parseWebUrl(href);
  if (!url || !isAdsRoute(url.pathname)) return "";
  const kept: string[] = [];
  const seen: string[] = [];
  for (const pair of url.search.slice(1).split("&")) {
    const eq = pair.indexOf("=");
    const key = eq < 0 ? pair : pair.slice(0, eq);
    if (!CLICK_ID_KEYS.includes(key) || seen.includes(key)) continue;
    seen.push(key);
    const value = eq < 0 ? "" : pair.slice(eq + 1);
    if (CLICK_ID_VALUE_RE.test(value)) kept.push(`${key}=${value}`);
  }
  return url.origin + url.pathname + (kept.length ? `?${kept.join("&")}` : "");
}

/**
 * "" si el referrer está vacío, es inválido, no es http(s) o es del mismo origen
 * (una URL propia como /client/<token> no debe salir). Si es externo, solo su origin
 * + "/". Si ownOrigin no se puede interpretar tampoco se envía nada.
 */
export function sanitizeReferrer(referrer: string, ownOrigin: string): string {
  const external = parseWebUrl(referrer);
  const own = parseWebUrl(ownOrigin);
  return external && own && external.origin !== own.origin ? `${external.origin}/` : "";
}

/**
 * true si la query (window.location.search) o el hash (sin «#», tratado como query) de la URL actual
 * llevan alguna clave de auth de Supabase (AUTH_PARAM_KEYS), comparada en minúsculas y ya decodificada:
 * una redirección mal configurada puede dejar al usuario en «/» con credenciales, y el código de Google
 * no debe ejecutarse ahí. Si la URL no se puede inspeccionar, true (falla cerrado).
 */
export function hasAuthCredentialsInUrl(): boolean {
  try {
    const { search, hash } = window.location;
    return [search, hash.replace(/^#/, "")].some((part) =>
      [...new URLSearchParams(part).keys()].some((key) => AUTH_PARAM_KEYS.includes(key.toLowerCase())),
    );
  } catch {
    return true;
  }
}

/**
 * true si la query (window.location.search) o el hash (sin «#», tratado como query) de la URL actual
 * llevan, en cualquier ocurrencia, alguno de los GTAG_CLICK_PARAM_KEYS (clave exacta, en minúsculas) con
 * un valor no vacío que, ya decodificado, no cumple CLICK_ID_VALUE_RE. gtag.js lee esos parámetros por su
 * cuenta (query y, si faltan, fragmento), los envía tal cual y crea cookies (_gcl_aw, GCL_AW_P...) sin
 * pasar por sanitizePageLocation, que solo controla el page_location que arma la app: ante un valor
 * dudoso no se carga nada. Uno vacío es inofensivo. Si la URL no se puede inspeccionar, true (falla cerrado).
 */
export function hasUnsafeClickIdsInUrl(): boolean {
  try {
    const { search, hash } = window.location;
    return [search, hash.replace(/^#/, "")].some((part) => {
      for (const [key, value] of new URLSearchParams(part)) {
        if (GTAG_CLICK_PARAM_KEYS.includes(key) && value !== "" && !CLICK_ID_VALUE_RE.test(value)) return true;
      }
      return false;
    });
  } catch {
    return true;
  }
}

/**
 * true si localStorage guarda una sesión de Supabase (clave sb-<ref>-auth-token). El público del anuncio
 * es anónimo: así el código de un tercero no corre en páginas públicas con la sesión de un colaborador o
 * cliente. Solo se recorren los nombres de las claves, nunca se leen los valores.
 */
export function hasStoredSession(): boolean {
  try {
    const store = window.localStorage;
    for (let i = 0; i < store.length; i++) {
      if (SESSION_KEY_RE.test(store.key(i) ?? "")) return true;
    }
  } catch {
    // Sin almacenamiento persistente no hay sesión que exponer.
  }
  return false;
}

/**
 * Define gtag como el snippet oficial, lo configura sin page_view automático e inyecta el script. El
 * config lleva page_location y page_referrer saneados: sin ellos gtag emite igualmente un hit
 * (en=page_view) con la query completa de la URL, aunque send_page_view sea false.
 */
function loadAdsTag(id: string, pageLocation: string, pageReferrer: string): void {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // gtag.js solo interpreta el objeto `arguments` (igual que el snippet oficial de
    // Google); un arreglo creado con parámetros rest no lo reconoce.
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer?.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, {
    send_page_view: false,
    allow_enhanced_conversions: false,
    allow_ad_personalization_signals: false,
    page_location: pageLocation,
    page_referrer: pageReferrer,
  });
  const src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/**
 * Se llama al montar y en cada cambio de ruta. Nunca lanza. Con una ruta o una guarda que no permite la
 * medición, olvida la última página (lastLocation = "") y vuelve sin llamar a gtag ni tocar el DOM, aunque
 * la etiqueta ya esté cargada (queda inerte). En la primera ruta permitida carga la etiqueta; después,
 * un page_view por visita. page_referrer es el page_location de la visita permitida anterior (en la
 * primera, el document.referrer saneado; tras una visita no permitida, ""); gtag lo ignora en page_view y config.
 */
export function syncAdsTag(pathname: string): void {
  try {
    // Ruta del router y del navegador permitidas y ninguna guarda activa: cualquier duda (p. ej. una
    // redirección en un efecto hijo) cuenta como ruta no permitida.
    if (
      typeof window === "undefined" ||
      !isAdsRoute(pathname) ||
      !isAdsRoute(window.location.pathname) ||
      hasAuthCredentialsInUrl() ||
      hasUnsafeClickIdsInUrl() ||
      hasStoredSession()
    ) {
      lastPath = null;
      lastLocation = "";
      return;
    }
    const id = getAdsTagId();
    if (!id || pathname === lastPath) return;
    const pageLocation = sanitizePageLocation(window.location.href);
    if (!pageLocation) return; // con page_location vacío gtag enviaría la URL completa
    const pageReferrer = lastLocation ?? sanitizeReferrer(document.referrer, window.location.origin);
    if (!window.gtag) loadAdsTag(id, pageLocation, pageReferrer);
    lastPath = pathname;
    lastLocation = pageLocation;
    lastReferrer = pageReferrer;
    window.gtag("event", "page_view", { page_location: pageLocation, page_referrer: pageReferrer });
  } catch {
    // La medición nunca debe romper la página.
  }
}

/**
 * Conversión «Contacto enviado». Nunca lanza: un fallo aquí no puede hacer que el formulario muestre
 * error cuando el mensaje sí se envió. Mismas guardas que syncAdsTag, más ID y destino válidos y gtag ya
 * inicializado. El evento lleva solo send_to, page_location y el page_referrer del page_view de la visita
 * actual (puede ser ""); sin datos del visitante ni value/currency, que están en la cuenta.
 */
export function trackContactConversion(): void {
  try {
    if (
      typeof window === "undefined" ||
      !isAdsRoute(window.location.pathname) ||
      hasAuthCredentialsInUrl() ||
      hasUnsafeClickIdsInUrl() ||
      hasStoredSession()
    ) {
      return;
    }
    const sendTo = getContactSendTo();
    const pageLocation = sanitizePageLocation(window.location.href);
    if (!sendTo || !pageLocation || typeof window.gtag !== "function") return;
    window.gtag("event", "conversion", { send_to: sendTo, page_location: pageLocation, page_referrer: lastReferrer });
  } catch {
    // La medición nunca debe afectar al envío del formulario.
  }
}
