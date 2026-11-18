// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";


// Las clases de duración y de curva con valor arbitrario entre corchetes (la de 560 ms, la de 250 ms y las curvas cubic-bezier)
// deben llegar a la hoja de estilos. Con tailwindcss-animate instalado, Tailwind 3 las marca «ambiguas» (porque también existen
// las utilidades de duración y de curva de la animación) y NO genera su CSS: la transición cae a la de la utilidad de
// transición (150 ms, curva por omisión). Se ve en el aviso «is ambiguous and matches multiple utilities» al arrancar
// `npm run dev` y se mide con el CSS que Tailwind genera. Por eso el sitio declara esos tiempos en site.css (`.ms-site .site-*`)
// y estas pruebas vigilan que ningún componente vuelva a usar la clase ambigua.
//
// Tailwind escanea src/, pruebas incluidas: aquí ninguna clase se escribe completa, se arma en ejecución, y los comentarios
// las describen con palabras.

const join = (...parts: string[]) => parts.join("-");
const DURATION = join("duration", "");
const EASE = join("ease", "");
// Import dinámico y por ruta: un import estático metería tailwind.config.ts en el programa de tsc de la app, que no lo incluye.
const CONFIG_PATH: string = path.resolve(__dirname, "..", "..", "tailwind.config.ts");
const SITE_DIR = path.resolve(__dirname, "..", "components", "site");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Las clases de duración y de curva con valor arbitrario que hay en un texto. */
function timingClassesIn(source: string): string[] {
  const pattern = new RegExp(`(?<![\\w-])(?:${DURATION}|${EASE})\\[[^\\]\\s]+\\]`, "g");
  return [...source.matchAll(pattern)].map((match) => match[0]);
}

/** Las que usan los componentes del sitio. */
function arbitraryTimingClasses(): { file: string; cls: string }[] {
  return sourceFiles(SITE_DIR).flatMap((file) =>
    timingClassesIn(readFileSync(file, "utf8")).map((cls) => ({ file: path.relative(SITE_DIR, file).replace(/\\/g, "/"), cls })),
  );
}

async function generatedCss(classes: string[]): Promise<string> {
  const { default: config } = (await import(/* @vite-ignore */ CONFIG_PATH)) as { default: Record<string, unknown> };
  const result = await postcss([tailwindcss({ ...config, content: [{ raw: classes.join(" "), extension: "html" }] } as never)]).process(
    "@tailwind utilities;",
    { from: undefined },
  );
  return result.css;
}

describe("clases de tiempo con valor arbitrario del sitio", () => {
  it("el escáner reconoce las de duración y de curva (no pasa en vacío)", () => {
    // Muestra armada en ejecución: un literal con forma de clase en este archivo lo escanearía Tailwind.
    const sample = [`${DURATION}[560ms]`, `${EASE}[cubic-bezier(0.22,1,0.36,1)]`, `${DURATION}300`].join(" ");
    expect(timingClassesIn(sample)).toEqual([`${DURATION}[560ms]`, `${EASE}[cubic-bezier(0.22,1,0.36,1)]`]);
  });

  it("control: una utilidad de duración sin ambigüedad sí se genera (la prueba mide algo)", async () => {
    const css = await generatedCss([`${DURATION}300`]);
    expect(css).toMatch(/transition-duration:\s*300ms/);
  });

  it("control: la misma clase con valor arbitrario NO se genera (la causa de TW-1 sigue vigente)", async () => {
    const css = await generatedCss([`${DURATION}[560ms]`]);
    expect(css).not.toMatch(/560ms/);
  });

  // TW-1 (corregido): las píldoras del titular deslizaban en 150 ms con la curva por omisión en vez de 560 ms con la del diseño,
  // y el hover de las fichas de tecnología tampoco usaba sus 250 ms. Los tiempos viven ahora en site.css (`.ms-site .site-*`); si
  // alguien vuelve a escribir una clase de duración o de curva con valor arbitrario en el sitio, la regla no se genera.
  it("TW-1: ningún componente del sitio usa una clase de duración o de curva con valor arbitrario", () => {
    expect(arbitraryTimingClasses()).toEqual([]);
  });

  it("TW-1: site.css declara los tiempos que antes se perdían (560 ms del carril, 250 ms de píldora y fichas)", () => {
    const css = postcss.parse(readFileSync(path.join(SITE_DIR, "site.css"), "utf8"));
    const timing = (selector: string) => {
      const declared: Record<string, string> = {};
      css.walkRules(selector, (rule) => {
        rule.walkDecls(/^transition-(duration|timing-function)$/, (decl) => {
          declared[decl.prop] = decl.value;
        });
      });
      return declared;
    };
    expect(timing(".ms-site .site-pill-reel")).toEqual({
      "transition-duration": "560ms",
      "transition-timing-function": "cubic-bezier(0.22, 1, 0.36, 1)",
    });
    expect(timing(".ms-site .site-pill-tilt")["transition-duration"]).toBe("250ms");
    expect(timing(".ms-site .site-tile-press")["transition-duration"]).toBe("250ms");
    expect(timing(".ms-site .site-ease-enter")["transition-timing-function"]).toBe("cubic-bezier(0.2, 0.7, 0.2, 1)");
  });
});
