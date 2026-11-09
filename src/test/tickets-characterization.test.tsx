// Caracterización: fija el comportamiento que `/dashboard/tickets` y el `TicketDrawer` tenían ANTES del
// rediseño del Soporte (filtros, órdenes, visibilidad por rol, conteo de abiertos, acciones del cajón, estados
// de carga/vacío/error). Se escribió contra el código anterior y debe seguir en verde después; lo único que se
// actualiza son los TEXTOS y el marcado que se cambian a propósito, y todos viven en `ADAPTADOR`.
//
// Se renderiza la página real (con su cajón real); `useAuth`, `use-toast` y las funciones de `src/lib` van
// simuladas y los datos son inventados sobre dominios reservados (`.test`).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

const auth = vi.hoisted(() => ({
  session: null as unknown,
  user: null as { id: string; email: string } | null,
  userType: null as number | null,
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
  getAllTickets: vi.fn(),
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

import TicketsGlobal from "@/pages/dashboard/TicketsGlobal";

/**
 * Todo lo que cambia con el rediseño está aquí y en ningún otro sitio de este archivo.
 * Cada entrada lleva el motivo del cambio de texto o de marcado.
 */
const ADAPTADOR = {
  /**
   * Los `<select>` nativos con una etiqueta suelta («estado:») pasan a selectores con etiqueta visible y
   * nombre accesible. El nombre ya no lleva los dos puntos ni va en minúscula; «asignar a:» pasa a «Asignado a».
   */
  campo: { estado: "Estado", tipo: "Tipo", prioridad: "Prioridad", proyecto: "Proyecto", asignado: "Asignado", asignarA: "Asignado a" },
  /** El selector (rol combobox) de un campo; `enCajon` distingue los del cajón de los de la lista. */
  select(campo: keyof typeof ADAPTADOR.campo, enCajon: boolean): HTMLElement | null {
    const scope = enCajon ? within(screen.getByRole("dialog")) : screen;
    return scope.queryByRole("combobox", { name: ADAPTADOR.campo[campo] });
  },
  existe: (campo: keyof typeof ADAPTADOR.campo, enCajon = false) => ADAPTADOR.select(campo, enCajon) !== null,
  /** Abre el selector con el teclado, como en `admin-ui-primitives.test.tsx`. */
  abrirSelect(campo: keyof typeof ADAPTADOR.campo, enCajon: boolean) {
    fireEvent.keyDown(ADAPTADOR.select(campo, enCajon)!, { key: "ArrowDown" });
  },
  elegir(campo: keyof typeof ADAPTADOR.campo, opcion: string, enCajon = false) {
    ADAPTADOR.abrirSelect(campo, enCajon);
    const o = screen.getAllByRole("option").find((x) => x.textContent === opcion);
    if (!o) throw new Error(`«${opcion}» no es una opción de ${String(campo)}`);
    fireEvent.click(o);
  },
  opciones(campo: keyof typeof ADAPTADOR.campo, enCajon = false) {
    ADAPTADOR.abrirSelect(campo, enCajon);
    const out = screen.getAllByRole("option").map((o) => o.textContent ?? "");
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    return out;
  },
  valor: (campo: keyof typeof ADAPTADOR.campo, enCajon = false) => ADAPTADOR.select(campo, enCajon)!.textContent ?? "",
  /** «todos»/«todas» pasan a «Todos»/«Todas»; «— sin asignar —» pasa a «Sin asignar». */
  todos: "Todos",
  todas: "Todas",
  sinAsignarFiltro: "Sin asignar",
  sinAsignarCajon: "Sin asignar",
  /** Botón de una cabecera ordenable (ahora con nombre en mayúscula inicial; la expresión no distingue). */
  ordenar: (nombre: string) => fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${nombre}`, "i") })),
  /** La cuenta de abiertos y total (antes un texto «n abiertos · m total») son dos indicadores con nombre. */
  contadores(): { abiertos: number; total: number } {
    const n = (name: string) => Number(/\d+/.exec(screen.getByRole("group", { name }).textContent ?? "")?.[0]);
    return { abiertos: n("Abiertos"), total: n("Total de tickets") };
  },
  cargando: /cargando/i,
  /** «sin tickets.» se reparte en dos estados: sin ningún ticket y sin coincidencias con los filtros. */
  sinTickets: /a[uú]n no hay tickets|ning[uú]n ticket coincide/i,
  /** El error de carga ya no es un aviso con el mensaje crudo: se ve en pantalla, con reintento. */
  errorDeCarga: () => screen.queryByRole("alert") !== null,
  /** «[ CONVERTIR A PROYECTO OFICIAL ]» pasa a «Convertir en proyecto». */
  botonConvertir: /convertir en proyecto/i,
  botonResolver: /resolver/i,
  /** «[ RESPONDER ]» pasa a «Responder». */
  botonResponder: /responder/i,
  sinMensajes: "Sin mensajes todavía.",
  /** Nombre y correo del cliente (antes una línea «cliente: nombre · correo») son dos datos de la lista de datos. */
  verCliente: (cajon: ReturnType<typeof within>) => {
    expect(cajon.getByText("Cliente Demo", { selector: "dd" })).toBeInTheDocument();
    expect(cajon.getByText("cliente@example.test", { selector: "dd" })).toBeInTheDocument();
  },
};

const NOW = "2026-11-02T15:00:00.000Z";
const iso = (d: string) => `${d}:00.000Z`;

interface Datos {
  id: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  project: string;
  assignee: string | null;
  created: string;
  updated: string;
  msgs: number;
  projectId?: string | null;
  clientEmail?: string | null;
}
const ticket = (d: Datos) => ({
  id: d.id,
  project_id: d.projectId === undefined ? (d.project ? "p-" + d.project.length : null) : d.projectId,
  client_name: "Cliente Demo",
  client_email: d.clientEmail === undefined ? "cliente@example.test" : d.clientEmail,
  type: d.type,
  priority: d.priority,
  status: d.status,
  title: d.title,
  description: `Descripción de ${d.title}`,
  created_at: iso(d.created),
  updated_at: iso(d.updated),
  resolved_at: null,
  assigned_to: d.assignee ? "u-" + d.assignee.split("@")[0] : null,
  assignee_email: d.assignee,
  nombre_proyecto: d.project,
  message_count: d.msgs,
});
// Orden de la API: por actividad, de la más reciente a la más antigua (como `getAllTickets`).
const TICKETS = [
  ticket({ id: "t1", title: "Botón de pago roto", type: "bug", priority: "alta", status: "abierto", project: "Tienda Demo", assignee: null, created: "2026-10-30T10:00", updated: "2026-11-02T14:00", msgs: 2 }),
  ticket({ id: "t4", title: "Servidor caído", type: "bug", priority: "urgente", status: "en_revision", project: "Portal Ejemplo", assignee: null, created: "2026-11-02T08:00", updated: "2026-11-02T09:00", msgs: 0 }),
  ticket({ id: "t2", title: "Cambiar logotipo", type: "modificacion", priority: "media", status: "en_progreso", project: "Tienda Demo", assignee: "ana@example.test", created: "2026-10-25T10:00", updated: "2026-11-01T10:00", msgs: 4 }),
  ticket({ id: "t5", title: "Solicitud de tienda", type: "solicitud", priority: "media", status: "en_revision", project: "", assignee: null, created: "2026-10-31T10:00", updated: "2026-10-31T10:00", msgs: 1, projectId: null }),
  ticket({ id: "t3", title: "Duda de factura", type: "pago", priority: "baja", status: "resuelto", project: "Portal Ejemplo", assignee: "ana@example.test", created: "2026-10-20T10:00", updated: "2026-10-28T10:00", msgs: 1 }),
  ticket({ id: "t6", title: "Consulta archivada", type: "consulta", priority: "baja", status: "cerrado", project: "Tienda Demo", assignee: "luis@example.test", created: "2026-09-01T10:00", updated: "2026-09-15T10:00", msgs: 3, clientEmail: null }),
];
const TITULOS = TICKETS.map((t) => t.title);
const porId = (id: string) => TICKETS.find((t) => t.id === id)!;

const MENSAJES = [
  { id: "m1", ticket_id: "t1", sender_type: "client", sender_name: "Cliente Demo", message: "No puedo pagar desde ayer", created_at: iso("2026-10-30T10:05") },
  { id: "m2", ticket_id: "t1", sender_type: "team", sender_name: "MultiStack Team", message: "Lo estamos revisando", created_at: iso("2026-10-30T11:00") },
];
const EQUIPO = [
  { id: "u-ana", email: "ana@example.test", user_type: 0 },
  { id: "u-luis", email: "luis@example.test", user_type: 1 },
];

function signIn(userType: number | null) {
  const user = { id: userType === 1 ? "u-colab" : "u-admin", email: "persona@example.test" };
  auth.user = user;
  auth.session = { user };
  auth.userType = userType;
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/dashboard/tickets"]}>
      <TicketsGlobal />
    </MemoryRouter>,
  );
}

/** Títulos de los tickets visibles, en el orden en que aparecen en la lista (fuera del cajón). */
function enLista(): string[] {
  const found = TITULOS.flatMap((t) => {
    const el = screen.queryAllByText(t).find((e) => e.closest('[role="dialog"]') === null);
    return el ? [{ t, el }] : [];
  });
  found.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return found.map((f) => f.t);
}
const filaDe = (titulo: string) =>
  screen.getAllByText(titulo).find((e) => e.closest('[role="dialog"]') === null)!.closest("tr") as HTMLElement;

async function cargar(userType = 0) {
  signIn(userType);
  renderPage();
  await screen.findByText("Botón de pago roto", {}, WAIT);
}
async function abrir(titulo: string) {
  fireEvent.click(screen.getAllByText(titulo).find((e) => e.closest('[role="dialog"]') === null)!);
  return within(await screen.findByRole("dialog", {}, WAIT));
}

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
  vi.setSystemTime(new Date(NOW));
  auth.session = null;
  auth.user = null;
  auth.userType = null;
  toastSpy.mockReset();
  libs.getAllTickets.mockReset().mockResolvedValue(TICKETS);
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
  vi.useRealTimers();
});

describe("lista · carga, rol y conteo de abiertos", () => {
  it("no pide nada hasta que el rol se resuelve y luego carga una vez", async () => {
    signIn(null);
    const view = renderPage();
    await Promise.resolve();
    expect(libs.getAllTickets).not.toHaveBeenCalled();
    signIn(0);
    view.rerender(
      <MemoryRouter initialEntries={["/dashboard/tickets"]}>
        <TicketsGlobal />
      </MemoryRouter>,
    );
    await screen.findByText("Botón de pago roto", {}, WAIT);
    expect(libs.getAllTickets).toHaveBeenCalledTimes(1);
  });

  it("administrador: consulta todos (sin filtro) y muestra los 6 tickets", async () => {
    await cargar(0);
    expect(libs.getAllTickets).toHaveBeenCalledWith(undefined);
    expect(enLista()).toHaveLength(6);
  });

  it("colaborador: consulta solo lo asignado a él y no ve el filtro «asignado»", async () => {
    await cargar(1);
    expect(libs.getAllTickets).toHaveBeenCalledWith({ assignedTo: "u-colab" });
    expect(ADAPTADOR.existe("asignado")).toBe(false);
    // Los otros cuatro filtros siguen.
    for (const c of ["estado", "tipo", "prioridad", "proyecto"] as const) expect(ADAPTADOR.existe(c), c).toBe(true);
  });

  it("administrador: ve los cinco filtros", async () => {
    await cargar(0);
    for (const c of ["estado", "tipo", "prioridad", "proyecto", "asignado"] as const) expect(ADAPTADOR.existe(c), c).toBe(true);
  });

  it("abiertos = abierto + en_revision + en_progreso (4); total 6", async () => {
    await cargar(0);
    expect(ADAPTADOR.contadores()).toEqual({ abiertos: 4, total: 6 });
  });

  it("el conteo de abiertos no cambia al filtrar (cuenta todo lo cargado)", async () => {
    await cargar(0);
    ADAPTADOR.elegir("estado", "Resuelto");
    expect(enLista()).toEqual(["Duda de factura"]);
    expect(ADAPTADOR.contadores()).toEqual({ abiertos: 4, total: 6 });
  });

  it("muestra cargando mientras espera y «sin tickets» si no hay ninguno", async () => {
    let resolver!: (v: unknown[]) => void;
    libs.getAllTickets.mockReturnValue(new Promise((r) => (resolver = r)));
    signIn(0);
    renderPage();
    expect(await screen.findAllByText(ADAPTADOR.cargando)).not.toHaveLength(0);
    resolver([]);
    expect(await screen.findByText(ADAPTADOR.sinTickets, {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByText(ADAPTADOR.cargando)).toBeNull();
  });

  it("si la carga falla avisa del error y no deja filas", async () => {
    libs.getAllTickets.mockRejectedValue(new Error("detalle técnico"));
    signIn(0);
    renderPage();
    await waitFor(() => expect(ADAPTADOR.errorDeCarga()).toBe(true), WAIT);
    expect(enLista()).toEqual([]);
  });

  it("el proyecto vacío y el asignado vacío se muestran con «—»", async () => {
    await cargar(0);
    // t5 no tiene proyecto ni responsable.
    expect(within(filaDe("Solicitud de tienda")).getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });
});

describe("lista · los 5 filtros (cada uno y combinados)", () => {
  it("por estado", async () => {
    await cargar(0);
    ADAPTADOR.elegir("estado", "En revisión");
    expect(enLista()).toEqual(["Servidor caído", "Solicitud de tienda"]);
    ADAPTADOR.elegir("estado", "Recibido");
    expect(enLista()).toEqual(["Botón de pago roto"]);
  });

  it("por tipo", async () => {
    await cargar(0);
    ADAPTADOR.elegir("tipo", "Pago");
    expect(enLista()).toEqual(["Duda de factura"]);
    ADAPTADOR.elegir("tipo", "Bug / Error");
    expect(enLista()).toEqual(["Botón de pago roto", "Servidor caído"]);
  });

  it("por prioridad", async () => {
    await cargar(0);
    ADAPTADOR.elegir("prioridad", "Baja");
    expect(enLista()).toEqual(["Duda de factura", "Consulta archivada"]);
    ADAPTADOR.elegir("prioridad", "Urgente");
    expect(enLista()).toEqual(["Servidor caído"]);
  });

  it("por proyecto: opciones únicas, ordenadas y sin el proyecto vacío", async () => {
    await cargar(0);
    expect(ADAPTADOR.opciones("proyecto")).toEqual([ADAPTADOR.todos, "Portal Ejemplo", "Tienda Demo"]);
    ADAPTADOR.elegir("proyecto", "Portal Ejemplo");
    expect(enLista()).toEqual(["Servidor caído", "Duda de factura"]);
  });

  it("por asignado: «sin asignar», correos únicos ordenados", async () => {
    await cargar(0);
    expect(ADAPTADOR.opciones("asignado")).toEqual([
      ADAPTADOR.todos, ADAPTADOR.sinAsignarFiltro, "ana@example.test", "luis@example.test",
    ]);
    ADAPTADOR.elegir("asignado", ADAPTADOR.sinAsignarFiltro);
    expect(enLista()).toEqual(["Botón de pago roto", "Servidor caído", "Solicitud de tienda"]);
    ADAPTADOR.elegir("asignado", "ana@example.test");
    expect(enLista()).toEqual(["Cambiar logotipo", "Duda de factura"]);
  });

  it("las opciones de estado, tipo y prioridad salen de los mapas reales del dominio", async () => {
    await cargar(0);
    expect(ADAPTADOR.opciones("estado")).toEqual([
      ADAPTADOR.todos, "Recibido", "En revisión", "Asignado", "En progreso", "Resuelto", "Cerrado", "Convertido a Proyecto",
    ]);
    expect(ADAPTADOR.opciones("tipo")).toEqual([
      ADAPTADOR.todos, "Modificación", "Bug / Error", "Consulta", "Pago", "Mantenimiento", "Otro", "Solicitud de Proyecto",
    ]);
    expect(ADAPTADOR.opciones("prioridad")).toEqual([ADAPTADOR.todas, "Baja", "Media", "Alta", "Urgente"]);
  });

  it("combinados: se suman (AND)", async () => {
    await cargar(0);
    ADAPTADOR.elegir("estado", "En revisión");
    ADAPTADOR.elegir("proyecto", "Portal Ejemplo");
    expect(enLista()).toEqual(["Servidor caído"]);
    ADAPTADOR.elegir("tipo", "Pago");
    expect(enLista()).toEqual([]);
    expect(screen.getByText(ADAPTADOR.sinTickets)).toBeInTheDocument();
  });

  it("volver a «todos» devuelve la lista completa", async () => {
    await cargar(0);
    ADAPTADOR.elegir("prioridad", "Alta");
    expect(enLista()).toEqual(["Botón de pago roto"]);
    ADAPTADOR.elegir("prioridad", ADAPTADOR.todas);
    expect(enLista()).toHaveLength(6);
  });

  it("filtrar no vuelve a pedir datos", async () => {
    await cargar(0);
    ADAPTADOR.elegir("estado", "Cerrado");
    ADAPTADOR.elegir("tipo", "Consulta");
    expect(libs.getAllTickets).toHaveBeenCalledTimes(1);
  });
});

describe("lista · los 3 órdenes (por actividad, creado y prioridad)", () => {
  it("por defecto: actividad, de la más reciente a la más antigua", async () => {
    await cargar(0);
    expect(enLista()).toEqual([
      "Botón de pago roto", "Servidor caído", "Cambiar logotipo", "Solicitud de tienda", "Duda de factura", "Consulta archivada",
    ]);
  });

  it("actividad: un clic en la columna activa invierte el sentido", async () => {
    await cargar(0);
    ADAPTADOR.ordenar("actividad");
    expect(enLista()).toEqual([
      "Consulta archivada", "Duda de factura", "Solicitud de tienda", "Cambiar logotipo", "Servidor caído", "Botón de pago roto",
    ]);
    ADAPTADOR.ordenar("actividad");
    expect(enLista()[0]).toBe("Botón de pago roto");
  });

  it("creado: empieza descendente y el segundo clic lo invierte", async () => {
    await cargar(0);
    ADAPTADOR.ordenar("creado");
    expect(enLista()).toEqual([
      "Servidor caído", "Solicitud de tienda", "Botón de pago roto", "Cambiar logotipo", "Duda de factura", "Consulta archivada",
    ]);
    ADAPTADOR.ordenar("creado");
    expect(enLista()).toEqual([
      "Consulta archivada", "Duda de factura", "Cambiar logotipo", "Botón de pago roto", "Solicitud de tienda", "Servidor caído",
    ]);
  });

  it("prioridad: urgente > alta > media > baja; los empates conservan el orden recibido", async () => {
    await cargar(0);
    ADAPTADOR.ordenar("prioridad");
    expect(enLista()).toEqual([
      "Servidor caído", "Botón de pago roto", "Cambiar logotipo", "Solicitud de tienda", "Duda de factura", "Consulta archivada",
    ]);
    ADAPTADOR.ordenar("prioridad");
    expect(enLista()).toEqual([
      "Duda de factura", "Consulta archivada", "Cambiar logotipo", "Solicitud de tienda", "Botón de pago roto", "Servidor caído",
    ]);
  });

  it("cambiar de columna vuelve a descendente", async () => {
    await cargar(0);
    ADAPTADOR.ordenar("prioridad");
    ADAPTADOR.ordenar("prioridad"); // asc
    ADAPTADOR.ordenar("creado"); // desc
    expect(enLista()[0]).toBe("Servidor caído");
  });

  it("el orden se aplica sobre lo filtrado", async () => {
    await cargar(0);
    ADAPTADOR.elegir("proyecto", "Tienda Demo");
    ADAPTADOR.ordenar("prioridad");
    expect(enLista()).toEqual(["Botón de pago roto", "Cambiar logotipo", "Consulta archivada"]);
  });
});

describe("cajón · apertura y contenido", () => {
  it("abrir una fila muestra el cajón con título, descripción, cliente y los mensajes en orden", async () => {
    await cargar(0);
    const cajon = await abrir("Botón de pago roto");
    expect(libs.getTicketMessages).toHaveBeenCalledWith("t1");
    expect(cajon.getAllByText("Botón de pago roto").length).toBeGreaterThan(0);
    expect(cajon.getByText("Descripción de Botón de pago roto")).toBeInTheDocument();
    ADAPTADOR.verCliente(cajon);
    const a = await cajon.findByText("No puedo pagar desde ayer", {}, WAIT);
    const b = cajon.getByText("Lo estamos revisando");
    expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cajon.getByText(/MultiStack Team/)).toBeInTheDocument();
  });

  it("sin mensajes: «Sin mensajes todavía.»", async () => {
    libs.getTicketMessages.mockResolvedValue([]);
    await cargar(0);
    const cajon = await abrir("Botón de pago roto");
    expect(await cajon.findByText(ADAPTADOR.sinMensajes, {}, WAIT)).toBeInTheDocument();
  });

  it("estado y prioridad del cajón reflejan el ticket", async () => {
    await cargar(0);
    await abrir("Servidor caído");
    expect(ADAPTADOR.valor("estado", true)).toBe("En revisión");
    expect(ADAPTADOR.valor("prioridad", true)).toBe("Urgente");
  });

  it("cerrar el cajón lo quita de la pantalla", async () => {
    await cargar(0);
    await abrir("Botón de pago roto");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });
});

describe("cajón · cambiar estado y prioridad", () => {
  it("cambiar el estado llama a la función, avisa y se refleja en el cajón y en la fila sin recargar", async () => {
    await cargar(0);
    await abrir("Botón de pago roto");
    ADAPTADOR.elegir("estado", "En progreso", true);
    await waitFor(() => expect(libs.updateTicketStatus).toHaveBeenCalledWith("t1", "en_progreso"), WAIT);
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Estado actualizado", description: "En progreso" }), WAIT);
    await waitFor(() => expect(ADAPTADOR.valor("estado", true)).toBe("En progreso"), WAIT);
    expect(within(filaDe("Botón de pago roto")).getByText("En progreso")).toBeInTheDocument();
    expect(libs.getAllTickets).toHaveBeenCalledTimes(1);
  });

  it("«Resolver» pasa el ticket a resuelto y el botón desaparece", async () => {
    await cargar(0);
    const cajon = await abrir("Botón de pago roto");
    fireEvent.click(cajon.getByRole("button", { name: ADAPTADOR.botonResolver }));
    await waitFor(() => expect(libs.updateTicketStatus).toHaveBeenCalledWith("t1", "resuelto"), WAIT);
    await waitFor(() => expect(within(filaDe("Botón de pago roto")).getByText("Resuelto")).toBeInTheDocument(), WAIT);
    await waitFor(() => expect(cajon.queryByRole("button", { name: ADAPTADOR.botonResolver })).toBeNull(), WAIT);
  });

  it("un ticket ya resuelto no ofrece «Resolver»", async () => {
    await cargar(0);
    const cajon = await abrir("Duda de factura");
    expect(cajon.queryByRole("button", { name: ADAPTADOR.botonResolver })).toBeNull();
  });

  it("si falla cambiar el estado avisa con error y el estado no cambia", async () => {
    libs.updateTicketStatus.mockRejectedValue(new Error("fallo"));
    await cargar(0);
    await abrir("Botón de pago roto");
    ADAPTADOR.elegir("estado", "Cerrado", true);
    await waitFor(() => expect(toastSpy.mock.calls.some(([a]) => a?.variant === "destructive")).toBe(true), WAIT);
    expect(ADAPTADOR.valor("estado", true)).toBe("Recibido");
    expect(within(filaDe("Botón de pago roto")).getByText("Recibido")).toBeInTheDocument();
  });

  it("cambiar la prioridad llama a la función y se refleja en la fila", async () => {
    await cargar(0);
    await abrir("Cambiar logotipo");
    ADAPTADOR.elegir("prioridad", "Urgente", true);
    await waitFor(() => expect(libs.updateTicketPriority).toHaveBeenCalledWith("t2", "urgente"), WAIT);
    await waitFor(() => expect(within(filaDe("Cambiar logotipo")).getByText("Urgente")).toBeInTheDocument(), WAIT);
  });

  it("tras cambiar algo la actividad pasa a «ahora» y el ticket sube al primer lugar de la lista", async () => {
    await cargar(0);
    await abrir("Cambiar logotipo");
    ADAPTADOR.elegir("prioridad", "Alta", true);
    await waitFor(() => expect(enLista()[0]).toBe("Cambiar logotipo"), WAIT);
  });
});

describe("cajón · asignar (solo administrador)", () => {
  it("el administrador carga el equipo una vez y ve el selector con los roles", async () => {
    await cargar(0);
    await abrir("Botón de pago roto");
    await waitFor(() => expect(libs.getTeamMembers).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(ADAPTADOR.opciones("asignarA", true)).toEqual([
      ADAPTADOR.sinAsignarCajon, "ana@example.test (Admin)", "luis@example.test (Colaborador)",
    ]), WAIT);
  });

  it("asignar un ticket recibido lo avanza a «Asignado», avisa y actualiza la fila", async () => {
    await cargar(0);
    await abrir("Botón de pago roto");
    await waitFor(() => expect(ADAPTADOR.opciones("asignarA", true)).toHaveLength(3), WAIT);
    ADAPTADOR.elegir("asignarA", "luis@example.test (Colaborador)", true);
    await waitFor(() => expect(libs.assignTicket).toHaveBeenCalledWith("t1", "u-luis", "abierto"), WAIT);
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Ticket asignado", description: "Responsable: luis@example.test" }), WAIT);
    const fila = within(filaDe("Botón de pago roto"));
    await waitFor(() => expect(fila.getByText("Asignado")).toBeInTheDocument(), WAIT);
    expect(fila.getByText("luis@example.test")).toBeInTheDocument();
  });

  it("asignar un ticket en revisión también lo avanza a «Asignado»", async () => {
    await cargar(0);
    await abrir("Servidor caído");
    await waitFor(() => expect(ADAPTADOR.opciones("asignarA", true)).toHaveLength(3), WAIT);
    ADAPTADOR.elegir("asignarA", "ana@example.test (Admin)", true);
    await waitFor(() => expect(libs.assignTicket).toHaveBeenCalledWith("t4", "u-ana", "en_revision"), WAIT);
    await waitFor(() => expect(within(filaDe("Servidor caído")).getByText("Asignado")).toBeInTheDocument(), WAIT);
  });

  it("asignar un ticket en progreso NO cambia su estado", async () => {
    await cargar(0);
    await abrir("Cambiar logotipo");
    await waitFor(() => expect(ADAPTADOR.opciones("asignarA", true)).toHaveLength(3), WAIT);
    ADAPTADOR.elegir("asignarA", "luis@example.test (Colaborador)", true);
    await waitFor(() => expect(libs.assignTicket).toHaveBeenCalledWith("t2", "u-luis", "en_progreso"), WAIT);
    await waitFor(() => expect(within(filaDe("Cambiar logotipo")).getByText("luis@example.test")).toBeInTheDocument(), WAIT);
    expect(within(filaDe("Cambiar logotipo")).getByText("En progreso")).toBeInTheDocument();
  });

  it("quitar la asignación la limpia y lo avisa", async () => {
    await cargar(0);
    await abrir("Cambiar logotipo");
    await waitFor(() => expect(ADAPTADOR.opciones("asignarA", true)).toHaveLength(3), WAIT);
    ADAPTADOR.elegir("asignarA", ADAPTADOR.sinAsignarCajon, true);
    await waitFor(() => expect(libs.assignTicket).toHaveBeenCalledWith("t2", null, "en_progreso"), WAIT);
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Asignación removida", description: undefined }), WAIT);
  });

  it("el colaborador no ve el selector de asignación y no pide el equipo", async () => {
    await cargar(1);
    await abrir("Botón de pago roto");
    expect(ADAPTADOR.existe("asignarA", true)).toBe(false);
    expect(libs.getTeamMembers).not.toHaveBeenCalled();
  });
});

describe("cajón · convertir en proyecto (solo administrador, en revisión y sin proyecto)", () => {
  it("lo ofrece al administrador para una solicitud en revisión sin proyecto", async () => {
    await cargar(0);
    const cajon = await abrir("Solicitud de tienda");
    expect(cajon.getByRole("button", { name: ADAPTADOR.botonConvertir })).toBeInTheDocument();
  });

  it("no lo ofrece si ya tiene proyecto, si no está en revisión o si es colaborador", async () => {
    await cargar(0);
    let cajon = await abrir("Servidor caído"); // en revisión pero con proyecto
    expect(cajon.queryByRole("button", { name: ADAPTADOR.botonConvertir })).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    cajon = await abrir("Botón de pago roto"); // recibido
    expect(cajon.queryByRole("button", { name: ADAPTADOR.botonConvertir })).toBeNull();
  });

  it("un colaborador no lo ve aunque el ticket esté en revisión sin proyecto", async () => {
    await cargar(1);
    const cajon = await abrir("Solicitud de tienda");
    expect(cajon.queryByRole("button", { name: ADAPTADOR.botonConvertir })).toBeNull();
  });
});

describe("cajón · responder", () => {
  it("envía la respuesta recortada, avisa al cliente, vacía la caja, recarga el hilo y sube la actividad", async () => {
    await cargar(0);
    const cajon = await abrir("Cambiar logotipo");
    const caja = cajon.getByRole("textbox");
    fireEvent.change(caja, { target: { value: "  Listo, ya lo cambiamos  " } });
    fireEvent.click(cajon.getByRole("button", { name: ADAPTADOR.botonResponder }));
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalledWith("t2", "MultiStack Team", "Listo, ya lo cambiamos"), WAIT);
    await waitFor(() => expect(libs.notifyTeamReply).toHaveBeenCalledWith("t2", "m-nuevo"), WAIT);
    await waitFor(() => expect(caja).toHaveValue(""), WAIT);
    await waitFor(() => expect(libs.getTicketMessages).toHaveBeenCalledTimes(2), WAIT);
    await waitFor(() => expect(enLista()[0]).toBe("Cambiar logotipo"), WAIT);
  });

  it("Ctrl+Enter envía; Enter solo no; un texto en blanco no envía y el botón está desactivado", async () => {
    await cargar(0);
    const cajon = await abrir("Cambiar logotipo");
    const caja = cajon.getByRole("textbox");
    expect(cajon.getByRole("button", { name: ADAPTADOR.botonResponder })).toBeDisabled();
    fireEvent.change(caja, { target: { value: "   " } });
    expect(cajon.getByRole("button", { name: ADAPTADOR.botonResponder })).toBeDisabled();
    fireEvent.keyDown(caja, { key: "Enter", ctrlKey: true });
    fireEvent.change(caja, { target: { value: "Hola" } });
    fireEvent.keyDown(caja, { key: "Enter" });
    expect(libs.addTeamMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(caja, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalledWith("t2", "MultiStack Team", "Hola"), WAIT);
  });

  it("Cmd+Enter también envía", async () => {
    await cargar(0);
    const cajon = await abrir("Cambiar logotipo");
    const caja = cajon.getByRole("textbox");
    fireEvent.change(caja, { target: { value: "Con Cmd" } });
    fireEvent.keyDown(caja, { key: "Enter", metaKey: true });
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalledWith("t2", "MultiStack Team", "Con Cmd"), WAIT);
  });

  it("si el aviso por correo falla, la respuesta queda guardada y se informa", async () => {
    libs.notifyTeamReply.mockResolvedValue(false);
    await cargar(0);
    const cajon = await abrir("Cambiar logotipo");
    fireEvent.change(cajon.getByRole("textbox"), { target: { value: "Hola" } });
    fireEvent.click(cajon.getByRole("button", { name: ADAPTADOR.botonResponder }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({
      title: "Respuesta guardada", description: "No se pudo enviar el aviso por correo al cliente.",
    }), WAIT);
  });

  it("un ticket interno (sin correo de cliente) guarda el mensaje y no avisa a nadie", async () => {
    await cargar(0);
    const cajon = await abrir("Consulta archivada");
    fireEvent.change(cajon.getByRole("textbox"), { target: { value: "Nota interna" } });
    fireEvent.click(cajon.getByRole("button", { name: ADAPTADOR.botonResponder }));
    await waitFor(() => expect(libs.addTeamMessage).toHaveBeenCalledWith("t6", "MultiStack Team", "Nota interna"), WAIT);
    expect(libs.notifyTeamReply).not.toHaveBeenCalled();
  });

  it("si guardar falla avisa con error y conserva el texto escrito", async () => {
    libs.addTeamMessage.mockRejectedValue(new Error("fallo"));
    await cargar(0);
    const cajon = await abrir("Cambiar logotipo");
    const caja = cajon.getByRole("textbox");
    fireEvent.change(caja, { target: { value: "No se pierde" } });
    fireEvent.click(cajon.getByRole("button", { name: ADAPTADOR.botonResponder }));
    await waitFor(() => expect(toastSpy.mock.calls.some(([a]) => a?.variant === "destructive")).toBe(true), WAIT);
    expect(caja).toHaveValue("No se pierde");
  });
});

describe("el ticket abierto no cambia por datos de otro", () => {
  it("el cajón usa el ticket elegido", async () => {
    await cargar(0);
    await abrir("Duda de factura");
    expect(libs.getTicketMessages).toHaveBeenCalledWith("t3");
    expect(porId("t3").title).toBe("Duda de factura");
  });
});
