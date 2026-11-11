// Autorización de INTERFAZ del panel: /dashboard y todas sus subrutas son solo del administrador (user_type 0).
// Se usa el `App` real (rutas, ProtectedRoute, lazy, Suspense); solo se sustituyen useAuth (la sesión de cada caso),
// las funciones de `src/lib` y el cliente de Supabase. No prueba la API: esa barrera es RLS.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

const supabaseFrom = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
  }),
);
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: supabaseFrom } }));

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
  getTeamMembers: libs.getTeamMembers,
}));

vi.mock("@/pages/client/MisSolicitudes.tsx", () => ({ default: () => <h1>Mis solicitudes (simulada)</h1> }));
vi.mock("@/pages/auth/Login.tsx", () => ({ default: () => <h1>Login (simulado)</h1> }));
vi.mock("@/pages/marketing/Index.tsx", () => ({ default: () => <h1>Landing (simulada)</h1> }));

import App from "@/App";

const NOW = "2026-11-02T15:00:00.000Z";
const PROJECT = {
  id: "p1", user_id: "u-admin", nombre_proyecto: "Tienda Demo", descripcion: "Descripción", estado: "activo",
  fecha_creacion: NOW, updated_at: NOW, client_name: "Cliente Demo", client_email: null, client_phone: null,
  client_id: null, lead_developer_id: null, requirements: {}, deadline: null, source_ticket_id: null,
  google_docs_requirements_url: null,
};
const TICKET = {
  id: "t1", project_id: "p1", client_name: "Cliente Demo", client_email: "cliente@example.test", type: "bug",
  priority: "media", status: "abierto", title: "Botón de pago roto", description: null, created_at: NOW,
  updated_at: NOW, resolved_at: null, assigned_to: null, assignee_email: null, nombre_proyecto: "Tienda Demo", message_count: 0,
};

const ID_COTIZACION = "0a1b2c3d-0007-4000-8000-000000000007";

/**
 * Las 7 rutas del panel (las 4 de siempre y las 3 de Cotizaciones) y la consulta que cada una dispara al montarse con
 * un administrador. El catálogo de Cotizaciones no carga datos en esta fase: lo único que consulta es lo del armazón
 * (el conteo de tickets abiertos), que tampoco debe correr con otro rol.
 */
const PANEL_ROUTES: ReadonlyArray<readonly [string, keyof typeof libs]> = [
  ["/dashboard", "getProjects"],
  ["/dashboard/proyectos", "getProjects"],
  ["/dashboard/project/p1", "getProject"],
  ["/dashboard/tickets", "getAllTickets"],
  ["/dashboard/cotizaciones", "listarPaginaCotizaciones"],
  ["/dashboard/cotizaciones/catalogo", "getOpenTicketsCount"],
  [`/dashboard/cotizaciones/${ID_COTIZACION}`, "obtenerCotizacion"],
];

function signIn(userType: number | null) {
  const user = { id: `u-${userType}`, email: "persona@example.test" };
  auth.session = { user: { ...user, email_confirmed_at: NOW } };
  auth.user = user;
  auth.userType = userType;
}

function goTo(path: string) {
  window.history.pushState({}, "", path);
  return render(<App />);
}

/** Ninguna consulta administrativa: ni una función de `src/lib` simulada ni una llamada directa a Supabase. */
function expectNoAdminQueries() {
  for (const [name, fn] of Object.entries(libs)) expect(fn, name).not.toHaveBeenCalled();
  expect(supabaseFrom).not.toHaveBeenCalled();
}

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  supabaseFrom.mockClear();
  libs.getProjects.mockReset().mockResolvedValue([PROJECT]);
  libs.getProject.mockReset().mockResolvedValue(PROJECT);
  libs.getProjectStages.mockReset().mockResolvedValue([]);
  libs.getProjectServices.mockReset().mockResolvedValue([]);
  libs.getProjectMaintenance.mockReset().mockResolvedValue([]);
  libs.getUpcomingRenewals.mockReset().mockResolvedValue([]);
  libs.getAllTickets.mockReset().mockResolvedValue([TICKET]);
  libs.getProjectRequests.mockReset().mockResolvedValue([]);
  libs.getProjectTickets.mockReset().mockResolvedValue([]);
  libs.getProjectTokens.mockReset().mockResolvedValue([]);
  libs.getOpenTicketsCount.mockReset().mockResolvedValue(1);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
  libs.listarPaginaCotizaciones.mockReset().mockResolvedValue({ cotizaciones: [], haySiguiente: false });
  libs.obtenerCotizacion.mockReset().mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe.each(PANEL_ROUTES)("%s", (path, adminQuery) => {
  it("sin sesión → /login, sin consultas", async () => {
    goTo(path);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
    expectNoAdminQueries();
  });

  it("administrador (0) → permitido: se queda en la ruta y consulta lo suyo", async () => {
    signIn(0);
    goTo(path);
    await waitFor(() => expect(libs[adminQuery]).toHaveBeenCalled(), WAIT);
    expect(window.location.pathname).toBe(path);
    expect(screen.queryByRole("heading", { name: "Landing (simulada)" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Mis solicitudes (simulada)" })).toBeNull();
  });

  it("colaborador (1) → denegado: va a / (recarga directa) y no se consulta nada", async () => {
    signIn(1);
    goTo(path);
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expectNoAdminQueries();
  });

  it("cliente (2) → denegado: va a /solicitudes y no se consulta nada", async () => {
    signIn(2);
    goTo(path);
    expect(await screen.findByRole("heading", { name: "Mis solicitudes (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/solicitudes");
    expect(screen.queryByRole("main")).toBeNull();
    expectNoAdminQueries();
  });

  it("sesión con rol desconocido (null) → cargador, ningún hijo montado y ninguna consulta; al llegar el rol 0 se muestra", async () => {
    signIn(null);
    const { rerender } = goTo(path);
    // Se da tiempo a que resuelvan las rutas perezosas: si el panel se hubiera montado, ya habría consultado.
    await settle(300);
    expect(screen.getAllByAltText("MultiStack Systems Logo").length).toBeGreaterThan(0);
    expect(screen.queryByRole("main")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(window.location.pathname).toBe(path);
    expectNoAdminQueries();

    auth.userType = 0;
    rerender(<App />);
    await waitFor(() => expect(libs[adminQuery]).toHaveBeenCalled(), WAIT);
  });

  it("sesión con rol desconocido que resuelve a colaborador (1) → termina en / sin haber consultado nada", async () => {
    signIn(null);
    const { rerender } = goTo(path);
    await settle(300);
    auth.userType = 1;
    rerender(<App />);
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expectNoAdminQueries();
  });
});

describe("navegación Back/Forward con un colaborador", () => {
  it("entrar al panel por la barra de direcciones y volver atrás/adelante nunca muestra el panel", async () => {
    signIn(1);
    goTo("/");
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();

    for (const target of ["/dashboard", "/dashboard/tickets", "/dashboard/project/p1"]) {
      act(() => {
        window.history.pushState({}, "", target);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await waitFor(() => expect(window.location.pathname).toBe("/"), WAIT);
    }

    const moves = [() => window.history.back(), () => window.history.back(), () => window.history.forward(), () => window.history.forward()];
    for (const move of moves) {
      act(() => move());
      await settle(60);
      expect(window.location.pathname.startsWith("/dashboard")).toBe(false);
      expect(screen.queryByRole("main")).toBeNull();
      expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    }
    expectNoAdminQueries();
  });
});
