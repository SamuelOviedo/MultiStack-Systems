// Caracterización: fija el comportamiento que `/dashboard` tenía ANTES del rediseño del Inicio (contadores,
// renovaciones, solicitudes pendientes, lista de proyectos, alta de proyecto). Se escribió contra el código
// anterior y debe seguir en verde después; lo único que se actualiza son los TEXTOS y el marcado que se cambian a
// propósito, y todos viven en `ADAPTADOR` (con la razón de cada cambio al lado).
//
// Se renderiza la página real con `useAuth` y las funciones de `src/lib` simuladas (como `admin-routes.test.tsx`);
// los datos son inventados sobre dominios reservados (`.test`).
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 15000 });

/** Un nombre de proyecto sale en «Proyectos recientes» y también en «Actividad reciente»: se espera a que aparezca. */
const proyecto = async (nombre: string) => (await screen.findAllByText(nombre, {}, WAIT))[0];

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
  createProject: vi.fn(),
  convertTicketToProject: vi.fn(),
  getProjectRequests: vi.fn(),
  getAllTickets: vi.fn(),
  getTeamMembers: vi.fn(),
}));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  getProjects: libs.getProjects,
  getProjectStages: libs.getProjectStages,
  getUpcomingRenewals: libs.getUpcomingRenewals,
  createProject: libs.createProject,
  convertTicketToProject: libs.convertTicketToProject,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getProjectRequests: libs.getProjectRequests,
  getAllTickets: libs.getAllTickets,
  getTeamMembers: libs.getTeamMembers,
}));

import Dashboard from "@/pages/dashboard/Dashboard";
import ProjectsList from "@/pages/dashboard/ProjectsList";

/**
 * Todo lo que cambia con el rediseño está aquí y en ningún otro sitio de este archivo.
 * Cada entrada lleva el motivo del cambio de texto o de marcado.
 */
const ADAPTADOR = {
  // «Total» solo era ambiguo junto a otras cifras; ahora dice de qué es el total. «Pausados» ya incluía
  // cancelados (regla de `DashboardStats`), el rótulo nuevo lo dice.
  etiquetas: { total: "Total de proyectos", activos: "Proyectos activos", enProgreso: "Proyectos en progreso", pausados: "Pausados o cancelados" },
  // El botón dejó el estilo de consola («[ NUEVO ]») y se llama «Nuevo proyecto».
  botonNuevo: /nuevo proyecto/i,
  // El diálogo de alta se llama «Nuevo proyecto» (antes `$ multistack create --project`).
  tituloAlta: /nuevo proyecto/i,
  botonCrear: /crear proyecto/i,
  // El encabezado de solicitudes pasó de «Solicitudes de proyecto pendientes (n)» a «Solicitudes pendientes»
  // con el número en una insignia; el patrón acepta ambos y el número se comprueba aparte.
  encabezadoSolicitudes: /solicitudes (de proyecto )?pendientes/i,
  botonConfirmar: /confirmar proyecto/i,
  // Sin proyectos ya no hay un «No hay proyectos todavía.» suelto sino un estado vacío con acción.
  vacio: /no hay proyectos todav[ií]a|a[uú]n no hay proyectos/i,
  /** ¿La fila de renovación marca urgencia? (antes: clase `text-destructive`; ahora: insignia con `data-tone`). */
  esUrgente: (fila: HTMLElement) => fila.querySelector('[data-tone="destructive"]') !== null,
  /** Días que muestra la fila de renovación (antes «3d», ahora «en 3 días»). */
  diasDe: (fila: HTMLElement) => Number(/(\d+)\s*(d\b|d[ií]as?)/.exec(fila.textContent ?? "")?.[1]),
};

const dia = (iso: string) => new Date(iso).toLocaleDateString("es-HN");
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const project = (id: string, nombre: string, estado: string, creado = "2026-10-15T15:00:00.000Z") => ({
  id,
  user_id: "u-admin",
  nombre_proyecto: nombre,
  descripcion: `Descripción de ${nombre}`,
  estado,
  fecha_creacion: creado,
  updated_at: creado,
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
const solicitud = (id: string, title: string, creado = "2026-10-30T15:00:00.000Z") => ({
  id,
  project_id: null,
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "solicitud",
  priority: "media",
  status: "abierto",
  title,
  description: "Quiero una tienda en línea",
  created_at: creado,
  updated_at: creado,
  resolved_at: null,
  assigned_to: null,
  message_count: 1,
});
const renovacion = (id: string, nombreProyecto: string, servicio: string, fecha: string) => ({
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
  nombre_proyecto: nombreProyecto,
});

function signIn(userType: number | null) {
  const user = { id: userType === 1 ? "u-colab" : "u-admin", email: "persona@example.test" };
  auth.user = user;
  auth.session = { user };
  auth.userType = userType;
}

function renderDashboard(Page: React.ComponentType = Dashboard) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Page />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Primer número tras la etiqueta, buscando hacia arriba hasta el contenedor del contador. */
function contador(etiqueta: string): number {
  let el: HTMLElement = screen.getByText(etiqueta, { exact: true });
  while (!/\d/.test(el.textContent ?? "") && el.parentElement) el = el.parentElement;
  return Number(/\d+/.exec(el.textContent ?? "")?.[0]);
}

/** Contenedor de la fila de una renovación, a partir del nombre de su servicio. */
function filaRenovacion(servicio: string): HTMLElement {
  let el: HTMLElement = screen.getByText(servicio);
  while (!/\d+\s*(d\b|d[ií]as?)/.test(el.textContent ?? "") && el.parentElement) el = el.parentElement;
  return el;
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
  signIn(0);
  libs.getProjects.mockReset().mockResolvedValue([]);
  libs.getProjectStages.mockReset().mockResolvedValue([]);
  libs.getUpcomingRenewals.mockReset().mockResolvedValue([]);
  libs.createProject.mockReset().mockResolvedValue({});
  libs.convertTicketToProject.mockReset().mockResolvedValue("p-nuevo");
  libs.getProjectRequests.mockReset().mockResolvedValue([]);
  libs.getAllTickets.mockReset().mockResolvedValue([]);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Inicio · contadores (reglas de DashboardStats)", () => {
  it("Total = todos; Activos = activo + mantenimiento; En progreso = análisis + desarrollo + despliegue; Pausados = pausado + cancelado", async () => {
    libs.getProjects.mockResolvedValue([
      project("a1", "Alfa", "activo"),
      project("a2", "Beta", "activo"),
      project("m1", "Gamma", "mantenimiento"),
      project("m2", "Iota", "mantenimiento"),
      project("d1", "Delta", "en_analisis"),
      project("d2", "Épsilon", "en_desarrollo"),
      project("d3", "Zeta", "en_despliegue"),
      project("p1", "Eta", "pausado"),
      project("c1", "Theta", "cancelado"),
    ]);
    renderDashboard();
    await screen.findByText(ADAPTADOR.etiquetas.total, {}, WAIT);
    await waitFor(() => expect(contador(ADAPTADOR.etiquetas.total)).toBe(9), WAIT);
    expect(contador(ADAPTADOR.etiquetas.activos)).toBe(4);
    expect(contador(ADAPTADOR.etiquetas.enProgreso)).toBe(3);
    expect(contador(ADAPTADOR.etiquetas.pausados)).toBe(2);
  });

  it("sin proyectos, los cuatro contadores son 0 (un cero real, no «sin dato»)", async () => {
    renderDashboard();
    await screen.findByText(ADAPTADOR.vacio, {}, WAIT);
    for (const etiqueta of Object.values(ADAPTADOR.etiquetas)) expect(contador(etiqueta)).toBe(0);
  });
});

describe("Inicio · carga según el rol", () => {
  it("espera a que el rol se resuelva: con userType nulo no consulta nada", async () => {
    signIn(null);
    renderDashboard();
    await new Promise((r) => setTimeout(r, 150));
    expect(libs.getProjects).not.toHaveBeenCalled();
    expect(libs.getUpcomingRenewals).not.toHaveBeenCalled();
    expect(libs.getProjectRequests).not.toHaveBeenCalled();
  });

  it("administrador: proyectos, renovaciones a 30 días y solicitudes (una vez cada una)", async () => {
    libs.getProjects.mockResolvedValue([project("p1", "Tienda Demo", "activo")]);
    renderDashboard();
    await proyecto("Tienda Demo");
    expect(libs.getProjects).toHaveBeenCalledTimes(1);
    expect(libs.getProjectStages).toHaveBeenCalledWith("p1");
    expect(libs.getUpcomingRenewals).toHaveBeenCalledTimes(1);
    expect(libs.getUpcomingRenewals).toHaveBeenCalledWith(30);
    expect(libs.getProjectRequests).toHaveBeenCalledTimes(1);
  });

  it("colaborador: no consulta solicitudes ni las muestra, aunque existan", async () => {
    signIn(1);
    libs.getProjects.mockResolvedValue([project("p1", "Tienda Demo", "activo")]);
    libs.getProjectRequests.mockResolvedValue([solicitud("r1", "Solicitud: tienda")]);
    renderDashboard();
    await proyecto("Tienda Demo");
    expect(libs.getProjectRequests).not.toHaveBeenCalled();
    expect(screen.queryByText(ADAPTADOR.encabezadoSolicitudes)).toBeNull();
    expect(screen.queryByText("Solicitud: tienda")).toBeNull();
    expect(screen.queryByRole("button", { name: ADAPTADOR.botonConfirmar })).toBeNull();
  });
});

describe("Inicio · renovaciones próximas", () => {
  beforeEach(() => {
    // Solo se congela Date: los temporizadores reales siguen vivos para waitFor.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T15:00:00.000Z"));
  });

  it("muestra cada renovación con su proyecto y servicio, en el orden en que llegan (fecha ascendente)", async () => {
    libs.getUpcomingRenewals.mockResolvedValue([
      renovacion("s1", "Tienda Demo", "tienda-demo.example", "2026-11-05"),
      renovacion("s2", "Portal Ejemplo", "portal-ejemplo.example", "2026-11-20"),
    ]);
    renderDashboard();
    const primero = await screen.findByText("tienda-demo.example", {}, WAIT);
    const segundo = await screen.findByText("portal-ejemplo.example", {}, WAIT);
    expect(primero.compareDocumentPosition(segundo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filaRenovacion("tienda-demo.example")).toHaveTextContent("Tienda Demo");
    expect(filaRenovacion("portal-ejemplo.example")).toHaveTextContent("Portal Ejemplo");
  });

  it("la urgencia es de 7 días o menos (7 sí, 8 no) y los días salen de daysUntil", async () => {
    libs.getUpcomingRenewals.mockResolvedValue([
      renovacion("s1", "Tienda Demo", "tres-dias.example", "2026-11-05"), // 3
      renovacion("s2", "Tienda Demo", "siete-dias.example", "2026-11-09"), // 7: límite, urgente
      renovacion("s3", "Tienda Demo", "ocho-dias.example", "2026-11-10"), // 8: ya no
      renovacion("s4", "Tienda Demo", "veintiocho-dias.example", "2026-11-30"), // 28
    ]);
    renderDashboard();
    await screen.findByText("tres-dias.example", {}, WAIT);
    const casos: [string, number, boolean][] = [
      ["tres-dias.example", 3, true],
      ["siete-dias.example", 7, true],
      ["ocho-dias.example", 8, false],
      ["veintiocho-dias.example", 28, false],
    ];
    for (const [servicio, dias, urgente] of casos) {
      const fila = filaRenovacion(servicio);
      expect(ADAPTADOR.diasDe(fila), servicio).toBe(dias);
      expect(ADAPTADOR.esUrgente(fila), `${servicio} urgente`).toBe(urgente);
    }
  });
});

describe("Inicio · solicitudes de proyecto pendientes (solo administrador)", () => {
  it("lista cada solicitud tal como llega, con cliente, correo y fecha, y su botón de confirmar", async () => {
    libs.getProjectRequests.mockResolvedValue([
      solicitud("r1", "Solicitud: sitio web", "2026-10-30T15:00:00.000Z"),
      solicitud("r2", "Solicitud: tienda en línea", "2026-10-28T15:00:00.000Z"),
    ]);
    renderDashboard();
    const primera = await screen.findByText("Solicitud: sitio web", {}, WAIT);
    const segunda = screen.getByText("Solicitud: tienda en línea");
    expect(primera.compareDocumentPosition(segunda) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(ADAPTADOR.encabezadoSolicitudes).closest("div")).toHaveTextContent("2");
    expect(screen.getAllByText(/Cliente Demo/)).toHaveLength(2);
    expect(screen.getAllByText(/cliente@example\.test/)).toHaveLength(2);
    expect(screen.getByText(new RegExp(escapeRegExp(dia("2026-10-30T15:00:00.000Z"))))).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: ADAPTADOR.botonConfirmar })).toHaveLength(2);
  });

  it("sin solicitudes no hay bloque de solicitudes ni botón de confirmar", async () => {
    libs.getProjects.mockResolvedValue([project("p1", "Tienda Demo", "activo")]);
    renderDashboard();
    await proyecto("Tienda Demo");
    expect(screen.queryByRole("button", { name: ADAPTADOR.botonConfirmar })).toBeNull();
  });

  it("confirmar abre el modal de alcance con el título de la solicitud y consulta al equipo", async () => {
    libs.getProjectRequests.mockResolvedValue([solicitud("r1", "Solicitud: sitio web")]);
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: ADAPTADOR.botonConfirmar }, WAIT));
    const dialogo = await screen.findByRole("dialog", {}, WAIT);
    // El título del modal dejó el estilo de consola («$ convertir a proyecto oficial») y es «Convertir en proyecto».
    expect(within(dialogo).getByText(/convertir en proyecto/i)).toBeInTheDocument();
    expect(within(dialogo).getByDisplayValue("Solicitud: sitio web")).toBeInTheDocument();
    await waitFor(() => expect(libs.getTeamMembers).toHaveBeenCalledTimes(1));
  });
});

// Las tarjetas de siempre viven ahora en la lista completa (/dashboard/proyectos) y el Resumen muestra filas
// compactas de los más recientes: las reglas (orden, enlace, estado, cliente, fecha, avance) valen en las dos
// pantallas; la descripción solo se muestra en la lista.
describe.each([
  ["Resumen", Dashboard, false],
  ["Lista de proyectos", ProjectsList, true],
] as const)("Proyectos · %s", (_nombre, Page, muestraDescripcion) => {
  it("las tarjetas siguen el orden de getProjects y enlazan a /dashboard/project/:id", async () => {
    libs.getProjects.mockResolvedValue([
      project("id-c", "Proyecto C", "activo"),
      project("id-a", "Proyecto A", "en_desarrollo"),
      project("id-b", "Proyecto B", "pausado"),
    ]);
    renderDashboard(Page);
    await proyecto("Proyecto C");
    const enlaces = screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/dashboard/project/"));
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard/project/id-c",
      "/dashboard/project/id-a",
      "/dashboard/project/id-b",
    ]);
    expect(enlaces[0]).toHaveTextContent("Proyecto C");
    // Estado con la etiqueta de STATUS_CONFIG, cliente, descripción y fecha de creación.
    expect(enlaces[0]).toHaveTextContent("Activo");
    expect(enlaces[1]).toHaveTextContent("En desarrollo");
    expect(enlaces[2]).toHaveTextContent("Pausado");
    expect(enlaces[0]).toHaveTextContent("Cliente de Proyecto C");
    if (muestraDescripcion) expect(enlaces[0]).toHaveTextContent("Descripción de Proyecto C");
    expect(enlaces[0]).toHaveTextContent(dia("2026-10-15T15:00:00.000Z"));
  });

  it("el progreso es etapas registradas / 6, con el nombre de la etapa que toca", async () => {
    libs.getProjects.mockResolvedValue([
      project("p0", "Sin etapas", "en_analisis"),
      project("p2", "Dos etapas", "en_desarrollo"),
      project("p6", "Seis etapas", "mantenimiento"),
    ]);
    const etapas: Record<string, number> = { p0: 0, p2: 2, p6: 6 };
    libs.getProjectStages.mockImplementation(async (id: string) =>
      Array.from({ length: etapas[id] }, (_, i) => ({ id: `${id}-${i}`, project_id: id, stage_key: `k${i}` })),
    );
    renderDashboard(Page);
    await waitFor(() => {
      const tarjeta = screen.getByRole("link", { name: /Dos etapas/ });
      expect(tarjeta).toHaveTextContent("33%");
    }, WAIT);
    const tarjeta = (nombre: RegExp) => screen.getByRole("link", { name: nombre });
    expect(tarjeta(/Sin etapas/)).toHaveTextContent("0%");
    expect(tarjeta(/Sin etapas/)).toHaveTextContent("Análisis");
    expect(tarjeta(/Dos etapas/)).toHaveTextContent("Desarrollo"); // PIPELINE_STAGES[2]
    expect(tarjeta(/Seis etapas/)).toHaveTextContent("100%");
    expect(tarjeta(/Seis etapas/)).toHaveTextContent("Mantenimiento Activo"); // tope: la última etapa
  });

  it("sin proyectos invita a crear el primero", async () => {
    renderDashboard(Page);
    expect(await screen.findByText(ADAPTADOR.vacio, {}, WAIT)).toBeInTheDocument();
  });
});

describe("Inicio · crear proyecto", () => {
  async function abrirAlta() {
    renderDashboard();
    await screen.findByText(ADAPTADOR.etiquetas.total, {}, WAIT);
    fireEvent.click(screen.getAllByRole("button", { name: ADAPTADOR.botonNuevo })[0]);
    return screen.findByRole("dialog", {}, WAIT);
  }

  it("el botón abre el alta; el botón de crear espera un nombre", async () => {
    const dialogo = await abrirAlta();
    expect(within(dialogo).getByText(ADAPTADOR.tituloAlta)).toBeInTheDocument();
    expect(within(dialogo).getByRole("button", { name: ADAPTADOR.botonCrear })).toBeDisabled();
  });

  it("crear envía el payload de siempre (vacíos = null), avisa y recarga la lista", async () => {
    const dialogo = await abrirAlta();
    fireEvent.change(within(dialogo).getByPlaceholderText("Mi nuevo proyecto"), { target: { value: "  Proyecto Nuevo  " } });
    fireEvent.change(within(dialogo).getByPlaceholderText("Nombre del cliente"), { target: { value: "Cliente Demo" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: ADAPTADOR.botonCrear }));
    await waitFor(() => expect(libs.createProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.createProject).toHaveBeenCalledWith("u-admin", {
      nombre_proyecto: "Proyecto Nuevo",
      descripcion: null,
      client_name: "Cliente Demo",
      client_email: null,
      client_phone: null,
    });
    await waitFor(() => expect(libs.getProjects).toHaveBeenCalledTimes(2), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });
});
