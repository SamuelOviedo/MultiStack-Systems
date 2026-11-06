// Caracterización: el formulario de sub-tickets (`SubTicketForm`) y la apertura del `TicketDrawer`
// desde el detalle de proyecto (`ContentTabs`, pestaña Tickets). Se escribió contra el código anterior; solo los
// textos y el marcado que cambian a propósito viven en `ADAPTADOR`.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

const auth = vi.hoisted(() => ({
  session: null as unknown,
  user: null as { id: string; email: string } | null,
  userType: 0 as number | null,
  loading: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));

const libs = vi.hoisted(() => ({
  createProjectTicket: vi.fn(),
  getTicketMessages: vi.fn(),
  addTeamMessage: vi.fn(),
  updateTicketStatus: vi.fn(),
  updateTicketPriority: vi.fn(),
  assignTicket: vi.fn(),
  notifyTeamReply: vi.fn(),
  getTeamMembers: vi.fn(),
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  ...libs,
}));

import SubTicketForm from "@/components/dashboard/project-detail/SubTicketForm";
import ContentTabs from "@/components/dashboard/project-detail/ContentTabs";

const ADAPTADOR = {
  /** Botón que abre el formulario («+ nuevo ticket del proyecto» pasa a «Nuevo ticket»). */
  abrir: /nuevo ticket/i,
  /** «[ CREAR ]» pasa a «Crear ticket» y «Creando...» a «Creando…». */
  crear: /crear ticket/i,
  /** Mientras guarda el botón cambia de texto («Creando…»). */
  creando: /creando/i,
  cancelar: /cancelar/i,
  /** El formulario (único `<form>` de la pantalla). */
  form: () => document.querySelector("form") as HTMLFormElement,
  /**
   * Los dos `<select>` nativos sin etiqueta pasan a selectores con etiqueta visible («Tipo», «Prioridad»)
   * y nombre accesible (rol combobox).
   */
  select: (campo: "tipo" | "prioridad") => screen.getByRole("combobox", { name: campo === "tipo" ? "Tipo" : "Prioridad" }),
  elegir(campo: "tipo" | "prioridad", opcion: string) {
    fireEvent.keyDown(ADAPTADOR.select(campo), { key: "ArrowDown" });
    fireEvent.click(screen.getAllByRole("option").find((x) => x.textContent === opcion)!);
  },
  opciones(campo: "tipo" | "prioridad") {
    fireEvent.keyDown(ADAPTADOR.select(campo), { key: "ArrowDown" });
    const out = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    return out;
  },
  valor: (campo: "tipo" | "prioridad") => ADAPTADOR.select(campo).textContent ?? "",
  titulo: () => within(ADAPTADOR.form()).getAllByRole("textbox")[0] as HTMLInputElement,
  detalle: () => within(ADAPTADOR.form()).getAllByRole("textbox")[1] as HTMLTextAreaElement,
  avisoCreado: { title: "Ticket creado", description: "Micro-ticket añadido al proyecto." },
};

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

beforeEach(() => {
  auth.userType = 0;
  auth.user = { id: "u-admin", email: "persona@example.test" };
  toastSpy.mockReset();
  libs.createProjectTicket.mockReset().mockResolvedValue(undefined);
  libs.getTicketMessages.mockReset().mockResolvedValue([]);
  libs.addTeamMessage.mockReset().mockResolvedValue("m-nuevo");
  libs.updateTicketStatus.mockReset().mockResolvedValue(undefined);
  libs.updateTicketPriority.mockReset().mockResolvedValue(undefined);
  libs.assignTicket.mockReset().mockResolvedValue(undefined);
  libs.notifyTeamReply.mockReset().mockResolvedValue(true);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});
afterEach(() => cleanup());

describe("SubTicketForm", () => {
  const montar = (onCreated = vi.fn()) => {
    render(<SubTicketForm projectId="proj-1" onCreated={onCreated} />);
    return onCreated;
  };
  const abrir = () => fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.abrir }));

  it("empieza cerrado: solo el botón que lo abre", () => {
    montar();
    expect(screen.getByRole("button", { name: ADAPTADOR.abrir })).toBeInTheDocument();
    expect(document.querySelector("form")).toBeNull();
  });

  it("al abrir pone el foco en el título y parte de «Modificación» y «Media»", () => {
    montar();
    abrir();
    expect(ADAPTADOR.titulo()).toHaveFocus();
    expect(ADAPTADOR.valor("tipo")).toBe("Modificación");
    expect(ADAPTADOR.valor("prioridad")).toBe("Media");
  });

  it("los tipos son los del dominio SIN «Solicitud de Proyecto»; las prioridades, las cuatro", () => {
    montar();
    abrir();
    expect(ADAPTADOR.opciones("tipo")).toEqual(["Modificación", "Bug / Error", "Consulta", "Pago", "Mantenimiento", "Otro"]);
    expect(ADAPTADOR.opciones("prioridad")).toEqual(["Baja", "Media", "Alta", "Urgente"]);
  });

  it("no deja crear con menos de 3 letras (contando sin espacios) ni con el título en blanco", () => {
    montar();
    abrir();
    const crear = screen.getByRole("button", { name: ADAPTADOR.crear });
    expect(crear).toBeDisabled();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "ab" } });
    expect(crear).toBeDisabled();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "  ab  " } });
    expect(crear).toBeDisabled();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "abc" } });
    expect(crear).toBeEnabled();
  });

  it("enviar con Enter un título demasiado corto no crea nada", () => {
    montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "  ab  " } });
    fireEvent.submit(ADAPTADOR.form());
    expect(libs.createProjectTicket).not.toHaveBeenCalled();
  });

  it("crea con título recortado, tipo y prioridad elegidos, avisa, avisa al padre y se cierra", async () => {
    const onCreated = montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "  Diseño del módulo de pagos  " } });
    ADAPTADOR.elegir("tipo", "Pago");
    ADAPTADOR.elegir("prioridad", "Alta");
    fireEvent.change(ADAPTADOR.detalle(), { target: { value: "  Detalle  " } });
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.crear }));
    await waitFor(() => expect(libs.createProjectTicket).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.createProjectTicket).toHaveBeenCalledWith("proj-1", {
      type: "pago", priority: "alta", title: "Diseño del módulo de pagos", description: "Detalle",
    });
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(ADAPTADOR.avisoCreado), WAIT);
    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(document.querySelector("form")).toBeNull();
  });

  it("sin detalle manda `description: undefined`", async () => {
    montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "Solo título" } });
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.crear }));
    await waitFor(() => expect(libs.createProjectTicket).toHaveBeenCalled(), WAIT);
    expect(libs.createProjectTicket).toHaveBeenCalledWith("proj-1", {
      type: "modificacion", priority: "media", title: "Solo título", description: undefined,
    });
  });

  it("al volver a abrir tras crear, los campos están vacíos y con los valores por defecto", async () => {
    montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "Primero" } });
    ADAPTADOR.elegir("prioridad", "Urgente");
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.crear }));
    await waitFor(() => expect(document.querySelector("form")).toBeNull(), WAIT);
    abrir();
    expect(ADAPTADOR.titulo()).toHaveValue("");
    expect(ADAPTADOR.valor("prioridad")).toBe("Media");
    expect(ADAPTADOR.valor("tipo")).toBe("Modificación");
  });

  it("cancelar cierra sin crear nada", () => {
    montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "No se crea" } });
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.cancelar }));
    expect(document.querySelector("form")).toBeNull();
    expect(libs.createProjectTicket).not.toHaveBeenCalled();
  });

  it("si falla avisa con error, no avisa al padre y deja el formulario abierto con lo escrito", async () => {
    libs.createProjectTicket.mockRejectedValue(new Error("fallo"));
    const onCreated = montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "Se conserva" } });
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.crear }));
    await waitFor(() => expect(toastSpy.mock.calls.some(([a]) => a?.variant === "destructive")).toBe(true), WAIT);
    expect(onCreated).not.toHaveBeenCalled();
    expect(ADAPTADOR.titulo()).toHaveValue("Se conserva");
    expect(screen.getByRole("button", { name: ADAPTADOR.crear })).toBeEnabled();
  });

  it("mientras guarda no permite un segundo envío", async () => {
    let resolver!: () => void;
    libs.createProjectTicket.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    montar();
    abrir();
    fireEvent.change(ADAPTADOR.titulo(), { target: { value: "Una sola vez" } });
    fireEvent.submit(ADAPTADOR.form());
    fireEvent.submit(ADAPTADOR.form());
    expect(libs.createProjectTicket).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: ADAPTADOR.creando })).toBeDisabled();
    resolver();
    await waitFor(() => expect(document.querySelector("form")).toBeNull(), WAIT);
  });
});

describe("TicketDrawer abierto desde el detalle de proyecto (ContentTabs)", () => {
  const ticket = (id: string, title: string, status: string, priority = "media") => ({
    id,
    project_id: "proj-1",
    client_name: "Cliente Demo",
    client_email: "cliente@example.test",
    type: "bug",
    priority,
    status,
    title,
    description: `Descripción de ${title}`,
    created_at: "2026-10-30T10:00:00.000Z",
    updated_at: "2026-11-01T10:00:00.000Z",
    resolved_at: null,
    assigned_to: null,
    message_count: 1,
  });
  const TICKETS = [ticket("a1", "Error en el checkout", "abierto", "alta"), ticket("a2", "Ajuste de colores", "resuelto")];

  function montar(onRefresh = vi.fn()) {
    render(
      <MemoryRouter>
        <ContentTabs
          services={[]}
          tickets={TICKETS as never}
          tokens={[]}
          maintenance={[]}
          projectId="proj-1"
          showMaintenance={false}
          onRefresh={onRefresh}
          onDeleteService={vi.fn()}
          onShowServiceForm={vi.fn()}
        />
      </MemoryRouter>,
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: /tickets/i }), { button: 0 });
    return onRefresh;
  }

  it("muestra los tickets del proyecto y abrir uno despliega el cajón con su conversación", async () => {
    libs.getTicketMessages.mockResolvedValue([
      { id: "m1", ticket_id: "a1", sender_type: "client", sender_name: "Cliente Demo", message: "El pago falla", created_at: "2026-10-30T10:05:00.000Z" },
    ]);
    montar();
    fireEvent.click(await screen.findByText("Error en el checkout", {}, WAIT));
    const cajon = within(await screen.findByRole("dialog", {}, WAIT));
    expect(libs.getTicketMessages).toHaveBeenCalledWith("a1");
    expect(await cajon.findByText("El pago falla", {}, WAIT)).toBeInTheDocument();
    expect(cajon.getAllByText("Error en el checkout").length).toBeGreaterThan(0);
  });

  it("una acción del cajón avisa al detalle de proyecto para que recargue", async () => {
    const onRefresh = montar();
    fireEvent.click(await screen.findByText("Error en el checkout", {}, WAIT));
    const cajon = within(await screen.findByRole("dialog", {}, WAIT));
    fireEvent.click(cajon.getByRole("button", { name: /resolver/i }));
    await waitFor(() => expect(libs.updateTicketStatus).toHaveBeenCalledWith("a1", "resuelto"), WAIT);
    await waitFor(() => expect(onRefresh).toHaveBeenCalled(), WAIT);
  });

  it("el administrador ve el selector de asignación también aquí", async () => {
    montar();
    fireEvent.click(await screen.findByText("Error en el checkout", {}, WAIT));
    await screen.findByRole("dialog", {}, WAIT);
    await waitFor(() => expect(libs.getTeamMembers).toHaveBeenCalled(), WAIT);
  });
});
