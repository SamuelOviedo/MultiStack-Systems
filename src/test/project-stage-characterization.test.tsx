// Caracterización: el cajón de etapa (`StageDrawer`). La regla de oro: cada
// guardado reenvía TODO el `metadata` (upsert del objeto completo), con sus claves de dinero (`precio_anual`,
// `precio_mensual`, `moneda`, `factura_emitida`) y cualquier clave desconocida, tal como llegó. Si el rediseño
// quitara o renombrara una clave, el siguiente guardado BORRARÍA el dinero de la fila. Escrito contra el código
// ANTERIOR; solo los textos y el marcado que cambian a propósito viven en `ADAPTADOR`.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AHORA, stage } from "./helpers/projectFixtures";
import { PIPELINE_STAGES, type PipelineStage } from "@/types/projects";

// Zona horaria fija (ver project-tabs-characterization): el reloj y la zona de las pruebas no dependen de la máquina.
process.env.TZ = "UTC";

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
const libs = vi.hoisted(() => ({ upsertStage: vi.fn() }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  upsertStage: libs.upsertStage,
}));

import StageDrawer from "@/components/dashboard/project-detail/StageDrawer";

/** [etiqueta anterior (`clave:`), etiqueta nueva]. */
const CAMPOS: Record<string, [string, string]> = {
  fecha: ["fecha_completado", "Fecha de completado"],
  responsable: ["completado_por", "Responsable"],
  notas: ["notas", "Notas"],
  dominio: ["dominio", "Dominio"],
  proveedor: ["proveedor", "Proveedor"],
  precioAnual: ["precio_anual", "Precio anual"],
  moneda: ["moneda", "Moneda"],
  fechaCompra: ["fecha_compra", "Fecha de compra"],
  fechaRenovacion: ["fecha_renovacion", "Fecha de renovación"],
  repo: ["repo_url", "URL del repositorio"],
  desarrollador: ["desarrollador", "Desarrollador"],
  fechaEstimada: ["fecha_estimada_entrega", "Fecha estimada de entrega"],
  plataforma: ["plataforma", "Plataforma"],
  urlProduccion: ["url_produccion", "URL de producción"],
  baseDatos: ["base_de_datos", "Base de datos"],
  precioMensual: ["precio_mensual", "Precio mensual"],
};

/**
 * Todo lo que cambia con el rediseño: cómo se encuentra cada campo (antes `<label>` sin `htmlFor`, ahora etiquetas
 * enlazadas y selectores de Radix), y los textos de los botones.
 */
const ADAPTADOR = {
  /** «[ GUARDAR ETAPA ]» pasa a «Guardar etapa» (sin corchetes). */
  guardar: /^\[ guardar etapa \]$|^guardar etapa$/i,
  /** Mientras guarda: «Guardando...» → «Guardando…». */
  guardando: /guardando/i,
  cancelar: /^cancelar$/i,
  /** El control de un campo: el nuevo se busca por etiqueta enlazada; el anterior, por el texto de su `<label>`. */
  campo(nombre: keyof typeof CAMPOS): HTMLElement {
    const [vieja, nueva] = CAMPOS[nombre];
    const porEtiqueta = screen.queryByLabelText(nueva, { exact: true });
    if (porEtiqueta) return porEtiqueta;
    const label = Array.from(document.querySelectorAll("label")).find((l) => l.textContent === `${vieja}:`);
    if (!label) throw new Error(`No encuentro el campo ${nombre}`);
    return label.nextElementSibling as HTMLElement;
  },
  escribir(nombre: keyof typeof CAMPOS, valor: string) {
    fireEvent.change(ADAPTADOR.campo(nombre), { target: { value: valor } });
  },
  /** Elige una opción en un `<select>` nativo (antes) o en el `Select` de Radix (ahora). */
  elegir(nombre: keyof typeof CAMPOS, opcion: string) {
    const el = ADAPTADOR.campo(nombre);
    if (el.tagName === "SELECT") {
      fireEvent.change(el, { target: { value: opcion } });
    } else {
      fireEvent.keyDown(el, { key: "ArrowDown" });
      fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === opcion)!);
    }
  },
  /** Texto mostrado por un selector (nativo: la opción elegida; Radix: el valor del botón). */
  valorSelect(nombre: keyof typeof CAMPOS): string {
    const el = ADAPTADOR.campo(nombre);
    if (el.tagName === "SELECT") {
      const s = el as HTMLSelectElement;
      return s.options[s.selectedIndex]?.text ?? "";
    }
    return el.textContent ?? "";
  },
  /** Una casilla por su texto (el `<label for>` ya existía en el código anterior). */
  casilla: (texto: string) => screen.getByRole("checkbox", { name: texto }),
  /** Una etiqueta del stack: botón (antes) y botón con `aria-pressed` (ahora). */
  stack: (nombre: string) => screen.getByRole("button", { name: nombre }),
  /** El responsable que es un UUID (dato sin nombre): antes se veía crudo en el campo; ahora el campo queda vacío. */
  esUuidVisible: (uuid: string) => screen.queryByDisplayValue(uuid) !== null,
};

const ETAPA = (clave: string): PipelineStage => PIPELINE_STAGES.find((s) => s.key === clave)!;
const HOY = AHORA.split("T")[0];

const ENTRADA_COMPLETA: Record<string, Record<string, unknown>> = {
  analisis: {
    "Reunión inicial con cliente": true,
    "Definición de requerimientos": false,
    "Cotización aprobada": true,
    clave_desconocida: "valor ajeno",
  },
  dominio: {
    dominio: "alfa.example.test",
    proveedor: "Cloudflare",
    precio_anual: "12.00",
    moneda: "HNL",
    fecha_compra: "2026-10-01",
    fecha_renovacion: "2027-10-01",
    clave_desconocida: { anidada: [1, 2] },
  },
  desarrollo: {
    stack: ["React", "Supabase"],
    repo_url: "https://git.example.test/alfa",
    desarrollador: "Dev Demo",
    fecha_estimada: "2026-12-01",
    clave_desconocida: 42,
  },
  despliegue: {
    plataforma: "Vercel",
    url_produccion: "https://alfa.example.test",
    base_de_datos: "Supabase",
    dns_configurado: true,
    ssl_activo: false,
    clave_desconocida: null,
  },
  entrega: {
    accesos_entregados: true,
    documentacion_entregada: true,
    factura_emitida: true,
    clave_desconocida: "x",
  },
  mantenimiento: { precio_mensual: "500.00", moneda: "USD", clave_desconocida: ["a"] },
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
  toastSpy.mockReset();
  libs.upsertStage.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function abrir(clave: string, existing: ReturnType<typeof stage> | null = null) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(<StageDrawer projectId="p-1" stage={ETAPA(clave)} existing={existing} open onClose={onClose} onSaved={onSaved} />);
  return { onClose, onSaved };
}
const guardar = () => fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.guardar }));
const ultimaLlamada = () => libs.upsertStage.mock.calls.at(-1)! as [string, string, string, Record<string, unknown>];

describe("cajón de etapa · apertura", () => {
  it("muestra el nombre y la descripción de la etapa en un diálogo", () => {
    abrir("dominio");
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByText(/Adquisición de Dominio/)).toBeInTheDocument();
    expect(dialogo.getByText("Compra y configuración del dominio")).toBeInTheDocument();
  });

  it("etapa nueva: la fecha es hoy y el responsable y las notas están vacíos", () => {
    abrir("analisis");
    expect((ADAPTADOR.campo("fecha") as HTMLInputElement).value).toBe(HOY);
    expect((ADAPTADOR.campo("responsable") as HTMLInputElement).value).toBe("");
    expect((ADAPTADOR.campo("notas") as HTMLTextAreaElement).value).toBe("");
  });

  it("etapa existente: precarga fecha, responsable, notas y metadatos", () => {
    abrir("dominio", stage("dominio", { completed_at: "2026-10-08T15:00:00.000Z", completed_by: "Persona Demo", notes: "Nota previa", metadata: ENTRADA_COMPLETA.dominio }));
    expect((ADAPTADOR.campo("fecha") as HTMLInputElement).value).toBe("2026-10-08");
    expect((ADAPTADOR.campo("responsable") as HTMLInputElement).value).toBe("Persona Demo");
    expect((ADAPTADOR.campo("notas") as HTMLTextAreaElement).value).toBe("Nota previa");
    expect((ADAPTADOR.campo("dominio") as HTMLInputElement).value).toBe("alfa.example.test");
    expect(ADAPTADOR.valorSelect("proveedor")).toBe("Cloudflare");
    expect((ADAPTADOR.campo("precioAnual") as HTMLInputElement).value).toBe("12.00");
    expect(ADAPTADOR.valorSelect("moneda")).toBe("HNL");
  });

  it("Cancelar cierra sin guardar", () => {
    const { onClose, onSaved } = abrir("dominio");
    fireEvent.click(screen.getByRole("button", { name: ADAPTADOR.cancelar }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    expect(libs.upsertStage).not.toHaveBeenCalled();
  });

  it("Escape cierra sin guardar", () => {
    const { onClose } = abrir("dominio");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(libs.upsertStage).not.toHaveBeenCalled();
  });
});

describe("cajón de etapa · guardar (el objeto `metadata` viaja COMPLETO)", () => {
  it("etapa nueva sin tocar nada: manda proyecto, clave, etiqueta, fecha de hoy y metadatos vacíos", async () => {
    const { onSaved, onClose } = abrir("analisis");
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    const [proyecto, clave, etiqueta, datos] = ultimaLlamada();
    expect([proyecto, clave, etiqueta]).toEqual(["p-1", "analisis", "Análisis"]);
    expect(datos.completed_at).toBe(new Date(HOY).toISOString());
    expect(datos.completed_by).toBeUndefined();
    expect(datos.notes).toBeUndefined();
    expect(datos.metadata).toStrictEqual({});
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1), WAIT);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastSpy).toHaveBeenCalledWith({ title: "Análisis — guardado" });
  });

  it.each(Object.keys(ENTRADA_COMPLETA))("ida y vuelta intacta en «%s»: sin tocar nada reenvía el metadata idéntico (claves de dinero y desconocidas incluidas)", async (clave) => {
    abrir(clave, stage(clave, { metadata: structuredClone(ENTRADA_COMPLETA[clave]) }));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual(ENTRADA_COMPLETA[clave]);
  });

  it("cambiar un campo conserva TODAS las demás claves, el dinero incluido", async () => {
    abrir("dominio", stage("dominio", { metadata: structuredClone(ENTRADA_COMPLETA.dominio) }));
    ADAPTADOR.escribir("dominio", "beta.example.test");
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ ...ENTRADA_COMPLETA.dominio, dominio: "beta.example.test" });
  });

  it("el importe se guarda como cadena (el valor del campo), no como número", async () => {
    abrir("dominio", stage("dominio", { metadata: structuredClone(ENTRADA_COMPLETA.dominio) }));
    ADAPTADOR.escribir("precioAnual", "15.50");
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect((ultimaLlamada()[3].metadata as Record<string, unknown>).precio_anual).toBe("15.50");
  });

  it("la moneda elegida se guarda; la moneda ausente NO se escribe si no se toca (dominio y mantenimiento)", async () => {
    abrir("dominio", stage("dominio", { metadata: { dominio: "a.example.test", precio_anual: "10" } }));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ dominio: "a.example.test", precio_anual: "10" });
    cleanup();
    abrir("mantenimiento", stage("mantenimiento", { metadata: { precio_mensual: "500" } }));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(2), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ precio_mensual: "500" });
  });

  it("elegir moneda la guarda en el metadata", async () => {
    abrir("mantenimiento", stage("mantenimiento", { metadata: { precio_mensual: "500" } }));
    ADAPTADOR.elegir("moneda", "USD");
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ precio_mensual: "500", moneda: "USD" });
  });

  it("fecha, responsable y notas viajan en su sitio; el responsable y las notas vacíos van como undefined", async () => {
    abrir("despliegue");
    ADAPTADOR.escribir("fecha", "2026-12-01");
    ADAPTADOR.escribir("responsable", "Persona Demo");
    ADAPTADOR.escribir("notas", "Todo listo");
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    const datos = ultimaLlamada()[3];
    expect(datos.completed_at).toBe(new Date("2026-12-01").toISOString());
    expect(datos.completed_by).toBe("Persona Demo");
    expect(datos.notes).toBe("Todo listo");
  });

  it("un responsable que es un identificador (sin nombre) se reenvía sin cambios si no se toca", async () => {
    const uuid = "0000000a-0000-4000-8000-000000000001";
    abrir("analisis", stage("analisis", { completed_by: uuid, metadata: {} }));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].completed_by).toBe(uuid);
  });

  it("borrar el responsable lo manda vacío (undefined), igual que hoy", async () => {
    abrir("analisis", stage("analisis", { completed_by: "Persona Demo", metadata: {} }));
    ADAPTADOR.escribir("responsable", "");
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].completed_by).toBeUndefined();
  });

  it("casillas: marcar y desmarcar guardan true/false (no borran la clave)", async () => {
    abrir("entrega", stage("entrega", { metadata: { accesos_entregados: true, documentacion_entregada: false, factura_emitida: true } }));
    fireEvent.click(ADAPTADOR.casilla("Accesos entregados al cliente"));
    fireEvent.click(ADAPTADOR.casilla("Documentación entregada"));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ accesos_entregados: false, documentacion_entregada: true, factura_emitida: true });
  });

  it("la lista de comprobación de análisis usa el texto de cada ítem como clave", async () => {
    abrir("analisis");
    fireEvent.click(ADAPTADOR.casilla("Reunión inicial con cliente"));
    fireEvent.click(ADAPTADOR.casilla("Cotización aprobada"));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ "Reunión inicial con cliente": true, "Cotización aprobada": true });
  });

  it("despliegue: DNS y SSL guardan booleanos junto al resto de claves", async () => {
    abrir("despliegue", stage("despliegue", { metadata: { plataforma: "Vercel", dns_configurado: true } }));
    fireEvent.click(ADAPTADOR.casilla("DNS configurado"));
    fireEvent.click(ADAPTADOR.casilla("SSL activo"));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ plataforma: "Vercel", dns_configurado: false, ssl_activo: true });
  });

  it("desarrollo: las etiquetas del stack se agregan y se quitan sin tocar las demás claves", async () => {
    abrir("desarrollo", stage("desarrollo", { metadata: { stack: ["React"], desarrollador: "Dev Demo" } }));
    fireEvent.click(ADAPTADOR.stack("Supabase"));
    fireEvent.click(ADAPTADOR.stack("React"));
    guardar();
    await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
    expect(ultimaLlamada()[3].metadata).toStrictEqual({ stack: ["Supabase"], desarrollador: "Dev Demo" });
  });

  it("los selectores ofrecen las mismas opciones de siempre", () => {
    abrir("dominio");
    const opciones = (nombre: keyof typeof CAMPOS) => {
      const el = ADAPTADOR.campo(nombre);
      if (el.tagName === "SELECT") return Array.from((el as HTMLSelectElement).options).map((o) => o.text).filter((t) => !/seleccionar|sin elegir/i.test(t));
      fireEvent.keyDown(el, { key: "ArrowDown" });
      const out = screen.getAllByRole("option").map((o) => o.textContent ?? "").filter((t) => !/sin elegir/i.test(t));
      fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
      return out;
    };
    expect(opciones("proveedor")).toEqual(["Cloudflare", "Namecheap", "GoDaddy", "Otro"]);
    expect(opciones("moneda")).toEqual(["USD", "HNL"]);
  });
});

describe("cajón de etapa · estados de guardado", () => {
  it("si falla: aviso destructivo, el cajón sigue abierto y no recarga", async () => {
    libs.upsertStage.mockRejectedValue(new Error("falla simulada"));
    const { onClose, onSaved } = abrir("analisis");
    guardar();
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })), WAIT);
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: ADAPTADOR.guardar })).toBeEnabled();
  });

  it("mientras guarda, el botón queda desactivado: un segundo clic no manda otro guardado", async () => {
    let resolver!: () => void;
    libs.upsertStage.mockReturnValue(new Promise<void>((r) => (resolver = r)));
    abrir("analisis");
    guardar();
    const enCurso = await screen.findByRole("button", { name: ADAPTADOR.guardando }, WAIT);
    expect(enCurso).toBeDisabled();
    fireEvent.click(enCurso);
    expect(libs.upsertStage).toHaveBeenCalledTimes(1);
    resolver();
  });
});
