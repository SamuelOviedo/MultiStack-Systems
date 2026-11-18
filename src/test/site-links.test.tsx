import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const remember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/packageIntent", () => ({ rememberPackageIntent: remember }));

import { SiteLink } from "@/components/site/SiteLink";
import { isInternalTarget, isSafeExternalTarget, withPreservedSearch } from "@/components/site/siteLinks";
import { isCampaignParam } from "@/lib/campaignParams";

afterEach(() => remember.mockReset());

const GCLID = "Cj0KCQiA0eO8BhDfARIsAL6xmuSDEEZqY_tF6nLDmTK-J4hm2Nq7rP1sUvWxYzaB3_-xY9_Qw-ErTy_UiOp-AsDfGh";

describe("withPreservedSearch", () => {
  it("otra ruta: solo viajan click-ids y utm_*; el resto de la query se queda atrás", () => {
    const search = `?gclid=${GCLID}&utm_source=google&redirect=//evil.test&error=x&code=1&foo=bar`;
    expect(withPreservedSearch("/planes", search, "/")).toBe(`/planes?gclid=${GCLID}&utm_source=google`);
    expect(withPreservedSearch("/login", search, "/")).toBe(`/login?gclid=${GCLID}&utm_source=google`);
  });

  it("misma página (ancla o misma ruta): conserva TODA la query, como al ir a un ancla de la home", () => {
    const search = "?gclid=abc&utm_source=x&foo=bar";
    expect(withPreservedSearch("#contacto", search, "/")).toBe("/?gclid=abc&utm_source=x&foo=bar#contacto");
    expect(withPreservedSearch("/#planes", search, "/")).toBe("/?gclid=abc&utm_source=x&foo=bar#planes");
    expect(withPreservedSearch("/contacto", search, "/contacto")).toBe("/contacto?gclid=abc&utm_source=x&foo=bar");
  });

  it("copia los pares tal cual: sin decodificar ni volver a codificar (un gclid con = o ~ sigue válido)", () => {
    const search = "?gclid=AbC_1-2.3~4=&gbraid=ZZ%2F";
    expect(withPreservedSearch("/planes", search, "/")).toBe("/planes?gclid=AbC_1-2.3~4=&gbraid=ZZ%2F");
  });

  it("si el destino trae su propio parámetro, manda el del destino", () => {
    expect(withPreservedSearch("/solicitudes?paquete=combo-emprendedor", "?paquete=otro&gclid=abc", "/")).toBe(
      "/solicitudes?paquete=combo-emprendedor&gclid=abc",
    );
  });

  it("sin query actual deja el destino como está, ancla incluida", () => {
    expect(withPreservedSearch("/planes", "", "/")).toBe("/planes");
    expect(withPreservedSearch("/#planes", "", "/")).toBe("/#planes");
  });

  it("no toca los enlaces externos", () => {
    for (const to of ["https://wa.me/50400000000", "mailto:hola@example.test", "tel:+50400000000", "//otro.test/x"]) {
      expect(withPreservedSearch(to, "?gclid=abc", "/")).toBe(to);
    }
  });

  it("reconoce lo interno y los parámetros de campaña", () => {
    expect(isInternalTarget("/planes")).toBe(true);
    expect(isInternalTarget("#x")).toBe(true);
    expect(isInternalTarget("//otro.test")).toBe(false);
    expect(isInternalTarget("https://a.test")).toBe(false);
    for (const key of ["gclid", "GBRAID", "wbraid", "dclid", "gclsrc", "gad_source", "utm_campaign"]) {
      expect(isCampaignParam(key), key).toBe(true);
    }
    for (const key of ["redirect", "paquete", "token", "error", "code"]) expect(isCampaignParam(key), key).toBe(false);
  });
});

describe("isInternalTarget: lo que el navegador resolvería a otro sitio no es interno", () => {
  it.each([
    "/\\evil.test",
    "/\\/evil.test",
    "\\\\evil.test",
    "\\evil.test",
    "/planes\\x",
    "//evil.test",
    "//",
    "/\t/evil.test",
    "/\n/evil.test",
    "/\r/evil.test",
    "/\u0000/evil.test",
    "#a\\b",
  ])("%j se rechaza", (to) => {
    expect(isInternalTarget(to)).toBe(false);
  });

  it.each(["/", "/planes", "/planes?paquete=combo-emprendedor#x", "/#contacto", "#contacto", "/a/b"])("%j sigue siendo interno", (to) => {
    expect(isInternalTarget(to)).toBe(true);
  });

  it("withPreservedSearch no le añade query a lo rechazado", () => {
    expect(withPreservedSearch("/\\evil.test", "?gclid=abc", "/")).toBe("/\\evil.test");
  });
});

describe("isSafeExternalTarget: solo https:, mailto: y tel:", () => {
  it.each([
    "https://wa.me/50400000000?text=Hola%20MultiStack",
    "HTTPS://example.test/x",
    "mailto:hola@example.test",
    "tel:+50400000000",
  ])("%j se acepta", (to) => {
    expect(isSafeExternalTarget(to)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<b>x</b>",
    "http://example.test",
    "vbscript:x",
    "file:///etc/passwd",
    "blob:https://example.test/x",
    "//evil.test",
    "example.test/x",
    "",
  ])("%j se rechaza", (to) => {
    expect(isSafeExternalTarget(to)).toBe(false);
  });
});

function renderLink(ui: React.ReactElement, path = "/?gclid=abc&utm_source=x&foo=1") {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

describe("SiteLink", () => {
  it("el enlace interno lleva la query de atribución en su href", () => {
    renderLink(<SiteLink to="/planes">Planes</SiteLink>);
    expect(screen.getByRole("link", { name: "Planes" })).toHaveAttribute("href", "/planes?gclid=abc&utm_source=x");
  });

  it("un ancla de la misma página conserva toda la query", () => {
    renderLink(<SiteLink to="#contacto">Contacto</SiteLink>);
    expect(screen.getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "/?gclid=abc&utm_source=x&foo=1#contacto");
  });

  it("el enlace externo no se toca y con target _blank añade rel seguro", () => {
    renderLink(
      <SiteLink to="https://wa.me/50400000000" target="_blank">
        WhatsApp
      </SiteLink>,
    );
    const link = screen.getByRole("link", { name: "WhatsApp" });
    expect(link).toHaveAttribute("href", "https://wa.me/50400000000");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("mailto: y tel: se pintan como enlace", () => {
    renderLink(
      <>
        <SiteLink to="mailto:hola@example.test">Correo</SiteLink>
        <SiteLink to="tel:+50400000000">Llamar</SiteLink>
      </>,
    );
    expect(screen.getByRole("link", { name: "Correo" })).toHaveAttribute("href", "mailto:hola@example.test");
    expect(screen.getByRole("link", { name: "Llamar" })).toHaveAttribute("href", "tel:+50400000000");
  });

  it.each(["javascript:alert(1)", " javascript:alert(1)", "data:text/html,x", "http://example.test", "vbscript:x"])(
    "el destino %j no se pinta como enlace: queda solo el texto",
    (to) => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { container } = renderLink(<SiteLink to={to}>Texto del enlace</SiteLink>);
      expect(screen.queryByRole("link")).toBeNull();
      expect(container.querySelector("a")).toBeNull();
      expect(container.innerHTML).not.toContain("href");
      expect(container.textContent).toBe("Texto del enlace");
      warn.mockRestore();
    },
  );

  it("un destino que el navegador resolvería a otro sitio (/\\host) tampoco es un enlace", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = renderLink(<SiteLink to="/\\evil.test">Texto</SiteLink>);
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("Texto");
    warn.mockRestore();
  });

  it("con packageId guarda la intención con clic y con clic medio, y respeta el onClick del llamador", () => {
    const onClick = vi.fn();
    renderLink(
      <SiteLink to="/solicitudes?paquete=combo-emprendedor" packageId={"combo-emprendedor" as never} onClick={onClick}>
        Cotizar
      </SiteLink>,
    );
    const link = screen.getByRole("link", { name: "Cotizar" });
    fireEvent.click(link);
    expect(remember).toHaveBeenCalledWith("combo-emprendedor");
    expect(onClick).toHaveBeenCalledTimes(1);

    remember.mockClear();
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(remember).toHaveBeenCalledWith("combo-emprendedor");

    remember.mockClear();
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
    expect(remember).not.toHaveBeenCalled();
  });

  it("sin packageId no guarda nada", () => {
    renderLink(<SiteLink to="/planes">Planes</SiteLink>);
    fireEvent.click(screen.getByRole("link", { name: "Planes" }));
    expect(remember).not.toHaveBeenCalled();
  });
});
