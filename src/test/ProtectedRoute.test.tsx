import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

import ProtectedRoute from "@/components/ProtectedRoute";
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

function renderProtected(allowedTypes?: number[]) {
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
      signOut: mockSignOut,
    });

    renderProtected();

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
      signOut: mockSignOut,
    });

    renderProtected();

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
      signOut: mockSignOut,
    });

    renderProtected();

    expect(screen.getByText(/EMAIL_NOT_CONFIRMED/)).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});

describe("ProtectedRoute — authorized access", () => {
  it("renders children when userType is in allowedTypes", () => {
    mockUseAuth.mockReturnValue({
      session: confirmedSession,
      user: confirmedSession.user as any,
      userType: 0,
      loading: false,
      signOut: mockSignOut,
    });

    renderProtected([0, 1]);

    expect(screen.getByText("Protected Content")).toBeDefined();
  });

  it("renders children for staff (userType 1) on default allowedTypes [0,1]", () => {
    mockUseAuth.mockReturnValue({
      session: confirmedSession,
      user: confirmedSession.user as any,
      userType: 1,
      loading: false,
      signOut: mockSignOut,
    });

    renderProtected();

    expect(screen.getByText("Protected Content")).toBeDefined();
  });
});

describe("ProtectedRoute — redirect logic for unauthorized userType", () => {
  it("redirects userType 2 to /solicitudes when allowedTypes is [0,1]", () => {
    mockUseAuth.mockReturnValue({
      session: confirmedSession,
      user: confirmedSession.user as any,
      userType: 2,
      loading: false,
      signOut: mockSignOut,
    });

    renderProtected([0, 1]);

    expect(screen.getByText("Solicitudes Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("redirects userType 0 to / when allowedTypes is [2]", () => {
    mockUseAuth.mockReturnValue({
      session: confirmedSession,
      user: confirmedSession.user as any,
      userType: 0,
      loading: false,
      signOut: mockSignOut,
    });

    renderProtected([2]);

    expect(screen.getByText("Landing Page")).toBeDefined();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });
});
