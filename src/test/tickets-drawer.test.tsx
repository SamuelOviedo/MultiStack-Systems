// TicketDrawer: nombre y descripción del diálogo, cierre en español, controles con etiqueta, lista de
// datos, conversación (lista + región de anuncios), composición de respuesta, estados de carga/error del hilo, errores de acciones sin
// texto técnico y que un parche tardío no se mezcla con otro ticket. Datos inventados.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

const auth = vi.hoisted(() => ({
  session: null as unknown,
  user: { id: "u-admin", email: "persona@example.test" } as { id: string; email: string } | null,
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

import TicketDrawer from "@/components/dashboard/tickets/TicketDrawer";
import type { Ticket } from "@/types/tickets";

type T = Ticket & { nombre_proyecto?: string };
const base = (over: Partial<T> = {}): T => ({
  id: "t1",
  project_id: "p1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "bug",
  priority: "alta",
  status: "abierto",
  title: "Botón de pago roto",
  description: "Línea uno\nLínea dos",
  created_at: "2026-10-30T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  resolved_at: null,
  assigned_to: null,
  assignee_email: null,
  nombre_proyecto: "Tienda Demo",
  ...over,
});
const MENSAJES = [
  { id: "m1", ticket_id: "t1", sender_type: "client", sender_name: "Cliente Demo", message: "No puedo pagar", created_at: "2026-10-30T10:05:00.000Z" },
  { id: "m2", ticket_id: "t1", sender_type: "team", sender_name: "MultiStack Team", message: "Lo revisamos", created_at: "2026-10-30T11:00:00.000Z" },
];
const EQUIPO = [{ id: "u-ana", email: "ana@example.test", user_type: 0 }];

function montar(ticket: T | null = base(), onUpdated = vi.fn(), onClose = vi.fn()) {
  const ui = (t: T | null) => (
    <MemoryRouter>
      <TicketDrawer ticket={t} open={t !== null} onClose={onClose} onUpdated={onUpdated} />
    </MemoryRouter>
  );
  const view = render(ui(ticket));
  return { ...view, onUpdated, onClose, cambiarTicket: (t: T | null) => view.rerender(ui(t)) };
}
const dialogo = async () => within(await screen.findByRole("dialog", {}, WAIT));
const eligeEnCajon = (campo: string, opcion: string) => {
  fireEvent.keyDown(within(screen.getByRole("dialog")).getByRole("combobox", { name: campo }), { key: "ArrowDown" });
  fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === opcion)!);
};

const realMatchMedia = window.matchMedia;
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-02T15:00:00.000Z"));
  auth.userType = 0;
  toastSpy.mockReset();
  (Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>).mockClear();
  libs.getTicketMessages.mockReset().mockResolvedValue(MENSAJES);
  libs.addTeamMessage.mockReset().mockResolvedValue("m-nuevo");
  libs.updateTicketStatus.mockReset().mockResolvedValue(undefined);
  libs.updateTicketPriority.mockReset().mockResolvedValue(undefined);
  libs.assignTicket.mockReset().mockResolvedValue(undefined);
  libs.notifyTeamReply.mockReset().mockResolvedValue(true);
  libs.getTeamMembers.mockReset().mockResolvedValue(EQUIPO);
});
afterEach(() => {
  cleanup();
  window.matchMedia = realMatchMedia;
  vi.useRealTimers();
});

describe("diálogo", () => {
  it("tiene nombre (el título) y descripción (el proyecto)", async () => {
    montar();
    const dialog = await screen.findByRole("dialog", { name: "Botón de pago roto" }, WAIT);
    expect(dialog).toHaveAccessibleDescription("Proyecto Tienda Demo");
  });

  it("sin proyecto en los datos dice «Sin proyecto asociado»", async () => {
    montar(base({ nombre_proyecto: undefined }));
    expect(await screen.findByRole("dialog", {}, WAIT)).toHaveAccessibleDescription("Sin proyecto asociado");
  });

  it("el botón de cierre dice «Cerrar» (no «Close») y cierra", async () => {
    const { onClose } = montar();
    const d = await dialogo();
    expect(d.queryByText("Close")).toBeNull();
    fireEvent.click(d.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("Escape cierra", async () => {
    const { onClose } = montar();
    fireEvent.keyDown(await screen.findByRole("dialog", {}, WAIT), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("el foco queda dentro del diálogo al abrirse", async () => {
    montar();
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true), WAIT);
  });

  it("el movimiento es breve (200 ms al entrar, 150 ms al salir) y se apaga con «reducir movimiento»", async () => {
    montar();
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    expect(dialog.className).toMatch(/data-\[state=open\]:duration-200/);
    expect(dialog.className).toMatch(/data-\[state=closed\]:duration-150/);
    expect(dialog.className).toMatch(/motion-reduce:data-\[state=open\]:animate-none/);
    expect(dialog.className).toMatch(/motion-reduce:data-\[state=closed\]:animate-none/);
    expect(dialog.className).not.toMatch(/duration-(300|500)/);
  });

  it("no renderiza nada sin ticket", () => {
    montar(null);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("estado, prioridad y responsable", () => {
  it("estado y prioridad son selectores con etiqueta y muestran el valor actual con texto", async () => {
    montar();
    const d = await dialogo();
    expect(d.getByRole("combobox", { name: "Estado" })).toHaveTextContent("Recibido");
    expect(d.getByRole("combobox", { name: "Prioridad" })).toHaveTextContent("Alta");
  });

  it("las opciones de estado y prioridad son las del dominio, con un punto decorativo y el texto", async () => {
    montar();
    await dialogo();
    fireEvent.keyDown(within(screen.getByRole("dialog")).getByRole("combobox", { name: "Estado" }), { key: "ArrowDown" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Recibido", "En revisión", "Asignado", "En progreso", "Resuelto", "Cerrado", "Convertido a Proyecto",
    ]);
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    fireEvent.keyDown(within(screen.getByRole("dialog")).getByRole("combobox", { name: "Prioridad" }), { key: "ArrowDown" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["Baja", "Media", "Alta", "Urgente"]);
  });

  it("cambiar el estado guarda, avisa y sube el ticket combinado al padre", async () => {
    const { onUpdated } = montar();
    await dialogo();
    eligeEnCajon("Estado", "En progreso");
    await waitFor(() => expect(libs.updateTicketStatus).toHaveBeenCalledWith("t1", "en_progreso"), WAIT);
    await waitFor(() => expect(onUpdated).toHaveBeenCalled(), WAIT);
    const parche = onUpdated.mock.calls.at(-1)![0];
    expect(parche).toMatchObject({ id: "t1", status: "en_progreso", title: "Botón de pago roto" });
    expect(toastSpy).toHaveBeenCalledWith({ title: "Estado actualizado", description: "En progreso" });
  });

  it("resolver fija `resolved_at` en el parche y muestra «Resuelto» en los datos", async () => {
    const { onUpdated } = montar();
    const d = await dialogo();
    fireEvent.click(d.getByRole("button", { name: "Resolver" }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalled(), WAIT);
    expect(onUpdated.mock.calls.at(-1)![0].resolved_at).toBeTruthy();
    expect(await d.findByText("Resuelto", { selector: "dt" }, WAIT)).toBeInTheDocument();
  });

  it("durante el guardado los controles se desactivan y se anuncia «Guardando…»", async () => {
    let fin!: () => void;
    libs.updateTicketPriority.mockReturnValue(new Promise<void>((r) => (fin = r)));
    montar();
    const d = await dialogo();
    eligeEnCajon("Prioridad", "Urgente");
    await waitFor(() => expect(d.getByRole("combobox", { name: "Estado" })).toBeDisabled(), WAIT);
    expect(d.getByRole("button", { name: "Resolver" })).toBeDisabled();
    expect(d.getByText("Guardando…")).toBeInTheDocument();
    fin();
    await waitFor(() => expect(d.getByRole("combobox", { name: "Estado" })).toBeEnabled(), WAIT);
  });

  it("el administrador asigna con «Asignado a»; el colaborador no ve ese selector y lee el responsable en los datos", async () => {
    montar(base({ assigned_to: "u-ana", assignee_email: "ana@example.test" }));
    let d = await dialogo();
    expect(d.getByRole("combobox", { name: "Asignado a" })).toHaveTextContent("ana@example.test");
    cleanup();
    auth.userType = 1;
    montar(base({ assigned_to: "u-ana", assignee_email: "ana@example.test" }));
    d = await dialogo();
    expect(d.queryByRole("combobox", { name: "Asignado a" })).toBeNull();
    expect(d.getByText("Asignado", { selector: "dt" }).nextElementSibling).toHaveTextContent("ana@example.test");
  });

  it("si el responsable actual no está en el equipo cargado, el selector no queda en blanco", async () => {
    libs.getTeamMembers.mockResolvedValue([]);
    montar(base({ assigned_to: "u-fuera", assignee_email: "fuera@example.test" }));
    const d = await dialogo();
    expect(d.getByRole("combobox", { name: "Asignado a" })).toHaveTextContent("fuera@example.test");
  });

  it("«Convertir en proyecto»: solo administrador, en revisión y sin proyecto; abre el modal de alcance", async () => {
    montar(base({ status: "en_revision", project_id: null, type: "solicitud" }));
    const d = await dialogo();
    const boton = d.getByRole("button", { name: "Convertir en proyecto" });
    fireEvent.click(boton);
    expect(await screen.findByRole("dialog", { name: /convertir/i }, WAIT)).toBeInTheDocument();
  });

  it("no se ofrece a un colaborador ni con proyecto ni fuera de revisión", async () => {
    auth.userType = 1;
    montar(base({ status: "en_revision", project_id: null }));
    expect((await dialogo()).queryByRole("button", { name: "Convertir en proyecto" })).toBeNull();
    cleanup();
    auth.userType = 0;
    montar(base({ status: "en_revision", project_id: "p1" }));
    expect((await dialogo()).queryByRole("button", { name: "Convertir en proyecto" })).toBeNull();
  });

  it("un error al guardar muestra un aviso en español y nunca el texto técnico", async () => {
    libs.updateTicketStatus.mockRejectedValue(new Error('duplicate key value violates constraint "tickets_pkey"'));
    montar();
    await dialogo();
    eligeEnCajon("Estado", "Cerrado");
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    const aviso = toastSpy.mock.calls.at(-1)![0];
    expect(aviso).toMatchObject({ variant: "destructive", description: "No se pudo completar la acción. Inténtalo de nuevo." });
    expect(JSON.stringify(aviso)).not.toMatch(/duplicate|violates|tickets_pkey/);
  });

  it("un error de permisos lo dice distinto", async () => {
    libs.updateTicketPriority.mockRejectedValue(Object.assign(new Error("rls"), { code: "42501" }));
    montar();
    await dialogo();
    eligeEnCajon("Prioridad", "Baja");
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ description: "No tienes permiso para hacer esto." })), WAIT);
  });
});

describe("lista de datos", () => {
  it("son pares término/definición legibles con fechas en `time`", async () => {
    montar(base({ resolved_at: "2026-11-02T10:00:00.000Z" }));
    const d = await dialogo();
    const par = (term: string) => d.getByText(term, { selector: "dt" }).nextElementSibling as HTMLElement;
    expect(par("Cliente")).toHaveTextContent("Cliente Demo");
    expect(par("Correo")).toHaveTextContent("cliente@example.test");
    expect(par("Tipo")).toHaveTextContent("Bug / Error");
    expect(par("Creado").querySelector("time")).toHaveAttribute("datetime", "2026-10-30T10:00:00.000Z");
    expect(par("Creado")).toHaveTextContent(/octubre de 2026/i);
    expect(par("Última actividad")).toHaveTextContent("ayer");
    expect(par("Resuelto").querySelector("time")).toBeTruthy();
    expect(par("Creado").closest("dl")).toBeTruthy();
  });

  it("un ticket interno (sin cliente) no muestra filas vacías de cliente ni de correo", async () => {
    montar(base({ client_name: null, client_email: null }));
    const d = await dialogo();
    expect(d.queryByText("Cliente", { selector: "dt" })).toBeNull();
    expect(d.queryByText("Correo", { selector: "dt" })).toBeNull();
  });

  it("la descripción conserva los saltos de línea; sin descripción no hay sección vacía", async () => {
    montar();
    const d = await dialogo();
    const p = d.getByText(/Línea uno/);
    expect(p.className).toMatch(/whitespace-pre-wrap/);
    cleanup();
    montar(base({ description: null }));
    expect((await dialogo()).queryByRole("heading", { name: "Descripción" })).toBeNull();
  });
});

describe("conversación", () => {
  // Antes el contenedor del hilo era un `log` con aria-live: al abrir un ticket el lector de pantalla podía leer toda la
  // conversación. Ahora el hilo es una región con nombre y una lista; solo se anuncia lo que llega después de abrirlo.
  const regionAnuncios = (d: ReturnType<typeof within>) => d.getByRole("status");

  it("el hilo es una sección con nombre y una lista: no es un `log` ni lleva aria-live", async () => {
    montar();
    const d = await dialogo();
    const titulo = await d.findByRole("heading", { name: /^Conversación\s*\(2\)$/ }, WAIT);
    const region = titulo.closest("section")!;
    expect(region).toHaveAccessibleName(/^Conversación\s*\(2\)$/);
    expect(d.queryByRole("log")).toBeNull();
    expect(within(region).getAllByRole("listitem")).toHaveLength(2);
    // Ningún ancestro de la lista ni la lista misma son regiones vivas.
    const lista = within(region).getByRole("list");
    for (let el: HTMLElement | null = lista; el && el !== region.parentElement; el = el.parentElement) {
      expect(el.hasAttribute("aria-live"), el.tagName).toBe(false);
      expect(el.hasAttribute("aria-relevant"), el.tagName).toBe(false);
      expect(el.getAttribute("role")).not.toBe("log");
    }
  });

  it("al abrir, la región de anuncios existe pero está vacía y oculta a la vista", async () => {
    montar();
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    const anuncios = regionAnuncios(d);
    expect(anuncios).toHaveAttribute("aria-live", "polite");
    expect(anuncios).toBeEmptyDOMElement();
    expect(anuncios.className).toMatch(/sr-only/);
  });

  it("al llegar un mensaje nuevo se anuncia solo ese (autor), no el hilo entero", async () => {
    montar();
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    libs.getTicketMessages.mockResolvedValue([...MENSAJES, { id: "m3", ticket_id: "t1", sender_type: "team", sender_name: "Ana Demo", message: "Hecho", created_at: "2026-11-02T14:00:00.000Z" }]);
    fireEvent.change(d.getByRole("textbox"), { target: { value: "Hecho" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    await waitFor(() => expect(regionAnuncios(d)).toHaveTextContent("Nuevo mensaje de Ana Demo"), WAIT);
    const texto = regionAnuncios(d).textContent ?? "";
    expect(texto).toBe("Nuevo mensaje de Ana Demo");
    expect(texto).not.toMatch(/No puedo pagar|Lo revisamos|Cliente Demo|Hecho/);
  });

  it("al cambiar de ticket no se anuncia el hilo nuevo completo", async () => {
    const { cambiarTicket } = montar(base());
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    libs.getTicketMessages.mockResolvedValue([
      { id: "n1", ticket_id: "t2", sender_type: "client", sender_name: "Otra Persona", message: "Hola desde el otro", created_at: "2026-10-31T10:00:00.000Z" },
      { id: "n2", ticket_id: "t2", sender_type: "team", sender_name: "MultiStack Team", message: "Recibido", created_at: "2026-10-31T11:00:00.000Z" },
    ]);
    cambiarTicket(base({ id: "t2", title: "Segundo" }));
    expect(await d.findByText("Hola desde el otro", {}, WAIT)).toBeInTheDocument();
    expect(regionAnuncios(d)).toBeEmptyDOMElement();
  });

  it("tras cambiar de ticket, un mensaje que llega después sí se anuncia", async () => {
    const { cambiarTicket } = montar(base());
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    const otro = { id: "n1", ticket_id: "t2", sender_type: "client", sender_name: "Otra Persona", message: "Hola desde el otro", created_at: "2026-10-31T10:00:00.000Z" };
    libs.getTicketMessages.mockResolvedValue([otro]);
    cambiarTicket(base({ id: "t2", title: "Segundo" }));
    await d.findByText("Hola desde el otro", {}, WAIT);
    libs.getTicketMessages.mockResolvedValue([otro, { ...otro, id: "n2", sender_type: "team", sender_name: "Ana Demo", message: "Respuesta" }]);
    fireEvent.change(d.getByRole("textbox"), { target: { value: "Respuesta" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    await waitFor(() => expect(regionAnuncios(d)).toHaveTextContent("Nuevo mensaje de Ana Demo"), WAIT);
  });

  it("distingue equipo y cliente con una etiqueta de texto y con la alineación (no solo por color)", async () => {
    montar();
    const d = await dialogo();
    const cliente = (await d.findByText("No puedo pagar", {}, WAIT)).closest("li")!;
    const equipo = d.getByText("Lo revisamos").closest("li")!;
    expect(within(cliente).getByText("Cliente", { selector: "span" })).toBeInTheDocument();
    expect(within(equipo).getByText("Equipo", { selector: "span" })).toBeInTheDocument();
    expect(cliente.className).toMatch(/justify-start/);
    expect(equipo.className).toMatch(/justify-end/);
  });

  it("cada mensaje lleva autor, fecha y hora legibles en `time`", async () => {
    montar();
    const d = await dialogo();
    const msg = (await d.findByText("No puedo pagar", {}, WAIT)).closest("li")!;
    expect(within(msg).getByText("Cliente Demo")).toBeInTheDocument();
    const hora = msg.querySelector("time")!;
    expect(hora).toHaveAttribute("datetime", "2026-10-30T10:05:00.000Z");
    expect(hora.getAttribute("title")).toMatch(/octubre/i);
    expect(hora.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it("los mensajes se muestran en el orden recibido y con saltos de línea", async () => {
    libs.getTicketMessages.mockResolvedValue([{ ...MENSAJES[0], message: "a\nb" }, MENSAJES[1]]);
    montar();
    const d = await dialogo();
    const a = await d.findByText(/^a\s*b$/, {}, WAIT);
    expect(a.className).toMatch(/whitespace-pre-wrap/);
    expect(a.compareDocumentPosition(d.getByText("Lo revisamos")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("cargando: barras y texto «Cargando mensajes…» y el contenedor del hilo ocupado", async () => {
    libs.getTicketMessages.mockReturnValue(new Promise(() => {}));
    montar();
    const d = await dialogo();
    expect(d.getByText("Cargando mensajes…")).toBeInTheDocument();
    expect(d.getByText("Cargando mensajes…").closest("[aria-busy]")).toHaveAttribute("aria-busy", "true");
    expect(regionAnuncios(d)).toBeEmptyDOMElement();
  });

  it("sin mensajes: «Sin mensajes todavía.»", async () => {
    libs.getTicketMessages.mockResolvedValue([]);
    montar();
    expect(await (await dialogo()).findByText("Sin mensajes todavía.", {}, WAIT)).toBeInTheDocument();
  });

  it("error: aviso claro con «Reintentar» (sin texto técnico) y el reintento carga el hilo", async () => {
    libs.getTicketMessages.mockRejectedValueOnce(new Error("connection refused 10.0.0.1")).mockResolvedValue(MENSAJES);
    montar();
    const d = await dialogo();
    const alerta = await d.findByRole("alert", {}, WAIT);
    expect(alerta).toHaveTextContent("No se pudo cargar la conversación.");
    expect(document.body.textContent).not.toMatch(/connection refused|10\.0\.0\.1/);
    fireEvent.click(within(alerta).getByRole("button", { name: "Reintentar" }));
    expect(await d.findByText("No puedo pagar", {}, WAIT)).toBeInTheDocument();
    expect(d.queryByRole("alert")).toBeNull();
    // Lo que trae el reintento es el punto de partida del hilo: no se anuncia.
    expect(regionAnuncios(d)).toBeEmptyDOMElement();
  });

  it("al abrir NO baja el hilo (se ven primero los datos); al llegar un mensaje nuevo, sí", async () => {
    montar();
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    expect(scroll).not.toHaveBeenCalled();
    libs.getTicketMessages.mockResolvedValue([...MENSAJES, { id: "m3", ticket_id: "t1", sender_type: "team", sender_name: "MultiStack Team", message: "Hecho", created_at: "2026-11-02T14:00:00.000Z" }]);
    fireEvent.change(d.getByRole("textbox"), { target: { value: "Hecho" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    await waitFor(() => expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ behavior: "smooth", block: "end" })), WAIT);
  });

  it("con «reducir movimiento» el hilo baja sin animación", async () => {
    window.matchMedia = ((q: string) => ({
      matches: q.includes("prefers-reduced-motion"), media: q, onchange: null,
      addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    montar();
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    libs.getTicketMessages.mockResolvedValue([...MENSAJES, { ...MENSAJES[1], id: "m3", message: "Otro" }]);
    fireEvent.change(d.getByRole("textbox"), { target: { value: "Otro" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ behavior: "auto" })), WAIT);
  });

  it("si falla recargar tras responder, la conversación que ya se veía no se borra", async () => {
    montar();
    const d = await dialogo();
    await d.findByText("No puedo pagar", {}, WAIT);
    libs.getTicketMessages.mockRejectedValue(new Error("x"));
    fireEvent.change(d.getByRole("textbox"), { target: { value: "Hola" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalled(), WAIT);
    await waitFor(() => expect(libs.getTicketMessages).toHaveBeenCalledTimes(2), WAIT);
    expect(d.getByText("No puedo pagar")).toBeInTheDocument();
    expect(d.queryByRole("alert")).toBeNull();
  });
});

describe("composición de la respuesta", () => {
  it("el campo tiene etiqueta visible enlazada, límite de la base de datos y ayuda enlazada", async () => {
    montar();
    const d = await dialogo();
    const caja = d.getByLabelText("Respuesta al cliente");
    expect(caja.tagName).toBe("TEXTAREA");
    expect(caja).toHaveAttribute("maxlength", "10000");
    expect(caja).toHaveAccessibleDescription(/Se avisa al cliente por correo\. Ctrl\+Enter para enviar\./);
  });

  it("sin correo de cliente la etiqueta es «Mensaje» y la ayuda dice que queda solo en la conversación", async () => {
    montar(base({ client_email: null }));
    const d = await dialogo();
    expect(d.getByLabelText("Mensaje")).toHaveAccessibleDescription(/Queda solo en la conversación\. Ctrl\+Enter para enviar\./);
  });

  it("Ctrl+Enter y Cmd+Enter envían (el atajo ya existía); Enter solo no", async () => {
    montar();
    const d = await dialogo();
    const caja = d.getByRole("textbox");
    fireEvent.change(caja, { target: { value: "Uno" } });
    fireEvent.keyDown(caja, { key: "Enter" });
    expect(libs.addTeamMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(caja, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalledTimes(1), WAIT);
    fireEvent.change(caja, { target: { value: "Dos" } });
    fireEvent.keyDown(caja, { key: "Enter", metaKey: true });
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalledTimes(2), WAIT);
  });

  it("enviar con Enter en el formulario funciona igual que el botón y no se duplica mientras envía", async () => {
    let fin!: (id: string) => void;
    libs.addTeamMessage.mockReturnValue(new Promise<string>((r) => (fin = r)));
    montar();
    const d = await dialogo();
    const caja = d.getByRole("textbox");
    fireEvent.change(caja, { target: { value: "Una vez" } });
    fireEvent.keyDown(caja, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(caja, { key: "Enter", ctrlKey: true });
    expect(libs.addTeamMessage).toHaveBeenCalledTimes(1);
    expect(await d.findByRole("button", { name: "Enviando…" }, WAIT)).toBeDisabled();
    fin("m9");
    await waitFor(() => expect(caja).toHaveValue(""), WAIT);
  });

  it("un error al enviar avisa sin texto técnico y conserva lo escrito", async () => {
    libs.addTeamMessage.mockRejectedValue(new Error("insert or update on table violates foreign key"));
    montar();
    const d = await dialogo();
    const caja = d.getByRole("textbox");
    fireEvent.change(caja, { target: { value: "No se pierde" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    expect(JSON.stringify(toastSpy.mock.calls.at(-1)![0])).not.toMatch(/foreign key|violates/);
    expect(caja).toHaveValue("No se pierde");
  });
});

describe("parches que llegan tarde", () => {
  it("responder y cambiar el estado a la vez no revierte el estado (el parche de la respuesta parte del ticket vigente)", async () => {
    let terminaRespuesta!: (id: string) => void;
    libs.addTeamMessage.mockReturnValue(new Promise<string>((r) => (terminaRespuesta = r)));
    const { onUpdated } = montar();
    const d = await dialogo();
    fireEvent.change(d.getByRole("textbox"), { target: { value: "Ya voy" } });
    fireEvent.click(d.getByRole("button", { name: "Responder" }));
    eligeEnCajon("Estado", "En progreso");
    await waitFor(() => expect(libs.updateTicketStatus).toHaveBeenCalled(), WAIT);
    await waitFor(() => expect(d.getByRole("combobox", { name: "Estado" })).toHaveTextContent("En progreso"), WAIT);
    terminaRespuesta("m9");
    await waitFor(() => expect(onUpdated.mock.calls.length).toBeGreaterThanOrEqual(2), WAIT);
    expect(onUpdated.mock.calls.at(-1)![0]).toMatchObject({ status: "en_progreso" });
    expect(d.getByRole("combobox", { name: "Estado" })).toHaveTextContent("En progreso");
  });

  it("si el cajón pasó a otro ticket mientras guardaba, no se mezcla el parche: se pide recargar", async () => {
    let fin!: () => void;
    libs.updateTicketStatus.mockReturnValue(new Promise<void>((r) => (fin = r)));
    const { onUpdated, cambiarTicket } = montar(base());
    await dialogo();
    eligeEnCajon("Estado", "Cerrado");
    await waitFor(() => expect(libs.updateTicketStatus).toHaveBeenCalledWith("t1", "cerrado"), WAIT);
    cambiarTicket(base({ id: "t2", title: "Otro ticket", status: "abierto" }));
    fin();
    await waitFor(() => expect(onUpdated).toHaveBeenCalled(), WAIT);
    expect(onUpdated).toHaveBeenCalledWith();
    const d = await dialogo();
    expect(d.getByRole("combobox", { name: "Estado" })).toHaveTextContent("Recibido");
    expect(d.getByRole("heading", { name: "Otro ticket" })).toBeInTheDocument();
  });

  it("una respuesta del hilo de otro ticket no pisa al actual", async () => {
    let tarde!: (v: unknown) => void;
    libs.getTicketMessages.mockReturnValueOnce(new Promise((r) => (tarde = r)));
    const { cambiarTicket } = montar(base());
    await dialogo();
    libs.getTicketMessages.mockResolvedValue([{ ...MENSAJES[0], id: "z1", ticket_id: "t2", message: "Mensaje del segundo" }]);
    cambiarTicket(base({ id: "t2", title: "Segundo" }));
    expect(await (await dialogo()).findByText("Mensaje del segundo", {}, WAIT)).toBeInTheDocument();
    tarde(MENSAJES);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("No puedo pagar")).toBeNull();
  });
});
