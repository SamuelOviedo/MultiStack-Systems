// Crédito "Desarrollado por MultiStack Systems" (snippets/credito-multistack/DevCredit.tsx):
// enlace con UTM, atributos del enlace, accesibilidad y variantes. El estándar está en
// docs/standards/CREDITO-MULTISTACK.md.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DevCredit } from "../../snippets/credito-multistack/DevCredit";

const NAME = "Desarrollado por MultiStack Systems (se abre en una pestaña nueva)";
const link = () => screen.getByRole("link", { name: NAME });

describe("DevCredit · enlace", () => {
  it("apunta a multistacksystems.com con los tres UTM y el slug del cliente", () => {
    render(<DevCredit clientSlug="acme" />);
    const url = new URL(link().getAttribute("href") ?? "");
    expect(url.origin + url.pathname).toBe("https://www.multistacksystems.com/");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "acme",
      utm_medium: "referral",
      utm_campaign: "credito-footer",
    });
  });

  it("codifica el slug: no puede inyectar parámetros ni romper la URL", () => {
    render(<DevCredit clientSlug="a b&utm_medium=x/ñ" />);
    const url = new URL(link().getAttribute("href") ?? "");
    expect(url.searchParams.get("utm_source")).toBe("a b&utm_medium=x/ñ");
    expect(url.searchParams.getAll("utm_medium")).toEqual(["referral"]);
    expect([...url.searchParams.keys()]).toHaveLength(3);
  });

  it("abre en pestaña nueva con noopener y nofollow", () => {
    render(<DevCredit clientSlug="acme" />);
    expect(link()).toHaveAttribute("target", "_blank");
    expect((link().getAttribute("rel") ?? "").split(" ").sort()).toEqual(["nofollow", "noopener"]);
  });
});

describe("DevCredit · accesibilidad", () => {
  it("el texto visible es solo la marca y abre el nombre accesible", () => {
    render(<DevCredit clientSlug="acme" />);
    expect(link()).toHaveTextContent(/^Desarrollado por\s*MultiStack Systems$/);
    expect(NAME.startsWith("Desarrollado por MultiStack Systems")).toBe(true);
  });

  it("isotipo y flecha quedan ocultos a los lectores de pantalla y fuera del orden de foco", () => {
    render(<DevCredit clientSlug="acme" />);
    const svgs = link().querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
      expect(svg.querySelector("title")).toBeNull();
    }
  });
});

describe("DevCredit · variantes", () => {
  it("por defecto hereda el color y queda en línea: sin data-tone ni data-align", () => {
    render(<DevCredit clientSlug="acme" />);
    expect(link()).not.toHaveAttribute("data-tone");
    expect(link()).not.toHaveAttribute("data-align");
  });

  it("tone='auto' equivale a no fijar tono; dark y light lo fijan", () => {
    const { rerender } = render(<DevCredit clientSlug="acme" tone="auto" />);
    expect(link()).not.toHaveAttribute("data-tone");
    rerender(<DevCredit clientSlug="acme" tone="dark" />);
    expect(link()).toHaveAttribute("data-tone", "dark");
    rerender(<DevCredit clientSlug="acme" tone="light" />);
    expect(link()).toHaveAttribute("data-tone", "light");
  });

  it("align pasa a data-align", () => {
    render(<DevCredit clientSlug="acme" align="center" />);
    expect(link()).toHaveAttribute("data-align", "center");
  });

  it("className del sitio se suma a la clase propia, sin sustituirla", () => {
    render(<DevCredit clientSlug="acme" className="pie__credito" />);
    const classes = link().className.split(" ");
    expect(classes).toContain("pie__credito");
    expect(classes).toHaveLength(2);
    expect(classes).not.toContain("undefined");
  });
});

describe("DevCredit · isotipo", () => {
  it("la M se define una vez y se dibuja dos veces: base y capa con degradado", () => {
    render(<DevCredit clientSlug="acme" />);
    const mark = link().querySelector("svg");
    expect(mark?.querySelectorAll("defs path#ms-credit-m")).toHaveLength(1);
    const uses = mark?.querySelectorAll("use") ?? [];
    expect(uses).toHaveLength(2);
    for (const use of uses) expect(use).toHaveAttribute("href", "#ms-credit-m");
    expect(uses[1]).toHaveAttribute("fill", "url(#ms-credit-g)");
    expect(mark?.querySelector("linearGradient#ms-credit-g")).not.toBeNull();
  });

  it("no altera la proporción del isotipo oficial", () => {
    render(<DevCredit clientSlug="acme" />);
    expect(link().querySelector("svg")).toHaveAttribute("viewBox", "0 0 888.5 703.2");
  });
});
