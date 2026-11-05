// Lista de proyectos (`/dashboard/proyectos`): tarjetas, avance accesible, búsqueda y filtro por
// estado en el navegador (sobre lo ya cargado), contador y estados de carga, vacío y error.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUS_CONFIG } from "@/types/projects";

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
  createProject: vi.fn(),
}));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  getProjects: libs.getProjects,
  getProjectStages: libs.getProjectStages,
  createProject: libs.createProject,
}));

import ProjectsList from "@/pages/dashboard/ProjectsList";

const ID = "10000000-0000-4000-8000-0000000000aa";
const project = (id: string, nombre: string, estado: string, extra: Record<string, unknown> = {}) => ({
  id,
  user_id: "u-admin",
  nombre_proyecto: nombre,
  descripcion: null,
  estado,
  fecha_creacion: "2026-10-15T15:00:00.000Z",
  updated_at: "2026-10-15T15:00:00.000Z",
  client_name: null,
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

const SET = [
  project("a", "Tienda Alfa", "activo", { client_name: "Cliente Norte", descripcion: "Tienda en línea" }),
  project("b", "Portal Beta", "en_desarrollo", { client_name: "Cliente Sur" }),
  project("c", "Sitio Gamma", "pausado", { descripcion: "Análisis de contenido" }),
  project("d", "Intranet Delta", "mantenimiento", { client_name: "Cliente Norte" }),
  project("e", "App Épsilon", "cancelado"),
];

function renderLista() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/dashboard/proyectos"]}>
        <ProjectsList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const never = () => new Promise<never>(() => {});
const tarjetas = () =>
  screen.queryAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/dashboard/project/"));

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
  const user = { id: "u-admin", email: "persona@example.test" };
  auth.user = user;
  auth.session = { user };
  auth.userType = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  libs.getProjects.mockReset().mockResolvedValue(SET);
  libs.getProjectStages.mockReset().mockResolvedValue([]);
  libs.createProject.mockReset().mockResolvedValue({});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Lista de proyectos · estructura", () => {
  it("h1 «Proyectos», descripción, acción «Nuevo proyecto» y contador", async () => {
    renderLista();
    expect(await screen.findByRole("heading", { level: 1, name: "Proyectos" }, WAIT)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByText(/estado y su avance por etapas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo proyecto" })).toBeInTheDocument();
    expect(await screen.findByText("5 proyectos", {}, WAIT)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\$ multistack|session:|\[ ?NUEVO/i);
  });

  it("una lista de tarjetas en el orden de getProjects, cada una con su enlace y su estado real", async () => {
    renderLista();
    await screen.findByText("Tienda Alfa", {}, WAIT);
    const lista = screen.getByRole("list");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(5);
    expect(tarjetas().map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard/project/a",
      "/dashboard/project/b",
      "/dashboard/project/c",
      "/dashboard/project/d",
      "/dashboard/project/e",
    ]);
    expect(tarjetas()[0]).toHaveTextContent("Cliente Norte");
    expect(tarjetas()[0]).toHaveTextContent("Tienda en línea");
    expect(tarjetas()[0]).toHaveTextContent("Activo");
    // El nombre es un h2 dentro del enlace.
    expect(within(tarjetas()[0]).getByRole("heading", { level: 2, name: "Tienda Alfa" })).toBeInTheDocument();
  });

  it("cada uno de los 7 estados se pinta con la etiqueta de STATUS_CONFIG", async () => {
    libs.getProjects.mockResolvedValue(Object.keys(STATUS_CONFIG).map((estado, i) => project(`s${i}`, `Proyecto ${estado}`, estado)));
    renderLista();
    await screen.findByText("Proyecto activo", {}, WAIT);
    for (const [estado, { label }] of Object.entries(STATUS_CONFIG)) {
      const tarjeta = screen.getByRole("link", { name: new RegExp(`Proyecto ${estado}`) });
      expect(within(tarjeta).getByText(label, { selector: "span[data-kind='project']" })).toBeInTheDocument();
    }
  });

  it("un estado desconocido se muestra como «En análisis» en vez de romper la pantalla", async () => {
    libs.getProjects.mockResolvedValue([project("x", "Proyecto raro", "estado_nuevo")]);
    renderLista();
    const tarjeta = await screen.findByRole("link", { name: /Proyecto raro/ }, WAIT);
    expect(tarjeta).toHaveTextContent("En análisis");
  });

  it("no enseña identificadores crudos (UUID) en la tarjeta", async () => {
    libs.getProjects.mockResolvedValue([project(ID, "Proyecto con id", "activo")]);
    renderLista();
    const tarjeta = await screen.findByRole("link", { name: /Proyecto con id/ }, WAIT);
    expect(tarjeta.textContent).not.toContain(ID);
    expect(tarjeta.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(tarjeta).toHaveAttribute("href", `/dashboard/project/${ID}`);
  });
});

describe("Lista de proyectos · avance por etapas accesible", () => {
  it("cada tarjeta trae texto («Desarrollo», «33%») y un progressbar con valores", async () => {
    libs.getProjects.mockResolvedValue([project("p0", "Sin etapas", "en_analisis"), project("p2", "Dos etapas", "en_desarrollo"), project("p6", "Seis etapas", "mantenimiento")]);
    const etapas: Record<string, number> = { p0: 0, p2: 2, p6: 6 };
    libs.getProjectStages.mockImplementation(async (id: string) => Array.from({ length: etapas[id] }, (_, i) => ({ id: `${id}${i}` })));
    renderLista();
    const barra = await screen.findByRole("progressbar", { name: "Avance de Dos etapas" }, WAIT);
    await waitFor(() => expect(barra).toHaveAttribute("aria-valuenow", "2"), WAIT);
    expect(barra).toHaveAttribute("aria-valuetext", "2 de 6 etapas (33%)");
    expect(barra).toHaveAttribute("aria-valuemin", "0");
    expect(barra).toHaveAttribute("aria-valuemax", "6");
    const tarjeta = screen.getByRole("link", { name: /Dos etapas/ });
    expect(tarjeta).toHaveTextContent("Desarrollo");
    expect(tarjeta).toHaveTextContent("33%");
    expect(screen.getByRole("progressbar", { name: "Avance de Sin etapas" })).toHaveAttribute("aria-valuenow", "0");
    expect(screen.getByRole("progressbar", { name: "Avance de Seis etapas" })).toHaveAttribute("aria-valuetext", "6 de 6 etapas (100%)");
  });

  it("si la base trajera más de 6 etapas la barra no se sale de 0..6", async () => {
    libs.getProjects.mockResolvedValue([project("p", "Desbordado", "activo")]);
    libs.getProjectStages.mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({ id: String(i) })));
    renderLista();
    const barra = await screen.findByRole("progressbar", { name: "Avance de Desbordado" }, WAIT);
    await waitFor(() => expect(barra).toHaveAttribute("aria-valuenow", "6"), WAIT);
    expect(barra).toHaveAttribute("aria-valuetext", "6 de 6 etapas (100%)");
  });
});

describe("Lista de proyectos · búsqueda y filtro por estado (en el navegador)", () => {
  it("la búsqueda mira nombre, cliente y descripción, sin distinguir mayúsculas ni acentos", async () => {
    renderLista();
    await screen.findByText("Tienda Alfa", {}, WAIT);
    const buscar = screen.getByRole("searchbox", { name: "Buscar proyectos" });
    fireEvent.change(buscar, { target: { value: "cliente norte" } });
    expect(tarjetas().map((a) => a.getAttribute("href"))).toEqual(["/dashboard/project/a", "/dashboard/project/d"]);
    fireEvent.change(buscar, { target: { value: "ANALISIS" } }); // descripción «Análisis de contenido»
    expect(tarjetas().map((a) => a.getAttribute("href"))).toEqual(["/dashboard/project/c"]);
    fireEvent.change(buscar, { target: { value: "epsilon" } }); // nombre «App Épsilon»
    expect(tarjetas().map((a) => a.getAttribute("href"))).toEqual(["/dashboard/project/e"]);
    // Sin pedir nada nuevo a la base: solo se filtra lo cargado.
    expect(libs.getProjects).toHaveBeenCalledTimes(1);
  });

  it("los filtros son botones con aria-pressed y los mismos grupos que los contadores del Resumen", async () => {
    renderLista();
    await screen.findByText("Tienda Alfa", {}, WAIT);
    const grupo = screen.getByRole("group", { name: "Filtrar por estado" });
    const boton = (n: string | RegExp) => within(grupo).getByRole("button", { name: n });
    expect(boton(/^Todos/)).toHaveAttribute("aria-pressed", "true");
    // Todos 5; Activos = activo + mantenimiento (2); En progreso = en_desarrollo (1); Pausados o cancelados = 2.
    expect(boton(/^Todos/)).toHaveTextContent("5");
    expect(boton(/^Activos/)).toHaveTextContent("2");
    expect(boton(/^En progreso/)).toHaveTextContent("1");
    expect(boton(/^Pausados o cancelados/)).toHaveTextContent("2");

    fireEvent.click(boton(/^Activos/));
    expect(boton(/^Activos/)).toHaveAttribute("aria-pressed", "true");
    expect(boton(/^Todos/)).toHaveAttribute("aria-pressed", "false");
    expect(tarjetas().map((a) => a.getAttribute("href"))).toEqual(["/dashboard/project/a", "/dashboard/project/d"]);

    fireEvent.click(boton(/^Pausados o cancelados/));
    expect(tarjetas().map((a) => a.getAttribute("href"))).toEqual(["/dashboard/project/c", "/dashboard/project/e"]);
  });

  it("el contador dice cuántos se ven de cuántos y se anuncia (aria-live)", async () => {
    renderLista();
    const contador = await screen.findByText("5 proyectos", {}, WAIT);
    expect(contador).toHaveAttribute("aria-live", "polite");
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar proyectos" }), { target: { value: "beta" } });
    expect(contador).toHaveTextContent("Mostrando 1 de 5 proyectos");
  });

  it("los números de cada filtro cuentan lo que deja pasar la búsqueda", async () => {
    renderLista();
    await screen.findByText("Tienda Alfa", {}, WAIT);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar proyectos" }), { target: { value: "cliente norte" } });
    const grupo = screen.getByRole("group", { name: "Filtrar por estado" });
    expect(within(grupo).getByRole("button", { name: /^Todos/ })).toHaveTextContent("2");
    expect(within(grupo).getByRole("button", { name: /^Pausados o cancelados/ })).toHaveTextContent("0");
  });

  it("sin coincidencias: estado vacío con «Quitar filtros», que restablece búsqueda y filtro", async () => {
    renderLista();
    await screen.findByText("Tienda Alfa", {}, WAIT);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar proyectos" }), { target: { value: "no existe" } });
    expect(screen.getByRole("heading", { name: "Ningún proyecto coincide" })).toBeInTheDocument();
    expect(tarjetas()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(tarjetas()).toHaveLength(5);
    expect(screen.getByRole("searchbox", { name: "Buscar proyectos" })).toHaveValue("");
    expect(screen.getByRole("button", { name: /^Todos/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("con un solo proyecto el contador va en singular", async () => {
    libs.getProjects.mockResolvedValue([project("a", "Único", "activo")]);
    renderLista();
    expect(await screen.findByText("1 proyecto", {}, WAIT)).toBeInTheDocument();
  });
});

describe("Lista de proyectos · estados", () => {
  it("cargando: esqueletos con «Cargando proyectos…» y aria-busy; sin buscador todavía", async () => {
    libs.getProjects.mockImplementation(never);
    renderLista();
    expect(await screen.findByText("Cargando proyectos…")).toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("sin proyectos: estado vacío con acción que abre el alta; sin buscador ni filtros", async () => {
    libs.getProjects.mockResolvedValue([]);
    renderLista();
    expect(await screen.findByRole("heading", { name: "Aún no hay proyectos" }, WAIT)).toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.queryByRole("group", { name: "Filtrar por estado" })).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "Nuevo proyecto" })[1]);
    expect(await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT)).toBeInTheDocument();
  });

  it("error: mensaje en español sin el texto técnico y «Reintentar» recarga", async () => {
    libs.getProjects.mockRejectedValueOnce(Object.assign(new Error('permission denied for table "proyectos_clientes"'), { code: "42501" }));
    renderLista();
    const aviso = await screen.findByRole("alert", {}, WAIT);
    expect(aviso).toHaveTextContent("No tienes permiso para ver los proyectos.");
    expect(document.body.textContent).not.toMatch(/proyectos_clientes|permission denied/);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("proyectos"), "42501");
    fireEvent.click(within(aviso).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Tienda Alfa", {}, WAIT)).toBeInTheDocument();
    expect(libs.getProjects).toHaveBeenCalledTimes(2);
  });

  it("crear un proyecto desde la lista recarga la lista", async () => {
    renderLista();
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }, WAIT));
    const dialogo = await screen.findByRole("dialog", { name: "Nuevo proyecto" }, WAIT);
    fireEvent.change(within(dialogo).getByLabelText(/Nombre del proyecto/), { target: { value: "Proyecto nuevo" } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Crear proyecto" }));
    await waitFor(() => expect(libs.createProject).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(libs.getProjects).toHaveBeenCalledTimes(2), WAIT);
  });

  it("espera al rol: con userType nulo no consulta nada; el colaborador ve la misma lista que le entregue la base", async () => {
    auth.userType = null;
    renderLista();
    await new Promise((r) => setTimeout(r, 120));
    expect(libs.getProjects).not.toHaveBeenCalled();
    cleanup();
    auth.userType = 1;
    auth.user = { id: "u-colab", email: "colab@example.test" };
    renderLista();
    expect(await screen.findByText("Tienda Alfa", {}, WAIT)).toBeInTheDocument();
    expect(libs.getProjects).toHaveBeenCalledTimes(1);
  });
});
