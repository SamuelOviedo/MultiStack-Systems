import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Sin sesión: se ve el formulario. La lógica de autenticación no se ejerce aquí.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, recoveryPending: false }),
}));
vi.mock("@/lib/auth", () => ({
  authErrorCode: vi.fn(),
  describeAuthError: vi.fn(),
  resendSignupConfirmation: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUpWithEmail: vi.fn(),
}));
vi.mock("@/components/auth/AuthBrandPanel", () => ({ default: () => null }));
vi.mock("@/components/common/Logo", () => ({ default: () => null }));

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import { PACKAGE_INTENT_KEY, rememberPackageIntent } from "@/lib/packageIntent";

const LOGIN_NOTE = "Estás solicitando el Combo Emprendedor (L 3,950). Inicia sesión para enviar tu solicitud.";
const SIGNUP_NOTE =
  "Estás solicitando el Combo Emprendedor (L 3,950). Crea tu cuenta y confirma tu correo; después podrás enviar tu solicitud.";

const renderAt = (element: React.ReactElement) => render(<MemoryRouter>{element}</MemoryRouter>);

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Login · aviso de paquete", () => {
  it("sin intención guardada no hay aviso", () => {
    renderAt(<Login />);

    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText(/Estás solicitando/)).toBeNull();
  });

  it("con el Combo guardado avisa del paquete y su precio, sobre el formulario", () => {
    rememberPackageIntent("combo-emprendedor");
    renderAt(<Login />);

    const note = screen.getByRole("note");
    // Visible «L 3,950»; un lector oye «3950 lempiras».
    expect(note.textContent).toBe(
      "Estás solicitando el Combo Emprendedor (L 3,9503950 lempiras). Inicia sesión para enviar tu solicitud.",
    );
    expect(within(note).getByText("L 3,950")).toHaveAttribute("aria-hidden", "true");
    expect(within(note).getByText("3950 lempiras")).toHaveClass("sr-only");
    // Va antes del formulario de credenciales.
    const form = screen.getByLabelText("Email de trabajo").closest("form")!;
    expect(note.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("con el Estándar dice «el Plan Estándar (L 3,500)»", () => {
    rememberPackageIntent("estandar");
    renderAt(<Login />);

    expect(screen.getByRole("note").textContent).toContain("Estás solicitando el Plan Estándar (L 3,5003500 lempiras).");
  });

  it("no borra la intención: la usa Mis solicitudes después de iniciar sesión", () => {
    rememberPackageIntent("combo-emprendedor");
    renderAt(<Login />);

    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).not.toBeNull();
  });

  it("una intención caducada no avisa", () => {
    window.localStorage.setItem(PACKAGE_INTENT_KEY, JSON.stringify({ id: "combo-emprendedor", exp: Date.now() - 1000 }));
    renderAt(<Login />);

    expect(screen.queryByRole("note")).toBeNull();
  });
});

describe("Signup · aviso de paquete", () => {
  it("sin intención guardada no hay aviso", () => {
    renderAt(<Signup />);

    expect(screen.getByRole("heading", { name: "Crear cuenta" })).toBeInTheDocument();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("con el Combo guardado avisa y pide confirmar el correo", () => {
    rememberPackageIntent("combo-emprendedor");
    renderAt(<Signup />);

    const note = screen.getByRole("note");
    expect(note.textContent).toBe(
      "Estás solicitando el Combo Emprendedor (L 3,9503950 lempiras). Crea tu cuenta y confirma tu correo; después podrás enviar tu solicitud.",
    );
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).not.toBeNull();
  });

  it("los textos visibles coinciden con lo aprobado", () => {
    rememberPackageIntent("combo-emprendedor");
    renderAt(<Signup />);

    const note = screen.getByRole("note").cloneNode(true) as HTMLElement;
    note.querySelectorAll(".sr-only").forEach((el) => el.remove());
    expect(note.textContent).toBe(SIGNUP_NOTE);
    cleanup();

    renderAt(<Login />);
    const loginNote = screen.getByRole("note").cloneNode(true) as HTMLElement;
    loginNote.querySelectorAll(".sr-only").forEach((el) => el.remove());
    expect(loginNote.textContent).toBe(LOGIN_NOTE);
  });
});
