// Regresión de `daysUntil` y `getUpcomingRenewals`: la zona comercial es America/Tegucigalpa (UTC-6, sin horario de
// verano) SIEMPRE, sea cual sea la zona del proceso. «Hoy comercial» es el día de calendario del instante actual en
// Honduras. Cada caso corre con el proceso en UTC, en Honduras y en Tokio para demostrar esa independencia.
//
// Cambio intencional: las fechas imposibles (`2026-02-30`, `2027-02-29`, `2026-11-31`, `2026-13-01`) dan `NaN`.
// Antes, V8 las desbordaba a marzo o a enero del año siguiente y devolvía un número que parecía válido.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RenewalAlerts from "@/components/dashboard/dashboard-home/RenewalAlerts";
import ContentTabs from "@/components/dashboard/project-detail/ContentTabs";
import { isUrgentRenewal } from "@/components/dashboard/dashboard-home/projectMetrics";
import { daysUntil, getUpcomingRenewals } from "@/lib/projects";
import { service } from "./helpers/projectFixtures";
import {
  aplicarZona, consultaSimulada, instanteHN, restaurarZona, sumarDias, ZONAS, type FilaSimulada,
} from "./helpers/renewalDates";

vi.mock("@/integrations/supabase/client", async () => {
  const { clienteSimulado: supabase } = await import("./helpers/renewalDates");
  return { supabase };
});

const HOY = "2026-11-03";
const HORAS_HN = ["00:00", "00:01", "17:59", "18:00", "23:59", "23:59:59.999"];

/**
 * Valor de `daysUntil` para cada cadena, en un objeto: si falla, el diff muestra todos los casos a la vez. Normaliza
 * `-0` a 0 (`n + 0`) para que estas tablas midan solo el DÍA; que «hoy» no sea `-0` lo fijan pruebas aparte.
 */
const leer = (cadenas: readonly string[]) => Object.fromEntries(cadenas.map((c) => [c, daysUntil(c) + 0]));
const esperar = (tabla: readonly [string, number][]) => Object.fromEntries(tabla);

describe.each(ZONAS)("daysUntil · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    restaurarZona();
  });

  it("control: el cambio de zona surte efecto (360 Honduras, 0 UTC, -540 Tokio)", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(zona.offset);
  });

  describe.each(HORAS_HN)("a las %s de Honduras", (hora) => {
    beforeEach(() => vi.setSystemTime(instanteHN(HOY, hora)));

    it("hoy 0, mañana 1, ayer -1, +7, +8, +30 y +31", () => {
      const desfases = [-1, 0, 1, 7, 8, 30, 31];
      const fechas = desfases.map((n) => sumarDias(HOY, n));
      expect(leer(fechas)).toEqual(Object.fromEntries(fechas.map((f, i) => [f, desfases[i]])));
    });

    it("hoy es exactamente 0 (nunca -0)", () => {
      expect(Object.is(daysUntil(HOY), 0)).toBe(true);
    });

    it("urgente: +7 sí, +8 no; hoy y mañana sí", () => {
      const urgente = (n: number) => isUrgentRenewal(daysUntil(sumarDias(HOY, n)));
      expect([0, 1, 7, 8].map(urgente)).toEqual([true, true, true, false]);
    });
  });

  it("límite de medianoche: 23:59:59.999 «mañana» es 1; a las 00:00:00.000 del día siguiente es 0", () => {
    vi.setSystemTime(instanteHN(HOY, "23:59:59.999"));
    expect(daysUntil("2026-11-04")).toBe(1);
    expect(daysUntil(HOY) + 0).toBe(0);
    vi.setSystemTime(instanteHN("2026-11-04", "00:00:00.000"));
    expect(daysUntil("2026-11-04") + 0).toBe(0);
    expect(daysUntil(HOY)).toBe(-1);
  });

  describe.each(["00:00", "18:00", "23:59"])("calendario, a las %s de Honduras", (hora) => {
    const en = (dia: string) => vi.setSystemTime(instanteHN(dia, hora));

    it("fin de mes: 30 nov y 31 ene", () => {
      en("2026-11-30");
      expect(leer(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-31"])).toEqual(
        esperar([["2026-11-29", -1], ["2026-11-30", 0], ["2026-12-01", 1], ["2026-12-31", 31]]),
      );
      en("2027-01-31");
      expect(leer(["2027-01-30", "2027-01-31", "2027-02-01", "2027-02-28"])).toEqual(
        esperar([["2027-01-30", -1], ["2027-01-31", 0], ["2027-02-01", 1], ["2027-02-28", 28]]),
      );
    });

    it("fin de año: 31 dic -> 1 ene", () => {
      en("2026-12-31");
      expect(leer(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-30"])).toEqual(
        esperar([["2026-12-30", -1], ["2026-12-31", 0], ["2027-01-01", 1], ["2027-01-30", 30]]),
      );
    });

    it("bisiesto: 28 feb 2028 -> 29 feb (1) -> 1 mar (2)", () => {
      en("2028-02-28");
      expect(leer(["2028-02-28", "2028-02-29", "2028-03-01"])).toEqual(
        esperar([["2028-02-28", 0], ["2028-02-29", 1], ["2028-03-01", 2]]),
      );
      en("2028-02-29");
      expect(leer(["2028-02-28", "2028-02-29", "2028-03-01"])).toEqual(
        esperar([["2028-02-28", -1], ["2028-02-29", 0], ["2028-03-01", 1]]),
      );
    });

    it("no bisiesto: 28 feb 2027 -> 1 mar 2027 es 1", () => {
      en("2027-02-28");
      expect(daysUntil("2027-03-01")).toBe(1);
    });

    it("años de 365 y 366 días entre dos 1 de marzo", () => {
      en("2026-03-01");
      expect(daysUntil("2027-03-01")).toBe(365);
      en("2027-03-01");
      expect(daysUntil("2028-03-01")).toBe(366);
    });

    it("fechas imposibles dan NaN; 2028-02-29 es válida", () => {
      en(HOY);
      const malas = ["2026-02-30", "2027-02-29", "2026-11-31", "2026-13-01", "2026-04-31"];
      expect(leer(malas)).toEqual(Object.fromEntries(malas.map((m) => [m, NaN])));
      expect(daysUntil("2028-02-29")).toBe(483); // 365 (3 nov 2026 -> 3 nov 2027) + 118 (-> 29 feb 2028)
    });

    it("texto inválido da NaN", () => {
      en(HOY);
      expect(leer(["", "sin fecha"])).toEqual({ "": NaN, "sin fecha": NaN });
    });
  });

  describe.each(["09:00", "23:59:59.999"])("timestamps, a las %s de Honduras (hoy comercial 2026-11-03)", (hora) => {
    beforeEach(() => vi.setSystemTime(instanteHN(HOY, hora)));

    it("con zona explícita cuenta el día en que cae el instante EN Honduras", () => {
      const tabla: [string, number][] = [
        ["2026-11-04T03:00:00Z", 0], // 3 nov 21:00 en Honduras
        ["2026-11-04T05:59:59Z", 0],
        ["2026-11-04T05:59:59.999Z", 0],
        ["2026-11-04T06:00:00Z", 1], // 4 nov 00:00 en Honduras
        ["2026-11-04T00:30:00-06:00", 1],
        ["2026-11-04T03:00:00+00:00", 0],
        ["2026-11-04T03:00:00+0000", 0],
        ["2026-11-03T23:30:00-06:00", 0],
        ["2026-11-04T23:59:59-06:00", 1],
        ["2026-11-03T05:59:59Z", -1], // 2 nov 23:59:59 en Honduras
        ["2026-11-03T06:00:00Z", 0],
        ["2026-11-04T08:00:00+09:00", 0], // 3 nov 17:00 en Honduras
        ["2026-11-04T09:00:00+09:00", 0], // 3 nov 18:00 en Honduras
        ["2026-11-04T15:00:00+09:00", 1], // 4 nov 00:00 en Honduras
      ];
      expect(leer(tabla.map(([c]) => c))).toEqual(esperar(tabla));
    });

    it("sin zona es hora de pared de Honduras: cuenta su parte de fecha", () => {
      const tabla: [string, number][] = [
        ["2026-11-04T23:00:00", 1],
        ["2026-11-04T00:00:00", 1],
        ["2026-11-03T23:59:59", 0],
        ["2026-11-03T00:00:00", 0],
        ["2026-11-02T23:59:59", -1],
        ["2026-11-10T01:00:00", 7],
        ["2026-11-11T23:00:00", 8],
      ];
      expect(leer(tabla.map(([c]) => c))).toEqual(esperar(tabla));
    });

    it("los timestamps nunca dan -0", () => {
      expect(Object.is(daysUntil("2026-11-04T03:00:00Z"), 0)).toBe(true);
      expect(Object.is(daysUntil("2026-11-03T12:00:00"), 0)).toBe(true);
    });
  });
});

// ── getUpcomingRenewals ───────────────────────────────────────────────────────

const fila = (id: string, renewal_date: string): FilaSimulada => ({
  id, renewal_date, proyectos_clientes: { nombre_proyecto: `Proyecto ${id}` },
});
/** Filas en desorden a propósito: el orden lo debe poner la consulta (`order`), no el orden de llegada. */
const filasAlrededor = (hoy: string): FilaSimulada[] => [
  fila("mas31", sumarDias(hoy, 31)), fila("mas30", sumarDias(hoy, 30)), fila("ayer", sumarDias(hoy, -1)),
  fila("manana", sumarDias(hoy, 1)), fila("hoy", hoy),
];

describe.each(ZONAS)("getUpcomingRenewals · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
    consultaSimulada.reiniciar({ filas: filasAlrededor(HOY) });
  });
  afterEach(() => {
    vi.useRealTimers();
    restaurarZona();
  });

  describe.each(["17:59", "18:00", "23:59", "00:00", "23:59:59.999"])("a las %s de Honduras", (hora) => {
    beforeEach(() => vi.setSystemTime(instanteHN(HOY, hora)));

    it("ventana [hoy comercial, hoy+30] y solo vuelven hoy, mañana y +30, en orden", async () => {
      const r = await getUpcomingRenewals();
      expect(consultaSimulada.args("gte")).toEqual(["renewal_date", "2026-11-03"]);
      expect(consultaSimulada.args("lte")).toEqual(["renewal_date", "2026-12-03"]);
      expect(r.map((x) => x.id)).toEqual(["hoy", "manana", "mas30"]);
    });

    it("mismos tabla, select y orden ascendente; una sola cota por lado", async () => {
      await getUpcomingRenewals();
      expect(consultaSimulada.args("from")).toEqual(["project_services"]);
      expect(consultaSimulada.args("select")).toEqual(["*, proyectos_clientes(nombre_proyecto)"]);
      expect(consultaSimulada.args("order")).toEqual(["renewal_date", { ascending: true }]);
      expect(consultaSimulada.veces("gte")).toBe(1);
      expect(consultaSimulada.veces("lte")).toBe(1);
    });
  });

  it("a las 00:00:00.000 del día siguiente la ventana avanza un día", async () => {
    vi.setSystemTime(instanteHN("2026-11-04", "00:00:00.000"));
    await getUpcomingRenewals();
    expect(consultaSimulada.args("gte")).toEqual(["renewal_date", "2026-11-04"]);
    expect(consultaSimulada.args("lte")).toEqual(["renewal_date", "2026-12-04"]);
  });

  it.each([
    ["2026-12-15", "2027-01-14", "cruce de año"],
    ["2026-12-31", "2027-01-30", "31 de diciembre"],
    ["2028-02-10", "2028-03-11", "febrero bisiesto"],
    ["2027-02-10", "2027-03-12", "febrero no bisiesto"],
    ["2026-01-31", "2026-03-02", "fin de enero"],
  ])("hoy %s -> lte %s (%s)", async (hoy, limite) => {
    for (const hora of ["00:00", "18:00", "23:59"]) {
      vi.setSystemTime(instanteHN(hoy, hora));
      await getUpcomingRenewals();
      expect(consultaSimulada.args("gte"), hora).toEqual(["renewal_date", hoy]);
      expect(consultaSimulada.args("lte"), hora).toEqual(["renewal_date", limite]);
    }
  });

  it("days = 7 y days = 0 se respetan", async () => {
    vi.setSystemTime(instanteHN(HOY, "18:00"));
    await getUpcomingRenewals(7);
    expect(consultaSimulada.args("gte")).toEqual(["renewal_date", "2026-11-03"]);
    expect(consultaSimulada.args("lte")).toEqual(["renewal_date", "2026-11-10"]);
    await getUpcomingRenewals(0);
    expect(consultaSimulada.args("gte")).toEqual(["renewal_date", "2026-11-03"]);
    expect(consultaSimulada.args("lte")).toEqual(["renewal_date", "2026-11-03"]);
  });

  it("mapea nombre_proyecto (vacío si falta) y propaga el error", async () => {
    vi.setSystemTime(instanteHN(HOY, "18:00"));
    consultaSimulada.reiniciar({ datos: [fila("a", HOY), { id: "b", renewal_date: HOY }] });
    expect((await getUpcomingRenewals()).map((x) => x.nombre_proyecto)).toEqual(["Proyecto a", ""]);
    const error = new Error("fallo simulado");
    consultaSimulada.reiniciar({ error });
    await expect(getUpcomingRenewals()).rejects.toBe(error);
  });
});

// ── «Renovaciones próximas» del Resumen ───────────────────────────────────────

type Renovacion = Parameters<typeof RenewalAlerts>[0]["renewals"][number];
const NOMBRES = ["Servicio ayer", "Servicio hoy", "Servicio mañana", "Servicio +7", "Servicio +8", "Servicio +30", "Servicio +31"];
const DESFASES = [-1, 0, 1, 7, 8, 30, 31];
const filasServicio = (hoy: string): FilaSimulada[] =>
  DESFASES.map((n, i) => ({
    ...service({ id: `sv-${i}`, name: NOMBRES[i], renewal_date: sumarDias(hoy, n) }),
    proyectos_clientes: { nombre_proyecto: "Proyecto Demo" },
  })) as unknown as FilaSimulada[];

/** Lo que dice cada fila renderizada (o `null` si no aparece). */
function resumenDeFilas() {
  return Object.fromEntries(
    NOMBRES.map((nombre) => {
      const li = screen.queryByText(nombre)?.closest("li");
      if (!li) return [nombre, null];
      return [nombre, {
        cuando: li.querySelector(".tabular")?.textContent,
        etiqueta: li.querySelector('[data-kind="custom"]')?.textContent,
        urgente: li.querySelector('[data-tone="destructive"]') !== null,
      }];
    }),
  );
}

describe.each(ZONAS)("Renovaciones próximas · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
    consultaSimulada.reiniciar({ filas: filasServicio(HOY) });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    restaurarZona();
  });

  it.each(["18:00", "23:59"])("a las %s de Honduras: hoy y +7 urgentes, mañana, +8 y +30; nada de ayer ni +31", async (hora) => {
    vi.setSystemTime(instanteHN(HOY, hora));
    const renewals = (await getUpcomingRenewals(30)) as unknown as Renovacion[];
    render(createElement(RenewalAlerts, { renewals }));
    expect(resumenDeFilas()).toEqual({
      "Servicio ayer": null,
      "Servicio hoy": { cuando: "hoy", etiqueta: "Urgente", urgente: true },
      "Servicio mañana": { cuando: "mañana", etiqueta: "Urgente", urgente: true },
      "Servicio +7": { cuando: "en 7 días", etiqueta: "Urgente", urgente: true },
      "Servicio +8": { cuando: "en 8 días", etiqueta: "Próxima", urgente: false },
      "Servicio +30": { cuando: "en 30 días", etiqueta: "Próxima", urgente: false },
      "Servicio +31": null,
    });
    expect(screen.queryByText(/en 31 días/)).toBeNull();
  });
});

// ── Pestaña de servicios del detalle de proyecto ──────────────────────────────

describe.each(ZONAS)("Detalle de proyecto · servicios · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instanteHN(HOY, "18:30"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    restaurarZona();
  });

  it("a las 18:30 de Honduras: mañana Urgente, hoy Urgente, ayer «hace 1 día» Vencida", () => {
    render(createElement(ContentTabs, {
      services: [
        service({ id: "a", name: "Vence mañana", renewal_date: sumarDias(HOY, 1) }),
        service({ id: "b", name: "Vence hoy", renewal_date: HOY }),
        service({ id: "c", name: "Venció ayer", renewal_date: sumarDias(HOY, -1) }),
      ],
      tickets: [], tokens: [], maintenance: [], projectId: "p-1", showMaintenance: false,
      onRefresh: vi.fn(), onDeleteService: vi.fn(), onShowServiceForm: vi.fn(),
    }));
    const texto = (n: string) => screen.getByText(n).closest("tr")?.querySelector("td:nth-child(4)")?.textContent;
    expect({ manana: texto("Vence mañana"), hoy: texto("Vence hoy"), ayer: texto("Venció ayer") }).toEqual({
      manana: expect.stringMatching(/^Urgente.*mañana/),
      hoy: expect.stringMatching(/^Urgente.*hoy/),
      ayer: expect.stringMatching(/^Vencida.*hace 1 día/),
    });
  });
});
