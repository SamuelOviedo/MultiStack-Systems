// Pie de la landing (home y /paginas-web): el copyright no cambia y el crédito «Desarrollado por MultiStack Systems»
// va en modo sitio propio (enlace a la home, misma pestaña, sin UTM ni rel). Estándar: docs/standards/CREDITO-MULTISTACK.md.
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import Footer from "@/components/common/Footer";

afterEach(cleanup);

const renderFooter = () =>
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>,
  );

const bar = () => document.querySelector<HTMLElement>(".ms-footer-bar")!;

describe("Footer · barra inferior", () => {
  it("conserva el copyright tal cual, con su cursor parpadeante", () => {
    renderFooter();
    expect(bar().firstChild?.textContent).toBe("© 2026 MultiStack Systems. Todos los derechos reservados.");
    const cursor = bar().querySelector("span:not([class])");
    expect(cursor?.textContent).toBe("_");
  });

  it("el crédito está en modo sitio propio: a la home, misma pestaña, sin rel ni UTM", () => {
    renderFooter();
    const credit = within(bar()).getByRole("link", { name: "Desarrollado por MultiStack Systems" });
    expect(credit).toHaveAttribute("href", "/");
    expect(credit).not.toHaveAttribute("target");
    expect(credit).not.toHaveAttribute("rel");
    expect(credit.getAttribute("aria-label")).not.toMatch(/pestaña/);
    expect(credit.textContent).toBe("Desarrollado por MultiStack Systems");
  });

  it("hay un solo crédito (los ids del isotipo son fijos) y el separador queda oculto a los lectores", () => {
    renderFooter();
    expect(screen.getAllByRole("link", { name: /Desarrollado por MultiStack Systems/ })).toHaveLength(1);
    expect(document.querySelectorAll("#ms-credit-m")).toHaveLength(1);
    expect(document.querySelectorAll("#ms-credit-g")).toHaveLength(1);
    expect(bar().querySelector(".ms-footer-bar__sep")).toHaveAttribute("aria-hidden", "true");
  });

  it("el crédito sigue al copyright en la barra y el resto del pie no cambia de enlaces", () => {
    renderFooter();
    const children = [...bar().childNodes];
    expect(children.at(-1)).toBe(screen.getByRole("link", { name: "Desarrollado por MultiStack Systems" }));
    // El único enlace nuevo del pie es el crédito.
    const links = within(document.querySelector("footer")!).getAllByRole("link");
    expect(links.filter((a) => a.getAttribute("href") === "/")).toHaveLength(1);
  });
});
