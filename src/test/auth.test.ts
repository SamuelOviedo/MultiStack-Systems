import { afterEach, describe, expect, it, vi } from "vitest";

const signInWithOAuthMock = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
const signUpMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {}, error: null }));
const resendMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {}, error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithOAuth: signInWithOAuthMock, signUp: signUpMock, resend: resendMock } },
}));

import { getAuthCallbackUrl, resendSignupConfirmation, signInWithOAuth, signUpWithEmail } from "@/lib/auth";

/** Temporarily replaces window.location (jsdom) without `any`. */
function withLocation<T>(location: { hostname: string; origin: string }, run: () => T): T {
  const original = window.location;
  Reflect.deleteProperty(window, "location");
  Reflect.set(window, "location", location);
  try {
    return run();
  } finally {
    Reflect.set(window, "location", original);
  }
}

afterEach(() => {
  signInWithOAuthMock.mockClear();
  signUpMock.mockClear();
  resendMock.mockClear();
  vi.unstubAllEnvs();
});

describe("OAuth redirect — dynamic origin", () => {
  it("a Vercel Preview returns to the same Preview, even with VITE_SITE_URL set to production", async () => {
    vi.stubEnv("VITE_SITE_URL", "https://multistacksystems.com");
    const preview = "https://multi-stack-systems-abc123-samueloviedos-projects.vercel.app";
    await withLocation({ hostname: new URL(preview).hostname, origin: preview }, () => signInWithOAuth("google"));
    expect(signInWithOAuthMock).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${preview}/auth/callback` },
    });
  });

  it("production returns to production and localhost to localhost", () => {
    expect(
      withLocation({ hostname: "multistacksystems.com", origin: "https://multistacksystems.com" }, getAuthCallbackUrl),
    ).toBe("https://multistacksystems.com/auth/callback");
    expect(withLocation({ hostname: "localhost", origin: "http://localhost:8080" }, getAuthCallbackUrl)).toBe(
      "http://localhost:8080/auth/callback",
    );
  });
});

describe("Enlace de confirmación de registro — emailRedirectTo", () => {
  const SITE = "https://www.multistacksystems.com";
  /** Host desplegado (no localhost) con VITE_SITE_URL de producción: el correo vuelve al origen canónico. */
  const deployed = <T,>(run: () => T): T => {
    vi.stubEnv("VITE_SITE_URL", SITE);
    return withLocation({ hostname: "www.multistacksystems.com", origin: SITE }, run);
  };

  it("signUpWithEmail sin paquete vuelve a /solicitudes", async () => {
    await deployed(() => signUpWithEmail("  persona@ejemplo.test ", "Clave12345"));
    expect(signUpMock).toHaveBeenCalledWith({
      email: "persona@ejemplo.test",
      password: "Clave12345",
      options: { emailRedirectTo: `${SITE}/solicitudes` },
    });
  });

  it("signUpWithEmail con un paquete de la lista blanca vuelve a /solicitudes?paquete=<id>", async () => {
    await deployed(() => signUpWithEmail("persona@ejemplo.test", "Clave12345", "combo-emprendedor"));
    expect(signUpMock).toHaveBeenCalledWith({
      email: "persona@ejemplo.test",
      password: "Clave12345",
      options: { emailRedirectTo: `${SITE}/solicitudes?paquete=combo-emprendedor` },
    });
  });

  it("resendSignupConfirmation sin paquete vuelve a /solicitudes", async () => {
    await deployed(() => resendSignupConfirmation(" persona@ejemplo.test "));
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "persona@ejemplo.test",
      options: { emailRedirectTo: `${SITE}/solicitudes` },
    });
  });

  it("resendSignupConfirmation con un paquete de la lista blanca vuelve a /solicitudes?paquete=<id>", async () => {
    await deployed(() => resendSignupConfirmation("persona@ejemplo.test", "estandar"));
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "persona@ejemplo.test",
      options: { emailRedirectTo: `${SITE}/solicitudes?paquete=estandar` },
    });
  });

  it.each(["../x", "combo-emprendedor&next=//evil", ""])(
    "un id que no es de un paquete (%j) no llega a Supabase: el destino es /solicitudes a secas",
    async (id) => {
      await deployed(() => signUpWithEmail("persona@ejemplo.test", "Clave12345", id));
      await deployed(() => resendSignupConfirmation("persona@ejemplo.test", id));
      expect(signUpMock.mock.calls[0][0].options).toEqual({ emailRedirectTo: `${SITE}/solicitudes` });
      expect(resendMock.mock.calls[0][0].options).toEqual({ emailRedirectTo: `${SITE}/solicitudes` });
    },
  );

  it("propagan el error de Supabase", async () => {
    signUpMock.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("x"), { code: "user_already_exists" }) });
    resendMock.mockResolvedValueOnce({ data: null, error: Object.assign(new Error("x"), { code: "over_email_send_rate_limit" }) });
    await expect(signUpWithEmail("persona@ejemplo.test", "Clave12345", "estandar")).rejects.toMatchObject({
      code: "user_already_exists",
    });
    await expect(resendSignupConfirmation("persona@ejemplo.test", "estandar")).rejects.toMatchObject({
      code: "over_email_send_rate_limit",
    });
  });
});
