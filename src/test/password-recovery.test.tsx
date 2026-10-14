import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// ── Supabase client stub (auth calls used by lib/auth) ───────────────────────
const updateUser = vi.hoisted(() => vi.fn());
const signOutOthers = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: (...a: unknown[]) => updateUser(...a), signOut: (...a: unknown[]) => signOutOthers(...a) } },
}));

// ── useAuth stub: each test sets the auth state it needs ─────────────────────
const auth = vi.hoisted(() => ({
  state: {
    session: null as null | { user: { email: string } },
    userType: null as number | null,
    loading: false,
    recoveryPending: false,
    finishRecovery: vi.fn(),
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.state }));

import {
  captureAuthRedirect, clearAuthLinkError, clearRecoveryPending, isRecoveryPending, peekAuthLinkError,
} from "@/lib/authRedirect";
import { describeAuthError, updatePassword, validateNewPassword } from "@/lib/auth";
import UpdatePassword from "@/pages/auth/UpdatePassword";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";

const authError = (code: string) => Object.assign(new Error(`raw ${code}`), { code });
const recoverySession = { user: { email: "cliente@ejemplo.com" } };

beforeEach(() => {
  sessionStorage.clear();
  updateUser.mockReset().mockResolvedValue({ data: {}, error: null });
  signOutOthers.mockReset().mockResolvedValue({ error: null });
  auth.state = { session: null, userType: null, loading: false, recoveryPending: false, finishRecovery: vi.fn() };
});
afterEach(() => sessionStorage.clear());

// ─────────────────────────────────────────────────────────────────────────────
describe("captureAuthRedirect — runs before supabase-js strips the hash", () => {
  it("flags a recovery link (implicit flow #access_token…&type=recovery)", () => {
    captureAuthRedirect({ hash: "#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=recovery", search: "" });
    expect(isRecoveryPending()).toBe(true);
    expect(peekAuthLinkError()).toBeNull();
  });

  it("ignores other auth links (sign-up confirmation, magic link) and plain anchors", () => {
    captureAuthRedirect({ hash: "#access_token=abc&type=signup", search: "" });
    captureAuthRedirect({ hash: "#access_token=abc&type=magiclink", search: "" });
    captureAuthRedirect({ hash: "#contacto", search: "" });
    captureAuthRedirect({ hash: "#type=recovery", search: "" }); // no token → not a real link
    expect(isRecoveryPending()).toBe(false);
  });

  it("records an expired / invalid link error from the hash or the query", () => {
    captureAuthRedirect({
      hash: "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      search: "",
    });
    expect(peekAuthLinkError()).toBe("otp_expired");
    clearAuthLinkError();
    captureAuthRedirect({ hash: "", search: "?error=access_denied&error_description=denied" });
    expect(peekAuthLinkError()).toBe("access_denied");
  });

  it("does not treat an unrelated ?error param as an auth link error", () => {
    captureAuthRedirect({ hash: "", search: "?error=auth_failed" });
    expect(peekAuthLinkError()).toBeNull();
  });

  it("never throws when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); }, removeItem: () => { throw new Error("x"); } };
    expect(() => captureAuthRedirect({ hash: "#access_token=a&type=recovery", search: "" }, broken)).not.toThrow();
    expect(isRecoveryPending(broken)).toBe(false);
    clearRecoveryPending(broken);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("password rules and auth errors", () => {
  it.each([
    ["short1", "short1", "Usa al menos 8 caracteres."],
    ["soloLetras", "soloLetras", "Combina letras y números."],
    ["12345678", "12345678", "Combina letras y números."],
    ["Valida123", "Valida124", "Las contraseñas no coinciden."],
    ["a1".repeat(37), "a1".repeat(37), "Usa como máximo 72 caracteres."],
  ])("rejects %s", (pw, confirm, message) => {
    expect(validateNewPassword(pw, confirm)).toBe(message);
  });

  it("accepts a valid, confirmed password (accents allowed)", () => {
    expect(validateNewPassword("Contraseña2026", "Contraseña2026")).toBeNull();
  });

  it("explains recovery-specific Supabase errors in Spanish", () => {
    expect(describeAuthError(authError("same_password"))).toBe("La nueva contraseña debe ser distinta de la actual.");
    expect(describeAuthError(authError("otp_expired"))).toMatch(/no es válido o ya expiró/);
    expect(describeAuthError(authError("session_not_found"))).toMatch(/no es válido o ya expiró/);
    expect(describeAuthError(authError("weak_password"))).toMatch(/demasiado débil/);
    expect(describeAuthError(authError("invalid_credentials"))).toBe("Correo o contraseña incorrectos.");
    expect(describeAuthError(new Error("otro"))).toBe("otro");
  });

  it("updatePassword updates the user, then signs out the other sessions", async () => {
    await updatePassword("Nueva12345");
    expect(updateUser).toHaveBeenCalledWith({ password: "Nueva12345" });
    expect(signOutOthers).toHaveBeenCalledWith({ scope: "others" });
  });

  it("updatePassword surfaces Supabase errors and does not revoke sessions on failure", async () => {
    updateUser.mockResolvedValueOnce({ data: null, error: authError("same_password") });
    await expect(updatePassword("Nueva12345")).rejects.toMatchObject({ code: "same_password" });
    expect(signOutOthers).not.toHaveBeenCalled();
  });

  it("a failing 'sign out others' does not undo a successful password change", async () => {
    signOutOthers.mockRejectedValueOnce(new Error("network"));
    await expect(updatePassword("Nueva12345")).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/auth/update-password"]}>
      <Routes>
        <Route path="/auth/update-password" element={<UpdatePassword />} />
        <Route path="/dashboard" element={<p>panel admin</p>} />
        <Route path="/solicitudes" element={<p>mis solicitudes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const fill = (pw: string, confirm = pw) => {
  fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: pw } });
  fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar nueva contraseña" }));
};

describe("UpdatePassword page", () => {
  it("without a session it only offers to request a new link", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Necesitas un enlace de recuperación" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Solicitar un nuevo enlace" })).toHaveAttribute("href", "/auth/reset-password");
    expect(screen.queryByLabelText("Nueva contraseña")).not.toBeInTheDocument();
  });

  it("an expired / invalid link shows the invalid-link state and consumes the error", () => {
    sessionStorage.setItem("ms:auth:link-error", "otp_expired");
    renderPage();
    expect(screen.getByRole("heading", { name: "Enlace no válido" })).toBeInTheDocument();
    expect(peekAuthLinkError()).toBeNull();
  });

  it("a normal signed-in session (not from a recovery link) cannot change the password here", () => {
    auth.state.session = recoverySession;
    auth.state.recoveryPending = false;
    renderPage();
    expect(screen.getByRole("heading", { name: "Necesitas un enlace de recuperación" })).toBeInTheDocument();
  });

  it("validates before calling Supabase", () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, userType: 2 };
    renderPage();
    expect(screen.getByText("cliente@ejemplo.com")).toBeInTheDocument();
    fill("corta1");
    expect(screen.getByRole("alert")).toHaveTextContent("Usa al menos 8 caracteres.");
    fill("Valida123", "Distinta123");
    expect(screen.getByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(screen.getByLabelText("Nueva contraseña")).toHaveAttribute("aria-invalid", "true");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("saves the new password, ends recovery mode and continues to the client area", async () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, userType: 2 };
    renderPage();
    fill("NuevaClave2026");
    await screen.findByRole("heading", { name: "Contraseña actualizada" });
    expect(updateUser).toHaveBeenCalledWith({ password: "NuevaClave2026" });
    expect(auth.state.finishRecovery).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("mis solicitudes")).toBeInTheDocument();
  });

  it("staff continue to the dashboard", async () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, userType: 0 };
    renderPage();
    fill("NuevaClave2026");
    fireEvent.click(await screen.findByRole("button", { name: "Continuar" }));
    expect(await screen.findByText("panel admin")).toBeInTheDocument();
  });

  it("shows Supabase's reason in Spanish (same password) and keeps the form", async () => {
    updateUser.mockResolvedValueOnce({ data: null, error: authError("same_password") });
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, userType: 2 };
    renderPage();
    fill("MismaClave123");
    expect(await screen.findByRole("alert")).toHaveTextContent("La nueva contraseña debe ser distinta de la actual.");
    expect(auth.state.finishRecovery).not.toHaveBeenCalled();
  });

  it("an expired recovery session switches to the invalid-link state", async () => {
    updateUser.mockResolvedValueOnce({ data: null, error: authError("session_not_found") });
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, userType: 2 };
    renderPage();
    fill("NuevaClave2026");
    expect(await screen.findByRole("heading", { name: "Enlace no válido" })).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}
function renderRedirect(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RecoveryRedirect />
      <Where />
    </MemoryRouter>,
  );
}

describe("RecoveryRedirect — recovery links land wherever Supabase sends them", () => {
  it("sends a recovery session to the new-password screen (e.g. from the Site URL '/')", async () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true };
    renderRedirect("/");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/auth/update-password"));
  });

  it("waits for auth to finish loading", () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, loading: true };
    renderRedirect("/");
    expect(screen.getByTestId("where")).toHaveTextContent("/");
  });

  it("sends an invalid / expired link to the same screen (it explains the problem)", async () => {
    sessionStorage.setItem("ms:auth:link-error", "otp_expired");
    renderRedirect("/login");
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/auth/update-password"));
  });

  it("does nothing for normal sessions", () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: false };
    renderRedirect("/dashboard");
    expect(screen.getByTestId("where")).toHaveTextContent("/dashboard");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Login does not hijack a recovery session", () => {
  async function renderLogin() {
    const { default: Login } = await import("@/pages/auth/Login");
    return render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<><Login /><Where /></>} />
          <Route path="/dashboard" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("stays put while a recovery is pending (RecoveryRedirect will take over)", async () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: true, userType: 0 };
    (auth.state as unknown as { user: unknown }).user = { id: "u1" };
    await renderLogin();
    expect(screen.getByTestId("where")).toHaveTextContent("/login");
  });

  it("still forwards a normal signed-in admin to the dashboard", async () => {
    auth.state = { ...auth.state, session: recoverySession, recoveryPending: false, userType: 0 };
    (auth.state as unknown as { user: unknown }).user = { id: "u1" };
    await renderLogin();
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/dashboard"));
  });
});
