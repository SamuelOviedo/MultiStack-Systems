import type { ReactNode } from "react";
import { useLegacyHomeHash, useLegacyHomeScroll } from "@/lib/legacyHomeHash";

/**
 * Puerta de la ruta `/`: si la URL es una ancla antigua de la home que hoy es otra vista (`/#planes`, `/#contacto`…),
 * redirige a esa vista y no monta la home. Si es una que sigue en la home (`/#inicio`, `/#por-que-elegirnos`,
 * `/#proceso`), la monta y baja hasta su sección. Ver `lib/legacyHomeHash.ts`.
 */
const LegacyHomeGate = ({ children }: { children: ReactNode }) => {
  const redirecting = useLegacyHomeHash();
  useLegacyHomeScroll();
  return redirecting ? null : <>{children}</>;
};

export default LegacyHomeGate;
