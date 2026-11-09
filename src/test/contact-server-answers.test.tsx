import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// ContactForm y lib/contact reales; solo se simula el cliente de Supabase (sin red). Recorre las respuestas del contrato
// de send-contact-email (W2.1) tal como llegan a supabase.functions.invoke: éxito, honeypot (200 igual), 429, 503, 500 y
// fallo de red.

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import ContactForm from "@/components/marketing/ContactForm";
import { CONTACT_LIMITS } from "@/lib/contact";

// Fixed texts of the form. The four error ones all say «inténtalo de nuevo» (owner's decision), so what tells them apart is
// the WHOLE text, never a fragment: every check below compares the whole alert, not a regular expression.
const GENERIC = "No pudimos enviar tu mensaje. Inténtalo de nuevo.";
const RATE_LIMITED = "Has alcanzado el límite de envíos. Inténtalo de nuevo más tarde.";
const INVALID = "No pudimos procesar tu mensaje. Revisa los datos ingresados e inténtalo de nuevo.";
const UNAVAILABLE = "El formulario no está disponible temporalmente. Inténtalo de nuevo más tarde.";
const UNSAFE = "El campo contiene caracteres invisibles no permitidos. Revisa el texto ingresado.";
const SENT = "¡Mensaje enviado! Te responderemos a la brevedad.";

/** What the person typed: the four fields, so that "it was kept" is checked on each of them. */
const TYPED = {
  name: "Visitante PRUEBA",
  phone: "+504 0000-0001",
  email: "visitante.prueba@example.test",
  message: "Mensaje de PRUEBA para el formulario",
};

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

const LABELS = {
  name: "Nombre completo",
  phone: "Número de teléfono (opcional)",
  email: "Correo electrónico (opcional)",
  message: "Mensaje",
} as const;

/** The four fields hold exactly these values (the form kept what was typed, or was emptied with ""). */
function expectFields(values: Record<keyof typeof LABELS, string>) {
  for (const key of Object.keys(LABELS) as Array<keyof typeof LABELS>) {
    expect(screen.getByLabelText(LABELS[key]), key).toHaveValue(values[key]);
  }
}

/** Every alert text of the form that is not `expected`, which must NOT be on screen. */
const otherTexts = (expected: string) => [GENERIC, RATE_LIMITED, UNAVAILABLE, INVALID].filter((t) => t !== expected);

describe("topes de longitud del formulario = contrato del servidor (lead.ts y CHECK 20261016120200)", () => {
  it("CONTACT_LIMITS no se desvía de los valores del servidor", () => {
    expect(CONTACT_LIMITS).toEqual({ nameMin: 2, nameMax: 120, emailMax: 254, phoneMax: 40, messageMin: 5, messageMax: 5000 });
  });

  // El mensaje NO lleva maxLength a propósito: con él, el navegador recorta en silencio lo que se pega y el visitante envía
  // un texto distinto del que escribió. Sin él, el valor queda completo y la validación avisa (ver el describe de más abajo).
  it("nombre, teléfono y correo llevan maxLength con sus topes; el mensaje no lleva maxLength", () => {
    render(<ContactForm idPrefix="m" />);
    expect(screen.getByLabelText("Nombre completo")).toHaveAttribute("maxlength", "120");
    expect(screen.getByLabelText("Número de teléfono (opcional)")).toHaveAttribute("maxlength", "40");
    expect(screen.getByLabelText("Correo electrónico (opcional)")).toHaveAttribute("maxlength", "254");
    expect(screen.getByLabelText("Mensaje")).not.toHaveAttribute("maxlength");
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
    expect(normalizeContact({ name: "Ana", message: "hola mundo", email: "a@example.test", website: "x" })).toHaveProperty("website", "x");
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
    expectFields({ name: "", phone: "", email: "", message: "" }); // «vacía el formulario»: lo dice el título
  });

  it("honeypot lleno por el autocompletado: no se envía, no hay éxito falso, el campo se vacía y el reintento envía sin él", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const { container } = render(<ContactForm idPrefix="h" />);
    fill(TYPED);
    const trap = container.querySelector('input[name="ms_hp"]') as HTMLInputElement;
    fireEvent.change(trap, { target: { value: "http://autofill.example.test" } });
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(GENERIC); // el genérico, y ninguno de los otros tres
    for (const other of otherTexts(GENERIC)) expect(screen.queryByText(other)).toBeNull();
    expect(screen.queryByText(SENT)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    expect(trap.value).toBe("");
    expectFields(TYPED); // lo tecleado se conserva; solo el campo trampa se vacía

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
  ])("%s: un solo aviso, el suyo exacto, y los cuatro datos tecleados se conservan", async (_case, error, expected) => {
    invoke.mockResolvedValue({ data: null, error });
    render(<ContactForm idPrefix="e" />);
    fill(TYPED);
    submit();
    const alert = await screen.findByRole("alert"); // falla si hay más de un aviso
    expect(alert.textContent).toBe(expected); // el texto completo, no un fragmento
    const others = otherTexts(expected);
    expect(others).toHaveLength(3); // si dos avisos fueran iguales, la comprobación de abajo pasaría en vacío
    for (const other of others) {
      expect(screen.queryByText(other)).toBeNull();
      expect(alert).not.toHaveTextContent(other);
    }
    expect(screen.queryByText(SENT)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expectFields(TYPED);
  });

  it("un mismo formulario, respuesta tras respuesta: 400, 429 y 503 muestran el suyo y nunca el genérico; 401, 405, 500 y la red, el genérico y nunca el de otro", async () => {
    render(<ContactForm idPrefix="q" />);
    fill(TYPED);
    const steps: Array<[string, unknown, string]> = [
      ["400", httpError(400), INVALID],
      ["429", httpError(429), RATE_LIMITED],
      ["503", httpError(503), UNAVAILABLE],
      ["500", httpError(500), GENERIC],
      ["401", httpError(401), GENERIC],
      ["405", httpError(405), GENERIC],
      ["red", networkError(), GENERIC],
      ["503 otra vez", httpError(503), UNAVAILABLE],
      ["400 otra vez", httpError(400), INVALID],
    ];
    for (const [index, [label, error, expected]] of steps.entries()) {
      invoke.mockResolvedValueOnce({ data: null, error });
      submit();
      const alert = await screen.findByRole("alert");
      expect(alert.textContent, label).toBe(expected);
      expect(screen.getAllByRole("alert"), label).toHaveLength(1); // el aviso anterior no se acumula
      for (const other of otherTexts(expected)) expect(screen.queryByText(other), `${label}: ${other}`).toBeNull();
      expect(invoke, label).toHaveBeenCalledTimes(index + 1);
      expectFields(TYPED);
    }
  });

  it.each([
    ["Nombre completo", "Ana\u0000", UNSAFE],
    ["Número de teléfono (opcional)", "+504 0000\u0008-0001", UNSAFE],
    ["Correo electrónico (opcional)", "a@example.test\u007f", UNSAFE],
    ["Mensaje", "Mensaje\u001f de prueba", UNSAFE],
  ])("pegar un carácter de control en «%s»: el mismo aviso, solo en ese campo, foco ahí y nada se envía", (label, bad, text) => {
    render(<ContactForm idPrefix="c" />);
    fill({ email: "ana@example.test" });
    fireEvent.change(screen.getByLabelText(label), { target: { value: bad } });
    submit();
    // El texto es el mismo para los cuatro campos: qué campo lo tiene lo dicen el aviso único, aria-invalid y la descripción.
    expect(screen.getAllByText(text)).toHaveLength(1);
    expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(text);
    expect(screen.getAllByRole("textbox").filter((el) => el.getAttribute("aria-invalid") === "true")).toHaveLength(1);
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

  // El cerrojo también se libera tras un ÉXITO. Después de enviar, el formulario muestra el aviso de éxito en lugar del botón;
  // un CTA de servicio (la prop `prefill`) lo vuelve a abrir y el siguiente envío tiene que llegar al servidor. Un cerrojo
  // liberado solo en el camino de error dejaría ese segundo envío sin llamada y sin aviso.
  it("tras un envío con éxito, un CTA de servicio (prefill) reabre el formulario y el segundo envío llega al servidor", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const { rerender } = render(<ContactForm idPrefix="k" />);
    fill(TYPED);
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);

    const PREFILL = "Quiero una tienda en línea con pagos";
    rerender(<ContactForm idPrefix="k" prefill={{ text: PREFILL, nonce: 1 }} />);
    expect(screen.queryByText(SENT)).toBeNull();
    expect(screen.getByLabelText(LABELS.message)).toHaveValue(PREFILL);
    fireEvent.change(screen.getByLabelText(LABELS.name), { target: { value: TYPED.name } });
    fireEvent.change(screen.getByLabelText(LABELS.phone), { target: { value: TYPED.phone } });
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1][1].body).toEqual({ name: TYPED.name, phone: TYPED.phone, message: PREFILL });
  });

  // El cerrojo del envío (sendingRef) solo puede tomarse cuando ya se decidió enviar. Si se tomara antes de validar, un
  // intento detenido por la validación lo dejaría tomado (nadie lo libera: no hay `await` ni `finally`) y corregir los campos
  // y reenviar no llamaría al servidor, sin ningún aviso. Se recorre el camino completo en UN formulario montado.
  it("enviar con errores de validación, corregir los campos y reenviar en el mismo formulario: 0 llamadas con errores y exactamente 1 al corregir", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    render(<ContactForm idPrefix="v" />);
    const field = (key: keyof typeof LABELS) => screen.getByLabelText(LABELS[key]);
    const type = (key: keyof typeof LABELS, value: string) => fireEvent.change(field(key), { target: { value } });

    // 1. Vacío: se ven los errores, el foco va al nombre y no hay llamada.
    submit();
    expect(screen.getByText("Escribe tu nombre completo.")).toBeInTheDocument();
    expect(screen.getByText("Déjanos un teléfono o un correo para responderte.")).toBeInTheDocument();
    expect(screen.getByText("Cuéntanos un poco más.")).toBeInTheDocument();
    expect(document.activeElement).toBe(field("name"));
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();

    // 2. Corrección a medias (queda un correo mal escrito): solo ese error, el foco va ahí y sigue sin haber llamada.
    type("name", TYPED.name);
    type("message", TYPED.message);
    type("email", "visitante.prueba@");
    submit();
    expect(screen.getByText("Revisa el correo electrónico.")).toBeInTheDocument();
    expect(screen.queryByText("Escribe tu nombre completo.")).toBeNull();
    expect(screen.queryByText("Cuéntanos un poco más.")).toBeNull();
    expect(document.activeElement).toBe(field("email"));
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();

    // 3. Todo corregido: los avisos desaparecen y el reenvío hace exactamente una llamada y muestra el éxito.
    type("email", TYPED.email);
    expect(screen.queryByText("Revisa el correo electrónico.")).toBeNull();
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe("send-contact-email");
    expect(invoke.mock.calls[0][1].body).toEqual({ name: TYPED.name, email: TYPED.email, message: TYPED.message });
    expect(screen.queryByRole("alert")).toBeNull();
    expectFields({ name: "", phone: "", email: "", message: "" });
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

  // The cases above let React repaint between the two attempts (fireEvent wraps each one in act), so the disabled button
  // and the "loading" state are already there. Here both submit events arrive in the same instant, in a single act, with
  // no repaint in between: what stops the second one cannot be state that React has not committed yet.
  async function submitTwiceInTheSameInstant(): Promise<(v: unknown) => void> {
    let release!: (v: unknown) => void;
    invoke.mockImplementation(() => new Promise((resolve) => (release = resolve)));
    render(<ContactForm idPrefix="i" />);
    fill();
    const form = screen.getByLabelText("Nombre completo").closest("form") as HTMLFormElement;
    act(() => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    return release;
  }

  // Control: the setup is sound (the events do reach the form and send), so the test below can only fail because of the
  // number of calls and not because of a typo in its setup.
  it("control: los dos eventos submit del mismo instante llegan al formulario y envían", async () => {
    await submitTwiceInTheSameInstant();
    expect(invoke.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  });

  // Doble envío en el mismo instante (defecto hallado en L5 P2, corregido en L5 P4, 2026-11-08): `status === "loading"`
  // lee el estado de React ya pintado, así que dos eventos submit en una misma tarea (dos `form.requestSubmit()` o dos
  // `.click()`, sin microtarea entre ellos) veían los dos `status === "idle"` y llamaban dos veces a la función. Un clic
  // doble de una persona nunca lo dispara (cada clic es una tarea y React pinta entre ambos). ContactForm.handleSubmit
  // lo evita con un `useRef` como cerrojo síncrono: esta prueba exige una sola llamada.
  it("dos eventos submit en el mismo instante, sin repintado entre ellos: una sola llamada", async () => {
    const release = await submitTwiceInTheSameInstant();
    expect(invoke).toHaveBeenCalledTimes(1);
    await act(async () => {
      release({ data: { ok: true }, error: null });
    });
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("mensaje de más de 5000 caracteres: sin maxLength el valor no se recorta y la validación avisa", () => {
  const TOO_LONG = "El mensaje supera el límite permitido. Resúmelo e inténtalo de nuevo.";
  const OK = { data: { ok: true }, error: null };
  const sentences = "Necesito una web con tienda. "; // 29 caracteres
  /** Un pegado realista (palabras y espacios), sin espacio en ninguno de los extremos y de exactamente `n` caracteres. */
  const paste = (n: number) => sentences.repeat(Math.ceil(n / sentences.length)).slice(0, n - 1) + ".";
  const area = () => screen.getByLabelText("Mensaje") as HTMLTextAreaElement;

  // fireEvent.change fija el valor de golpe, como un pegado. jsdom no aplica `maxlength` a un valor puesto por programa, así
  // que lo que impide el recorte en un navegador real es la AUSENCIA del atributo (ver «topes de longitud»), y lo que
  // comprueban estas pruebas es que el componente tampoco lo recorta ni lo envía.
  it("helper: el pegado mide lo que dice y no empieza ni termina en espacio", () => {
    for (const n of [5000, 5001, 12000]) {
      expect(paste(n)).toHaveLength(n);
      expect(paste(n)).toBe(paste(n).trim());
    }
  });

  it("pegar más de 5000 caracteres: aviso exacto, foco en el mensaje, 0 llamadas, botón habilitado y valor completo; con 5000 exactos se envía una sola vez", async () => {
    invoke.mockResolvedValue(OK);
    render(<ContactForm idPrefix="g" />);
    fill(TYPED);
    const pasted = paste(12000);
    fireEvent.change(area(), { target: { value: pasted } });
    submit();

    expect(screen.getByText(TOO_LONG)).toBeInTheDocument(); // un solo aviso, con el texto aprobado
    expect(area()).toHaveAttribute("aria-invalid", "true");
    expect(area()).toHaveAccessibleDescription(TOO_LONG);
    expect(screen.getAllByRole("textbox").filter((el) => el.getAttribute("aria-invalid") === "true")).toHaveLength(1);
    expect(document.activeElement).toBe(area());
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
    expect(area().value).toHaveLength(12000); // no se recorta
    expectFields({ ...TYPED, message: pasted });

    // Se reduce a 5000 exactos: el aviso se va solo y el reenvío hace exactamente una llamada.
    fireEvent.change(area(), { target: { value: paste(5000) } });
    expect(screen.queryByText(TOO_LONG)).toBeNull();
    expect(area()).toHaveAttribute("aria-invalid", "false");
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body).toEqual({ name: TYPED.name, phone: TYPED.phone, email: TYPED.email, message: paste(5000) });
    expect(invoke.mock.calls[0][1].body.message).toHaveLength(5000);
  });

  // La frontera se mide sobre el mensaje ya recortado de espacios, igual que en el servidor (lead.ts: trim() y luego length).
  it.each([
    ["5001 caracteres", paste(5001)],
    ["5001 caracteres con espacios y saltos de línea alrededor", `  \n${paste(5001)}\t \n`],
    ["100 000 caracteres", paste(100000)],
  ])("%s: no se envía, se avisa en el mensaje y el valor queda completo", (_case, message) => {
    invoke.mockResolvedValue(OK);
    render(<ContactForm idPrefix="b" />);
    fill(TYPED);
    fireEvent.change(area(), { target: { value: message } });
    submit();
    expect(screen.getByText(TOO_LONG)).toBeInTheDocument();
    expect(document.activeElement).toBe(area());
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeEnabled();
    expect(area().value === message).toBe(true); // sin recorte (comparación booleana: un fallo no vuelca 100 000 caracteres)
  });

  it.each([
    ["5000 caracteres exactos", paste(5000)],
    ["5000 caracteres con espacios y saltos de línea alrededor (se miden recortados)", `  \n${paste(5000)}\t \n`],
    ["5000 caracteres seguidos de 500 espacios de relleno", `${paste(5000)}${" ".repeat(500)}`],
  ])("%s: se envía una sola vez, recortado a 5000", async (_case, message) => {
    invoke.mockResolvedValue(OK);
    render(<ContactForm idPrefix="p" />);
    fill(TYPED);
    fireEvent.change(area(), { target: { value: message } });
    submit();
    expect(await screen.findByText(SENT)).toBeInTheDocument();
    expect(screen.queryByText(TOO_LONG)).toBeNull();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][1].body.message === paste(5000)).toBe(true);
  });
});

describe("sin detalles internos: aunque el servidor devuelva texto interno, en pantalla solo el texto fijo", () => {
  // Pieces a visitor must never read. No quotes, angle brackets or ampersands, so they survive innerHTML unescaped.
  const INTERNAL = [
    "SQLSTATE 23505",
    "duplicate key value violates unique constraint tickets_pkey",
    "RESEND_API_KEY",
    "service_role",
    "at checkLead (lead.ts:42:7)",
    "10.0.0.7",
  ];
  const LEAK = INTERNAL.join(" / ");
  // What the supabase-js wrapper adds on its own: its messages and class names are internal too.
  const WRAPPER = ["Edge Function", "non-2xx", "Failed to fetch", "FunctionsHttpError", "FunctionsFetchError", "FunctionsRelayError", "FunctionsError"];

  const httpWithBody = (status: number) =>
    Object.assign(new Error(LEAK), {
      name: "FunctionsHttpError",
      context: new Response(JSON.stringify({ error: LEAK, detail: LEAK }), { status, statusText: LEAK }),
    });

  it.each([
    ["400", () => httpWithBody(400), INVALID],
    ["429", () => httpWithBody(429), RATE_LIMITED],
    ["503", () => httpWithBody(503), UNAVAILABLE],
    ["500", () => httpWithBody(500), GENERIC],
    ["401", () => httpWithBody(401), GENERIC],
    ["405", () => httpWithBody(405), GENERIC],
    [
      "fallo de red con el texto interno en el mensaje y en la causa",
      () => Object.assign(new Error(LEAK), { name: "FunctionsFetchError", context: new TypeError(LEAK), cause: LEAK }),
      GENERIC,
    ],
    // Un error que no trae la respuesta HTTP (la clase base FunctionsError admite un `context` ausente). NO es la forma de
    // un error de la pasarela: ese lleva siempre la respuesta, ver los dos casos siguientes.
    [
      "error que no trae respuesta HTTP (sin `context`)",
      () => Object.assign(new Error(LEAK), { name: "FunctionsError" }),
      GENERIC,
    ],
    // Forma real de @supabase/functions-js: FunctionsRelayError(response), con la respuesta en `context` y la cabecera
    // `x-relay-error: true`. El código se guía por el ESTADO de esa respuesta, igual que con FunctionsHttpError: 503 es el
    // aviso de «no disponible», cualquier otro estado el genérico, y nunca el texto del servidor.
    [
      "error de la pasarela con su forma real (FunctionsRelayError, respuesta 503 con x-relay-error en `context`)",
      () =>
        Object.assign(new Error(LEAK), {
          name: "FunctionsRelayError",
          context: new Response(null, { status: 503, headers: { "x-relay-error": "true" } }),
        }),
      UNAVAILABLE,
    ],
    [
      "error de la pasarela con su forma real y otro estado (FunctionsRelayError, respuesta 500)",
      () =>
        Object.assign(new Error(LEAK), {
          name: "FunctionsRelayError",
          context: new Response(null, { status: 500, headers: { "x-relay-error": "true" } }),
        }),
      GENERIC,
    ],
  ])("%s: el aviso es el texto fijo y nada interno llega a la pantalla", async (_case, makeError, expected) => {
    invoke.mockResolvedValue({ data: null, error: makeError() });
    render(<ContactForm idPrefix="x" />);
    fill(TYPED);
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(expected);
    const shown = `${document.body.textContent}\n${document.body.innerHTML}`; // texto y atributos (title, aria-label…)
    for (const piece of [...INTERNAL, ...WRAPPER]) expect(shown, piece).not.toContain(piece);
  });

  it("si la invocación misma lanza (no devuelve error) con texto interno, también sale solo el genérico", async () => {
    invoke.mockRejectedValue(new Error(LEAK));
    render(<ContactForm idPrefix="y" />);
    fill(TYPED);
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(GENERIC);
    const shown = `${document.body.textContent}\n${document.body.innerHTML}`;
    for (const piece of INTERNAL) expect(shown, piece).not.toContain(piece);
  });
});
