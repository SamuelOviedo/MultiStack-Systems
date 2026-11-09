// SubTicketForm: etiquetas enlazadas, nombres accesibles, límites de la base de datos, estado de
// guardado y errores sin texto técnico. (Las reglas de negocio las fija `tickets-subticket-characterization`.)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));
const libs = vi.hoisted(() => ({ createProjectTicket: vi.fn() }));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  ...libs,
}));

import SubTicketForm from "@/components/dashboard/project-detail/SubTicketForm";

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
  toastSpy.mockReset();
  libs.createProjectTicket.mockReset().mockResolvedValue(undefined);
});
afterEach(() => cleanup());

const abrir = () => {
  render(<SubTicketForm projectId="proj-1" onCreated={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Nuevo ticket" }));
  return within(screen.getByRole("form", { name: "Nuevo ticket del proyecto" }));
};

describe("SubTicketForm · accesibilidad", () => {
  it("el formulario tiene nombre y cada campo, una etiqueta visible enlazada", () => {
    const form = abrir();
    expect(form.getByLabelText("Título")).toBeInstanceOf(HTMLInputElement);
    expect(form.getByRole("combobox", { name: "Tipo" })).toBeInTheDocument();
    expect(form.getByRole("combobox", { name: "Prioridad" })).toBeInTheDocument();
    expect(form.getByLabelText(/Detalle/)).toBeInstanceOf(HTMLTextAreaElement);
    expect(form.getByText("(opcional)")).toBeInTheDocument();
  });

  it("respeta los límites de la base de datos (título ≤ 200, detalle ≤ 10 000)", () => {
    const form = abrir();
    expect(form.getByLabelText("Título")).toHaveAttribute("maxlength", "200");
    expect(form.getByLabelText(/Detalle/)).toHaveAttribute("maxlength", "10000");
  });

  it("el título recibe el foco al abrir y «Crear ticket» está desactivado hasta tener 3 letras", () => {
    const form = abrir();
    expect(form.getByLabelText("Título")).toHaveFocus();
    expect(form.getByRole("button", { name: "Crear ticket" })).toBeDisabled();
    fireEvent.change(form.getByLabelText("Título"), { target: { value: "Hola" } });
    expect(form.getByRole("button", { name: "Crear ticket" })).toBeEnabled();
  });

  it("tipo y prioridad muestran su valor actual con texto", () => {
    const form = abrir();
    expect(form.getByRole("combobox", { name: "Tipo" })).toHaveTextContent("Modificación");
    expect(form.getByRole("combobox", { name: "Prioridad" })).toHaveTextContent("Media");
  });

  it("el botón que lo abre es un botón real con texto (no un div ni solo un «+»)", () => {
    render(<SubTicketForm projectId="proj-1" onCreated={vi.fn()} />);
    const boton = screen.getByRole("button", { name: "Nuevo ticket" });
    expect(boton.tagName).toBe("BUTTON");
    expect(boton).toHaveAttribute("type", "button");
  });
});

describe("SubTicketForm · errores y guardado", () => {
  it("un error muestra un aviso en español y nunca el texto técnico", async () => {
    libs.createProjectTicket.mockRejectedValue(new Error('new row violates row-level security policy for table "tickets"'));
    const form = abrir();
    fireEvent.change(form.getByLabelText("Título"), { target: { value: "Tarea nueva" } });
    fireEvent.click(form.getByRole("button", { name: "Crear ticket" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    const aviso = toastSpy.mock.calls.at(-1)![0];
    expect(aviso).toMatchObject({ variant: "destructive", description: "No se pudo completar la acción. Inténtalo de nuevo." });
    expect(JSON.stringify(aviso)).not.toMatch(/row-level|security|tickets"/);
  });

  it("un error de permisos lo dice distinto", async () => {
    libs.createProjectTicket.mockRejectedValue(Object.assign(new Error("rls"), { code: "42501" }));
    const form = abrir();
    fireEvent.change(form.getByLabelText("Título"), { target: { value: "Tarea nueva" } });
    fireEvent.click(form.getByRole("button", { name: "Crear ticket" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ description: "No tienes permiso para hacer esto." })), WAIT);
  });

  it("mientras guarda, «Creando…» y los dos botones desactivados", async () => {
    let fin!: () => void;
    libs.createProjectTicket.mockReturnValue(new Promise<void>((r) => (fin = r)));
    const form = abrir();
    fireEvent.change(form.getByLabelText("Título"), { target: { value: "Tarea nueva" } });
    fireEvent.click(form.getByRole("button", { name: "Crear ticket" }));
    expect(await form.findByRole("button", { name: "Creando…" })).toBeDisabled();
    expect(form.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fin();
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull(), WAIT);
  });
});
