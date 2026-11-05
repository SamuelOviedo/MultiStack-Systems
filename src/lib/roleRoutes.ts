/**
 * Destino de cada rol. Es la única tabla de «a dónde va cada quien»: ProtectedRoute, Login, AuthCallback y
 * UpdatePassword la comparten para que ninguna pantalla decida por su cuenta.
 *
 * Roles de `profiles.user_type`: 0 administrador, 1 colaborador, 2 cliente.
 *
 * Es SOLO interfaz: decide a dónde se manda a alguien y qué rutas se le ofrecen. La barrera de los datos sigue
 * siendo RLS; ocultar o redirigir aquí no protege la API.
 */

/** Rutas con acceso restringido por rol. Debe coincidir con los `allowedTypes` de `src/App.tsx` (lo comprueba una prueba). */
const RESTRICTED_ROUTES: readonly { readonly prefix: string; readonly roles: readonly number[] }[] = [
  { prefix: "/dashboard", roles: [0] },
  { prefix: "/solicitudes", roles: [2] },
];

/**
 * Página de inicio de un rol.
 * - 0 → panel. 2 → mis solicitudes.
 * - 1 → `/`: la zona de trabajo del colaborador aún no existe, así que no tiene panel al que ir.
 * - `null` (rol aún sin resolver) → `/solicitudes`, la zona de menor privilegio: ProtectedRoute la reenvía a la
 *   propia en cuanto el rol se conoce.
 * - Cualquier otro valor → `/`. No debe devolver `/solicitudes` (ruta `[2]`): causaría un bucle de redirecciones.
 */
export function roleHome(userType: number | null): string {
  if (userType === 0) return "/dashboard";
  if (userType === 2 || userType === null) return "/solicitudes";
  return "/";
}

/** ¿Puede este rol abrir esta ruta interna? Las rutas sin restricción son accesibles para cualquier sesión. */
export function canAccessPath(userType: number | null, path: string): boolean {
  let pathname: string;
  try {
    // El analizador de URL normaliza segmentos `.`/`..` y codificados; el router compara sin distinguir mayúsculas.
    pathname = new URL(path, "http://route.invalid").pathname.toLowerCase();
  } catch {
    return false;
  }
  const rule = RESTRICTED_ROUTES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return true;
  return userType !== null && rule.roles.includes(userType);
}

/** Solo rutas internas: empieza por `/`, no es de protocolo relativo (`//host`) y no lleva contrabarras. */
export function isInternalPath(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\");
}

/**
 * Destino tras iniciar sesión. `?redirect=` solo se honra para administrador y colaborador, si es una ruta interna
 * Y accesible para ese rol; en cualquier otro caso se va a la página de inicio del rol.
 */
export function postLoginTarget(userType: number, redirect: string | null): string {
  if ((userType === 0 || userType === 1) && isInternalPath(redirect) && canAccessPath(userType, redirect)) {
    return redirect;
  }
  return roleHome(userType);
}
