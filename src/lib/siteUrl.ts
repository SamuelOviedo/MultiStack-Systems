/**
 * Origen público del sitio para redirecciones de auth (confirmación de email, etc.).
 * En producción define VITE_SITE_URL (ej. https://graystackdev.com) en el build/hosting.
 * Sin variable: usa el origen actual del navegador (útil en local).
 */
export function getSiteOrigin(): string {
  const fromEnv = import.meta.env.VITE_SITE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim() !== "") {
    return fromEnv.trim().replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

export function getAuthEmailRedirectUrl(): string {
  const base = getSiteOrigin();
  if (!base) return "/login";
  return `${base}/login`;
}
