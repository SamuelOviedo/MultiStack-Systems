// Destino por rol (src/lib/roleRoutes.ts) y las tres pantallas que lo usan tras autenticar: Login, AuthCallback y
// UpdatePassword. Regla: 0 → /dashboard, 2 → /solicitudes, 1 → / (su zona de trabajo aún no existe). Solo interfaz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import appSource from "@/App.tsx?raw";

const updateUser = vi.hoisted(() => vi.fn());
const signOutOthers = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: (...a: unknown[]) => updateUser(...a), signOut: (...a: unknown[]) => signOutOthers(...a) } },
}));

const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  exchangeAuthCodeForSession: exchange,
}));

const auth = vi.hoisted(() => ({
  state: {
    session: null as null | { user: { email: string } },
    user: null as null | { id: string },
    userType: null as number | null,
    loading: false,
    recoveryPending: false,
    finishRecovery: vi.fn(),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.state }));

import { canAccessPath, isInternalPath, postLoginTarget, roleHome } from "@/lib/roleRoutes";
import Login from "@/pages/auth/Login";
import AuthCallback from "@/pages/auth/AuthCallback";
import UpdatePassword from "@/pages/auth/UpdatePassword";

const Where = () => {
  const l = useLocation();
  return <p data-testid="where">{l.pathname}</p>;
};
const DESTINATIONS = (
  <>
    <Route path="/dashboard" element={<Where />} />
    <Route path="/dashboard/tickets" element={<Where />} />
    <Route path="/solicitudes" element={<Where />} />
    <Route path="/paginas-web" element={<Where />} />
    <Route path="/" element={<Where />} />
  </>
);
const where = () => screen.getByTestId("where").textContent;

function signIn(userType: number | null) {
  auth.state = {
    ...auth.state,
    session: { user: { email: "persona@example.test" } },
    user: { id: "u1" },
    userType,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  signOutOthers.mockReset().mockResolvedValue({ error: null });
  exchange.mockReset().mockResolvedValue(undefined);
  auth.state = { session: null, user: null, userType: null, loading: false, recoveryPending: false, finishRecovery: vi.fn() };
});
afterEach(() => {
  cleanup();
  window.history.pushState({}, "", "/");
});

describe("roleHome", () => {
  it.each([
    [0, "/dashboard"],
    [1, "/"],
    [2, "/solicitudes"],
  ])("rol %i → %s", (role, home) => {
    expect(roleHome(role)).toBe(home);
  });

  it("rol sin resolver → /solicitudes (como antes); un valor desconocido → / (nunca /solicitudes: sería un bucle con su guard [2])", () => {
    expect(roleHome(null)).toBe("/solicitudes");
    expect(roleHome(7)).toBe("/");
  });
});

describe("canAccessPath", () => {
  const PANEL = ["/dashboard", "/dashboard/", "/dashboard/proyectos", "/dashboard/project/abc", "/dashboard/tickets?x=1#y", "/Dashboard/Tickets", "/dashboard/../dashboard/tickets", "/%64ashboard", "/dashboard%2ftickets"];

  it.each(PANEL)("el panel (%s) es solo del administrador", (path) => {
    expect(canAccessPath(0, path)).toBe(true);
    expect(canAccessPath(1, path)).toBe(false);
    expect(canAccessPath(2, path)).toBe(false);
    expect(canAccessPath(null, path)).toBe(false);
  });

  it("/solicitudes es solo del cliente", () => {
    expect(canAccessPath(2, "/solicitudes")).toBe(true);
    for (const role of [0, 1, null]) expect(canAccessPath(role, "/solicitudes")).toBe(false);
  });

  it("las rutas públicas y los prefijos parecidos no están restringidos", () => {
    for (const p of ["/", "/paginas-web", "/dashboardx", "/dashboards/ok", "/client/abc", "/politica-de-privacidad"]) {
      for (const role of [0, 1, 2]) expect(canAccessPath(role, p), `${role} ${p}`).toBe(true);
    }
  });

  it("coincide con los allowedTypes declarados en App.tsx", () => {
    const declared = [...appSource.matchAll(/path="([^"]+)"\s+element=\{\s*<ProtectedRoute allowedTypes=\{\[([\d, ]+)\]\}/g)].map(
      (m) => [m[1], m[2].split(",").map((n) => Number(n.trim()))] as const,
    );
    // Por el módulo de Cotizaciones: se suman exactamente sus 3 rutas (lista, catálogo y detalle), todas solo del administrador.
    expect(declared.map(([p]) => p).sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/cotizaciones/:id",
      "/dashboard/cotizaciones/catalogo",
      "/dashboard/project/:id",
      "/dashboard/proyectos",
      "/dashboard/tickets",
      "/solicitudes",
    ]);
    for (const [path, roles] of declared) {
      const concrete = path.replace(":id", "abc");
      for (const role of [0, 1, 2]) expect(canAccessPath(role, concrete), `${role} ${path}`).toBe(roles.includes(role));
    }
  });
});

describe("isInternalPath y postLoginTarget", () => {
  it("rechaza lo que no es una ruta interna", () => {
    for (const bad of [null, undefined, "", "dashboard", "https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"]) {
      expect(isInternalPath(bad), String(bad)).toBe(false);
    }
    expect(isInternalPath("/paginas-web")).toBe(true);
  });

  it("administrador: honra una ruta interna accesible; ignora una que no puede abrir", () => {
    expect(postLoginTarget(0, "/dashboard/tickets")).toBe("/dashboard/tickets");
    expect(postLoginTarget(0, "/paginas-web")).toBe("/paginas-web");
    expect(postLoginTarget(0, "/solicitudes")).toBe("/dashboard");
    expect(postLoginTarget(0, "https://evil.example")).toBe("/dashboard");
    expect(postLoginTarget(0, null)).toBe("/dashboard");
  });

  it("colaborador: nunca acaba en el panel aunque lo pida; el resto de rutas internas sí", () => {
    expect(postLoginTarget(1, "/dashboard")).toBe("/");
    expect(postLoginTarget(1, "/dashboard/tickets")).toBe("/");
    expect(postLoginTarget(1, "/Dashboard/project/abc")).toBe("/");
    expect(postLoginTarget(1, "/solicitudes")).toBe("/");
    expect(postLoginTarget(1, "/paginas-web")).toBe("/paginas-web");
    expect(postLoginTarget(1, null)).toBe("/");
  });

  it("cliente: el parámetro no se honra (como antes) y va a /solicitudes", () => {
    expect(postLoginTarget(2, "/dashboard/tickets")).toBe("/solicitudes");
    expect(postLoginTarget(2, "/paginas-web")).toBe("/solicitudes");
    expect(postLoginTarget(2, null)).toBe("/solicitudes");
  });
});

describe("Login: destino tras autenticar", () => {
  function renderLogin(search = "") {
    return render(
      <MemoryRouter initialEntries={[`/login${search}`]}>
        <Routes>
          <Route path="/login" element={<><Login /><Where /></>} />
          {DESTINATIONS}
        </Routes>
      </MemoryRouter>,
    );
  }

  it.each([
    [0, "/dashboard"],
    [1, "/"],
    [2, "/solicitudes"],
  ])("rol %i sin ?redirect → %s", async (role, expected) => {
    signIn(role);
    renderLogin();
    await waitFor(() => expect(where()).toBe(expected));
  });

  it("administrador con ?redirect=/dashboard/tickets → /dashboard/tickets", async () => {
    signIn(0);
    renderLogin("?redirect=/dashboard/tickets");
    await waitFor(() => expect(where()).toBe("/dashboard/tickets"));
  });

  it.each([
    [1, "/dashboard/tickets", "/"],
    [1, "/dashboard", "/"],
    [2, "/dashboard/tickets", "/solicitudes"],
    [2, "/dashboard", "/solicitudes"],
  ])("rol %i con ?redirect=%s NO llega al panel → %s", async (role, redirect, expected) => {
    signIn(role);
    renderLogin(`?redirect=${redirect}`);
    await waitFor(() => expect(where()).toBe(expected));
    expect(screen.queryByText("/dashboard/tickets")).toBeNull();
  });

  it("colaborador con ?redirect a una ruta pública sí la conserva; un redirect externo se ignora", async () => {
    signIn(1);
    renderLogin("?redirect=/paginas-web");
    await waitFor(() => expect(where()).toBe("/paginas-web"));
    cleanup();
    signIn(1);
    renderLogin(`?redirect=${encodeURIComponent("//evil.example")}`);
    await waitFor(() => expect(where()).toBe("/"));
  });

  it("espera al rol (userType null) y a la recuperación de contraseña antes de redirigir", async () => {
    signIn(null);
    renderLogin("?redirect=/dashboard");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(where()).toBe("/login");

    cleanup();
    signIn(0);
    auth.state.recoveryPending = true;
    renderLogin();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(where()).toBe("/login");
  });

  it("limpia la intención de servicio guardada al redirigir", async () => {
    sessionStorage.setItem("postLoginIntent", "techon");
    signIn(1);
    renderLogin();
    await waitFor(() => expect(where()).toBe("/"));
    expect(sessionStorage.getItem("postLoginIntent")).toBeNull();
  });
});

describe("AuthCallback: destino tras el intercambio del código", () => {
  function renderCallback() {
    window.history.pushState({}, "", "/auth/callback?code=abc");
    return render(
      <MemoryRouter initialEntries={["/auth/callback?code=abc"]}>
        <Routes>
          <Route path="/auth/callback" element={<><AuthCallback /><Where /></>} />
          {DESTINATIONS}
        </Routes>
      </MemoryRouter>,
    );
  }

  it.each([
    [0, "/dashboard"],
    [1, "/"],
    [2, "/solicitudes"],
  ])("rol %i → %s", async (role, expected) => {
    signIn(role);
    renderCallback();
    await waitFor(() => expect(where()).toBe(expected));
    expect(exchange).toHaveBeenCalledWith("abc");
  });

  it("con el rol sin resolver no redirige", async () => {
    signIn(null);
    renderCallback();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(where()).toBe("/auth/callback");
  });
});

describe("UpdatePassword: «Continuar» tras cambiar la contraseña", () => {
  async function finish(role: number) {
    signIn(role);
    auth.state.recoveryPending = true;
    render(
      <MemoryRouter initialEntries={["/auth/update-password"]}>
        <Routes>
          <Route path="/auth/update-password" element={<UpdatePassword />} />
          {DESTINATIONS}
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "NuevaClave2026" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "NuevaClave2026" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar nueva contraseña" }));
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
  }

  it.each([
    [0, "/dashboard"],
    [1, "/"],
    [2, "/solicitudes"],
  ])("rol %i → %s", async (role, expected) => {
    await finish(role);
    await waitFor(() => expect(where()).toBe(expected));
    expect(updateUser).toHaveBeenCalledTimes(1);
  });
});
