import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { CONTACT_LIMITS, ContactRateLimitError, sendContactMessage, validateContact } from "./contact";

const valid = { name: "Ana Pérez", email: "ana@ejemplo.com", message: "Necesito una web" };

describe("validateContact — message length", () => {
  it("accepts a message up to the server limit", () => {
    expect(validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.messageMax) }).message).toBeUndefined();
  });

  it("rejects a message over the server limit before sending", () => {
    expect(validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.messageMax + 1) }).message)
      .toBe("El mensaje es demasiado largo.");
    expect(CONTACT_LIMITS.messageMax).toBe(5000);
  });

  it("applies the server's e-mail (254) and phone (40) length limits", () => {
    expect(validateContact({ ...valid, email: `${"a".repeat(250)}@x.com` }).email).toBe("Revisa el correo electrónico.");
    expect(validateContact({ ...valid, phone: "1".repeat(8) + " ".repeat(40) + "2" }).phone).toBe("Revisa el número de teléfono.");
    expect(validateContact({ ...valid, phone: "+504 9999-0000" }).phone).toBeUndefined();
  });

  it("still asks for more text below the minimum", () => {
    expect(validateContact({ ...valid, message: "hey" }).message).toBe("Cuéntanos un poco más.");
  });
});

describe("sendContactMessage — server answers", () => {
  beforeEach(() => invoke.mockReset());

  it("resolves on success", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(sendContactMessage(valid)).resolves.toBeUndefined();
  });

  it("maps HTTP 429 to ContactRateLimitError", async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("x"), { context: { status: 429 } }) });
    await expect(sendContactMessage(valid)).rejects.toBeInstanceOf(ContactRateLimitError);
  });

  it("rethrows any other error unchanged", async () => {
    const err = Object.assign(new Error("boom"), { context: { status: 500 } });
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(sendContactMessage(valid)).rejects.toBe(err);
  });
});
