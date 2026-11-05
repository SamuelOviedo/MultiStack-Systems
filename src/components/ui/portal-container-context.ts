import { createContext, useContext } from "react";

/**
 * Los menús, selectores y diálogos de Radix se renderizan en un portal. Por
 * defecto cuelgan de `document.body`, fuera del ámbito `.erp` del panel, y no
 * recibirían sus tokens (fondo, borde, estados). El shell del administrador
 * pasa aquí su propio elemento `.erp` para que el portal quede dentro.
 *
 * Sin proveedor, el contenedor es `undefined` y Radix usa `document.body`.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null);

export const PortalContainerProvider = PortalContainerContext.Provider;

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContainerContext) ?? undefined;
}
