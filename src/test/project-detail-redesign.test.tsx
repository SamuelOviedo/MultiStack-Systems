// El detalle de proyecto rediseñado: roles y nombres accesibles, etiquetas asociadas, estados por texto,
// confirmaciones de borrado, fechas y moneda sin suposiciones. (Las reglas de negocio las fijan las pruebas de
// caracterización `project-*-characterization`.) Datos inventados en `./helpers/projectFixtures`.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AHORA, maintenance, project, service, services3, stage, stages4, tickets3, tokens2 } from "./helpers/projectFixtures";

process.env.TZ = "UTC";

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
  getProject: vi.fn(),
  getProjectStages: vi.fn(),
  getProjectServices: vi.fn(),
  getProjectMaintenance: vi.fn(),
  deleteService: vi.fn(),
  updateProject: vi.fn(),
  upsertStage: vi.fn(),
  createService: vi.fn(),
  upsertMaintenance: vi.fn(),
  getProjectTickets: vi.fn(),
  getProjectTokens: vi.fn(),
  generateToken: vi.fn(),
  getTicketMessages: vi.fn(),
  getTeamMembers: vi.fn(),
}));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  getProject: libs.getProject,
  getProjectStages: libs.getProjectStages,
  getProjectServices: libs.getProjectServices,
  getProjectMaintenance: libs.getProjectMaintenance,
  deleteService: libs.deleteService,
  updateProject: libs.updateProject,
  upsertStage: libs.upsertStage,
  createService: libs.createService,
  upsertMaintenance: libs.upsertMaintenance,
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  getProjectTickets: libs.getProjectTickets,
  getProjectTokens: libs.getProjectTokens,
  generateToken: libs.generateToken,
  getTicketMessages: libs.getTicketMessages,
  getTeamMembers: libs.getTeamMembers,
}));

import ProjectDetail from "@/pages/dashboard/ProjectDetail";

const UUID = "0000000a-0000-4000-8000-000000000001";
const TZ_INICIAL = process.env.TZ;

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
const escribirPortapapeles = vi.fn();
beforeEach(() => {
  process.env.TZ = TZ_INICIAL;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(AHORA));
  auth.userType = 0;
  auth.user = { id: "u-admin", email: "persona@example.test" };
  toastSpy.mockReset();
  escribirPortapapeles.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escribirPortapapeles }, configurable: true });
  libs.getProject.mockReset().mockResolvedValue(project());
  libs.getProjectStages.mockReset().mockResolvedValue(stages4());
  libs.getProjectServices.mockReset().mockResolvedValue(services3());
  libs.getProjectMaintenance.mockReset().mockResolvedValue([
    maintenance({ id: "m-2", month: "2026-11-01", status: "pendiente", tasks_done: null, billed: false, billed_amount: null }),
    maintenance(),
  ]);
  libs.getProjectTickets.mockReset().mockResolvedValue(tickets3());
  libs.getProjectTokens.mockReset().mockResolvedValue(tokens2());
  libs.deleteService.mockReset().mockResolvedValue(undefined);
  libs.updateProject.mockReset().mockResolvedValue(undefined);
  libs.upsertStage.mockReset().mockResolvedValue(undefined);
  libs.createService.mockReset().mockResolvedValue(undefined);
  libs.upsertMaintenance.mockReset().mockResolvedValue(undefined);
  libs.generateToken.mockReset().mockResolvedValue(undefined);
  libs.getTicketMessages.mockReset().mockResolvedValue([]);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function montar() {
  return render(
    <MemoryRouter initialEntries={["/dashboard/project/p-1"]}>
      <Routes>
        <Route path="/dashboard/project/:id" element={<ProjectDetail />} />
        <Route path="/dashboard" element={<p>RESUMEN-STUB</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const cargado = () => screen.findByRole("heading", { level: 1, name: "Portal Corporativo Alfa" }, WAIT);
const abrirTab = (nombre: RegExp) => fireEvent.mouseDown(screen.getByRole("tab", { name: nombre }), { button: 0 });

/** Toda `<label>` apunta (htmlFor) a un control que existe. */
function etiquetasAsociadas(raiz: ParentNode) {
  const labels = Array.from(raiz.querySelectorAll("label"));
  expect(labels.length).toBeGreaterThan(0);
  for (const l of labels) {
    expect(l.htmlFor, `«${l.textContent}» sin htmlFor`).not.toBe("");
    expect(document.getElementById(l.htmlFor), `«${l.textContent}» apunta a un id inexistente`).not.toBeNull();
  }
}

describe("cabecera", () => {
  it("un solo h1 con el nombre, la insignia de estado con texto y la fecha de alta", async () => {
    montar();
    const h1 = await cargado();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const cabecera = h1.closest("header")!;
    const insignia = cabecera.querySelector('[data-kind="project"]') as HTMLElement;
    expect(insignia).toHaveTextContent("Activo");
    expect(within(cabecera).getByText(/Creado el/)).toBeInTheDocument();
    expect(cabecera.querySelector("time")).toHaveAttribute("datetime", "2026-10-01T15:00:00.000Z");
    expect(cabecera.querySelector("time")).toHaveTextContent("1 oct 2026");
  });

  it("«Volver al resumen» lleva a /dashboard", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("link", { name: "Volver al resumen" })).toHaveAttribute("href", "/dashboard");
  });

  it("sin estilo de consola en ninguna pestaña: ni «$ », ni corchetes, ni nombres de campo", async () => {
    montar();
    await cargado();
    for (const tab of [/^Servicios/, /^Tickets/, /^Acceso/]) {
      abrirTab(tab);
      await waitFor(() => expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true"), WAIT);
      expect(document.body.textContent).not.toMatch(/\$ [a-z]|\[ [A-ZÁÉÍÓÚ ]+ \]|nombre_cliente:|email_cliente:/);
    }
  });

  it("mientras carga hay un estado anunciado", () => {
    libs.getProject.mockReturnValue(new Promise(() => {}));
    montar();
    expect(screen.getByRole("status")).toHaveTextContent(/cargando el proyecto/i);
  });
});

describe("pipeline como lista accesible", () => {
  const item = (nombre: RegExp) => screen.getAllByRole("listitem").find((li) => nombre.test(li.textContent ?? ""))!;

  it("es una lista ordenada de 6 etapas dentro de una región con nombre", async () => {
    montar();
    await cargado();
    const region = screen.getByRole("region", { name: /pipeline del proyecto/i });
    const lista = within(region).getByRole("list");
    expect(lista.tagName).toBe("OL");
    expect(within(lista).getAllByRole("listitem")).toHaveLength(6);
  });

  it("cada etapa dice su estado con TEXTO: completada, actual (la primera que falta) o pendiente", async () => {
    montar();
    await cargado();
    for (const e of [/Análisis/, /Adquisición de Dominio/, /Desarrollo/, /Despliegue/]) expect(item(e)).toHaveTextContent("Completada");
    expect(item(/^Entrega/)).toHaveTextContent("Actual");
    expect(item(/Mantenimiento Activo/)).toHaveTextContent("Pendiente");
    expect(screen.getAllByText("Actual")).toHaveLength(1);
  });

  it("la etapa actual lleva aria-current=step y solo ella", async () => {
    montar();
    await cargado();
    const marcadas = screen.getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "step");
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]).toHaveTextContent("Entrega");
  });

  it("con todas las etapas completadas ninguna es «actual»", async () => {
    libs.getProjectStages.mockResolvedValue(["analisis", "dominio", "desarrollo", "despliegue", "entrega", "mantenimiento"].map((k) => stage(k)));
    montar();
    await cargado();
    expect(screen.queryByText("Actual")).toBeNull();
    expect(screen.getAllByText("Completada")).toHaveLength(6);
  });

  it("la fecha de completado es legible y va en <time datetime>", async () => {
    montar();
    await cargado();
    const t = item(/Análisis/).querySelector("time")!;
    expect(t).toHaveAttribute("datetime", "2026-10-05T15:00:00.000Z");
    expect(t).toHaveTextContent("5 oct 2026");
  });

  it("un responsable que es un identificador NO se muestra crudo: «Responsable asignado»", async () => {
    libs.getProjectStages.mockResolvedValue([stage("analisis", { completed_by: UUID }), ...stages4().slice(1)]);
    montar();
    await cargado();
    expect(item(/Análisis/)).toHaveTextContent("Responsable asignado");
    expect(document.body.textContent).not.toContain(UUID);
    expect(document.body.innerHTML).not.toContain(UUID);
  });

  it("un responsable con nombre se muestra y sin responsable se omite sin dejar separadores", async () => {
    libs.getProjectStages.mockResolvedValue([stage("analisis", { completed_by: "Persona Demo" }), stage("dominio", { completed_by: null })]);
    montar();
    await cargado();
    expect(item(/Análisis/)).toHaveTextContent("Persona Demo");
    expect(item(/Adquisición de Dominio/).textContent).not.toMatch(/·\s*$/);
    expect(item(/Adquisición de Dominio/).textContent).not.toContain("Responsable asignado");
  });

  it("el botón de plegar informa aria-expanded y controla la lista; plegada no se alcanza con el teclado", async () => {
    montar();
    await cargado();
    const toggle = screen.getByRole("button", { name: /pipeline del proyecto/i });
    const lista = screen.getByRole("list");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle.getAttribute("aria-controls")).toBe(lista.id);
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(lista).toHaveAttribute("hidden");
    expect(screen.queryByRole("button", { name: /^Análisis/ })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /^Análisis/ })).toBeInTheDocument();
  });

  it("con 5 etapas empieza plegada: el botón lo dice con aria-expanded=false", async () => {
    libs.getProjectStages.mockResolvedValue([...stages4(), stage("entrega")]);
    montar();
    await cargado();
    await waitFor(() => expect(screen.getByRole("button", { name: /pipeline del proyecto/i })).toHaveAttribute("aria-expanded", "false"), WAIT);
  });

  it("la barra de avance tiene nombre y valor", async () => {
    montar();
    await cargado();
    const barra = screen.getByRole("progressbar", { name: /avance del proyecto: 4 de 6 etapas/i });
    expect(barra).toHaveAttribute("aria-valuenow", "67");
  });

  it("el importe del resumen lleva su moneda solo si está registrada; si no, lo dice sin suponer una", async () => {
    libs.getProjectStages.mockResolvedValue([
      stage("dominio", { metadata: { dominio: "a", precio_anual: "12.00", moneda: "HNL" } }),
      stage("mantenimiento", { metadata: { precio_mensual: "500.00" } }),
    ]);
    montar();
    await cargado();
    expect(item(/Adquisición de Dominio/)).toHaveTextContent("12.00 HNL/año");
    expect(item(/Mantenimiento Activo/)).toHaveTextContent("500.00/mes (moneda no registrada)");
    expect(item(/Mantenimiento Activo/).textContent).not.toMatch(/USD|HNL/);
  });

  it("entrega: las marcas se dicen con palabras, no con símbolos", async () => {
    libs.getProjectStages.mockResolvedValue([stage("entrega", { metadata: { accesos_entregados: true, factura_emitida: true } })]);
    montar();
    await cargado();
    expect(item(/^Entrega/)).toHaveTextContent("Accesos entregados · Factura emitida");
    expect(item(/^Entrega/).textContent).not.toMatch(/✓/);
  });
});

describe("identidad del proyecto", () => {
  it("los datos van en una lista de definición con sus términos", async () => {
    montar();
    await cargado();
    const region = screen.getByRole("region", { name: "Datos del proyecto" });
    const terminos = Array.from(region.querySelectorAll("dt")).map((d) => d.textContent);
    expect(terminos).toEqual(["Descripción", "Cliente", "Correo", "Teléfono", "Documento de requerimientos", "Creado"]);
  });

  it("el correo y el teléfono son enlaces utilizables", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("link", { name: "cliente@example.test" })).toHaveAttribute("href", "mailto:cliente@example.test");
    expect(screen.getByRole("link", { name: "+504 0000-0000" })).toHaveAttribute("href", "tel:+50400000000");
  });

  it("el documento de requerimientos avisa que se abre en otra pestaña", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("link", { name: /documento de requerimientos.*otra pestaña/i })).toHaveAttribute("target", "_blank");
  });

  it("un dato que falta se dice («No registrado») en vez de dejar un hueco", async () => {
    libs.getProject.mockResolvedValue(project({ descripcion: null, client_phone: null }));
    montar();
    await cargado();
    expect(screen.getAllByText("No registrado")).toHaveLength(2);
  });

  it("editar muestra un formulario con etiquetas visibles asociadas a cada campo", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: "Editar proyecto" }));
    const form = screen.getByRole("form", { name: "Editar proyecto" });
    etiquetasAsociadas(form);
    for (const nombre of ["Nombre del proyecto", "Descripción", "Nombre del cliente", "Correo del cliente", "Teléfono del cliente", "Documento de requerimientos"]) {
      expect(within(form).getByLabelText(nombre)).toBeInTheDocument();
    }
    expect(within(form).getByRole("combobox", { name: "Estado" })).toBeInTheDocument();
    expect(within(form).getByRole("group", { name: "Datos del cliente" })).toBeInTheDocument();
  });

  it("el estado se elige entre los 7 del dominio", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: "Editar proyecto" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Estado" }), { key: "ArrowDown" });
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "En análisis", "En desarrollo", "En despliegue", "Activo", "Mantenimiento", "Pausado", "Cancelado",
    ]);
  });

  it("Enter dentro del formulario guarda, y un segundo envío mientras guarda se ignora", async () => {
    let resolver!: () => void;
    libs.updateProject.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: "Editar proyecto" }));
    const form = screen.getByRole("form", { name: "Editar proyecto" });
    fireEvent.submit(form);
    await waitFor(() => expect(libs.updateProject).toHaveBeenCalledTimes(1), WAIT);
    fireEvent.submit(form);
    expect(libs.updateProject).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    resolver();
  });

  it("los campos de contacto declaran su tipo de teclado sin cambiar cómo se guardan", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: "Editar proyecto" }));
    expect(screen.getByLabelText("Teléfono del cliente")).toHaveAttribute("inputmode", "tel");
    expect(screen.getByLabelText("Correo del cliente")).toHaveAttribute("inputmode", "email");
    expect(screen.getByLabelText("Documento de requerimientos")).toHaveAttribute("type", "url");
  });
});

describe("pestañas", () => {
  it("lista de pestañas con nombre accesible y contadores con palabras", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Servicios (3 en total)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Tickets (2 abiertos)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acceso (2 enlaces)" })).toBeInTheDocument();
  });

  it("el panel activo está asociado a su pestaña", async () => {
    montar();
    await cargado();
    const tab = screen.getByRole("tab", { name: /^Tickets/ });
    abrirTab(/^Tickets/);
    const panel = await screen.findByRole("tabpanel", {}, WAIT);
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
  });

  it("el contador de tickets no late (sin animación decorativa)", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("tab", { name: /^Tickets/ }).innerHTML).not.toMatch(/animate-pulse/);
  });

  it("Tickets: el filtro tiene etiqueta visible, filtra y el vacío con filtro lo explica", async () => {
    montar();
    await cargado();
    abrirTab(/^Tickets/);
    await screen.findByText("Cambiar el banner de inicio", {}, WAIT);
    const filtro = screen.getByRole("combobox", { name: "Estado" });
    fireEvent.keyDown(filtro, { key: "ArrowDown" });
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Resuelto")!);
    await waitFor(() => expect(screen.queryByText("Cambiar el banner de inicio")).toBeNull(), WAIT);
    expect(screen.getByText("Consulta sobre facturación")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Estado" }), { key: "ArrowDown" });
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Cerrado")!);
    expect(await screen.findByText("Ningún ticket con este estado", {}, WAIT)).toBeInTheDocument();
  });

  it("Tickets: estado y prioridad con StatusBadge (texto) y mensajes con palabras", async () => {
    montar();
    await cargado();
    abrirTab(/^Tickets/);
    const fila = (await screen.findByText("Error al enviar el formulario", {}, WAIT)).closest("button")!;
    expect(fila.querySelector('[data-kind="priority"]')).toHaveTextContent("Urgente");
    expect(fila.querySelector('[data-kind="ticket"]')).toHaveTextContent("En progreso");
    expect(screen.getByText("Cambiar el banner de inicio").closest("button")).toHaveTextContent("2 mensajes");
    expect(screen.getByText("Consulta sobre facturación").closest("button")).toHaveTextContent("1 mensaje");
  });

  it("Tickets: sin tickets invita a crear uno", async () => {
    libs.getProjectTickets.mockResolvedValue([]);
    montar();
    await cargado();
    abrirTab(/^Tickets/);
    expect(await screen.findByRole("heading", { name: "Este proyecto no tiene tickets" }, WAIT)).toBeInTheDocument();
  });

  it("abrir un ticket lleva el foco al cajón y «Cerrar» está en español", async () => {
    montar();
    await cargado();
    abrirTab(/^Tickets/);
    fireEvent.click((await screen.findByText("Cambiar el banner de inicio", {}, WAIT)).closest("button")!);
    const cajon = await screen.findByRole("dialog", {}, WAIT);
    expect(within(cajon).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });
});

describe("servicios en tabla", () => {
  it("columnas con nombre, tabla en una región con nombre que se puede desplazar con teclado", async () => {
    montar();
    await cargado();
    const region = screen.getByRole("region", { name: "Servicios del proyecto" });
    expect(region).toHaveAttribute("tabindex", "0");
    const cabeceras = within(region).getAllByRole("columnheader").map((h) => h.textContent);
    expect(cabeceras).toEqual(["Servicio", "Tipo", "Proveedor", "Renovación", "Costo anual", "Acciones"]);
    expect(within(region).getAllByRole("row")).toHaveLength(4);
  });

  it("renovaciones con la misma regla del Resumen: Urgente (7 días o menos), Próxima (hasta 30) y nada si es lejana", async () => {
    libs.getProjectServices.mockResolvedValue([
      service({ id: "a", name: "Cercano", renewal_date: "2026-11-07" }),
      service({ id: "b", name: "Medio", renewal_date: "2026-11-25" }),
      service({ id: "c", name: "Lejano", renewal_date: "2027-03-01" }),
      service({ id: "d", name: "Vencido", renewal_date: "2026-10-30" }),
    ]);
    montar();
    await cargado();
    const fila = (n: string) => screen.getByText(n).closest("tr")!;
    expect(fila("Cercano")).toHaveTextContent("Urgente");
    expect(fila("Cercano")).toHaveTextContent("en 5 días");
    expect(fila("Cercano")).toHaveTextContent("7 nov 2026");
    expect(fila("Medio")).toHaveTextContent("Próxima");
    expect(fila("Lejano").querySelector('[data-kind="custom"]')).toBeNull();
    expect(fila("Lejano")).toHaveTextContent("1 mar 2027");
    expect(fila("Vencido")).toHaveTextContent("Vencida");
    expect(fila("Vencido")).toHaveTextContent("hace 3 días");
  });

  it("la fecha de renovación no se corre un día en la zona de Honduras", async () => {
    process.env.TZ = "America/Tegucigalpa";
    montar();
    await cargado();
    expect(screen.getByText("alfa.example.test").closest("tr")).toHaveTextContent("7 nov 2026");
  });

  it("el costo anual sale con la moneda registrada en el servicio y, sin ella, sin inventar una; el mensual no se muestra", async () => {
    libs.getProjectServices.mockResolvedValue([
      service({ id: "a", name: "Con moneda", cost_yearly: 12, cost_monthly: 3, currency: "HNL" }),
      service({ id: "b", name: "Sin moneda", cost_yearly: 40, cost_monthly: null, currency: "" }),
      service({ id: "c", name: "Sin costo", cost_yearly: null, cost_monthly: null }),
    ]);
    montar();
    await cargado();
    const fila = (n: string) => screen.getByText(n).closest("tr")!;
    expect(fila("Con moneda")).toHaveTextContent("12 HNL/año");
    // Misma exposición que antes del rediseño: la lista nunca mostró el costo mensual (ni en la tabla ni en la línea móvil).
    expect(fila("Con moneda").textContent).not.toMatch(/\/mes/);
    expect(fila("Con moneda").textContent).not.toMatch(/\b3\b/);
    expect(fila("Sin moneda")).toHaveTextContent("40/año");
    expect(fila("Sin moneda").textContent).not.toMatch(/USD|HNL/);
    expect(within(fila("Sin costo")).getByText("Sin costo anual registrado")).toBeInTheDocument();
  });

  it("un servicio con solo costo mensual no muestra importe: sale como sin costo anual", async () => {
    libs.getProjectServices.mockResolvedValue([service({ id: "m", name: "Solo mensual", cost_yearly: null, cost_monthly: 20, currency: "USD" })]);
    montar();
    await cargado();
    const fila = screen.getByText("Solo mensual").closest("tr")!;
    expect(fila.textContent).not.toMatch(/\b20\b|USD|\/mes/);
    expect(within(fila).getByText("Sin costo anual registrado")).toBeInTheDocument();
  });

  it("sin servicios: estado vacío con título y explicación", async () => {
    libs.getProjectServices.mockResolvedValue([]);
    montar();
    await cargado();
    expect(screen.getByRole("heading", { name: "Aún no hay servicios registrados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar servicio" })).toBeInTheDocument();
  });
});

describe("borrar un servicio pide confirmación", () => {
  const pedirBorrado = (nombre: string) => fireEvent.click(screen.getByRole("button", { name: `Eliminar ${nombre}` }));

  it("el botón de cada fila dice qué elimina", async () => {
    montar();
    await cargado();
    for (const s of services3()) expect(screen.getByRole("button", { name: `Eliminar ${s.name}` })).toBeInTheDocument();
  });

  it("abre un diálogo de alerta con el nombre del servicio y NO borra todavía", async () => {
    montar();
    await cargado();
    pedirBorrado("Alojamiento Alfa");
    const dialogo = await screen.findByRole("alertdialog", { name: /Alojamiento Alfa/ }, WAIT);
    expect(within(dialogo).getByText(/Vercel · Hosting/)).toBeInTheDocument();
    expect(within(dialogo).getByText(/no se puede deshacer/i)).toBeInTheDocument();
    expect(libs.deleteService).not.toHaveBeenCalled();
  });

  it("el foco empieza en el botón seguro («Cancelar»), no en el destructivo", async () => {
    montar();
    await cargado();
    pedirBorrado("Alojamiento Alfa");
    const dialogo = await screen.findByRole("alertdialog", {}, WAIT);
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();
  });

  it("Cancelar y Escape cierran sin borrar", async () => {
    montar();
    await cargado();
    pedirBorrado("Alojamiento Alfa");
    fireEvent.click(within(await screen.findByRole("alertdialog", {}, WAIT)).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull(), WAIT);
    pedirBorrado("Alojamiento Alfa");
    fireEvent.keyDown(await screen.findByRole("alertdialog", {}, WAIT), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull(), WAIT);
    expect(libs.deleteService).not.toHaveBeenCalled();
  });

  it("«Eliminar servicio» borra el servicio elegido, recarga y deja el foco en «Agregar servicio»", async () => {
    montar();
    await cargado();
    pedirBorrado("Alojamiento Alfa");
    fireEvent.click(within(await screen.findByRole("alertdialog", {}, WAIT)).getByRole("button", { name: "Eliminar servicio" }));
    await waitFor(() => expect(libs.deleteService).toHaveBeenCalledWith("sv-2"), WAIT);
    await waitFor(() => expect(libs.getProject).toHaveBeenCalledTimes(2), WAIT);
    await waitFor(() => expect(screen.getByRole("button", { name: "Agregar servicio" })).toHaveFocus(), WAIT);
  });

  it("si el borrado falla: aviso claro y sin texto técnico", async () => {
    libs.deleteService.mockRejectedValue(Object.assign(new Error("violates foreign key constraint"), { code: "23503" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    montar();
    await cargado();
    pedirBorrado("Alojamiento Alfa");
    fireEvent.click(within(await screen.findByRole("alertdialog", {}, WAIT)).getByRole("button", { name: "Eliminar servicio" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    const aviso = toastSpy.mock.calls.at(-1)![0];
    expect(aviso).toMatchObject({ title: "No se pudo eliminar el servicio", variant: "destructive" });
    expect(JSON.stringify(aviso)).not.toMatch(/foreign key|23503/);
    expect(libs.getProject).toHaveBeenCalledTimes(1);
  });
});

describe("mantenimiento mensual", () => {
  it("el mes sale en español y en minúscula natural, sin mayúsculas forzadas por CSS", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("button", { name: /noviembre de 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /octubre de 2026/ })).toBeInTheDocument();
    expect(document.body.innerHTML).not.toMatch(/\bcapitalize\b/);
    expect(document.body.textContent).not.toMatch(/Noviembre De|Octubre De/);
  });

  it("el mes de «2026-11-01» es noviembre también en la zona de Honduras (UTC-6), donde `formatMonth` retrocedía un mes", async () => {
    process.env.TZ = "America/Tegucigalpa";
    montar();
    await cargado();
    expect(screen.getByRole("button", { name: /noviembre de 2026/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /octubre de 2026/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /septiembre de 2026/ })).toBeNull();
  });

  it("es una tabla; el importe se rotula «moneda no registrada» y no lleva una moneda inventada", async () => {
    montar();
    await cargado();
    const region = screen.getByRole("region", { name: "Registros de mantenimiento" });
    expect(within(region).getAllByRole("columnheader").map((h) => h.textContent)).toEqual([
      "Mes", "Estado", "Tareas", "Importe cobrado (moneda no registrada)",
    ]);
    const octubre = screen.getByRole("button", { name: /octubre de 2026/ }).closest("tr")!;
    expect(octubre).toHaveTextContent("100");
    expect(octubre.textContent).not.toMatch(/USD|HNL|L\.|\$/);
    expect(octubre).toHaveTextContent("2 tareas");
    expect(octubre.querySelector('[data-kind="custom"]')).toHaveTextContent("Completado");
  });

  it("el formulario: etiquetas asociadas, importe numérico rotulado sin moneda y «Cerrar» en español", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: "Registrar mes" }));
    const hoja = await screen.findByRole("dialog", { name: "Registrar mes de mantenimiento" }, WAIT);
    fireEvent.click(within(hoja).getByRole("checkbox", { name: "Cobrado al cliente" }));
    etiquetasAsociadas(hoja);
    const importe = within(hoja).getByLabelText("Importe cobrado (moneda no registrada)");
    expect(importe).toHaveAttribute("type", "number");
    expect(importe).toHaveAttribute("inputmode", "decimal");
    expect(within(hoja).getByText(/no registra la moneda/i)).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Guardar registro" })).toBeInTheDocument();
  });

  it("la hoja se describe a sí misma (nombre y descripción accesibles)", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: /noviembre de 2026/ }));
    const hoja = await screen.findByRole("dialog", { name: "Editar noviembre de 2026" }, WAIT);
    expect(hoja).toHaveAccessibleDescription(/un registro por mes/i);
  });

  it("al cerrar la hoja el foco vuelve a quien la abrió", async () => {
    montar();
    await cargado();
    const mes = screen.getByRole("button", { name: /octubre de 2026/ });
    mes.focus();
    fireEvent.click(mes);
    fireEvent.keyDown(await screen.findByRole("dialog", {}, WAIT), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(mes).toHaveFocus(), WAIT);
  });
});

describe("acceso del cliente", () => {
  const abrirAcceso = async () => {
    montar();
    await cargado();
    abrirTab(/^Acceso/);
    await screen.findByLabelText("Enlace del portal del cliente", {}, WAIT);
  };

  it("el enlace está en un campo con etiqueta, de solo lectura, con «Copiar enlace» y un enlace de texto claro", async () => {
    await abrirAcceso();
    const campo = screen.getByLabelText("Enlace del portal del cliente");
    expect(campo).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: "Copiar enlace" })).toBeInTheDocument();
    const abrir = screen.getByRole("link", { name: /abrir el portal del cliente/i });
    expect(abrir).toHaveAttribute("href", (campo as HTMLInputElement).value);
    expect(abrir).toHaveAttribute("target", "_blank");
    expect(abrir.getAttribute("rel")).toContain("noopener");
  });

  it("copiar: avisa «Enlace copiado»; si el navegador lo impide, lo dice y no finge", async () => {
    await abrirAcceso();
    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Enlace copiado" }), WAIT);
    escribirPortapapeles.mockRejectedValue(new Error("denegado"));
    toastSpy.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "No se pudo copiar", variant: "destructive" })), WAIT);
  });

  it("los datos del enlace van en una lista de definición con fechas legibles", async () => {
    await abrirAcceso();
    const region = screen.getByRole("region", { name: "Enlace activo" });
    expect(Array.from(region.querySelectorAll("dt")).map((d) => d.textContent)).toEqual(["Cliente", "Correo", "Creado", "Último acceso"]);
    expect(region).toHaveTextContent("10 oct 2026");
  });

  it("regenerar pide confirmación, enfoca «Cancelar» y no genera hasta confirmar", async () => {
    await abrirAcceso();
    fireEvent.click(screen.getByRole("button", { name: "Regenerar enlace" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "¿Regenerar el enlace de acceso?" }, WAIT);
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toHaveFocus();
    expect(dialogo).toHaveAccessibleDescription(/dejará de funcionar/i);
    expect(libs.generateToken).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull(), WAIT);
    expect(libs.generateToken).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Regenerar enlace" }));
    fireEvent.click(within(await screen.findByRole("alertdialog", {}, WAIT)).getByRole("button", { name: "Regenerar enlace" }));
    await waitFor(() => expect(libs.generateToken).toHaveBeenCalledTimes(1), WAIT);
  });

  it("el formulario de datos del cliente tiene etiquetas asociadas", async () => {
    await abrirAcceso();
    const region = screen.getByRole("region", { name: "Acceso del cliente" });
    etiquetasAsociadas(region);
    expect(within(region).getByLabelText("Nombre del cliente")).toBeInTheDocument();
    expect(within(region).getByLabelText("Correo del cliente")).toHaveAttribute("inputmode", "email");
  });

  it("si falla generar, el aviso no trae texto técnico", async () => {
    libs.generateToken.mockRejectedValue(Object.assign(new Error("permission denied for table x"), { code: "42501" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await abrirAcceso();
    fireEvent.click(screen.getByRole("button", { name: "Regenerar enlace" }));
    fireEvent.click(within(await screen.findByRole("alertdialog", {}, WAIT)).getByRole("button", { name: "Regenerar enlace" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    expect(JSON.stringify(toastSpy.mock.calls.at(-1)![0])).not.toMatch(/permission denied|42501/);
  });
});

describe("formulario de servicio", () => {
  const abrir = async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" }));
    return screen.findByRole("dialog", { name: "Agregar servicio externo" }, WAIT);
  };

  it("etiquetas asociadas, obligatorios dichos con palabras, importes numéricos y «Cerrar» en español", async () => {
    const hoja = await abrir();
    etiquetasAsociadas(hoja);
    expect(within(hoja).getByLabelText(/^Proveedor \(obligatorio\)/)).toHaveAttribute("aria-required", "true");
    expect(within(hoja).getByLabelText(/^Nombre \(obligatorio\)/)).toHaveAttribute("aria-required", "true");
    for (const campo of ["Costo mensual", "Costo anual"]) {
      expect(within(hoja).getByLabelText(campo)).toHaveAttribute("type", "number");
      expect(within(hoja).getByLabelText(campo)).toHaveAttribute("inputmode", "decimal");
    }
    expect(within(hoja).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(hoja).toHaveAccessibleDescription(/dominio, hosting/i);
  });

  it("«Guardar servicio» espera proveedor y nombre", async () => {
    const hoja = await abrir();
    expect(within(hoja).getByRole("button", { name: "Guardar servicio" })).toBeDisabled();
  });

  it("mientras guarda, un segundo envío (Enter o clic) se ignora y el botón cambia a «Guardando…»", async () => {
    let resolver!: () => void;
    libs.createService.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    const hoja = await abrir();
    fireEvent.keyDown(within(hoja).getByRole("combobox", { name: /^Proveedor/ }), { key: "ArrowDown" });
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Render")!);
    fireEvent.change(within(hoja).getByLabelText(/^Nombre/), { target: { value: "Servicio uno" } });
    const form = hoja.querySelector("form")!;
    fireEvent.submit(form);
    await waitFor(() => expect(libs.createService).toHaveBeenCalledTimes(1), WAIT);
    fireEvent.submit(form);
    expect(libs.createService).toHaveBeenCalledTimes(1);
    expect(within(hoja).getByRole("button", { name: "Guardando…" })).toBeDisabled();
    resolver();
  });

  it("tras guardar, al volver a abrir el formulario está limpio", async () => {
    const hoja = await abrir();
    fireEvent.keyDown(within(hoja).getByRole("combobox", { name: /^Proveedor/ }), { key: "ArrowDown" });
    fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === "Render")!);
    fireEvent.change(within(hoja).getByLabelText(/^Nombre/), { target: { value: "Servicio uno" } });
    fireEvent.click(within(hoja).getByRole("button", { name: "Guardar servicio" }));
    await waitFor(() => expect(libs.createService).toHaveBeenCalledTimes(1), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    fireEvent.click(screen.getByRole("button", { name: "Agregar servicio" }));
    const otra = await screen.findByRole("dialog", { name: "Agregar servicio externo" }, WAIT);
    expect(within(otra).getByLabelText(/^Nombre/)).toHaveValue("");
    expect(within(otra).getByRole("combobox", { name: /^Proveedor/ })).toHaveTextContent("Elige un proveedor");
  });

  it("el foco vuelve a «Agregar servicio» al cerrar", async () => {
    const boton = (montar(), await cargado(), screen.getByRole("button", { name: "Agregar servicio" }));
    boton.focus();
    fireEvent.click(boton);
    fireEvent.keyDown(await screen.findByRole("dialog", {}, WAIT), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(boton).toHaveFocus(), WAIT);
  });
});

describe("cajón de etapa", () => {
  const abrirEtapa = async (nombre: RegExp) => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: nombre }));
    return screen.findByRole("dialog", {}, WAIT);
  };

  it.each([
    ["Análisis", /^Análisis/],
    ["Adquisición de Dominio", /^Adquisición de Dominio/],
    ["Desarrollo", /^Desarrollo/],
    ["Despliegue", /^Despliegue/],
    ["Entrega", /^Entrega/],
    ["Mantenimiento Activo", /^Mantenimiento Activo/],
  ])("«%s»: se llama como la etapa, se describe, sus etiquetas están asociadas y cierra en español", async (nombre, re) => {
    const hoja = await abrirEtapa(re);
    expect(hoja).toHaveAccessibleName(nombre);
    expect(hoja).toHaveAccessibleDescription();
    etiquetasAsociadas(hoja);
    expect(within(hoja).getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
    expect(within(hoja).getByRole("button", { name: "Guardar etapa" })).toBeInTheDocument();
  });

  it("el responsable que es un identificador no se enseña, se explica y se conserva", async () => {
    libs.getProjectStages.mockResolvedValue([stage("analisis", { completed_by: UUID }), ...stages4().slice(1)]);
    const hoja = await abrirEtapa(/^Análisis/);
    const campo = within(hoja).getByLabelText("Responsable");
    expect(campo).toHaveValue("");
    expect(campo).toHaveAttribute("placeholder", "Responsable asignado");
    expect(campo).toHaveAccessibleDescription(/ya hay un responsable asignado/i);
    expect(document.body.innerHTML).not.toContain(UUID.slice(0, 13));
    fireEvent.click(within(hoja).getByRole("button", { name: "Guardar etapa" }));
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalled(), WAIT);
    expect(libs.upsertStage.mock.calls[0][3].completed_by).toBe(UUID);
  });

  it("los importes son numéricos y la moneda ausente se dice «Sin registrar», no «USD»", async () => {
    libs.getProjectStages.mockResolvedValue([stage("dominio", { metadata: { precio_anual: "12.00" } })]);
    const hoja = await abrirEtapa(/^Adquisición de Dominio/);
    expect(within(hoja).getByLabelText("Precio anual")).toHaveAttribute("type", "number");
    expect(within(hoja).getByLabelText("Precio anual")).toHaveAttribute("inputmode", "decimal");
    expect(within(hoja).getByRole("combobox", { name: "Moneda" })).toHaveTextContent("Sin registrar");
    expect(within(hoja).getByText(/se guarda sin ella/i)).toBeInTheDocument();
  });

  it("el stack son botones con aria-pressed dentro de un grupo con nombre", async () => {
    libs.getProjectStages.mockResolvedValue([stage("desarrollo", { metadata: { stack: ["React"] } })]);
    const hoja = await abrirEtapa(/^Desarrollo/);
    const grupo = within(hoja).getByRole("group", { name: "Stack" });
    expect(within(grupo).getByRole("button", { name: "React" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupo).getByRole("button", { name: "Vue" })).toHaveAttribute("aria-pressed", "false");
  });

  it("un valor guardado que no está en la lista (otro proveedor) se conserva en el selector", async () => {
    libs.getProjectStages.mockResolvedValue([stage("dominio", { metadata: { proveedor: "Hetzner" } })]);
    const hoja = await abrirEtapa(/^Adquisición de Dominio/);
    expect(within(hoja).getByRole("combobox", { name: "Proveedor" })).toHaveTextContent("Hetzner");
    fireEvent.click(within(hoja).getByRole("button", { name: "Guardar etapa" }));
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalled(), WAIT);
    expect(libs.upsertStage.mock.calls[0][3].metadata).toStrictEqual({ proveedor: "Hetzner" });
  });

  it("«Sin elegir» vuelve el selector a vacío (cadena vacía, como el selector de antes)", async () => {
    libs.getProjectStages.mockResolvedValue([stage("despliegue", { metadata: { plataforma: "Vercel" } })]);
    const hoja = await abrirEtapa(/^Despliegue/);
    fireEvent.keyDown(within(hoja).getByRole("combobox", { name: "Plataforma" }), { key: "ArrowDown" });
    fireEvent.click(screen.getByRole("option", { name: "Sin elegir" }));
    fireEvent.click(within(hoja).getByRole("button", { name: "Guardar etapa" }));
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalled(), WAIT);
    expect(libs.upsertStage.mock.calls[0][3].metadata).toStrictEqual({ plataforma: "" });
  });

  it("al cerrar el cajón el foco vuelve a la etapa que lo abrió", async () => {
    montar();
    await cargado();
    const fila = screen.getByRole("button", { name: /^Adquisición de Dominio/ });
    fila.focus();
    fireEvent.click(fila);
    fireEvent.keyDown(await screen.findByRole("dialog", {}, WAIT), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(screen.getByRole("button", { name: /^Adquisición de Dominio/ })).toHaveFocus(), WAIT);
  });

  it("si guardar falla el aviso no trae texto técnico", async () => {
    libs.upsertStage.mockRejectedValue(Object.assign(new Error("new row violates row-level security policy"), { code: "42501" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hoja = await abrirEtapa(/^Análisis/);
    fireEvent.click(within(hoja).getByRole("button", { name: "Guardar etapa" }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    expect(JSON.stringify(toastSpy.mock.calls.at(-1)![0])).not.toMatch(/row-level|42501/);
  });
});
