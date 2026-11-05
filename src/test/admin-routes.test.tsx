// Caracterización: las 3 páginas del panel siguen funcionando DENTRO del shell, con sus datos simulados, y
// `App` conserva los `allowedTypes` originales. Se usa el App real (rutas, ProtectedRoute, lazy, Suspense);
// solo se sustituyen useAuth (la sesión de cada caso), las funciones de src/lib y el cliente de Supabase.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import appSource from "@/App.tsx?raw";
import dashboardSource from "@/pages/dashboard/Dashboard.tsx?raw";
import projectDetailSource from "@/pages/dashboard/ProjectDetail.tsx?raw";
import ticketsSource from "@/pages/dashboard/TicketsGlobal.tsx?raw";
import protectedRouteSource from "@/components/common/ProtectedRoute.tsx?raw";

const WAIT = { timeout: 15000 };
// Los chunks lazy (ProjectDetail pesa ~45 kB) tardan en transformarse la primera vez.
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
}));

// Pantallas ajenas al panel: sustitutas mínimas (no son parte de lo que se caracteriza).
vi.mock("@/pages/client/MisSolicitudes.tsx", () => ({ default: () => <h1>Mis solicitudes (simulada)</h1> }));
vi.mock("@/pages/auth/Login.tsx", () => ({ default: () => <h1>Login (simulado)</h1> }));

import App from "@/App";

const NOW = "2026-11-02T15:00:00.000Z";
const project = (id: string, nombre: string, estado: string) => ({
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
});
const PROJECTS = [
  project("p1", "Tienda Demo", "activo"),
  project("p2", "Portal Ejemplo", "en_desarrollo"),
  project("p3", "Sitio Pausado", "pausado"),
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
const TICKETS = [
  ticket("t1", "Botón de pago roto", "abierto", "alta"),
  ticket("t2", "Cambiar logotipo", "en_progreso"),
  ticket("t3", "Duda de factura", "resuelto", "baja"),
];

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
  auth.signOut = vi.fn();
  window.localStorage.clear();
  libs.getProjects.mockReset().mockResolvedValue(PROJECTS);
  libs.getProject.mockReset().mockResolvedValue(PROJECTS[0]);
  libs.getProjectStages.mockReset().mockResolvedValue([]);
  libs.getProjectServices.mockReset().mockResolvedValue([]);
  libs.getProjectMaintenance.mockReset().mockResolvedValue([]);
  libs.getUpcomingRenewals.mockReset().mockResolvedValue([]);
  libs.getAllTickets.mockReset().mockResolvedValue(TICKETS);
  libs.getProjectRequests.mockReset().mockResolvedValue([ticket("r1", "Solicitud: tienda en línea", "abierto")]);
  libs.getProjectTickets.mockReset().mockResolvedValue([]);
  libs.getProjectTokens.mockReset().mockResolvedValue([]);
  libs.getOpenTicketsCount.mockReset().mockResolvedValue(2);
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

describe("App · allowedTypes originales (inspección del módulo)", () => {
  const blocks = routeBlocks();

  it.each(["/dashboard", "/dashboard/proyectos", "/dashboard/project/:id", "/dashboard/tickets"])(
    "%s está en <ProtectedRoute> sin allowedTypes (por defecto [0, 1]) con el shell DENTRO",
    (path) => {
      const block = blocks[path];
      expect(block, path).toBeDefined();
      const open = block.match(/<ProtectedRoute([^>]*)>/);
      expect(open, path).not.toBeNull();
      expect(open![1].trim(), `${path}: sin allowedTypes`).toBe("");
      expect(block.indexOf("<ProtectedRoute")).toBeLessThan(block.indexOf("<AdminShell>"));
      expect(block.indexOf("<AdminShell>")).toBeLessThan(block.indexOf("</AdminShell>"));
      expect(block.indexOf("</AdminShell>")).toBeLessThan(block.indexOf("</ProtectedRoute>"));
    },
  );

  it("/solicitudes conserva allowedTypes={[2]} y NO usa el shell", () => {
    expect(blocks["/solicitudes"]).toMatch(/<ProtectedRoute allowedTypes=\{\[2\]\}>/);
    expect(blocks["/solicitudes"]).not.toContain("AdminShell");
  });

  // La única ruta real nueva es /dashboard/proyectos (la lista completa que antes vivía en /dashboard).
  it("solo esas 4 rutas reales usan el shell y ninguna otra ruta privada nueva apareció", () => {
    const real = Object.entries(blocks);
    const withShell = real.filter(([, b]) => b.includes("<AdminShell>")).map(([p]) => p);
    expect(withShell.sort()).toEqual(["/dashboard", "/dashboard/project/:id", "/dashboard/proyectos", "/dashboard/tickets"]);
    const protectedPaths = real.filter(([, b]) => b.includes("<ProtectedRoute")).map(([p]) => p);
    expect(protectedPaths.sort()).toEqual([
      "/dashboard",
      "/dashboard/project/:id",
      "/dashboard/proyectos",
      "/dashboard/tickets",
      "/solicitudes",
    ]);
  });

  it("/dashboard/proyectos tiene EXACTAMENTE los mismos allowedTypes que /dashboard y carga su página perezosa", () => {
    const allowed = (path: string) => blocks[path].match(/<ProtectedRoute([^>]*)>/)![1].trim();
    expect(allowed("/dashboard/proyectos")).toBe(allowed("/dashboard"));
    expect(blocks["/dashboard/proyectos"]).toContain("<ProjectsList />");
    expect(appSource).toMatch(/const ProjectsList\s*=\s*lazy\(\(\) => import\("\.\/pages\/dashboard\/ProjectsList\.tsx"\)\)/);
    expect(appSource).not.toMatch(/^import .*ProjectsList/m);
  });

  it("el shell se carga con React.lazy (fuera de la entrada) y ProtectedRoute conserva su valor por defecto", () => {
    expect(appSource).toMatch(/const AdminShell\s*=\s*lazy\(\(\) => import\("\.\/components\/admin\/AdminShell\.tsx"\)\)/);
    expect(appSource).not.toMatch(/^import .*AdminShell/m);
    expect(protectedRouteSource).toContain("allowedTypes = [0, 1]");
  });

  it("las 3 páginas ya no importan ni renderizan el Navbar ni compensan su altura (pt-24)", () => {
    for (const [name, src] of Object.entries({ dashboardSource, projectDetailSource, ticketsSource })) {
      expect(src, name).not.toMatch(/Navbar/);
      expect(src, name).not.toMatch(/\bpt-24\b/);
    }
  });
});

describe("App · ProtectedRoute sigue mandando (comportamiento real)", () => {
  it("sin sesión, /dashboard redirige a /login", async () => {
    goTo("/dashboard");
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expect(screen.queryByRole("main")).toBeNull();
  });

  it("un cliente (2) en /dashboard/tickets va a /solicitudes y no ve el shell", async () => {
    signIn(2);
    goTo("/dashboard/tickets");
    expect(await screen.findByRole("heading", { name: "Mis solicitudes (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/solicitudes");
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(libs.getAllTickets).not.toHaveBeenCalled();
  });
});

describe("Dashboard dentro del shell", () => {
  it("administrador: shell + mismos datos, contadores y solicitudes pendientes", async () => {
    signIn(0);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    // /dashboard es «Resumen»; la lista completa pasó a /dashboard/proyectos.
    expect(await within(main).findByRole("heading", { level: 1, name: "Resumen" }, WAIT)).toBeInTheDocument();
    for (const name of ["Tienda Demo", "Portal Ejemplo", "Sitio Pausado"]) {
      expect((await within(main).findAllByText(name, {}, WAIT)).length).toBeGreaterThan(0);
    }
    // Contadores: total 3, activos 1, en progreso 1, pausados 1 (cada KpiTile es un grupo con nombre).
    const stat = (label: string) => within(main).getByRole("group", { name: label });
    expect(stat("Total de proyectos")).toHaveTextContent("3");
    expect(stat("Proyectos activos")).toHaveTextContent("1");
    expect(stat("Proyectos en progreso")).toHaveTextContent("1");
    expect(stat("Pausados o cancelados")).toHaveTextContent("1");
    expect(await within(main).findByRole("heading", { name: /Solicitudes de proyecto pendientes/ })).toBeInTheDocument();
    expect(libs.getProjectRequests).toHaveBeenCalledTimes(1);
    expect(within(main).getByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
    // El shell envuelve a la página: una sola barra principal, ninguna del Navbar de la landing.
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /SALIR/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Resumen", current: "page" })).toBeInTheDocument();
  });

  it("colaborador: no consulta solicitudes, no las ve y su menú se limita a 3 entradas", async () => {
    signIn(1);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    await within(main).findAllByText("Tienda Demo", {}, WAIT);
    expect(libs.getProjectRequests).not.toHaveBeenCalled();
    expect(within(main).queryByText(/Solicitudes de proyecto pendientes/)).toBeNull();
    expect(within(main).queryByText("Centro de Operaciones y Finanzas")).toBeNull();
    const nav = within(screen.getByRole("navigation", { name: "Principal" }));
    expect(nav.getAllByRole("listitem")).toHaveLength(3);
    expect(nav.queryByText("Finanzas")).toBeNull();
  });

  it("el administrador ve las 3 rutas reales y «Próximamente» cerrada (8 módulos, sin enlaces nuevos)", async () => {
    signIn(0);
    goTo("/dashboard");
    const nav = within(await screen.findByRole("navigation", { name: "Principal" }, WAIT));
    expect(nav.getAllByRole("link").map((a) => a.getAttribute("href")).sort()).toEqual([
      "/dashboard",
      "/dashboard/proyectos",
      "/dashboard/tickets",
    ]);
    const proximamente = nav.getByRole("button", { name: /Próximamente/ });
    expect(proximamente).toHaveAttribute("aria-expanded", "false");
    expect(proximamente).toHaveAccessibleName("Próximamente 8 módulos");
    expect(nav.queryByText(/^Pronto$/)).toBeNull();
    fireEvent.click(proximamente);
    expect(nav.getByRole("list", { name: "Finanzas" })).toBeVisible();
    expect(nav.getAllByRole("link")).toHaveLength(3);
  });

  it("el colaborador no ve «Próximamente» y su menú sigue siendo de 3 entradas", async () => {
    signIn(1);
    goTo("/dashboard");
    const nav = within(await screen.findByRole("navigation", { name: "Principal" }, WAIT));
    expect(nav.queryByRole("button", { name: /Próximamente/ })).toBeNull();
    expect(nav.getAllByRole("link")).toHaveLength(3);
  });

  it("el botón de cuenta muestra el rol y deja el correo completo para el menú", async () => {
    signIn(0, "responsable.de.proyectos@dominio-largo-de-ejemplo.example");
    goTo("/dashboard");
    const cuenta = await screen.findByRole("button", { name: /Cuenta/ }, WAIT);
    expect(cuenta).toHaveAttribute("title", "responsable.de.proyectos@dominio-largo-de-ejemplo.example");
    expect(within(cuenta).getByText("Administrador")).toBeInTheDocument();
    // El correo solo está en el nombre accesible (texto `sr-only`), nunca a la vista ni truncado.
    for (const el of within(cuenta).queryAllByText(/dominio-largo/)) expect(el).toHaveClass("sr-only");
  });

  it("la tarjeta de proyecto enlaza al detalle y navegar mantiene el shell", async () => {
    signIn(0);
    goTo("/dashboard");
    const main = await screen.findByRole("main", {}, WAIT);
    fireEvent.click(await within(main).findByRole("link", { name: /Tienda Demo/ }, WAIT));
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard/project/p1"));
    expect(await screen.findByRole("link", { name: "Proyectos", current: "page" }, WAIT)).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
  });
});

describe("Detalle de proyecto dentro del shell", () => {
  it("carga el proyecto con sus 6 consultas y marca Proyectos en el menú", async () => {
    signIn(0);
    goTo("/dashboard/project/p1");
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { name: "Tienda Demo" }, WAIT)).toBeInTheDocument();
    for (const fn of [libs.getProject, libs.getProjectStages, libs.getProjectServices, libs.getProjectMaintenance, libs.getProjectTickets, libs.getProjectTokens]) {
      expect(fn).toHaveBeenCalledWith("p1");
    }
    expect(screen.getByRole("link", { name: "Proyectos", current: "page" })).toBeInTheDocument();
    // El «volver» conserva su destino (/dashboard) pero se llama «Volver al resumen» (en el panel, /dashboard es «Resumen»).
    expect(within(main).getByRole("link", { name: "Volver al resumen" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
  });

  it("las migas del detalle conservan su destino y en móvil se reducen a un enlace corto al padre", async () => {
    signIn(0);
    goTo("/dashboard/project/p1");
    await screen.findByRole("main", {}, WAIT);
    const migas = within(screen.getByRole("navigation", { name: "Migas de pan" }));
    expect(migas.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/dashboard/proyectos");
    expect(migas.getByText("Detalle")).toHaveAttribute("aria-current", "page");
    const visibles = Array.from(document.querySelectorAll("nav[aria-label='Migas de pan'] ol > li")).filter(
      (li) => !/(^|\s)hidden(\s|$)/.test(li.className),
    );
    expect(visibles.map((li) => li.textContent)).toEqual(["Proyectos"]);
  });

  it("un error de carga sigue redirigiendo a /dashboard", async () => {
    signIn(0);
    libs.getProject.mockRejectedValue(new Error("fallo simulado"));
    goTo("/dashboard/project/p1");
    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"), WAIT);
  });
});

describe("Tickets dentro del shell", () => {
  it("administrador: todos los tickets, contador, filtro «asignado» y fila con los datos", async () => {
    signIn(0);
    goTo("/dashboard/tickets");
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByText("Botón de pago roto", {}, WAIT)).toBeInTheDocument();
    expect(libs.getAllTickets).toHaveBeenCalledWith(undefined);
    // «2 abiertos · 3 total» (texto suelto) pasó a dos indicadores con nombre; «asignado:» (etiqueta suelta)
    // pasó a un selector con nombre accesible.
    expect(within(main).getByRole("group", { name: "Abiertos" })).toHaveTextContent("2");
    expect(within(main).getByRole("group", { name: "Total de tickets" })).toHaveTextContent("3");
    expect(within(main).getByRole("combobox", { name: "Asignado" })).toBeInTheDocument();
    expect(within(main).getAllByRole("row")).toHaveLength(1 + TICKETS.length);
    expect(screen.getByRole("link", { name: /Tickets/, current: "page" })).toBeInTheDocument();
    // La insignia del menú es el mismo conteo real que mostraba el Navbar.
    await waitFor(() => expect(screen.getByRole("link", { name: /Tickets/ })).toHaveTextContent("2 abiertos"));
  });

  it("colaborador: consulta solo lo asignado a él y no ve el filtro «asignado»", async () => {
    signIn(1);
    goTo("/dashboard/tickets");
    const main = await screen.findByRole("main", {}, WAIT);
    await within(main).findByText("Botón de pago roto", {}, WAIT);
    expect(libs.getAllTickets).toHaveBeenCalledWith({ assignedTo: "u-colab" });
    expect(within(main).queryByRole("combobox", { name: "Asignado" })).toBeNull();
  });

  it("abrir un ticket sigue abriendo el cajón, ahora dentro de `.erp`", async () => {
    signIn(0);
    goTo("/dashboard/tickets");
    const main = await screen.findByRole("main", {}, WAIT);
    fireEvent.click(await within(main).findByText("Botón de pago roto", {}, WAIT));
    const drawer = await screen.findByRole("dialog", {}, WAIT);
    expect(drawer.closest(".erp")).not.toBeNull();
  });
});
