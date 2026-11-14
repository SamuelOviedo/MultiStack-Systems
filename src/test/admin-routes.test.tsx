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
import type { Cotizacion, CotizacionResumen } from "@/types/cotizaciones";

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
  listarPaginaCotizaciones: vi.fn<typeof import("@/lib/cotizaciones").listarPaginaCotizaciones>(),
  obtenerCotizacion: vi.fn<typeof import("@/lib/cotizaciones").obtenerCotizacion>(),
}));
vi.mock("@/lib/cotizaciones", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/cotizaciones")>()),
  listarPaginaCotizaciones: libs.listarPaginaCotizaciones,
  obtenerCotizacion: libs.obtenerCotizacion,
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

// Cotizaciones (datos sintéticos): un UUID válido, su fila de la lista y su detalle completo.
const ID_COTIZACION = "0a1b2c3d-0007-4000-8000-000000000007";
const RESUMEN_COTIZACION: CotizacionResumen = {
  id: ID_COTIZACION,
  referencia_interna: "BOR-7",
  estado: "borrador",
  prospecto_nombre: "Prospecto Sintético Siete",
  creado_at: NOW,
  row_version: 1,
};
const COTIZACION: Cotizacion = {
  ...RESUMEN_COTIZACION,
  prospecto_contacto: "Contacto Sintético Siete",
  prospecto_email: "siete@example.test",
  prospecto_telefono: "+504 5550-0107",
  creado_por: "0a1b2c3d-0001-4000-8000-000000000001",
  actualizado_por: null,
  actualizado_at: NOW,
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
  libs.listarPaginaCotizaciones.mockReset().mockResolvedValue({ cotizaciones: [RESUMEN_COTIZACION], haySiguiente: false });
  libs.obtenerCotizacion.mockReset().mockResolvedValue(COTIZACION);
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
    "%s está en <ProtectedRoute allowedTypes={[0]}> (solo administrador) con el shell DENTRO",
    (path) => {
      const block = blocks[path];
      expect(block, path).toBeDefined();
      const open = block.match(/<ProtectedRoute([^>]*)>/);
      expect(open, path).not.toBeNull();
      expect(open![1].trim(), `${path}: solo administrador`).toBe("allowedTypes={[0]}");
      expect(block.indexOf("<ProtectedRoute")).toBeLessThan(block.indexOf("<AdminShell>"));
      expect(block.indexOf("<AdminShell>")).toBeLessThan(block.indexOf("</AdminShell>"));
      expect(block.indexOf("</AdminShell>")).toBeLessThan(block.indexOf("</ProtectedRoute>"));
    },
  );

  it("/solicitudes conserva allowedTypes={[2]} y NO usa el shell", () => {
    expect(blocks["/solicitudes"]).toMatch(/<ProtectedRoute allowedTypes=\{\[2\]\}>/);
    expect(blocks["/solicitudes"]).not.toContain("AdminShell");
  });

  // La ruta real nueva de la reorganización fue /dashboard/proyectos (la lista completa que antes vivía en /dashboard);
  // después, el módulo de Cotizaciones sumó exactamente tres: lista, catálogo y detalle.
  it("solo esas 7 rutas reales (las 4 del panel y las 3 de Cotizaciones) usan el shell y ninguna otra ruta privada nueva apareció", () => {
    const real = Object.entries(blocks);
    const withShell = real.filter(([, b]) => b.includes("<AdminShell>")).map(([p]) => p);
    expect(withShell.sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/cotizaciones/:id",
      "/dashboard/cotizaciones/catalogo",
      "/dashboard/project/:id",
      "/dashboard/proyectos",
      "/dashboard/tickets",
    ]);
    const protectedPaths = real.filter(([, b]) => b.includes("<ProtectedRoute")).map(([p]) => p);
    expect(protectedPaths.sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/cotizaciones/:id",
      "/dashboard/cotizaciones/catalogo",
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

  it("el shell se carga con React.lazy (fuera de la entrada) y ProtectedRoute exige declarar quién entra (sin valor por defecto)", () => {
    expect(appSource).toMatch(/const AdminShell\s*=\s*lazy\(\(\) => import\("\.\/components\/admin\/AdminShell\.tsx"\)\)/);
    expect(appSource).not.toMatch(/^import .*AdminShell/m);
    expect(protectedRouteSource).toContain("allowedTypes: readonly number[]");
    expect(protectedRouteSource).not.toContain("allowedTypes = [");
  });

  it("las 3 páginas ya no importan ni renderizan el Navbar ni compensan su altura (pt-24)", () => {
    for (const [name, src] of Object.entries({ dashboardSource, projectDetailSource, ticketsSource })) {
      expect(src, name).not.toMatch(/Navbar/);
      expect(src, name).not.toMatch(/\bpt-24\b/);
    }
  });
});

/** Las únicas rutas del módulo de Cotizaciones, ordenadas como `sort()`. Una ruta más, de cualquier fase, tiene que hacer fallar la prueba. */
const RUTAS_DE_COTIZACIONES = ["/dashboard/cotizaciones", "/dashboard/cotizaciones/:id", "/dashboard/cotizaciones/catalogo"];

/** El `path` de cada `<Route>` de App.tsx, sea cual sea la forma de escribirlo (comillas dobles o simples, llaves, plantilla sin `${`). */
function rutasDeclaradas(): string[] {
  return appSource
    .split(/<Route\b/)
    .slice(1)
    .map((chunk) => /\bpath=(?:\{\s*)?(["'`])([^"'`$]*)\1/.exec(chunk)?.[2])
    .filter((p): p is string => p !== undefined);
}

describe("App · rutas de Cotizaciones (inspección del módulo)", () => {
  const blocks = routeBlocks();

  it("las rutas del módulo declaradas en App son EXACTAMENTE tres: lista, catálogo y detalle", () => {
    const declaradas = rutasDeclaradas();
    // Toda <Route> declara su path con un texto literal: ninguna ruta puede esconderse en una constante o en un índice.
    expect(declaradas, "cada <Route> declara su path con un literal").toHaveLength(appSource.match(/<Route\b/g)!.length);
    expect(declaradas.filter((p) => /cotizacion/i.test(p)).sort()).toEqual(RUTAS_DE_COTIZACIONES);
    // Ninguna otra vía de declarar rutas dentro de App.
    expect(appSource).not.toMatch(/\b(useRoutes|createBrowserRouter|createRoutesFromElements|RouterProvider)\b/);
  });

  it.each(RUTAS_DE_COTIZACIONES)("%s está en <ProtectedRoute allowedTypes={[0]}> (solo administrador) con el shell DENTRO", (path) => {
    const block = blocks[path];
    expect(block, path).toBeDefined();
    const open = block.match(/<ProtectedRoute([^>]*)>/);
    expect(open, path).not.toBeNull();
    expect(open![1].trim(), `${path}: solo administrador`).toBe("allowedTypes={[0]}");
    expect(block.indexOf("<ProtectedRoute")).toBeLessThan(block.indexOf("<AdminShell>"));
    expect(block.indexOf("<AdminShell>")).toBeLessThan(block.indexOf("</AdminShell>"));
    expect(block.indexOf("</AdminShell>")).toBeLessThan(block.indexOf("</ProtectedRoute>"));
  });

  it.each([
    ["/dashboard/cotizaciones", "CotizacionesList"],
    ["/dashboard/cotizaciones/catalogo", "CotizacionesCatalogo"],
    ["/dashboard/cotizaciones/:id", "CotizacionDetalle"],
  ])("%s muestra %s, cargada con React.lazy (fuera de la entrada), y ninguna de las otras dos", (path, componente) => {
    expect(blocks[path], path).toContain(`<${componente} />`);
    for (const otra of ["CotizacionesList", "CotizacionesCatalogo", "CotizacionDetalle"].filter((c) => c !== componente)) {
      expect(blocks[path], `${path} no muestra ${otra}`).not.toContain(`<${otra}`);
    }
    expect(appSource).toMatch(new RegExp(`const ${componente}\\s*=\\s*lazy\\(\\(\\) => import\\("\\./pages/dashboard/${componente}\\.tsx"\\)\\)`));
    expect(appSource).not.toMatch(new RegExp(`^import .*${componente}`, "m"));
  });

  it("una ruta que el módulo no declara (/dashboard/cotizaciones/<uuid>/editar) cae en «ruta no encontrada», sin shell ni consultas", async () => {
    signIn(0);
    const consola = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      goTo(`/dashboard/cotizaciones/${ID_COTIZACION}/editar`);
      expect(await screen.findByRole("heading", { level: 1, name: "404" }, WAIT)).toBeInTheDocument();
      // La página «no encontrada» registra la ruta pedida y nada más.
      expect(consola.mock.calls.filter(([mensaje]) => !String(mensaje).startsWith("404 Error"))).toEqual([]);
      expect(screen.queryByRole("main")).toBeNull();
      expect(document.querySelector("#admin-sidebar")).toBeNull();
      expect(libs.listarPaginaCotizaciones).not.toHaveBeenCalled();
      expect(libs.obtenerCotizacion).not.toHaveBeenCalled();
    } finally {
      consola.mockRestore();
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

  it("colaborador: no entra al Resumen, termina en / y no consulta nada del panel", async () => {
    signIn(1);
    goTo("/dashboard");
    await waitFor(() => expect(window.location.pathname).toBe("/"), WAIT);
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Principal" })?.querySelector('a[href="/dashboard"]') ?? null).toBeNull();
    for (const fn of [libs.getProjects, libs.getProjectRequests, libs.getUpcomingRenewals, libs.getAllTickets]) expect(fn).not.toHaveBeenCalled();
  });

  // Por la entrada «Cotizaciones»: el menú tiene 4 enlaces funcionales (antes 3); «Próximamente» sigue sin enlaces.
  it("el administrador ve los 4 enlaces del menú y «Próximamente» cerrada (8 módulos, sin enlaces nuevos)", async () => {
    signIn(0);
    goTo("/dashboard");
    const nav = within(await screen.findByRole("navigation", { name: "Principal" }, WAIT));
    expect(nav.getAllByRole("link").map((a) => a.getAttribute("href")).sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/proyectos",
      "/dashboard/tickets",
    ]);
    const proximamente = nav.getByRole("button", { name: /Próximamente/ });
    expect(proximamente).toHaveAttribute("aria-expanded", "false");
    expect(proximamente).toHaveAccessibleName("Próximamente 8 módulos");
    expect(nav.queryByText(/^Pronto$/)).toBeNull();
    fireEvent.click(proximamente);
    expect(nav.getByRole("list", { name: "Finanzas" })).toBeVisible();
    expect(nav.getAllByRole("link")).toHaveLength(4);
  });

  it("el colaborador no ve el panel ni «Próximamente»: se le redirige antes de pintar el menú", async () => {
    signIn(1);
    goTo("/dashboard");
    await waitFor(() => expect(window.location.pathname).toBe("/"), WAIT);
    expect(screen.queryByRole("button", { name: /Próximamente/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Resumen" })).toBeNull();
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

  it("colaborador: no entra a Tickets, termina en / y no consulta tickets", async () => {
    signIn(1);
    goTo("/dashboard/tickets");
    await waitFor(() => expect(window.location.pathname).toBe("/"), WAIT);
    expect(screen.queryByRole("main")).toBeNull();
    expect(libs.getAllTickets).not.toHaveBeenCalled();
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

describe("Cotizaciones dentro del shell", () => {
  const RUTA_LISTA = "/dashboard/cotizaciones";
  const RUTA_CATALOGO = "/dashboard/cotizaciones/catalogo";
  const RUTA_DETALLE = `/dashboard/cotizaciones/${ID_COTIZACION}`;
  const migas = () => within(screen.getByRole("navigation", { name: "Migas de pan" }));
  const textosDeLasMigas = () =>
    Array.from(document.querySelectorAll("nav[aria-label='Migas de pan'] ol > li"))
      .map((li) => li.textContent)
      .filter(Boolean);

  it("lista (administrador): se pinta DENTRO del shell con la primera página, marca Cotizaciones y sus migas", async () => {
    signIn(0);
    goTo(RUTA_LISTA);
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 1, name: "Cotizaciones" }, WAIT)).toBeInTheDocument();
    expect(await within(main).findByRole("link", { name: "BOR-7" }, WAIT)).toHaveAttribute("href", RUTA_DETALLE);
    expect(window.location.pathname).toBe(RUTA_LISTA);
    expect(libs.listarPaginaCotizaciones).toHaveBeenCalledTimes(1);
    expect(libs.listarPaginaCotizaciones.mock.calls[0][0]).toMatchObject({ pagina: 1, tamano: 25 });
    expect(libs.obtenerCotizacion).not.toHaveBeenCalled();
    // El shell envuelve a la página: una sola barra principal y «Cotizaciones» como entrada actual.
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Cotizaciones", current: "page" })).toHaveAttribute("href", RUTA_LISTA);
    expect(textosDeLasMigas()).toEqual(["Gestión comercial", "Cotizaciones"]);
    expect(migas().getByText("Cotizaciones")).toHaveAttribute("aria-current", "page");
  });

  it("catálogo (administrador): se pinta DENTRO del shell, sin consultas, y marca Cotizaciones", async () => {
    signIn(0);
    goTo(RUTA_CATALOGO);
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 1, name: "Catálogo" }, WAIT)).toBeInTheDocument();
    expect(within(main).getByRole("heading", { level: 2, name: "El catálogo se habilita en la siguiente fase" })).toBeInTheDocument();
    expect(window.location.pathname).toBe(RUTA_CATALOGO);
    expect(libs.listarPaginaCotizaciones).not.toHaveBeenCalled();
    expect(libs.obtenerCotizacion).not.toHaveBeenCalled();
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Cotizaciones", current: "page" })).toHaveAttribute("href", RUTA_LISTA);
    expect(textosDeLasMigas()).toEqual(["Gestión comercial", "Cotizaciones", "Catálogo"]);
    expect(migas().getByRole("link", { name: "Cotizaciones" })).toHaveAttribute("href", RUTA_LISTA);
    expect(migas().getByText("Catálogo")).toHaveAttribute("aria-current", "page");
  });

  it("detalle (administrador): pide esa cotización, se pinta DENTRO del shell, marca Cotizaciones y sus migas", async () => {
    signIn(0);
    goTo(RUTA_DETALLE);
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 1, name: "Cotización BOR-7" }, WAIT)).toBeInTheDocument();
    expect(within(main).getByText("Prospecto Sintético Siete")).toBeInTheDocument();
    expect(window.location.pathname).toBe(RUTA_DETALLE);
    expect(libs.obtenerCotizacion).toHaveBeenCalledTimes(1);
    expect(libs.obtenerCotizacion.mock.calls[0][0]).toBe(ID_COTIZACION);
    expect(libs.listarPaginaCotizaciones).not.toHaveBeenCalled();
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Cotizaciones", current: "page" })).toHaveAttribute("href", RUTA_LISTA);
    expect(textosDeLasMigas()).toEqual(["Gestión comercial", "Cotizaciones", "Detalle"]);
    expect(migas().getByRole("link", { name: "Cotizaciones" })).toHaveAttribute("href", RUTA_LISTA);
    expect(migas().getByText("Detalle")).toHaveAttribute("aria-current", "page");
  });

  it("/dashboard/cotizaciones/catalogo abre el catálogo y NO el detalle: no pide ninguna cotización ni dice «no encontrada»", async () => {
    signIn(0);
    goTo(RUTA_CATALOGO);
    const main = await screen.findByRole("main", {}, WAIT);
    expect(await within(main).findByRole("heading", { level: 1, name: "Catálogo" }, WAIT)).toBeInTheDocument();
    expect(libs.obtenerCotizacion).not.toHaveBeenCalled();
    expect(within(main).queryByRole("heading", { name: "Cotización no encontrada" })).toBeNull();
    expect(within(main).queryByRole("group", { name: "Detalle de la cotización" })).toBeNull();
    expect(within(main).queryByRole("heading", { name: /^Cotización / })).toBeNull();
    // Y el detalle con un UUID sí es el detalle, con su propia consulta.
    cleanup();
    goTo(RUTA_DETALLE);
    expect(await screen.findByRole("group", { name: "Detalle de la cotización" }, WAIT)).toBeInTheDocument();
    await waitFor(() => expect(libs.obtenerCotizacion).toHaveBeenCalledTimes(1), WAIT);
  });

  it("navegar de la lista al detalle, de vuelta a la lista y al catálogo mantiene un solo shell y marca Cotizaciones", async () => {
    signIn(0);
    goTo(RUTA_LISTA);
    fireEvent.click(await screen.findByRole("link", { name: "BOR-7" }, WAIT));
    await waitFor(() => expect(window.location.pathname).toBe(RUTA_DETALLE));
    expect(await screen.findByRole("heading", { level: 1, name: "Cotización BOR-7" }, WAIT)).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Cotizaciones", current: "page" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Volver a cotizaciones" }));
    await waitFor(() => expect(window.location.pathname).toBe(RUTA_LISTA));
    fireEvent.click(await screen.findByRole("link", { name: "Ver catálogo" }, WAIT));
    await waitFor(() => expect(window.location.pathname).toBe(RUTA_CATALOGO));
    expect(await screen.findByRole("heading", { level: 1, name: "Catálogo" }, WAIT)).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Principal" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Cotizaciones", current: "page" })).toBeInTheDocument();
    // Una sola consulta de detalle y dos de lista (la inicial y la de volver a ella).
    expect(libs.obtenerCotizacion).toHaveBeenCalledTimes(1);
    expect(libs.listarPaginaCotizaciones).toHaveBeenCalledTimes(2);
  });

  // Mismo destino que hoy para cada rol: el de /dashboard (sin sesión a /login, colaborador a /, cliente a /solicitudes).
  const PANTALLAS = [
    { nombre: "lista", path: RUTA_LISTA },
    { nombre: "catálogo", path: RUTA_CATALOGO },
    { nombre: "detalle", path: RUTA_DETALLE },
  ];
  const SIN_ACCESO = [
    { nombre: "sin sesión", userType: null, destino: "/login", encabezado: "Login (simulado)" },
    { nombre: "colaborador (1)", userType: 1, destino: "/", encabezado: null },
    { nombre: "cliente (2)", userType: 2, destino: "/solicitudes", encabezado: "Mis solicitudes (simulada)" },
  ];

  describe.each(PANTALLAS.map((pantalla) => [pantalla.nombre, pantalla.path] as const))("%s (%s) sin acceso", (_nombre, path) => {
    it.each(SIN_ACCESO.map((caso) => [caso.nombre, caso.destino, caso.userType, caso.encabezado] as const))("%s: termina en %s, sin ver el shell ni pedir nada", async (_caso, destino, userType, encabezado) => {
      if (userType !== null) signIn(userType);
      goTo(path);
      await waitFor(() => expect(window.location.pathname).toBe(destino), WAIT);
      if (encabezado !== null) expect(await screen.findByRole("heading", { name: encabezado }, WAIT)).toBeInTheDocument();
      expect(document.querySelector("#admin-sidebar")).toBeNull();
      expect(document.querySelector("#contenido")).toBeNull();
      expect(screen.queryByRole("link", { name: "Cotizaciones" })).toBeNull();
      expect(screen.queryByText("Prospecto Sintético Siete")).toBeNull();
      expect(libs.listarPaginaCotizaciones).not.toHaveBeenCalled();
      expect(libs.obtenerCotizacion).not.toHaveBeenCalled();
    });
  });
});
