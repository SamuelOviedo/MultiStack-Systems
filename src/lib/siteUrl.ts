import { SIGNUP_CONFIRMATION_PATH } from "@/lib/authRedirect";
import { isPackageId, packageRequestPath } from "@/lib/packageIntent";

// Con www: host canónico (Vercel redirige el dominio sin www desde la configuración de Dominios) y el que
// está en las Redirect URLs de Supabase.
const PRODUCTION_ORIGIN = "https://www.multistacksystems.com";

/**
 * Origen público del sitio para redirecciones de auth.
 * Orden de prioridad:
 *   1. window.location.origin en localhost / 127.0.0.1 (desarrollo local): el
 *      OAuth debe volver al MISMO origen, porque supabase-js guarda la sesión
 *      (y el code verifier, si se usa PKCE) en el localStorage del origen al que
 *      regresa — aunque .env traiga VITE_SITE_URL de producción.
 *   2. VITE_SITE_URL (env var en Vercel / build)
 *   3. PRODUCTION_ORIGIN como fallback duro — evita que *.vercel.app active el SSO de Vercel
 */
export function getSiteOrigin(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return window.location.origin;
    }
  }
  const fromEnv = import.meta.env.VITE_SITE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/$/, "");
  }
  return PRODUCTION_ORIGIN;
}

/**
 * Destino del enlace de confirmación de registro: `/solicitudes` en el origen canónico. Con el id de un paquete
 * de la lista blanca (isPackageId) añade `?paquete=<id>`, para que el formulario del paquete se abra también
 * si el enlace se abre en otro dispositivo (la intención guardada vive en el localStorage del navegador que se
 * registró). Cualquier otro valor se ignora: ni la ruta ni otros parámetros salen de la entrada.
 */
export function getAuthEmailRedirectUrl(packageId?: string): string {
  const path = isPackageId(packageId) ? packageRequestPath(packageId) : SIGNUP_CONFIRMATION_PATH;
  return `${getSiteOrigin()}${path}`;
}
