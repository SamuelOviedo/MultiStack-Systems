const PRODUCTION_ORIGIN = "https://multistacksystems.com";

/**
 * Origen público del sitio para redirecciones de auth.
 * Orden de prioridad:
 *   1. VITE_SITE_URL (env var en Vercel / build)
 *   2. window.location.origin — sólo en localhost / 127.0.0.1 (desarrollo local)
 *   3. PRODUCTION_ORIGIN como fallback duro — evita que *.vercel.app active el SSO de Vercel
 */
export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return window.location.origin;
    }
  }
  return PRODUCTION_ORIGIN;
}

export function getAuthEmailRedirectUrl(): string {
  const base = getSiteOrigin();
  if (!base) return "/solicitudes";
  return `${base}/solicitudes`;
}
