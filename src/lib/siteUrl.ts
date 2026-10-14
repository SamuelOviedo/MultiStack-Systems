const PRODUCTION_ORIGIN = "https://multistacksystems.com";

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

export function getAuthEmailRedirectUrl(): string {
  const base = getSiteOrigin();
  if (!base) return "/solicitudes";
  return `${base}/solicitudes`;
}
