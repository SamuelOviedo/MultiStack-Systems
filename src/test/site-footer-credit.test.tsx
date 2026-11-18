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
// jsdom no tiene WebGL: las ondas son decorativas y no se prueban aquí.
vi.mock("@/components/site/WavesShader", () => ({ WavesShader: () => null }));

import { SiteFooter } from "@/components/site/SiteFooter";
import Contacto from "@/pages/marketing/Contacto";
import Index from "@/pages/marketing/Index";
import Planes from "@/pages/marketing/Planes";
import Servicios from "@/pages/marketing/Servicios";
import { SITE_CONTENT } from "@/pages/marketing/siteContent";
import { siteFooterProps } from "@/pages/marketing/siteLayoutProps";

// Crédito «Desarrollado por MultiStack Systems» en el pie del sitio público (DevCredit en modo sitio propio). El estándar
// está en docs/standards/CREDITO-MULTISTACK.md; el contraste, el área táctil y la disposición se miden en navegador
// (e2e/pie-credito.spec.ts). Aquí: el marcado, el modo propio, el crédito único por página y la forma de la regla de ubicación.

afterEach(cleanup);

const NOMBRE = "Desarrollado por MultiStack Systems";
const COPYRIGHT = SITE_CONTENT.footer.copyright(2026);

const renderFooter = () =>
  render(
    <MemoryRouter>
      <SiteFooter {...siteFooterProps(SITE_CONTENT, 2026)} />
    </MemoryRouter>,
  );

describe("SiteFooter · crédito de desarrollo", () => {
  it("conserva el copyright tal cual", () => {
    renderFooter();
    expect(screen.getByText(COPYRIGHT)).toBeInTheDocument();
    expect(COPYRIGHT).toBe("© 2026 MultiStack Systems. Todos los derechos reservados.");
  });

  it("el crédito está en modo propio: a la home, misma pestaña, sin rel ni UTM", () => {
    renderFooter();
    const credit = within(screen.getByRole("contentinfo")).getByRole("link", { name: NOMBRE });
    expect(credit).toHaveAttribute("href", "/");
    expect(credit).not.toHaveAttribute("target");
    expect(credit).not.toHaveAttribute("rel");
    expect(credit.getAttribute("href")).not.toMatch(/utm_|\?/);
    expect(credit.getAttribute("aria-label")).not.toMatch(/pestaña/);
    expect(credit.textContent).toBe(NOMBRE);
  });

  it("el crédito va en la barra inferior, después del copyright, con un separador oculto a los lectores", () => {
    renderFooter();
    const bar = document.querySelector<HTMLElement>(".site-foot-bar")!;
    const credit = within(bar).getByRole("link", { name: NOMBRE });
    const copy = within(bar).getByText(COPYRIGHT);
    expect(copy.compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const sep = bar.querySelector(".site-foot-sep");
    expect(sep).toHaveAttribute("aria-hidden", "true");
    expect(sep?.textContent).toBe("");
    // El separador va entre los dos, para que solo se vea cuando comparten línea.
    expect(copy.compareDocumentPosition(sep!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sep!.compareDocumentPosition(credit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("el único enlace nuevo del pie es el crédito: las columnas siguen igual", () => {
    renderFooter();
    const links = within(screen.getByRole("contentinfo")).getAllByRole("link");
    const sinCredito = links.filter((a) => a.getAttribute("aria-label") !== NOMBRE).map((a) => a.textContent);
    const columnas = SITE_CONTENT.footer;
    expect(sinCredito).toEqual([
      ...columnas.siteLinks.map((l) => l.label),
      columnas.whatsapp.label,
      columnas.phone.label,
    ]);
    // La referencia a la home no se duplica con un segundo enlace a «/».
    expect(links.filter((a) => a.getAttribute("href") === "/").map((a) => a.getAttribute("aria-label"))).toContain(NOMBRE);
  });
});

describe.each([
  ["/", () => <Index />],
  ["/planes", () => <Planes />],
  ["/servicios", () => <Servicios />],
  ["/contacto", () => <Contacto />],
] as const)("vista %s", (ruta, vista: () => ReactElement) => {
  it("monta un solo pie y un solo crédito (los ids del isotipo son fijos)", () => {
    render(<MemoryRouter initialEntries={[ruta]}>{vista()}</MemoryRouter>);
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(screen.getAllByRole("link", { name: /Desarrollado por MultiStack Systems/ })).toHaveLength(1);
    expect(document.querySelectorAll("#ms-credit-m")).toHaveLength(1);
    expect(document.querySelectorAll("#ms-credit-g")).toHaveLength(1);
    expect(document.querySelectorAll(".site-foot-sep")).toHaveLength(1);
  });
});

describe("site.css · ubicación del crédito", () => {
  const css = postcss.parse(readFileSync(path.resolve(__dirname, "..", "components", "site", "site.css"), "utf8"));
  const containers: postcss.AtRule[] = [];
  css.walkAtRules("container", (rule) => void containers.push(rule));

  it("decide «al lado o debajo» con una container query en em sobre la barra, ni en px ni en ch (ch depende de la fuente de reserva)", () => {
    expect(containers).toHaveLength(1);
    expect(containers[0].params).toMatch(/^\(min-width:\s*\d+(\.\d+)?em\)$/);
    let barra = false;
    css.walkRules((rule) => {
      if (rule.selector === ".ms-site .site-foot-bar") {
        barra = rule.nodes.some((n) => n.type === "decl" && n.prop === "container-type" && n.value === "inline-size");
      }
    });
    expect(barra).toBe(true);
  });

  it("ninguna regla del crédito usa un media query de ancho en px", () => {
    css.walkRules(/site-foot-/, (rule) => {
      for (let node = rule.parent; node && node.type !== "root"; node = node.parent) {
        if (node.type !== "atrule") continue;
        const { name, params } = node as postcss.AtRule;
        if (name === "media") expect(params, rule.selector).not.toMatch(/width/);
        if (name === "container") expect(params, rule.selector).not.toMatch(/px/);
      }
    });
  });

  it("por defecto el separador está oculto y solo se muestra dentro de la container query", () => {
    const display = (scope: postcss.Container) => {
      let value: string | undefined;
      scope.walkRules(/site-foot-sep/, (rule) =>
        rule.walkDecls("display", (decl) => {
          value = decl.value;
        }),
      );
      return value;
    };
    const fuera = postcss.root();
    css.each((node) => {
      if (node.type === "rule") fuera.append(node.clone());
    });
    expect(display(fuera)).toBe("none");
    expect(display(containers[0])).toBe("block");
  });

  it("al lado, el crédito sale del flujo: el copyright no cambia de ancho ni de posición", () => {
    let absoluto = false;
    containers[0].walkRules(/site-foot-credit/, (rule) =>
      rule.walkDecls("position", (decl) => {
        absoluto ||= decl.value === "absolute";
      }),
    );
    expect(absoluto).toBe(true);
  });
});
