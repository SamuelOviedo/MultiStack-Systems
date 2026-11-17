// Paridad del panel: todo lo que ofrecía el inicio anterior (`/dashboard` como lista de proyectos con la barra
// superior) sigue existiendo, se alcanza por una ruta concreta y respeta los mismos roles. Se usa el `App` real
// (rutas, ProtectedRoute, lazy, Suspense); solo se sustituyen useAuth (la sesión de cada caso), las funciones de
// `src/lib` y el cliente de Supabase. Complementa a `dashboard-home-characterization` (reglas de negocio).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import appSource from "@/App.tsx?raw";
import protectedRouteSource from "@/components/common/ProtectedRoute.tsx?raw";
import preloadSource from "@/components/admin/preloadPanel.ts?raw";
import dashboardSource from "@/pages/dashboard/Dashboard.tsx?raw";
import projectsListSource from "@/pages/dashboard/ProjectsList.tsx?raw";

const WAIT = { timeout: 15000 };
vi.setConfig({ testTimeout: 30000 });

const auth = vi.hoisted(() => ({
  session: null as { user: { id: string; email: string; email_confirmed_at: string | null } } | null,
  user: null as { id: string; email: string } | null,
  userType: null as number | null,
  loading: false,
  recoveryPending: false,
  signOut: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => auth,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));

const libs = vi.hoisted(() => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getProjectStages: vi.fn(),
  getProjectServices: vi.fn(),
  getProjectMaintenance: vi.fn(),
  getUpcomingRenewals: vi.fn(),
  getAllTickets: vi.fn(),
  getProjectRequests: vi.fn(),
  getProjectTickets: vi.fn(),
  getProjectTokens: vi.fn(),
  getOpenTicketsCount: vi.fn(),
  getTeamMembers: vi.fn(),
}));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  getProjects: libs.getProjects,
  getProject: libs.getProject,
  getProjectStages: libs.getProjectStages,
  getProjectServices: libs.getProjectServices,
  getProjectMaintenance: libs.getProjectMaintenance,
  getUpcomingRenewals: libs.getUpcomingRenewals,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getAllTickets: libs.getAllTickets,
  getProjectRequests: libs.getProjectRequests,
  getProjectTickets: libs.getProjectTickets,
  getProjectTokens: libs.getProjectTokens,
  getOpenTicketsCount: libs.getOpenTicketsCount,
  getTeamMembers: libs.getTeamMembers,
}));

// Pantallas ajenas al panel: sustitutas mínimas (no son parte de lo que se caracteriza).
vi.mock("@/pages/client/MisSolicitudes.tsx", () => ({ default: () => <h1>Mis solicitudes (simulada)</h1> }));
vi.mock("@/pages/auth/Login.tsx", () => ({ default: () => <h1>Login (simulado)</h1> }));
vi.mock("@/pages/marketing/Index.tsx", () => ({ default: () => <h1>Landing (simulada)</h1> }));

import App from "@/App";

const NOW = "2026-11-02T15:00:00.000Z";
const project = (id: string, nombre: string, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: "u-admin",
  nombre_proyecto: nombre,
  descripcion: `Descripción de ${nombre}`,
  estado,
  fecha_creacion: NOW,
  updated_at: NOW,
  client_name: `Cliente de ${nombre}`,
  client_email: null,
  client_phone: null,
  client_id: null,
  lead_developer_id: null,
  requirements: {},
  deadline: null,
  source_ticket_id: null,
  google_docs_requirements_url: null,
  ...extra,
});
const PROJECTS = [
  project("p1", "Tienda Demo", "activo"),
  project("p2", "Portal Ejemplo", "en_desarrollo", { client_name: "Ñandú Análisis", descripcion: "Panel interno" }),
  project("p3", "Sitio Pausado", "pausado"),
  project("p4", "Intranet Mantenida", "mantenimiento"),
  project("p5", "App Cancelada", "cancelado"),
];
const ticket = (id: string, title: string, status: string, priority = "media") => ({
  id,
  project_id: "p1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "bug",
  priority,
  status,
  title,
  description: null,
  created_at: NOW,
  updated_at: NOW,
  resolved_at: null,
  assigned_to: null,
  assignee_email: null,
  nombre_proyecto: "Tienda Demo",
  message_count: 2,
});
const TICKETS = [ticket("t1", "Botón de pago roto", "abierto", "alta"), ticket("t2", "Cambiar logotipo", "resuelto")];
const RENEWAL = {
  id: "s1",
  project_id: "p1",
  name: "Dominio tienda-demo.example",
  renewal_date: "2026-11-05",
  nombre_proyecto: "Tienda Demo",
};

function signIn(userType: number | null, email = "persona@example.test") {
  const user = { id: userType === 1 ? "u-colab" : "u-admin", email };
  auth.session = { user: { ...user, email_confirmed_at: NOW } };
  auth.user = user;
  auth.userType = userType;
}

function goTo(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

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
  auth.session = null;
  auth.user = null;
  auth.userType = null;
  auth.loading = false;
  auth.signOut = vi.fn().mockResolvedValue(undefined);
  window.localStorage.clear();
  libs.getProjects.mockReset().mockResolvedValue(PROJECTS);
  libs.getProject.mockReset().mockResolvedValue(PROJECTS[0]);
  libs.getProjectStages.mockReset().mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
  libs.getProjectServices.mockReset().mockResolvedValue([]);
  libs.getProjectMaintenance.mockReset().mockResolvedValue([]);
  libs.getUpcomingRenewals.mockReset().mockResolvedValue([RENEWAL]);
  libs.getAllTickets.mockReset().mockResolvedValue(TICKETS);
  libs.getProjectRequests.mockReset().mockResolvedValue([ticket("r1", "Solicitud: tienda en línea", "abierto")]);
  libs.getProjectTickets.mockReset().mockResolvedValue([]);
  libs.getProjectTokens.mockReset().mockResolvedValue([]);
  libs.getOpenTicketsCount.mockReset().mockResolvedValue(1);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

/** Cada bloque `<Route …/>` de App.tsx, por ruta. */
function routeBlocks(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const chunk of appSource.split("<Route").slice(1)) {
    const path = chunk.match(/path="([^"]+)"/)?.[1];
    if (path) out[path] = chunk.split("</Routes>")[0];
  }
  return out;
}

describe("rutas y roles: el panel es solo del administrador (allowedTypes [0]); /solicitudes sigue en [2]", () => {
  const blocks = routeBlocks();

  it("las 4 rutas del panel usan ProtectedRoute con allowedTypes={[0]} explícito (sin valor por defecto); /solicitudes sigue en [2]", () => {
    expect(protectedRouteSource).not.toMatch(/allowedTypes\s*=\s*\[/);
    for (const path of ["/dashboard", "/dashboard/proyectos", "/dashboard/project/:id", "/dashboard/tickets"]) {
      const open = blocks[path]?.match(/<ProtectedRoute([^>]*)>/);
      expect(open, path).not.toBeNull();
      expect(open![1].trim(), `${path}: solo administrador`).toBe("allowedTypes={[0]}");
    }
    expect(blocks["/solicitudes"]).toMatch(/<ProtectedRoute allowedTypes=\{\[2\]\}>/);
    expect(blocks["/solicitudes"]).not.toContain("AdminShell");
  });

  // Por el módulo de Cotizaciones: a las 4 rutas de siempre se suman exactamente sus 3 rutas (lista, catálogo y detalle).
  it("las 7 rutas del panel usan el shell; el resto de rutas privadas y las públicas quedan como estaban", () => {
    const conShell = Object.entries(blocks).filter(([, b]) => b.includes("<AdminShell>")).map(([p]) => p);
    expect(conShell.sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/cotizaciones/:id",
      "/dashboard/cotizaciones/catalogo",
      "/dashboard/project/:id",
      "/dashboard/proyectos",
      "/dashboard/tickets",
    ]);
    const protegidas = Object.entries(blocks).filter(([, b]) => b.includes("<ProtectedRoute")).map(([p]) => p);
    expect(protegidas.sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/cotizaciones/:id",
      "/dashboard/cotizaciones/catalogo",
      "/dashboard/project/:id",
      "/dashboard/proyectos",
      "/dashboard/tickets",
      "/solicitudes",
    ]);
    // Portal de clientes, acceso y recuperación: públicos y sin shell.
    for (const path of ["/client/:token", "/login", "/signup", "/auth/callback", "/auth/reset-password", "/auth/update-password"]) {
      expect(blocks[path], path).toBeDefined();
      expect(blocks[path], path).not.toMatch(/ProtectedRoute|AdminShell/);
    }
    expect(blocks["/dashboard/proyectos"]).toContain("<ProjectsList />");
  });

  it.each(["/dashboard", "/dashboard/proyectos"])("sin sesión, %s redirige a /login", async (path) => {
    goTo(path);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(libs.getProjects).not.toHaveBeenCalled();
  });

  it.each(["/dashboard", "/dashboard/proyectos"])("un cliente (2) en %s va a /solicitudes y no se consulta nada del panel", async (path) => {
    signIn(2);
    goTo(path);
    expect(await screen.findByRole("heading", { name: "Mis solicitudes (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/solicitudes");
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(libs.getProjects).not.toHaveBeenCalled();
    expect(libs.getProjectRequests).not.toHaveBeenCalled();
  });
});

describe("inicio anterior → Resumen (/dashboard): lo que ofrecía sigue ahí", () => {
  it("administrador: botón para crear, 4 contadores con los mismos grupos, solicitudes y renovaciones", async () => {
    signIn(0);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 1, name: "Resumen" }, WAIT)).toBeInTheDocument();
    // Activos = activo + mantenimiento; en progreso = análisis/desarrollo/despliegue; pausados incluye cancelados.
    const stat = (label: string) => within(main).getByRole("group", { name: label });
    await waitFor(() => expect(stat("Total de proyectos")).toHaveTextContent("5"), WAIT);
    expect(stat("Proyectos activos")).toHaveTextContent("2");
    expect(stat("Proyectos en progreso")).toHaveTextContent("1");
    expect(stat("Pausados o cancelados")).toHaveTextContent("2");
    // Solicitudes de proyecto (solo administrador) y renovaciones próximas.
    expect(await within(main).findByRole("heading", { name: /Solicitudes de proyecto pendientes/ }, WAIT)).toBeInTheDocument();
    expect(libs.getProjectRequests).toHaveBeenCalledTimes(1);
    expect(libs.getUpcomingRenewals).toHaveBeenCalledWith(30);
    expect(await within(main).findByText("Dominio tienda-demo.example", {}, WAIT)).toBeInTheDocument();
    // Cada proyecto reciente enlaza a su detalle.
    const link = await within(main).findByRole("link", { name: /Tienda Demo/ }, WAIT);
    expect(link).toHaveAttribute("href", "/dashboard/project/p1");
  });

  it("«Nuevo proyecto» abre el modal de siempre, y «Confirmar proyecto» abre el de alcance de la solicitud", async () => {
    signIn(0);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    fireEvent.click(within(main).getByRole("button", { name: "Nuevo proyecto" }));
    const nuevo = await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT);
    expect(within(nuevo).getByRole("textbox", { name: /Nombre del proyecto/ })).toBeInTheDocument();
    fireEvent.click(within(nuevo).getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo proyecto" })).toBeNull(), WAIT);

    fireEvent.click(await within(main).findByRole("button", { name: /Confirmar proyecto/ }, WAIT));
    expect(await screen.findByRole("dialog", { name: "Convertir en proyecto" }, WAIT)).toBeInTheDocument();
    expect(libs.getTeamMembers).toHaveBeenCalled();
  });

  it("colaborador: ya no entra al Resumen, va a la landing y no se consulta nada del panel", async () => {
    signIn(1);
    goTo("/dashboard");
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(libs.getProjects).not.toHaveBeenCalled();
    expect(libs.getProjectRequests).not.toHaveBeenCalled();
    expect(libs.getUpcomingRenewals).not.toHaveBeenCalled();
    expect(libs.getOpenTicketsCount).not.toHaveBeenCalled();
  });

  it("si falla la carga se dice en español y se puede reintentar (antes era un aviso suelto)", async () => {
    signIn(0);
    libs.getProjects.mockRejectedValueOnce(new Error("fallo simulado"));
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    const retry = await within(main).findByRole("button", { name: "Reintentar" }, WAIT);
    fireEvent.click(retry);
    expect((await within(main).findAllByText("Tienda Demo", {}, WAIT)).length).toBeGreaterThan(0);
  });
});

describe("la lista completa vive en /dashboard/proyectos", () => {
  it("desde el Resumen, «Ver todos los proyectos» y la entrada «Proyectos» del menú llegan a la lista", async () => {
    signIn(0);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    const all = await within(main).findByRole("link", { name: /Ver todos los proyectos/ }, WAIT);
    expect(all).toHaveAttribute("href", "/dashboard/proyectos");
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/dashboard/proyectos");
    fireEvent.click(all);
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard/proyectos"), WAIT);
    expect(await screen.findByRole("heading", { level: 1, name: "Proyectos" }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Proyectos", current: "page" })).toBeInTheDocument();
  });

  it("muestra TODOS los proyectos en el orden recibido, cada tarjeta con su estado, cliente, descripción, avance y enlace al detalle", async () => {
    signIn(0);
    goTo("/dashboard/proyectos");
    const main = await screen.findByRole("main", {}, WAIT);
    const cards = await within(main).findAllByRole("link", { name: /Creado el/ }, WAIT);
    expect(cards).toHaveLength(PROJECTS.length);
    expect(cards.map((c) => c.getAttribute("href"))).toEqual(PROJECTS.map((p) => `/dashboard/project/${p.id}`));
    const first = within(cards[0]);
    expect(first.getByRole("heading", { name: "Tienda Demo" })).toBeInTheDocument();
    expect(first.getByText("Cliente de Tienda Demo")).toBeInTheDocument();
    expect(first.getByText("Descripción de Tienda Demo")).toBeInTheDocument();
    expect(first.getByText(/Creado el/)).toBeInTheDocument();
    expect(first.getByRole("progressbar")).toBeInTheDocument();
    expect(libs.getProjectStages).toHaveBeenCalledTimes(PROJECTS.length);
  });

  it("buscar (sin acentos ni mayúsculas) por nombre, cliente o descripción, filtrar por estado y quitar los filtros", async () => {
    signIn(0);
    goTo("/dashboard/proyectos");
    const main = await screen.findByRole("main", {}, WAIT);
    await within(main).findAllByRole("link", { name: /Creado el/ }, WAIT);
    const buscar = within(main).getByRole("searchbox", { name: "Buscar proyectos" });
    fireEvent.change(buscar, { target: { value: "nandu analisis" } });
    expect(within(main).getAllByRole("link", { name: /Creado el/ })).toHaveLength(1);
    expect(within(main).getByRole("heading", { name: "Portal Ejemplo" })).toBeInTheDocument();
    fireEvent.change(buscar, { target: { value: "panel interno" } });
    expect(within(main).getAllByRole("link", { name: /Creado el/ })).toHaveLength(1);
    fireEvent.change(buscar, { target: { value: "" } });
    // Filtros por estado con sus conteos: activos = activo + mantenimiento (2), pausados incluye cancelados (2).
    const filtros = within(main).getByRole("group", { name: "Filtrar por estado" });
    expect(within(filtros).getByRole("button", { name: /^Activos\s*2$/ })).toBeInTheDocument();
    fireEvent.click(within(filtros).getByRole("button", { name: /^Pausados o cancelados/ }));
    expect(within(main).getAllByRole("link", { name: /Creado el/ })).toHaveLength(2);
    fireEvent.change(buscar, { target: { value: "zzzz" } });
    fireEvent.click(await within(main).findByRole("button", { name: "Quitar filtros" }));
    expect(within(main).getAllByRole("link", { name: /Creado el/ })).toHaveLength(PROJECTS.length);
  });

  it("sin proyectos hay un estado vacío con la acción de crear; el modal sigue disponible desde la lista", async () => {
    signIn(0);
    libs.getProjects.mockResolvedValue([]);
    goTo("/dashboard/proyectos");
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByText("Aún no hay proyectos", {}, WAIT)).toBeInTheDocument();
    fireEvent.click(within(main).getAllByRole("button", { name: "Nuevo proyecto" })[0]);
    expect(await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT)).toBeInTheDocument();
  });

  it("mientras carga hay un estado de carga y si falla, un aviso con «Reintentar»", async () => {
    signIn(0);
    let release: (v: unknown) => void = () => {};
    libs.getProjects.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    goTo("/dashboard/proyectos");
    const main = await screen.findByRole("main", {}, WAIT);
    await waitFor(() => expect(main.querySelector('[aria-busy="true"]')).not.toBeNull(), WAIT);
    release(PROJECTS);
    await within(main).findAllByRole("link", { name: /Creado el/ }, WAIT);

    cleanup();
    libs.getProjects.mockReset().mockRejectedValueOnce(new Error("fallo simulado")).mockResolvedValue(PROJECTS);
    goTo("/dashboard/proyectos");
    const main2 = await screen.findByRole("main", {}, WAIT);
    fireEvent.click(await within(main2).findByRole("button", { name: "Reintentar" }, WAIT));
    expect((await within(main2).findAllByRole("link", { name: /Creado el/ }, WAIT)).length).toBe(PROJECTS.length);
  });

  it("colaborador: tampoco entra a la lista, va a la landing y no se consulta nada", async () => {
    signIn(1);
    goTo("/dashboard/proyectos");
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(screen.queryByRole("main")).toBeNull();
    expect(libs.getProjects).not.toHaveBeenCalled();
    expect(libs.getProjectRequests).not.toHaveBeenCalled();
  });
});

describe("lo que daba la barra superior anterior (Panel, Soporte, Salir, tema, sitio) ahora lo da el shell", () => {
  it("menú: Resumen, Proyectos, Cotizaciones y Tickets con la insignia de tickets abiertos; «Ver sitio» lleva a la landing", async () => {
    signIn(0, "responsable@example.test");
    goTo("/dashboard");
    const nav = within(await screen.findByRole("navigation", { name: "Principal" }, WAIT));
    // Por la entrada «Cotizaciones»: se suma /dashboard/cotizaciones a los enlaces del menú.
    expect(nav.getAllByRole("link").map((a) => a.getAttribute("href")).sort()).toEqual(["/dashboard", "/dashboard/cotizaciones", "/dashboard/proyectos", "/dashboard/tickets"]);
    await waitFor(() => expect(nav.getByRole("link", { name: /Tickets/ })).toHaveTextContent("1 abiertos"), WAIT);
    expect(screen.getByRole("link", { name: /Ver sitio/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: /Cambiar a tema/ })).toBeInTheDocument();
    // «session: correo» pasó al botón de cuenta (nombre accesible y título).
    expect(screen.getByRole("button", { name: /Cuenta: responsable@example.test/ })).toHaveAttribute("title", "responsable@example.test");
  });

  it("«Cerrar sesión» cierra la sesión y vuelve a la landing, como el antiguo «[ SALIR ]»", async () => {
    signIn(0);
    goTo("/dashboard");
    fireEvent.keyDown(await screen.findByRole("button", { name: /Cuenta/ }, WAIT), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Cerrar sesión" }, WAIT));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(window.location.pathname).toBe("/"), WAIT);
  });
});

describe("enlaces y destinos antiguos siguen llevando a páginas válidas", () => {
  it("el detalle de un proyecto abre desde una tarjeta, ahora dentro del shell, y su «Volver al resumen» vuelve a /dashboard", async () => {
    signIn(0);
    goTo("/dashboard/proyectos");
    const main = await screen.findByRole("main", {}, WAIT);
    fireEvent.click((await within(main).findAllByRole("link", { name: /Tienda Demo/ }, WAIT))[0]);
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard/project/p1"), WAIT);
    expect(await screen.findByRole("heading", { name: "Tienda Demo" }, WAIT)).toBeInTheDocument();
    // El detalle usa el shell: menú lateral con «Proyectos» marcado y sin la barra superior anterior.
    expect(screen.queryByRole("link", { name: /\[ PANEL \]/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Proyectos", current: "page" })).toHaveAttribute("href", "/dashboard/proyectos");
    expect(screen.getByRole("link", { name: "Volver al resumen" })).toHaveAttribute("href", "/dashboard");
  });

  it("Tickets sigue en /dashboard/tickets con sus datos, ahora dentro del shell y sin la barra anterior; un error de carga del detalle vuelve a /dashboard", async () => {
    signIn(0);
    goTo("/dashboard/tickets");
    expect(await screen.findByText("Botón de pago roto", {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /\[ PANEL \]/ })).toBeNull();
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.getByRole("link", { name: /Tickets/, current: "page" })).toHaveAttribute("href", "/dashboard/tickets");

    cleanup();
    window.history.pushState({}, "", "/");
    libs.getProject.mockRejectedValue(new Error("fallo simulado"));
    goTo("/dashboard/project/p1");
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"), WAIT);
    expect(await screen.findByRole("heading", { level: 1, name: "Resumen" }, WAIT)).toBeInTheDocument();
  });

  it("el acceso de siempre (login, callback, recuperación) sigue enviando a /dashboard, que existe y es el Resumen", () => {
    // No se renderizan: se comprueba el destino en el código y que la ruta existe.
    expect(routeBlocks()["/dashboard"]).toContain("<Dashboard />");
  });
});

describe("los modales viajan aparte: no pesan en la primera carga de la pantalla", () => {
  it("el Resumen y la lista no importan los modales de forma estática (se piden al abrirlos o al apuntar al botón)", () => {
    for (const [name, src] of Object.entries({ dashboardSource, projectsListSource })) {
      expect(src, name).not.toContain('dashboard-home/NewProjectModal"');
      expect(src, name).not.toContain('requests/ProjectScopingModal"');
      expect(src, name).toContain("LazyNewProjectModal");
    }
    expect(dashboardSource).toContain("LazyProjectScopingModal");
  });

  it("hasta que alguien lo abre no hay ningún diálogo ni se pide el equipo; al abrirlo aparece el de siempre", async () => {
    signIn(0);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    await within(main).findAllByText("Tienda Demo", {}, WAIT);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(libs.getTeamMembers).not.toHaveBeenCalled();
    fireEvent.click(within(main).getByRole("button", { name: "Nuevo proyecto" }));
    expect(await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT)).toBeInTheDocument();
  });
});

describe("visita directa al panel: el armazón y su primera página se piden a la vez", () => {
  it("App lo dispara con la ruta actual y solo conoce las pantallas que usan el armazón desde la primera carga", async () => {
    expect(appSource).toContain("preloadPanelForPath(window.location.pathname)");
    expect(preloadSource).toContain('"/dashboard": () =>');
    expect(preloadSource).toContain('"/dashboard/proyectos": () =>');
    expect(preloadSource).toContain('"/dashboard/tickets": () =>');
    expect(preloadSource).not.toContain("/dashboard/project/");
    const { preloadPanelForPath } = await import("@/components/admin/preloadPanel");
    for (const path of ["/", "/login", "/dashboard/tickets", "/client/abc", "/dashboard/", "/dashboard/proyectos"]) {
      expect(() => preloadPanelForPath(path), path).not.toThrow();
    }
  });
});

describe("indicador de carga ligero del Resumen y la lista", () => {
  it("App usa el indicador de solo texto únicamente en las pantallas con armazón; las demás rutas conservan el de siempre", () => {
    // Por el módulo de Cotizaciones: su lista también usa el armazón desde la primera carga (el catálogo y el detalle, no).
    expect(appSource).toContain('new Set(["/dashboard", "/dashboard/proyectos", "/dashboard/tickets", "/dashboard/cotizaciones"])');
    expect(appSource).toContain("<Suspense fallback={<RouteFallback />}>");
    expect(appSource).toContain("<PageLoader />");
  });

  it("se pinta en el chunk de entrada: texto accesible, sin imágenes ni logotipos", async () => {
    const { default: PanelLoader } = await import("@/components/admin/PanelLoader");
    const { container } = render(<PanelLoader />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando el panel…");
    expect(container.querySelector("img, svg")).toBeNull();
  });
});
