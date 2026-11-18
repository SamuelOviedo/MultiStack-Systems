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
    // textContent, no toHaveTextContent: el espacio entre «por» y la marca tiene que existir en el DOM
    // (es lo que se copia, lo que lee el modo lectura y el texto ancla del enlace).
    expect(link().textContent).toBe("Desarrollado por MultiStack Systems");
    expect(link().getAttribute("aria-label")?.startsWith(link().textContent ?? "")).toBe(true);
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

describe("DevCredit · modo sitio propio", () => {
  const OWN_NAME = "Desarrollado por MultiStack Systems";
  const own = () => screen.getByRole("link", { name: OWN_NAME });

  it("enlaza a la home por defecto, en la misma pestaña, sin rel ni UTM", () => {
    render(<DevCredit ownSite />);
    expect(own()).toHaveAttribute("href", "/");
    expect(own()).not.toHaveAttribute("target");
    expect(own()).not.toHaveAttribute("rel");
    expect(own().getAttribute("href")).not.toMatch(/utm_|multistacksystems\.com/);
  });

  it("admite otro destino interno y sigue sin target, rel ni UTM", () => {
    render(<DevCredit ownSite href="/paginas-web" />);
    expect(own()).toHaveAttribute("href", "/paginas-web");
    expect(own()).not.toHaveAttribute("target");
    expect(own()).not.toHaveAttribute("rel");
  });

  it("el tipo de href solo admite rutas internas (tsc lo comprueba)", () => {
    // Si el tipo volviera a ser `string`, cada @ts-expect-error sobraría y tsc fallaría.
    // @ts-expect-error una URL absoluta no es una ruta interna
    const a = <DevCredit ownSite href="https://example.com" />;
    // @ts-expect-error sin «/» inicial tampoco
    const b = <DevCredit ownSite href="paginas-web" />;
    // @ts-expect-error el href es solo del modo propio
    const c = <DevCredit clientSlug="acme" href="/paginas-web" />;
    expect([a, b, c]).toHaveLength(3);
  });

  it("un href que el navegador resolvería a otro origen cae a la home", () => {
    // Se salta el tipo a propósito: «/${string}» admite «//…» y «/\…», que son externas.
    const externos = ["//example.com", "/\\example.com", "/\\\\example.com"] as unknown as `/${string}`[];
    for (const externo of externos) {
      const { unmount } = render(<DevCredit ownSite href={externo} />);
      expect(own()).toHaveAttribute("href", "/");
      unmount();
    }
  });

  it("un href con caracteres de control, que el analizador de URL quita para resolver otro origen, cae a la home", () => {
    // «/<TAB>/host» se analiza como «//host»; el NUL y el resto de controles tampoco son una ruta interna.
    const externos = ["/\t/example.com", "/\n/example.com", "/\r/example.com", "/\u0000/example.com"] as unknown as `/${string}`[];
    for (const externo of externos) {
      const { unmount } = render(<DevCredit ownSite href={externo} />);
      expect(own()).toHaveAttribute("href", "/");
      unmount();
    }
  });

  it("las rutas internas válidas siguen pasando tal cual", () => {
    for (const ruta of ["/", "/planes", "/planes?x=1#a"] as const) {
      const { unmount } = render(<DevCredit ownSite href={ruta} />);
      expect(own()).toHaveAttribute("href", ruta);
      unmount();
    }
  });

  it("el nombre accesible no avisa de pestaña nueva y abre con el texto visible", () => {
    render(<DevCredit ownSite />);
    expect(own().getAttribute("aria-label")).toBe("Desarrollado por MultiStack Systems");
    expect(own().textContent).toBe("Desarrollado por MultiStack Systems");
    expect(screen.queryByRole("link", { name: NAME })).toBeNull();
  });

  it("el isotipo, la flecha y las variantes son idénticos a los del modo cliente", () => {
    const { container: client } = render(<DevCredit clientSlug="acme" tone="dark" align="center" className="pie" />);
    const { container: propio } = render(<DevCredit ownSite tone="dark" align="center" className="pie" />);
    const a = client.querySelector("a")!;
    const b = propio.querySelector("a")!;
    expect([...b.children].map((el) => el.outerHTML)).toEqual([...a.children].map((el) => el.outerHTML));
    expect(b.className).toBe(a.className);
    expect(b.getAttribute("data-tone")).toBe(a.getAttribute("data-tone"));
    expect(b.getAttribute("data-align")).toBe(a.getAttribute("data-align"));
    // Mismo texto (el ancla): el modo no cambia lo visible.
    expect(b.textContent).toBe(a.textContent);
  });

  it("los SVG siguen ocultos a los lectores de pantalla", () => {
    render(<DevCredit ownSite />);
    const svgs = own().querySelectorAll("svg");
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg).toHaveAttribute("aria-hidden", "true");
      expect(svg).toHaveAttribute("focusable", "false");
    }
  });
});
