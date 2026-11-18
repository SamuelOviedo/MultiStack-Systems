import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { legacyHomeDestinationPath } from "@/lib/legacyHomeHash";
import { preloadSiteView } from "@/lib/siteViewPreload";

const at = (pathname: string, hash = "") => ({ pathname, hash });

/** Tres cargadores espía; cada uno resuelve, como lo haría el `import()` de su vista. */
function loaders() {
  return {
    planes: vi.fn(() => Promise.resolve("planes")),
    servicios: vi.fn(() => Promise.resolve("servicios")),
    contacto: vi.fn(() => Promise.resolve("contacto")),
  };
}

type Name = keyof ReturnType<typeof loaders>;

/** Comprueba que se llamó exactamente a `expected` (una vez) y a ninguno más. */
function expectOnly(l: ReturnType<typeof loaders>, expected: Name | null) {
  for (const name of ["planes", "servicios", "contacto"] as const) {
    expect(l[name]).toHaveBeenCalledTimes(name === expected ? 1 : 0);
  }
}

describe("preloadSiteView", () => {
  it.each([
    ["/planes", "planes"],
    ["/planes/", "planes"],
    ["/servicios", "servicios"],
    ["/servicios/", "servicios"],
    ["/contacto", "contacto"],
    ["/contacto/", "contacto"],
  ] as const)("la visita directa a %s precarga solo el chunk de %s", (pathname, name) => {
    const l = loaders();
    preloadSiteView(at(pathname), l);
    expectOnly(l, name);
  });

  it.each([
    ["#planes", "planes"],
    ["#combo-emprendedor", "planes"],
    ["#contacto", "contacto"],
    ["#servicios", "servicios"],
    ["#%70lanes", "planes"], // el ancla se decodifica igual que en la redirección
  ] as const)("la ancla antigua /%s precarga solo el chunk de %s", (hash, name) => {
    const l = loaders();
    preloadSiteView(at("/", hash), l);
    expectOnly(l, name);
  });

  it.each([
    "/",
    "/login",
    "/planes/x",
    "/planes//",
    "/PLANES",
    "/paginas-web",
    "/dashboard/planes",
    "/__proto__",
    "/constructor",
    "/toString",
    "/hasOwnProperty",
    "/valueOf",
    "",
  ])("la ruta ajena %j no precarga nada", (pathname) => {
    const l = loaders();
    preloadSiteView(at(pathname), l);
    expectOnly(l, null);
  });

  it.each([
    "#inicio", // se queda en la home y baja a su sección
    "#por-que-elegirnos",
    "#proceso",
    "#preguntas", // sin equivalente
    "#solicitar",
    "#__proto__",
    "#constructor",
    "#toString",
    "#",
    "#%E0%A4%A", // % mal formado
  ])("la home con el ancla %j no precarga nada", (hash) => {
    const l = loaders();
    preloadSiteView(at("/", hash), l);
    expectOnly(l, null);
  });

  it("una ancla antigua solo cuenta en la home: /login#planes no precarga nada", () => {
    const l = loaders();
    preloadSiteView(at("/login", "#planes"), l);
    expectOnly(l, null);
  });

  it("una visita directa a una vista con ancla (/servicios#x) precarga su chunk", () => {
    const l = loaders();
    preloadSiteView(at("/servicios", "#x"), l);
    expectOnly(l, "servicios");
  });

  it("control negativo: los espías detectan una llamada de más o una equivocada", () => {
    const l = loaders();
    preloadSiteView(at("/planes"), l);
    // Si el mapeo se cruzara (por ejemplo /planes llamando al de servicios), alguna de estas dos comprobaciones falla.
    expect(() => expectOnly(l, "servicios")).toThrow();
    expect(() => expectOnly(l, null)).toThrow();
    expectOnly(l, "planes");

    const none = loaders();
    preloadSiteView(at("/"), none);
    expect(() => expectOnly(none, "planes")).toThrow();
  });

  it("traga los errores del chunk: el rechazo se atiende y no se propaga", () => {
    // Una promesa que anota si se le puso un manejador de rechazo (`.catch` llama a `then(undefined, fn)`).
    let handled = 0;
    class Tracked extends Promise<unknown> {
      static get [Symbol.species]() {
        return Promise;
      }
      then<A = unknown, B = never>(
        onFulfilled?: ((value: unknown) => A | PromiseLike<A>) | null,
        onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
      ) {
        if (typeof onRejected === "function") handled += 1;
        return super.then(onFulfilled, onRejected);
      }
    }
    // Funciones simples y no `vi.fn`: el espía de vitest también se engancha a la promesa devuelta y falsearía la cuenta.
    let calls = 0;
    const failing = () => () => {
      calls += 1;
      return Tracked.reject(new Error("sin red"));
    };
    const l = { planes: failing(), servicios: failing(), contacto: failing() };

    expect(() => {
      preloadSiteView(at("/planes"), l);
      preloadSiteView(at("/servicios/"), l);
      preloadSiteView(at("/", "#contacto"), l);
    }).not.toThrow();

    expect(calls).toBe(3);
    expect(handled).toBe(3);
  });

  it("no elige la función con un valor de la URL: ni Map ni objeto indexado en el módulo ni en App", () => {
    const read = (file: string) => readFileSync(resolve(__dirname, "..", file), "utf8");
    const preload = read("lib/siteViewPreload.ts").replace(/\/\*[\s\S]*?\*\//g, "");
    const app = read("App.tsx");
    expect(preload).not.toMatch(/new Map|\.get\(|\[\s*path\s*\]|\[\s*location\./);
    expect(app).not.toMatch(/SITE_CHUNKS/);
    expect(app).toMatch(/preloadSiteView\(window\.location,/);
  });
});

describe("legacyHomeDestinationPath", () => {
  it.each([
    ["#planes", "/planes"],
    ["#combo-emprendedor", "/planes"],
    ["#contacto", "/contacto"],
    ["#servicios", "/servicios"],
  ])("%s lleva a %s, sin query", (hash, path) => {
    expect(legacyHomeDestinationPath({ pathname: "/", hash })).toBe(path);
  });

  it.each([
    [{ pathname: "/", hash: "" }],
    [{ pathname: "/", hash: "#" }],
    [{ pathname: "/", hash: "#inicio" }],
    [{ pathname: "/", hash: "#__proto__" }],
    [{ pathname: "/", hash: "#constructor" }],
    [{ pathname: "/planes", hash: "#planes" }],
  ])("%j no es una ancla antigua", (location) => {
    expect(legacyHomeDestinationPath(location)).toBeNull();
  });
});
