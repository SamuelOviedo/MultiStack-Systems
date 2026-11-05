// Fechas del cajón de etapa (`StageDrawer`): qué fecha propone, qué guarda y cómo se lee de vuelta.
//
// Corrección: la fecha que PROPONE una etapa nueva es el hoy comercial (día de calendario en Honduras), no el día UTC.
// Desde las 18:00 de Honduras el día UTC ya es el siguiente, y el cajón proponía la fecha de mañana.
//
// Evidencia sin corregir (cambiarla es decisión del propietario): el cajón guarda «YYYY-MM-DD» como
// `new Date(...).toISOString()`, es decir la medianoche UTC de ese día, en una columna `timestamptz`. En Honduras
// (UTC-6) esa medianoche es la tarde del día anterior. Por eso:
//   - al leer una etapa guardada, el campo usa el día UTC del instante (`split("T")[0]`): ida y vuelta estable;
//   - pasarlo a `calendarDayOf` (día en Honduras) restaría un día en cada guardado, así que la lectura NO cambia;
//   - `formatInstantDay` (la fecha que se ve en la lista de etapas) muestra un día antes en Honduras.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { formatInstantDay } from "@/components/dashboard/project-detail/format";
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

  // Límite conocido, hoy sin datos que lo produzcan (el cajón es el único que escribe y siempre manda medianoche UTC):
  // un instante real entre las 18:00 y las 23:59 de Honduras se lee con el día UTC, que ya es el siguiente.
  it("límite conocido: un instante de las 20:00 de Honduras se lee con el día UTC (el siguiente)", () => {
    abrir(stage("analisis", { completed_at: "2026-10-06T02:00:00.000Z" }));
    expect(campoFecha().value).toBe("2026-10-06");
    expect(calendarDayOf("2026-10-06T02:00:00.000Z")).toBe("2026-10-05");
  });
});

describe("cajón de etapa · evidencia de la escritura (sin corregir; decisión del propietario)", () => {
  afterEach(() => restaurarZona());

  it("calendarDayOf del valor que escribe el cajón da el día ANTERIOR: usarlo para leer haría perder un día por guardado", () => {
    const escrito = "2026-10-05T00:00:00.000Z";
    expect(calendarDayOf(escrito)).toBe("2026-10-04");
    // Dos guardados seguidos con esa lectura: 5 -> 4 -> 3.
    const segundo = new Date(calendarDayOf(escrito)!).toISOString();
    expect(calendarDayOf(segundo)).toBe("2026-10-03");
  });

  it.each([
    [ZONAS[0], /^5 oct\.? 2026$/],
    [ZONAS[1], /^4 oct\.? 2026$/],
    [ZONAS[2], /^5 oct\.? 2026$/],
  ] as const)("la fecha que se ve en la lista de etapas (formatInstantDay) con proceso en $0.tz: $1", (zona, esperado) => {
    aplicarZona(zona);
    expect(formatInstantDay("2026-10-05T00:00:00.000Z")).toMatch(esperado);
  });

  it("flujo completo en Honduras: se elige el 5 de octubre y la lista de etapas lo muestra como 4 de octubre", async () => {
    aplicarZona(ZONAS[1]);
    vi.setSystemTime(instanteHN("2026-11-02", "10:00"));
    abrir();
    fireEvent.change(campoFecha(), { target: { value: "2026-10-05" } });
    guardar();
    const guardadoEn = await guardado();
    expect(guardadoEn).toBe("2026-10-05T00:00:00.000Z");
    expect(formatInstantDay(guardadoEn)).toMatch(/^4 oct\.? 2026$/);
  });
});
