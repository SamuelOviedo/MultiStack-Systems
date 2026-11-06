// Fechas del cajón de etapa (`StageDrawer`) y de la lista de etapas (`PipelineHeader`): qué fecha propone el cajón, qué
// guarda, cómo se lee de vuelta y cómo se muestra.
//
// La fecha que PROPONE una etapa nueva es el hoy comercial (día de calendario en Honduras), no el día UTC. Desde las
// 18:00 de Honduras el día UTC ya es el siguiente, y el cajón proponía la fecha de mañana.
//
// La fecha de una etapa se guarda como `new Date("YYYY-MM-DD").toISOString()`: la medianoche UTC del día elegido, en una
// columna `timestamptz`. Esa escritura NO cambia. Lo que cambia es la presentación: un instante exactamente en
// 00:00:00.000 UTC se entiende como fecha de calendario codificada por el cajón (se muestra su día UTC, igual en
// cualquier zona) y cualquier otro instante es un momento real (p. ej. el `DEFAULT now()` de la columna) y se muestra
// con el día de Honduras. La lista de etapas y el campo del cajón usan el mismo helper (`stageCalendarDay`), así que
// coinciden.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { formatStageDay, stageCalendarDay } from "@/components/dashboard/project-detail/format";
import PipelineHeader from "@/components/dashboard/project-detail/PipelineHeader";
import { calendarDayOf } from "@/lib/calendarDate";
import { PIPELINE_STAGES } from "@/types/projects";
import { stage } from "./helpers/projectFixtures";
import { aplicarZona, instanteHN, restaurarZona, ZONAS } from "./helpers/renewalDates";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
const libs = vi.hoisted(() => ({ upsertStage: vi.fn() }));
vi.mock("@/lib/projects", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/projects")>()),
  upsertStage: libs.upsertStage,
}));

import StageDrawer from "@/components/dashboard/project-detail/StageDrawer";

const ETAPA = PIPELINE_STAGES.find((s) => s.key === "analisis")!;

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
  libs.upsertStage.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  restaurarZona();
});

function abrir(existing: ReturnType<typeof stage> | null = null) {
  render(<StageDrawer projectId="p-1" stage={ETAPA} existing={existing} open onClose={vi.fn()} onSaved={vi.fn()} />);
}
const campoFecha = () => screen.getByLabelText("Fecha de completado", { exact: true }) as HTMLInputElement;
const guardar = () => fireEvent.click(screen.getByRole("button", { name: /^guardar etapa$/i }));
async function guardado(): Promise<string> {
  await waitFor(() => expect(libs.upsertStage).toHaveBeenCalledTimes(1), WAIT);
  return (libs.upsertStage.mock.calls[0][3] as { completed_at: string }).completed_at;
}

describe.each(ZONAS)("cajón de etapa · fecha propuesta · proceso en $tz", (zona) => {
  beforeEach(() => aplicarZona(zona));

  it("control: el cambio de zona surte efecto", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(zona.offset);
  });

  it.each([
    ["2026-11-02", "17:59", "2026-11-02"],
    ["2026-11-02", "18:00", "2026-11-02"],
    ["2026-11-02", "23:59", "2026-11-02"],
    ["2026-11-03", "00:00", "2026-11-03"],
  ])("etapa nueva el %s a las %s de Honduras: propone %s (el día de Honduras, no el UTC)", (dia, hora, esperado) => {
    vi.setSystemTime(instanteHN(dia, hora));
    abrir();
    expect(campoFecha().value).toBe(esperado);
  });

  it("a las 20:00 de Honduras guarda la medianoche UTC del día propuesto (la escritura no cambia)", async () => {
    vi.setSystemTime(instanteHN("2026-11-02", "20:00"));
    abrir();
    guardar();
    expect(await guardado()).toBe("2026-11-02T00:00:00.000Z");
  });
});

describe.each(ZONAS)("cajón de etapa · lectura de una etapa guardada · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.setSystemTime(instanteHN("2026-11-02", "10:00"));
  });

  it("lo que guarda el cajón (medianoche UTC) se reabre con el mismo día y se vuelve a guardar idéntico", async () => {
    abrir(stage("analisis", { completed_at: "2026-10-05T00:00:00.000Z" }));
    expect(campoFecha().value).toBe("2026-10-05");
    guardar();
    expect(await guardado()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("un instante a media jornada (15:00Z) se reabre con su día, igual en UTC que en Honduras", () => {
    abrir(stage("analisis", { completed_at: "2026-10-05T15:00:00.000Z" }));
    expect(campoFecha().value).toBe("2026-10-05");
  });

  // Antes la lectura usaba el día UTC (`split("T")[0]`) y reabría este instante con el día siguiente; la lista de
  // etapas, en Honduras, enseñaba otro día. Ahora ambos usan el día de Honduras.
  it("un instante real de las 20:00 de Honduras (02:00Z del día siguiente) se reabre con el día de Honduras", () => {
    abrir(stage("analisis", { completed_at: "2026-10-06T02:00:00.000Z" }));
    expect(campoFecha().value).toBe("2026-10-05");
  });

  it("el valor que devuelve Supabase (+00:00) se lee igual que el que escribe el cajón (Z)", () => {
    abrir(stage("analisis", { completed_at: "2026-10-05T00:00:00+00:00" }));
    expect(campoFecha().value).toBe("2026-10-05");
  });

  it("una fecha guardada inválida no rompe el cajón: propone el hoy comercial y guarda un valor válido", async () => {
    abrir(stage("analisis", { completed_at: "basura" }));
    expect(campoFecha().value).toBe("2026-11-02");
    guardar();
    expect(await guardado()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("ida y vuelta estable: reabrir y guardar varias veces seguidas no pierde ningún día", async () => {
    let valor = "2026-10-05T00:00:00.000Z";
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      cleanup();
      libs.upsertStage.mockClear();
      abrir(stage("analisis", { completed_at: valor }));
      expect(campoFecha().value).toBe("2026-10-05");
      guardar();
      valor = await guardado();
      expect(valor).toBe("2026-10-05T00:00:00.000Z");
    }
  });

  it("el payload es el mismo que antes para el mismo día elegido (la escritura no cambió)", async () => {
    abrir(stage("analisis", { completed_at: "2026-10-05T00:00:00.000Z" }));
    fireEvent.change(campoFecha(), { target: { value: "2026-12-01" } });
    guardar();
    const guardadoEn = await guardado();
    expect(guardadoEn).toBe(new Date("2026-12-01").toISOString());
    expect(guardadoEn).toBe("2026-12-01T00:00:00.000Z");
    expect(libs.upsertStage.mock.calls[0].slice(0, 3)).toEqual(["p-1", "analisis", ETAPA.label]);
  });
});

describe.each(ZONAS)("fecha de una etapa · presentación · proceso en $tz", (zona) => {
  beforeEach(() => aplicarZona(zona));

  it("control: el cambio de zona surte efecto", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(zona.offset);
  });

  it.each(["2026-10-05T00:00:00.000Z", "2026-10-05T00:00:00+00:00", "2026-10-05T00:00:00Z"])(
    "la medianoche UTC codificada por el cajón (%s) se muestra como el día elegido, 5 oct 2026",
    (valor) => {
      expect(stageCalendarDay(valor)).toBe("2026-10-05");
      expect(formatStageDay(valor)).toMatch(/^5 oct\.? 2026$/);
    },
  );

  it("un instante real a las 20:00 de Honduras (02:00Z del día siguiente) se muestra con el día de Honduras", () => {
    const real = instanteHN("2026-10-05", "20:00").toISOString();
    expect(real).toBe("2026-10-06T02:00:00.000Z");
    expect(stageCalendarDay(real)).toBe("2026-10-05");
    expect(formatStageDay(real)).toMatch(/^5 oct\.? 2026$/);
  });

  it("los instantes reales de un mismo día de Honduras se muestran todos con ese día, no con el UTC", () => {
    for (const hora of ["00:00:01", "09:30", "17:59:59.999", "18:00:00.001", "23:59:59.999"]) {
      expect(stageCalendarDay(instanteHN("2026-10-05", hora).toISOString()), hora).toBe("2026-10-05");
    }
  });

  // Límite inherente a la regla: las 18:00:00.000 en punto de Honduras SON la medianoche UTC y no se distinguen de una
  // fecha codificada por el cajón. Un instante real así (un milisegundo exacto) se muestra con el día siguiente.
  it("límite conocido: las 18:00:00.000 exactas de Honduras se leen como fecha codificada (día siguiente)", () => {
    expect(stageCalendarDay(instanteHN("2026-10-05", "18:00").toISOString())).toBe("2026-10-06");
  });

  it("solo la medianoche UTC EXACTA es una fecha codificada: un milisegundo después ya es un instante real", () => {
    expect(stageCalendarDay("2026-10-05T00:00:00.001Z")).toBe("2026-10-04");
    expect(stageCalendarDay("2026-10-05T00:00:01Z")).toBe("2026-10-04");
  });

  it.each(["basura", "", "2026-13-40T00:00:00Z", "2026-02-30T00:00:00Z", "0050-01-01T00:00:00Z"])(
    "un valor inválido (%j) sale como «—», sin NaN ni Invalid Date",
    (valor) => {
      expect(stageCalendarDay(valor)).toBeNull();
      expect(formatStageDay(valor)).toBe("—");
    },
  );

  it("sin valor sale como «—»", () => {
    expect(formatStageDay(null)).toBe("—");
    expect(formatStageDay(undefined)).toBe("—");
  });

  it("la lista de etapas (PipelineHeader) y el cajón muestran el mismo día", () => {
    vi.setSystemTime(instanteHN("2026-11-02", "10:00"));
    const etapas = [
      stage("analisis", { completed_at: "2026-10-05T00:00:00+00:00" }),
      stage("dominio", { completed_at: instanteHN("2026-10-08", "20:00").toISOString() }),
    ];
    render(<PipelineHeader stagesData={etapas} onStageClick={vi.fn()} isCollapsed={false} onToggleCollapse={vi.fn()} />);
    const items = screen.getAllByRole("listitem");
    const dia = (i: number) => items[i].querySelector("time")!;
    expect(dia(0).textContent).toMatch(/^5 oct\.? 2026$/);
    expect(dia(0).getAttribute("datetime")).toBe("2026-10-05");
    expect(dia(1).textContent).toMatch(/^8 oct\.? 2026$/);
    expect(dia(1).getAttribute("datetime")).toBe("2026-10-08");
    cleanup();
    abrir(etapas[0]);
    expect(campoFecha().value).toBe("2026-10-05");
  });

  it("flujo completo: se elige el 5 de octubre, se guarda y la lista lo muestra como 5 de octubre", async () => {
    vi.setSystemTime(instanteHN("2026-11-02", "10:00"));
    abrir();
    fireEvent.change(campoFecha(), { target: { value: "2026-10-05" } });
    guardar();
    const guardadoEn = await guardado();
    expect(guardadoEn).toBe("2026-10-05T00:00:00.000Z");
    expect(formatStageDay(guardadoEn)).toMatch(/^5 oct\.? 2026$/);
  });
});

describe("fecha de una etapa · por qué hace falta el caso especial", () => {
  afterEach(() => restaurarZona());

  it("calendarDayOf del valor que escribe el cajón da el día ANTERIOR: usarlo sin más haría perder un día por guardado", () => {
    const escrito = "2026-10-05T00:00:00.000Z";
    expect(calendarDayOf(escrito)).toBe("2026-10-04");
    // Dos guardados seguidos con esa lectura: 5 -> 4 -> 3.
    const segundo = new Date(calendarDayOf(escrito)!).toISOString();
    expect(calendarDayOf(segundo)).toBe("2026-10-03");
    // Con `stageCalendarDay` la lectura es estable.
    expect(stageCalendarDay(new Date(stageCalendarDay(escrito)!).toISOString())).toBe("2026-10-05");
  });
});
