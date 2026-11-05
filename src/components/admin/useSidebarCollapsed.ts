import { useCallback, useState } from "react";

/** Clave de localStorage del plegado de la barra lateral. Solo guarda «collapsed» o «expanded». */
export const SIDEBAR_STORAGE_KEY = "ms-admin-sidebar";

/** Lee la preferencia; si el almacenamiento no está disponible (modo privado, bloqueado) queda expandida. */
export function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "collapsed";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // Sin almacenamiento la preferencia dura solo esta sesión de la página.
  }
}

/** Estado plegado/expandido de la barra lateral, persistente entre visitas. */
export function useSidebarCollapsed(): readonly [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const toggle = useCallback(() => {
    const next = !collapsed;
    setCollapsed(next);
    writeSidebarCollapsed(next);
  }, [collapsed]);
  return [collapsed, toggle] as const;
}
