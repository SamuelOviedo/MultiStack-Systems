import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const remember = vi.hoisted(() => vi.fn());
vi.mock("@/lib/packageIntent", () => ({ rememberPackageIntent: remember }));

import { SiteLink } from "@/components/site/SiteLink";
import { isCampaignParam, isInternalTarget, withPreservedSearch } from "@/components/site/siteLinks";

afterEach(() => remember.mockReset());

const GCLID = "Cj0KCQiA0eO8BhDfARIsAL6xmuSDEEZqY_tF6nLDmTK-J4hm2Nq7rP1sUvWxYzaB3_-xY9_Qw-ErTy_UiOp-AsDfGh";

describe("withPreservedSearch", () => {
  it("otra ruta: solo viajan click-ids y utm_*; el resto de la query se queda atrás", () => {
    const search = `?gclid=${GCLID}&utm_source=google&redirect=//evil.test&error=x&code=1&foo=bar`;
    expect(withPreservedSearch("/planes", search, "/")).toBe(`/planes?gclid=${GCLID}&utm_source=google`);
    expect(withPreservedSearch("/login", search, "/")).toBe(`/login?gclid=${GCLID}&utm_source=google`);
  });

  it("misma página (ancla o misma ruta): conserva TODA la query, como requestService de la home", () => {
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
