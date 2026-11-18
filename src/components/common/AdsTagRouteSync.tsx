import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { syncAdsTag } from "@/lib/analytics";
import { legacyHomeDestination } from "@/lib/legacyHomeHash";

/**
 * Sin interfaz: avisa a la medición de Google Ads de cada cambio de ruta.
 * La lista blanca de rutas y el saneado de URLs viven en `lib/analytics`.
 *
 * Un enlace antiguo (`/#planes`, `/#contacto`…) pasa un instante por «/» antes de que LegacyHomeGate lo lleve a su
 * vista: esa parada no es una visita a la home y no se mide, para que el enlace cuente un solo page_view (el de la vista).
 */
const AdsTagRouteSync = () => {
  const location = useLocation();
  const { pathname } = location;
  const redirecting = legacyHomeDestination(location) !== null;

  useEffect(() => {
    if (!redirecting) syncAdsTag(pathname);
  }, [pathname, redirecting]);

  return null;
};

export default AdsTagRouteSync;
