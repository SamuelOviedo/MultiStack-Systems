import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Footer from "@/components/common/Footer";
import { LEGACY_FOOTER, LEGACY_HOME_NAV } from "@/components/common/legacyNav";

// El pie de las páginas antiguas (`/paginas-web`): sus textos y anclas son los de la home anterior (legacyNav.ts). Antes
// se probaba renderizando la home anterior; esa home ya no existe y el pie sigue vivo.

const Where = () => {
  const { pathname, hash } = useLocation();
  return <output data-testid="where">{`${pathname}${hash}`}</output>;
};

const stubReducedMotion = (reduced: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

const renderFooter = (withTargets: boolean) =>
  render(
    <MemoryRouter initialEntries={["/paginas-web"]}>
      {withTargets &&
        LEGACY_HOME_NAV.items.map((item) => <section key={item.href} id={item.href.slice(1)} />)}
      <Footer />
      <Where />
    </MemoryRouter>,
  );

const footerLink = (name: string): HTMLElement =>
  within(document.querySelector("footer") as HTMLElement).getByRole("button", { name });

beforeEach(() => {
  stubReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Footer · textos y anclas de la navegación antigua", () => {
  it("la columna MultiStack lista Combo, Planes, Proceso, Preguntas y Contacto, con sus anclas de siempre", () => {
    expect(LEGACY_HOME_NAV.items).toEqual([
      { label: "Combo", href: "#combo-emprendedor" },
      { label: "Planes", href: "#planes" },
      { label: "Proceso", href: "#proceso" },
      { label: "Preguntas", href: "#preguntas" },
      { label: "Contacto", href: "#contacto" },
    ]);
    renderFooter(false);
    for (const { label } of LEGACY_HOME_NAV.items) expect(footerLink(label)).toBeInTheDocument();
  });

  it("la columna de marca lleva la descripción y la ubicación de siempre", () => {
    expect(LEGACY_FOOTER).toEqual({
      description: "Páginas web a medida para negocios en Honduras, con código propio en React.",
      location: "Siguatepeque, Comayagua, Honduras",
    });
    renderFooter(false);
    const footer = document.querySelector("footer") as HTMLElement;
    expect(footer).toHaveTextContent(LEGACY_FOOTER.description);
    expect(footer).toHaveTextContent(LEGACY_FOOTER.location);
    expect(footer).toHaveTextContent("© 2026 MultiStack Systems. Todos los derechos reservados.");
  });

  it("enlaza a las políticas", () => {
    renderFooter(false);
    fireEvent.click(screen.getByRole("button", { name: "Política de Privacidad" }));
    expect(screen.getByTestId("where").textContent).toBe("/politica-de-privacidad");
  });
});

describe("Footer · desplazamiento a las anclas", () => {
  it("con la sección en la página se desplaza suave, o de golpe con prefers-reduced-motion: reduce", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    renderFooter(true);
    fireEvent.click(footerLink("Planes"));
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "smooth" }));
    cleanup();

    stubReducedMotion(true);
    scrollTo.mockClear();
    renderFooter(true);
    fireEvent.click(footerLink("Planes"));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "auto" }));
  });

  it("sin la sección en la página navega a «/#ancla» (LegacyHomeGate la lleva a su vista)", () => {
    renderFooter(false);
    fireEvent.click(footerLink("Contacto"));
    expect(screen.getByTestId("where").textContent).toBe("/#contacto");
  });
});
