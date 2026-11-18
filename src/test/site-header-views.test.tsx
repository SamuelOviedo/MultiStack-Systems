import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));
// jsdom no tiene WebGL: las ondas son decorativas y no se prueban aquí.
vi.mock("@/components/site/WavesShader", () => ({ WavesShader: () => null }));

import Contacto from "@/pages/marketing/Contacto";
import Index from "@/pages/marketing/Index";
import Planes from "@/pages/marketing/Planes";
import Servicios from "@/pages/marketing/Servicios";
import { SITE_CONTENT } from "@/pages/marketing/siteContent";

// site-header.test.tsx prueba el encabezado con una navegación de ejemplo. Aquí, el encabezado de las CUATRO vistas reales,
// armado con SITE_CONTENT.nav: que cada vista marque la suya, que el menú móvil responda al teclado y que los enlaces
// internos lleven la atribución del anuncio. Si una vista se monta con otras props de cabecera, esto lo nota.

const NAV = SITE_CONTENT.nav;

const VIEWS: readonly [string, string, () => ReactElement][] = [
  ["Inicio", "/", () => <Index />],
  ["Planes", "/planes", () => <Planes />],
  ["Servicios", "/servicios", () => <Servicios />],
  ["Contacto", "/contacto", () => <Contacto />],
];

const renderView = (view: ReactElement, entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      {view}
    </MemoryRouter>,
  );

const desktopNav = () => within(screen.getByRole("navigation", { name: "Principal" }));
const toggle = () => screen.getByRole("button", { name: NAV.menuLabel });
const panel = () => document.getElementById(toggle().getAttribute("aria-controls")!) as HTMLElement;

afterEach(() => cleanup());

describe("encabezado de las vistas del sitio", () => {
  it("la navegación de SITE_CONTENT tiene las cuatro vistas, con sus rutas, en su orden", () => {
    expect(NAV.items.map((item) => [item.label, item.href])).toEqual(VIEWS.map(([label, path]) => [label, path]));
  });

  it.each(VIEWS)("en %s (%s) solo esa vista queda marcada con aria-current=page, en la barra y en el menú móvil", (label, path, view) => {
    renderView(view(), path);
    fireEvent.click(toggle());

    for (const scope of [desktopNav(), within(panel())]) {
      const current = scope.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page");
      expect(current.map((link) => link.textContent)).toEqual([label]);
    }
    // La navegación de escritorio y la del menú son las dos únicas con la marca: el pie no marca nada.
    expect(
      within(screen.getByRole("contentinfo")).queryAllByRole("link").filter((link) => link.hasAttribute("aria-current")),
    ).toHaveLength(0);
  });

  it("con la query del anuncio la vista sigue marcada (la ruta manda, no la URL completa)", () => {
    renderView(<Planes />, "/planes?gclid=abc&utm_source=x");
    expect(desktopNav().getByRole("link", { name: "Planes" })).toHaveAttribute("aria-current", "page");
    expect(desktopNav().getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");
  });

  it.each(VIEWS)("en %s: el menú móvil abre, y Escape lo cierra y devuelve el foco al botón", (_label, path, view) => {
    renderView(view(), path);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();

    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();

    // El foco puede estar dentro del panel cuando se pulsa Escape (se llegó con Tab): debe volver al botón.
    const first = within(panel()).getAllByRole("link")[0]!;
    first.focus();
    expect(first).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
    expect(toggle()).toHaveFocus();
  });

  it("el menú móvil trae las cuatro vistas, el acceso y «Cotizar mi web»", () => {
    renderView(<Servicios />, "/servicios");
    fireEvent.click(toggle());
    expect(within(panel()).getAllByRole("link").map((link) => link.textContent)).toEqual([
      ...NAV.items.map((item) => item.label),
      NAV.panel.label,
      NAV.cta.label,
    ]);
  });
});

describe("encabezado: la atribución del anuncio viaja con los enlaces internos", () => {
  const ENTRY = "/contacto?gclid=abc123&gbraid=g1&utm_source=google&utm_medium=cpc&utm_campaign=web&foo=1&token=secreto";
  const KEPT = "gclid=abc123&gbraid=g1&utm_source=google&utm_medium=cpc&utm_campaign=web";

  it("la barra y el menú móvil conservan gclid, gbraid y utm_* hacia otra vista y dejan atrás el resto (la propia vista conserva toda la query)", () => {
    renderView(<Contacto />, ENTRY);
    fireEvent.click(toggle());

    for (const scope of [desktopNav(), within(panel())]) {
      for (const item of NAV.items) {
        const href = scope.getByRole("link", { name: item.label }).getAttribute("href")!;
        if (item.href === "/contacto") {
          // Misma página: es un enlace de ida y vuelta a donde ya se está, y la query sigue entera (ver site-links.test.tsx).
          expect(href, item.label).toBe(`/contacto?${KEPT}&foo=1&token=secreto`);
        } else {
          expect(href, item.label).toBe(`${item.href}?${KEPT}`);
          expect(href, item.label).not.toMatch(/foo|token|secreto/);
        }
      }
    }
  });

  it("el logo, [ mi panel ] y «Cotizar mi web» también la llevan", () => {
    renderView(<Contacto />, ENTRY);
    expect(screen.getByRole("link", { name: NAV.homeLabel })).toHaveAttribute("href", `/?${KEPT}`);
    const bar = screen.getAllByRole("link", { name: NAV.panel.label })[0]!;
    expect(bar.getAttribute("href")).toBe(`/login?${KEPT}`);
    const cta = screen.getAllByRole("link", { name: NAV.cta.label })[0]!;
    expect(cta.getAttribute("href")).toBe(`${NAV.cta.href}?${KEPT}`);
  });

  it("sin query en la URL los enlaces quedan limpios", () => {
    renderView(<Planes />, "/planes");
    for (const item of NAV.items) {
      expect(desktopNav().getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("desde la home también viaja", () => {
    renderView(<Index />, "/?gclid=abc123&utm_source=google");
    expect(desktopNav().getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "/contacto?gclid=abc123&utm_source=google");
  });

  it("los enlaces externos del pie y de la vista no se tocan: la query del anuncio no sale hacia WhatsApp", () => {
    renderView(<Contacto />, "/contacto?gclid=abc123&utm_source=google");
    for (const link of screen.getAllByRole("link")) {
      const href = link.getAttribute("href") ?? "";
      if (/^https?:|^tel:/.test(href)) expect(href, link.textContent ?? "").not.toMatch(/gclid|utm_/);
    }
  });
});
