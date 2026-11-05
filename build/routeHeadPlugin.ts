import type { Plugin } from "vite";
import { withRouteHead } from "../src/lib/routeHead";
import { ROUTE_META } from "../src/lib/routeMeta";

/**
 * Emite una copia de index.html por cada ruta de ROUTE_META con la cabecera propia de esa ruta
 * (dist/paginas-web/index.html para "/paginas-web"). Por qué hace falta, en src/lib/routeHead.ts.
 *
 * Va después de `vite:build-html`, que emite index.html. Si ese asset no está o no es texto, el build
 * falla en vez de omitir las rutas en silencio. Los errores no llevan prefijo: Vite ya antepone el
 * nombre del plugin, `[route-head]`.
 *
 * Los tests de src/ importan este archivo y la app se tipa con ES2020: nada de APIs posteriores
 * (por eso el `Error` no lleva `{ cause }`).
 */
export function routeHeadPlugin(): Plugin {
  return {
    name: "route-head",
    apply: "build",
    // `enforce` y `order` son redundantes a propósito: hoy cada uno basta para quedar detrás de
    // `vite:build-html`, y si una versión futura de Vite cambia uno, el otro sostiene el orden.
    enforce: "post",
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        const entry = bundle["index.html"];
        if (!entry || entry.type !== "asset" || typeof entry.source !== "string") {
          throw new Error("index.html no está en el bundle como texto; no se pueden emitir las cabeceras por ruta.");
        }
        for (const [route, meta] of Object.entries(ROUTE_META)) {
          const dir = route.replace(/^\/+|\/+$/g, "");
          if (!dir) throw new Error(`La ruta "${route}" no puede emitirse: pisaría index.html.`);
          const fileName = `${dir}/index.html`;
          let source: string;
          try {
            source = withRouteHead(entry.source, meta);
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            throw new Error(`${route}: ${reason}`);
          }
          this.emitFile({ type: "asset", fileName, source });
          console.log(`[route-head] ${fileName}`);
        }
      },
    },
  };
}
