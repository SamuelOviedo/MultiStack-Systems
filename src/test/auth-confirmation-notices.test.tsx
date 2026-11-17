import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

// ── Supabase: solo las llamadas de auth que usa lib/auth (lib/auth es el real) ──────────────────────────────────
const supabaseAuth = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  signInWithPassword: vi.fn(),
  signInWithOAuth: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: supabaseAuth } }));

// ── useAuth: cada prueba pone el estado que necesita ───────────────────────────────────────────────────────────
const auth = vi.hoisted(() => ({
  state: {
    session: null as null | { user: { id: string } },
    user: null as null | { id: string },
    userType: null as number | null,
    loading: false,
    recoveryPending: false,
  },
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.state }));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/components/auth/AuthBrandPanel", () => ({ default: () => null }));
vi.mock("@/components/common/Logo", () => ({ default: () => null }));

import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";
import { INVALID_LINK_CODES } from "@/lib/auth";
import {
  captureAuthRedirect, isRecoveryPending, peekAuthLinkError, peekConfirmationLinkError, SIGNUP_CONFIRMATION_PATH,
} from "@/lib/authRedirect";
import { PACKAGE_INTENT_KEY, rememberPackageIntent } from "@/lib/packageIntent";
import { getAuthEmailRedirectUrl, getSiteOrigin } from "@/lib/siteUrl";

const CONFIRMATION_NOTICE =
  "El enlace caducó o ya se usó. Inicia sesión: si tu correo aún no está confirmado, podrás pedir un enlace nuevo.";
const AUTH_FAILED_NOTICE = "No pudimos completar el inicio de sesión. Inténtalo de nuevo.";

/** Lo que Supabase añade a la URL de retorno cuando el enlace caducó o ya se usó (la descripción es de prueba). */
const DESCRIPTION = "Email link is invalid or has expired DESCRIPCION-CRUDA";
const EXPIRED_HASH = `#error=access_denied&error_code=otp_expired&error_description=${encodeURIComponent(DESCRIPTION)}`;

const authError = (code: string) => Object.assign(new Error(`raw ${code}`), { code });

/** Un enlace de confirmación rechazado aterriza en /solicitudes (con o sin ?paquete=). */
const landOnExpiredConfirmation = (search = "") =>
  captureAuthRedirect({ pathname: "/solicitudes", search, hash: EXPIRED_HASH });

/** Contenido de un almacenamiento como lista «clave=valor». */
const dump = (storage: Storage): string[] =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index) ?? "").map(
    (key) => `${key}=${storage.getItem(key)}`,
  );

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

const renderLogin = (entry = "/login") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<><Login /><Where /></>} />
        <Route path="/solicitudes" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const renderSignup = () =>
  render(
    <MemoryRouter initialEntries={["/signup"]}>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const renderGuard = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <RecoveryRedirect />
      <Where />
    </MemoryRouter>,
  );

const typeCredentials = () => {
  fireEvent.change(screen.getByLabelText("Email de trabajo"), { target: { value: "persona@ejemplo.test" } });
  fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "Clave12345" } });
};

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  toast.mockReset();
  supabaseAuth.signUp.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseAuth.resend.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseAuth.signInWithPassword.mockReset().mockResolvedValue({ data: {}, error: null });
  supabaseAuth.signInWithOAuth.mockReset().mockResolvedValue({ data: {}, error: null });
  auth.state = { session: null, user: null, userType: null, loading: false, recoveryPending: false };
});
afterEach(() => {
  cleanup();
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("captureAuthRedirect · un enlace de confirmación rechazado no es una recuperación", () => {
  it.each(["/solicitudes", "/solicitudes/"])("en %s guarda el código aparte del de recuperación", (pathname) => {
    captureAuthRedirect({ pathname, search: "?paquete=combo-emprendedor", hash: EXPIRED_HASH });

    expect(peekConfirmationLinkError()).toBe("otp_expired");
    expect(peekAuthLinkError()).toBeNull();
    expect(isRecoveryPending()).toBe(false);
  });

  it.each(["/auth/callback", "/", "/login", "/solicitudes/otra", undefined])(
    "en %s sigue siendo un enlace de recuperación (el flujo de contraseña no cambia)",
    (pathname) => {
      captureAuthRedirect({ pathname, search: "", hash: EXPIRED_HASH });

      expect(peekAuthLinkError()).toBe("otp_expired");
      expect(peekConfirmationLinkError()).toBeNull();
    },
  );

  it("solo guarda el código: ni la descripción ni nada más del hash", () => {
    landOnExpiredConfirmation("?paquete=combo-emprendedor");

    expect(dump(sessionStorage)).toEqual(["ms:auth:confirmation-link-error=otp_expired"]);
  });

  it("un enlace de confirmación válido (#access_token…&type=signup) no deja ningún marcador", () => {
    captureAuthRedirect({
      pathname: "/solicitudes",
      search: "?paquete=combo-emprendedor",
      hash: "#access_token=abc&expires_in=3600&refresh_token=r&token_type=bearer&type=signup",
    });

    expect(sessionStorage.length).toBe(0);
  });

  it("la ruta del enlace de confirmación (con y sin paquete) es la que captureAuthRedirect reconoce", () => {
    expect(new URL(getAuthEmailRedirectUrl()).pathname).toBe(SIGNUP_CONFIRMATION_PATH);
    expect(new URL(getAuthEmailRedirectUrl("combo-emprendedor")).pathname).toBe(SIGNUP_CONFIRMATION_PATH);
  });

  it("no lanza si el almacenamiento falla", () => {
    const broken = {
      getItem: () => { throw new Error("x"); },
      setItem: () => { throw new Error("x"); },
      removeItem: () => { throw new Error("x"); },
    };
    expect(() => captureAuthRedirect({ pathname: "/solicitudes", search: "", hash: EXPIRED_HASH }, broken)).not.toThrow();
    expect(peekConfirmationLinkError(broken)).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("RecoveryRedirect · el enlace de confirmación rechazado no va a la pantalla de nueva contraseña", () => {
  it("con el marcador de confirmación se queda donde está (lo explica /login)", () => {
    landOnExpiredConfirmation();
    renderGuard("/login");

    expect(screen.getByTestId("where")).toHaveTextContent("/login");
    expect(peekConfirmationLinkError()).toBe("otp_expired");
  });

  it("con el marcador de recuperación sigue yendo a /auth/update-password", async () => {
    captureAuthRedirect({ pathname: "/auth/callback", search: "", hash: EXPIRED_HASH });
    renderGuard("/login");

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/auth/update-password"));
  });

  it("con sesión descarta el marcador de confirmación: no reaparece como aviso tras cerrar sesión", () => {
    landOnExpiredConfirmation();
    auth.state = { ...auth.state, session: { user: { id: "u1" } }, user: { id: "u1" }, userType: 2 };
    renderGuard("/solicitudes");

    expect(peekConfirmationLinkError()).toBeNull();
    expect(screen.getByTestId("where")).toHaveTextContent("/solicitudes");
  });

  it("mientras auth carga no lo descarta todavía", () => {
    landOnExpiredConfirmation();
    auth.state = { ...auth.state, session: { user: { id: "u1" } }, loading: true };
    renderGuard("/solicitudes");

    expect(peekConfirmationLinkError()).toBe("otp_expired");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("Login · avisos de por qué se llegó aquí", () => {
  it("sin marcador ni ?error no muestra ningún aviso", () => {
    renderLogin();

    expect(screen.getByRole("heading", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("enlace de confirmación caducado o ya usado: lo explica en una región status, antes del formulario", () => {
    landOnExpiredConfirmation("?paquete=combo-emprendedor");
    renderLogin();

    const notice = screen.getByRole("status");
    expect(notice.textContent).toBe(CONFIRMATION_NOTICE);
    expect(screen.queryByRole("alert")).toBeNull();
    const form = screen.getByLabelText("Email de trabajo").closest("form")!;
    expect(notice.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each([...INVALID_LINK_CODES])("el código %s cuenta como enlace caducado o usado", (code) => {
    captureAuthRedirect({ pathname: "/solicitudes", search: "", hash: `#error=access_denied&error_code=${code}&error_description=x` });
    renderLogin();

    expect(screen.getByRole("status").textContent).toBe(CONFIRMATION_NOTICE);
  });

  it("otro código de error no muestra el aviso, y el marcador se consume igual", () => {
    captureAuthRedirect({ pathname: "/solicitudes", search: "", hash: "#error=server_error&error_description=x" });
    expect(peekConfirmationLinkError()).toBe("server_error");
    renderLogin();

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(peekConfirmationLinkError()).toBeNull();
  });

  it("un enlace de recuperación caducado no es asunto de Login: ni aviso ni consumo del marcador", () => {
    captureAuthRedirect({ pathname: "/auth/callback", search: "", hash: EXPIRED_HASH });
    renderLogin();

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(peekAuthLinkError()).toBe("otp_expired");
  });

  it("el marcador se consume al montar: al volver a /login el aviso ya no está", () => {
    landOnExpiredConfirmation();
    const first = renderLogin();
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(peekConfirmationLinkError()).toBeNull();
    first.unmount();

    renderLogin();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("?error=auth_failed: lo explica en una región alert y quita el parámetro de la URL", async () => {
    renderLogin("/login?error=auth_failed");

    expect(screen.getByRole("alert").textContent).toBe(AUTH_FAILED_NOTICE);
    expect(screen.queryByRole("status")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
    // El aviso sigue a la vista aunque la URL ya esté limpia.
    expect(screen.getByRole("alert").textContent).toBe(AUTH_FAILED_NOTICE);
  });

  it("al quitar ?error conserva el resto de la query (redirect)", async () => {
    renderLogin("/login?error=auth_failed&redirect=%2Fsolicitudes");

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login?redirect=%2Fsolicitudes"));
    expect(screen.getByRole("alert").textContent).toBe(AUTH_FAILED_NOTICE);
  });

  it("junto con ?error=auth_failed quita error_code y error_description de la query, y conserva lo demás", async () => {
    renderLogin(
      `/login?error=auth_failed&error_code=otp_expired&error_description=${encodeURIComponent(DESCRIPTION)}` +
        "&error_description=otra&redirect=%2Fsolicitudes&utm_source=correo",
    );

    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe("/login?redirect=%2Fsolicitudes&utm_source=correo"),
    );
    expect(screen.getByRole("alert").textContent).toBe(AUTH_FAILED_NOTICE);
  });

  it("sin ?error=auth_failed no toca error_code ni error_description: no es un retorno de AuthCallback", () => {
    const entry = "/login?error_code=otp_expired&error_description=x&redirect=%2Fsolicitudes";
    renderLogin(entry);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByTestId("where").textContent).toBe(entry);
  });

  it.each(["/login?error=otra_cosa", "/login?error=", "/login?error=AUTH_FAILED", "/login?error=%3Cb%3Ehola%3C%2Fb%3E"])(
    "%s no muestra aviso ni toca la URL",
    (entry) => {
      renderLogin(entry);

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
      expect(screen.getByTestId("where").textContent).toBe(entry);
    },
  );

  it("nada del enlace llega a la pantalla, la consola ni el almacenamiento: solo el texto fijo", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}),
    );
    captureAuthRedirect({
      pathname: "/solicitudes",
      search: "?paquete=combo-emprendedor",
      hash: `${EXPIRED_HASH}&access_token=TOKEN-DE-PRUEBA&refresh_token=REFRESH-DE-PRUEBA`,
    });
    renderLogin(`/login?error=auth_failed&error_description=${encodeURIComponent(DESCRIPTION)}`);
    // La URL queda limpia: ni el marcador ni la descripción del error siguen en la query.
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));

    const leaked = /DESCRIPCION-CRUDA|Email link|Email\+link|TOKEN-DE-PRUEBA|REFRESH-DE-PRUEBA|access_denied|otp_expired/;
    expect(screen.getByRole("status").textContent).toBe(CONFIRMATION_NOTICE);
    expect(document.body.textContent).not.toMatch(leaked);
    // En sessionStorage el marcador ya se consumió; en localStorage nunca hubo nada del enlace.
    expect(dump(sessionStorage)).toEqual([]);
    expect(dump(localStorage)).toEqual([]);
    for (const spy of consoleSpies) {
      expect(spy.mock.calls.flat().map(String).join(" ")).not.toMatch(leaked);
    }
  });

  it("no se queda pegado: desaparece al intentar entrar de nuevo (aunque el intento falle)", async () => {
    landOnExpiredConfirmation();
    supabaseAuth.signInWithPassword.mockResolvedValueOnce({ data: null, error: authError("invalid_credentials") });
    renderLogin();
    expect(screen.getByRole("status")).toBeInTheDocument();

    typeCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(toast.mock.calls[0][0]).toMatchObject({ description: "Correo o contraseña incorrectos." });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("el aviso de OAuth fallido desaparece al reintentar con un proveedor", async () => {
    renderLogin("/login?error=auth_failed");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Google" }));

    await waitFor(() => expect(supabaseAuth.signInWithOAuth).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("con sesión iniciada no hay aviso (pantalla de carga y redirección), y el marcador queda consumido", async () => {
    landOnExpiredConfirmation();
    auth.state = { ...auth.state, session: { user: { id: "u1" } }, user: { id: "u1" }, userType: 2 };
    renderLogin("/login?error=auth_failed");

    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/solicitudes"));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(peekConfirmationLinkError()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("Signup · el paquete pedido viaja en el enlace de confirmación", () => {
  const submit = () => {
    typeCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  };

  it("con la intención guardada envía emailRedirectTo con ?paquete=<id> y no la borra", async () => {
    rememberPackageIntent("combo-emprendedor");
    renderSignup();
    submit();

    await waitFor(() => expect(supabaseAuth.signUp).toHaveBeenCalledTimes(1));
    expect(supabaseAuth.signUp).toHaveBeenCalledWith({
      email: "persona@ejemplo.test",
      password: "Clave12345",
      options: { emailRedirectTo: `${getSiteOrigin()}/solicitudes?paquete=combo-emprendedor` },
    });
    expect(JSON.parse(localStorage.getItem(PACKAGE_INTENT_KEY) ?? "null")).toMatchObject({ id: "combo-emprendedor" });
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
  });

  it("sin intención guardada el enlace vuelve a /solicitudes a secas", async () => {
    renderSignup();
    submit();

    await waitFor(() => expect(supabaseAuth.signUp).toHaveBeenCalledTimes(1));
    expect(supabaseAuth.signUp.mock.calls[0][0].options).toEqual({ emailRedirectTo: `${getSiteOrigin()}/solicitudes` });
  });

  it.each([
    ["un id que no es de un paquete", JSON.stringify({ id: "../x", exp: Date.now() + 60_000 })],
    ["una intención caducada", JSON.stringify({ id: "combo-emprendedor", exp: Date.now() - 1000 })],
    ["un valor que no es JSON", "combo-emprendedor&next=//evil"],
  ])("con %s en el almacenamiento no añade nada al enlace", async (_label, stored) => {
    localStorage.setItem(PACKAGE_INTENT_KEY, stored);
    renderSignup();
    submit();

    await waitFor(() => expect(supabaseAuth.signUp).toHaveBeenCalledTimes(1));
    expect(supabaseAuth.signUp.mock.calls[0][0].options).toEqual({ emailRedirectTo: `${getSiteOrigin()}/solicitudes` });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
describe("Login · reenviar el enlace de confirmación", () => {
  /** Inicia sesión con un correo sin confirmar y pulsa «Reenviar enlace» del aviso (toast). */
  const signInUnconfirmedAndResend = async () => {
    supabaseAuth.signInWithPassword.mockResolvedValueOnce({ data: null, error: authError("email_not_confirmed") });
    renderLogin();
    typeCredentials();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    const { action } = toast.mock.calls[0][0] as { action: { props: { onClick: () => Promise<void> } } };
    await action.props.onClick();
  };

  it("con la intención guardada el enlace nuevo vuelve con ?paquete=<id>, y no la borra", async () => {
    rememberPackageIntent("estandar");
    await signInUnconfirmedAndResend();

    expect(supabaseAuth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "persona@ejemplo.test",
      options: { emailRedirectTo: `${getSiteOrigin()}/solicitudes?paquete=estandar` },
    });
    expect(JSON.parse(localStorage.getItem(PACKAGE_INTENT_KEY) ?? "null")).toMatchObject({ id: "estandar" });
  });

  it("sin intención guardada el enlace nuevo vuelve a /solicitudes a secas", async () => {
    await signInUnconfirmedAndResend();

    expect(supabaseAuth.resend).toHaveBeenCalledWith({
      type: "signup",
      email: "persona@ejemplo.test",
      options: { emailRedirectTo: `${getSiteOrigin()}/solicitudes` },
    });
  });
});
