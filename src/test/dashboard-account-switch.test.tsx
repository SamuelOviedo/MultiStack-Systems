// El panel con el AuthProvider REAL (solo se simula el cliente de Supabase y las funciones de `src/lib`): acceso directo
// por rol y cambio de cuenta en la misma pestaña. El rol anterior no puede abrir el panel a la cuenta nueva mientras su
// rol se resuelve, ni al volver con Atrás/Adelante. Solo interfaz: la API se protege con RLS.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 15000 };
vi.setConfig({ testTimeout: 30000 });

type Listener = (event: string, session: unknown) => void;

const h = vi.hoisted(() => ({
  listener: undefined as ((event: string, session: unknown) => void) | undefined,
  initialSession: null as unknown,
  /** Rol que responde `profiles` por usuario; si el usuario está en `manual`, la respuesta queda pendiente. */
  roles: {} as Record<string, number>,
  manual: new Set<string>(),
  calls: [] as { userId: string; resolve: (role: number) => void; reject: (error: Error) => void }[],
  fromOther: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: h.initialSession } }),
      onAuthStateChange: (cb: Listener) => {
        h.listener = cb;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      signOut: () => Promise.resolve(),
    },
    functions: { invoke: () => Promise.resolve({}) },
    from: (table: string) => {
      if (table !== "profiles") {
        h.fromOther(table);
        throw new Error(`supabase.from(${table}) no está simulado: cada consulta debe pasar por un mock de src/lib`);
      }
      return {
        select: () => ({
          eq: (_column: string, userId: string) => ({
            single: () =>
              h.manual.has(userId)
                ? new Promise((resolve, reject) => {
                    h.calls.push({ userId, resolve: (role) => resolve({ data: { user_type: role } }), reject });
                  })
                : Promise.resolve({ data: { user_type: h.roles[userId] } }),
          }),
        }),
      };
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

vi.mock("@/pages/client/MisSolicitudes.tsx", () => ({ default: () => <h1>Mis solicitudes (simulada)</h1> }));
vi.mock("@/pages/auth/Login.tsx", () => ({ default: () => <h1>Login (simulado)</h1> }));
vi.mock("@/pages/marketing/Index.tsx", () => ({ default: () => <h1>Landing (simulada)</h1> }));

import App from "@/App";

const NOW = "2026-11-02T15:00:00.000Z";
const sessionOf = (id: string) => ({ access_token: `t-${id}`, user: { id, email: `${id}@example.test`, email_confirmed_at: NOW } });
const USERS = { 0: sessionOf("u-admin"), 1: sessionOf("u-colab"), 2: sessionOf("u-client") } as const;
type Role = keyof typeof USERS;
const HOME: Record<Role, { path: string; heading: string }> = {
  0: { path: "/dashboard", heading: "" },
  1: { path: "/", heading: "Landing (simulada)" },
  2: { path: "/solicitudes", heading: "Mis solicitudes (simulada)" },
};

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
const PANEL_PATHS = ["/dashboard", "/dashboard/tickets"] as const;

const settle = (ms: number) => act(async () => { await new Promise((resolve) => setTimeout(resolve, ms)); });
const pathname = () => window.location.pathname;
const callsFor = (userId: string) => h.calls.filter((c) => c.userId === userId);

/** ¿Hay algo del panel en pantalla? Barra lateral / contenido del shell, o el título de la pantalla de tickets. */
const panelVisible = () =>
  document.querySelector("#admin-sidebar") !== null ||
  document.querySelector("#contenido") !== null ||
  Array.from(document.querySelectorAll("h1")).some((el) => el.textContent?.trim() === "$ tickets");
const loaderVisible = () => screen.queryAllByAltText("MultiStack Systems Logo").length > 0;

function expectNoAdminQueries() {
  for (const [name, fn] of Object.entries(libs)) expect(fn, name).not.toHaveBeenCalled();
  expect(h.fromOther).not.toHaveBeenCalled();
}
function clearAdminQueries() {
  for (const fn of Object.values(libs)) fn.mockClear();
  h.fromOther.mockClear();
}

function open(path: string, role: Role | null) {
  h.initialSession = role === null ? null : USERS[role];
  window.history.pushState({}, "", path);
  return render(<App />);
}
const emitSync = (event: string, session: unknown) => act(() => h.listener?.(event, session));
const pushPath = (path: string) =>
  act(() => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  });

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
  h.listener = undefined;
  h.initialSession = null;
  h.roles = { "u-admin": 0, "u-colab": 1, "u-client": 2 };
  h.manual.clear();
  h.calls.length = 0;
  h.fromOther.mockReset();
  window.localStorage.clear();
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
});

afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe.each(PANEL_PATHS)("acceso directo a %s con el AuthProvider real", (path) => {
  it("sin sesión → /login, sin consultas", async () => {
    open(path, null);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    expect(pathname()).toBe("/login");
    expectNoAdminQueries();
  });

  it("administrador (0): el panel se muestra", async () => {
    open(path, 0);
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    expect(pathname()).toBe(path);
  });

  it.each([1, 2] as const)("rol %i: termina en su destino, nunca ve el panel y no consulta nada", async (role) => {
    open(path, role);
    expect(await screen.findByRole("heading", { name: HOME[role].heading }, WAIT)).toBeInTheDocument();
    expect(pathname()).toBe(HOME[role].path);
    expect(panelVisible()).toBe(false);
    expectNoAdminQueries();
  });

  it("sesión guardada con el perfil aún sin responder: solo el cargador y ninguna consulta; al llegar el rol 1, a /", async () => {
    h.manual.add("u-colab");
    open(path, 1);
    await waitFor(() => expect(callsFor("u-colab")).toHaveLength(1));
    await settle(100);
    expect(loaderVisible()).toBe(true);
    expect(panelVisible()).toBe(false);
    expect(pathname()).toBe(path);
    expectNoAdminQueries();
    await act(async () => callsFor("u-colab")[0].resolve(1));
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expectNoAdminQueries();
  });
});

describe.each(PANEL_PATHS)("cambio de cuenta en la misma pestaña estando en %s", (path) => {
  it.each([1, 2] as const)("admin → rol %i: solo el cargador mientras se resuelve, ninguna consulta y luego su destino", async (next) => {
    open(path, 0);
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    await settle(50);
    clearAdminQueries();

    const nextUserId = USERS[next].user.id;
    h.manual.add(nextUserId);
    emitSync("SIGNED_IN", USERS[next]);

    // Inmediatamente: el panel del administrador se desmonta y queda el cargador de marca.
    expect(panelVisible()).toBe(false);
    expect(loaderVisible()).toBe(true);
    await waitFor(() => expect(callsFor(nextUserId)).toHaveLength(1));
    await settle(150);
    expect(panelVisible()).toBe(false);
    expect(loaderVisible()).toBe(true);
    expect(pathname()).toBe(path);
    expectNoAdminQueries();

    await act(async () => callsFor(nextUserId)[0].resolve(next));
    expect(await screen.findByRole("heading", { name: HOME[next].heading }, WAIT)).toBeInTheDocument();
    expect(pathname()).toBe(HOME[next].path);
    expect(panelVisible()).toBe(false);
    expectNoAdminQueries();
  });

  it("admin → colaborador con el perfil que falla: rol 2, va a /solicitudes y nunca ve el panel", async () => {
    open(path, 0);
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    await settle(50);
    clearAdminQueries();

    h.manual.add("u-colab");
    emitSync("SIGNED_IN", USERS[1]);
    await waitFor(() => expect(callsFor("u-colab")).toHaveLength(1));
    // La consulta del perfil falla: el hook cae a 2, jamás conserva el 0 de la cuenta anterior.
    await act(async () => callsFor("u-colab")[0].reject(new Error("RLS / red")));
    expect(await screen.findByRole("heading", { name: "Mis solicitudes (simulada)" }, WAIT)).toBeInTheDocument();
    expect(panelVisible()).toBe(false);
    expectNoAdminQueries();
  });

  it("una respuesta tardía del administrador anterior no le abre el panel a la cuenta nueva", async () => {
    h.manual.add("u-admin");
    open(path, 0);
    await waitFor(() => expect(callsFor("u-admin")).toHaveLength(1)); // el perfil del admin sigue sin llegar

    h.manual.add("u-colab");
    emitSync("SIGNED_IN", USERS[1]);
    await waitFor(() => expect(callsFor("u-colab")).toHaveLength(1));

    await act(async () => callsFor("u-admin").forEach((c) => c.resolve(0))); // llega tarde
    await settle(100);
    expect(panelVisible()).toBe(false);
    expectNoAdminQueries();

    await act(async () => callsFor("u-colab")[0].resolve(1));
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expectNoAdminQueries();
  });

  it("TOKEN_REFRESHED del administrador no desmonta el panel (sin parpadeo)", async () => {
    open(path, 0);
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    emitSync("TOKEN_REFRESHED", { ...USERS[0], access_token: "renovado" });
    expect(panelVisible()).toBe(true);
    await settle(100);
    expect(panelVisible()).toBe(true);
    expect(pathname()).toBe(path);
  });

  it("SIGNED_OUT desmonta el panel y manda a /login", async () => {
    open(path, 0);
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    emitSync("SIGNED_OUT", null);
    expect(await screen.findByRole("heading", { name: "Login (simulado)" }, WAIT)).toBeInTheDocument();
    expect(panelVisible()).toBe(false);
  });
});

describe("Atrás/Adelante tras cambiar de cuenta", () => {
  it("el nuevo colaborador no vuelve a ver el panel con Atrás ni con Adelante", async () => {
    open("/", 0);
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    await pushPath("/dashboard");
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    await pushPath("/dashboard/tickets");
    await waitFor(() => expect(panelVisible()).toBe(true), WAIT);
    await settle(50);
    clearAdminQueries();

    h.manual.add("u-colab");
    emitSync("SIGNED_IN", USERS[1]);
    await waitFor(() => expect(callsFor("u-colab")).toHaveLength(1));
    await act(async () => callsFor("u-colab")[0].resolve(1));
    expect(await screen.findByRole("heading", { name: "Landing (simulada)" }, WAIT)).toBeInTheDocument();
    expect(pathname()).toBe("/");

    for (const move of [() => window.history.back(), () => window.history.back(), () => window.history.forward(), () => window.history.forward()]) {
      act(() => move());
      await settle(80);
      expect(pathname().startsWith("/dashboard")).toBe(false);
      expect(panelVisible()).toBe(false);
    }
    expectNoAdminQueries();
  });
});
