import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { routeMetaToPageMeta } from "@/lib/pageMeta";
import { withRouteHead } from "@/lib/routeHead";
import { HOME_META, ROUTE_META, type RouteMeta } from "@/lib/routeMeta";

// ---------------------------------------------------------------------------
// Entradas
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const INDEX_RAW = readFileSync(path.join(ROOT, "index.html"), "utf8");
/** El mismo archivo con cada tipo de salto de línea, sea cual sea el que tenga en disco (CI en Linux vs. Windows). */
const INDEX_LF = INDEX_RAW.replace(/\r\n/g, "\n");
const INDEX_CRLF = INDEX_LF.replace(/\n/g, "\r\n");

const META: RouteMeta = ROUTE_META["/paginas-web"];

/** Ocho valores distintos entre sí y sin ninguno de los de la home: un cruce de campos se vería. */
const SYN: RouteMeta = {
  title: "Título nuevo",
  description: "Descripción nueva",
  canonical: "https://example.test/ruta",
  ogTitle: "OG título nuevo",
  ogDescription: "OG descripción nueva",
  ogUrl: "https://example.test/ruta/og",
  ogImage: "https://example.test/ruta.png",
  ogImageAlt: "OG alt nuevo",
};

/** Las 12 metas que gestiona la función y de qué campo de RouteMeta sale cada una. */
const LABELS = [
  "title",
  "description",
  "canonical",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:image:alt",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
] as const;
type Label = (typeof LABELS)[number];

const expectedValues = (m: RouteMeta): Record<Label, string> => ({
  title: m.title,
  description: m.description,
  canonical: m.canonical,
  "og:title": m.ogTitle,
  "og:description": m.ogDescription,
  "og:url": m.ogUrl,
  "og:image": m.ogImage,
  "og:image:alt": m.ogImageAlt,
  "twitter:title": m.ogTitle,
  "twitter:description": m.ogDescription,
  "twitter:image": m.ogImage,
  "twitter:image:alt": m.ogImageAlt,
});

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html");

/** Lee las 12 metas de un documento ya interpretado por el navegador (valores decodificados). */
function readValues(doc: Document): Record<Label, string | null> {
  const one = (els: Element[], read: (el: Element) => string | null): string | null =>
    els.length === 0 ? null : els.length > 1 ? `<<${els.length} elementos>>` : read(els[0]);
  const metas = (attr: "name" | "property", key: string) =>
    Array.from(doc.querySelectorAll("meta")).filter((m) => m.getAttribute(attr) === key);
  const content = (e: Element) => e.getAttribute("content");
  return {
    title: one(Array.from(doc.querySelectorAll("title")), (e) => e.textContent),
    description: one(metas("name", "description"), content),
    canonical: one(Array.from(doc.querySelectorAll('link[rel="canonical"]')), (e) => e.getAttribute("href")),
    "og:title": one(metas("property", "og:title"), content),
    "og:description": one(metas("property", "og:description"), content),
    "og:url": one(metas("property", "og:url"), content),
    "og:image": one(metas("property", "og:image"), content),
    "og:image:alt": one(metas("property", "og:image:alt"), content),
    "twitter:title": one(metas("name", "twitter:title"), content),
    "twitter:description": one(metas("name", "twitter:description"), content),
    "twitter:image": one(metas("name", "twitter:image"), content),
    "twitter:image:alt": one(metas("name", "twitter:image:alt"), content),
  };
}

/** Escape HTML escrito aparte (oráculo): & < > " ' */
const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Los 8 campos de RouteMeta que withRouteHead exige como texto no vacío. */
const META_FIELD_NAMES = [
  "title",
  "description",
  "canonical",
  "ogTitle",
  "ogDescription",
  "ogUrl",
  "ogImage",
  "ogImageAlt",
] as const;

/** La línea con la que el Error nombra un campo inválido. */
const notTextLine = (field: string): string => `meta.${field}: debe ser un texto no vacío.`;

/** Valores que un campo de meta no puede tomar: ninguno es un texto no vacío. */
const NOT_TEXT: ReadonlyArray<readonly [string, unknown]> = [
  ["undefined", undefined],
  ["null", null],
  ["un número", 42],
  ["cero", 0],
  ["NaN", Number.NaN],
  ["un objeto", { texto: "x" }],
  ["un arreglo", ["x"]],
  ["un arreglo vacío", []],
  ["true", true],
  ["false", false],
  ["una función", () => "x"],
];

/** El error que lanza `run`; si no lanza nada, la prueba falla con un mensaje claro. */
function thrownBy(run: () => unknown): Error {
  try {
    run();
  } catch (error) {
    return error as Error;
  }
  throw new Error("se esperaba que lanzara un Error y no lanzó nada");
}

// ---------------------------------------------------------------------------
// HTML mínimo en el estilo de index.html: una vez cada una de las 13 etiquetas objetivo
// ---------------------------------------------------------------------------

type TargetId =
  | "title"
  | "description"
  | "keywords"
  | "canonical"
  | "ogTitle"
  | "ogDescription"
  | "ogUrl"
  | "ogImage"
  | "ogImageAlt"
  | "twTitle"
  | "twDescription"
  | "twImage"
  | "twImageAlt";

interface Target {
  id: TargetId;
  /** Nombre con el que la función debe citar la etiqueta en sus errores. */
  label: string;
  line: string;
  /** Atributo que lleva el valor (null en <title>, cuyo valor es el texto). */
  attr: "content" | "href" | null;
}

const TARGETS: readonly Target[] = [
  { id: "title", label: "<title>", line: "<title>HOME</title>", attr: null },
  { id: "description", label: '<meta name="description">', line: '<meta name="description" content="HOME desc" />', attr: "content" },
  { id: "keywords", label: '<meta name="keywords">', line: '<meta name="keywords" content="HOME kw" />', attr: "content" },
  { id: "canonical", label: '<link rel="canonical">', line: '<link rel="canonical" href="https://home.example" />', attr: "href" },
  { id: "ogTitle", label: '<meta property="og:title">', line: '<meta property="og:title" content="HOME ogt" />', attr: "content" },
  { id: "ogDescription", label: '<meta property="og:description">', line: '<meta property="og:description" content="HOME ogd" />', attr: "content" },
  { id: "ogUrl", label: '<meta property="og:url">', line: '<meta property="og:url" content="https://home.example" />', attr: "content" },
  { id: "ogImage", label: '<meta property="og:image">', line: '<meta property="og:image" content="https://home.example/i.png" />', attr: "content" },
  { id: "ogImageAlt", label: '<meta property="og:image:alt">', line: '<meta property="og:image:alt" content="HOME alt" />', attr: "content" },
  { id: "twTitle", label: '<meta name="twitter:title">', line: '<meta name="twitter:title" content="HOME twt" />', attr: "content" },
  { id: "twDescription", label: '<meta name="twitter:description">', line: '<meta name="twitter:description" content="HOME twd" />', attr: "content" },
  { id: "twImage", label: '<meta name="twitter:image">', line: '<meta name="twitter:image" content="https://home.example/i.png" />', attr: "content" },
  { id: "twImageAlt", label: '<meta name="twitter:image:alt">', line: '<meta name="twitter:image:alt" content="HOME twalt" />', attr: "content" },
];

/** Las que la función exige: todas menos keywords, que es opcional. */
const REQUIRED_TARGETS = TARGETS.filter((t) => t.id !== "keywords");

/** Las que se reescriben: keywords solo se borra, así que su atributo no importa. */
const VALUE_TARGETS = REQUIRED_TARGETS.filter((t) => t.attr !== null);

/** Las `<meta>` que se leen por `name` o `property`: todas menos `<title>` y el canonical. */
const KEYED_METAS = TARGETS.filter((t) => t.line.startsWith("<meta"));

/** La misma `<meta>` con el atributo que no es: `name=` pasa a `property=` y al revés. */
const withWrongAttribute = (line: string): string =>
  line.includes(' name="') ? line.replace(' name="', ' property="') : line.replace(' property="', ' name="');

/** `over[id]`: texto que sustituye la etiqueta (null = la quita). */
function base(over: Partial<Record<TargetId, string | null>> = {}): string {
  const parts = TARGETS.map((t) => (t.id in over ? over[t.id] : t.line)).filter((v): v is string => v !== null);
  return (
    '<!doctype html>\n<html lang="es">\n  <head>\n    <meta charset="UTF-8" />\n' +
    parts.map((p) => `    ${p}\n`).join("") +
    '    <meta property="og:type" content="website" />\n' +
    '    <meta name="twitter:card" content="summary_large_image" />\n' +
    '    <script type="module" crossorigin src="/assets/index-X.js"></script>\n' +
    '  </head>\n  <body><div id="root"></div></body>\n</html>\n'
  );
}

const target = (id: TargetId): Target => TARGETS.find((t) => t.id === id)!;

/** El texto que sustituye la línea de keywords para que haya dos. */
const twoKeywords = (): string => `${target("keywords").line}\n    ${target("keywords").line}`;

// ---------------------------------------------------------------------------
// Con el index.html real
// ---------------------------------------------------------------------------

/** Cómo debe quedar cada línea de index.html que contiene una etiqueta objetivo (null = se borra). */
const setAttr = (line: string, attr: "content" | "href", value: string): string =>
  line.replace(new RegExp(`(${attr}=")[^"]*(")`), (_all, open: string, close: string) => open + esc(value) + close);

const LINE_RULES: ReadonlyArray<{ name: string; test: RegExp; next: (line: string, m: RouteMeta) => string | null }> = [
  { name: "title", test: /<title>/, next: (l, m) => l.replace(/(<title>)[^<]*(<\/title>)/, (_a, o: string, c: string) => o + esc(m.title) + c) },
  { name: "description", test: /name="description"/, next: (l, m) => setAttr(l, "content", m.description) },
  { name: "keywords", test: /name="keywords"/, next: () => null },
  { name: "canonical", test: /rel="canonical"/, next: (l, m) => setAttr(l, "href", m.canonical) },
  { name: "og:title", test: /property="og:title"/, next: (l, m) => setAttr(l, "content", m.ogTitle) },
  { name: "og:description", test: /property="og:description"/, next: (l, m) => setAttr(l, "content", m.ogDescription) },
  { name: "og:url", test: /property="og:url"/, next: (l, m) => setAttr(l, "content", m.ogUrl) },
  { name: "og:image", test: /property="og:image"/, next: (l, m) => setAttr(l, "content", m.ogImage) },
  { name: "og:image:alt", test: /property="og:image:alt"/, next: (l, m) => setAttr(l, "content", m.ogImageAlt) },
  { name: "twitter:title", test: /name="twitter:title"/, next: (l, m) => setAttr(l, "content", m.ogTitle) },
  { name: "twitter:description", test: /name="twitter:description"/, next: (l, m) => setAttr(l, "content", m.ogDescription) },
  { name: "twitter:image", test: /name="twitter:image"/, next: (l, m) => setAttr(l, "content", m.ogImage) },
  { name: "twitter:image:alt", test: /name="twitter:image:alt"/, next: (l, m) => setAttr(l, "content", m.ogImageAlt) },
];

/** Lo que debería producir withRouteHead sobre `html`, calculado línea a línea con las reglas de arriba. */
function expectedLines(html: string, meta: RouteMeta): string[] {
  const lines = html.split(/\r?\n/);
  const hits = new Map<string, number>();
  const out: string[] = [];
  for (const line of lines) {
    const rule = LINE_RULES.find((r) => r.test.test(line));
    if (!rule) {
      out.push(line);
      continue;
    }
    hits.set(rule.name, (hits.get(rule.name) ?? 0) + 1);
    const next = rule.next(line, meta);
    if (next !== null) out.push(next);
  }
  // El oráculo no puede pasar en vacío: cada una de las 13 etiquetas está exactamente una vez en index.html.
  for (const rule of LINE_RULES) expect(hits.get(rule.name), `index.html: líneas con ${rule.name}`).toBe(1);
  return out;
}

describe("withRouteHead · con el index.html real del repositorio", () => {
  it.each([
    ["tal como está en disco", INDEX_RAW],
    ["con saltos LF", INDEX_LF],
    ["con saltos CRLF", INDEX_CRLF],
  ])("%s: difiere del original solo en las etiquetas objetivo (comparación línea a línea)", (_name, html) => {
    const out = withRouteHead(html, META);
    const srcLines = html.split(/\r?\n/);
    const outLines = out.split(/\r?\n/);

    expect(outLines).toEqual(expectedLines(html, META));
    // La única línea que desaparece es la de keywords.
    expect(outLines).toHaveLength(srcLines.length - 1);
    // Y al revés: toda línea del original que no es objetivo sigue exactamente igual y en el mismo orden.
    const untouched = srcLines.filter((l) => !LINE_RULES.some((r) => r.test.test(l)));
    expect(outLines.filter((l) => untouched.includes(l))).toEqual(untouched);
  });

  it("conserva los saltos de línea del original: CRLF sigue siendo CRLF y LF sigue siendo LF", () => {
    const crlf = withRouteHead(INDEX_CRLF, META);
    expect(/(?<!\r)\n/.test(crlf)).toBe(false);
    expect(crlf.split("\r\n")).toHaveLength(INDEX_CRLF.split("\r\n").length - 1);
    // No queda una línea en blanco nueva donde estaba keywords: hay las mismas que en el original.
    const blank = (h: string) => h.split(/\r?\n/).filter((l) => l.trim() === "").length;
    expect(blank(crlf)).toBe(blank(INDEX_CRLF));

    const lf = withRouteHead(INDEX_LF, META);
    expect(lf.includes("\r")).toBe(false);
    expect(lf.split("\n")).toHaveLength(INDEX_LF.split("\n").length - 1);
  });

  it("los 12 valores gestionados coinciden con los de RouteMeta (leídos con un analizador HTML real)", () => {
    const doc = parse(withRouteHead(INDEX_LF, META));
    expect(readValues(doc)).toEqual(expectedValues(META));
  });

  it("y coinciden con la lista que aplica el navegador en tiempo de ejecución (routeMetaToPageMeta)", () => {
    const doc = parse(withRouteHead(INDEX_LF, META));
    const values = readValues(doc);
    const runtime = routeMetaToPageMeta(META);
    expect(values.title).toBe(runtime.title);
    expect(values.description).toBe(runtime.description);
    expect(values.canonical).toBe(runtime.canonical);
    for (const [attr, key, content] of runtime.extra ?? []) {
      const found = Array.from(doc.querySelectorAll("meta")).filter((m) => m.getAttribute(attr) === key);
      expect(found, `${attr}="${key}"`).toHaveLength(1);
      expect(found[0].getAttribute("content")).toBe(content);
    }
    // Ni el build ni el navegador gestionan más metas que las otras.
    expect(runtime.extra).toHaveLength(9);
  });

  it("elimina <meta name=\"keywords\"> (las palabras clave de IA no deben quedar en la landing)", () => {
    expect(INDEX_LF).toMatch(/<meta name="keywords"/); // el original sí la trae
    const out = withRouteHead(INDEX_LF, META);
    expect(out).not.toMatch(/keywords/i);
    expect(parse(out).querySelector('meta[name="keywords"]')).toBeNull();
  });

  it("conserva scripts, links, JSON-LD y el resto de metas (og:type, site_name, locale, image:type/width/height, twitter:card)", () => {
    const out = withRouteHead(INDEX_LF, META);

    // Los <script> se leen con el parser del navegador; outerHTML conserva atributos y contenido, así que un script alterado no pasa.
    const scripts = (h: string) => Array.from(parse(h).querySelectorAll("script")).map((s) => s.outerHTML);
    expect(scripts(INDEX_LF).length).toBeGreaterThanOrEqual(3);
    expect(scripts(out)).toEqual(scripts(INDEX_LF));

    const links = (h: string) => (h.match(/<link\b[^>]*>/g) ?? []).filter((l) => !/rel="canonical"/.test(l));
    expect(links(INDEX_LF).length).toBeGreaterThanOrEqual(5);
    expect(links(out)).toEqual(links(INDEX_LF));

    const ldJson = (h: string) => /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(h)?.[1];
    expect(ldJson(out)).toBe(ldJson(INDEX_LF));
    expect(() => JSON.parse(ldJson(out)!)).not.toThrow();

    for (const key of [
      'property="og:type"',
      'property="og:site_name"',
      'property="og:locale"',
      'property="og:image:type"',
      'property="og:image:width"',
      'property="og:image:height"',
      'name="twitter:card"',
      'name="theme-color"',
      'name="author"',
      'name="viewport"',
    ]) {
      const original = INDEX_LF.split("\n").filter((l) => l.includes(`<meta ${key}`));
      expect(original, `index.html: ${key}`).toHaveLength(1);
      expect(out.split("\n"), key).toContain(original[0]);
    }
    expect(out).toContain('<meta charset="UTF-8" />');
    expect(out).toContain('<meta name="referrer" content="strict-origin" />');
    expect(out).toContain('<div id="root"></div>');
  });

  it("deja intactos los scripts y links que Vite escribe en el HTML construido (módulo, modulepreload y hoja de estilos)", () => {
    const built = INDEX_LF.replace('    <script type="module" src="/src/main.tsx"></script>\n', "").replace(
      "  </head>",
      '    <script type="module" crossorigin src="/assets/index-AbC123.js"></script>\n' +
        '    <link rel="modulepreload" crossorigin href="/assets/vendor-react-AbC123.js">\n' +
        '    <link rel="stylesheet" crossorigin href="/assets/index-AbC123.css">\n' +
        "  </head>",
    );
    expect(built).not.toBe(INDEX_LF);

    const out = withRouteHead(built, META);

    expect(out).toContain('<script type="module" crossorigin src="/assets/index-AbC123.js"></script>');
    expect(out).toContain('<link rel="modulepreload" crossorigin href="/assets/vendor-react-AbC123.js">');
    expect(out).toContain('<link rel="stylesheet" crossorigin href="/assets/index-AbC123.css">');
    expect(out.split("\n")).toEqual(expectedLines(built, META));
    expect(readValues(parse(out))).toEqual(expectedValues(META));
  });

  it("la home de partida y la landing de salida difieren en sus metas de texto (no se emite la home otra vez)", () => {
    const home = readValues(parse(INDEX_LF));
    const landing = readValues(parse(withRouteHead(INDEX_LF, META)));
    for (const label of ["title", "description", "canonical", "og:title", "og:description", "og:url"] as const) {
      expect(landing[label], label).not.toBe(home[label]);
    }
    expect(landing.title).toContain("Páginas web en Honduras");
  });

  it("con HOME_META como meta devuelve la home tal cual, salvo keywords (HOME_META refleja index.html)", () => {
    const out = withRouteHead(INDEX_LF, HOME_META);
    expect(out.split("\n")).toEqual(INDEX_LF.split("\n").filter((l) => !/name="keywords"/.test(l)));
  });
});

// ---------------------------------------------------------------------------
// Mapeo campo a campo
// ---------------------------------------------------------------------------

describe("withRouteHead · mapeo de RouteMeta a etiquetas", () => {
  it("escribe cada uno de los 12 valores en su etiqueta, sin cruces, y no deja nada de la home", () => {
    const out = withRouteHead(base(), SYN);
    expect(readValues(parse(out))).toEqual(expectedValues(SYN));
    expect(out).not.toContain("HOME");
  });

  it("deja intactas las etiquetas que no son objetivo", () => {
    const out = withRouteHead(base(), SYN);
    expect(out).toContain('<meta charset="UTF-8" />');
    expect(out).toContain('<meta property="og:type" content="website" />');
    expect(out).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(out).toContain('<script type="module" crossorigin src="/assets/index-X.js"></script>');
    expect(out).toContain('<body><div id="root"></div></body>');
  });

  it("no confunde og:image con og:image:alt/type/width/height ni twitter:image con twitter:image:alt", () => {
    const html = base().replace(
      '    <meta property="og:type"',
      '    <meta property="og:image:type" content="image/png" />\n' +
        '    <meta property="og:image:width" content="1200" />\n' +
        '    <meta property="og:image:height" content="630" />\n' +
        '    <meta property="og:type"',
    );
    const out = withRouteHead(html, SYN);
    expect(out).toContain('<meta property="og:image:type" content="image/png" />');
    expect(out).toContain('<meta property="og:image:width" content="1200" />');
    expect(out).toContain('<meta property="og:image:height" content="630" />');
    expect(out).toContain(`<meta property="og:image" content="${SYN.ogImage}" />`);
    expect(out).toContain(`<meta property="og:image:alt" content="${SYN.ogImageAlt}" />`);
    expect(out).toContain(`<meta name="twitter:image" content="${SYN.ogImage}" />`);
    expect(out).toContain(`<meta name="twitter:image:alt" content="${SYN.ogImageAlt}" />`);
  });

  it("conserva tildes y rayas largas tal cual, sin convertirlas en entidades", () => {
    const out = withRouteHead(base(), { ...SYN, title: "Páginas web — Honduras", ogImageAlt: "MultiStack — niños" });
    expect(out).toContain("<title>Páginas web — Honduras</title>");
    expect(out).toContain('content="MultiStack — niños"');
    expect(out).not.toMatch(/&#\d+;|&aacute;|&mdash;|&ntilde;/);
  });
});

// ---------------------------------------------------------------------------
// Escapes y literalidad de los valores
// ---------------------------------------------------------------------------

describe("withRouteHead · con entrada válida la salida es exactamente la de siempre", () => {
  /** Lo que debe salir de base() para `m`: la misma plantilla con las 12 etiquetas ya escritas y sin keywords. */
  const expectedFor = (m: RouteMeta): string =>
    base({
      title: `<title>${esc(m.title)}</title>`,
      description: `<meta name="description" content="${esc(m.description)}" />`,
      keywords: null,
      canonical: `<link rel="canonical" href="${esc(m.canonical)}" />`,
      ogTitle: `<meta property="og:title" content="${esc(m.ogTitle)}" />`,
      ogDescription: `<meta property="og:description" content="${esc(m.ogDescription)}" />`,
      ogUrl: `<meta property="og:url" content="${esc(m.ogUrl)}" />`,
      ogImage: `<meta property="og:image" content="${esc(m.ogImage)}" />`,
      ogImageAlt: `<meta property="og:image:alt" content="${esc(m.ogImageAlt)}" />`,
      twTitle: `<meta name="twitter:title" content="${esc(m.ogTitle)}" />`,
      twDescription: `<meta name="twitter:description" content="${esc(m.ogDescription)}" />`,
      twImage: `<meta name="twitter:image" content="${esc(m.ogImage)}" />`,
      twImageAlt: `<meta name="twitter:image:alt" content="${esc(m.ogImageAlt)}" />`,
    });

  it.each([
    ["valores distintos entre sí (SYN)", SYN],
    ["los valores reales de /paginas-web", META],
    ["los valores reales de la home", HOME_META],
  ])("HTML sintético con %s: igual byte a byte a la plantilla ya escrita", (_name, meta) => {
    expect(withRouteHead(base(), meta)).toBe(expectedFor(meta));
  });

  it("con caracteres especiales y con espacios al principio y al final: se escapan los especiales y los espacios se conservan", () => {
    const meta: RouteMeta = {
      ...SYN,
      title: `  A & B <i> "c" 'd'  `,
      description: " \t descripción con espacios \n",
      ogImageAlt: `x"y & $$ `,
    };

    const out = withRouteHead(base(), meta);

    expect(out).toBe(expectedFor(meta));
    expect(out).toContain("<title>  A &amp; B &lt;i&gt; &quot;c&quot; &#39;d&#39;  </title>");
    expect(out).toContain('content=" \t descripción con espacios \n"');
  });

  it("index.html real con LF y con CRLF: igual byte a byte al resultado de aplicar solo las reglas de línea", () => {
    expect(withRouteHead(INDEX_LF, META)).toBe(expectedLines(INDEX_LF, META).join("\n"));
    expect(withRouteHead(INDEX_CRLF, META)).toBe(expectedLines(INDEX_CRLF, META).join("\r\n"));
  });

  it("una entrada válida no lanza aunque otro campo de la misma llamada ya hubiera fallado antes (sin estado entre llamadas)", () => {
    expect(() => withRouteHead(base(), { ...SYN, title: undefined } as unknown as RouteMeta)).toThrow(Error);
    expect(withRouteHead(base(), SYN)).toBe(expectedFor(SYN));
  });
});

describe("withRouteHead · escapes", () => {
  it.each([
    ["&", "&amp;"],
    ["<", "&lt;"],
    [">", "&gt;"],
    ['"', "&quot;"],
    ["'", "&#39;"],
  ])("escribe %s como %s en el <title> y en los atributos, y el navegador lo lee de vuelta igual", (char, entity) => {
    const value = `a${char}b`;
    const meta = { ...SYN, title: value, description: value, ogTitle: value, ogImageAlt: value };

    const out = withRouteHead(base(), meta);

    expect(out).toContain(`<title>a${entity}b</title>`);
    expect(out).toContain(`name="description" content="a${entity}b"`);
    const read = readValues(parse(out));
    expect(read.title).toBe(value);
    expect(read.description).toBe(value);
    expect(read["og:title"]).toBe(value);
    expect(read["twitter:title"]).toBe(value);
    expect(read["og:image:alt"]).toBe(value);
    expect(read["twitter:image:alt"]).toBe(value);
  });

  it("un valor con marcado no puede cerrar el atributo ni inyectar elementos", () => {
    const attack = '"><script>alert(1)</script><meta name="robots" content="noindex';
    const out = withRouteHead(base(), { ...SYN, description: attack, title: "</title><script>alert(2)</script>" });

    const doc = parse(out);
    expect(doc.querySelectorAll("script")).toHaveLength(1); // solo el módulo de Vite
    expect(doc.querySelector('meta[name="robots"]')).toBeNull();
    expect(doc.title).toBe("</title><script>alert(2)</script>");
    expect(readValues(doc).description).toBe(attack);
  });

  it("no hay doble escape: un &amp; del HTML viejo no se arrastra ni se vuelve a escapar", () => {
    const html = base({ description: '<meta name="description" content="a &amp; b" />' });
    const out = withRouteHead(html, { ...SYN, description: "x & y" });
    expect(out).toContain('<meta name="description" content="x &amp; y" />');
    expect(out).not.toContain("&amp;amp;");
  });

  it.each(["$&", "$$", "$'", "$`", "$1", "$<name>", "US$99 $$$ $&amp;"])(
    "un «%s» en un valor se conserva literal (no se interpreta como patrón de String.replace)",
    (pattern) => {
      const value = `Desde ${pattern} ya`;
      const out = withRouteHead(base(), { ...SYN, title: value, description: value, ogImageAlt: value });
      const read = readValues(parse(out));
      expect(read.title).toBe(value);
      expect(read.description).toBe(value);
      expect(read["og:image:alt"]).toBe(value);
      expect(read["twitter:image:alt"]).toBe(value);
      // Y el resto del documento no se contaminó con trozos del original.
      expect(out).not.toContain("HOME");
    },
  );
});

// ---------------------------------------------------------------------------
// Tolerancia al HTML que escribe Vite
// ---------------------------------------------------------------------------

describe("withRouteHead · tolera las variaciones de formato del HTML construido", () => {
  it("cualquier orden de atributos", () => {
    const html = base({
      description: '<meta content="HOME" name="description">',
      canonical: '<link href="https://home.example" rel="canonical">',
      ogUrl: '<meta content="https://home.example" property="og:url">',
    });
    const out = withRouteHead(html, SYN);
    expect(out).toContain(`<meta content="${SYN.description}" name="description">`);
    expect(out).toContain(`<link href="${SYN.canonical}" rel="canonical">`);
    expect(out).toContain(`<meta content="${SYN.ogUrl}" property="og:url">`);
    expect(readValues(parse(out))).toEqual(expectedValues(SYN));
  });

  it("comillas simples (conservándolas) y el apóstrofo nuevo se escapa", () => {
    const out = withRouteHead(base({ ogTitle: "<meta property='og:title' content='HOME'>" }), { ...SYN, ogTitle: "It's" });
    expect(out).toContain("<meta property='og:title' content='It&#39;s'>");
    expect(readValues(parse(out))["og:title"]).toBe("It's");
  });

  it("valores sin comillas: el nuevo se escribe entre comillas dobles", () => {
    const out = withRouteHead(base({ description: "<meta name=description content=hello>" }), SYN);
    expect(out).toContain(`<meta name=description content="${SYN.description}">`);
    expect(readValues(parse(out)).description).toBe(SYN.description);
  });

  it("etiquetas y atributos en mayúsculas, y name/property/rel con otra capitalización", () => {
    const html = base({
      title: "<TITLE>HOME</TITLE>",
      description: '<META NAME="Description" CONTENT="HOME">',
      canonical: '<LINK REL="CANONICAL" HREF="https://home.example">',
      ogTitle: '<Meta Property="OG:Title" Content="HOME">',
    });
    const out = withRouteHead(html, SYN);
    expect(out).toContain(`<TITLE>${SYN.title}</TITLE>`);
    expect(out).toContain(`<META NAME="Description" CONTENT="${SYN.description}">`);
    expect(out).toContain(`<LINK REL="CANONICAL" HREF="${SYN.canonical}">`);
    expect(out).toContain(`<Meta Property="OG:Title" Content="${SYN.ogTitle}">`);
  });

  it('rel con una lista de valores: rel="canonical nofollow"', () => {
    const out = withRouteHead(base({ canonical: '<link rel="canonical nofollow" href="https://home.example">' }), SYN);
    expect(out).toContain(`<link rel="canonical nofollow" href="${SYN.canonical}">`);
  });

  it("etiquetas escritas en varias líneas, con > dentro de otro atributo y dentro del propio valor", () => {
    const html = base({
      description: '<meta\n      name="description"\n      content="a > b\n  c"\n    />',
      ogTitle: '<meta data-x="1 > 0" property="og:title" content="HOME" />',
    });
    const out = withRouteHead(html, SYN);
    expect(out).toContain(`<meta\n      name="description"\n      content="${SYN.description}"\n    />`);
    expect(out).toContain(`<meta data-x="1 > 0" property="og:title" content="${SYN.ogTitle}" />`);
  });

  it("un atributo ajeno cuyo valor contiene «content=» o name=\"description\" no confunde a la función", () => {
    const html = base({
      ogUrl: '<meta data-note=\'name="description" content="NO"\' property="og:url" content="https://home.example" />',
    });
    const out = withRouteHead(html, SYN);
    expect(out).toContain(`property="og:url" content="${SYN.ogUrl}"`);
    expect(out).toContain('data-note=\'name="description" content="NO"\'');
    expect(readValues(parse(out)).description).toBe(SYN.description);
  });

  it("<title> con atributos y texto en varias líneas, y <title> vacío", () => {
    const multi = withRouteHead(base({ title: '<title data-x="1">\n  HOME\n  viejo\n</title>' }), SYN);
    expect(multi).toContain(`<title data-x="1">${SYN.title}</title>`);
    const empty = withRouteHead(base({ title: "<title></title>" }), SYN);
    expect(empty).toContain(`<title>${SYN.title}</title>`);
  });

  it("CRLF en HTML sintético: reemplaza, borra la línea de keywords con su salto y no deja \\n sueltos", () => {
    const crlf = base().replace(/\n/g, "\r\n");
    const out = withRouteHead(crlf, SYN);
    expect(out).not.toMatch(/keywords/);
    expect(out.split("\r\n")).toHaveLength(crlf.split("\r\n").length - 1);
    expect(/(?<!\r)\n/.test(out)).toBe(false);
    expect(/\r\n[ \t]*\r\n/.test(out)).toBe(false);
    expect(readValues(parse(out))).toEqual(expectedValues(SYN));
  });

  it("keywords sola en su línea: se borra la línea entera; si comparte línea con otro marcado, solo la etiqueta", () => {
    const alone = withRouteHead(base(), SYN);
    expect(alone).not.toMatch(/keywords/);
    expect(alone).not.toMatch(/\n[ \t]*\n/);

    const shared = withRouteHead(
      base({ keywords: '<meta name="keywords" content="k" /><meta name="author" content="a" />' }),
      SYN,
    );
    expect(shared).toContain('    <meta name="author" content="a" />\n');
    expect(shared).not.toMatch(/keywords/);
  });
});

describe("withRouteHead · ignora lo que parece una etiqueta pero no lo es", () => {
  const DECOYS = [
    '<!-- <meta name="description" content="EN COMENTARIO"> <title>c</title> <meta name="keywords" content="k"> -->',
    '<script type="application/ld+json">{"x":"<title>j</title><meta name=\\"keywords\\" content=\\"k\\"><link rel=\\"canonical\\" href=\\"j\\">"}</script>',
    '<style>/* <link rel="canonical" href="s"> <meta property="og:title" content="s"> */</style>',
    '<textarea><meta name="description" content="T"><title>t</title></textarea>',
  ];

  it("comentarios, <script>, <style> y <textarea> no cuentan (ni como repetidas) y salen idénticos", () => {
    const html = base().replace("  </head>", `    ${DECOYS.join("\n    ")}\n  </head>`);

    const out = withRouteHead(html, SYN);

    for (const decoy of DECOYS) expect(out).toContain(decoy);
    expect(out).toContain(`<title>${SYN.title}</title>`);
    expect(out).toContain(`name="description" content="${SYN.description}"`);
    expect(out).not.toContain('<meta name="keywords" content="HOME kw" />');
  });

  it("las etiquetas objetivo solo escritas en comentarios o scripts cuentan como ausentes y lanzan", () => {
    const html = base({ description: null }).replace(
      "  </head>",
      '    <!-- <meta name="description" content="x"> -->\n    <script>"<meta name=\\"description\\" content=\\"x\\">"</script>\n  </head>',
    );
    expect(() => withRouteHead(html, SYN)).toThrow('<meta name="description">');
  });

  it("un «<!--» dentro del valor de un atributo no se toma por un comentario", () => {
    const out = withRouteHead(base({ ogUrl: '<meta property="og:url" content="https://x/?a=<!--b" />' }), SYN);
    expect(out).toContain(`<meta property="og:url" content="${SYN.ogUrl}" />`);
    expect(readValues(parse(out))).toEqual(expectedValues(SYN));
  });
});

// ---------------------------------------------------------------------------
// keywords: opcional
// ---------------------------------------------------------------------------

describe("withRouteHead · <meta name=\"keywords\"> es opcional", () => {
  const LABEL = '<meta name="keywords">';

  it("sin ella no pasa nada: la salida es la misma que cuando la hay y se quita", () => {
    const without = withRouteHead(base({ keywords: null }), SYN);

    expect(without).not.toMatch(/keywords/);
    expect(without).toBe(withRouteHead(base(), SYN));
    expect(readValues(parse(without))).toEqual(expectedValues(SYN));
  });

  it("con una sola, se quita", () => {
    const out = withRouteHead(base(), SYN);

    expect(base()).toContain("keywords");
    expect(out).not.toMatch(/keywords/);
    expect(parse(out).querySelector('meta[name="keywords"]')).toBeNull();
  });

  it("con dos lanza un Error que nombra la etiqueta", () => {
    const html = base({ keywords: twoKeywords() });

    expect(() => withRouteHead(html, SYN)).toThrow(Error);
    expect(() => withRouteHead(html, SYN)).toThrow(LABEL);
  });

  it("una dentro de un comentario no cuenta como segunda: se quita la real y el comentario queda igual", () => {
    const html = base().replace("  </head>", `    <!-- ${target("keywords").line} -->\n  </head>`);

    const out = withRouteHead(html, SYN);

    expect(out).toContain(`<!-- ${target("keywords").line} -->`);
    expect(parse(out).querySelector('meta[name="keywords"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fallos a gritos
// ---------------------------------------------------------------------------

describe("withRouteHead · falla a gritos en vez de emitir una cabecera a medias", () => {
  // keywords es opcional: su ausencia no es un error y se prueba en su propio bloque.
  it.each(REQUIRED_TARGETS.map((t) => [t.label, t] as const))("falta %s: lanza un Error que nombra la etiqueta", (_label, t) => {
    const html = base({ [t.id]: null });
    expect(() => withRouteHead(html, SYN)).toThrow(Error);
    expect(() => withRouteHead(html, SYN)).toThrow(t.label);
  });

  it.each(TARGETS.map((t) => [t.label, t] as const))("%s repetida: lanza un Error que nombra la etiqueta", (_label, t) => {
    const html = base({ [t.id]: `${t.line}\n    ${t.line}` });
    expect(() => withRouteHead(html, SYN)).toThrow(Error);
    expect(() => withRouteHead(html, SYN)).toThrow(t.label);
  });

  it.each(VALUE_TARGETS.map((t) => [t.label, t] as const))(
    "%s sin su atributo de valor: lanza nombrando la etiqueta y el atributo",
    (_label, t) => {
      const without = t.line.replace(new RegExp(`\\s${t.attr}="[^"]*"`), "");
      expect(without).not.toBe(t.line);
      const html = base({ [t.id]: without });
      expect(() => withRouteHead(html, SYN)).toThrow(t.label);
      expect(() => withRouteHead(html, SYN)).toThrow(t.attr!);
    },
  );

  it("un atributo de valor sin «=» (booleano) o repetido también lanza", () => {
    expect(() => withRouteHead(base({ description: '<meta name="description" content />' }), SYN)).toThrow(
      '<meta name="description">',
    );
    expect(() =>
      withRouteHead(base({ description: '<meta name="description" content="a" content="b" />' }), SYN),
    ).toThrow('<meta name="description">');
    expect(() => withRouteHead(base({ canonical: '<link rel="canonical" />' }), SYN)).toThrow('<link rel="canonical">');
  });

  it.each(META_FIELD_NAMES.map((field) => ({ field })))(
    "el campo meta.$field vacío (o solo espacios) lanza un Error con la línea «meta.$field: debe ser un texto no vacío.»",
    ({ field }) => {
      for (const empty of ["", "   \n\t"]) {
        const error = thrownBy(() => withRouteHead(base(), { ...SYN, [field]: empty }));
        expect(error).not.toBeInstanceOf(TypeError);
        expect(error.message).toContain(notTextLine(field));
      }
    },
  );

  // Antes, un valor que no era texto llegaba a escapeHtml y fallaba con un TypeError de `replace` («Cannot
  // read properties of undefined»), sin decir qué campo era. `toThrow(Error)` no lo distingue: un TypeError
  // también es un Error. Estas pruebas exigen el Error con el nombre del campo.
  it.each(META_FIELD_NAMES.map((field) => ({ field })))(
    "meta.$field con un valor que no es texto lanza un Error (no un TypeError) que nombra solo ese campo",
    ({ field }) => {
      for (const [label, bad] of NOT_TEXT) {
        const meta = { ...SYN, [field]: bad } as unknown as RouteMeta;
        const error = thrownBy(() => withRouteHead(base(), meta));
        expect(error, label).toBeInstanceOf(Error);
        expect(error, label).not.toBeInstanceOf(TypeError);
        expect(error.message, label).toContain(notTextLine(field));
        expect(error.message.match(/meta\.\w+:/g), label).toEqual([`meta.${field}:`]);
      }
    },
  );

  it("con un meta vacío ({}) lista los 8 campos, cada uno una vez, en un solo Error", () => {
    const error = thrownBy(() => withRouteHead(base(), {} as RouteMeta));
    expect(error).not.toBeInstanceOf(TypeError);
    for (const field of META_FIELD_NAMES) {
      expect(error.message.split(notTextLine(field)).length - 1, field).toBe(1);
    }
    expect(error.message.match(/meta\.\w+:/g)).toHaveLength(META_FIELD_NAMES.length);
  });

  it("con los 8 campos de otro tipo a la vez los lista todos, también en un solo Error", () => {
    const meta = Object.fromEntries(META_FIELD_NAMES.map((field, i) => [field, NOT_TEXT[i % NOT_TEXT.length][1]]));
    const error = thrownBy(() => withRouteHead(base(), meta as unknown as RouteMeta));
    expect(error).not.toBeInstanceOf(TypeError);
    for (const field of META_FIELD_NAMES) expect(error.message, field).toContain(notTextLine(field));
  });

  it("lista juntos todos los problemas, no solo el primero", () => {
    const html = base({ keywords: twoKeywords(), canonical: null, ogUrl: null });
    let message = "";
    try {
      withRouteHead(html, { ...SYN, ogImage: "" });
    } catch (error) {
      message = (error as Error).message;
    }
    for (const label of ['<meta name="keywords">', '<link rel="canonical">', '<meta property="og:url">', "ogImage"]) {
      expect(message, label).toContain(label);
    }
  });

  it("los campos que no son texto van en la misma lista que los problemas del HTML", () => {
    const html = base({ keywords: twoKeywords(), canonical: null, ogUrl: null });
    const meta = { ...SYN, ogImage: "", title: null, description: 7 } as unknown as RouteMeta;

    const error = thrownBy(() => withRouteHead(html, meta));

    expect(error).not.toBeInstanceOf(TypeError);
    for (const part of [
      notTextLine("ogImage"),
      notTextLine("title"),
      notTextLine("description"),
      '<meta name="keywords">',
      '<link rel="canonical">',
      '<meta property="og:url">',
    ]) {
      expect(error.message, part).toContain(part);
    }
  });

  it("<title> sin </title> de cierre lanza", () => {
    expect(() => withRouteHead(base({ title: "<title>HOME" }), SYN)).toThrow("</title>");
  });

  it("un segundo <title> en el cuerpo (p. ej. dentro de un <svg>) cuenta como repetido y lanza", () => {
    const html = base().replace("<body>", "<body><svg><title>icono</title></svg>");
    expect(() => withRouteHead(html, SYN)).toThrow("<title>");
  });

  it("og:title con property= y otro og:title escrito con name=: el atributo equivocado lanza", () => {
    const html = base({ ogTitle: '<meta property="og:title" content="a" /><meta name="og:title" content="b" />' });
    expect(() => withRouteHead(html, SYN)).toThrow('<meta property="og:title">');
  });

  // El atributo equivocado no se ignora: si la home gana un `<meta name="og:title">`, la ruta heredaría su valor.
  describe.each(KEYED_METAS.map((t) => [t.label, t] as const))("%s con el atributo equivocado", (_label, t) => {
    const wrong = withWrongAttribute(t.line);

    it("junto a la correcta: lanza nombrando la etiqueta", () => {
      const html = base().replace('    <meta property="og:type"', `    ${wrong}\n    <meta property="og:type"`);
      expect(wrong).not.toBe(t.line);
      expect(() => withRouteHead(html, SYN)).toThrow(Error);
      expect(() => withRouteHead(html, SYN)).toThrow(t.label);
    });

    it("en lugar de la correcta: lanza nombrando la etiqueta", () => {
      expect(() => withRouteHead(base({ [t.id]: wrong }), SYN)).toThrow(t.label);
    });
  });

  it("una misma etiqueta que valdría para dos metas (property=og:title y name=twitter:title) lanza en vez de escribir a ciegas", () => {
    const html = base({
      ogTitle: '<meta property="og:title" name="twitter:title" content="a" />',
      twTitle: null,
    });
    expect(() => withRouteHead(html, SYN)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Pureza e idempotencia
// ---------------------------------------------------------------------------

describe("withRouteHead · pureza", () => {
  it("la misma entrada da siempre la misma salida y no modifica el meta (congelado)", () => {
    const meta = Object.freeze({ ...SYN });
    const html = base();
    const first = withRouteHead(html, meta);
    expect(withRouteHead(html, meta)).toBe(first);
    expect(html).toBe(base());
    expect(meta).toEqual(SYN);
  });

  it("aplicar dos veces el mismo meta no acumula nada: con valores especiales la salida es idéntica byte a byte", () => {
    const meta = { ...SYN, title: `A & B <i> "c" 'd' $&`, ogImageAlt: `x"y & $$` };
    const once = withRouteHead(base(), meta);
    // Segunda pasada sobre la salida de la primera, con la etiqueta keywords repuesta como en la home.
    const reKeyworded = once.replace("  </head>", '    <meta name="keywords" content="otra vez" />\n  </head>');
    expect(reKeyworded).not.toBe(once);

    const twice = withRouteHead(reKeyworded, meta);

    expect(twice).toBe(once);
    expect(twice).not.toContain("&amp;amp;");
  });

  it("sobre su propia salida (que ya no trae keywords) devuelve lo mismo: sin keywords no hay nada que quitar", () => {
    const once = withRouteHead(base(), SYN);
    expect(withRouteHead(once, SYN)).toBe(once);
  });
});
