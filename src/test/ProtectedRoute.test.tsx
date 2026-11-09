import { describe, it, expect, vi, beforeEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import ProtectedRoute from "@/components/common/ProtectedRoute";
import protectedRouteSource from "@/components/common/ProtectedRoute.tsx?raw";
import { useAuth } from "@/hooks/useAuth";

const mockUseAuth = vi.mocked(useAuth);
const mockSignOut = vi.fn();

// Minimal session objects — only the fields ProtectedRoute actually reads
const confirmedSession = {
  user: {
    id: "user-1",
    email: "admin@example.com",
    email_confirmed_at: "2024-01-01T00:00:00Z",
  },
} as unknown as Session;

const unconfirmedSession = {
  user: {
    id: "user-2",
    email: "pending@example.com",
    email_confirmed_at: null,
  },
} as unknown as Session;

function renderProtected(allowedTypes: number[]) {
  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute allowedTypes={allowedTypes}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/solicitudes" element={<div>Solicitudes Page</div>} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        <Route path="/" element={<div>Landing Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockSignOut.mockReset();
});

describe("ProtectedRoute — loading state", () => {
  it("renders spinner and does not show children while loading", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      userType: null,
      loading: true,
      recoveryPending: false,
      finishRecovery: vi.fn(),
      signOut: mockSignOut,
    });

    renderProtected([0]);

    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.queryByText("Login Page")).toBeNull();
  });
});

describe("ProtectedRoute — no session", () => {
  it("redirects to /login when there is no session", () => {
    mockUseAuth.mockReturnValue({
      session: null,
      user: null,
      userType: null,
      loading: false,
      recoveryPending: false,
      finishRecovery: vi.fn(),
      signOut: mockSignOut,
    });

    renderProtected([0]);

    expect(screen.getByText("Login Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});

describe("ProtectedRoute — email not confirmed", () => {
  it("shows email warning when session exists but email is not confirmed", () => {
    mockUseAuth.mockReturnValue({
      session: unconfirmedSession,
      user: unconfirmedSession.user as any,
      userType: 2,
      loading: false,
      recoveryPending: false,
      finishRecovery: vi.fn(),
      signOut: mockSignOut,
    });

    renderProtected([0]);

    expect(screen.getByText(/EMAIL_NOT_CONFIRMED/)).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});

function signedIn(userType: number | null, session: Session = confirmedSession) {
  mockUseAuth.mockReturnValue({
    session,
    user: session.user,
    userType,
    loading: false,
    recoveryPending: false,
    finishRecovery: vi.fn(),
    signOut: mockSignOut,
  });
}

describe("ProtectedRoute — authorized access", () => {
  it("renders children when userType is in allowedTypes", () => {
    signedIn(0);
    renderProtected([0, 1]);
    expect(screen.getByText("Protected Content")).toBeDefined();
  });

  it("does NOT render children for staff (userType 1) when the route is administrator-only", () => {
    // Antes del cambio el valor por defecto era [0, 1] y el colaborador entraba; ahora cada ruta declara quién entra.
    signedIn(1);
    renderProtected([0]);
    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.getByText("Landing Page")).toBeDefined();
  });
});

describe("ProtectedRoute — redirect logic for unauthorized userType", () => {
  it("redirects userType 2 to /solicitudes when allowedTypes is [0]", () => {
    signedIn(2);
    renderProtected([0]);
    expect(screen.getByText("Solicitudes Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects userType 1 to / (its work area does not exist yet) when allowedTypes is [0]", () => {
    signedIn(1);
    renderProtected([0]);
    expect(screen.getByText("Landing Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects the administrator to the panel when the route is client-only ([2])", () => {
    signedIn(0);
    renderProtected([2]);
    expect(screen.getByText("Dashboard Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects staff (userType 1) to / when the route is client-only ([2])", () => {
    signedIn(1);
    renderProtected([2]);
    expect(screen.getByText("Landing Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});

describe("ProtectedRoute — session with an unknown role (userType null)", () => {
  it.each([[[0]], [[2]], [[0, 1, 2]]])("shows the loader and mounts nothing of the route (allowedTypes %j)", (types) => {
    signedIn(null);
    renderProtected(types);

    expect(screen.getAllByAltText("MultiStack Systems Logo").length).toBeGreaterThan(0);
    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.queryByText("Login Page")).toBeNull();
    expect(screen.queryByText("Landing Page")).toBeNull();
    expect(screen.queryByText("Solicitudes Page")).toBeNull();
  });

  it("does not run the children's effects (no query) while the role is unknown, and mounts them once it is known", () => {
    const query = vi.fn();
    const Probe = () => {
      useEffect(() => {
        query();
      }, []);
      return <div>Probe Content</div>;
    };
    const tree = () => (
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute allowedTypes={[0]}><Probe /></ProtectedRoute>} />
          <Route path="/" element={<div>Landing Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    signedIn(null);
    const { rerender } = render(tree());
    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByText("Probe Content")).toBeNull();

    // El rol llega y es un colaborador: sigue sin montarse nada.
    signedIn(1);
    rerender(tree());
    expect(query).not.toHaveBeenCalled();
    expect(screen.getByText("Landing Page")).toBeDefined();
  });

  it("mounts the children only when the role resolves to an authorized one", () => {
    const query = vi.fn();
    const Probe = () => {
      useEffect(() => {
        query();
      }, []);
      return <div>Probe Content</div>;
    };
    const tree = () => (
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/protected" element={<ProtectedRoute allowedTypes={[0]}><Probe /></ProtectedRoute>} />
        </Routes>
      </MemoryRouter>
    );

    signedIn(null);
    const { rerender } = render(tree());
    expect(query).not.toHaveBeenCalled();

    signedIn(0);
    rerender(tree());
    expect(screen.getByText("Probe Content")).toBeDefined();
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("still sends an anonymous visitor to /login and still shows the e-mail notice before the role matters", () => {
    mockUseAuth.mockReturnValue({
      session: null, user: null, userType: null, loading: false, recoveryPending: false, finishRecovery: vi.fn(), signOut: mockSignOut,
    });
    renderProtected([0]);
    expect(screen.getByText("Login Page")).toBeDefined();

    cleanup();
    signedIn(null, unconfirmedSession);
    renderProtected([0]);
    expect(screen.getByText(/EMAIL_NOT_CONFIRMED/)).toBeDefined();
  });
});

describe("ProtectedRoute — every role against an administrator-only route", () => {
  it.each([
    [0, "Protected Content"],
    [1, "Landing Page"],
    [2, "Solicitudes Page"],
  ])("userType %i ends up on %s", (role, shown) => {
    signedIn(role);
    renderProtected([0]);
    expect(screen.getByText(shown)).toBeDefined();
    if (role !== 0) expect(screen.queryByText("Protected Content")).toBeNull();
  });
});

describe("ProtectedRoute — allowedTypes has no default", () => {
  it("is a required prop with no default value (a new route cannot inherit access by omission)", () => {
    expect(protectedRouteSource).not.toMatch(/allowedTypes\s*=\s*\[/);
    expect(protectedRouteSource).toMatch(/allowedTypes:\s*readonly number\[\]/);
    expect(protectedRouteSource).not.toMatch(/allowedTypes\?:/);
  });
});
