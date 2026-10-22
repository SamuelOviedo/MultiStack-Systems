import { createElement } from "react";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Navbar fuera: las páginas legales se prueban como texto y enlaces, no la barra (que trae auth, tickets y temas).
vi.mock("@/components/common/Navbar", async () => {
  const { createElement: h } = await import("react");
  return { default: () => h("nav", { "data-testid": "navbar-stub" }) };
});

import { ADS_ROUTES } from "@/lib/analytics";
import { routeMetaToPageMeta } from "@/lib/pageMeta";
import { HOME_META, ROUTE_META, SITE_ORIGIN } from "@/lib/routeMeta";
import PoliticaDePrivacidad from "@/pages/legal/PoliticaDePrivacidad";
import TerminosDelServicio from "@/pages/legal/TerminosDelServicio";
import { PAGINAS_WEB_CONTENT } from "@/pages/marketing/paginasWebContent";

// ---------------------------------------------------------------------------
// Archivos reales del repositorio (se leen desde la raíz del proyecto)
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");
const parseHtml = (html: string): Document => new DOMParser().parseFromString(html, "text/html");
const WWW = "https://www.multistacksystems.com";

afterEach(() => {
  cleanup();
});

describe("punto de partida", () => {
  it("las pruebas corren desde la raíz del repositorio (los archivos se buscan desde process.cwd())", () => {
    const pkg = JSON.parse(read("package.json")) as { name: string };
    expect(pkg.name).toBe("multistack-systems");
    expect(existsSync(path.join(ROOT, "index.html"))).toBe(true);
    expect(existsSync(path.join(ROOT, "public", "sitemap.xml"))).toBe(true);
    expect(existsSync(path.join(ROOT, "public", "robots.txt"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// index.html
// ---------------------------------------------------------------------------

/** Memoiza el cálculo para la primera vez que se pida (un fallo al leerlo rompe la prueba que lo usa, no todo el archivo). */
function lazy<T>(factory: () => T): () => T {
  let cached: { value: T } | undefined;
  return () => (cached ??= { value: factory() }).value;
}

const indexRaw = lazy(() => read("index.html"));
const indexDoc = lazy(() => parseHtml(indexRaw()));
const indexJsonLd = lazy(
  () => JSON.parse(indexDoc().querySelector('script[type="application/ld+json"]')!.textContent!) as { url: string; logo: string },
);
const indexMeta = (attr: "name" | "property", key: string): string | null | undefined =>
  indexDoc().querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content");

describe("index.html", () => {
  it("canonical, og:url, og:image, twitter:image y las URL «url» y «logo» del JSON-LD usan el origen con www", () => {
    const urls = {
      canonical: indexDoc().querySelector('link[rel="canonical"]')?.getAttribute("href"),
      "og:url": indexMeta("property", "og:url"),
      "og:image": indexMeta("property", "og:image"),
      "twitter:image": indexMeta("name", "twitter:image"),
      "JSON-LD url": indexJsonLd().url,
      "JSON-LD logo": indexJsonLd().logo,
    };
    for (const [name, value] of Object.entries(urls)) {
      expect(value, name).toBeTruthy();
      expect(value!.startsWith(WWW), `${name}: ${value}`).toBe(true);
      expect(new URL(value!).origin, name).toBe(WWW);
    }
  });

  it("<meta name=\"referrer\" content=\"strict-origin\"> existe una sola vez y es lo primero del head tras <meta charset>", () => {
    const referrers = indexDoc().querySelectorAll('meta[name="referrer"]');
    expect(referrers).toHaveLength(1);
    expect(referrers[0].getAttribute("content")).toBe("strict-origin");

    const head = Array.from(indexDoc().head.children);
    expect(head[0].tagName).toBe("META");
    expect(head[0].hasAttribute("charset")).toBe(true);
    expect(head[1]).toBe(referrers[0]);
  });

  it("no lleva la etiqueta de Google en el HTML: ni gtag, ni googletagmanager, ni dataLayer, ni un ID AW-<dígitos>", () => {
    expect(indexRaw()).not.toMatch(/gtag/i);
    expect(indexRaw()).not.toMatch(/googletagmanager/i);
    expect(indexRaw()).not.toMatch(/datalayer/i);
    expect(indexRaw()).not.toMatch(new RegExp("\\bAW-\\d", "i"));
    // La etiqueta se inyecta desde src/lib/analytics.ts solo en las rutas públicas: ningún <script src> externo aquí.
    for (const script of Array.from(indexDoc().querySelectorAll("script[src]"))) {
      expect(script.getAttribute("src"), "script externo").not.toMatch(/^(https?:)?\/\//);
    }
  });

  it("conserva el posicionamiento de IA y automatización de la home en title, description y og:title", () => {
    for (const [name, value] of [
      ["title", indexDoc().title],
      ["description", indexMeta("name", "description")],
      ["og:title", indexMeta("property", "og:title")],
    ] as const) {
      expect(value, name).toMatch(/\bIA\b/);
      expect(value, name).toMatch(/automatizaci[oó]n/i);
      expect(value, name).not.toMatch(/p[aá]ginas? web/i);
    }
  });

  it("la home sigue siendo indexable: sin robots noindex", () => {
    const robots = indexDoc().querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
    expect(robots).not.toMatch(/noindex|nofollow|none/i);
  });
});

describe("index.html · archivos locales que enlaza", () => {
  /** Rutas dentro de public/ que index.html nombra: <link href="/…">, imagen social y logo del JSON-LD. */
  const localPaths = (): string[] => {
    const found = new Set<string>();
    for (const el of Array.from(indexDoc().querySelectorAll("link[href]"))) {
      const href = el.getAttribute("href")!;
      if (href.startsWith("/") && !href.startsWith("//")) found.add(href);
    }
    for (const absolute of [indexMeta("property", "og:image"), indexMeta("name", "twitter:image"), indexJsonLd().logo]) {
      if (absolute?.startsWith(WWW)) found.add(new URL(absolute).pathname);
    }
    return [...found];
  };

  it("favicons, manifest, imagen social y logo existen en public/", () => {
    const paths = localPaths();
    expect(paths.length).toBeGreaterThanOrEqual(6);
    for (const urlPath of paths) {
      expect(existsSync(path.join(ROOT, "public", ...urlPath.split("/").filter(Boolean))), urlPath).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// vercel.json: ningún redirect ni rewrite toca la landing, salvo la regla general del SPA
// ---------------------------------------------------------------------------

interface VercelRule {
  source: string;
  destination?: string;
  has?: Array<{ type: string; value?: string }>;
}
interface VercelConfig {
  rewrites?: VercelRule[];
  redirects?: VercelRule[];
}

/** La regla general del SPA: a ella llega todo lo que no es un archivo estático. */
const GENERAL_REWRITE = { source: "/(.*)", destination: "/index.html" } as const;
/** Las tres formas de pedir la landing: la que declaran el canonical y el sitemap, con barra final y con su archivo. */
const LANDING_PATHS = ["/paginas-web", "/paginas-web/", "/paginas-web/index.html"] as const;

/**
 * ¿Coincide el `source` de una regla (sintaxis path-to-regexp de Vercel) con esta ruta? Cubre lo que se escribe en la
 * práctica: literales, :nombre con sus modificadores * + ?, grupos (regex) y \ para escapar.
 */
function sourceMatches(source: string, pathname: string): boolean {
  let pattern = "";
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\\") {
      pattern += `\\${source[++i] ?? ""}`;
    } else if (ch === "(") {
      let depth = 0;
      let end = i;
      for (; end < source.length; end++) {
        if (source[end] === "\\") end++;
        else if (source[end] === "(") depth++;
        else if (source[end] === ")" && --depth === 0) break;
      }
      pattern += source.slice(i, end + 1);
      i = end;
      if ("*+?".includes(source[i + 1] ?? "-")) pattern += source[++i];
    } else if (ch === ":" && /^:[A-Za-z_]\w*/.test(source.slice(i))) {
      i += /^:[A-Za-z_]\w*/.exec(source.slice(i))![0].length - 1;
      const modifier = source[i + 1];
      if (modifier === "*") pattern += ".*";
      else if (modifier === "+") pattern += ".+";
      else if (modifier === "?") pattern += "[^/]*";
      else if (modifier !== "(") pattern += "[^/]+";
      if (modifier === "*" || modifier === "+" || modifier === "?") i++;
    } else {
      pattern += /[.*+?^${}|[\]]/.test(ch) ? `\\${ch}` : ch;
    }
  }
  return new RegExp(`^${pattern}$`).test(pathname);
}

/**
 * Las reglas, aparte de la general del SPA, cuyo `source` alcanza la landing. Una regla con condición de host solo
 * actúa en ese host (así se escribe la redirección del dominio sin www al de www, que nunca llega al host del canonical)
 * y no cuenta.
 */
function rulesReachingLanding(vercelConfig: VercelConfig): string[] {
  const rules = [
    ...(vercelConfig.rewrites ?? []).map((rule) => ({ kind: "rewrites", rule })),
    ...(vercelConfig.redirects ?? []).map((rule) => ({ kind: "redirects", rule })),
  ];
  return rules
    .filter(({ kind, rule }) => !(kind === "rewrites" && rule.source === GENERAL_REWRITE.source && rule.destination === GENERAL_REWRITE.destination))
    .filter(({ rule }) => !(rule.has ?? []).some((condition) => condition.type === "host"))
    .filter(({ rule }) => LANDING_PATHS.some((landingPath) => sourceMatches(rule.source, landingPath)))
    .map(({ kind, rule }) => `${kind}: ${rule.source} → ${rule.destination}`);
}

describe("vercel.json", () => {
  const vercel = () => JSON.parse(read("vercel.json")) as VercelConfig;

  it("sigue teniendo la regla general del SPA: /(.*) hacia /index.html", () => {
    expect(vercel().rewrites).toEqual(expect.arrayContaining([GENERAL_REWRITE]));
  });

  it("ninguna otra regla (de redirects o de rewrites) alcanza /paginas-web, /paginas-web/ ni /paginas-web/index.html", () => {
    expect(rulesReachingLanding(vercel())).toEqual([]);
  });

  it("el comprobador acepta otros redirects y la redirección del dominio sin www al de www, y señala lo que sí toca la landing", () => {
    const apexToWww: VercelRule = {
      source: "/(.*)",
      has: [{ type: "host", value: "multistacksystems.com" }],
      destination: "https://www.multistacksystems.com/$1",
    };
    const unrelated: VercelRule = { source: "/blog/:slug", destination: "/" };
    expect(rulesReachingLanding({ rewrites: [GENERAL_REWRITE], redirects: [apexToWww, unrelated] })).toEqual([]);
    // La excepción es la regla general como rewrite: la misma regla escrita como redirect sí cuenta.
    expect(rulesReachingLanding({ redirects: [GENERAL_REWRITE] })).toHaveLength(1);

    for (const rule of [
      { source: "/paginas-web", destination: "/" },
      { source: "/paginas-web/", destination: "/" },
      { source: "/paginas-web/index.html", destination: "/" },
      { source: "/:path*", destination: "/inicio" },
      { source: "/(.*)", destination: "/otra.html" },
    ]) {
      expect(rulesReachingLanding({ redirects: [rule] }), `redirects ${rule.source}`).toHaveLength(1);
      expect(rulesReachingLanding({ rewrites: [rule] }), `rewrites ${rule.source}`).toHaveLength(1);
    }
  });

  it("el comparador de rutas entiende las formas de source que usa Vercel", () => {
    for (const [source, pathname] of [
      ["/(.*)", "/paginas-web"],
      ["/paginas-web", "/paginas-web"],
      ["/:path*", "/paginas-web/"],
      ["/:path+", "/paginas-web/index.html"],
      ["/paginas-web/(.*)", "/paginas-web/index.html"],
      ["/(paginas-web|inicio)", "/paginas-web"],
      ["/paginas-:slug", "/paginas-web"],
      ["/paginas-web\\/", "/paginas-web/"],
    ]) {
      expect(sourceMatches(source, pathname), `${source} con ${pathname}`).toBe(true);
    }
    for (const [source, pathname] of [
      ["/about", "/paginas-web"],
      ["/blog/:slug", "/paginas-web"],
      ["/paginas-web/(.*)", "/paginas-web"],
      ["/paginas-webinar", "/paginas-web"],
      ["/paginas-web.html", "/paginas-web"],
    ]) {
      expect(sourceMatches(source, pathname), `${source} con ${pathname}`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// HOME_META es el espejo de index.html
// ---------------------------------------------------------------------------

describe("HOME_META coincide con las metas reales de index.html", () => {
  const FIELDS = [
    ["title", () => indexDoc().title, HOME_META.title],
    ["description", () => indexMeta("name", "description"), HOME_META.description],
    ["canonical", () => indexDoc().querySelector('link[rel="canonical"]')?.getAttribute("href"), HOME_META.canonical],
    ["og:title", () => indexMeta("property", "og:title"), HOME_META.ogTitle],
    ["og:description", () => indexMeta("property", "og:description"), HOME_META.ogDescription],
    ["og:url", () => indexMeta("property", "og:url"), HOME_META.ogUrl],
    ["og:image", () => indexMeta("property", "og:image"), HOME_META.ogImage],
    ["og:image:alt", () => indexMeta("property", "og:image:alt"), HOME_META.ogImageAlt],
    ["twitter:title", () => indexMeta("name", "twitter:title"), HOME_META.ogTitle],
    ["twitter:description", () => indexMeta("name", "twitter:description"), HOME_META.ogDescription],
    ["twitter:image", () => indexMeta("name", "twitter:image"), HOME_META.ogImage],
    ["twitter:image:alt", () => indexMeta("name", "twitter:image:alt"), HOME_META.ogImageAlt],
  ] as const;

  it.each(FIELDS.map(([name, readValue, expected]) => [name, readValue, expected] as const))(
    "%s",
    (_name, readValue, expected) => {
      expect(readValue()).toBe(expected);
    },
  );

  it("y la lista que restaura la landing al salir (routeMetaToPageMeta(HOME_META)) es la misma que la del HTML", () => {
    const restore = routeMetaToPageMeta(HOME_META);
    expect(restore.title).toBe(indexDoc().title);
    expect(restore.description).toBe(indexMeta("name", "description"));
    expect(restore.canonical).toBe(indexDoc().querySelector('link[rel="canonical"]')?.getAttribute("href"));
    for (const [attr, key, value] of restore.extra ?? []) expect(indexMeta(attr, key), `${attr}="${key}"`).toBe(value);
  });
});

// ---------------------------------------------------------------------------
// Nada de dominio sin www
// ---------------------------------------------------------------------------

describe("el dominio sin www no aparece como URL", () => {
  // https://multistacksystems.com, http://… o //multistacksystems.com (un correo @multistacksystems.com no cuenta).
  const APEX_URL = /(?:https?:)?\/\/multistacksystems\.com\b/gi;

  // Los archivos de datos se leen tal cual; el código (rutas, contenido, páginas legales) se comprueba por lo que
  // entrega y por lo que se ve, no por su texto fuente.
  it.each(["index.html", "public/sitemap.xml", "public/robots.txt"])(
    "%s no contiene ninguna URL de multistacksystems.com sin www",
    (file) => {
      expect(read(file).match(APEX_URL) ?? []).toEqual([]);
    },
  );

  it("el origen del sitio, las metas de la home y de las rutas y el contenido de la landing no traen ninguna", () => {
    const values = JSON.stringify([SITE_ORIGIN, HOME_META, ROUTE_META, PAGINAS_WEB_CONTENT]);
    expect(values.match(APEX_URL) ?? []).toEqual([]);
    expect(values).toContain(WWW);
  });

  it.each([
    ["Política de Privacidad", PoliticaDePrivacidad],
    ["Términos del Servicio", TerminosDelServicio],
  ])("%s: ningún enlace de la página apunta al dominio sin www", (_name, Page) => {
    render(createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Page)));

    const hrefs = Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((href) => href.match(APEX_URL) !== null)).toEqual([]);
  });

  it("el detector sí reconoce la URL sin www y no confunde el correo ni el host con www", () => {
    expect("ver https://multistacksystems.com/x".match(APEX_URL)).toHaveLength(1);
    expect("ver http://multistacksystems.com".match(APEX_URL)).toHaveLength(1);
    expect("ver //multistacksystems.com".match(APEX_URL)).toHaveLength(1);
    expect("escríbenos a alguien@multistacksystems.com".match(APEX_URL)).toBeNull();
    expect("https://www.multistacksystems.com/x".match(APEX_URL)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/** Reglas de `User-agent: *`: lo mínimo de robots.txt que necesitamos (Allow, Disallow y Sitemap). */
function parseRobots(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter(Boolean);
  const value = (name: string) =>
    lines.filter((l) => l.toLowerCase().startsWith(`${name.toLowerCase()}:`)).map((l) => l.slice(l.indexOf(":") + 1).trim());
  const disallow = value("Disallow");
  return {
    userAgents: value("User-agent"),
    allow: value("Allow"),
    disallow,
    sitemaps: value("Sitemap"),
    /** true si algún Disallow no vacío es prefijo de la ruta. */
    blocks: (urlPath: string) => disallow.some((rule) => rule !== "" && urlPath.startsWith(rule)),
  };
}

describe("public/robots.txt", () => {
  const robots = parseRobots(read("public/robots.txt"));

  it("la línea Sitemap apunta a https://www.multistacksystems.com/sitemap.xml, y es la única", () => {
    expect(robots.sitemaps).toEqual(["https://www.multistacksystems.com/sitemap.xml"]);
    expect(existsSync(path.join(ROOT, "public", "sitemap.xml"))).toBe(true);
  });

  it("conserva el bloqueo de las rutas internas: /dashboard, /solicitudes, /login, /signup, /auth/ y /client/", () => {
    expect(robots.userAgents).toContain("*");
    for (const rule of ["/dashboard", "/solicitudes", "/login", "/signup", "/auth/", "/client/"]) {
      expect(robots.disallow, rule).toContain(rule);
    }
  });

  it("no bloquea las páginas públicas ni los archivos de los que dependen (ni la landing del anuncio)", () => {
    expect(robots.allow).toContain("/");
    for (const urlPath of [
      "/",
      "/paginas-web",
      "/paginas-web/",
      "/politica-de-privacidad",
      "/terminos-del-servicio",
      "/sitemap.xml",
      "/assets/index-abc123.js",
      "/assets/images/og/og-ai.1200x630.png",
    ]) {
      expect(robots.blocks(urlPath), urlPath).toBe(false);
    }
  });

  it("el analizador sí detecta una ruta bloqueada", () => {
    const sample = parseRobots("User-agent: *\nDisallow: /paginas-web\nDisallow:\n");
    expect(sample.blocks("/paginas-web")).toBe(true);
    expect(sample.blocks("/")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// sitemap.xml
// ---------------------------------------------------------------------------

describe("public/sitemap.xml", () => {
  const parseXml = (xml: string): Document => new DOMParser().parseFromString(xml, "application/xml");
  const isWellFormed = (doc: Document): boolean => doc.getElementsByTagName("parsererror").length === 0;

  const xml = read("public/sitemap.xml");
  const doc = parseXml(xml);
  const urls = Array.from(doc.getElementsByTagName("url"));
  const locs = Array.from(doc.getElementsByTagName("loc")).map((el) => el.textContent ?? "");

  it("es XML bien formado de tipo urlset (y el detector sí rechaza XML mal formado)", () => {
    expect(isWellFormed(doc)).toBe(true);
    expect(doc.documentElement.localName).toBe("urlset");
    expect(doc.documentElement.namespaceURI).toBe("http://www.sitemaps.org/schemas/sitemap/0.9");
    expect(isWellFormed(parseXml("<urlset><url><loc>x</url></urlset>"))).toBe(false);
  });

  it("todas las <loc> usan https y el origen con www, sin repetirse", () => {
    expect(locs.length).toBeGreaterThanOrEqual(2);
    for (const loc of locs) {
      expect(loc, loc).toBe(loc.trim());
      expect(loc.startsWith(`${WWW}/`), loc).toBe(true);
      expect(new URL(loc).origin, loc).toBe(WWW);
    }
    expect(new Set(locs).size).toBe(locs.length);
    expect(urls).toHaveLength(locs.length);
  });

  it("incluye la home y /paginas-web", () => {
    expect(locs).toContain("https://www.multistacksystems.com/");
    expect(locs).toContain("https://www.multistacksystems.com/paginas-web");
  });

  it("la <loc> de cada ruta con metas propias coincide con su canonical (ROUTE_META)", () => {
    expect(Object.keys(ROUTE_META)).toContain("/paginas-web");
    for (const [route, meta] of Object.entries(ROUTE_META)) {
      expect(locs, route).toContain(meta.canonical);
      expect(meta.canonical, route).toBe(`${SITE_ORIGIN}${route}`);
    }
  });

  it("cada <url> trae lastmod con fecha AAAA-MM-DD y priority entre 0 y 1", () => {
    for (const url of urls) {
      const field = (name: string) => url.getElementsByTagName(name)[0]?.textContent?.trim() ?? "";
      expect(field("lastmod"), field("loc")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(field("lastmod"))), field("loc")).toBe(false);
      const priority = Number(field("priority"));
      expect(priority, field("loc")).toBeGreaterThanOrEqual(0);
      expect(priority, field("loc")).toBeLessThanOrEqual(1);
    }
  });

  it("ninguna URL del sitemap está bloqueada por robots.txt", () => {
    const robots = parseRobots(read("public/robots.txt"));
    for (const loc of locs) expect(robots.blocks(new URL(loc).pathname), loc).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Ningún ID real de Google Ads en el repositorio
// ---------------------------------------------------------------------------

describe("ningún ID real de Google Ads en el repositorio", () => {
  /** El único ID que puede aparecer en cualquier archivo: el de prueba que usan la documentación y los tests. */
  const ALLOWED = "AW-1000000000";
  // Armada con new RegExp para que este archivo no contenga ninguna coincidencia literal prohibida.
  const AD_ID = () => new RegExp("\\bAW-\\d{6,}", "gi");

  /**
   * Los tests que prueban los límites del formato (6 y 15 dígitos válidos, 16 inválido, minúsculas, un ID de
   * etiqueta distinto del de la conversión) necesitan ID con otra forma que AW-1000000000. En los archivos de
   * test se aceptan además los ID evidentemente sintéticos: un dígito seguido de ceros (2000000000) o una
   * escalera 1234567890… Un ID real no tiene esa forma. Quien prefiera la regla estricta (solo AW-1000000000
   * también en tests) puede armar esos ID en tiempo de ejecución y dejar este atajo en false.
   */
  const ALLOW_SYNTHETIC_IDS_IN_TESTS = true;
  const isTestFile = (file: string) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
  const isSynthetic = (id: string) => {
    const digits = id.slice(3);
    return /^[1-9]0+$/.test(digits) || "12345678901234567890".startsWith(digits);
  };
  const isAllowed = (id: string, file: string) =>
    id === ALLOWED || (ALLOW_SYNTHETIC_IDS_IN_TESTS && isTestFile(file) && isSynthetic(id));
  const idsIn = (text: string): string[] => text.match(AD_ID()) ?? [];

  const TEXT_EXTENSIONS = new Set([
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".md", ".mdx", ".html", ".css", ".xml",
    ".txt", ".svg", ".webmanifest", ".yml", ".yaml", ".toml", ".sql", ".sh", ".ps1", ".py", ".csv",
  ]);
  const SKIPPED_DIRS = new Set(["node_modules", "dist", ".git"]);
  const MAX_BYTES = 3 * 1024 * 1024;

  /** Archivos de texto bajo `dir`, sin node_modules, dist, .git, carpetas ocultas ni archivos .env. */
  function walk(dir: string, found: string[] = []): string[] {
    if (!existsSync(dir)) return found;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, found);
      else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        if (statSync(full).size <= MAX_BYTES) found.push(full);
      }
    }
    return found;
  }

  const rootFiles = readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isFile() && !e.name.startsWith(".") && !/\.local\./i.test(e.name))
    .filter((e) => TEXT_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(ROOT, e.name));
  const scanned = [
    ...["src", "public", "build", "docs", "e2e", "scripts", "supabase", "specs"].flatMap((dir) => walk(path.join(ROOT, dir))),
    ...walk(path.join(ROOT, ".github")),
    ...rootFiles,
  ];
  const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");

  it("el barrido recorre src/, public/, build/, docs/ e index.html (y los tests de este repo)", () => {
    const names = scanned.map(rel);
    expect(names).toEqual(
      expect.arrayContaining([
        "index.html",
        "public/sitemap.xml",
        "src/App.tsx",
        "src/test/seo-files.test.ts",
        "build/routeHeadPlugin.ts",
      ]),
    );
    expect(names.some((n) => n.startsWith("docs/"))).toBe(true);
    expect(names.length).toBeGreaterThan(100);
    expect(names.some((n) => n.split("/").some((part) => part === "node_modules" || part === "dist"))).toBe(false);
    expect(names.some((n) => /(^|\/)\.env/.test(n))).toBe(false);
  });

  it("el detector reconoce un ID con forma de real y deja pasar solo el de prueba", () => {
    // Los ID de ejemplo se arman con plantillas para que este archivo no contenga ninguno literal.
    const realLooking = [`AW-${"843276518"}`, `AW-${"10849388561"}`, `AW-${"1000000001"}`];
    const flagged = (text: string, file: string) => idsIn(text).filter((id) => !isAllowed(id, file));
    for (const id of realLooking) {
      expect(flagged(`gtag('config', '${id}')`, "src/lib/x.ts"), id).toEqual([id]);
      expect(flagged(`gtag('config', '${id}')`, "src/test/x.test.ts"), id).toEqual([id]);
    }
    expect(flagged("id=AW-1000000000", "src/lib/x.ts")).toEqual([]);
    expect(flagged("AW-1000000000/PRUEBA", "docs/x.md")).toEqual([]);
    expect(flagged("AW-<dígitos> y AW-XXXXXXXXXX", "docs/x.md")).toEqual([]);
    // Fuera de los tests no se acepta ni un ID sintético; dentro de ellos sí.
    const synthetic = `AW-${"2000000000"}`;
    expect(flagged(synthetic, "src/lib/x.ts")).toEqual([synthetic]);
    expect(flagged(synthetic, "src/test/x.test.tsx")).toEqual([]);
  });

  it("no hay ningún AW-<dígitos> salvo AW-1000000000 (en los tests, también los evidentemente sintéticos)", () => {
    const offenders: string[] = [];
    for (const file of scanned) {
      for (const id of idsIn(readFileSync(file, "utf8"))) {
        if (!isAllowed(id, file)) offenders.push(`${rel(file)}: ${id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("fuera de los tests solo aparece AW-1000000000 (estricto)", () => {
    const strict: string[] = [];
    for (const file of scanned.filter((f) => !isTestFile(f))) {
      for (const id of idsIn(readFileSync(file, "utf8"))) {
        if (id !== ALLOWED) strict.push(`${rel(file)}: ${id}`);
      }
    }
    expect(strict).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Política de Privacidad
// ---------------------------------------------------------------------------

describe("Política de Privacidad · medición de Google Ads", () => {
  const normalize = (text: string | null | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

  function renderPolicy() {
    return render(createElement(MemoryRouter, { initialEntries: ["/politica-de-privacidad"] }, createElement(PoliticaDePrivacidad)));
  }
  const paragraphs = () => Array.from(document.querySelectorAll("p"));
  /** El primer párrafo cuyo texto cumple todos los patrones. */
  const paragraphWith = (...patterns: RegExp[]) =>
    paragraphs().find((p) => patterns.every((pattern) => pattern.test(normalize(p.textContent))));

  it("menciona la medición de Google Ads en su propio apartado", () => {
    renderPolicy();

    const headings = Array.from(document.querySelectorAll("h2, h3")).map((h) => normalize(h.textContent));
    expect(headings.some((h) => /Google Ads/.test(h)), headings.join(" | ")).toBe(true);
    expect(normalize(document.body.textContent)).toMatch(/etiqueta de conversiones de Google Ads/);
  });

  it("dice dónde se carga: la página de inicio, /paginas-web, la Política de Privacidad y los Términos del Servicio", () => {
    renderPolicy();

    const where = paragraphWith(/\/paginas-web/);
    expect(where, "párrafo que nombra /paginas-web").toBeDefined();
    const text = normalize(where!.textContent);
    expect(text).toMatch(/inicio/i);
    expect(text).toMatch(/Pol[ií]tica de Privacidad/);
    expect(text).toMatch(/T[eé]rminos del Servicio/);
    expect(text).toMatch(/p[uú]blicas/i);
  });

  it("nombra todas las rutas donde la etiqueta se carga (ADS_ROUTES): si se agrega una ruta, hay que actualizar la política", () => {
    renderPolicy();
    const text = normalize(paragraphWith(/\/paginas-web/)!.textContent);
    const mention: Record<string, RegExp> = {
      "/": /inicio/i,
      "/paginas-web": /\/paginas-web/,
      "/politica-de-privacidad": /Pol[ií]tica de Privacidad/,
      "/terminos-del-servicio": /T[eé]rminos del Servicio/,
    };
    for (const route of ADS_ROUTES) {
      expect(mention[route], `la política no sabe describir la ruta ${route}`).toBeDefined();
      expect(text, route).toMatch(mention[route]);
    }
    expect(Object.keys(mention).sort()).toEqual([...ADS_ROUTES].sort());
  });

  it("afirma que NO se envían nombre, correo, teléfono ni mensaje", () => {
    renderPolicy();

    const sentence = paragraphWith(/nombre/i, /correo/i, /tel[eé]fono/i, /mensaje/i);
    expect(sentence, "párrafo que habla de nombre, correo, teléfono y mensaje").toBeDefined();
    const text = normalize(sentence!.textContent);
    expect(text).toMatch(/\bno\b[^.]*\bnombre\b[^.]*\bcorreo\b[^.]*\btel[eé]fono\b[^.]*\bmensaje\b/i);
    // Y ese «NO» está resaltado, como en el resto de la política.
    const negation = Array.from(sentence!.querySelectorAll("strong")).map((s) => normalize(s.textContent));
    expect(negation).toContain("NO");
  });

  it("aclara que la etiqueta tampoco se carga con una sesión iniciada", () => {
    renderPolicy();

    expect(normalize(document.body.textContent)).toMatch(/(no|tampoco) se carga[^.]*sesi[oó]n iniciada/i);
  });

  it("lleva la cabecera «Versión 1.1»", () => {
    renderPolicy();

    const header = document.querySelector("header")!;
    expect(normalize(header.textContent)).toMatch(/Versi[oó]n 1\.1/);
    expect(header.querySelector("h1")).toHaveTextContent("Política de Privacidad");
  });

  it("la fila de Google LLC menciona Google Fonts y la medición de conversiones", () => {
    renderPolicy();

    const row = Array.from(document.querySelectorAll("tr")).find((tr) => /Google LLC/.test(tr.textContent ?? ""));
    expect(row, "fila de Google LLC").toBeDefined();
    const text = normalize(row!.textContent);
    expect(text).toMatch(/Google Fonts/);
    expect(text).toMatch(/medici[oó]n de conversiones/i);
    expect(text).toMatch(/Google Ads/);
  });

  it("enlaza la explicación de Google sobre publicidad, en pestaña nueva y con noopener noreferrer", () => {
    renderPolicy();

    const link = document.querySelector('a[href="https://policies.google.com/technologies/ads"]');
    expect(link, "enlace a policies.google.com/technologies/ads").not.toBeNull();
    const rel = (link!.getAttribute("rel") ?? "").split(/\s+/);
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    expect(link).toHaveAttribute("target", "_blank");
    expect(normalize(link!.textContent)).not.toBe("");
  });

  it("todos los enlaces externos de la política abren con noopener noreferrer", () => {
    renderPolicy();

    const external = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href^='http']"));
    expect(external.length).toBeGreaterThanOrEqual(3);
    for (const link of external) {
      expect((link.getAttribute("rel") ?? "").split(/\s+/), link.href).toEqual(expect.arrayContaining(["noopener", "noreferrer"]));
    }
  });

  // -------------------------------------------------------------------------
  // Apartado 2.5: qué guarda la etiqueta en el navegador y qué envía. Es texto legal que revisa el propietario,
  // así que se fijan HECHOS (nombres, duraciones, dominios, parámetros) con expresiones tolerantes a la
  // redacción, nunca frases enteras. Cada hecho se busca en la misma «unidad» (un párrafo o un elemento de
  // lista) que lo acompaña, sin exigir el orden ni las palabras de enlace.
  // -------------------------------------------------------------------------
  describe("apartado 2.5 · cookies, almacenamiento local y parámetros", () => {
    /** Los párrafos y los elementos de lista del apartado de Google Ads, en orden de lectura. */
    function adsUnits(): Element[] {
      const heading = Array.from(document.querySelectorAll("h3")).find((h) => {
        const text = normalize(h.textContent);
        return /Google Ads/.test(text) || /^2\.5\b/.test(text);
      });
      expect(heading, "subtítulo del apartado de medición de Google Ads (2.5)").toBeDefined();
      const units: Element[] = [];
      for (let el = heading!.nextElementSibling; el && !/^H[1-6]$/.test(el.tagName); el = el.nextElementSibling) {
        if (el.tagName === "P") units.push(el);
        else if (el.tagName === "UL" || el.tagName === "OL") units.push(...Array.from(el.querySelectorAll("li")));
      }
      expect(units.length, "párrafos y elementos de lista del apartado 2.5").toBeGreaterThanOrEqual(5);
      return units;
    }
    const textOf = (unit: Element) => normalize(unit.textContent);
    /** El nombre como palabra completa: _gcl_au no debe darse por encontrado dentro de otro nombre. */
    const token = (name: string) => new RegExp(`(?<![\\w])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`);
    const unitWith = (units: Element[], ...patterns: RegExp[]) =>
      units.find((unit) => patterns.every((pattern) => pattern.test(textOf(unit))));

    const OWN_DOMAIN_COOKIES = ["_gcl_au", "_gcl_aw", "_gcl_ag", "_gcl_gb", "_gcl_gs"] as const;
    const GOOGLE_DOMAIN_COOKIE = "GCL_AW_P";
    const LOCAL_STORAGE_ITEM = "_gcl_ls";
    const CLICK_IDENTIFIERS = ["gclid", "gbraid", "wbraid", "gad_source"] as const;

    it.each([...OWN_DOMAIN_COOKIES, LOCAL_STORAGE_ITEM, GOOGLE_DOMAIN_COOKIE])("nombra %s", (name) => {
      renderPolicy();

      expect(unitWith(adsUnits(), token(name)), `${name} en el apartado 2.5`).toBeDefined();
    });

    it("presenta _gcl_au, _gcl_aw, _gcl_ag, _gcl_gb y _gcl_gs como cookies de nuestro dominio", () => {
      renderPolicy();
      const units = adsUnits();

      for (const name of OWN_DOMAIN_COOKIES) {
        const unit = unitWith(units, token(name));
        expect(unit, name).toBeDefined();
        expect(textOf(unit!), name).toMatch(/cookies?/i);
        expect(textOf(unit!), name).toMatch(/(nuestro|propio|este)\s+(dominio|sitio)|primera parte/i);
      }
    });

    it("presenta _gcl_ls como almacenamiento local del navegador", () => {
      renderPolicy();

      const unit = unitWith(adsUnits(), token(LOCAL_STORAGE_ITEM));
      expect(unit, LOCAL_STORAGE_ITEM).toBeDefined();
      expect(textOf(unit!)).toMatch(/almacenamiento (local|del navegador)|local ?storage/i);
    });

    it("presenta GCL_AW_P como cookie de los dominios de Google: google.com, doubleclick.net y googleadservices.com", () => {
      renderPolicy();

      const unit = unitWith(adsUnits(), token(GOOGLE_DOMAIN_COOKIE));
      expect(unit, GOOGLE_DOMAIN_COOKIE).toBeDefined();
      const text = textOf(unit!);
      expect(text).toMatch(/cookie/i);
      for (const domain of ["google.com", "doubleclick.net", "googleadservices.com"]) {
        expect(text, domain).toMatch(token(domain));
      }
    });

    it("dice «90 días» y no menciona ninguna otra duración", () => {
      renderPolicy();

      const text = adsUnits().map(textOf).join(" ");
      expect(text).toMatch(/\b90 d[ií]as\b/);
      const durations = [...text.matchAll(/(\d+)\s+d[ií]as/g)].map((match) => match[1]);
      expect(durations.length).toBeGreaterThan(0);
      expect([...new Set(durations)]).toEqual(["90"]);
    });

    it("dice que la conversión se informa también por dominios de país de Google", () => {
      renderPolicy();

      const unit = unitWith(adsUnits(), /dominios?/i, /pa[ií]s/i, /Google/);
      expect(unit, "unidad con «dominios», «país» y «Google»").toBeDefined();
      // Y la misma unidad nombra los dominios generales de Google (no solo el de país).
      expect(textOf(unit!)).toMatch(/googleadservices\.com|doubleclick\.net|google\.com/);
    });

    it("la dirección se envía «sin parámetros» y los identificadores gclid, gbraid, wbraid y gad_source se nombran en ese mismo párrafo", () => {
      renderPolicy();

      const unit = unitWith(adsUnits(), /sin par[aá]metros/i);
      expect(unit, "párrafo con «sin parámetros»").toBeDefined();
      for (const identifier of CLICK_IDENTIFIERS) {
        expect(textOf(unit!), identifier).toMatch(token(identifier));
      }
    });

    it("no vuelve a decir que solo se conserva un identificador de clic (se envían cuatro)", () => {
      renderPolicy();

      const text = adsUnits().map(textOf).join(" ");
      expect(text).not.toMatch(/solo se conserva/i);
      expect(text).not.toMatch(/\bel identificador de clic que Google Ads agrega\b/i);
    });

    it("la frase de borrado cubre las cookies y también el almacenamiento local", () => {
      renderPolicy();

      const sentences = adsUnits().flatMap((unit) => textOf(unit).split(/(?<=[.;!?])\s+/));
      const deletion = sentences.find((sentence) => /\b(bloquear|borrar|eliminar)\b/i.test(sentence) && /cookies/i.test(sentence));
      expect(deletion, "frase que habla de bloquear o borrar las cookies").toBeDefined();
      expect(deletion).toMatch(/almacenamiento local/i);
    });

    it("el apartado sigue diciendo qué NO se envía y dónde NO se carga (no se pierde al reescribirlo)", () => {
      renderPolicy();

      const text = adsUnits().map(textOf).join(" ");
      expect(text).toMatch(/\bno\b[^.]*\bnombre\b[^.]*\bcorreo\b[^.]*\btel[eé]fono\b[^.]*\bmensaje\b/i);
      expect(text).toMatch(/(no|tampoco) se carga[^.]*sesi[oó]n iniciada/i);
      expect(text).toMatch(/remarketing/i);
    });
  });
});
