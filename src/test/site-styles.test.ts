// Base visual del sitio público: aislamiento del ámbito `.ms-site` y reglas de las primitivas.
//   - site.css: todo selector dentro de `.ms-site`; nada en :root, html ni body; @keyframes con prefijo propio;
//   - los tokens `--site-*` que usa tailwind.config.ts existen en site.css;
//   - site-fonts.css: solo @font-face con los woff2 locales que ya existen;
//   - ningún archivo nuevo importa `motion` ni `framer-motion`, ni consulta Supabase, ni nombra la herramienta de la
//     referencia (la palabra se arma en ejecución para que esta prueba tampoco la contenga).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");
const SITE_DIR = path.join(SRC, "components", "site");
const read = (file: string) => readFileSync(file, "utf8");

const siteCss = read(path.join(SITE_DIR, "site.css"));
const root = postcss.parse(siteCss);
const fontsCssPath = path.join(SITE_DIR, "site-fonts.css");
const fontsCss = read(fontsCssPath);

const rules: Rule[] = [];
root.walkRules((rule) => {
  // Los pasos de un @keyframes (from, to, 40 %) no son selectores de elementos.
  if (rule.parent?.type === "atrule" && /keyframes$/i.test((rule.parent as AtRule).name)) return;
  rules.push(rule);
});

describe("site.css: aislamiento", () => {
  it("tiene reglas", () => {
    expect(rules.length).toBeGreaterThan(30);
  });

  it("todo selector está dentro de `.ms-site` (directo o con :where)", () => {
    const fuera = rules.flatMap((rule) => rule.selectors).filter((selector) => !selector.includes(".ms-site"));
    expect(fuera).toEqual([]);
  });

  it("ninguna regla toca :root, html, body ni el selector universal suelto", () => {
    for (const selector of rules.flatMap((rule) => rule.selectors)) {
      expect(selector, selector).not.toMatch(/:root|(^|[\s>+~(,])(html|body)\b/);
      expect(selector.trim(), selector).not.toBe("*");
    }
  });

  it("los @keyframes llevan el prefijo ms-site- (son globales por naturaleza)", () => {
    const names: string[] = [];
    root.walkAtRules(/keyframes$/i, (rule) => void names.push(rule.params));
    expect(names.length).toBeGreaterThanOrEqual(12);
    for (const name of names) expect(name).toMatch(/^ms-site-/);
  });

  it("cada animación nombra un @keyframes que existe", () => {
    const defined = new Set<string>();
    root.walkAtRules(/keyframes$/i, (rule) => void defined.add(rule.params));
    root.walkDecls(/^animation(-name)?$/, (decl) => {
      for (const used of decl.value.matchAll(/\bms-site-[a-z-]+\b/g)) expect(defined.has(used[0]), used[0]).toBe(true);
    });
  });

  it("no redefine los tokens de shadcn ni de la landing (solo --site-* y variables locales)", () => {
    const allowed = /^--(site-|gx$|gy$|gc-r$|delay$|chars$|reveal-delay$)/;
    root.walkDecls(/^--/, (decl) => {
      if (/^--(delay|chars|reveal-delay)$/.test(decl.prop)) return; // solo se leen
      expect(decl.prop, decl.prop).toMatch(allowed);
    });
  });

  it("con movimiento reducido apaga animaciones y transiciones y oculta el cursor", () => {
    let block: AtRule | undefined;
    root.walkAtRules("media", (rule) => {
      if (/prefers-reduced-motion:\s*reduce/.test(rule.params)) block = rule;
    });
    expect(block).toBeDefined();
    const css = block!.toString();
    expect(css).toMatch(/animation:\s*none\s*!important/);
    expect(css).toMatch(/transition:\s*none\s*!important/);
    expect(css).toMatch(/\.hero-caret/);
  });

  it("la animación de entrada solo oculta con movimiento normal y con el atributo armado por JavaScript", () => {
    let hides = false;
    root.walkRules((rule) => {
      if (!rule.selector.includes('[data-site-reveal="hidden"]')) return;
      hides = true;
      const parent = rule.parent as AtRule;
      expect(parent.type).toBe("atrule");
      expect(parent.params).toMatch(/prefers-reduced-motion:\s*no-preference/);
    });
    expect(hides).toBe(true);
  });

  it("importa site-fonts.css y es lo único que importa", () => {
    const imports: string[] = [];
    root.walkAtRules("import", (rule) => void imports.push(rule.params));
    expect(imports).toEqual(['"./site-fonts.css"']);
  });
});

describe("tokens --site-* frente a tailwind.config.ts", () => {
  const config = read(path.resolve(SRC, "..", "tailwind.config.ts"));
  const used = [...config.matchAll(/siteColor(?:WithBaseAlpha)?\("([a-z-]+)"/g)].map((m) => m[1]);
  const defined = new Set<string>();
  root.walkDecls(/^--site-/, (decl) => void defined.add(decl.prop.replace(/^--site-/, "")));

  it("la config expone los colores principales de la referencia", () => {
    for (const token of ["background", "foreground", "surface", "card", "primary", "muted-foreground", "accent", "border", "input", "ring", "success"]) {
      expect(used, token).toContain(token);
    }
  });

  it("todo color de la config tiene su variable en site.css", () => {
    for (const token of used) expect(defined.has(token), token).toBe(true);
  });

  it("la escala de radios depende de --site-radius, que existe", () => {
    expect(config).toMatch(/calc\(var\(--site-radius\)/);
    expect(defined.has("radius")).toBe(true);
  });
});

describe("site-fonts.css", () => {
  const faces: AtRule[] = [];
  postcss.parse(fontsCss).walkAtRules("font-face", (rule) => void faces.push(rule));
  const prop = (face: AtRule, name: string) => {
    let value = "";
    face.walkDecls(name, (decl) => void (value = decl.value.trim()));
    return value;
  };

  it("declara Poppins 400, 500, 600 y 700 con swap y rango latino", () => {
    expect(faces.map((face) => `${prop(face, "font-family")} ${prop(face, "font-weight")}`).sort()).toEqual(
      ['"Poppins" 400', '"Poppins" 500', '"Poppins" 600', '"Poppins" 700'].sort(),
    );
    for (const face of faces) {
      expect(prop(face, "font-display")).toBe("swap");
      expect(prop(face, "unicode-range")).toContain("U+0000-00FF");
    }
  });

  it("solo referencia los woff2 locales del repositorio, que existen", () => {
    for (const face of faces) {
      const match = /^url\("(\.\.\/\.\.\/assets\/fonts\/poppins-latin-\d{3}-normal\.woff2)"\) format\("woff2"\)$/.exec(prop(face, "src"));
      expect(match, prop(face, "src")).not.toBeNull();
      expect(existsSync(path.resolve(SITE_DIR, match![1])), match![1]).toBe(true);
    }
    const code = postcss.parse(fontsCss);
    code.walkComments((comment) => void comment.remove());
    expect(code.toString()).not.toMatch(/@import|https?:|googleapis|gstatic/i);
  });
});

describe("archivos nuevos del sitio público", () => {
  const files = [
    ...readdirSync(SITE_DIR)
      .filter((name) => /\.(tsx?|css)$/.test(name))
      .map((name) => path.join(SITE_DIR, name)),
    path.join(SRC, "hooks", "useRevealInView.ts"),
  ];
  const forbiddenName = new RegExp(["lov", "able"].join(""), "i");

  it("hay archivos que revisar", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no importan motion ni framer-motion", () => {
    for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
      expect(read(file), file).not.toMatch(/from\s+["'](motion|framer-motion)(\/[^"']*)?["']/);
    }
  });

  it("no consultan Supabase directamente", () => {
    for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
      expect(read(file), file).not.toMatch(/integrations\/supabase|@supabase\//);
    }
  });

  it("no nombran la herramienta con la que se hizo la referencia", () => {
    for (const file of [...files, path.join(SRC, "..", "tailwind.config.ts"), __filename]) {
      expect(read(file), file).not.toMatch(forbiddenName);
    }
  });

  it("el shader solo se importa de forma dinámica", () => {
    for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
      const source = read(file);
      const staticImports = [...source.matchAll(/^import\s+(?!type\b)[^;]*from\s+["'][^"']*WavesShaderCanvas["']/gm)];
      expect(staticImports, file).toEqual([]);
    }
  });
});
