import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
  user: null as null | { id: string },
  userType: null as null | number,
  loading: false,
}));
const signOut = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: session.user, userType: session.userType, loading: session.loading, signOut }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));

import { SiteHeader, type SiteHeaderProps } from "@/components/site/SiteHeader";
import { SiteLayout } from "@/components/site/SiteLayout";
import { getOpenTicketsCount } from "@/lib/tickets";

const NAV = [
  { to: "/", label: "Inicio" },
  { to: "/planes", label: "Planes" },
  { to: "/servicios", label: "Servicios" },
  { to: "/contacto", label: "Contacto" },
];
const CTA = { label: "Cotizar mi web", to: "/solicitudes?paquete=combo-emprendedor" };
const HEADER: SiteHeaderProps = { nav: NAV, cta: CTA };

function Where() {
  const { pathname, search, hash } = useLocation();
  return <output data-testid="where">{`${pathname}${search}${hash}`}</output>;
}

function renderHeader(path = "/", props: SiteHeaderProps = HEADER) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteHeader {...props} />
      <Where />
    </MemoryRouter>,
  );
}

/** El panel del menú móvil: el elemento al que apunta aria-controls del botón. */
const toggle = () => screen.getByRole("button", { name: "Menú" });
const panel = () => document.getElementById(toggle().getAttribute("aria-controls") ?? "") as HTMLElement;
const desktop = () => screen.getByRole("navigation", { name: "Principal" }).parentElement as HTMLElement;
const where = () => screen.getByTestId("where").textContent;

beforeEach(() => {
  session.user = null;
  session.userType = null;
  session.loading = false;
  signOut.mockReset().mockResolvedValue(undefined);
  vi.mocked(getOpenTicketsCount).mockReset().mockResolvedValue(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SiteHeader: navegación y sesión", () => {
  it("sin sesión: píldoras con la activa marcada, [ mi panel ] hacia /login y el CTA", () => {
    renderHeader("/planes");
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual(["Inicio", "Planes", "Servicios", "Contacto"]);
    expect(nav.getByRole("link", { name: "Planes" })).toHaveAttribute("aria-current", "page");
    expect(nav.getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current");

    const bar = within(desktop());
    expect(bar.getByRole("link", { name: "[ mi panel ]" })).toHaveAttribute("href", "/login");
    expect(bar.getByRole("link", { name: "Cotizar mi web" })).toHaveAttribute("href", "/solicitudes?paquete=combo-emprendedor");
    expect(getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("el logo es un enlace a la home con nombre accesible", () => {
    renderHeader("/planes");
    expect(screen.getByRole("link", { name: "MultiStack Systems, ir al inicio" })).toHaveAttribute("href", "/");
  });

  it("cliente: [ SOLICITUDES ] y [ SALIR ]; ni CTA ni enlaces administrativos", () => {
    session.user = { id: "u1" };
    session.userType = 2;
    renderHeader();
    const bar = within(desktop());
    expect(bar.getByRole("link", { name: "[ SOLICITUDES ]" })).toHaveAttribute("href", "/solicitudes");
    expect(bar.getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    expect(bar.queryByRole("link", { name: "Cotizar mi web" })).toBeNull();
    expect(bar.queryByText(/PANEL|TICKETS|mi panel/)).toBeNull();
    expect(getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("administrador: [ PANEL ], [ TICKETS ] con el contador de abiertos y [ SALIR ]", async () => {
    session.user = { id: "u1" };
    session.userType = 0;
    vi.mocked(getOpenTicketsCount).mockResolvedValue(7);
    renderHeader();
    const bar = within(desktop());
    expect(bar.getByRole("link", { name: "[ PANEL ]" })).toHaveAttribute("href", "/dashboard");
    const tickets = bar.getByRole("link", { name: /\[ TICKETS \]/ });
    expect(tickets).toHaveAttribute("href", "/dashboard/tickets");
    await waitFor(() => expect(tickets).toHaveTextContent("7"));
    expect(tickets).toHaveAccessibleName("[ TICKETS ] 7 abiertos");
    expect(bar.getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    expect(bar.queryByRole("link", { name: "Cotizar mi web" })).toBeNull();
  });

  it("administrador sin tickets abiertos no pinta el contador", async () => {
    session.user = { id: "u1" };
    session.userType = 0;
    renderHeader();
    await waitFor(() => expect(getOpenTicketsCount).toHaveBeenCalled());
    expect(within(desktop()).getByRole("link", { name: "[ TICKETS ]" })).toBeInTheDocument();
  });

  it("colaborador (1) y rol sin resolver (null): solo [ SALIR ], sin consultas administrativas", () => {
    session.user = { id: "u1" };
    for (const type of [1, null]) {
      session.userType = type;
      const { unmount } = renderHeader();
      const bar = within(desktop());
      expect(bar.getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
      expect(bar.queryByRole("link", { name: /PANEL|TICKETS|SOLICITUDES|mi panel/ })).toBeNull();
      unmount();
    }
    expect(getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("mientras la sesión carga no ofrece acciones de cuenta", () => {
    session.loading = true;
    renderHeader();
    const bar = within(desktop());
    expect(bar.queryByRole("link", { name: "[ mi panel ]" })).toBeNull();
    expect(bar.queryByRole("button", { name: "[ SALIR ]" })).toBeNull();
  });

  it("[ SALIR ] cierra la sesión y vuelve a la home", async () => {
    session.user = { id: "u1" };
    session.userType = 2;
    renderHeader("/planes");
    fireEvent.click(within(desktop()).getByRole("button", { name: "[ SALIR ]" }));
    await waitFor(() => expect(where()).toBe("/"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("los textos de la interfaz se pueden sustituir por props", () => {
    renderHeader("/", { ...HEADER, labels: { login: "[ ingresar ]", menu: "Abrir navegación" } });
    expect(within(desktop()).getByRole("link", { name: "[ ingresar ]" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir navegación" })).toBeInTheDocument();
  });
});

describe("SiteHeader: conserva la query de atribución", () => {
  const SEARCH = "?gclid=abc&utm_source=x&redirect=//evil.test&foo=1";

  it("a otra vista viajan click-ids y utm; los parámetros funcionales no llegan a /login ni a las vistas", () => {
    renderHeader(`/planes${SEARCH}`);
    const bar = within(desktop());
    expect(screen.getByRole("link", { name: "MultiStack Systems, ir al inicio" })).toHaveAttribute("href", "/?gclid=abc&utm_source=x");
    expect(within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", { name: "Servicios" })).toHaveAttribute(
      "href",
      "/servicios?gclid=abc&utm_source=x",
    );
    expect(bar.getByRole("link", { name: "[ mi panel ]" })).toHaveAttribute("href", "/login?gclid=abc&utm_source=x");
    expect(bar.getByRole("link", { name: "Cotizar mi web" })).toHaveAttribute(
      "href",
      "/solicitudes?paquete=combo-emprendedor&gclid=abc&utm_source=x",
    );
  });

  it("navegar con un enlace del encabezado deja la query en la URL", () => {
    renderHeader(`/${SEARCH}`);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", { name: "Contacto" }));
    expect(where()).toBe("/contacto?gclid=abc&utm_source=x");
  });

  it("el menú móvil usa los mismos destinos", () => {
    renderHeader(`/planes${SEARCH}`);
    fireEvent.click(toggle());
    expect(within(panel()).getByRole("link", { name: "Contacto" })).toHaveAttribute("href", "/contacto?gclid=abc&utm_source=x");
    expect(within(panel()).getByRole("link", { name: "Cotizar mi web" })).toHaveAttribute(
      "href",
      "/solicitudes?paquete=combo-emprendedor&gclid=abc&utm_source=x",
    );
  });
});

describe("SiteHeader: menú móvil", () => {
  it("el botón declara aria-expanded y aria-controls; el panel existe y está oculto al inicio", () => {
    renderHeader();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveAttribute("aria-controls");
    expect(panel()).toBeInTheDocument();
    expect(panel()).not.toBeVisible();
  });

  it("abrir y cerrar con el botón", () => {
    renderHeader();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
  });

  it("el panel trae la navegación, el acceso y el CTA", () => {
    renderHeader("/servicios");
    fireEvent.click(toggle());
    const menu = within(panel());
    expect(menu.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Inicio",
      "Planes",
      "Servicios",
      "Contacto",
      "[ mi panel ]",
      "Cotizar mi web",
    ]);
    expect(menu.getByRole("link", { name: "Servicios" })).toHaveAttribute("aria-current", "page");
  });

  it("Escape lo cierra y devuelve el foco al botón", () => {
    renderHeader();
    fireEvent.click(toggle());
    within(panel()).getByRole("link", { name: "Planes" }).focus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveFocus();
  });

  it("Escape no hace nada con el menú cerrado", () => {
    renderHeader();
    const other = document.createElement("button");
    document.body.append(other);
    other.focus();
    fireEvent.keyDown(other, { key: "Escape" });
    expect(other).toHaveFocus();
    other.remove();
  });

  it("se cierra al navegar", () => {
    renderHeader("/");
    fireEvent.click(toggle());
    fireEvent.click(within(panel()).getByRole("link", { name: "Planes" }));
    expect(where()).toBe("/planes");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeVisible();
  });

  it("se cierra al crecer la ventana hasta el escritorio", () => {
    let onChange: (() => void) | undefined;
    const list = {
      matches: false,
      addEventListener: (_: string, cb: () => void) => void (onChange = cb),
      removeEventListener: () => void (onChange = undefined),
    };
    vi.stubGlobal("matchMedia", () => list);
    renderHeader();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    list.matches = true;
    act(() => onChange?.());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("con sesión de administrador el menú ofrece panel, tickets y salir, sin CTA", async () => {
    session.user = { id: "u1" };
    session.userType = 0;
    vi.mocked(getOpenTicketsCount).mockResolvedValue(3);
    renderHeader();
    await waitFor(() => expect(getOpenTicketsCount).toHaveBeenCalled());
    fireEvent.click(toggle());
    const menu = within(panel());
    expect(menu.getByRole("link", { name: "[ PANEL ]" })).toHaveAttribute("href", "/dashboard");
    expect(await menu.findByRole("link", { name: "[ TICKETS ] 3 abiertos" })).toHaveAttribute("href", "/dashboard/tickets");
    expect(menu.getByRole("button", { name: "[ SALIR ]" })).toBeInTheDocument();
    expect(menu.queryByRole("link", { name: "Cotizar mi web" })).toBeNull();
  });

  it("[ SALIR ] del menú cierra la sesión, vuelve a la home y cierra el menú", async () => {
    session.user = { id: "u1" };
    session.userType = 2;
    renderHeader("/planes");
    fireEvent.click(toggle());
    fireEvent.click(within(panel()).getByRole("button", { name: "[ SALIR ]" }));
    await waitFor(() => expect(where()).toBe("/"));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });
});

describe("SiteLayout", () => {
  const FOOTER = {
    tagline: "Soluciones con código propio.",
    columns: [
      {
        title: "// sitio",
        links: [
          { label: "Política de privacidad", to: "/politica-de-privacidad" },
          { label: "Términos del servicio", to: "/terminos-del-servicio" },
        ],
      },
      { title: "// contacto", links: [{ label: "WhatsApp", to: "https://wa.me/50400000000", newTab: true }], lines: ["Siguatepeque"] },
    ],
    copyright: "© 2026 MultiStack Systems.",
  };

  function renderLayout(path = "/planes?gclid=abc&foo=1") {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <SiteLayout header={HEADER} footer={FOOTER}>
          <h1>Contenido</h1>
        </SiteLayout>
      </MemoryRouter>,
    );
  }

  it("envuelve cabecera, main y pie dentro del ámbito .ms-site", () => {
    const { container } = renderLayout();
    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass("ms-site");
    expect(within(root).getByRole("banner")).toBeInTheDocument();
    expect(within(within(root).getByRole("main")).getByRole("heading", { name: "Contenido" })).toBeInTheDocument();
    expect(within(root).getByRole("contentinfo")).toBeInTheDocument();
  });

  it("el pie enlaza a las páginas legales, conserva la atribución y abre WhatsApp en otra pestaña", () => {
    renderLayout();
    const footer = within(screen.getByRole("contentinfo"));
    expect(footer.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/politica-de-privacidad?gclid=abc");
    expect(footer.getByRole("link", { name: "Términos del servicio" })).toHaveAttribute("href", "/terminos-del-servicio?gclid=abc");
    const whatsapp = footer.getByRole("link", { name: "WhatsApp" });
    expect(whatsapp).toHaveAttribute("href", "https://wa.me/50400000000");
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(footer.getByText("Siguatepeque")).toBeInTheDocument();
    expect(footer.getByText("© 2026 MultiStack Systems.")).toBeInTheDocument();
  });

  it("el enlace de salto mueve el foco a main sin cambiar la URL", () => {
    renderLayout();
    // jsdom no implementa scrollIntoView.
    Element.prototype.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole("link", { name: "Saltar al contenido" }));
    expect(screen.getByRole("main")).toHaveFocus();
    expect(screen.getByRole("main")).toHaveAttribute("tabindex", "-1");
  });
});
