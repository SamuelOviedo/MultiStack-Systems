/**
 * Visita directa al panel: el armazón (`AdminShell`) y la página que envuelve son dos chunks perezosos y la página es
 * hija del armazón, así que React solo pediría la página cuando el armazón ya llegó (dos viajes seguidos por la red).
 * Con la ruta conocida desde el principio se piden los dos a la vez y, de paso, mientras se comprueba la sesión.
 * Si el módulo ya está pedido, `import()` devuelve el mismo; un fallo se ignora aquí porque `lazy` lo volverá a
 * intentar y lo mostrará donde corresponde.
 */
const FIRST_PAGE: Readonly<Record<string, () => Promise<unknown>>> = {
  "/dashboard": () => import("@/pages/dashboard/Dashboard"),
  "/dashboard/proyectos": () => import("@/pages/dashboard/ProjectsList"),
};

export function preloadPanelForPath(pathname: string): void {
  const loadPage = FIRST_PAGE[pathname.replace(/\/+$/, "") || "/"];
  if (!loadPage) return;
  void import("./AdminShell").catch(() => undefined);
  void loadPage().catch(() => undefined);
}
