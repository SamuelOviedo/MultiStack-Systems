// Caracterización: lo que hay dentro de las pestañas del detalle de proyecto: servicios (alta y baja),
// mantenimiento mensual (con importe) y acceso del cliente (token del portal). Escrito contra el código ANTERIOR;
// solo los textos y el marcado que cambian a propósito viven en `ADAPTADOR`.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { campoPorEtiqueta, elegirOpcion, escribirEn, opcionesDe, valorMostrado } from "./helpers/campos";
import { AHORA, maintenance, maintenance2, project, services3, stages4, tickets3, tokens2, token } from "./helpers/projectFixtures";

// Zona horaria fija: `formatMonth` (src/lib) parsea «2026-11-01» como UTC y en Honduras (UTC-6) muestra el mes ANTERIOR;
// la caracterización fija el comportamiento previsto (UTC) y las pruebas del formateador nuevo cubren ambas zonas.
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

const ADAPTADOR = {
  // ── Servicios ──
  agregar: /^agregar/i,
  /** La fila de un servicio: una `<tr>` (ahora) o un `div.group` (antes). */
  fila: (nombre: string) => (screen.getByText(nombre).closest("tr") ?? screen.getByText(nombre).closest("div.group")) as HTMLElement,
  /**
   * Pulsa «borrar» de un servicio. Antes: un botón sin nombre (icono) que borraba AL INSTANTE; ahora: «Eliminar
   * <nombre>» abre una confirmación y el borrado ocurre al confirmar (borrar pide confirmación).
   */
  borrar: async (nombre: string) => {
    const fila = within(ADAPTADOR.fila(nombre));
    const nombrado = fila.queryByRole("button", { name: new RegExp(`eliminar`, "i") });
    if (!nombrado) {
      const botones = fila.getAllByRole("button");
      fireEvent.click(botones[botones.length - 1]);
      return;
    }
    fireEvent.click(nombrado);
    const confirmacion = await screen.findByRole("alertdialog", {}, WAIT);
    fireEvent.click(within(confirmacion).getByRole("button", { name: /^eliminar/i }));
  },
  /** Días de renovación: antes «5d»; ahora «en 5 días». */
  dias: (n: number) => new RegExp(`(^|\\D)${n}(d(?![a-zA-Z])|\\s?días)`),
  /** Costo anual: «12 USD/año». Se mantiene la moneda registrada en el servicio. */
  costoAnual: /12\s+USD\s*\/\s*año|12\s+USD.*año/i,
  sinServicios: /sin servicios registrados|aún no hay servicios|no hay servicios/i,
  // ── Formulario de servicio ──
  svc: {
    tipo: () => campoPorEtiqueta("tipo:", /^tipo/i),
    proveedor: () => campoPorEtiqueta("proveedor *:", /^proveedor/i),
    nombre: () => campoPorEtiqueta("nombre *:", /^nombre/i),
    url: () => campoPorEtiqueta("url:", /^url/i),
    costoMensual: () => campoPorEtiqueta("costo_mensual:", /costo mensual/i),
    costoAnual: () => campoPorEtiqueta("costo_anual:", /costo anual/i),
    moneda: () => campoPorEtiqueta("moneda:", /^moneda/i),
    renovacion: () => campoPorEtiqueta("fecha_renovacion:", /fecha de renovación/i),
    notas: () => campoPorEtiqueta("notas:", /^notas/i),
    guardar: () => screen.getByRole("button", { name: /^\[ guardar \]$|^guardar servicio$/i }),
  },
  // ── Mantenimiento ──
  registrarMes: /^registrar mes/i,
  /**
   * Una fila de mantenimiento: antes un botón de ancho completo con todo dentro; ahora una fila de tabla cuyo
   * botón es el mes. Para LEER se usa la fila; para ABRIR, el botón.
   */
  filaMes: (mes: RegExp) => (screen.getByText(mes).closest("tr") ?? screen.getByText(mes).closest("button")) as HTMLElement,
  abrirMes: (mes: RegExp) => fireEvent.click(screen.getByText(mes).closest("button")!),
  tareas: (n: number) => new RegExp(`${n}\\s+tarea`),
  mant: {
    mes: () => campoPorEtiqueta("mes:", /^mes/i),
    estado: () => campoPorEtiqueta("estado:", /^estado/i),
    tareas: () => campoPorEtiqueta("tareas_realizadas (una por línea):", /tareas realizadas/i),
    notas: () => campoPorEtiqueta("notas:", /^notas/i),
    monto: () => campoPorEtiqueta("monto_cobrado:", /importe cobrado/i),
    cobrado: () => screen.getByRole("checkbox", { name: /cobrado al cliente/i }),
    guardar: () => screen.getByRole("button", { name: /^\[ guardar \]$|^guardar$|^guardar registro$/i }),
  },
  // ── Acceso del cliente ──
  generar: /^\[ generar enlace \]$|^generar enlace$/i,
  regenerar: /^\[ regenerar enlace \]$|^regenerar enlace$/i,
  /**
   * Copiar: antes un botón de icono sin nombre al lado del campo; ahora «Copiar enlace».
   */
  copiar: () => {
    const nombrado = screen.queryByRole("button", { name: /copiar/i });
    if (nombrado) return nombrado;
    const campo = screen.getByDisplayValue(/\/client\//);
    return campo.parentElement!.querySelector("button") as HTMLElement;
  },
  clienteNombre: () => campoPorEtiqueta("nombre_cliente:", /nombre del cliente/i),
  clienteCorreo: () => campoPorEtiqueta("email_cliente:", /correo del cliente/i),
  /** Regenerar un enlace que ya existe desactiva el anterior: ahora pide confirmación. */
  confirmarSiPide: async () => {
    const c = screen.queryByRole("alertdialog") ?? (await screen.findByRole("alertdialog", {}, { timeout: 600 }).catch(() => null));
    if (c) fireEvent.click(within(c).getByRole("button", { name: /^regenerar/i }));
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

const escribirPortapapeles = vi.fn();
beforeEach(() => {
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
  libs.getProjectMaintenance.mockReset().mockResolvedValue(maintenance2());
  libs.getProjectTickets.mockReset().mockResolvedValue(tickets3());
  libs.getProjectTokens.mockReset().mockResolvedValue(tokens2());
  libs.deleteService.mockReset().mockResolvedValue(undefined);
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
const recargas = () => libs.getProject.mock.calls.length;

describe("Servicios · lista", () => {
  it("cada servicio muestra nombre, proveedor, tipo, días para la renovación y costo anual con su moneda", async () => {
    montar();
    await cargado();
    const dominio = ADAPTADOR.fila("alfa.example.test");
    expect(dominio).toHaveTextContent("Cloudflare");
    expect(dominio).toHaveTextContent("Dominio");
    expect(dominio.textContent).toMatch(ADAPTADOR.dias(5));
    expect(dominio.textContent).toMatch(ADAPTADOR.costoAnual);
    const hosting = ADAPTADOR.fila("Alojamiento Alfa");
    expect(hosting).toHaveTextContent("Vercel");
    expect(hosting).toHaveTextContent("Hosting");
    expect(hosting.textContent).toMatch(ADAPTADOR.dias(23));
    expect(ADAPTADOR.fila("Base de datos Alfa")).toHaveTextContent("Base de datos");
  });

  it("un servicio sin fecha de renovación no muestra días", async () => {
    montar();
    await cargado();
    expect(ADAPTADOR.fila("Base de datos Alfa").textContent).not.toMatch(/\d+(d(?![a-zA-Z])|\s?días)/);
  });

  it("sin servicios: texto de vacío", async () => {
    libs.getProjectServices.mockResolvedValue([]);
    montar();
    await cargado();
    expect(screen.getByText(ADAPTADOR.sinServicios)).toBeInTheDocument();
  });
});

describe("Servicios · alta", () => {
  const abrirForm = async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.agregar }));
    return within(await screen.findByRole("dialog", {}, WAIT));
  };

  it("el botón «Agregar» abre el formulario; no deja guardar sin proveedor y sin nombre", async () => {
    await abrirForm();
    expect(ADAPTADOR.svc.guardar()).toBeDisabled();
    elegirOpcion(ADAPTADOR.svc.proveedor(), "Vercel");
    expect(ADAPTADOR.svc.guardar()).toBeDisabled();
    escribirEn(ADAPTADOR.svc.nombre(), "mi-sitio.example.test");
    expect(ADAPTADOR.svc.guardar()).toBeEnabled();
  });

  it("los tipos y proveedores son los de siempre; moneda USD por defecto", async () => {
    await abrirForm();
    expect(opcionesDe(ADAPTADOR.svc.tipo())).toEqual(["Dominio", "Hosting", "Base de datos", "CDN", "Otro"]);
    expect(valorMostrado(ADAPTADOR.svc.tipo())).toBe("Dominio");
    expect(opcionesDe(ADAPTADOR.svc.proveedor()).filter((o) => !/seleccionar/i.test(o))).toEqual([
      "Cloudflare", "Namecheap", "GoDaddy", "Vercel", "Render", "Railway", "Supabase", "DigitalOcean", "Otro",
    ]);
    expect(opcionesDe(ADAPTADOR.svc.moneda())).toEqual(["USD", "HNL"]);
    expect(valorMostrado(ADAPTADOR.svc.moneda())).toBe("USD");
  });

  it("guardar envía el payload (costos como número, vacíos como null), avisa, recarga y cierra", async () => {
    await abrirForm();
    elegirOpcion(ADAPTADOR.svc.tipo(), "Hosting");
    elegirOpcion(ADAPTADOR.svc.proveedor(), "Render");
    escribirEn(ADAPTADOR.svc.nombre(), "Alojamiento Beta");
    escribirEn(ADAPTADOR.svc.costoAnual(), "120.50");
    elegirOpcion(ADAPTADOR.svc.moneda(), "HNL");
    escribirEn(ADAPTADOR.svc.renovacion(), "2027-01-15");
    fireEvent.click(ADAPTADOR.svc.guardar());
    await waitFor(() => expect(libs.createService).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.createService).toHaveBeenCalledWith("p-1", {
      service_type: "hosting",
      provider: "Render",
      name: "Alojamiento Beta",
      url: null,
      cost_monthly: null,
      cost_yearly: 120.5,
      currency: "HNL",
      renewal_date: "2027-01-15",
      notes: null,
    });
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Servicio agregado" }), WAIT);
    await waitFor(() => expect(recargas()).toBe(2), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });

  it("la URL y las notas viajan cuando se escriben", async () => {
    await abrirForm();
    elegirOpcion(ADAPTADOR.svc.proveedor(), "Cloudflare");
    escribirEn(ADAPTADOR.svc.nombre(), "otro.example.test");
    escribirEn(ADAPTADOR.svc.url(), "https://otro.example.test");
    escribirEn(ADAPTADOR.svc.costoMensual(), "5");
    escribirEn(ADAPTADOR.svc.notas(), "Nota del servicio");
    fireEvent.click(ADAPTADOR.svc.guardar());
    await waitFor(() => expect(libs.createService).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.createService.mock.calls[0][1]).toMatchObject({ url: "https://otro.example.test", cost_monthly: 5, notes: "Nota del servicio" });
  });

  it("si falla: aviso destructivo, el formulario sigue abierto y no recarga", async () => {
    libs.createService.mockRejectedValue(new Error("falla simulada"));
    await abrirForm();
    elegirOpcion(ADAPTADOR.svc.proveedor(), "Vercel");
    escribirEn(ADAPTADOR.svc.nombre(), "x.example.test");
    fireEvent.click(ADAPTADOR.svc.guardar());
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(recargas()).toBe(1);
  });
});

describe("Servicios · baja", () => {
  it("borrar un servicio llama a deleteService con su id y recarga las 6 consultas", async () => {
    montar();
    await cargado();
    await ADAPTADOR.borrar("Alojamiento Alfa");
    await waitFor(() => expect(libs.deleteService).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.deleteService).toHaveBeenCalledWith("sv-2");
    await waitFor(() => expect(recargas()).toBe(2), WAIT);
    expect(libs.getProjectServices).toHaveBeenCalledTimes(2);
  });
});

describe("Mantenimiento mensual", () => {
  it("solo aparece con el proyecto «activo» o «en mantenimiento»", async () => {
    for (const estado of ["activo", "mantenimiento"] as const) {
      libs.getProject.mockResolvedValue(project({ estado }));
      const { unmount } = montar();
      await cargado();
      expect(screen.getByRole("button", { name: ADAPTADOR.registrarMes })).toBeInTheDocument();
      unmount();
    }
    for (const estado of ["en_analisis", "en_desarrollo", "en_despliegue", "pausado", "cancelado"] as const) {
      libs.getProject.mockResolvedValue(project({ estado }));
      const { unmount } = montar();
      await cargado();
      expect(screen.queryByRole("button", { name: ADAPTADOR.registrarMes })).toBeNull();
      unmount();
    }
  });

  it("cada registro: mes en español, estado, tareas hechas e importe solo si fue cobrado", async () => {
    montar();
    await cargado();
    const octubre = ADAPTADOR.filaMes(/octubre de 2026/i);
    expect(octubre).toHaveTextContent("Completado");
    expect(octubre.textContent).toMatch(ADAPTADOR.tareas(2));
    expect(octubre).toHaveTextContent("100");
    const noviembre = ADAPTADOR.filaMes(/noviembre de 2026/i);
    expect(noviembre).toHaveTextContent("Pendiente");
    expect(noviembre).not.toHaveTextContent("100");
  });

  it("un importe guardado en un registro que NO está cobrado no se muestra", async () => {
    libs.getProjectMaintenance.mockResolvedValue([
      maintenance({ id: "m-x", month: "2026-09-01", billed: false, billed_amount: 777 }),
    ]);
    montar();
    await cargado();
    const fila = ADAPTADOR.filaMes(/septiembre de 2026/i);
    expect(fila).not.toHaveTextContent("777");
  });

  it("sin registros: texto de vacío", async () => {
    libs.getProjectMaintenance.mockResolvedValue([]);
    montar();
    await cargado();
    expect(screen.getByText(/sin registros de mantenimiento/i)).toBeInTheDocument();
  });

  it("«Registrar mes» abre el formulario con los valores por defecto (mes actual, completado, sin cobrar)", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.registrarMes }));
    await screen.findByRole("dialog", {}, WAIT);
    expect((ADAPTADOR.mant.mes() as HTMLInputElement).value).toBe("2026-11");
    expect(valorMostrado(ADAPTADOR.mant.estado())).toBe("Completado");
    expect(ADAPTADOR.mant.cobrado()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByDisplayValue("500.00")).toBeNull();
  });

  it("guardar un registro nuevo: payload (tareas una por línea, notas null, importe número) y recarga", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.registrarMes }));
    await screen.findByRole("dialog", {}, WAIT);
    escribirEn(ADAPTADOR.mant.mes(), "2026-12");
    elegirOpcion(ADAPTADOR.mant.estado(), "En proceso");
    escribirEn(ADAPTADOR.mant.tareas(), "Copia de seguridad\n  Revisión de uptime  \n\n");
    fireEvent.click(ADAPTADOR.mant.cobrado());
    escribirEn(ADAPTADOR.mant.monto(), "150.50");
    fireEvent.click(ADAPTADOR.mant.guardar());
    await waitFor(() => expect(libs.upsertMaintenance).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.upsertMaintenance).toHaveBeenCalledWith("p-1", "2026-12-01", {
      status: "en_proceso",
      tasks_done: ["Copia de seguridad", "Revisión de uptime"],
      notes: null,
      billed: true,
      billed_amount: 150.5,
    });
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Mantenimiento guardado" }), WAIT);
    await waitFor(() => expect(recargas()).toBe(2), WAIT);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
  });

  it("el importe solo se pide si está «cobrado»", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.registrarMes }));
    await screen.findByRole("dialog", {}, WAIT);
    expect(() => ADAPTADOR.mant.monto()).toThrow();
    fireEvent.click(ADAPTADOR.mant.cobrado());
    expect(ADAPTADOR.mant.monto()).toBeInTheDocument();
  });

  it("un importe escrito y luego «sin cobrar» se envía igual (comportamiento de hoy, fijado a propósito)", async () => {
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.registrarMes }));
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(ADAPTADOR.mant.cobrado());
    escribirEn(ADAPTADOR.mant.monto(), "80");
    fireEvent.click(ADAPTADOR.mant.cobrado());
    fireEvent.click(ADAPTADOR.mant.guardar());
    await waitFor(() => expect(libs.upsertMaintenance).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.upsertMaintenance.mock.calls[0][2]).toMatchObject({ billed: false, billed_amount: 80 });
  });

  it("alternar «cobrado» de un registro existente conserva su importe y lo manda actualizado", async () => {
    montar();
    await cargado();
    ADAPTADOR.abrirMes(/octubre de 2026/i);
    await screen.findByRole("dialog", {}, WAIT);
    expect((ADAPTADOR.mant.mes() as HTMLInputElement).value).toBe("2026-10");
    expect(valorMostrado(ADAPTADOR.mant.estado())).toBe("Completado");
    expect((ADAPTADOR.mant.tareas() as HTMLTextAreaElement).value).toBe("Copia de seguridad\nActualización de dependencias");
    expect(ADAPTADOR.mant.cobrado()).toHaveAttribute("aria-checked", "true");
    expect((ADAPTADOR.mant.monto() as HTMLInputElement).value).toBe("100");
    escribirEn(ADAPTADOR.mant.monto(), "120");
    fireEvent.click(ADAPTADOR.mant.guardar());
    await waitFor(() => expect(libs.upsertMaintenance).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.upsertMaintenance).toHaveBeenCalledWith("p-1", "2026-10-01", {
      status: "completado",
      tasks_done: ["Copia de seguridad", "Actualización de dependencias"],
      notes: null,
      billed: true,
      billed_amount: 120,
    });
  });

  it("las notas de un registro existente se precargan y sin tareas el arreglo va vacío", async () => {
    montar();
    await cargado();
    ADAPTADOR.abrirMes(/noviembre de 2026/i);
    await screen.findByRole("dialog", {}, WAIT);
    expect((ADAPTADOR.mant.notas() as HTMLTextAreaElement).value).toBe("Revisar certificados");
    fireEvent.click(ADAPTADOR.mant.guardar());
    await waitFor(() => expect(libs.upsertMaintenance).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.upsertMaintenance).toHaveBeenCalledWith("p-1", "2026-11-01", {
      status: "pendiente",
      tasks_done: [],
      notes: "Revisar certificados",
      billed: false,
      billed_amount: null,
    });
  });

  it("si falla: aviso destructivo y el formulario sigue abierto", async () => {
    libs.upsertMaintenance.mockRejectedValue(new Error("falla simulada"));
    montar();
    await cargado();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.registrarMes }));
    await screen.findByRole("dialog", {}, WAIT);
    fireEvent.click(ADAPTADOR.mant.guardar());
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(recargas()).toBe(1);
  });
});

describe("Acceso del cliente (token del portal)", () => {
  const abrirAcceso = async () => {
    montar();
    await cargado();
    abrirTab(/^Acceso/);
    await screen.findByDisplayValue(/\/client\//, {}, WAIT);
  };

  it("muestra el enlace activo (origen + /client/ + token), el cliente, el correo y las fechas", async () => {
    await abrirAcceso();
    const enlace = screen.getByDisplayValue(/\/client\//) as HTMLInputElement;
    expect(enlace.value).toBe(`${window.location.origin}/client/tok-activo-0000000000000000000000`);
    expect(enlace).toHaveAttribute("readonly");
    expect(screen.getAllByText(/Cliente Demo/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cliente@example\.test/).length).toBeGreaterThan(0);
  });

  it("el historial lista los enlaces inactivos con el comienzo de su token", async () => {
    await abrirAcceso();
    expect(screen.getByText(/tok-viejo-111111/)).toBeInTheDocument();
    expect(screen.getByText(/inactivo/i)).toBeInTheDocument();
  });

  it("copiar manda el enlace completo al portapapeles y avisa", async () => {
    await abrirAcceso();
    fireEvent.click(ADAPTADOR.copiar());
    await waitFor(() => expect(escribirPortapapeles).toHaveBeenCalledWith(`${window.location.origin}/client/tok-activo-0000000000000000000000`), WAIT);
    await waitFor(() => expect(toastSpy).toHaveBeenCalled(), WAIT);
    expect(toastSpy.mock.calls.at(-1)![0].title).toMatch(/copiad/i);
  });

  it("con un enlace activo el botón es «Regenerar»; generar manda nombre y correo (vacíos como undefined), avisa, limpia y recarga", async () => {
    await abrirAcceso();
    expect(screen.queryByRole("button", { name: ADAPTADOR.generar })).toBeNull();
    escribirEn(ADAPTADOR.clienteNombre(), "Cliente Nuevo");
    escribirEn(ADAPTADOR.clienteCorreo(), "nuevo@example.test");
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.regenerar }));
    await ADAPTADOR.confirmarSiPide();
    await waitFor(() => expect(libs.generateToken).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.generateToken).toHaveBeenCalledWith("p-1", "Cliente Nuevo", "nuevo@example.test");
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: "Enlace generado" }), WAIT);
    await waitFor(() => expect(recargas()).toBe(2), WAIT);
    expect((ADAPTADOR.clienteNombre() as HTMLInputElement).value).toBe("");
    expect((ADAPTADOR.clienteCorreo() as HTMLInputElement).value).toBe("");
  });

  it("sin datos del cliente manda undefined en ambos", async () => {
    await abrirAcceso();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.regenerar }));
    await ADAPTADOR.confirmarSiPide();
    await waitFor(() => expect(libs.generateToken).toHaveBeenCalledTimes(1), WAIT);
    expect(libs.generateToken).toHaveBeenCalledWith("p-1", undefined, undefined);
  });

  it("sin enlace activo: dice que no hay, ofrece «Generar» y generar no pide confirmación", async () => {
    libs.getProjectTokens.mockResolvedValue([token({ active: false })]);
    montar();
    await cargado();
    abrirTab(/^Acceso/);
    expect(await screen.findByText(/sin enlace activo/i, {}, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.generar }));
    await waitFor(() => expect(libs.generateToken).toHaveBeenCalledTimes(1), WAIT);
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("si generar falla: aviso destructivo y no recarga", async () => {
    libs.generateToken.mockRejectedValue(new Error("falla simulada"));
    await abrirAcceso();
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.regenerar }));
    await ADAPTADOR.confirmarSiPide();
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    expect(recargas()).toBe(1);
  });
});
