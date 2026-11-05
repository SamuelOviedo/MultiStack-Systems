// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { afterEach, describe, expect, it, vi } from "vitest";

import { withRouteHead } from "@/lib/routeHead";
import { HOME_META, ROUTE_META, type RouteMeta } from "@/lib/routeMeta";
import { routeHeadPlugin } from "../../build/routeHeadPlugin";

// El plugin se prueba sin Vite ni esbuild: se llama a su generateBundle con un bundle simulado y un emitFile espía.

const INDEX_HTML = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
const LANDING = ROUTE_META["/paginas-web"];

interface EmittedFile {
  type: string;
  fileName: string;
  source: string;
}

/** Un bundle de Rollup con solo index.html, como lo deja Vite antes de que corran los hooks finales. */
const bundleWith = (entry: Record<string, unknown>): Record<string, unknown> => ({
  "index.html": { fileName: "index.html", name: "index.html", needsCodeReference: false, ...entry },
});
const realBundle = (): Record<string, unknown> => bundleWith({ type: "asset", source: INDEX_HTML });

/** Ejecuta el generateBundle del plugin (función u objeto con handler) y devuelve el espía de emitFile y el error, si hubo. */
async function runGenerateBundle(plugin: Plugin, bundle: Record<string, unknown>) {
  const hook = plugin.generateBundle;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  if (!handler) throw new Error("el plugin no tiene hook generateBundle");

  const emitFile = vi.fn((_file: EmittedFile) => "id");
  const call = handler as unknown as (this: { emitFile: typeof emitFile }, ...args: unknown[]) => unknown;
  let error: unknown;
  try {
    await call.call({ emitFile }, {}, bundle, true);
  } catch (caught) {
    error = caught;
  }
  const emitted = emitFile.mock.calls.map(([file]) => file);
  return { emitFile, emitted, error };
}

/** El mismo plugin pero con otras rutas en ROUTE_META, importado de nuevo para que lea la lista simulada. */
async function pluginWithRoutes(routes: Record<string, RouteMeta>): Promise<Plugin> {
  vi.resetModules();
  vi.doMock("@/lib/routeMeta", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/routeMeta")>()),
    ROUTE_META: routes,
  }));
  const { routeHeadPlugin: fresh } = await import("../../build/routeHeadPlugin");
  return fresh();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@/lib/routeMeta");
  vi.resetModules();
});

// El plugin anuncia cada archivo con console.log; aquí no hace falta verlo.
const quiet = () => vi.spyOn(console, "log").mockImplementation(() => undefined);

describe("routeHeadPlugin · cómo se registra", () => {
  it("se llama route-head, solo se aplica al construir y corre después de los demás plugins", () => {
    const plugin = routeHeadPlugin();

    expect(plugin.name).toBe("route-head");
    expect(plugin.apply).toBe("build");
    expect(plugin.enforce).toBe("post");
  });

  it("tiene un hook generateBundle", () => {
    const hook = routeHeadPlugin().generateBundle;

    expect(typeof hook === "function" || typeof hook?.handler === "function").toBe(true);
  });
});

describe("routeHeadPlugin · con el index.html del repositorio", () => {
  it("emite exactamente un archivo, paginas-web/index.html, con el head de la ruta", async () => {
    quiet();

    const { emitFile, error } = await runGenerateBundle(routeHeadPlugin(), realBundle());

    expect(error).toBeUndefined();
    expect(emitFile).toHaveBeenCalledTimes(1);
    expect(emitFile).toHaveBeenCalledWith({
      type: "asset",
      fileName: "paginas-web/index.html",
      source: withRouteHead(INDEX_HTML, LANDING),
    });
  });

  it("el archivo emitido trae el title, el canonical y la og:image de la landing y ninguno de los de la home", async () => {
    quiet();

    const { emitted } = await runGenerateBundle(routeHeadPlugin(), realBundle());
    const { source } = emitted[0];

    expect(source).toContain(`<title>${LANDING.title}</title>`);
    expect(source).toContain(`<link rel="canonical" href="${LANDING.canonical}" />`);
    expect(source).toContain(`<meta property="og:image" content="${LANDING.ogImage}" />`);
    expect(source).not.toContain(HOME_META.title);
    expect(source).not.toContain(`<meta property="og:image" content="${HOME_META.ogImage}" />`);
    expect(source).not.toMatch(/name="keywords"/);
  });

  it("no emite la home y deja intacto el index.html del bundle", async () => {
    quiet();
    const bundle = realBundle();

    const { emitted } = await runGenerateBundle(routeHeadPlugin(), bundle);

    expect(emitted.map((file) => file.fileName)).not.toContain("index.html");
    expect(emitted.some((file) => file.source === INDEX_HTML)).toBe(false);
    expect((bundle["index.html"] as { source: string }).source).toBe(INDEX_HTML);
  });
});

describe("routeHeadPlugin · cuando el build no puede emitir la cabecera", () => {
  it.each([
    ["no hay ningún archivo en el bundle", {}],
    ["index.html es un chunk de código", bundleWith({ type: "chunk", code: "export {}" })],
    ["index.html no es texto", bundleWith({ type: "asset", source: new Uint8Array([60, 33]) })],
  ])("si %s, lanza un Error y no emite nada", async (_name, bundle) => {
    quiet();

    const { emitFile, error } = await runGenerateBundle(routeHeadPlugin(), bundle);

    expect(error).toBeInstanceOf(Error);
    expect(emitFile).not.toHaveBeenCalled();
  });

  it("si al head de index.html le falta una etiqueta, lanza nombrando la ruta y la etiqueta, y no emite nada", async () => {
    quiet();
    const broken = INDEX_HTML.replace(/<link[^>]*rel="canonical"[^>]*>/, "");
    expect(broken).not.toBe(INDEX_HTML);

    const { emitFile, error } = await runGenerateBundle(routeHeadPlugin(), bundleWith({ type: "asset", source: broken }));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("/paginas-web");
    expect((error as Error).message).toContain("canonical");
    expect(emitFile).not.toHaveBeenCalled();
  });
});

describe("routeHeadPlugin · una entrada por cada ruta de ROUTE_META", () => {
  it("emite <ruta>/index.html para cada una, también con rutas anidadas o con barra final", async () => {
    quiet();
    const plugin = await pluginWithRoutes({ "/paginas-web": LANDING, "/servicios/web/": LANDING, "/otra": LANDING });

    const { emitted, error } = await runGenerateBundle(plugin, realBundle());

    expect(error).toBeUndefined();
    expect(emitted.map((file) => file.fileName)).toEqual(["paginas-web/index.html", "servicios/web/index.html", "otra/index.html"]);
  });

  it("una ruta que pisaría index.html (la raíz) lanza en vez de sobrescribir la home", async () => {
    quiet();
    const plugin = await pluginWithRoutes({ "/": LANDING });

    const { emitFile, error } = await runGenerateBundle(plugin, realBundle());

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("index.html");
    expect(emitFile).not.toHaveBeenCalled();
  });
});
