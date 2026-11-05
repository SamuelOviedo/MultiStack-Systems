import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// ContactForm y lib/contact reales; solo se simula el cliente de Supabase (sin red). Recorre las respuestas del contrato
// de send-contact-email (W2.1) tal como llegan a supabase.functions.invoke: éxito, honeypot (200 igual), 429, 503, 500 y
// fallo de red.

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import ContactForm from "@/components/marketing/ContactForm";
import { CONTACT_LIMITS } from "@/lib/contact";

const GENERIC = "No se pudo enviar. Intenta de nuevo.";
const RATE_LIMITED = "Recibimos demasiados mensajes. Intenta de nuevo más tarde.";
const INVALID = "No pudimos aceptar el contenido. Revisa el nombre, el contacto y el mensaje, y quita lo que hayas pegado.";
const UNAVAILABLE = "El formulario no está disponible por ahora. Inténtalo más tarde.";
const SENT = "¡Mensaje enviado! Te responderemos a la brevedad.";

const httpError = (status: number) => Object.assign(new Error("Edge Function returned a non-2xx status code"), { context: { status } });
const networkError = () =>
  Object.assign(new Error("Failed to send a request to the Edge Function"), {
    name: "FunctionsFetchError",
    context: new TypeError("Failed to fetch"),
  });

beforeEach(() => {
  cleanup();
  invoke.mockReset();
});

function fill(overrides: Partial<Record<"name" | "phone" | "email" | "message", string>> = {}) {
  const v = { name: "Visitante PRUEBA", phone: "+504 0000-0001", email: "", message: "Mensaje de PRUEBA para el formulario", ...overrides };
  fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: v.name } });
  fireEvent.change(screen.getByLabelText("Número de teléfono (opcional)"), { target: { value: v.phone } });
  fireEvent.change(screen.getByLabelText("Correo electrónico (opcional)"), { target: { value: v.email } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: v.message } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: /Enviar mensaje|Enviando/ }));

describe("topes de longitud del formulario = contrato del servidor (lead.ts y CHECK 20261016120200)", () => {
  it("CONTACT_LIMITS no se desvía de los valores del servidor", () => {
    expect(CONTACT_LIMITS).toEqual({ nameMin: 2, nameMax: 120, emailMax: 254, phoneMax: 40, messageMin: 5, messageMax: 5000 });
  });

  it("los cuatro campos llevan maxLength con esos topes", () => {
    render(<ContactForm idPrefix="m" />);
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText("Número de teléfono (opcional)")).toHaveAttribute("maxlength", "40");
    expect(screen.getByLabelText("Correo electrónico (opcional)")).toHaveAttribute("maxlength", "254");
    expect(screen.getByLabelText("Mensaje")).toHaveAttribute("maxlength", "5000");
  });
});

describe("honeypot: atributos del campo oculto (autocompletado, teclado, lectores de pantalla)", () => {
  it("el DOM no sugiere un sitio web ni una dirección, y el cliente no lo alcanza", () => {
    const { container } = render(<ContactForm idPrefix="a" />);
    const trap = container.querySelector('input[name="ms_hp"]') as HTMLInputElement;
    expect(trap).not.toBeNull();
    // Nada de website / url / sitio / empresa en name, id, label ni placeholder: los gestores completan por esas pistas.
    const clues = [trap.name, trap.id, trap.placeholder, trap.labels?.[0]?.textContent ?? "", trap.type].join(" ");
    expect(clues).not.toMatch(/web|url|sitio|site|http|empresa|company|link|enlace/i);
    expect(container.querySelector('[name="website"], #a-website')).toBeNull();
    expect(trap.type).toBe("text");
    expect(trap.getAttribute("autocomplete")).toBe("off");
    for (const flag of ["data-lpignore", "data-1p-ignore", "data-bwignore"]) expect(trap.getAttribute(flag)).toBe("true");
    expect(trap.tabIndex).toBe(-1);
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
    expect((trap.closest('[aria-hidden="true"]') as HTMLElement).style.left).toBe("-10000px");
  });

  it("la clave del cuerpo sigue siendo «website» (contrato de lead.ts) aunque el campo ya no se llame así", async () => {
    const { normalizeContact } = await import("@/lib/contact");
    expect(normalizeContact({ name: "Ana", message: "hola mundo", email: "a@b.co", website: "x" })).toHaveProperty("website", "x");
  });
});

describe("respuestas del servidor vistas por el visitante", () => {
  it("200: muestra el éxito y vacía el formulario", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    render(<ContactForm idPrefix="s" />);
    fill();
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe("send-contact-email");
  });

  it("honeypot lleno por el autocompletado: no se envía, no hay éxito falso, el campo se vacía y el reintento envía sin él", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const { container } = render(<ContactForm idPrefix="h" />);
    fill();
    const trap = container.querySelector('input[name="ms_hp"]') as HTMLInputElement;
    fireEvent.change(trap, { target: { value: "http://autofill.example.test" } });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC);
    expect(screen.queryByText(SENT)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(trap.value).toBe("");
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Mensaje de PRUEBA para el formulario");

    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body).not.toHaveProperty("website");
  });

  it("sin honeypot el cuerpo no lleva el campo", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    render(<ContactForm idPrefix="n" />);
    fill();
    submit();
    await screen.findByText(SENT);
    expect(invoke.mock.calls[0][1].body).not.toHaveProperty("website");
  });

  it.each([
    ["429 (límite)", httpError(429), RATE_LIMITED],
    ["503 (servicio cerrado por configuración)", httpError(503), UNAVAILABLE],
    ["500 (error interno)", httpError(500), GENERIC],
    ["400 (contenido que la función no acepta)", httpError(400), INVALID],
    ["401 (JWT rechazado por la pasarela)", httpError(401), GENERIC],
    ["405 (método)", httpError(405), GENERIC],
    ["fallo de red", networkError(), GENERIC],
  ])("%s: un solo aviso, el correcto, y los datos tecleados se conservan", async (_case, error, expected) => {
    invoke.mockResolvedValue({ data: null, error });
    render(<ContactForm idPrefix="e" />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(expected);
    for (const other of [GENERIC, RATE_LIMITED, UNAVAILABLE, INVALID].filter((t) => t !== expected)) expect(screen.queryByText(other)).toBeNull();
    expect(screen.queryByText(SENT)).toBeNull();
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Mensaje de PRUEBA para el formulario");
  });

  it.each([
    ["Nombre completo", "Ana\u0000", "Hay caracteres invisibles no permitidos en el nombre. Revisa lo que pegaste."],
    ["Número de teléfono (opcional)", "+504 0000\u0008-0001", "Hay caracteres invisibles no permitidos en el teléfono. Revisa lo que pegaste."],
    ["Correo electrónico (opcional)", "a@b.co\u007f", "Hay caracteres invisibles no permitidos en el correo. Revisa lo que pegaste."],
    ["Mensaje", "Mensaje\u001f de prueba", "Hay caracteres invisibles no permitidos en el mensaje. Revisa lo que pegaste."],
  ])("pegar un carácter de control en «%s»: aviso del campo, foco ahí y nada se envía", (label, bad, text) => {
    render(<ContactForm idPrefix="c" />);
    fill({ email: "ana@ejemplo.com" });
    fireEvent.change(screen.getByLabelText(label), { target: { value: bad } });
    submit();
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(screen.getByLabelText(label));
    expect(invoke).not.toHaveBeenCalled();
  });

  it("tab, salto de línea, emoji, acentos, kanji, comillas y <> se envían tal cual", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    render(<ContactForm idPrefix="l" />);
    const message = "Hola,\n\tquiero una web 😀 áéíóú ñ 漢字 \"a\" 'b' `c` <b>x</b> > <";
    fill({ name: "Ana 😀 漢字", message });
    submit();
    await screen.findByText(SENT);
    expect(invoke.mock.calls[0][1].body.message).toBe(message);
    expect(invoke.mock.calls[0][1].body.name).toBe("Ana 😀 漢字");
  });

  it("el aviso de 503 no pide reintentar «ya» y el genérico sí: no se confunden", () => {
    expect(UNAVAILABLE).not.toMatch(/Intenta de nuevo/);
    expect(UNAVAILABLE).not.toBe(GENERIC);
    expect(UNAVAILABLE).not.toBe(RATE_LIMITED);
    expect(INVALID).not.toBe(GENERIC);
    expect(INVALID).not.toMatch(/Intenta de nuevo/);
  });

  it("tras un 429 el visitante puede reintentar y el aviso desaparece al tener éxito", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: httpError(429) });
    render(<ContactForm idPrefix="r" />);
    fill();
    submit();
    expect(await screen.findByText(RATE_LIMITED)).toBeInTheDocument();

    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(screen.queryByText(RATE_LIMITED)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("doble envío mientras la respuesta está pendiente: una sola llamada", async () => {
    let release!: (v: unknown) => void;
    invoke.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    render(<ContactForm idPrefix="d" />);
    fill();
    const form = screen.getByLabelText("Nombre completo").closest("form") as HTMLFormElement;
    submit();
    submit();
    fireEvent.submit(form);
    expect(invoke).toHaveBeenCalledTimes(1);
    release({ data: null, error: httpError(429) });
    expect(await screen.findByText(RATE_LIMITED)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});
