import { afterEach, describe, expect, it, vi } from "vitest";

const resendMock = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {}, error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { resend: resendMock } },
}));

import { authErrorCode, describeAuthError, resendSignupConfirmation } from "@/lib/auth";
import { getAuthEmailRedirectUrl } from "@/lib/siteUrl";

/** Shape of supabase-js AuthError (message + machine-readable code). */
const authError = (code: string, message = "raw message") => Object.assign(new Error(message), { code });

afterEach(() => {
  resendMock.mockClear();
  vi.unstubAllEnvs();
});

describe("describeAuthError — Confirm email rollout (S17)", () => {
  it("explains an unconfirmed e-mail in Spanish instead of the raw English message", () => {
    const msg = describeAuthError(authError("email_not_confirmed", "Email not confirmed"));
    expect(msg).toMatch(/correo aún no está confirmado/);
    expect(msg).not.toMatch(/Email not confirmed/);
  });

  it("maps the common credential / rate-limit codes", () => {
    expect(describeAuthError(authError("invalid_credentials"))).toBe("Correo o contraseña incorrectos.");
    expect(describeAuthError(authError("over_email_send_rate_limit"))).toMatch(/Espera unos minutos/);
    expect(describeAuthError(authError("signup_disabled"))).toMatch(/desactivado temporalmente/);
  });

  it("falls back to the original message for unknown codes and plain errors", () => {
    expect(describeAuthError(authError("something_new", "Original"))).toBe("Original");
    expect(describeAuthError(new Error("plain"))).toBe("plain");
    expect(describeAuthError("text")).toBe("text");
  });

  it("authErrorCode reads AuthError.code safely", () => {
    expect(authErrorCode(authError("email_not_confirmed"))).toBe("email_not_confirmed");
    expect(authErrorCode(new Error("x"))).toBeUndefined();
    expect(authErrorCode(null)).toBeUndefined();
    expect(authErrorCode({ code: 42 })).toBeUndefined();
  });
});

describe("resendSignupConfirmation", () => {
  it("re-sends the signup link to the trimmed address with the same redirect as sign-up", async () => {
    await resendSignupConfirmation("  cliente@example.com ");
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "cliente@example.com",
      options: { emailRedirectTo: getAuthEmailRedirectUrl() },
    });
  });

  it("propagates Supabase errors (e.g. rate limit) to the caller", async () => {
    resendMock.mockResolvedValueOnce({ data: null, error: authError("over_email_send_rate_limit") });
    await expect(resendSignupConfirmation("a@b.co")).rejects.toMatchObject({ code: "over_email_send_rate_limit" });
  });
});
