import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import {
  CONTACT_LIMITS,
  ContactInvalidError,
  ContactRateLimitError,
  ContactUnavailableError,
  hasUnsafeText,
  normalizeContact,
  sendContactMessage,
  validateContact,
} from "./contact";

const valid = { name: "Ana Pérez", email: "ana@example.test", message: "Necesito una web" };

describe("validateContact — message length", () => {
  it("accepts a message up to the server limit", () => {
    expect(validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.messageMax) }).message).toBeUndefined();
  });

  it("rejects a message over the server limit before sending", () => {
    expect(validateContact({ ...valid, message: "x".repeat(CONTACT_LIMITS.messageMax + 1) }).message)
      .toBe("El mensaje supera el límite permitido. Resúmelo e inténtalo de nuevo.");
    expect(CONTACT_LIMITS.messageMax).toBe(5000);
  });

  it("applies the server's e-mail (254) and phone (40) length limits", () => {
    expect(validateContact({ ...valid, email: `${"a".repeat(243)}@example.test` }).email).toBe("Revisa el correo electrónico.");
    expect(validateContact({ ...valid, phone: "1".repeat(8) + " ".repeat(40) + "2" }).phone).toBe("Revisa el número de teléfono.");
    expect(validateContact({ ...valid, phone: "+504 9999-0000" }).phone).toBeUndefined();
  });

  it("accepts the exact server limits (name 120, e-mail 254, phone 40) and rejects one more", () => {
    expect(validateContact({ ...valid, name: "a".repeat(120) }).name).toBeUndefined();
    expect(validateContact({ ...valid, name: "a".repeat(121) }).name).toBe("El nombre es demasiado largo.");
    expect(validateContact({ ...valid, email: `${"a".repeat(241)}@example.test` }).email).toBeUndefined(); // 254
    expect(validateContact({ ...valid, email: `${"a".repeat(242)}@example.test` }).email).toBe("Revisa el correo electrónico."); // 255
    const phone40 = `1234567${" ".repeat(32)}8`;
    expect(phone40).toHaveLength(40);
    expect(validateContact({ ...valid, phone: phone40 }).phone).toBeUndefined();
    expect(validateContact({ ...valid, phone: `1234567${" ".repeat(33)}8` }).phone).toBe("Revisa el número de teléfono.");
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

  it("maps HTTP 503 (function closed by missing configuration) to ContactUnavailableError", async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("x"), { context: { status: 503 } }) });
    await expect(sendContactMessage(valid)).rejects.toBeInstanceOf(ContactUnavailableError);
  });

  it("maps HTTP 400 (content the function refuses) to ContactInvalidError", async () => {
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("x"), { context: { status: 400 } }) });
    await expect(sendContactMessage(valid)).rejects.toBeInstanceOf(ContactInvalidError);
  });

  it.each([[500], [401], [405], [502]])("rethrows HTTP %i unchanged", async (status) => {
    const err = Object.assign(new Error("boom"), { context: { status } });
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(sendContactMessage(valid)).rejects.toBe(err);
  });

  it("rethrows an error that carries no response at all (no `context`) unchanged", async () => {
    const err = new Error("relay error");
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(sendContactMessage(valid)).rejects.toBe(err);
  });

  it("rethrows a network failure (no HTTP status) unchanged", async () => {
    const err = Object.assign(new Error("Failed to send a request to the Edge Function"), { context: new TypeError("Failed to fetch") });
    invoke.mockResolvedValue({ data: null, error: err });
    await expect(sendContactMessage(valid)).rejects.toBe(err);
  });
});

// Same exact set as the function (W2.1 lead.ts hasUnsafeText): U+0000-0008, 000B, 000C, 000E-001F, 007F, lone surrogates.
describe("hasUnsafeText - same set as the function", () => {
  const UNSAFE = [...Array(0x20).keys()].filter((c) => c !== 0x09 && c !== 0x0a && c !== 0x0d).concat(0x7f);

  it.each(UNSAFE.map((c) => [c.toString(16).padStart(4, "0"), c] as const))("rejects U+%s", (_hex, code) => {
    expect(hasUnsafeText(`ab${String.fromCharCode(code)}cd`)).toBe(true);
    expect(hasUnsafeText(String.fromCharCode(code))).toBe(true); // alone, and at the edges
  });

  it("rejects an unpaired surrogate (high alone, low alone, high before a letter), accepts a real pair", () => {
    expect(hasUnsafeText("a\ud83d")).toBe(true);
    expect(hasUnsafeText("\ude00a")).toBe(true);
    expect(hasUnsafeText("\ud83dx")).toBe(true);
    expect(hasUnsafeText("😀")).toBe(false);
  });

  it("accepts tab, line feed, carriage return and every legitimate kind of text", () => {
    const fine = [
      "a\tb",
      "a\nb",
      "a\r\nb",
      "Ana Pérez ñ á ü",
      "😀 🇭🇳 👨‍👩‍👧",
      "漢字かな한글",
      "\"comillas\" 'simples' `acento`",
      "<b>x</b> & > < \\ %",
      "\u0080\u009f\u00a0\u2028", // C1 controls, nbsp and line separator are NOT in the function's set
    ];
    for (const ok of fine) expect(hasUnsafeText(ok), ok).toBe(false);
  });
});

// One text for the four fields: what tells the person WHERE it is, is the field the text appears under (the key), so the
// tests below also check that no other field carries it.
const UNSAFE_TEXT = "El campo contiene caracteres invisibles no permitidos. Revisa el texto ingresado.";

describe("validateContact - control characters (S4)", () => {
  const field = (k: "name" | "phone" | "email" | "message", v: string) =>
    validateContact({ name: "Ana Pérez", phone: "+504 9999-0000", email: "", message: "Necesito una web", [k]: v });

  it.each([
    ["name", "Ana\u0000 Pérez", UNSAFE_TEXT],
    ["phone", "+504 9999\u0007-0000", UNSAFE_TEXT],
    ["email", "ana@example\u007f.test", UNSAFE_TEXT],
    ["message", "Necesito\u001b una web", UNSAFE_TEXT],
  ] as const)("flags a control character in %s, and only that field, with the invisible-characters text", (k, value, msg) => {
    const errors = field(k, value);
    expect(errors[k]).toBe(msg);
    expect(Object.keys(errors)).toEqual([k]);
  });

  it("looks at the raw text: a vertical tab or form feed at the edge is flagged, not hidden by trim", () => {
    expect(field("name", "Ana Pérez\u000b").name).toBe(UNSAFE_TEXT);
    expect(field("message", "\u000cNecesito una web").message).toBe(UNSAFE_TEXT);
    expect(field("phone", "+504 9999-0000\u000b").phone).toBe(UNSAFE_TEXT);
  });

  it("a lone surrogate is flagged", () => {
    expect(field("message", "Necesito una web \ud83d").message).toBe(UNSAFE_TEXT);
  });

  it("the control message wins over a length error of the same field, and only that field is flagged", () => {
    const e = field("name", "\u0001");
    expect(e.name).toBe(UNSAFE_TEXT);
    expect(Object.keys(e)).toEqual(["name"]);
  });

  it("legitimate text is NOT flagged and is NOT altered: tab, line breaks, emoji, accents, kanji, quotes, < >", () => {
    const message = "Hola,\n\tnecesito una web 😀 con acentos áéíóú ñ, 漢字, \"comillas\", 'simples', `acento` y <b>etiquetas</b> & más > <\r\nFin";
    const form = { name: "Ana Pérez 😀 漢字", phone: "+504 9999-0000", email: "ana@example.test", message };
    expect(validateContact(form)).toEqual({});
    expect(normalizeContact(form).message).toBe(message);
    expect(normalizeContact(form).name).toBe(form.name);
  });
});
