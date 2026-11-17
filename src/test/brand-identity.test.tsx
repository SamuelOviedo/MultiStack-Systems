// Identidad oficial en el sitio: el logo compartido (variantes por tamaño, un solo nombre accesible, tema), que nada
// activo apunte ya a la marca anterior, y que iconos, manifiesto e imágenes sociales existan con las dimensiones
// esperadas. Lo del panel administrador (BrandMark) lo cubre admin-brand.test; los metadatos generales, seo-files.test.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Logo from "@/components/common/Logo";
import { OG_IMAGES } from "@/lib/routeMeta";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

const ROOT = path.resolve(__dirname, "..", "..");
const PUBLIC = path.join(ROOT, "public");
// Armados por partes: este archivo es la lista blanca y no debe disparar su propia búsqueda en otros barridos.
const LEGACY = [["logo", "white"], ["logo", "black"]].map(([a, b]) => `${a}-${b}.png`);

/** Ancho y alto de un PNG leídos de su cabecera IHDR (bytes 16-23), sin decodificar la imagen. */
function pngSize(file: string): [number, number] {
  const bytes = readFileSync(file);
  expect(bytes.subarray(1, 4).toString("ascii"), `${file} no es un PNG`).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
const inPublic = (urlPath: string) => path.join(PUBLIC, ...urlPath.split("/").filter(Boolean));

describe("Logo del sitio: variantes y accesibilidad", () => {
  const imgs = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLImageElement>("img"));

  it("por defecto es el conjunto isotipo + rótulo, con un único nombre accesible y las imágenes decorativas", () => {
    const { container } = render(<Logo className="h-7" />);
    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("role", "img");
    expect(root).toHaveAttribute("aria-label", "MultiStack Systems");
    expect(root).toHaveAttribute("data-brand-variant", "lockup");
    expect(imgs(container)).toHaveLength(4); // isotipo y rótulo, cada uno en claro y oscuro
    for (const img of imgs(container)) {
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveAttribute("aria-hidden", "true");
    }
    expect(container.textContent).toBe("");
  });

  it.each([
    ["isotipo", ["isotipo"]],
    ["full", ["full"]],
  ] as const)("variant=%s dibuja solo esa pieza, en las dos versiones de tema", (variant, pieces) => {
    const { container } = render(<Logo variant={variant} className="h-5" />);
    expect(container.firstElementChild).toHaveAttribute("data-brand-variant", variant);
    expect(new Set(imgs(container).map((i) => i.dataset.brandPiece))).toEqual(new Set(pieces));
    expect(imgs(container).map((i) => i.dataset.brandTheme).sort()).toEqual(["claro", "oscuro"]);
  });

  it("conserva la proporción real de cada archivo (width y height intrínsecos sin estirar)", () => {
    const { container } = render(<Logo variant="lockup" />);
    const size = (piece: string) => {
      const img = container.querySelector<HTMLImageElement>(`img[data-brand-piece="${piece}"]`)!;
      return [Number(img.getAttribute("width")), Number(img.getAttribute("height"))];
    };
    expect(size("isotipo")).toEqual([242, 191]);
    expect(size("wordmark")).toEqual([580, 141]);
  });

  it("tone=light solo lleva la versión «oscuro» (barra sobre escenas oscuras en tema claro)", () => {
    const { container } = render(<Logo tone="light" />);
    expect(imgs(container)).toHaveLength(2);
    for (const img of imgs(container)) {
      expect(img).toHaveAttribute("data-brand-theme", "oscuro");
      expect(img.className).toMatch(/\bblock\b/);
      expect(img.className).not.toMatch(/\bhidden\b/);
    }
  });

  it("la versión del otro tema queda oculta por clase (dark) y no hay texto repetido", () => {
    const { container } = render(<Logo />);
    const byTheme = (t: string) => container.querySelector<HTMLImageElement>(`img[data-brand-theme="${t}"]`)!;
    expect(byTheme("claro").className).toContain("dark:hidden");
    expect(byTheme("oscuro").className).toMatch(/\bhidden\b.*dark:block/);
  });

  it("priority pide ya la versión del tema activo y deja la otra diferida", () => {
    const loading = (c: HTMLElement) =>
      Object.fromEntries(
        Array.from(c.querySelectorAll<HTMLImageElement>('img[data-brand-piece="isotipo"]')).map((i) => [i.dataset.brandTheme, i.getAttribute("loading")]),
      );
    document.documentElement.classList.add("dark");
    expect(loading(render(<Logo priority />).container)).toEqual({ claro: "lazy", oscuro: "eager" });
    cleanup();
    document.documentElement.classList.remove("dark");
    expect(loading(render(<Logo priority />).container)).toEqual({ claro: "eager", oscuro: "lazy" });
    cleanup();
    expect(loading(render(<Logo />).container)).toEqual({ claro: "lazy", oscuro: "lazy" });
  });

  it("`loading` se asigna antes que `src` (si no, React crea el <img> ya pidiendo la versión oculta aunque sea lazy)", () => {
    const { container } = render(<Logo />);
    for (const img of imgs(container)) {
      const names = img.getAttributeNames();
      expect(names.indexOf("loading"), img.dataset.brandTheme).toBeGreaterThan(-1);
      expect(names.indexOf("loading")).toBeLessThan(names.indexOf("src"));
    }
  });
});

describe("src/assets/brand: PNG del sitio acotados (nombre, dimensiones y peso)", () => {
  const BRAND_DIR = path.join(ROOT, "src", "assets", "brand");
  const KB = 1024;
  /** Los cuatro derivados 1× del panel administrador: su tamaño no debe cambiar (lo comprueba también admin-brand.test). */
  const CANONICAL: Record<string, [number, number]> = {
    "logo-completo-claro.png": [290, 200],
    "logo-completo-oscuro.png": [290, 200],
    "isotipo-claro.png": [121, 96],
    "isotipo-oscuro.png": [121, 96],
  };
  /** Los del sitio. Conjunto exacto: un original a tamaño completo (p. ej. 4090×4090) con nombre `algo-4x.png` no puede colarse. */
  const SITE: Record<string, { size: [number, number]; maxKB: number }> = {
    "isotipo-claro-2x.png": { size: [242, 191], maxKB: 60 },
    "isotipo-oscuro-2x.png": { size: [242, 191], maxKB: 60 },
    "isotipo-oscuro-4x.png": { size: [484, 382], maxKB: 40 },
    "logo-completo-claro-2x.png": { size: [580, 400], maxKB: 60 },
    "logo-completo-oscuro-2x.png": { size: [580, 400], maxKB: 60 },
    "wordmark-claro-2x.png": { size: [580, 141], maxKB: 60 },
    "wordmark-oscuro-2x.png": { size: [580, 141], maxKB: 60 },
  };

  it("la carpeta contiene exactamente los 4 canónicos 1× y los 7 PNG del sitio, y nada más", () => {
    expect(readdirSync(BRAND_DIR).sort()).toEqual([...Object.keys(CANONICAL), ...Object.keys(SITE)].sort());
  });

  it.each(Object.entries(CANONICAL))("%s (canónico 1×) conserva sus dimensiones", (name, [w, h]) => {
    expect(pngSize(path.join(BRAND_DIR, name))).toEqual([w, h]);
  });

  it.each(Object.entries(SITE))("%s mide lo esperado por su cabecera IHDR y pesa menos del tope", (name, { size, maxKB }) => {
    const file = path.join(BRAND_DIR, name);
    expect(pngSize(file)).toEqual(size);
    expect(statSync(file).size, `${name} supera ${maxKB} KB`).toBeLessThan(maxKB * KB);
  });
});

describe("la marca anterior no se referencia desde código activo", () => {
  /** Solo este archivo, donde viven los literales. Los correos ya enviados siguen cargando los PNG desde public/. */
  const ALLOWED = new Set(["src/test/brand-identity.test.tsx"]);
  const TEXT = /\.(tsx?|mjs|cjs|js|json|html|css|md|svg|webmanifest)$/;

  /**
   * Archivos de texto bajo `dir`. Con `withTests` falso se omiten las pruebas: las de supabase/functions nombran los
   * PNG antiguos precisamente para comprobar que los correos ya NO los usan.
   */
  const walk = (dir: string, withTests: boolean): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return e.name === "node_modules" || e.name === "__snapshots__" ? [] : walk(full, withTests);
      return TEXT.test(e.name) && (withTests || !/\.test\.tsx?$/.test(e.name)) ? [full] : [];
    });
  const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join("/");

  it("ni src/, ni index.html, ni scripts/, ni supabase/functions/, ni supabase/email-templates/ nombran los dos PNG de la marca anterior", () => {
    const templates = walk(path.join(ROOT, "supabase", "email-templates"), false);
    expect(templates.map(rel).sort()).toEqual([
      "supabase/email-templates/confirm-signup.html",
      "supabase/email-templates/reset-password.html",
    ]);
    const files = [
      ...walk(path.join(ROOT, "src"), true),
      ...walk(path.join(ROOT, "scripts"), true),
      ...walk(path.join(ROOT, "supabase", "functions"), false),
      ...templates,
      path.join(ROOT, "index.html"),
    ];
    expect(files.length).toBeGreaterThan(100);
    const offenders = files
      .filter((f) => !ALLOWED.has(rel(f)))
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        return LEGACY.some((name) => text.includes(name));
      })
      .map(rel);
    expect(offenders).toEqual([]);
  });
});

describe("iconos, manifiesto e imágenes sociales", () => {
  const ICONS: Record<string, [number, number]> = {
    "favicon-48x48.png": [48, 48],
    "favicon-96x96.png": [96, 96],
    "icon-192.png": [192, 192],
    "icon-512.png": [512, 512],
    "icon-maskable-512.png": [512, 512],
    "apple-touch-icon.png": [180, 180],
  };

  it.each(Object.entries(ICONS))("public/%s es un PNG de %s×%s", (name, [w, h]) => {
    expect(pngSize(path.join(PUBLIC, name))).toEqual([w, h]);
  });

  it("favicon.ico existe y es un icono (cabecera ICO con 3 tamaños)", () => {
    const bytes = readFileSync(path.join(PUBLIC, "favicon.ico"));
    expect([bytes.readUInt16LE(0), bytes.readUInt16LE(2), bytes.readUInt16LE(4)]).toEqual([0, 1, 3]);
  });

  it("el manifiesto solo referencia archivos que existen, con el tamaño declarado, y el maskable usa su propio archivo", () => {
    const manifest = JSON.parse(readFileSync(path.join(PUBLIC, "site.webmanifest"), "utf8")) as {
      icons: Array<{ src: string; sizes: string; purpose?: string }>;
    };
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      const file = inPublic(icon.src);
      expect(existsSync(file), icon.src).toBe(true);
      expect(pngSize(file).join("x"), icon.src).toBe(icon.sizes);
    }
    const maskable = manifest.icons.find((i) => i.purpose === "maskable");
    expect(maskable?.src).toBe("/icon-maskable-512.png");
    expect(manifest.icons.filter((i) => !i.purpose).map((i) => i.src)).not.toContain(maskable?.src);
  });

  it("index.html y routeMeta apuntan a las imágenes sociales vigentes (home v3, /paginas-web v2), que existen y miden 1200×630", () => {
    const doc = new DOMParser().parseFromString(readFileSync(path.join(ROOT, "index.html"), "utf8"), "text/html");
    const og = new URL(doc.querySelector('meta[property="og:image"]')!.getAttribute("content")!).pathname;
    const twitter = new URL(doc.querySelector('meta[name="twitter:image"]')!.getAttribute("content")!).pathname;
    expect(og).toBe("/assets/images/og/og-home.v3.1200x630.png");
    expect(twitter).toBe(og);
    expect(OG_IMAGES.default.path).toBe(og);
    expect(OG_IMAGES.paginasWeb.path).toBe("/assets/images/og/og-paginas-web.v2.png");
    for (const urlPath of [og, OG_IMAGES.paginasWeb.path]) {
      expect(existsSync(inPublic(urlPath)), urlPath).toBe(true);
      expect(pngSize(inPublic(urlPath)), urlPath).toEqual([1200, 630]);
    }
    expect(existsSync(inPublic("/assets/images/og/og-home.v3.1200x630.webp"))).toBe(true);
    // La v2 con el texto de IA sigue publicada: vistas previas ya compartidas la enlazan.
    expect(existsSync(inPublic("/assets/images/og/og-ai.v2.1200x630.png"))).toBe(true);
    expect(existsSync(inPublic("/assets/images/og/og-ai.v2.1200x630.webp"))).toBe(true);
  });

  it("los archivos de la marca anterior siguen en public/ (los correos ya enviados los cargan)", () => {
    for (const file of LEGACY) expect(existsSync(path.join(PUBLIC, file)), file).toBe(true);
  });
});
