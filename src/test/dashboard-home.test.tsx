// Resumen (`/dashboard`): lo NUEVO del rediseño. Roles ARIA, nombres accesibles, estados de carga,
// vacío y error, alertas con urgencia en texto + icono + color, actividad derivada de datos reales, rol.
// Las reglas heredadas (contadores, 30 días, 7 días, solicitudes, avance, alta) las fija
// `dashboard-home-characterization.test.tsx`.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 15000 });

const auth = vi.hoisted(() => ({
  session: null as unknown,
  user: null as { id: string; email: string } | null,
  userType: null as number | null,
  loading: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));

const libs = vi.hoisted(() => ({
  getProjects: vi.fn(),
  getProjectStages: vi.fn(),
  getUpcomingRenewals: vi.fn(),
  getProjectRequests: vi.fn(),
  getAllTickets: vi.fn(),
  getTeamMembers: vi.fn(),
  createProject: vi.fn(),
}));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  getProjects: libs.getProjects,
  getProjectStages: libs.getProjectStages,
  getUpcomingRenewals: libs.getUpcomingRenewals,
  createProject: libs.createProject,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getProjectRequests: libs.getProjectRequests,
  getAllTickets: libs.getAllTickets,
  getTeamMembers: libs.getTeamMembers,
}));

import Dashboard from "@/pages/dashboard/Dashboard";

const project = (id: string, nombre: string, estado: string, updated: string | null, creado = "2026-09-01T15:00:00.000Z") => ({
  id,
  user_id: "u-admin",
  nombre_proyecto: nombre,
  descripcion: null,
  estado,
  fecha_creacion: creado,
  updated_at: updated,
  client_name: null,
  client_email: null,
  client_phone: null,
  client_id: null,
  lead_developer_id: null,
  requirements: {},
  deadline: null,
  source_ticket_id: null,
  google_docs_requirements_url: null,
});
const ticket = (id: string, title: string, status: string, updated: string, created = updated) => ({
  id,
  project_id: "p1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "bug",
  priority: "media",
  status,
  title,
  description: null,
  created_at: created,
  updated_at: updated,
  resolved_at: null,
  assigned_to: null,
  assignee_email: null,
  nombre_proyecto: "Proyecto Uno",
  message_count: 0,
});
const renovacion = (id: string, servicio: string, fecha: string) => ({
  id,
  project_id: "p1",
  service_type: "domain",
  provider: "Proveedor Demo",
  name: servicio,
  url: null,
  cost_monthly: null,
  cost_yearly: null,
  currency: "USD",
  renewal_date: fecha,
  notes: null,
  created_at: "2026-01-01T00:00:00.000Z",
  nombre_proyecto: "Proyecto Uno",
});

function signIn(userType: number | null) {
  const user = { id: userType === 1 ? "u-colab" : "u-admin", email: "persona@example.test" };
  auth.user = user;
  auth.session = { user };
  auth.userType = userType;
}

function renderResumen() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const never = () => new Promise<never>(() => {});

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
  signIn(0);
  vi.spyOn(console, "error").mockImplementation(() => {});
  libs.getProjects.mockReset().mockResolvedValue([]);
  libs.getProjectStages.mockReset().mockResolvedValue([]);
  libs.getUpcomingRenewals.mockReset().mockResolvedValue([]);
  libs.getProjectRequests.mockReset().mockResolvedValue([]);
  libs.getAllTickets.mockReset().mockResolvedValue([]);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
  libs.createProject.mockReset().mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("Resumen · encabezado y estructura", () => {
  it("un solo h1 «Resumen» con subtítulo y la acción «Nuevo proyecto» (sin corchetes ni consola)", async () => {
    renderResumen();
    expect(await screen.findByRole("heading", { level: 1, name: "Resumen" }, WAIT)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/estado de tus proyectos/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nuevo proyecto" })[0]).toBeInTheDocument();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\$ multistack|session:|\[ ?NUEVO ?\]|\[ ?CONFIRMAR/i);
    expect(text).not.toContain("persona@example.test");
  });

  it("los paneles son regiones con nombre y los títulos siguen la jerarquía h2 > h3", async () => {
    renderResumen();
    await screen.findByRole("heading", { level: 1, name: "Resumen" }, WAIT);
    for (const name of ["Alertas", "Proyectos recientes", "Accesos rápidos", "Actividad reciente"]) {
      expect(await screen.findByRole("region", { name }, WAIT)).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 2, name })).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Indicadores" })).toBeInTheDocument();
  });
});

describe("Resumen · indicadores", () => {
  it("muestra los cinco como grupos con nombre, con los tickets abiertos de getAllTickets", async () => {
    libs.getProjects.mockResolvedValue([project("p1", "Proyecto Uno", "activo", "2026-10-20T10:00:00.000Z")]);
    libs.getAllTickets.mockResolvedValue([
      ticket("t1", "Uno", "abierto", "2026-10-20T10:00:00.000Z"),
      ticket("t2", "Dos", "en_revision", "2026-10-20T10:00:00.000Z"),
      ticket("t3", "Tres", "en_progreso", "2026-10-20T10:00:00.000Z"),
      ticket("t4", "Cuatro", "asignado", "2026-10-20T10:00:00.000Z"),
      ticket("t5", "Cinco", "resuelto", "2026-10-20T10:00:00.000Z"),
      ticket("t6", "Seis", "cerrado", "2026-10-20T10:00:00.000Z"),
      ticket("t7", "Siete", "convertido", "2026-10-20T10:00:00.000Z"),
    ]);
    renderResumen();
    const grupo = (name: string) => screen.getByRole("group", { name });
    await waitFor(() => expect(grupo("Tickets abiertos")).toHaveTextContent("3"), WAIT);
    expect(grupo("Total de proyectos")).toHaveTextContent("1");
    // Mismo conjunto que el contador de TicketsGlobal y que la insignia del menú: abierto, en_revision, en_progreso.
    expect(grupo("Tickets abiertos")).not.toHaveTextContent("Cargando");
  });

  it("con datos todavía en camino muestra cargando (aria-busy) y no cifras", async () => {
    libs.getProjects.mockImplementation(never);
    libs.getAllTickets.mockImplementation(never);
    libs.getUpcomingRenewals.mockImplementation(never);
    libs.getProjectRequests.mockImplementation(never);
    renderResumen();
    const grupo = await screen.findByRole("group", { name: "Total de proyectos" });
    expect(grupo).toHaveAttribute("aria-busy", "true");
    expect(grupo).toHaveTextContent("Cargando");
    expect(screen.getByRole("group", { name: "Tickets abiertos" })).toHaveAttribute("aria-busy", "true");
    const alertas = screen.getByRole("region", { name: "Alertas" });
    expect(alertas).toHaveAttribute("aria-busy", "true");
  });

  it("si falla la lectura de proyectos NO inventa un 0: muestra «sin datos»", async () => {
    libs.getProjects.mockRejectedValue(new Error("fallo simulado"));
    renderResumen();
    const grupo = await screen.findByRole("group", { name: "Total de proyectos" });
    await waitFor(() => expect(grupo).toHaveTextContent("Sin datos"), WAIT);
    expect(grupo).not.toHaveTextContent(/\b0\b/);
  });
});

describe("Resumen · alertas", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T15:00:00.000Z"));
  });

  it("la urgencia se dice con texto, icono y tono: «Urgente» (7 días o menos) y «Próxima»", async () => {
    libs.getUpcomingRenewals.mockResolvedValue([
      renovacion("s1", "urgente.example", "2026-11-05"),
      renovacion("s2", "tranquila.example", "2026-11-25"),
    ]);
    renderResumen();
    const alertas = await screen.findByRole("region", { name: "Alertas" }, WAIT);
    const urgente = (await within(alertas).findByText("urgente.example", {}, WAIT)).closest("li")!;
    const tranquila = within(alertas).getByText("tranquila.example").closest("li")!;
    expect(within(urgente).getByText("Urgente")).toBeInTheDocument();
    expect(within(urgente).getByText(/en 3 días/)).toBeInTheDocument();
    expect(urgente.querySelector('[data-tone="destructive"] svg[aria-hidden="true"]')).not.toBeNull();
    expect(within(tranquila).getByText("Próxima")).toBeInTheDocument();
    expect(tranquila.querySelector('[data-tone="warning"]')).not.toBeNull();
    expect(within(tranquila).getByText(/en 23 días/)).toBeInTheDocument();
    expect(within(alertas).getByRole("heading", { level: 3, name: /Renovaciones próximas \(30 días\)/ })).toBeInTheDocument();
  });

  it("la fecha de renovación se escribe como día de calendario, sin correrse un día por la zona horaria", async () => {
    libs.getUpcomingRenewals.mockResolvedValue([renovacion("s1", "fecha.example", "2026-11-14")]);
    renderResumen();
    const fila = (await screen.findByText("fecha.example", {}, WAIT)).closest("li")!;
    // «14 nov» (es-HN); si se parseara como UTC saldría «13 nov» en Honduras.
    expect(fila.textContent).toMatch(/14\s+nov/i);
  });

  it("sin alertas dice «Todo al día» y, para el administrador, nombra las dos fuentes", async () => {
    renderResumen();
    expect(await screen.findByRole("heading", { name: "Todo al día" }, WAIT)).toBeInTheDocument();
    expect(screen.getByText(/ni proyectos por confirmar/)).toBeInTheDocument();
  });

  it("un colaborador solo ve renovaciones: el texto del panel no menciona solicitudes", async () => {
    signIn(1);
    renderResumen();
    expect(await screen.findByRole("heading", { name: "Todo al día" }, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(/ni proyectos por confirmar/)).toBeNull();
    expect(screen.getByRole("region", { name: "Alertas" })).not.toHaveTextContent(/solicitud/i);
  });

  it("si la lectura falla: mensaje en español, sin el texto técnico, y «Reintentar» vuelve a pedir", async () => {
    libs.getUpcomingRenewals.mockRejectedValueOnce(Object.assign(new Error("relation \"project_services\" does not exist"), { code: "42P01" }));
    renderResumen();
    const alertas = await screen.findByRole("region", { name: "Alertas" });
    const aviso = await within(alertas).findByRole("alert", {}, WAIT);
    expect(aviso).toHaveTextContent("No se pudieron cargar las alertas. Revisa tu conexión e inténtalo de nuevo.");
    expect(document.body.textContent).not.toMatch(/project_services|does not exist|42P01/);
    // Al registro solo va el código.
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("renovaciones"), "42P01");
    libs.getUpcomingRenewals.mockResolvedValue([renovacion("s1", "ya-cargo.example", "2026-11-05")]);
    fireEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await within(alertas).findByText("ya-cargo.example", {}, WAIT)).toBeInTheDocument();
    expect(within(alertas).queryByRole("alert")).toBeNull();
    expect(libs.getUpcomingRenewals).toHaveBeenCalledTimes(2);
  });

  it("un error de permisos se explica distinto", async () => {
    libs.getUpcomingRenewals.mockRejectedValue(Object.assign(new Error("x"), { code: "42501" }));
    renderResumen();
    const aviso = await within(await screen.findByRole("region", { name: "Alertas" })).findByRole("alert", {}, WAIT);
    expect(aviso).toHaveTextContent(/No tienes permiso para ver las alertas/);
  });
});

describe("Resumen · proyectos recientes", () => {
  it("muestra 6 como máximo, los de actualización más reciente primero, y enlaza a la lista completa", async () => {
    // Orden de llegada = por alta; las fechas de actualización lo reordenan (p3 tocado hace poco, p1 el más viejo).
    libs.getProjects.mockResolvedValue([
      project("p1", "Proyecto 1", "activo", "2026-10-01T10:00:00.000Z"),
      project("p2", "Proyecto 2", "activo", "2026-10-02T10:00:00.000Z"),
      project("p3", "Proyecto 3", "activo", "2026-10-30T10:00:00.000Z"),
      project("p4", "Proyecto 4", "activo", "2026-10-04T10:00:00.000Z"),
      project("p5", "Proyecto 5", "activo", "2026-10-05T10:00:00.000Z"),
      project("p6", "Proyecto 6", "activo", "2026-10-06T10:00:00.000Z"),
      project("p7", "Proyecto 7", "activo", null, "2026-10-07T10:00:00.000Z"), // sin updated_at: cuenta su alta
      project("p8", "Proyecto 8", "activo", "2026-09-01T10:00:00.000Z"),
    ]);
    renderResumen();
    const region = await screen.findByRole("region", { name: "Proyectos recientes" });
    await within(region).findByText("Proyecto 3", {}, WAIT);
    const enlaces = within(region)
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href")?.startsWith("/dashboard/project/"));
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard/project/p3",
      "/dashboard/project/p7",
      "/dashboard/project/p6",
      "/dashboard/project/p5",
      "/dashboard/project/p4",
      "/dashboard/project/p2",
    ]);
    expect(within(region).queryByText("Proyecto 1")).toBeNull();
    expect(within(region).queryByText("Proyecto 8")).toBeNull();
    expect(within(region).getByRole("link", { name: "Ver todos los proyectos" })).toHaveAttribute("href", "/dashboard/proyectos");
    // Los contadores siguen contando TODOS, no solo los 6 visibles.
    expect(screen.getByRole("group", { name: "Total de proyectos" })).toHaveTextContent("8");
  });

  it("el avance es un progressbar con nombre, valores y texto de valor", async () => {
    libs.getProjects.mockResolvedValue([project("p1", "Proyecto Uno", "en_desarrollo", "2026-10-30T10:00:00.000Z")]);
    libs.getProjectStages.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    renderResumen();
    const barra = await screen.findByRole("progressbar", { name: "Avance de Proyecto Uno" }, WAIT);
    expect(barra).toHaveAttribute("aria-valuemin", "0");
    expect(barra).toHaveAttribute("aria-valuemax", "6");
    expect(barra).toHaveAttribute("aria-valuenow", "2");
    expect(barra).toHaveAttribute("aria-valuetext", "2 de 6 etapas (33%)");
  });

  it("sin proyectos: estado vacío con la acción de crear (que abre el alta)", async () => {
    renderResumen();
    const region = await screen.findByRole("region", { name: "Proyectos recientes" });
    expect(await within(region).findByRole("heading", { name: "Aún no hay proyectos" }, WAIT)).toBeInTheDocument();
    fireEvent.click(within(region).getByRole("button", { name: "Nuevo proyecto" }));
    expect(await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT)).toBeInTheDocument();
  });

  it("carga: barras con texto «Cargando…»; error: mensaje claro y «Reintentar»", async () => {
    libs.getProjects.mockRejectedValueOnce(new Error("JWT expired"));
    renderResumen();
    const region = await screen.findByRole("region", { name: "Proyectos recientes" });
    const aviso = await within(region).findByRole("alert", {}, WAIT);
    expect(aviso).toHaveTextContent("No se pudieron cargar los proyectos. Revisa tu conexión e inténtalo de nuevo.");
    expect(document.body.textContent).not.toContain("JWT expired");
    libs.getProjects.mockResolvedValue([project("p1", "Proyecto Uno", "activo", "2026-10-30T10:00:00.000Z")]);
    fireEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await within(region).findByRole("link", { name: /Proyecto Uno/ }, WAIT)).toBeInTheDocument();
  });

  it("mientras carga hay esqueletos con «Cargando…» y la región indica aria-busy", async () => {
    libs.getProjects.mockImplementation(never);
    renderResumen();
    const region = await screen.findByRole("region", { name: "Proyectos recientes" });
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(within(region).getByText("Cargando…")).toBeInTheDocument();
  });
});

describe("Resumen · accesos rápidos", () => {
  it("salen del menú: solo módulos funcionales y existentes (Proyectos y Tickets), nunca los «Pronto»", async () => {
    renderResumen();
    const region = await screen.findByRole("region", { name: "Accesos rápidos" });
    const enlaces = within(region).getAllByRole("link");
    expect(enlaces.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Proyectos", "/dashboard/proyectos"],
      ["Tickets", "/dashboard/tickets"],
    ]);
  });
});

describe("Resumen · actividad reciente (derivada de datos reales)", () => {
  it("combina tickets (por su última actualización) y proyectos (por su alta), recientes primero, máximo 6", async () => {
    libs.getProjects.mockResolvedValue([project("p1", "Proyecto Uno", "activo", null, "2026-10-10T10:00:00.000Z")]);
    libs.getAllTickets.mockResolvedValue([
      ticket("t1", "Botón roto", "en_progreso", "2026-10-30T10:00:00.000Z", "2026-10-01T10:00:00.000Z"),
      ticket("t2", "Duda nueva", "abierto", "2026-10-25T10:00:00.000Z"),
    ]);
    renderResumen();
    const region = await screen.findByRole("region", { name: "Actividad reciente" });
    await within(region).findByText("Botón roto", {}, WAIT);
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Ticket actualizado");
    expect(items[0]).toHaveTextContent("Botón roto");
    expect(items[0]).toHaveTextContent("En progreso"); // el estado actual, con el mapa real
    expect(items[1]).toHaveTextContent("Ticket nuevo"); // updated_at = created_at: nunca cambió
    expect(items[2]).toHaveTextContent("Proyecto creado");
    expect(items[2]).toHaveTextContent("Proyecto Uno");
    // Cada hecho lleva su fecha en un <time> con la fecha ISO real.
    expect(items[0].querySelector("time")).toHaveAttribute("datetime", "2026-10-30T10:00:00.000Z");
  });

  it("sin datos dice la verdad: «Aún no hay actividad que mostrar»", async () => {
    renderResumen();
    const region = await screen.findByRole("region", { name: "Actividad reciente" });
    expect(await within(region).findByRole("heading", { name: "Aún no hay actividad que mostrar" }, WAIT)).toBeInTheDocument();
  });

  it("si falla la lectura de tickets: error propio con reintento, sin afectar a los demás paneles", async () => {
    libs.getAllTickets.mockRejectedValueOnce(Object.assign(new Error("boom"), { status: 500 }));
    libs.getProjects.mockResolvedValue([project("p1", "Proyecto Uno", "activo", "2026-10-30T10:00:00.000Z")]);
    renderResumen();
    const region = await screen.findByRole("region", { name: "Actividad reciente" });
    const aviso = await within(region).findByRole("alert", {}, WAIT);
    expect(aviso).toHaveTextContent("No se pudieron cargar la actividad");
    expect(await screen.findByRole("link", { name: /Proyecto Uno/ }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tickets abiertos" })).toHaveTextContent("Sin datos");
    libs.getAllTickets.mockResolvedValue([ticket("t1", "Botón roto", "abierto", "2026-10-30T10:00:00.000Z")]);
    fireEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await within(region).findByText("Botón roto", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Tickets abiertos" })).toHaveTextContent("1");
  });
});

describe("Resumen · tickets según el rol", () => {
  it("el administrador pide todos (sin filtro) y el colaborador solo los asignados a él", async () => {
    renderResumen();
    await waitFor(() => expect(libs.getAllTickets).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.getAllTickets).toHaveBeenLastCalledWith(undefined);
    cleanup();
    libs.getAllTickets.mockClear();
    signIn(1);
    renderResumen();
    await waitFor(() => expect(libs.getAllTickets).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.getAllTickets).toHaveBeenLastCalledWith({ assignedTo: "u-colab" });
  });
});

describe("Resumen · Centro de Operaciones y Finanzas (próximamente)", () => {
  it("solo el administrador ve la tarjeta, con la insignia «Pronto» y sin ninguna cifra", async () => {
    renderResumen();
    const region = await screen.findByRole("region", { name: "Centro de Operaciones y Finanzas" }, WAIT);
    expect(within(region).getByText("Pronto")).toBeInTheDocument();
    expect(region.querySelector('[data-kind="custom"]')).not.toBeNull();
    expect(region.textContent).not.toMatch(/\d/);
    expect(region).toHaveTextContent(/solo para administradores/i);
  });

  it("el colaborador no la ve", async () => {
    signIn(1);
    renderResumen();
    await screen.findByRole("heading", { level: 1, name: "Resumen" }, WAIT);
    await screen.findByRole("region", { name: "Accesos rápidos" }, WAIT);
    expect(screen.queryByRole("region", { name: "Centro de Operaciones y Finanzas" })).toBeNull();
  });
});

describe("Resumen · crear y confirmar refrescan los datos", () => {
  it("tras crear un proyecto se vuelve a pedir lo del panel (proyectos, renovaciones, tickets)", async () => {
    renderResumen();
    await waitFor(() => expect(libs.getProjects).toHaveBeenCalledTimes(1), WAIT);
    fireEvent.click(screen.getAllByRole("button", { name: "Nuevo proyecto" })[0]);
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT);
    fireEvent.change(within(dialogo).getByLabelText(/Nombre del proyecto/), { target: { value: "Proyecto X" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() => expect(libs.getProjects).toHaveBeenCalledTimes(2), WAIT);
    expect(libs.getUpcomingRenewals).toHaveBeenCalledTimes(2);
    expect(libs.getAllTickets).toHaveBeenCalledTimes(2);
  });

  it("si crear falla, el aviso no muestra el texto técnico", async () => {
    libs.createProject.mockRejectedValue(Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }));
    renderResumen();
    fireEvent.click((await screen.findAllByRole("button", { name: "Nuevo proyecto" }, WAIT))[0]);
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT);
    fireEvent.change(within(dialogo).getByLabelText(/Nombre del proyecto/), { target: { value: "Proyecto X" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() => expect(libs.createProject).toHaveBeenCalled(), WAIT);
    await waitFor(() => expect(console.error).toHaveBeenCalledWith(expect.stringContaining("crear proyecto"), "23505"), WAIT);
    expect(document.body.textContent).not.toMatch(/duplicate key|unique constraint|23505/);
  });

  it("el alta tiene etiquetas asociadas a sus campos y un título «Nuevo proyecto»", async () => {
    renderResumen();
    fireEvent.click((await screen.findAllByRole("button", { name: "Nuevo proyecto" }, WAIT))[0]);
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT);
    for (const label of [/Nombre del proyecto/, /^Descripción$/, /^Nombre$/, /^Correo$/, /^Teléfono$/]) {
      expect(within(dialogo).getByLabelText(label)).toBeInTheDocument();
    }
    expect(within(dialogo).getByRole("group", { name: "Datos del cliente" })).toBeInTheDocument();
    expect(dialogo.textContent).not.toMatch(/\$ multistack|\[ CREAR|nombre_proyecto|client_name/);
  });
});

describe("Resumen · carga según el rol", () => {
  it("con el rol sin resolver todo muestra «Cargando…» y no se consulta nada", async () => {
    signIn(null);
    renderResumen();
    const grupo = await screen.findByRole("group", { name: "Total de proyectos" });
    expect(grupo).toHaveAttribute("aria-busy", "true");
    await new Promise((r) => setTimeout(r, 120));
    expect(libs.getProjects).not.toHaveBeenCalled();
    expect(libs.getAllTickets).not.toHaveBeenCalled();
  });
});
