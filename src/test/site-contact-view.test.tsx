import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));

// Como en site-views y contact: solo se simula la red (la Edge Function) y la conversión de Ads; el formulario es el real.
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: send };
});
vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, trackContactConversion: vi.fn() };
});

import Contacto from "@/pages/marketing/Contacto";

// El diseño de referencia abría WhatsApp con el mensaje escrito en su formulario. Aquí el formulario es el nuestro: envía por
// la Edge Function, y WhatsApp es solo uno de los canales alternativos. Esta prueba fija esa diferencia.

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

const renderContacto = () =>
  render(
    <MemoryRouter initialEntries={["/contacto"]}>
      <Contacto />
      <Where />
    </MemoryRouter>,
  );

const fill = (label: RegExp | string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  send.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/contacto: el formulario es el nuestro, no el de WhatsApp de la referencia", () => {
  it("no dice que se abrirá WhatsApp, ni en el formulario ni en ninguna parte de la vista", () => {
    renderContacto();
    expect(document.body.textContent).not.toMatch(/se abrir[aá] whatsapp/i);
    expect(document.body.textContent).not.toMatch(/abrir[aá]? (el )?chat/i);
  });

  it("el formulario trae los cuatro campos de ContactForm, el honeypot oculto y un solo botón de envío", () => {
    const { container } = renderContacto();
    const form = container.querySelector("form")!;
    expect(form).not.toBeNull();
    expect(form).toHaveAttribute("novalidate");
    for (const label of ["Nombre completo", /Número de teléfono/, /Correo electrónico/, "Mensaje"]) {
      expect(within(form).getByLabelText(label)).toBeInTheDocument();
    }
    expect(form.querySelector('input[name="ms_hp"]')?.closest('[aria-hidden="true"]')).not.toBeNull();
    const submits = within(form).getAllByRole("button");
    expect(submits).toHaveLength(1);
    expect(submits[0]).toHaveAccessibleName("Enviar mensaje");
    expect(submits[0]).toHaveAttribute("type", "submit");
    // El formulario no contiene enlaces ni apunta a otro sitio: lo único que hace es enviar por la Edge Function.
    expect(within(form).queryAllByRole("link")).toHaveLength(0);
    expect(form).not.toHaveAttribute("action");
  });

  it("enviar no abre WhatsApp ni ninguna otra ventana, y la vista se queda en /contacto", async () => {
    send.mockResolvedValue(undefined);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderContacto();
    fill("Nombre completo", "Visitante PRUEBA");
    fill(/Número de teléfono/, "+504 0000-0001");
    fill("Mensaje", "Mensaje de PRUEBA: quiero cotizar una pagina");
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    expect(await screen.findByText("¡Mensaje enviado! Te responderemos a la brevedad.")).toBeInTheDocument();
    expect(send).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByTestId("where")).toHaveTextContent("/contacto");
  });

  it("WhatsApp es un canal alternativo: un enlace que abre en pestaña nueva, fuera del formulario", () => {
    const { container } = renderContacto();
    const link = screen.getByRole("link", { name: /Escríbenos por WhatsApp/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName(/se abre en una pestaña nueva/);
    expect(container.querySelector("form")!.contains(link)).toBe(false);
  });

  it("el nombre de cada campo es único: los ids llevan el prefijo de la vista y no chocan con otros formularios", () => {
    const { container } = renderContacto();
    const ids = [...container.querySelectorAll("form [id]")].map((el) => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^contacto-/);
  });
});
