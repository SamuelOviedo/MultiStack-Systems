// Shell del administrador: landmarks, navegación por rol, sección «Próximamente» plegable, cajón móvil con
// foco atrapado, selector de tema, plegado persistente, cabecera (cuenta, migas en una línea, áreas táctiles de 44 px),
// cierre de sesión, portal dentro de `.erp` y movimiento reducido.
import { lazy, Suspense } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import shellSource from "@/components/admin/AdminShell.tsx?raw";
import navListSource from "@/components/admin/AdminNavList.tsx?raw";

// Vitest no procesa `?raw` de CSS: se lee del disco.
const cssSource = readFileSync(path.resolve(__dirname, "../index.css"), "utf8");

const authState = vi.hoisted(() => ({
  user: { id: "u-1", email: "admin@example.test" } as { id: string; email: string } | null,
  userType: 0 as number | null,
  loading: false,
  signOut: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));

const ticketsMock = vi.hoisted(() => ({ getOpenTicketsCount: vi.fn() }));
vi.mock("@/lib/tickets", () => ticketsMock);

const themeState = vi.hoisted(() => ({ resolvedTheme: "dark" as string | undefined, setTheme: vi.fn() }));
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme, setTheme: themeState.setTheme }),
}));

import AdminShell from "@/components/admin/AdminShell";
import { SIDEBAR_STORAGE_KEY } from "@/components/admin/useSidebarCollapsed";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  authState.user = { id: "u-1", email: "admin@example.test" };
  authState.userType = 0;
  authState.signOut = vi.fn().mockResolvedValue(undefined);
  themeState.resolvedTheme = "dark";
  themeState.setTheme = vi.fn();
  // Por defecto la consulta no termina: ningún estado cambia fuera de act. Cada prueba que necesita un conteo lo fija.
  ticketsMock.getOpenTicketsCount.mockReset().mockReturnValue(new Promise(() => {}));
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderShell(path = "/dashboard", children: React.ReactNode = <p>Contenido de prueba</p>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard/*" element={<AdminShell>{children}</AdminShell>} />
        <Route path="/" element={<p>Landing simulada</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const sidebar = () => document.getElementById("admin-sidebar")!;

describe("landmarks y estructura", () => {
  it("expone nav, header y main con nombre, más un enlace para saltar al contenido", () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("id", "contenido");
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Migas de pan" })).toBeInTheDocument();
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getAllByRole("banner")).toHaveLength(1);
  });

  it("el contenedor lleva la clase `.erp` y las páginas quedan dentro de main", () => {
    const { container } = renderShell();
    expect(container.firstElementChild).toHaveClass("erp");
    expect(within(screen.getByRole("main")).getByText("Contenido de prueba")).toBeInTheDocument();
  });

  it("«Saltar al contenido» mueve el foco a main sin tocar el hash de la URL", () => {
    renderShell();
    fireEvent.click(screen.getByRole("link", { name: "Saltar al contenido" }));
    expect(screen.getByRole("main")).toHaveFocus();
    expect(window.location.hash).toBe("");
  });

  it("ofrece «Ver sitio» hacia la landing y el logotipo hacia el resumen", () => {
    renderShell();
    expect(screen.getByRole("link", { name: "Ver sitio" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "MultiStack Systems" })).toHaveAttribute("href", "/dashboard");
  });

  it("mientras la página carga (lazy) el armazón sigue visible con su indicador", async () => {
    let release!: () => void;
    const Slow = lazy(
      () =>
        new Promise<{ default: () => JSX.Element }>((resolve) => {
          release = () => resolve({ default: () => <p>Página cargada</p> });
        }),
    );
    renderShell("/dashboard", <Slow />);
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(screen.queryByText("Página cargada")).toBeNull();
    release();
    expect(await screen.findByText("Página cargada")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
  });
});

describe("navegación y aria-current", () => {
  const current = () => screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");

  it("/dashboard marca Resumen y solo Resumen", () => {
    renderShell("/dashboard");
    expect(current().map((l) => l.textContent)).toEqual(["Resumen"]);
  });

  it("/dashboard/tickets marca Tickets", () => {
    renderShell("/dashboard/tickets");
    expect(current().map((l) => l.textContent)).toContain("Tickets");
    expect(screen.getByRole("link", { name: /Tickets/ })).toHaveAttribute("aria-current", "page");
  });

  it("el detalle de un proyecto marca Proyectos y la miga final lleva aria-current", () => {
    renderShell("/dashboard/project/abc");
    expect(screen.getByRole("link", { name: "Proyectos", current: "page" })).toBeInTheDocument();
    const crumbs = within(screen.getByRole("navigation", { name: "Migas de pan" }));
    expect(crumbs.getByText("Detalle")).toHaveAttribute("aria-current", "page");
    expect(crumbs.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/dashboard/proyectos");
  });

  it("los enlaces reales apuntan a las rutas existentes y a ninguna otra", () => {
    renderShell();
    const hrefs = within(screen.getByRole("navigation", { name: "Principal" }))
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    // Por la entrada «Cotizaciones»: se suma /dashboard/cotizaciones a las rutas del menú.
    expect(hrefs.sort()).toEqual(["/dashboard", "/dashboard/cotizaciones", "/dashboard/proyectos", "/dashboard/tickets"]);
  });

  it("navegar con el teclado: los enlaces son tabulables y activar uno cambia la ruta", () => {
    renderShell("/dashboard");
    const tickets = screen.getByRole("link", { name: /Tickets/ });
    expect(tickets).not.toHaveAttribute("tabindex", "-1");
    tickets.focus();
    expect(tickets).toHaveFocus();
    fireEvent.click(tickets);
    expect(screen.getByRole("link", { name: /Tickets/ })).toHaveAttribute("aria-current", "page");
  });
});

describe("visibilidad por rol (solo presentación)", () => {
  it("el administrador ve primero lo disponible (3 grupos) y los grupos sin entradas disponibles no se dibujan", () => {
    renderShell();
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    for (const group of ["Inicio", "Gestión comercial", "Soporte"]) {
      expect(nav.getByRole("list", { name: group })).toBeInTheDocument();
    }
    // Con «Próximamente» cerrada, Finanzas, Operaciones y Administración no ocupan lugar en la barra.
    for (const group of ["Finanzas", "Centro de Operaciones", "Administración"]) {
      expect(nav.queryByRole("list", { name: group }), group).toBeNull();
    }
    // Por la entrada «Cotizaciones»: 4 enlaces (Resumen, Proyectos, Cotizaciones y Tickets) en los mismos 3 grupos.
    expect(nav.getAllByRole("link")).toHaveLength(4);
    expect(within(nav.getByRole("list", { name: "Gestión comercial" })).getAllByRole("link").map((a) => a.textContent)).toEqual([
      "Proyectos",
      "Cotizaciones",
    ]);
  });

  it("el colaborador no ve ninguna entrada ni sección «Próximamente» (el panel es solo del administrador)", () => {
    authState.userType = 1;
    renderShell();
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.queryAllByRole("link")).toHaveLength(0);
    expect(nav.queryAllByRole("listitem")).toHaveLength(0);
    for (const text of ["Resumen", "Proyectos", "Cotizaciones", "Tickets", "Inicio", "Gestión comercial", "Soporte", "Finanzas", "Administración", "Clientes"]) {
      expect(nav.queryByText(text), text).toBeNull();
    }
    expect(nav.queryByRole("button", { name: /Próximamente/ })).toBeNull();
  });

  it("con el rol sin resolver no aparece nada exclusivo del administrador (ni la sección «Próximamente»)", () => {
    authState.userType = null;
    renderShell();
    expect(screen.queryByText("Finanzas")).toBeNull();
    expect(screen.queryByText("Equipo y roles")).toBeNull();
    expect(screen.queryByRole("button", { name: /Próximamente/ })).toBeNull();
  });
});

describe("sección «Próximamente»", () => {
  const nav = () => screen.getByRole("navigation", { name: "Principal" });
  const toggle = () => within(nav()).getByRole("button", { name: /Próximamente/ });
  const panel = () => document.getElementById(toggle().getAttribute("aria-controls")!)!;

  it("es un botón cerrado por defecto con el número de módulos, aria-expanded y aria-controls al panel", () => {
    renderShell();
    const t = toggle();
    expect(t.tagName).toBe("BUTTON");
    expect(t).toHaveAttribute("type", "button");
    expect(t).toHaveAttribute("aria-expanded", "false");
    expect(t).toHaveAccessibleName("Próximamente 8 módulos");
    expect(t.textContent).toContain("8");
    expect(panel()).not.toBeNull();
    expect(panel()).toHaveAttribute("hidden");
    expect(panel()).not.toBeVisible();
    expect(nav().contains(panel())).toBe(true);
  });

  it("va al final de la barra, después de todos los grupos disponibles", () => {
    renderShell();
    const items = Array.from(nav().querySelectorAll("a[href], button"));
    expect(items.map((el) => el.getAttribute("href") ?? "boton")).toEqual([
      "/dashboard",
      "/dashboard/proyectos",
      "/dashboard/cotizaciones", // Por la entrada «Cotizaciones»: va tras Proyectos, dentro de Gestión comercial.
      "/dashboard/tickets",
      "boton",
    ]);
  });

  it("al abrirla muestra cada módulo bajo su área y no repite «Pronto» ocho veces", () => {
    renderShell();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).not.toHaveAttribute("hidden");
    expect(panel()).toBeVisible();
    const areas = within(panel());
    const porArea: Record<string, string[]> = {
      "Gestión comercial": ["Clientes", "Servicios y renovaciones"],
      Finanzas: ["Cobros y comprobantes", "Costos y márgenes"],
      "Centro de Operaciones": ["Recursos e infraestructura", "Integraciones"],
      Administración: ["Equipo y roles", "Auditoría"],
    };
    for (const [area, modulos] of Object.entries(porArea)) {
      const lista = areas.getByRole("list", { name: area });
      expect(within(lista).getAllByRole("listitem").map((li) => li.textContent), area).toEqual(modulos);
    }
    expect(within(nav()).queryAllByText(/pronto/i)).toHaveLength(0);
  });

  it("los módulos son texto con aria-disabled: sin enlace, sin href, sin foco y no son la página actual", () => {
    renderShell();
    fireEvent.click(toggle());
    const disabled = Array.from(nav().querySelectorAll('[aria-disabled="true"]'));
    expect(disabled).toHaveLength(8);
    for (const el of disabled) {
      expect(el.tagName).toBe("SPAN");
      expect(el).not.toHaveAttribute("href");
      expect(el).not.toHaveAttribute("tabindex");
      expect(el).not.toHaveAttribute("aria-current");
      expect(el.closest("a")).toBeNull();
    }
    expect(screen.queryByRole("link", { name: /Clientes|Finanzas|Cobros|Auditoría/ })).toBeNull();
    // Abrirla no añade enlaces: siguen siendo las 4 rutas del menú (3 + «Cotizaciones»).
    expect(within(nav()).getAllByRole("link")).toHaveLength(4);
  });

  it("se abre y se cierra con el mismo botón nativo (teclado: Enter y Espacio) sin perder el foco", () => {
    renderShell();
    toggle().focus();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle()).toHaveFocus();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).toHaveAttribute("hidden");
    expect(toggle()).toHaveFocus();
  });

  it("su botón muestra foco visible y su fila mide al menos 44 px en el cajón móvil (min-h-11)", () => {
    renderShell();
    expect(toggle().className).toContain("focus-visible:ring-2");
    expect(toggle().className).toContain("min-h-11");
  });

  it("con la barra plegada queda un único botón de icono con nombre accesible y el panel no se dibuja", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    renderShell();
    expect(sidebar()).toHaveClass("w-[68px]");
    const botones = within(nav()).getAllByRole("button", { name: /Próximamente/ });
    expect(botones).toHaveLength(1);
    expect(botones[0]).toHaveAccessibleName("Próximamente 8 módulos");
    expect(botones[0]).toHaveAttribute("title", expect.stringContaining("Próximamente"));
    expect(botones[0].querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(panel()).not.toBeVisible();
    // Nada de texto de módulos a la vista y los enlaces reales no cambian (4 con «Cotizaciones»).
    expect(within(nav()).getAllByRole("link")).toHaveLength(4);
    for (const el of nav().querySelectorAll('[aria-disabled="true"]')) expect(el).not.toBeVisible();
  });

  it("pulsarla con la barra plegada la expande, abre la sección y conserva el foco en el mismo botón", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    renderShell();
    const before = toggle();
    before.focus();
    fireEvent.click(before);
    expect(sidebar()).toHaveClass("w-64");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("expanded");
    expect(toggle()).toBe(before);
    expect(toggle()).toHaveFocus();
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeVisible();
  });

  it("al plegar la barra con la sección abierta, el panel se oculta (no ensucia la columna de iconos)", () => {
    renderShell();
    fireEvent.click(toggle());
    expect(panel()).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Contraer barra lateral" }));
    expect(panel()).not.toBeVisible();
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("dentro del cajón móvil también existe, cerrada, y no comparte ids con la barra lateral", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    const t = within(dialog).getByRole("button", { name: /Próximamente/ });
    expect(t).toHaveAttribute("aria-expanded", "false");
    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    fireEvent.click(t);
    expect(t).toHaveAttribute("aria-expanded", "true");
    expect(within(dialog).getByRole("list", { name: "Finanzas" })).toBeVisible();
  });

  it.each([
    ["claro", /\n {2}\.erp \{([\s\S]*?)\n {2}\}/],
    ["oscuro", /\n {2}\.dark \.erp \{([\s\S]*?)\n {2}\}/],
  ])("el texto atenuado sobre la barra lateral pasa AA (>= 4,5:1) en %s", (_tema, block) => {
    const body = cssSource.match(block)![1];
    const token = (name: string) => {
      const m = body.match(new RegExp(`--${name}:\\s*(\\d+) (\\d+)% (\\d+)%`))!;
      return [Number(m[1]), Number(m[2]), Number(m[3])] as const;
    };
    const toRgb = ([h, s, l]: readonly [number, number, number]) => {
      const sat = s / 100, light = l / 100, a = sat * Math.min(light, 1 - light);
      const f = (n: number) => {
        const k = (n + h / 30) % 12;
        return light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
      };
      return [f(0), f(8), f(4)];
    };
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const a = lum(toRgb(token("muted-foreground")));
    const b = lum(toRgb(token("subtle")));
    expect((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("usan texto atenuado con contraste AA (token muted-foreground), sin opacidad que lo baje", () => {
    renderShell();
    const el = document.querySelector('[aria-disabled="true"]')!;
    expect(el.className).toContain("text-muted-foreground");
    expect(el.className).not.toMatch(/opacity-/);
    expect(navListSource).not.toMatch(/opacity-\d+/);
  });
});

describe("insignia de tickets abiertos (dato real)", () => {
  it("muestra el conteo que devuelve src/lib y lo lee de nuevo al cambiar de ruta", async () => {
    ticketsMock.getOpenTicketsCount.mockResolvedValue(7);
    renderShell("/dashboard");
    const tickets = screen.getByRole("link", { name: /Tickets/ });
    await waitFor(() => expect(tickets).toHaveTextContent("7"));
    expect(tickets).toHaveTextContent("7 abiertos");
    expect(ticketsMock.getOpenTicketsCount).toHaveBeenCalledTimes(1);
    fireEvent.click(tickets);
    await waitFor(() => expect(ticketsMock.getOpenTicketsCount).toHaveBeenCalledTimes(2));
  });

  it("con 0 abiertos no dibuja insignia y si la consulta falla tampoco rompe", async () => {
    ticketsMock.getOpenTicketsCount.mockRejectedValue(new Error("fallo simulado"));
    renderShell();
    await waitFor(() => expect(ticketsMock.getOpenTicketsCount).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: "Tickets" })).toBeInTheDocument();
  });

  it("más de 99 se muestra como 99+", async () => {
    ticketsMock.getOpenTicketsCount.mockResolvedValue(250);
    renderShell();
    await waitFor(() => expect(screen.getByRole("link", { name: /Tickets/ })).toHaveTextContent("99+"));
  });

  it("sin sesión no consulta", () => {
    authState.user = null;
    renderShell();
    expect(ticketsMock.getOpenTicketsCount).not.toHaveBeenCalled();
  });
});

describe("selector de tema (next-themes)", () => {
  it("en oscuro ofrece pasar a claro y llama a setTheme('light')", () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar a tema claro" }));
    expect(themeState.setTheme).toHaveBeenCalledWith("light");
  });

  it("en claro ofrece pasar a oscuro y llama a setTheme('dark')", () => {
    themeState.resolvedTheme = "light";
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Cambiar a tema oscuro" }));
    expect(themeState.setTheme).toHaveBeenCalledWith("dark");
  });
});

describe("plegado de la barra lateral", () => {
  const toggle = () => screen.getByRole("button", { name: /barra lateral/ });

  it("arranca expandida (256 px) y expone aria-expanded y aria-controls", () => {
    renderShell();
    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(toggle()).toHaveAttribute("aria-controls", "admin-sidebar");
    expect(sidebar()).toHaveClass("w-64");
  });

  it("al plegar queda en 68 px, solo iconos con nombre accesible, y se guarda", () => {
    renderShell();
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveAccessibleName("Expandir barra lateral");
    expect(sidebar()).toHaveClass("w-[68px]");
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("collapsed");
    expect(screen.getByRole("link", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumen" })).toHaveAttribute("title", "Resumen");
  });

  it("recuerda la preferencia al volver a montar", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    renderShell();
    expect(sidebar()).toHaveClass("w-[68px]");
    fireEvent.click(toggle());
    expect(window.localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("expanded");
  });

  it("si localStorage lanza (modo privado) el shell funciona y no guarda", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    renderShell();
    expect(sidebar()).toHaveClass("w-64");
    expect(() => fireEvent.click(toggle())).not.toThrow();
    expect(sidebar()).toHaveClass("w-[68px]");
  });
});

describe("cajón móvil (Sheet)", () => {
  const openDrawer = () => {
    const trigger = screen.getByRole("button", { name: "Abrir menú" });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
  };

  it("se abre como diálogo con nombre, contiene la navegación y mueve el foco dentro", async () => {
    renderShell();
    expect(screen.queryByRole("dialog")).toBeNull();
    openDrawer();
    const dialog = await screen.findByRole("dialog", { name: "Navegación del panel" });
    expect(within(dialog).getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("atrapa el foco: Tab en el último elemento vuelve al primero y el exterior no recibe foco", async () => {
    renderShell();
    openDrawer();
    const dialog = await screen.findByRole("dialog");
    const tabbables = Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button"));
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    last.focus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();
    // Un elemento fuera del cajón no conserva el foco.
    document.querySelector<HTMLElement>('button[aria-label^="Cambiar a tema"]')!.focus();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it("oculta el resto de la página a las tecnologías de apoyo mientras está abierto", async () => {
    renderShell();
    openDrawer();
    await screen.findByRole("dialog");
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.getByRole("main", { hidden: true })).toBeInTheDocument();
  });

  it("Escape lo cierra y devuelve el foco al botón que lo abrió", async () => {
    renderShell();
    const trigger = openDrawer();
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("elegir un enlace cierra el cajón y navega", async () => {
    renderShell("/dashboard");
    openDrawer();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("link", { name: /Tickets/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: /Tickets/ })).toHaveAttribute("aria-current", "page");
  });

  it("su portal cuelga del contenedor `.erp` (hereda los tokens del panel)", async () => {
    renderShell();
    openDrawer();
    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest(".erp")).not.toBeNull();
  });
});

describe("menú de usuario y cierre de sesión", () => {
  const openMenu = () => {
    const trigger = screen.getByRole("button", { name: /Cuenta/ });
    fireEvent.keyDown(trigger, { key: "Enter" });
    return trigger;
  };

  it("muestra correo y rol y su portal queda dentro de `.erp`", async () => {
    renderShell();
    openMenu();
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("admin@example.test")).toBeInTheDocument();
    expect(within(menu).getByText("Administrador")).toBeInTheDocument();
    expect(menu.closest(".erp")).not.toBeNull();
  });

  it("el colaborador se identifica como Colaborador", async () => {
    authState.userType = 1;
    renderShell();
    openMenu();
    expect(await within(await screen.findByRole("menu")).findByText("Colaborador")).toBeInTheDocument();
  });

  it("«Cerrar sesión» llama a signOut y vuelve a la landing, como el Navbar", async () => {
    renderShell("/dashboard/tickets");
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }));
    await waitFor(() => expect(screen.getByText("Landing simulada")).toBeInTheDocument());
    expect(authState.signOut).toHaveBeenCalledTimes(1);
  });
});

describe("botón de cuenta: texto corto y estable, correo completo en el menú", () => {
  const LARGO = "responsable.de.proyectos.con.apellido.largo@dominio-de-ejemplo-muy-largo.example";
  const trigger = () => screen.getByRole("button", { name: /Cuenta/ });
  // Texto visible = todo menos lo `sr-only` (el correo va solo en el nombre accesible).
  const visibleText = (el: HTMLElement) =>
    Array.from(el.childNodes)
      .filter((n) => !(n instanceof HTMLElement && n.classList.contains("sr-only")))
      .map((n) => n.textContent)
      .join("")
      .replace(/\s+/g, "");

  it("muestra el avatar con la inicial y el rol («Administrador»), nunca el correo", () => {
    renderShell();
    expect(visibleText(trigger())).toBe("AAdministrador");
    expect(visibleText(trigger())).not.toContain("@");
    expect(within(trigger()).queryByText("admin@example.test")).toBeNull();
  });

  it("el colaborador ve «Colaborador» y, con el rol sin resolver, solo el avatar", () => {
    authState.userType = 1;
    const { unmount } = renderShell();
    expect(visibleText(trigger())).toBe("AColaborador");
    unmount();
    authState.userType = null;
    renderShell();
    expect(visibleText(trigger())).toBe("A");
  });

  it("su nombre accesible conserva la palabra «Cuenta», el correo completo y el texto visible (rótulo en el nombre)", () => {
    renderShell();
    expect(trigger()).toHaveAccessibleName("Cuenta: admin@example.test. Administrador");
    cleanup();
    authState.user = { id: "u-1", email: LARGO };
    renderShell();
    expect(trigger().getAttribute("aria-label") ?? trigger().textContent).toContain(LARGO);
    expect(trigger()).toHaveAccessibleName(`Cuenta: ${LARGO}. Administrador`);
  });

  it("el texto del botón nunca se trunca ni se corta: ancho natural, una línea y sin puntos suspensivos", () => {
    renderShell();
    const role = Array.from(trigger().querySelectorAll("span")).find((el) => el.textContent === "Administrador")!;
    expect(role.className).not.toMatch(/truncate|max-w-|overflow-hidden|text-ellipsis/);
    expect(role.className).toContain("whitespace-nowrap");
    expect(trigger().className).not.toMatch(/max-w-/);
  });

  it("el menú muestra el correo COMPLETO con title, sin truncar y con salto limpio en la arroba", async () => {
    authState.user = { id: "u-1", email: LARGO };
    renderShell();
    fireEvent.keyDown(trigger(), { key: "Enter" });
    const menu = await screen.findByRole("menu");
    const correo = within(menu).getByText(LARGO);
    expect(correo).toHaveAttribute("title", LARGO);
    expect(correo.className).not.toMatch(/truncate|text-ellipsis|overflow-hidden/);
    expect(correo.className).toMatch(/break-words|\[overflow-wrap:anywhere\]/);
    // Punto de salto sugerido justo después de la arroba (el texto sigue completo).
    expect(correo.querySelector("wbr")).not.toBeNull();
    expect(correo.textContent).toBe(LARGO);
    expect(menu.className).toMatch(/max-w-/);
    expect(within(menu).getByText("Administrador")).toBeInTheDocument();
  });

  it("sin correo (sesión sin dato) dice «Cuenta» y «Sesión activa», sin inventar nada", async () => {
    authState.user = { id: "u-1" } as unknown as { id: string; email: string };
    renderShell();
    expect(trigger()).toHaveAccessibleName(/^Cuenta/);
    expect(visibleText(trigger())).toBe("?Administrador");
    fireEvent.keyDown(trigger(), { key: "Enter" });
    expect(await within(await screen.findByRole("menu")).findByText("Sesión activa")).toBeInTheDocument();
  });

  it("el texto del rol solo aparece desde 768 px; por debajo queda el avatar", () => {
    renderShell();
    const role = Array.from(trigger().querySelectorAll("span")).find((el) => el.textContent === "Administrador")!;
    expect(role.className).toMatch(/\bhidden\b/);
    expect(role.className).toContain("md:inline");
  });
});

describe("migas de pan: una sola línea en móvil", () => {
  const crumbs = () => screen.getByRole("navigation", { name: "Migas de pan" });
  const items = () => Array.from(crumbs().querySelectorAll("ol > li"));
  /** Entradas que NO llevan `hidden` sin prefijo: las que se ven por debajo de 768 px. */
  const onNarrow = () => items().filter((li) => !/(^|\s)hidden(\s|$)/.test(li.className));

  it("en dos niveles (Panel / Tickets) solo queda la miga actual, sin cortar", () => {
    renderShell("/dashboard/tickets");
    expect(onNarrow().map((li) => li.textContent)).toEqual(["Tickets"]);
    expect(within(onNarrow()[0] as HTMLElement).getByText("Tickets")).toHaveAttribute("aria-current", "page");
    // «Panel» (enlace al Resumen) y el separador se ven desde 768 px.
    expect(items().map((li) => li.textContent).filter(Boolean)).toEqual(["Panel", "Tickets"]);
    expect(within(crumbs()).getByRole("link", { name: "Panel" })).toHaveAttribute("href", "/dashboard");
  });

  it("en el detalle (tres niveles) queda un enlace corto «‹ Proyectos» al padre, no «Det…» a medias", () => {
    renderShell("/dashboard/project/abc");
    const visibles = onNarrow();
    expect(visibles).toHaveLength(1);
    const link = within(visibles[0] as HTMLElement).getByRole("link", { name: "Proyectos" });
    expect(link).toHaveAttribute("href", "/dashboard/proyectos");
    // El «‹» es decoración, y la miga final («Detalle») sigue en la lista para desde 768 px.
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(link.querySelector("svg")!.getAttribute("class")).toContain("md:hidden");
    expect(items().some((li) => li.textContent === "Detalle" && /(^|\s)hidden(\s|$)/.test(li.className))).toBe(true);
  });

  it("el enlace al padre es un objetivo táctil de 44 px en móvil y compacto desde 768 px", () => {
    renderShell("/dashboard/project/abc");
    const link = within(crumbs()).getByRole("link", { name: "Proyectos" });
    expect(link.className).toContain("min-h-11");
    expect(link.className).toContain("md:min-h-0");
  });

  it("no hay desbordamiento por diseño: lista sin salto de línea, contenedor que puede encogerse y texto sin cortar", () => {
    renderShell("/dashboard/project/abc");
    const ol = crumbs().querySelector("ol")!;
    expect(ol.className).toContain("whitespace-nowrap");
    expect(ol.className).toContain("min-w-0");
    expect(ol.className).not.toMatch(/flex-wrap/);
    expect(crumbs().className).toContain("min-w-0");
  });

  it("el resumen (Inicio / Resumen) también queda en una sola miga en móvil", () => {
    renderShell("/dashboard");
    expect(onNarrow().map((li) => li.textContent)).toEqual(["Resumen"]);
  });

  it("una ruta sin migas no dibuja la navegación de migas", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/otra"]}>
        <Routes>
          <Route path="/dashboard/*" element={<AdminShell>{null}</AdminShell>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("navigation", { name: "Migas de pan" })).toBeNull();
  });
});

describe("áreas táctiles: 44 px en móvil, escritorio sin cambio", () => {
  // jsdom no calcula estilos: se comprueba que cada control lleve la clase móvil y la de escritorio.
  const MOVIL = /(^|\s)h-11(\s|$)/;
  const MOVIL_ANCHO = /(^|\s)min-w-11(\s|$)/;

  it.each([
    ["menú", () => screen.getByRole("button", { name: "Abrir menú" })],
    ["tema", () => screen.getByRole("button", { name: /Cambiar a tema/ })],
    ["cuenta", () => screen.getByRole("button", { name: /Cuenta/ })],
    ["ver sitio", () => screen.getByRole("link", { name: "Ver sitio" })],
  ])("el botón de %s mide 44×44 en móvil y 36 px desde 1024 px", (_n, get) => {
    renderShell();
    const el = get();
    expect(el.className).toMatch(MOVIL);
    expect(el.className).toMatch(MOVIL_ANCHO);
    expect(el.className).toContain("lg:h-9");
    expect(el.className).toContain("lg:min-w-9");
  });

  it("el botón de plegar la barra (solo escritorio) conserva su tamaño de escritorio", () => {
    renderShell();
    const el = screen.getByRole("button", { name: /barra lateral/ });
    expect(el.className).toContain("hidden");
    expect(el.className).toContain("lg:inline-flex");
    expect(el.className).toContain("lg:h-9");
  });

  it("las filas del cajón móvil miden 44 px y las de la barra de escritorio, 36 px (min-h-11 lg:min-h-9)", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    const nav = within(dialog).getByRole("navigation", { name: "Principal" });
    const filas = [...within(nav).getAllByRole("link"), within(nav).getByRole("button", { name: /Próximamente/ })];
    // Por la entrada «Cotizaciones»: 4 enlaces + el botón «Próximamente» = 5 filas.
    expect(filas).toHaveLength(5);
    for (const a of filas) {
      expect(a.className, a.textContent ?? "").toContain("min-h-11");
      expect(a.className, a.textContent ?? "").toContain("lg:min-h-9");
    }
    // El bloque de marca (104 px) lo cubre la sección «identidad oficial».
    expect(within(dialog).getByRole("link", { name: "MultiStack Systems" })).toHaveAttribute("href", "/dashboard");
  });

  it("el botón de cerrar del cajón también mide 44×44 (se ajusta desde el shell, sin tocar el Sheet)", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    const cerrar = within(dialog).getByRole("button", { name: "Cerrar menú" });
    // El Sheet lo dibuja como hijo directo del contenido; el shell lo agranda con una regla de hijo.
    expect(dialog.className).toContain("[&>button]:size-11");
    expect(cerrar.parentElement).toBe(dialog);
  });

  it("«Cerrar sesión» del menú de cuenta mide 44 px en móvil", async () => {
    renderShell();
    fireEvent.keyDown(screen.getByRole("button", { name: /Cuenta/ }), { key: "Enter" });
    const item = await screen.findByRole("menuitem", { name: "Cerrar sesión" });
    expect(item.className).toContain("min-h-11");
    expect(item.className).toContain("lg:min-h-0");
  });
});

describe("identidad oficial: logotipo, isotipo y cabecera", () => {
  const brandLink = (scope: HTMLElement = document.body) => within(scope).getByRole("link", { name: "MultiStack Systems" });
  const marks = (scope: ParentNode) => Array.from(scope.querySelectorAll<HTMLElement>("[data-brand-variant]"));

  it("barra expandida: el logotipo completo de 80 px en un bloque de 104 px, sin el texto repetido ni borde inferior", () => {
    renderShell();
    const side = within(sidebar());
    const link = brandLink(sidebar());
    expect(link).toHaveAttribute("href", "/dashboard");
    const [mark] = marks(link);
    expect(mark).toHaveAttribute("data-brand-variant", "logo");
    expect(mark.className).toContain("h-20");
    expect(marks(sidebar())).toHaveLength(1);
    // Un solo nombre accesible por logotipo y ningún texto visible al lado (el nombre sale de la imagen).
    expect(side.getAllByRole("img", { name: "MultiStack Systems" })).toHaveLength(1);
    expect(link.textContent).toBe("");
    const block = link.parentElement!;
    expect(block.className).toContain("h-[104px]");
    expect(block.className).not.toMatch(/border-b/);
  });

  it("barra plegada: el isotipo de 32 px, centrado, con el mismo nombre accesible y la línea de la cabecera", () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    renderShell();
    const link = brandLink(sidebar());
    const [mark] = marks(link);
    expect(mark).toHaveAttribute("data-brand-variant", "isotipo");
    expect(mark.className).toContain("h-8");
    expect(marks(sidebar())).toHaveLength(1);
    expect(within(sidebar()).getAllByRole("img", { name: "MultiStack Systems" })).toHaveLength(1);
    const block = link.parentElement!;
    expect(block.className).toContain("h-14");
    expect(block.className).toContain("justify-center");
    expect(block.className).toContain("border-b");
  });

  it("plegar y expandir cambia entre isotipo y logotipo sin perder el botón de plegar ni su foco", () => {
    renderShell();
    const toggle = screen.getByRole("button", { name: "Contraer barra lateral" });
    toggle.focus();
    fireEvent.click(toggle);
    expect(marks(sidebar())[0]).toHaveAttribute("data-brand-variant", "isotipo");
    expect(toggle).toHaveFocus();
    expect(toggle).toHaveAccessibleName("Expandir barra lateral");
    fireEvent.click(toggle);
    expect(marks(sidebar())[0]).toHaveAttribute("data-brand-variant", "logo");
    expect(toggle).toHaveFocus();
  });

  it("el enlace de marca conserva un foco visible propio", () => {
    renderShell();
    const cls = brandLink(sidebar()).className;
    expect(cls).toContain("focus-visible:ring-2");
    expect(cls).toContain("focus-visible:ring-ring");
  });

  it("el cajón móvil lleva el logotipo completo (nunca el isotipo), incluso con la barra de escritorio plegada", async () => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, "collapsed");
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    const [mark] = marks(brandLink(dialog));
    expect(mark).toHaveAttribute("data-brand-variant", "logo");
    expect(mark.className).toContain("h-20");
    expect(marks(dialog)).toHaveLength(1);
    expect(brandLink(dialog).parentElement!.className).toContain("h-[104px]");
  });

  it("elegir el logotipo en el cajón cierra el cajón", async () => {
    renderShell("/dashboard/tickets");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(brandLink(dialog));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("la cabecera móvil (56 px) no lleva logo: solo menú, migas y acciones", () => {
    renderShell();
    const header = screen.getByRole("banner");
    expect(header.className).toContain("h-14");
    expect(marks(header)).toHaveLength(0);
    expect(within(header).queryByRole("img")).toBeNull();
    expect(header.querySelector("img")).toBeNull();
    expect(within(header).queryByRole("link", { name: "MultiStack Systems" })).toBeNull();
  });

  it("el armazón ya no usa el Logo compartido y carga las fuentes del panel", () => {
    expect(shellSource).not.toMatch(/components\/common\/Logo/);
    expect(shellSource).toContain('import "@/assets/fonts/erp-fonts.css";');
    expect(shellSource).toContain('from "./BrandMark"');
  });
});

describe("portal de diálogos de las páginas", () => {
  function Page() {
    return (
      <Dialog>
        <DialogTrigger>Abrir diálogo</DialogTrigger>
        <DialogContent>
          <DialogTitle>Título del diálogo</DialogTitle>
          <DialogDescription>Descripción</DialogDescription>
        </DialogContent>
      </Dialog>
    );
  }

  it("un Dialog abierto desde una página del shell hereda `.erp`", async () => {
    renderShell("/dashboard", <Page />);
    fireEvent.click(screen.getByText("Abrir diálogo"));
    const dialog = await screen.findByRole("dialog", { name: "Título del diálogo" });
    expect(dialog.closest(".erp")).not.toBeNull();
  });

  it("fuera del shell el Dialog sigue colgando de body (sin cambio para la landing y el resto)", async () => {
    render(<Page />);
    fireEvent.click(screen.getByText("Abrir diálogo"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.closest(".erp")).toBeNull();
    expect(dialog.parentElement).toBe(document.body);
  });
});

describe("movimiento reducido y transiciones", () => {
  const sources = { AdminShell: shellSource, AdminNavList: navListSource };
  // Patrones armados por partes para que Tailwind no genere esas utilidades al escanear este archivo.
  const FORBIDDEN = new RegExp(
    [["transition", "all"], ["backdrop", "blur"], ["gradient"], ["animate", "pulse"], ["animate", "spin"]]
      .map((parts) => parts.join("-"))
      .join("|"),
  );

  it("ninguna `animate-*` libre ni `transition-all`, sin vidrio ni degradados", () => {
    for (const [name, src] of Object.entries(sources)) {
      expect(src, name).not.toMatch(FORBIDDEN);
    }
  });

  it("toda transición de color lleva su variante `motion-reduce` y dura 150 ms", () => {
    for (const [name, src] of Object.entries(sources)) {
      const transitions = src.match(/transition-colors/g)?.length ?? 0;
      const reduced = src.match(/motion-reduce:transition-none/g)?.length ?? 0;
      expect(reduced, name).toBeGreaterThanOrEqual(transitions > 0 ? 1 : 0);
      expect(src, name).not.toMatch(/duration-(?!150|200)\d+/);
    }
    // Cada cadena de clases con `transition-colors` incluye su `motion-reduce`.
    for (const src of Object.values(sources)) {
      for (const literal of src.match(/"[^"]*transition-colors[^"]*"/g) ?? []) {
        expect(literal).toContain("motion-reduce:transition-none");
      }
    }
  });

  it("el cajón dura 200/150 ms con ease-out y con movimiento reducido no desliza", () => {
    expect(shellSource).toContain("data-[state=open]:duration-200");
    expect(shellSource).toContain("data-[state=closed]:duration-150");
    expect(shellSource).toContain("cubic-bezier(0.23,1,0.32,1)");
    expect(shellSource).toContain("motion-reduce:data-[state=open]:slide-in-from-left-0");
    expect(shellSource).toContain("motion-reduce:data-[state=closed]:slide-out-to-left-0");
  });

  it("plegar la barra no anima el ancho (evita reflujo en cada fotograma)", () => {
    expect(shellSource).not.toMatch(/transition-\[?width/);
  });
});

describe("Suspense del contenido", () => {
  it("exporta un componente por defecto cargable con React.lazy", async () => {
    const Lazy = lazy(() => import("@/components/admin/AdminShell"));
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Suspense fallback={<p>Cargando armazón</p>}>
          <Lazy>
            <p>Hijo</p>
          </Lazy>
        </Suspense>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Hijo")).toBeInTheDocument();
  });
});
