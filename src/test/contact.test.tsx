import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: vi.fn().mockResolvedValue(undefined) };
});

import ContactForm from "@/components/marketing/ContactForm";
import { isValidPhone, normalizeContact, sendContactMessage, validateContact } from "@/lib/contact";

const base = { name: "Ana López", phone: "", email: "", message: "Quiero automatizar facturas" };

describe("validateContact", () => {
  it("exige nombre y mensaje", () => {
    const e = validateContact({ ...base, name: " ", message: "hey", phone: "99999999" });
    expect(e.name).toBeDefined();
    expect(e.message).toBeDefined();
  });

  it("teléfono y correo son opcionales, pero se necesita al menos uno", () => {
    expect(validateContact(base).contact).toBeDefined();
    expect(validateContact({ ...base, phone: "+504 9999-9999" })).toEqual({});
    expect(validateContact({ ...base, email: "ana@empresa.hn" })).toEqual({});
  });

  it("valida formato solo cuando el campo opcional tiene valor", () => {
    expect(validateContact({ ...base, email: "ana@", phone: "9999-9999" }).email).toBeDefined();
    expect(validateContact({ ...base, phone: "abc123" }).phone).toBeDefined();
    expect(isValidPhone("9999-9999")).toBe(true); // 8 dígitos (HN)
    expect(isValidPhone("123")).toBe(false);
  });
});

describe("normalizeContact", () => {
  it("recorta, normaliza el correo y omite opcionales vacíos", () => {
    expect(normalizeContact({ name: " Ana ", phone: "  ", email: " Ana@Empresa.HN ", message: " hola mundo " })).toEqual({
      name: "Ana",
      email: "ana@empresa.hn",
      message: "hola mundo",
    });
  });
});

describe("ContactForm", () => {
  it("muestra los errores al intentar enviar vacío y enfoca el nombre", () => {
    render(<ContactForm idPrefix="c" />);
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
    expect(screen.getByText("Escribe tu nombre completo.")).toBeInTheDocument();
    expect(screen.getByText("Déjanos un teléfono o un correo para responderte.")).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));
    expect(sendContactMessage).not.toHaveBeenCalled();
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
