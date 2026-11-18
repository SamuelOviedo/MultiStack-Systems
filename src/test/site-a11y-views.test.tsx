import { cleanup, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));
// jsdom no tiene WebGL: las ondas son decorativas y su aria-hidden se prueba en site-waves-shader.test.tsx.
vi.mock("@/components/site/WavesShader", () => ({ WavesShader: () => null }));

import Contacto from "@/pages/marketing/Contacto";
import Index from "@/pages/marketing/Index";
import Planes from "@/pages/marketing/Planes";
import Servicios from "@/pages/marketing/Servicios";
import { SITE_CONTENT } from "@/pages/marketing/siteContent";

// Revisión de accesibilidad (WCAG 2.2 AA) de las cuatro vistas en lo que se puede comprobar sin un navegador: estructura,
// nombres y elementos decorativos. El contraste, el foco visible, el tamaño de los objetivos y el movimiento reducido se miden
// en navegador (e2e/public-site.spec.ts y src/test/site-a11y-tokens.test.ts).

const VIEWS: readonly [string, string, () => ReactElement][] = [
  ["/", "home", () => <Index />],
  ["/planes", "planes", () => <Planes />],
  ["/servicios", "servicios", () => <Servicios />],
  ["/contacto", "contacto", () => <Contacto />],
];

const renderView = (path: string, view: ReactElement) =>
  render(
    <MemoryRouter initialEntries={[path]}>{view}</MemoryRouter>,
  );

const headingLevels = () =>
  screen.getAllByRole("heading").map((heading) => Number(heading.tagName.slice(1)));

afterEach(() => cleanup());

describe.each(VIEWS)("accesibilidad de %s", (path, _name, view) => {
  it("tiene un solo H1 y un solo <main>", () => {
    renderView(path, view());
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("los enlaces externos de la vista abren en pestaña nueva con rel seguro y lo avisan en su nombre", () => {
    renderView(path, view());
    const main = within(screen.getByRole("main"));
    for (const link of main.queryAllByRole("link").filter((a) => a.getAttribute("target") === "_blank")) {
      expect(link, link.textContent ?? "").toHaveAccessibleName(/\(se abre en una pestaña nueva\)/);
      expect(link.getAttribute("rel")).toMatch(/noopener/);
      expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    }
  });

  it("los enlaces externos tienen un nombre que no es solo su URL", () => {
    renderView(path, view());
    for (const link of screen.getAllByRole("link").filter((a) => /^https?:/.test(a.getAttribute("href") ?? ""))) {
      expect(link.getAttribute("aria-label") ?? link.textContent ?? "").not.toMatch(/^https?:/);
      expect(link).toHaveAccessibleName();
    }
  });

  it("las imágenes decorativas (alt vacío) están ocultas a los lectores y la única con significado trae su texto", () => {
    const { container } = renderView(path, view());
    for (const img of container.querySelectorAll("img")) {
      if (img.getAttribute("alt") === "") {
        expect(img.getAttribute("aria-hidden") === "true" || img.closest("[aria-hidden='true']") !== null, img.outerHTML.slice(0, 80)).toBe(true);
      } else {
        expect(img.getAttribute("alt"), img.outerHTML.slice(0, 80)).toBeTruthy();
      }
    }
  });

  it("todos los iconos SVG están ocultos a los lectores (los nombres vienen del texto)", () => {
    const { container } = renderView(path, view());
    for (const svg of container.querySelectorAll("svg")) {
      const hidden = svg.getAttribute("aria-hidden") === "true" || svg.closest("[aria-hidden='true']") !== null;
      expect(hidden || svg.getAttribute("aria-label") !== null, svg.outerHTML.slice(0, 80)).toBe(true);
    }
  });

  it("las cuadrículas de fondo son decorativas", () => {
    const { container } = renderView(path, view());
    for (const grid of container.querySelectorAll(".bg-grid")) {
      expect(grid.closest("[aria-hidden='true']"), "bg-grid").not.toBeNull();
    }
  });
});

describe("home: lo decorativo no entra al árbol de accesibilidad", () => {
  it("las píldoras del titular, la terminal, el chat de ejemplo y el titular escrito a máquina están con aria-hidden", () => {
    const { container } = renderView("/", <Index />);

    // El titular da su texto completo en un <span> solo para lectores y el resto (palabras y píldoras) es decorativo.
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveAccessibleName(SITE_CONTENT.hero.title.plainText);
    expect(container.querySelectorAll("h1 .hero-pill").length).toBeGreaterThan(0);
    for (const pill of container.querySelectorAll("h1 .hero-pill")) expect(pill.getAttribute("aria-hidden")).toBe("true");

    // La insignia con efecto de máquina de escribir: el texto visible está oculto y el completo va a los lectores.
    expect(container.querySelector(".hero-typewriter")?.closest("[aria-hidden='true']")).not.toBeNull();

    // Terminal y chat de la sección de servicios: ejemplos animados, no contenido.
    for (const decorative of [SITE_CONTENT.bento.terminal.windowTitle, SITE_CONTENT.bento.chat.assistantName]) {
      const node = screen.getByText(decorative);
      expect(node.closest("[aria-hidden='true']"), decorative).not.toBeNull();
    }
  });

  it("el estado de cada fase del seguimiento se dice con texto y la fase en curso lleva aria-current=step", () => {
    const { container } = renderView("/", <Index />);
    const current = container.querySelectorAll("ol li[aria-current=\"step\"]");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent(SITE_CONTENT.tracker.phases[SITE_CONTENT.tracker.currentPhaseIndex]!.name);
    expect(screen.getAllByText(`(${SITE_CONTENT.tracker.phaseStatus.current})`)).toHaveLength(1);
    expect(screen.getAllByText(`(${SITE_CONTENT.tracker.phaseStatus.done})`)).toHaveLength(SITE_CONTENT.tracker.currentPhaseIndex);
  });
});

describe("orden de los encabezados", () => {
  it.each([
    ["/", "home", () => <Index />],
    ["/servicios", "servicios", () => <Servicios />],
    ["/contacto", "contacto", () => <Contacto />],
  ] as const)("%s: ningún encabezado salta más de un nivel", (path, _name, view) => {
    renderView(path, view());
    const levels = headingLevels();
    expect(levels[0]).toBe(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `encabezado ${index + 1}`).toBeLessThanOrEqual(levels[index - 1]! + 1);
    });
  });

  // A11Y-3 (corregido): en /planes las tarjetas colgaban del <h1> como <h3>, sin ningún <h2> entre ambos (axe: heading-order,
  // moderado). PlanCard recibe el nivel como prop: h2 en /planes y h3 por omisión, que es el de la home bajo su <h2>.
  it("/planes no salta de h1 a h3 (A11Y-3)", () => {
    renderView("/planes", <Planes />);
    const levels = headingLevels();
    levels.forEach((level, index) => {
      if (index > 0) expect(level, `encabezado ${index + 1}`).toBeLessThanOrEqual(levels[index - 1]! + 1);
    });
  });
});

describe("pie: enlaces que abren en pestaña nueva", () => {
  // A11Y-4 (corregido): el enlace «WhatsApp» del pie era target=_blank con el nombre «WhatsApp» a secas; los demás externos del
  // sitio añaden «(se abre en una pestaña nueva)». footer.whatsapp es ahora externalLink(...), siteLayoutProps pasa su ariaLabel
  // y SiteFooter lo pone en el enlace. El texto visible no cambia.
  it("el enlace de WhatsApp del pie avisa que abre una pestaña nueva (A11Y-4)", () => {
    renderView("/planes", <Planes />);
    const footer = within(screen.getByRole("contentinfo"));
    for (const link of footer.getAllByRole("link").filter((a) => a.getAttribute("target") === "_blank")) {
      expect(link).toHaveAccessibleName(/pestaña nueva/);
    }
  });

  it("el pie tiene al menos un enlace externo con target=_blank y rel seguro (la prueba de arriba no pasa en vacío)", () => {
    renderView("/planes", <Planes />);
    const external = within(screen.getByRole("contentinfo")).getAllByRole("link").filter((a) => a.getAttribute("target") === "_blank");
    expect(external.length).toBeGreaterThan(0);
    for (const link of external) expect(link.getAttribute("rel")).toMatch(/noopener noreferrer/);
  });
});

describe("site.css: el foco no queda tapado por la cabecera fija (WCAG 2.4.11)", () => {
  const css = readFileSync(path.join(process.cwd(), "src/components/site/site.css"), "utf8");

  it("los elementos enfocables llevan un scroll-margin-top de al menos la altura de la cabecera (h-16 = 4rem)", () => {
    let margin: number | undefined;
    let selector = "";
    postcss.parse(css).walkRules((rule) => {
      rule.walkDecls("scroll-margin-top", (decl) => {
        if (/a\[href\]/.test(rule.selector) && /button/.test(rule.selector) && /input/.test(rule.selector)) {
          margin = parseFloat(decl.value);
          selector = rule.selector;
        }
      });
    });
    expect(margin, "regla de scroll-margin-top sobre a, button e input").toBeDefined();
    expect(selector).toContain(".ms-site");
    expect(margin!).toBeGreaterThanOrEqual(4);
  });

  it("la cabecera es la fija que esa regla compensa: h-16 y sticky", () => {
    const header = readFileSync(path.join(process.cwd(), "src/components/site/SiteHeader.tsx"), "utf8");
    expect(header).toMatch(/<header className="sticky top-0[^"]*"/);
    expect(header).toMatch(/flex h-16 /);
  });
});
