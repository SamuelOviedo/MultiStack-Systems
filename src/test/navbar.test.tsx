import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn().mockResolvedValue(0) }));
const themeState = vi.hoisted(() => ({ resolvedTheme: "dark" }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme, setTheme: vi.fn() }),
}));

import Navbar from "@/components/common/Navbar";
import { useScrollSpy } from "@/hooks/useScrollSpy";

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

const SECTIONS = '<section id="productos"></section><section id="stack"></section><div id="empresa"></div><section id="contacto"></section>';

beforeEach(() => {
  themeState.resolvedTheme = "dark";
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
    const ids = ["productos", "stack"] as const;
    const { result } = renderHook(() => useScrollSpy(ids));
    expect(result.current).toBeNull();
    cross("stack", true);
    expect(result.current).toBe("stack");
    cross("stack", false);
    expect(result.current).toBeNull();
  });

  it("no observa cuando está deshabilitado", () => {
    renderHook(() => useScrollSpy(["productos"], false));
    expect(ioCallbacks).toHaveLength(0);
  });
});

describe("Navbar", () => {
  const renderAt = (path: string, variant?: "default" | "overlay") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Navbar variant={variant} />
      </MemoryRouter>,
    );

  it("marca el enlace activo con aria-current según el scroll spy", () => {
    document.body.innerHTML = SECTIONS;
    renderAt("/", "overlay");
    cross("empresa", true);
    expect(screen.getByRole("button", { name: "Empresa" })).toHaveAttribute("aria-current", "location");
    expect(screen.getByRole("button", { name: "Servicios" })).not.toHaveAttribute("aria-current");
  });

  it("el drawer se cierra al elegir un enlace y desplaza justo debajo de la barra", async () => {
    document.body.innerHTML = SECTIONS;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    document.getElementById("productos")!.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    renderAt("/");

    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    // Lazy drawer chunk: generous timeout so a busy CI machine does not flake.
    const dialog = await screen.findByRole("dialog", {}, { timeout: 5000 });
    fireEvent.click(within(dialog).getByRole("button", { name: /Servicios/ }));

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
    expect(dark.container.querySelectorAll("nav img")).toHaveLength(1); // solo logo blanco
    dark.unmount();

    themeState.resolvedTheme = "light";
    const light = renderAt("/", "overlay");
    expect(light.container.querySelector("nav")!.style.background).toBe("rgba(255, 255, 255, 0.5)");
    expect(light.container.querySelectorAll("nav img")).toHaveLength(2); // logo según tema (negro en claro)
  });

  it("fuera de la landing ignora variant='overlay' y no muestra enlaces de sección", () => {
    const cine = document.createElement("div");
    cine.setAttribute("data-nav-overlay", "");
    cine.getBoundingClientRect = () => ({ bottom: 900 }) as DOMRect;
    document.body.appendChild(cine);

    const { container } = renderAt("/dashboard", "overlay");
    const nav = container.querySelector("nav")!;
    expect(nav.style.background).not.toBe("rgba(8, 15, 30, 0.3)");
    expect(container.querySelectorAll("nav img")).toHaveLength(2); // logo con tema
    expect(screen.queryByRole("button", { name: "Servicios" })).toBeNull();
  });
});
