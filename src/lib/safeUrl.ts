/** Mensaje de los formularios cuando el enlace escrito no pasa `safeExternalUrl`. */
export const EXTERNAL_URL_ERROR = "Escribe un enlace completo que empiece por https:// o http://.";

/**
 * Enlaces escritos por personas del equipo (o por la API) que el panel pinta como `<a href>`.
 *
 * React 18 no filtra `href="javascript:…"`: el código se ejecutaría en la sesión de quien pulse el enlace. Por eso
 * un valor solo se convierte en enlace si pasa por aquí.
 *
 * Se acepta únicamente una URL absoluta `http:` o `https:` con host y sin credenciales. La decisión sale del
 * analizador estándar (`new URL(valor)`, sin base) y se toma sobre `url.protocol` ya analizado: el analizador
 * descarta espacios, tabuladores y saltos de línea iniciales o internos y no distingue mayúsculas, que es
 * justo lo que rompe cualquier comprobación por prefijo de texto.
 *
 * Devuelve `url.href` normalizado, no el texto original. Así lo que se valida es exactamente lo que se pinta
 * (p. ej. `https:ejemplo.com` se resuelve distinto según haya o no una base; normalizado no hay ambigüedad).
 */
export function safeExternalUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    // Vacío, relativa (`/ruta`), protocolo-relativa (`//host`), sin esquema (`docs.ejemplo.com/x`) o sin host
    // (`https://`): el analizador no puede construir una URL absoluta sin base.
    return null;
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname) return null;
  if (url.username || url.password) return null;

  return url.href;
}
