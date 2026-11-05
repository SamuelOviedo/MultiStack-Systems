// Caracterización de `/dashboard/project/:id` (zona delicada: `load()` compartido que
// recarga 6 consultas, edición de identidad, pipeline). Se escribió contra el código ANTERIOR al rediseño y debe
// seguir en verde después; lo único que se actualiza son los textos y el marcado que cambian a propósito, y viven en
// `ADAPTADOR`, cada uno con su motivo. Los datos son inventados (`./helpers/projectFixtures`).
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AHORA, maintenance2, project, services3, stage, stages4, tickets3, tokens2 } from "./helpers/projectFixtures";

// Zona horaria fija (ver project-tabs-characterization): el reloj y la zona de las pruebas no dependen de la máquina.
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

/**
 * Todo lo que cambia con el rediseño está aquí y en ningún otro sitio de este archivo (con la razón del cambio).
 */
const ADAPTADOR = {
  /** El «volver» conserva su destino (`/dashboard`) pero deja de llamarse «Dashboard» (en el panel es «Resumen»). */
  volver: /^volver al resumen$|^dashboard$/i,
  /** El botón de editar la identidad pasa de «Editar» a «Editar proyecto» (nombre que dice qué se edita). */
  editar: /^editar( proyecto)?$/i,
  /** El botón de guardar la edición: «Guardar» (antes) y «Guardar cambios» (ahora). */
  guardarEdicion: /^guardar( cambios)?$/i,
  /** La X sin texto pasa a «Cancelar» con texto. Antes: botón sin nombre (solo icono) junto a «Guardar». */
  cancelarEdicion: () => {
    const nuevo = screen.queryByRole("button", { name: /^cancelar$/i });
    if (nuevo) return nuevo;
    const guardar = screen.getByRole("button", { name: /^guardar$/i });
    return guardar.parentElement!.querySelectorAll("button")[1] as HTMLElement;
  },
  /** Cuando carga falla el aviso es destructivo; el texto crudo del error ya no se muestra (regla del dashboard). */
  avisoFalloCarga: { variant: "destructive" },
  /** «Sin datos de cliente registrados» se mantiene como texto neutro. */
  sinCliente: /sin datos de cliente/i,
  sinDoc: /sin documento de requerimientos/i,
  linkDoc: /documento de requerimientos/i,
  /** Fecha de completado de una etapa: antes `toLocaleDateString("es-HN")`, ahora un formato largo legible. */
  fechaEtapa: (iso: string) => new Intl.DateTimeFormat("es-HN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)),
  /** El progreso: antes «4/6» y «67%»; ahora «4 de 6 etapas registradas (67 %)». Se normaliza al formato anterior. */
  progreso: (texto: string) => texto.replace(/(\d+) de (\d+)/, "$1/$2").replace(/(\d+) %/, "$1%"),
  /**
   * Estado del bloque de etapas: antes un `max-h-0` animado; ahora `aria-expanded` en el botón.
   * Devuelve true si las etapas están a la vista.
   */
  pipelineAbierto: () => {
    const toggle = screen.getByRole("button", { name: /pipeline/i });
    const aria = toggle.getAttribute("aria-expanded");
    if (aria !== null) return aria === "true";
    return !(toggle.nextElementSibling as HTMLElement).className.includes("max-h-0");
  },
  /** Los campos del formulario de edición se buscan por su valor mostrado (antes no tenían etiqueta). */
  campo: (valor: string) => screen.getByDisplayValue(valor),
  /** Selector de estado en edición: `<select>` nativo (valor «Activo») -> combobox «Estado». */
  selectorEstado: () => {
    const nuevo = screen.queryByRole("combobox", { name: /estado/i });
    return nuevo ?? (screen.getByDisplayValue("Activo") as HTMLElement);
  },
  elegirEstado(etiqueta: string) {
    const el = ADAPTADOR.selectorEstado();
    if (el.tagName === "SELECT") {
      const opt = Array.from((el as HTMLSelectElement).options).find((o) => o.text === etiqueta)!;
      fireEvent.change(el, { target: { value: opt.value } });
    } else {
      fireEvent.keyDown(el, { key: "ArrowDown" });
      fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === etiqueta)!);
    }
  },
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
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(AHORA));
  auth.userType = 0;
  auth.user = { id: "u-admin", email: "persona@example.test" };
  toastSpy.mockReset();
  libs.getProject.mockReset().mockResolvedValue(project());
  libs.getProjectStages.mockReset().mockResolvedValue(stages4());
  libs.getProjectServices.mockReset().mockResolvedValue(services3());
  libs.getProjectMaintenance.mockReset().mockResolvedValue(maintenance2());
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

function montar(ruta = "/dashboard/project/p-1") {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/dashboard/project/:id" element={<ProjectDetail />} />
        <Route path="/dashboard" element={<p>RESUMEN-STUB</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const cargado = () => screen.findByRole("heading", { level: 1, name: "Portal Corporativo Alfa" }, WAIT);
const consultas = [libs.getProject, libs.getProjectStages, libs.getProjectServices, libs.getProjectMaintenance, libs.getProjectTickets, libs.getProjectTokens];

describe("carga (`load()` compartido)", () => {
  it("pide las 6 consultas, una vez cada una, con el id de la ruta", async () => {
    montar();
    await cargado();
    for (const q of consultas) {
      expect(q).toHaveBeenCalledTimes(1);
      expect(q).toHaveBeenCalledWith("p-1");
    }
  });

  it("mientras carga no muestra el proyecto; cuando llegan los datos, sí", async () => {
    let resolver!: (p: unknown) => void;
    libs.getProject.mockReturnValue(new Promise((r) => (resolver = r)));
    montar();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    resolver(project());
    await cargado();
  });

  it.each([
    ["getProject", libs.getProject],
    ["getProjectStages", libs.getProjectStages],
    ["getProjectServices", libs.getProjectServices],
    ["getProjectMaintenance", libs.getProjectMaintenance],
    ["getProjectTickets", libs.getProjectTickets],
    ["getProjectTokens", libs.getProjectTokens],
  ])("si falla %s: aviso destructivo y vuelve a /dashboard sin pintar el proyecto", async (_n, q) => {
    q.mockRejectedValue(new Error("falla de red simulada"));
    montar();
    expect(await screen.findByText("RESUMEN-STUB", {}, WAIT)).toBeInTheDocument();
    expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining(ADAPTADOR.avisoFalloCarga));
    expect(screen.queryByRole("heading", { level: 1, name: "Portal Corporativo Alfa" })).toBeNull();
  });

  it("recarga las 6 consultas cuando un hijo avisa (p. ej. al guardar la edición)", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.guardarEdicion }));
    await waitFor(() => {
      for (const q of consultas) expect(q).toHaveBeenCalledTimes(2);
    }, WAIT);
  });
});

describe("identidad del proyecto", () => {
  it("muestra nombre, estado, descripción y datos de contacto del cliente", async () => {
    montar();
    await cargado();
    expect(screen.getAllByText(/^activo$/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Sitio institucional con portal de clientes")).toBeInTheDocument();
    expect(screen.getByText("Cliente Demo")).toBeInTheDocument();
    expect(screen.getByText("cliente@example.test")).toBeInTheDocument();
    expect(screen.getByText("+504 0000-0000")).toBeInTheDocument();
  });

  it("el documento de requerimientos es un enlace externo seguro", async () => {
    montar();
    await cargado();
    const a = screen.getByRole("link", { name: ADAPTADOR.linkDoc });
    expect(a).toHaveAttribute("href", "https://docs.example.test/d/abc");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
    expect(a.getAttribute("rel")).toContain("noreferrer");
  });

  it("sin datos de cliente ni documento muestra un texto neutro", async () => {
    libs.getProject.mockResolvedValue(project({ client_name: null, client_email: null, client_phone: null, google_docs_requirements_url: null }));
    montar();
    await cargado();
    expect(screen.getByText(ADAPTADOR.sinCliente)).toBeInTheDocument();
    expect(screen.getByText(ADAPTADOR.sinDoc)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: ADAPTADOR.linkDoc })).toBeNull();
  });

  it("el «volver» lleva a /dashboard", async () => {
    montar();
    await cargado();
    const volver = screen.getByRole("link", { name: ADAPTADOR.volver });
    expect(volver).toHaveAttribute("href", "/dashboard");
    fireEvent.click(volver);
    expect(await screen.findByText("RESUMEN-STUB")).toBeInTheDocument();
  });

  it("editar precarga los valores actuales (vacíos si no hay)", async () => {
    libs.getProject.mockResolvedValue(project({ descripcion: null, client_phone: null }));
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    expect((ADAPTADOR.campo("Portal Corporativo Alfa") as HTMLInputElement).value).toBe("Portal Corporativo Alfa");
    expect((ADAPTADOR.campo("Cliente Demo") as HTMLInputElement).value).toBe("Cliente Demo");
    expect((ADAPTADOR.campo("cliente@example.test") as HTMLInputElement).value).toBe("cliente@example.test");
    expect((ADAPTADOR.campo("https://docs.example.test/d/abc") as HTMLInputElement).value).toBe("https://docs.example.test/d/abc");
  });

  it("guardar envía el payload completo, avisa, sale de la edición y recarga", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    fireEvent.change(ADAPTADOR.campo("Portal Corporativo Alfa"), { target: { value: "Portal Beta" } });
    fireEvent.change(ADAPTADOR.campo("Sitio institucional con portal de clientes"), { target: { value: "Otra descripción" } });
    fireEvent.change(ADAPTADOR.campo("Cliente Demo"), { target: { value: "Cliente Nuevo" } });
    fireEvent.change(ADAPTADOR.campo("https://docs.example.test/d/abc"), { target: { value: "  https://docs.example.test/d/xyz  " } });
    ADAPTADOR.elegirEstado("Pausado");
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.guardarEdicion }));
    await waitFor(() => expect(libs.updateProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.updateProject).toHaveBeenCalledWith("p-1", {
      nombre_proyecto: "Portal Beta",
      descripcion: "Otra descripción",
      client_name: "Cliente Nuevo",
      client_email: "cliente@example.test",
      client_phone: "+504 0000-0000",
      estado: "pausado",
      google_docs_requirements_url: "https://docs.example.test/d/xyz",
    });
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Proyecto actualizado" }), WAIT);
    await waitFor(() => expect(libs.getProject).toHaveBeenCalledTimes(2), WAIT);
    await waitFor(() => expect(screen.queryByRole("button", { name: ADAPTADOR.guardarEdicion })).toBeNull(), WAIT);
  });

  it("los campos vacíos se guardan como null y el documento se recorta", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    fireEvent.change(ADAPTADOR.campo("Sitio institucional con portal de clientes"), { target: { value: "" } });
    fireEvent.change(ADAPTADOR.campo("Cliente Demo"), { target: { value: "" } });
    fireEvent.change(ADAPTADOR.campo("cliente@example.test"), { target: { value: "" } });
    fireEvent.change(ADAPTADOR.campo("+504 0000-0000"), { target: { value: "" } });
    fireEvent.change(ADAPTADOR.campo("https://docs.example.test/d/abc"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.guardarEdicion }));
    await waitFor(() => expect(libs.updateProject).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.updateProject).toHaveBeenCalledWith("p-1", {
      nombre_proyecto: "Portal Corporativo Alfa",
      descripcion: null,
      client_name: null,
      client_email: null,
      client_phone: null,
      estado: "activo",
      google_docs_requirements_url: null,
    });
  });

  it("cancelar no guarda ni recarga y vuelve a la vista de lectura", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    fireEvent.change(ADAPTADOR.campo("Portal Corporativo Alfa"), { target: { value: "Cambiado" } });
    fireEvent.click(ADAPTADOR.cancelarEdicion());
    expect(libs.updateProject).not.toHaveBeenCalled();
    expect(libs.getProject).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { level: 1, name: "Portal Corporativo Alfa" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ADAPTADOR.guardarEdicion })).toBeNull();
  });

  it("si guardar falla: aviso destructivo, sigue en edición con lo escrito y no recarga", async () => {
    libs.updateProject.mockRejectedValue(new Error("falla simulada"));
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    fireEvent.change(ADAPTADOR.campo("Portal Corporativo Alfa"), { target: { value: "Portal Beta" } });
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.guardarEdicion }));
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    expect(screen.getByRole("button", { name: ADAPTADOR.guardarEdicion })).toBeEnabled();
    expect((ADAPTADOR.campo("Portal Beta") as HTMLInputElement).value).toBe("Portal Beta");
    expect(libs.getProject).toHaveBeenCalledTimes(1);
  });

  it("mientras guarda, el botón de guardar queda desactivado (sin doble envío)", async () => {
    let resolver!: () => void;
    libs.updateProject.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.editar }));
    const guardar = screen.getByRole("button", { name: ADAPTADOR.guardarEdicion });
    fireEvent.click(guardar);
    await waitFor(() => expect(libs.updateProject).toHaveBeenCalledTimes(1), WAIT);
    const enCurso = screen.getAllByRole("button").find((b) => b.hasAttribute("disabled") && /guard|\.\.\.|…/i.test(b.textContent ?? ""));
    expect(enCurso).toBeDefined();
    fireEvent.click(enCurso!);
    expect(libs.updateProject).toHaveBeenCalledTimes(1);
    resolver();
  });
});

describe("pipeline de etapas", () => {
  const FECHA = ADAPTADOR.fechaEtapa;
  const textoPipeline = () => ADAPTADOR.progreso(screen.getByRole("button", { name: /pipeline/i }).textContent ?? "");

  it("muestra las 6 etapas del dominio por su nombre", async () => {
    montar();
    await cargado();
    for (const nombre of ["Análisis", "Adquisición de Dominio", "Desarrollo", "Despliegue", "Entrega", "Mantenimiento Activo"]) {
      expect(screen.getByRole("button", { name: new RegExp(nombre) })).toBeInTheDocument();
    }
  });

  it("el progreso es etapas registradas / 6 y su porcentaje redondeado", async () => {
    montar();
    await cargado();
    expect(textoPipeline()).toContain("4/6");
    expect(textoPipeline()).toContain("67%");
  });

  it("las etapas completadas muestran su fecha y las pendientes su descripción", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("button", { name: /Análisis/ })).toHaveTextContent(FECHA("2026-10-05T15:00:00.000Z"));
    expect(screen.getByRole("button", { name: /Despliegue/ })).toHaveTextContent(FECHA("2026-10-28T15:00:00.000Z"));
    expect(screen.getByRole("button", { name: /Entrega/ })).toHaveTextContent("Accesos, documentación, factura");
  });

  it("un responsable de texto libre se muestra tal cual", async () => {
    montar();
    await cargado();
    expect(screen.getByRole("button", { name: /Análisis/ })).toHaveTextContent("Persona Demo");
  });

  it("el resumen de metadatos: dominio, desarrollo y despliegue (el importe, con su moneda si está registrada)", async () => {
    montar();
    await cargado();
    const dominio = screen.getByRole("button", { name: /Adquisición de Dominio/ });
    expect(dominio).toHaveTextContent("alfa.example.test");
    expect(dominio).toHaveTextContent("Cloudflare");
    expect(dominio).toHaveTextContent(/12\.00 HNL\/año/);
    expect(screen.getByRole("button", { name: /Desarrollo/ })).toHaveTextContent("React, Supabase");
    expect(screen.getByRole("button", { name: /Desarrollo/ })).toHaveTextContent("Dev Demo");
    expect(screen.getByRole("button", { name: /Despliegue/ })).toHaveTextContent("Vercel");
  });

  it("un clic en una etapa abre su cajón (también una pendiente)", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: /Adquisición de Dominio/ }));
    expect(await within(await screen.findByRole("dialog", {}, WAIT)).findByText(/Adquisición de Dominio/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    fireEvent.click(screen.getByRole("button", { name: /Entrega/ }));
    expect(await within(await screen.findByRole("dialog", {}, WAIT)).findByText(/Entrega/)).toBeInTheDocument();
  });

  it("con menos de 5 etapas empieza abierto; el botón lo alterna", async () => {
    montar();
    await cargado();
    expect(ADAPTADOR.pipelineAbierto()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /pipeline/i }));
    expect(ADAPTADOR.pipelineAbierto()).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /pipeline/i }));
    expect(ADAPTADOR.pipelineAbierto()).toBe(true);
  });

  it("con 5 o más etapas se colapsa solo", async () => {
    libs.getProjectStages.mockResolvedValue([...stages4(), stage("entrega")]);
    montar();
    await cargado();
    await waitFor(() => expect(ADAPTADOR.pipelineAbierto()).toBe(false), WAIT);
    expect(textoPipeline()).toContain("5/6");
    expect(textoPipeline()).toContain("83%");
  });

  it("sin etapas: 0/6, 0 % y todas pendientes", async () => {
    libs.getProjectStages.mockResolvedValue([]);
    montar();
    await cargado();
    expect(textoPipeline()).toContain("0/6");
    expect(textoPipeline()).toContain("0%");
  });
});

describe("pestañas y accesos desde el detalle", () => {
  it("hay tres pestañas: Servicios (con su cuenta), Tickets (abiertos) y Acceso (enlaces)", async () => {
    montar();
    await cargado();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tab", { name: /^Servicios/ })).toHaveTextContent("3");
    // abiertos = abierto + en_revision + en_progreso → 2 de los 3 tickets de la muestra
    expect(screen.getByRole("tab", { name: /^Tickets/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /^Acceso/ })).toHaveTextContent("2");
    expect(screen.getByRole("tab", { name: /^Servicios/ })).toHaveAttribute("aria-selected", "true");
  });

  it("Tickets: lista cada ticket con tipo, fecha, prioridad, estado y mensajes; el filtro por estado funciona", async () => {
    montar();
    await cargado();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Tickets/ }), { button: 0 });
    expect(await screen.findByText("Cambiar el banner de inicio", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText("Error al enviar el formulario")).toBeInTheDocument();
    expect(screen.getByText("Consulta sobre facturación")).toBeInTheDocument();
    const fila = screen.getByText("Cambiar el banner de inicio").closest("button")!;
    expect(fila).toHaveTextContent("Modificación");
    expect(fila).toHaveTextContent("Media");
    expect(fila).toHaveTextContent("Recibido");
    expect(fila).toHaveTextContent("2");
    expect(screen.getByText("Error al enviar el formulario").closest("button")).toHaveTextContent("Urgente");
  });

  it("Acceso: la pestaña existe y se puede abrir", async () => {
    montar();
    await cargado();
    fireEvent.mouseDown(screen.getByRole("tab", { name: /^Acceso/ }), { button: 0 });
    expect(await screen.findByDisplayValue(/\/client\/tok-activo/, {}, WAIT)).toBeInTheDocument();
  });
});
