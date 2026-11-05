/**
 * Errores de carga del panel: la persona ve una frase en español y el detalle técnico se queda fuera de la
 * pantalla. Al registro solo va un código (nunca el mensaje, que puede traer nombres de tablas o datos).
 */

/** Código corto y seguro para registrar: el de Postgres/PostgREST o el estado HTTP; si no hay, «desconocido». */
export function errorCode(error: unknown): string {
  if (error && typeof error === "object") {
    const { code, status } = error as { code?: unknown; status?: unknown };
    if (typeof code === "string" && /^[A-Za-z0-9_-]{1,16}$/.test(code)) return code;
    if (typeof status === "number") return String(status);
  }
  return "desconocido";
}

const PERMISSION_CODES = new Set(["42501", "PGRST301", "401", "403"]);

/** Frase para mostrar. `what` va con artículo: «los proyectos», «las alertas». */
export function loadErrorMessage(error: unknown, what: string): string {
  if (PERMISSION_CODES.has(errorCode(error))) {
    return `No tienes permiso para ver ${what}. Si crees que es un error, avisa a un administrador.`;
  }
  return `No se pudieron cargar ${what}. Revisa tu conexión e inténtalo de nuevo.`;
}

/** Ejecuta una carga y, si falla, registra solo el código antes de relanzar. */
export async function withLoggedCode<T>(scope: string, load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    console.error(`[${scope}] carga fallida, código:`, errorCode(error));
    throw error;
  }
}

/** Frase para el aviso (toast) cuando falla una acción; el detalle no se muestra. */
export function actionErrorMessage(error: unknown, action: string): string {
  console.error(`[acción] ${action} falló, código:`, errorCode(error));
  return PERMISSION_CODES.has(errorCode(error))
    ? "No tienes permiso para hacer esto."
    : "No se pudo completar la acción. Inténtalo de nuevo.";
}
