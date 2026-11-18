// Base visual del sitio público: aislamiento del ámbito `.ms-site` y reglas de las primitivas.
//   - site.css: todo selector dentro de `.ms-site`; nada en :root, html ni body; @keyframes con prefijo propio;
//   - los tokens `--site-*` que usa tailwind.config.ts existen en site.css;
//   - site-fonts.css: solo @font-face con los woff2 locales que ya existen;
//   - ningún archivo nuevo importa `motion` ni `framer-motion`, ni consulta Supabase, ni nombra la herramienta de la
//     referencia (la palabra se arma en ejecución para que esta prueba tampoco la contenga).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import postcss, { type AtRule, type Container, type Document, type Rule } from "postcss";
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
    // `--ms-credit-opacity` es la propiedad pública del crédito del pie (estándar, sección 9): el pie la ajusta sin editar el snippet.
    const allowed = /^--(site-|gx$|gy$|gc-r$|delay$|chars$|reveal-delay$|ms-credit-opacity$)/;
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

describe("site.css: pausa de animaciones y colores de respaldo", () => {
  const classesOf = (rule: Rule) => [...rule.selector.matchAll(/\.([a-z][\w-]*)/gi)].map((m) => m[1]!).filter((name) => name !== "ms-site");
  const inside = (node: Rule, atRule: RegExp) => {
    for (let parent: Container | Document | undefined = node.parent; parent; parent = parent.parent) {
      if (parent.type === "atrule" && atRule.test(`${(parent as AtRule).name} ${(parent as AtRule).params}`)) return true;
    }
    return false;
  };

  it("toda animación infinite tiene su regla bajo [data-motion=\"paused\"] (WCAG 2.2.2)", () => {
    const paused = new Set<string>();
    for (const rule of rules) {
      if (rule.selector.includes('[data-motion="paused"]')) classesOf(rule).forEach((name) => paused.add(name));
    }
    const infinite = rules.filter((rule) => rule.nodes.some((node) => node.type === "decl" && /^animation(-iteration-count)?$/.test(node.prop) && /\binfinite\b/.test(node.value)));
    expect(infinite.length).toBeGreaterThanOrEqual(6);
    for (const rule of infinite) {
      const last = classesOf(rule).at(-1)!;
      expect(paused.has(last), `${rule.selector} no se pausa`).toBe(true);
    }
  });

  it("la pausa detiene los bucles con animation-play-state y oculta el cursor del hero", () => {
    const pausedRules = rules.filter((rule) => rule.selector.includes('[data-motion="paused"]'));
    const playState = pausedRules.flatMap((rule) => rule.nodes.filter((n) => n.type === "decl" && n.prop === "animation-play-state").map((n) => (n as { value: string }).value));
    expect(playState).toContain("paused");
    expect(pausedRules.some((rule) => rule.selector.includes(".hero-caret") && rule.nodes.some((n) => n.type === "decl" && n.prop === "display" && n.value === "none"))).toBe(true);
  });

  it("el fondo y el texto de .ms-site llevan un hex antes del oklch(), y un bloque @supports not los repite", () => {
    const base = rules.find((rule) => rule.selector === ".ms-site" && !inside(rule, /supports/))!;
    for (const prop of ["background-color", "color"]) {
      const values = base.nodes.filter((n) => n.type === "decl" && n.prop === prop).map((n) => (n as { value: string }).value);
      expect(values, prop).toHaveLength(2);
      expect(values[0], prop).toMatch(/^#[0-9a-f]{6}$/i);
      expect(values[1], prop).toMatch(/^oklch\(/);
    }
    const fallback = rules.find((rule) => rule.selector === ".ms-site" && inside(rule, /supports not \(color: oklch/))!;
    expect(fallback).toBeDefined();
    expect(fallback.nodes.map((n) => (n.type === "decl" ? n.prop : ""))).toEqual(["background-color", "color"]);
  });

  it(".text-gradient tiene color liso de respaldo y solo se hace transparente si entiende oklch y background-clip", () => {
    const gradient = rules.filter((rule) => rule.selector === ".ms-site .text-gradient");
    const plain = gradient.find((rule) => !inside(rule, /supports/))!;
    const color = plain.nodes.find((n) => n.type === "decl" && n.prop === "color") as { value: string } | undefined;
    expect(color?.value).toMatch(/^#[0-9a-f]{6}$/i);
    expect(plain.nodes.some((n) => n.type === "decl" && /transparent|background/.test(`${n.prop} ${n.value}`))).toBe(false);

    const enhanced = gradient.find((rule) => inside(rule, /supports.*oklch.*background-clip/))!;
    expect(enhanced).toBeDefined();
    expect(enhanced.nodes.some((n) => n.type === "decl" && n.prop === "color" && n.value === "transparent")).toBe(true);
    // Ninguna otra regla deja el texto transparente fuera de ese bloque.
    root.walkDecls("color", (decl) => {
      if (decl.value !== "transparent") return;
      expect(inside(decl.parent as Rule, /supports/), (decl.parent as Rule).selector).toBe(true);
    });
  });
});

describe("tokens --site-* frente a tailwind.config.ts", () => {
  const config = read(path.resolve(SRC, "..", "tailwind.config.ts"));
  const used = [...config.matchAll(/siteColor(?:WithBaseAlpha)?\("([a-z-]+)"/g)].map((m) => m[1]);
  const defined = new Set<string>();
  root.walkDecls(/^--site-/, (decl) => void defined.add(decl.prop.replace(/^--site-/, "")));

  it("la config expone los colores principales de la referencia", () => {
    // Tailwind escanea los tests: un literal con forma de clase añade CSS muerto a la hoja inicial. El del anillo se arma en ejecución.
    for (const token of ["background", "foreground", "surface", "card", "primary", "muted-foreground", "accent", "border", "input", ["r", "ing"].join(""), "success"]) {
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
