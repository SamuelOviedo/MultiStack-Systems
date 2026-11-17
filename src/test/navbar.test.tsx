import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const session = vi.hoisted(() => ({ user: null as null | { id: string }, userType: null as null | number }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: session.user, userType: session.userType, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn().mockResolvedValue(0) }));
const themeState = vi.hoisted(() => ({ resolvedTheme: "dark" }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme, setTheme: vi.fn() }),
}));

import Navbar from "@/components/common/Navbar";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { PACKAGE_INTENT_KEY } from "@/lib/packageIntent";
import { getOpenTicketsCount } from "@/lib/tickets";
import { HOME_CONTENT } from "@/pages/marketing/homeContent";

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let ioCallbacks: IOCallback[] = [];

class FakeIntersectionObserver {
  constructor(cb: IOCallback) {
    ioCallbacks.push(cb);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const cross = (id: string, isIntersecting: boolean) =>
  act(() => {
    for (const cb of ioCallbacks) cb([{ target: document.getElementById(id)!, isIntersecting }]);
  });

// Las anclas de la home: salen de HOME_CONTENT.nav (Combo, Planes, Proceso, Preguntas, Contacto).
const SECTIONS = HOME_CONTENT.nav.items.map((item) => `<section id="${item.href.slice(1)}"></section>`).join("");

beforeEach(() => {
  themeState.resolvedTheme = "dark";
  session.user = null;
  session.userType = null;
  // restoreAllMocks (afterEach) deja el mock sin valor: el administrador consulta el conteo de tickets.
  vi.mocked(getOpenTicketsCount).mockResolvedValue(0);
  ioCallbacks = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("useScrollSpy", () => {
  it("marca la sección que cruza la línea y vuelve a null fuera de ellas", () => {
    document.body.innerHTML = SECTIONS;
    const ids = ["combo-emprendedor", "planes"] as const;
    const { result } = renderHook(() => useScrollSpy(ids));
    expect(result.current).toBeNull();
    cross("planes", true);
    expect(result.current).toBe("planes");
    cross("planes", false);
    expect(result.current).toBeNull();
  });

  it("no observa cuando está deshabilitado", () => {
    renderHook(() => useScrollSpy(["combo-emprendedor"], false));
    expect(ioCallbacks).toHaveLength(0);
  });
});

/** El cajón es un portal de Radix: se cierra antes de que afterEach vacíe el body. */
const closeDrawer = async (dialog: HTMLElement) => {
  fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar menú" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 });
};

describe("Navbar", () => {
  const renderAt = (path: string, variant?: "default" | "overlay", withHomeNav = true) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Navbar variant={variant} homeNav={withHomeNav ? HOME_CONTENT.nav : undefined} />
      </MemoryRouter>,
    );

  it("marca el enlace activo con aria-current según el scroll spy", () => {
    document.body.innerHTML = SECTIONS;
    renderAt("/", "overlay");
    cross("proceso", true);
    expect(screen.getByRole("button", { name: "Proceso" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("button", { name: "Combo" })).not.toHaveAttribute("aria-current");
  });

  it("en la home muestra los enlaces de HOME_CONTENT.nav y el botón «Solicitar Combo» hacia /solicitudes?paquete=", () => {
    renderAt("/");
    expect(HOME_CONTENT.nav.items.map((i) => i.label)).toEqual(["Combo", "Planes", "Proceso", "Preguntas", "Contacto"]);
    for (const item of HOME_CONTENT.nav.items) {
      expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();
    }
    const cta = screen.getByRole("link", { name: "Solicitar Combo Emprendedor" });
    expect(cta).toHaveTextContent("Solicitar Combo");
    expect(cta).toHaveAttribute("href", "/solicitudes?paquete=combo-emprendedor");
    // Los enlaces antiguos de la landing de IA ya no están.
    for (const old of ["Servicios", "Engineering", "Empresa"]) expect(screen.queryByRole("button", { name: old })).toBeNull();
  });

  it("el botón «Solicitar Combo» guarda la intención de paquete (clic y clic del medio)", () => {
    localStorage.clear();
    // El clic navega a /solicitudes y la barra deja de ser la de la home: cada gesto, en su propio montaje.
    const click = renderAt("/");
    fireEvent.click(screen.getByRole("link", { name: "Solicitar Combo Emprendedor" }));
    expect(JSON.parse(localStorage.getItem(PACKAGE_INTENT_KEY)!).id).toBe("combo-emprendedor");
    click.unmount();

    localStorage.clear();
    renderAt("/");
    const cta = screen.getByRole("link", { name: "Solicitar Combo Emprendedor" });
    fireEvent(cta, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
    expect(localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
    fireEvent(cta, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(JSON.parse(localStorage.getItem(PACKAGE_INTENT_KEY)!).id).toBe("combo-emprendedor");
    localStorage.clear();
  });

  it.each([
    ["administrador", 0],
    ["cliente", 2],
  ] as const)("con sesión de %s no aparece «Solicitar Combo» (ni en la barra ni en el menú) pero sí los enlaces de sección", async (_name, type) => {
    session.user = { id: "u1" };
    session.userType = type;
    renderAt("/");
    expect(screen.queryByRole("link", { name: /Solicitar Combo/ })).toBeNull();
    for (const item of HOME_CONTENT.nav.items) expect(screen.getByRole("button", { name: item.label })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    expect(within(dialog).queryByRole("link", { name: /Solicitar Combo/ })).toBeNull();
    for (const item of HOME_CONTENT.nav.items) expect(within(dialog).getByRole("button", { name: new RegExp(item.label) })).toBeInTheDocument();
    await closeDrawer(dialog);
  });

  it("sin sesión el menú trae el botón «Solicitar Combo» antes de los enlaces", async () => {
    renderAt("/");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    expect(within(dialog).getByRole("link", { name: /Solicitar Combo/ })).toHaveAttribute(
      "href",
      "/solicitudes?paquete=combo-emprendedor",
    );
    await closeDrawer(dialog);
  });

  it("sin homeNav no hay enlaces de sección ni botón, aunque la ruta sea \"/\"", () => {
    renderAt("/", "default", false);
    expect(screen.queryByRole("button", { name: "Combo" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Solicitar Combo/ })).toBeNull();
    // La sesión sigue igual: el botón de acceso está.
    expect(screen.getByRole("link", { name: "[ ACCEDER ]" })).toBeInTheDocument();
  });

  it("el logo sube al inicio de la página y avisa a la página al ir a una sección", () => {
    document.body.innerHTML = SECTIONS;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.getElementById("contacto")!.getBoundingClientRect = () => ({ top: 900 }) as DOMRect;
    const onHomeNavigate = vi.fn();
    const { container } = render(
      <MemoryRouter initialEntries={["/"]}>
        <Navbar homeNav={HOME_CONTENT.nav} onHomeNavigate={onHomeNavigate} />
      </MemoryRouter>,
    );

    fireEvent.click(container.querySelector('nav a[href="/"]')!);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 0 }));

    fireEvent.click(screen.getByRole("button", { name: "Contacto" }));
    expect(onHomeNavigate).toHaveBeenCalledWith("contacto");
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ top: 900 + window.scrollY - 72 }));
  });

  it("el drawer se cierra al elegir un enlace y desplaza justo debajo de la barra", async () => {
    document.body.innerHTML = SECTIONS;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.getElementById("planes")!.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    renderAt("/");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    // Lazy drawer chunk: generous timeout so a busy CI machine does not flake.
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    fireEvent.click(within(dialog).getByRole("button", { name: /Planes/ }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 5000 });
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 500 + window.scrollY - 72 }));
  });

  it("overlay sigue el tema de las escenas: vidrio oscuro + logo blanco / vidrio claro + logo con tema", () => {
    const cine = document.createElement("div");
    cine.setAttribute("data-nav-overlay", "");
    cine.getBoundingClientRect = () => ({ bottom: 900 }) as DOMRect;
    document.body.appendChild(cine);

    const dark = renderAt("/", "overlay");
    expect(dark.container.querySelector("nav")!.style.background).toBe("rgba(8, 15, 30, 0.3)");
    expect(dark.container.querySelectorAll("nav img")).toHaveLength(2); // solo la versión «oscuro»: isotipo + rótulo
    expect(dark.container.querySelectorAll('nav img[data-brand-theme="claro"]')).toHaveLength(0);
    dark.unmount();

    themeState.resolvedTheme = "light";
    const light = renderAt("/", "overlay");
    expect(light.container.querySelector("nav")!.style.background).toBe("rgba(255, 255, 255, 0.5)");
    expect(light.container.querySelectorAll("nav img")).toHaveLength(4); // logo según tema: isotipo + rótulo, claro y oscuro
  });

  it("fuera de la landing ignora variant='overlay' y no muestra enlaces de sección", () => {
    const cine = document.createElement("div");
    cine.setAttribute("data-nav-overlay", "");
    cine.getBoundingClientRect = () => ({ bottom: 900 }) as DOMRect;
    document.body.appendChild(cine);

    const { container } = renderAt("/dashboard", "overlay");
    const nav = container.querySelector("nav")!;
    expect(nav.style.background).not.toBe("rgba(8, 15, 30, 0.3)");
    expect(container.querySelectorAll("nav img")).toHaveLength(4); // logo con tema: isotipo + rótulo, claro y oscuro
    expect(screen.queryByRole("button", { name: "Combo" })).toBeNull();
    expect(screen.queryByRole("link", { name: /Solicitar Combo/ })).toBeNull();
  });
});
