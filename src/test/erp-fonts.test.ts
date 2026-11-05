// Tipografía del administrador: Poppins en títulos y navegación, Inter en interfaz y cifras.
//   - `src/assets/fonts/erp-fonts.css` solo referencia los 5 archivos woff2 locales (sin red, sin @import);
//   - las licencias OFL 1.1 están en `public/licenses/`;
//   - la entrada (index.html, main.tsx, index.css) no importa las fuentes: las carga el chunk del administrador;
//   - `.erp` usa Inter con cifras tabulares y los encabezados/navegación usan Poppins sin tocar la regla global.
// La prueba de que el navegador pinta Inter tabular y Poppins la hace el arnés visual, no esta suite.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const REPO = path.resolve(SRC, "..");
const FONT_DIR = path.join(SRC, "assets", "fonts");
const fontsCss = readFileSync(path.join(FONT_DIR, "erp-fonts.css"), "utf8");
const fonts = postcss.parse(fontsCss);
const indexCss = readFileSync(path.join(SRC, "index.css"), "utf8");
const index = postcss.parse(indexCss);

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const faces: AtRule[] = [];
fonts.walkAtRules("font-face", (r) => void faces.push(r));
const prop = (face: AtRule, name: string) => {
  let value: string | undefined;
  face.walkDecls(name, (d) => void (value = d.value.trim()));
  return value;
};

const EXPECTED_FILES = [
  "inter-latin-wght-normal.woff2",
  "poppins-latin-400-normal.woff2",
  "poppins-latin-500-normal.woff2",
  "poppins-latin-600-normal.woff2",
  "poppins-latin-700-normal.woff2",
];

describe("erp-fonts.css", () => {
  it("declara exactamente 5 @font-face: Poppins 400/500/600/700 e Inter variable", () => {
    expect(faces).toHaveLength(5);
    const summary = faces.map((f) => `${prop(f, "font-family")} ${prop(f, "font-weight")}`).sort();
    expect(summary).toEqual(
      ['"Inter" 100 900', '"Poppins" 400', '"Poppins" 500', '"Poppins" 600', '"Poppins" 700'].sort(),
    );
  });

  it("todas son normal, con font-display: swap y unicode-range latino", () => {
    for (const face of faces) {
      expect(prop(face, "font-style")).toBe("normal");
      expect(prop(face, "font-display")).toBe("swap");
      const range = prop(face, "unicode-range") ?? "";
      expect(range).toContain("U+0000-00FF"); // latín básico y Latin-1: ñ á é í ó ú ü ¿ ¡
    }
  });

  it("cada src es un url() relativo a un único woff2 local", () => {
    const used: string[] = [];
    for (const face of faces) {
      const src = prop(face, "src") ?? "";
      const match = /^url\("\.\/([a-z0-9-]+\.woff2)"\) format\("woff2"\)$/.exec(src);
      expect(match, src).not.toBeNull();
      used.push(match![1]);
    }
    expect([...used].sort()).toEqual(EXPECTED_FILES);
  });

  it("los 5 archivos existen y no hay otros woff2 en la carpeta", () => {
    for (const file of EXPECTED_FILES) {
      expect(existsSync(path.join(FONT_DIR, file)), file).toBe(true);
    }
    expect(readdirSync(FONT_DIR).filter((f) => f.endsWith(".woff2")).sort()).toEqual(EXPECTED_FILES);
  });

  it("los woff2 tienen la firma de un woff2 (wOF2)", () => {
    for (const file of EXPECTED_FILES) {
      expect(readFileSync(path.join(FONT_DIR, file)).subarray(0, 4).toString("latin1"), file).toBe("wOF2");
    }
  });

  it("no usa @import ni URLs de red (http, https, //) ni Google Fonts", () => {
    expect(fontsCss).not.toMatch(/@import/i);
    expect(fontsCss).not.toMatch(/https?:/i);
    expect(fontsCss).not.toMatch(/url\(\s*["']?\/\//);
    expect(fontsCss).not.toMatch(/googleapis|gstatic|fonts\.google/i);
    for (const url of fontsCss.matchAll(/url\(([^)]*)\)/g)) expect(url[1]).toMatch(/^"\.\/[^"]+"$/);
  });

  it("la cabecera cita la licencia SIL OFL 1.1 y /licenses/", () => {
    const header = fonts.first && fonts.first.type === "comment" ? fonts.first.text : "";
    expect(header).toMatch(/SIL Open Font License 1\.1/);
    expect(header).toContain("/licenses/");
  });

  it("las licencias existen en public/licenses/", () => {
    for (const file of ["Poppins-OFL-1.1.txt", "Inter-OFL-1.1.txt"]) {
      expect(existsSync(path.join(REPO, "public", "licenses", file)), file).toBe(true);
    }
  });
});

describe("la entrada no carga las fuentes del administrador", () => {
  it("ni index.html, ni main.tsx, ni index.css las importan o las precargan", () => {
    const html = readFileSync(path.join(REPO, "index.html"), "utf8");
    const main = readFileSync(path.join(SRC, "main.tsx"), "utf8");
    // index.css sin comentarios: la cabecera del bloque del panel menciona el archivo, y es solo documentación.
    const indexCode = postcss.parse(indexCss);
    indexCode.walkComments((c) => void c.remove());
    for (const [name, text] of [["index.html", html], ["main.tsx", main], ["index.css", indexCode.toString()]] as const) {
      expect(text, name).not.toMatch(/erp-fonts|poppins-latin|inter-latin/i);
    }
  });

  it("index.css conserva su único @import (el de la landing) y no añade ninguno", () => {
    const imports: string[] = [];
    index.walkAtRules("import", (r) => void imports.push(r.params));
    expect(imports).toHaveLength(1);
    expect(imports[0]).toContain("fonts.googleapis.com");
    expect(imports[0]).not.toMatch(/Poppins|Inter/);
  });
});

describe("tipografía del ámbito .erp", () => {
  const rulesFor = (selector: string): Rule[] => {
    const found: Rule[] = [];
    index.walkRules((r) => {
      if (r.selectors.map(norm).includes(selector)) found.push(r);
    });
    return found;
  };
  const decl = (rule: Rule, name: string) => {
    let value: string | undefined;
    rule.walkDecls(name, (d) => void (value = d.value.trim()));
    return value;
  };

  it(".erp usa Inter con respaldo del sistema y conserva las cifras tabulares", () => {
    const [rule] = rulesFor(".erp").filter((r) => norm(r.selector) === ".erp");
    expect(decl(rule, "font-family")).toBe('"Inter", system-ui, sans-serif');
    expect(decl(rule, "font-variant-numeric")).toBe("tabular-nums");
  });

  it("h1-h6 y la navegación lateral usan Poppins con respaldo", () => {
    const rules = rulesFor(".erp :is(h1, h2, h3, h4, h5, h6)");
    expect(rules).toHaveLength(1);
    expect(decl(rules[0], "font-family")).toBe('"Poppins", system-ui, sans-serif');
    expect(rules[0].selectors.map(norm)).toContain('.erp nav[aria-label="Principal"]');
  });

  it("los títulos ganan a la regla global de h1-h6 (Sora) por especificidad: (0,1,1) frente a (0,0,1)", () => {
    // `.erp` (clase) + `:is(h1…h6)` (el más específico de sus argumentos = un elemento) = (0,1,1);
    // la global `h1, h2, h3, h4, h5, h6` = (0,0,1). Ninguna es `!important`.
    const heading = rulesFor(".erp :is(h1, h2, h3, h4, h5, h6)")[0];
    let global: Rule | undefined;
    index.walkRules((r) => {
      if (norm(r.selector) === "h1, h2, h3, h4, h5, h6") global = r;
    });
    expect(global).toBeDefined();
    expect(decl(global!, "font-family")).toContain("Sora");
    expect(heading.toString()).not.toMatch(/!important/);
    expect(global!.toString()).not.toMatch(/!important/);
    expect(norm(heading.selectors[0])).toMatch(/^\.erp :is\(/);
  });

  it("la navegación lateral se reconoce por aria-label=\"Principal\" (si cambia, esta regla deja de aplicar)", () => {
    const list = readFileSync(path.join(SRC, "components", "admin", "AdminNavList.tsx"), "utf8");
    expect(list).toContain('<nav aria-label="Principal"');
  });

  it("las cifras marcadas .tabular se quedan en Inter dentro de Poppins (Poppins no tiene cifras tabulares)", () => {
    const rules = rulesFor(".erp .tabular");
    expect(rules).toHaveLength(1);
    expect(decl(rules[0], "font-family")).toBe('"Inter", system-ui, sans-serif');
    expect(rules[0].toString()).not.toMatch(/!important/);
  });

  it("cada familia usada en .erp tiene su @font-face en erp-fonts.css", () => {
    const declared = new Set(faces.map((f) => (prop(f, "font-family") ?? "").replace(/"/g, "")));
    const used = new Set<string>();
    index.walkRules((rule) => {
      if (!/\.erp/.test(rule.selector)) return;
      rule.walkDecls("font-family", (d) => {
        for (const m of d.value.matchAll(/"([^"]+)"/g)) used.add(m[1]);
      });
    });
    expect([...used].sort()).toEqual([...declared].sort());
  });
});
