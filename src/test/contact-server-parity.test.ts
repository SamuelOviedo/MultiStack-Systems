import { describe, expect, it, vi } from "vitest";

// Parity of the browser form with the Edge Function `send-contact-email` (W2.1). Both are PURE modules, so the real
// ones are compared here instead of copying their rules into the test: if one side changes and the other does not, the
// person would be told "ok" by the form and get the generic 400 from the function (or the other way round).
// supabase/functions/**/lead.ts is imported read-only; nothing is mocked except the Supabase client the form module loads.
// Heads-up: that import pulls function files (lead.ts and the types it imports) into the app's `tsc -p tsconfig.app.json`,
// so a Deno global or an API newer than ES2020 in them would break the FRONTEND typecheck, not only the function's.

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import {
  CONTACT_LIMITS,
  hasUnsafeText as clientHasUnsafeText,
  normalizeContact,
  validateContact,
  type ContactPayload,
} from "@/lib/contact";
import { checkLead, HONEYPOT_FIELD, LEAD_LIMITS, hasUnsafeText as serverHasUnsafeText } from "../../supabase/functions/send-contact-email/lead";

const ch = (...codes: number[]): string => String.fromCharCode(...codes);

describe("límites: CONTACT_LIMITS (cliente) = LEAD_LIMITS (función)", () => {
  it("mismas claves y mismos valores", () => {
    expect({ ...CONTACT_LIMITS }).toEqual({ ...LEAD_LIMITS });
    // Y no vacío: los números que el resto de las pruebas del formulario suponen.
    expect(LEAD_LIMITS).toEqual({ nameMin: 2, nameMax: 120, emailMax: 254, phoneMax: 40, messageMin: 5, messageMax: 5000 });
  });
});

describe("hasUnsafeText: la regla del cliente da el mismo veredicto que la de la función", () => {
  // Every UTF-16 code unit on its own, at the start, in the middle and at the end of a string.
  it("las 65 536 unidades de código, solas y rodeadas de texto normal", () => {
    const mismatches: string[] = [];
    let unsafe = 0;
    for (let code = 0; code <= 0xffff; code++) {
      const c = ch(code);
      for (const text of [c, `a${c}b`, `${c}b`, `a${c}`]) {
        const client = clientHasUnsafeText(text);
        const server = serverHasUnsafeText(text);
        if (client !== server) mismatches.push(`U+${code.toString(16).padStart(4, "0")} en «${text.length === 1 ? "solo" : text.length}»: cliente ${client}, función ${server}`);
        if (text === c && server) unsafe++;
      }
    }
    expect(mismatches).toEqual([]);
    // Not vacuous: 9 (0000-0008) + 2 (000B, 000C) + 18 (000E-001F) + 1 (007F) + 2048 surrogates alone = 2078 unsafe units.
    expect(unsafe).toBe(2078);
  });

  it("pares de unidades: suplente alto/bajo bien formado o no, junto a letras, controles y límites del rango", () => {
    const units = [
      ...Array.from({ length: 0x21 }, (_, i) => i), // C0 + space
      0x41, 0x7e, 0x7f, 0x80, 0x9f, 0xa0, 0x2028, 0x2029, 0xd7ff, 0xd800, 0xd801, 0xdbff, 0xdc00, 0xdc01, 0xdfff, 0xe000, 0xfeff, 0xffff,
    ];
    const mismatches: string[] = [];
    let wellFormedPairs = 0;
    for (const a of units) {
      for (const b of units) {
        for (const text of [ch(a, b), `x${ch(a, b)}y`]) {
          const client = clientHasUnsafeText(text);
          const server = serverHasUnsafeText(text);
          if (client !== server) mismatches.push(`${a.toString(16)}+${b.toString(16)}: cliente ${client}, función ${server}`);
        }
        if (a >= 0xd800 && a <= 0xdbff && b >= 0xdc00 && b <= 0xdfff) wellFormedPairs++;
      }
    }
    expect(mismatches).toEqual([]);
    expect(wellFormedPairs).toBeGreaterThan(0);
    expect(serverHasUnsafeText(ch(0xd83d, 0xde00))).toBe(false); // un par bien formado: no es inseguro en ninguno de los dos
    expect(clientHasUnsafeText(ch(0xd83d, 0xde00))).toBe(false);
  });
});

describe("lo que el formulario deja pasar, la función lo acepta (y, en la cuadrícula de bordes, marcan los mismos campos)", () => {
  const names = ["Al", "Ana Pérez", "a".repeat(120), "a".repeat(121), "a", `Ana${ch(0)}`, `Ana${ch(0x0b)}`, `${ch(0x1f)}Ana`, "Ana 😀 漢字"];
  const phones = [
    "",
    "1234567",
    "123456",
    "1".repeat(15),
    "1".repeat(16),
    "+504 9999-9999",
    "abc1234567",
    `1234567${" ".repeat(32)}8`, // 40 characters
    `1234567${" ".repeat(33)}8`, // 41 characters
    `+504 9999${ch(7)}-0000`,
  ];
  const emails = [
    "",
    "a@example.test",
    "a@b",
    " A@Example.TEST ",
    `${"a".repeat(241)}@example.test`, // 254
    `${"a".repeat(242)}@example.test`, // 255
    `ana@example${ch(0x7f)}.test`,
  ];
  const messages = [
    "",
    "hey",
    "hola", // 4: one below messageMin
    "hello", // 5: messageMin
    "x".repeat(5000),
    "x".repeat(5001),
    `ok${ch(1)}ok ok`,
    "ok\r\n\t fine",
    "😀😀😀😀😀",
    `lone ${ch(0xd83d)} high`,
    `lone ${ch(0xde00)} low`,
  ];

  const grid = (): ContactPayload[] =>
    names.flatMap((name) => phones.flatMap((phone) => emails.flatMap((email) => messages.map((message) => ({ name, phone, email, message })))));

  const describeForm = (f: ContactPayload) => JSON.stringify({ n: f.name.length, p: f.phone?.length, e: f.email?.length, m: f.message.length });

  /** The fields the form flags, in the function's vocabulary (its «contact method» is the form's «contact»). */
  const clientFields = (f: ContactPayload): string[] => Object.keys(validateContact(f)).sort();
  const serverFields = (body: unknown): string[] => {
    const check = checkLead(body);
    if (check.kind !== "invalid") return [];
    return check.reason
      .split(", ")
      .map((field) => (field === "contact method" ? "contact" : field))
      .sort();
  };

  it("lo que el formulario deja pasar, la función lo acepta una vez armado el cuerpo (nadie recibe el 400 genérico por un campo que el formulario dio por bueno)", () => {
    const mismatches: string[] = [];
    let accepted = 0;
    for (const form of grid()) {
      if (clientFields(form).length > 0) continue;
      accepted++;
      const check = checkLead(normalizeContact(form));
      if (check.kind !== "ok") mismatches.push(`${describeForm(form)}: la función respondió ${check.kind}`);
    }
    expect(mismatches).toEqual([]);
    expect(accepted).toBeGreaterThan(100); // not vacuous: the grid has plenty of valid forms
  });

  it("en la cuadrícula, el mismo veredicto campo por campo sobre los valores tal como se teclearon (la función mira el texto crudo, como el formulario)", () => {
    // Raw values, not the normalized body: normalizeContact trims, so a vertical tab or form feed at the edge is flagged here
    // but never reaches the function through the form. WITHIN THIS GRID both sides flag the same fields. Outside it there
    // are two known differences, and in both the form is the stricter one: a name over 120 characters made up with repeated
    // spaces (the function collapses whitespace runs before measuring) and an empty name with an e-mail (the function uses
    // the e-mail as the name). The grid has neither on purpose; do not read this test as "always the same fields".
    const mismatches: string[] = [];
    let rejected = 0;
    for (const form of grid()) {
      const client = clientFields(form);
      const server = serverFields(form);
      if (client.length > 0) rejected++;
      if (client.join() !== server.join()) mismatches.push(`${describeForm(form)}: formulario [${client}], función [${server}]`);
    }
    expect(mismatches).toEqual([]);
    expect(rejected).toBeGreaterThan(1000); // not vacuous: the grid has plenty of invalid forms, in every field
  });

  it("el cuerpo que arma el formulario es el que la función guarda: recorte, correo en minúsculas, sin opcionales vacíos", () => {
    const form: ContactPayload = { name: "  Ana Pérez ", phone: "  ", email: " Ana@Example.TEST ", message: "  Necesito una web  " };
    const check = checkLead(normalizeContact(form));
    expect(check).toEqual({ kind: "ok", lead: { name: "Ana Pérez", phone: "", email: "ana@example.test", message: "Necesito una web" } });
  });

  // U+0130 (I with dot above) lower-cases to TWO code units. normalizeContact lower-cases the e-mail before sending and the
  // function measures the lower-cased one: 254 -> 255. The form (validateContact) must therefore measure that same value.
  const DOTTED_I_EMAIL = `${"a".repeat(240)}${ch(0x130)}@example.test`; // 254 as typed, 255 lower-cased
  const DOTTED_I_FITS = `${"a".repeat(239)}${ch(0x130)}@example.test`; // 253 as typed, 254 lower-cased: the largest that fits
  const dottedIForm: ContactPayload = { name: "Ana Pérez", email: DOTTED_I_EMAIL, message: "Necesito una web" };

  // Control: the facts the case stands on, none of which depends on how the form validates, so it stays green after a fix.
  it("control del caso U+0130: 254 caracteres tecleados son 255 al pasar a minúsculas, y la función rechaza 255", () => {
    expect(DOTTED_I_EMAIL).toHaveLength(254);
    expect(normalizeContact(dottedIForm).email).toHaveLength(255);
    expect(checkLead(normalizeContact(dottedIForm)).kind).toBe("invalid");
  });

  // Defecto teórico hallado en L5 P2 y corregido en L5 P4 (2026-11-08), en src/lib/contact.ts: el tope de correo se medía
  // antes de pasar a minúsculas y la función lo mide después, de modo que el formulario dejaba pasar una dirección de 254
  // caracteres con esa letra y la función respondía 400 (aviso «No pudimos procesar tu mensaje…»). Ahora isValidEmail mide
  // `value.toLowerCase().length`: el formulario la rechaza y la implicación «lo que el formulario acepta, la función
  // también» se cumple.
  it("correo con U+0130: el de 254 caracteres (255 en minúsculas) lo rechaza el formulario, y el de 253 (254 en minúsculas) pasa en el formulario y en la función", () => {
    // 254 as typed: the form flags it (and only it), so the function never has to answer 400 for it.
    expect(validateContact(dottedIForm)).toEqual({ email: "Revisa el correo electrónico." });
    // 253 as typed = 254 lower-cased: the limit is not applied too early, and both sides accept it.
    const fits: ContactPayload = { ...dottedIForm, email: DOTTED_I_FITS };
    expect(DOTTED_I_FITS).toHaveLength(253);
    expect(normalizeContact(fits).email).toHaveLength(254);
    expect(validateContact(fits)).toEqual({});
    expect(checkLead(normalizeContact(fits)).kind).toBe("ok");
  });
});

describe("honeypot: la clave del cuerpo es la que la función espera", () => {
  const valid: ContactPayload = { name: "Ana Pérez", email: "ana@example.test", message: "Necesito una web" };

  it("la función espera «website» y el formulario la envía con ese nombre", () => {
    expect(HONEYPOT_FIELD).toBe("website");
    const body = normalizeContact({ ...valid, website: "http://spam.example.test" });
    expect(body).toHaveProperty(HONEYPOT_FIELD, "http://spam.example.test");
    expect(checkLead(body).kind).toBe("honeypot");
  });

  it("un honeypot vacío o de espacios no viaja y la función ve un envío normal", () => {
    for (const website of ["", "   "]) {
      const body = normalizeContact({ ...valid, website });
      expect(body).not.toHaveProperty(HONEYPOT_FIELD);
      expect(checkLead(body).kind).toBe("ok");
    }
  });
});
