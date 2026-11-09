import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: vi.fn().mockResolvedValue(undefined) };
});

import ContactForm from "@/components/marketing/ContactForm";
import { ContactUnavailableError, isValidPhone, normalizeContact, sendContactMessage, validateContact } from "@/lib/contact";

const base = { name: "Ana López", phone: "", email: "", message: "Quiero automatizar facturas" };

// Fixed texts of the form (the three the 503 test tells apart).
const GENERIC = "No pudimos enviar tu mensaje. Inténtalo de nuevo.";
const RATE_LIMITED = "Has alcanzado el límite de envíos. Inténtalo de nuevo más tarde.";
const UNAVAILABLE = "El formulario no está disponible temporalmente. Inténtalo de nuevo más tarde.";

describe("validateContact", () => {
  it("exige nombre y mensaje", () => {
    const e = validateContact({ ...base, name: " ", message: "hey", phone: "99999999" });
    expect(e.name).toBeDefined();
    expect(e.message).toBeDefined();
  });

  it("teléfono y correo son opcionales, pero se necesita al menos uno", () => {
    expect(validateContact(base).contact).toBeDefined();
    expect(validateContact({ ...base, phone: "+504 9999-9999" })).toEqual({});
    expect(validateContact({ ...base, email: "ana@example.test" })).toEqual({});
  });

  it("valida formato solo cuando el campo opcional tiene valor", () => {
    expect(validateContact({ ...base, email: "ana@", phone: "9999-9999" }).email).toBeDefined();
    expect(validateContact({ ...base, phone: "abc123" }).phone).toBeDefined();
    expect(isValidPhone("9999-9999")).toBe(true); // 8 dígitos (HN)
    expect(isValidPhone("123")).toBe(false);
  });

  it("limita la longitud del mensaje (S4)", () => {
    const ok = { ...base, phone: "9999-9999" };
    expect(validateContact({ ...ok, message: "x".repeat(5000) }).message).toBeUndefined();
    expect(validateContact({ ...ok, message: "x".repeat(5001) }).message).toBe("El mensaje supera el límite permitido. Resúmelo e inténtalo de nuevo.");
  });
});

describe("normalizeContact", () => {
  it("recorta, normaliza el correo y omite opcionales vacíos", () => {
    expect(normalizeContact({ name: " Ana ", phone: "  ", email: " Ana@Example.TEST ", message: " hola mundo " })).toEqual({
      name: "Ana",
      email: "ana@example.test",
      message: "hola mundo",
    });
  });

  it("solo envía el honeypot cuando tiene contenido (S4)", () => {
    expect(normalizeContact({ ...base, website: "  " })).not.toHaveProperty("website");
    expect(normalizeContact({ ...base, website: "http://spam" }).website).toBe("http://spam");
  });
});

describe("ContactForm", () => {
  // The mock is module-wide: without this, "was not called" / "was called with" depend on which test ran before.
  beforeEach(() => {
    const send = vi.mocked(sendContactMessage);
    send.mockReset();
    send.mockResolvedValue(undefined);
  });

  it("el honeypot queda fuera del orden de tabulación y oculto a lectores de pantalla (S4)", () => {
    const { container } = render(<ContactForm idPrefix="h" />);
    const trap = container.querySelector<HTMLInputElement>('input[name="ms_hp"]');
    expect(trap).not.toBeNull();
    expect(trap?.tabIndex).toBe(-1);
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("muestra los errores al intentar enviar vacío y enfoca el nombre", () => {
    render(<ContactForm idPrefix="c" />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(screen.getByText("Escribe tu nombre completo.")).toBeInTheDocument();
    expect(screen.getByText("Déjanos un teléfono o un correo para responderte.")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));
    expect(sendContactMessage).not.toHaveBeenCalled();
  });

  it("ante un 503 muestra el aviso de servicio no disponible, distinto del error genérico y del límite", async () => {
    vi.mocked(sendContactMessage).mockRejectedValueOnce(new ContactUnavailableError());
    render(<ContactForm idPrefix="u" />);
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana López" } });
    fireEvent.change(screen.getByLabelText("Número de teléfono (opcional)"), { target: { value: "+504 9999-9999" } });
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Quiero un agente RAG" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    const alert = await screen.findByRole("alert");
    // Exactly its own text (not just a fragment of it), and neither the generic one nor the rate-limit one.
    expect(alert.textContent).toBe(UNAVAILABLE);
    expect(alert).not.toHaveTextContent(GENERIC);
    expect(alert).not.toHaveTextContent(RATE_LIMITED);
    expect(screen.queryByText(/¡Mensaje enviado!/)).toBeNull();
    // Los datos tecleados se conservan para reintentar más tarde.
    expect(screen.getByLabelText("Nombre completo")).toHaveValue("Ana López");
    expect(screen.getByLabelText("Número de teléfono (opcional)")).toHaveValue("+504 9999-9999");
    expect(screen.getByLabelText("Correo electrónico (opcional)")).toHaveValue("");
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Quiero un agente RAG");
  });

  it("envía nombre + teléfono sin correo", async () => {
    render(<ContactForm idPrefix="c" />);
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana López" } });
    fireEvent.change(screen.getByLabelText("Número de teléfono (opcional)"), { target: { value: "+504 9999-9999" } });
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Quiero un agente RAG" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("¡Mensaje enviado!"));
    expect(sendContactMessage).toHaveBeenCalledWith({
      name: "Ana López",
      phone: "+504 9999-9999",
      email: "",
      message: "Quiero un agente RAG",
    });
  });
});
