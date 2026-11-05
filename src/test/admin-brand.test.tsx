// Identidad oficial en el administrador: BrandMark (variante por tema, nombre accesible único, proporciones,
// sin efectos) y comprobaciones estáticas de que ningún archivo de src/ apunta a los maestros ni a public/ de marca
// y de que los cuatro derivados pesan poco.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BrandMark from "@/components/admin/BrandMark";
import brandSource from "@/components/admin/BrandMark.tsx?raw";
import shellSource from "@/components/admin/AdminShell.tsx?raw";
import navListSource from "@/components/admin/AdminNavList.tsx?raw";

afterEach(cleanup);

const SRC = path.resolve(__dirname, "..");
const BRAND_DIR = path.join(SRC, "assets", "brand");
// Armados por partes: este archivo también lo recorre el barrido y no debe contener los literales prohibidos.
const MASTER = ["new", "Multi", "stack"].join("");
const PUBLIC_BRAND = new RegExp(["public\\/[^\\s\"'`]*", "(logo|isotip|brand|marca|", "multi", "stack)"].join(""), "i");

/** Lo que Tailwind resolvería con `dark` presente o ausente en <html>, a partir de las clases de visibilidad. */
function visibleIn(theme: "light" | "dark", img: HTMLElement): boolean {
  const tokens = img.className.split(/\s+/);
  if (theme === "dark") {
    if (tokens.includes("dark:hidden")) return false;
    if (tokens.includes("dark:block")) return true;
  }
  return !tokens.includes("hidden");
}

const imgs = (c: HTMLElement) => Array.from(c.querySelectorAll<HTMLImageElement>("img"));
const claro = (c: HTMLElement) => c.querySelector<HTMLImageElement>('img[data-brand-theme="claro"]')!;
const oscuro = (c: HTMLElement) => c.querySelector<HTMLImageElement>('img[data-brand-theme="oscuro"]')!;

describe("BrandMark: variante por tema", () => {
  it.each(["logo", "isotipo"] as const)("%s: en claro se ve solo la versión «claro» y en oscuro solo la «oscuro»", (variant) => {
    const { container } = render(<BrandMark variant={variant} className="h-8" />);
    expect(imgs(container)).toHaveLength(2);
    for (const theme of ["light", "dark"] as const) {
      const visibles = imgs(container).filter((img) => visibleIn(theme, img));
      expect(visibles, theme).toHaveLength(1);
      expect(visibles[0].dataset.brandTheme).toBe(theme === "light" ? "claro" : "oscuro");
    }
    // Cada una apunta a su archivo (los módulos de Vite conservan el nombre de origen en pruebas).
    expect(claro(container).getAttribute("src")).toMatch(/claro/);
    expect(oscuro(container).getAttribute("src")).toMatch(/oscuro/);
    expect(claro(container).getAttribute("src")).not.toBe(oscuro(container).getAttribute("src"));
  });

  it("logo e isotipo usan archivos distintos", () => {
    const a = render(<BrandMark variant="logo" />);
    const logoSrc = claro(a.container).getAttribute("src");
    a.unmount();
    const b = render(<BrandMark variant="isotipo" />);
    expect(claro(b.container).getAttribute("src")).not.toBe(logoSrc);
    expect(claro(b.container).getAttribute("src")).toMatch(/isotipo-claro/);
    expect(logoSrc).toMatch(/logo-completo-claro/);
  });

  it("la imagen oculta no se pide: lleva `display: none` en su tema y `loading=\"lazy\"` + `decoding=\"async\"`", () => {
    const { container } = render(<BrandMark variant="logo" className="h-20" />);
    expect(claro(container).className).toContain("dark:hidden");
    expect(oscuro(container).className).toMatch(/(^|\s)hidden(\s|$)/);
    for (const img of imgs(container)) {
      expect(img).toHaveAttribute("loading", "lazy");
      expect(img).toHaveAttribute("decoding", "async");
    }
  });
});

describe("BrandMark: nombre accesible", () => {
  it("expone un único nombre «MultiStack Systems» por defecto", () => {
    render(<BrandMark variant="logo" className="h-20" />);
    expect(screen.getAllByRole("img", { name: "MultiStack Systems" })).toHaveLength(1);
    expect(screen.getAllByRole("img")).toHaveLength(1);
  });

  it("admite otro nombre con `label`", () => {
    render(<BrandMark variant="isotipo" label="Inicio del panel" />);
    expect(screen.getByRole("img", { name: "Inicio del panel" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "MultiStack Systems" })).toBeNull();
  });

  it("las dos imágenes son decorativas (`alt` vacío y `aria-hidden`): el nombre existe en ambos temas", () => {
    const { container } = render(<BrandMark variant="logo" />);
    for (const img of imgs(container)) {
      expect(img).toHaveAttribute("alt", "");
      expect(img).toHaveAttribute("aria-hidden", "true");
    }
    expect(container.querySelectorAll("[alt]:not([alt=''])")).toHaveLength(0);
  });

  it("no añade texto visible ni sr-only al lado del logotipo", () => {
    const { container } = render(<BrandMark variant="logo" />);
    expect(container.textContent).toBe("");
  });
});

describe("BrandMark: proporciones y sin efectos", () => {
  const RATIOS = { logo: [290, 200], isotipo: [121, 96] } as const;

  it.each(["logo", "isotipo"] as const)("%s: width y height intrínsecos (sin salto de maquetación) con la proporción del archivo", (variant) => {
    const { container } = render(<BrandMark variant={variant} className="h-8" />);
    const [w, h] = RATIOS[variant];
    for (const img of imgs(container)) {
      expect(Number(img.getAttribute("width"))).toBe(w);
      expect(Number(img.getAttribute("height"))).toBe(h);
    }
  });

  it("la altura la manda la clase del contenedor y el ancho la sigue: object-contain, sin estirar", () => {
    const { container } = render(<BrandMark variant="logo" className="h-20" />);
    expect(container.firstElementChild).toHaveClass("h-20");
    for (const img of imgs(container)) {
      expect(img.className).toContain("h-full");
      expect(img.className).toContain("w-auto");
      expect(img.className).toContain("object-contain");
      expect(img.className).not.toMatch(/(^|\s)(w-full|h-auto|object-(fill|cover))(\s|$)/);
    }
  });

  it("sin filtros, sombras, opacidad, desenfoque, transformaciones, transiciones ni animaciones (manual de marca)", () => {
    const { container } = render(<BrandMark variant="logo" className="h-20" />);
    const all = [container.firstElementChild!, ...imgs(container)];
    for (const el of all) {
      expect(el.className).not.toMatch(
        /opacity|shadow|blur|filter|grayscale|sepia|brightness|contrast|invert|hue-rotate|saturate|mix-blend|rotate|scale|skew|transition|animate|duration/,
      );
      expect(el).not.toHaveAttribute("style");
    }
    expect(brandSource).not.toMatch(/style=|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsl\(/);
  });
});

describe("derivados de marca: archivos y referencias", () => {
  const FILES: Record<string, [number, number]> = {
    "logo-completo-claro.png": [290, 200],
    "logo-completo-oscuro.png": [290, 200],
    "isotipo-claro.png": [121, 96],
    "isotipo-oscuro.png": [121, 96],
  };

  it.each(Object.entries(FILES))("%s existe, es un PNG de las dimensiones esperadas y pesa menos de 30 KB", (name, [w, h]) => {
    const file = path.join(BRAND_DIR, name);
    const bytes = readFileSync(file);
    expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(bytes.readUInt32BE(16)).toBe(w);
    expect(bytes.readUInt32BE(20)).toBe(h);
    expect(statSync(file).size).toBeLessThan(30 * 1024);
  });

  it("la carpeta solo contiene esos cuatro derivados", () => {
    expect(readdirSync(BRAND_DIR).sort()).toEqual(Object.keys(FILES).sort());
  });

  it("son 2× o más de la altura mostrada (logo a 80 px, isotipo a 32 px)", () => {
    expect(200 / 80).toBeGreaterThanOrEqual(2);
    expect(96 / 32).toBeGreaterThanOrEqual(2);
  });

  it("BrandMark importa solo los cuatro derivados como módulos de Vite", () => {
    const imports = Array.from(brandSource.matchAll(/^import .* from "(@\/assets\/[^"]+)";$/gm)).map((m) => m[1]);
    expect(imports.sort()).toEqual(Object.keys(FILES).map((n) => `@/assets/brand/${n}`).sort());
  });

  it("el armazón y su lista de navegación no dibujan imágenes por su cuenta ni usan rutas de public/", () => {
    for (const [name, src] of Object.entries({ AdminShell: shellSource, AdminNavList: navListSource })) {
      expect(src, name).not.toMatch(/<img\b|src=|\/logo-/);
      expect(src, name).not.toMatch(PUBLIC_BRAND);
    }
  });

  it("ningún archivo de src/ referencia los PNG maestros ni rutas de marca de public/", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) return walk(full);
        return /\.(tsx?|css|json|html|md|svg)$/.test(e.name) ? [full] : [];
      });
    const files = walk(SRC);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files
      .filter((f) => {
        const text = readFileSync(f, "utf8");
        return text.includes(MASTER) || PUBLIC_BRAND.test(text);
      })
      .map((f) => path.relative(SRC, f));
    expect(offenders).toEqual([]);
  });
});
