import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { syncAdsTag } from "@/lib/analytics";

/**
 * Sin interfaz: avisa a la medición de Google Ads de cada cambio de ruta.
 * La lista blanca de rutas y el saneado de URLs viven en `lib/analytics`.
 */
const AdsTagRouteSync = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    syncAdsTag(pathname);
  }, [pathname]);

  return null;
};

export default AdsTagRouteSync;
