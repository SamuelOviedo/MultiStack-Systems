import { useCallback, useState } from "react";

/**
 * Los dos modales del Resumen y de la lista (alta de proyecto y alcance de una solicitud) usan formularios, selects
 * y diálogos que pesan ~70 kB. Solo se necesitan cuando alguien los abre, así que se piden entonces (o en cuanto
 * el puntero o el foco llegan al botón) en vez de viajar con la pantalla.
 */
export const loadNewProjectModal = () => import("./NewProjectModal");
export const loadProjectScopingModal = () => import("@/components/dashboard/requests/ProjectScopingModal");

/** Adelanta la descarga del modal de alta cuando hay intención (puntero o foco sobre «Nuevo proyecto»). */
export const preloadNewProjectModal = (): void => {
  void loadNewProjectModal();
};

/**
 * Estado de un modal que se monta tarde. `armed` pasa a verdadero la primera vez que se abre y ya no vuelve a
 * falso: el modal se queda montado (cerrado) para que su animación de salida y la devolución del foco funcionen
 * igual que antes.
 */
export function useLazyModal() {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const show = useCallback(() => {
    setArmed(true);
    setOpen(true);
  }, []);
  const hide = useCallback(() => setOpen(false), []);
  return { open, armed, show, hide };
}
