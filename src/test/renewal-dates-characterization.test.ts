// Caracterización de `daysUntil` y `getUpcomingRenewals`: lo que hacen HOY y debe conservarse tras corregir el
// manejo de zonas. Solo se usan instantes donde el día UTC y el día de Honduras coinciden (09:00 de Honduras =
// 15:00Z y 00:30 de Honduras = 06:30Z), con el proceso en UTC y en Honduras. Los casos donde ambos días difieren
// (18:00-23:59 de Honduras) están en `renewal-dates.test.ts`.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysUntil, getUpcomingRenewals } from "@/lib/projects";
import {
  aplicarZona, consultaSimulada, instanteHN, restaurarZona, sumarDias, ZONAS,
  type FilaSimulada,
} from "./helpers/renewalDates";

vi.mock("@/integrations/supabase/client", async () => {
  const { clienteSimulado: supabase } = await import("./helpers/renewalDates");
  return { supabase };
});

const ZONAS_CARACTERIZACION = ZONAS.filter((z) => z.tz !== "Asia/Tokyo");
const HORAS = ["09:00", "00:30"];

/** El código anterior devolvía `-0` para «hoy» (Math.ceil de un negativo pequeño); aquí solo importa que valga 0. */
const sinCeroNegativo = (n: number) => n + 0;

describe.each(ZONAS_CARACTERIZACION)("daysUntil · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => {
    vi.useRealTimers();
    restaurarZona();
  });

  it("control: el cambio de zona surte efecto", () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(zona.offset);
  });

  describe.each(HORAS)("a las %s de Honduras", (hora) => {
    it("hoy 0, mañana 1, ayer -1, +7, +8, +30 y +31", () => {
      vi.setSystemTime(instanteHN("2026-11-03", hora));
      for (const n of [-1, 0, 1, 7, 8, 30, 31]) {
        expect(sinCeroNegativo(daysUntil(sumarDias("2026-11-03", n))), `día ${n}`).toBe(n);
      }
    });

    it("fin de mes: 30 nov -> 1 dic", () => {
      vi.setSystemTime(instanteHN("2026-11-30", hora));
      expect(daysUntil("2026-12-01")).toBe(1);
      expect(sinCeroNegativo(daysUntil("2026-11-30"))).toBe(0);
      expect(daysUntil("2026-11-29")).toBe(-1);
    });

    it("fin de año: 31 dic -> 1 ene", () => {
      vi.setSystemTime(instanteHN("2026-12-31", hora));
      expect(daysUntil("2027-01-01")).toBe(1);
      expect(daysUntil("2027-01-31")).toBe(31);
      expect(daysUntil("2026-12-30")).toBe(-1);
    });

    it("bisiesto: 28 feb 2028 -> 29 feb -> 1 mar", () => {
      vi.setSystemTime(instanteHN("2028-02-28", hora));
      expect(daysUntil("2028-02-29")).toBe(1);
      expect(daysUntil("2028-03-01")).toBe(2);
      vi.setSystemTime(instanteHN("2028-02-29", hora));
      expect(daysUntil("2028-03-01")).toBe(1);
      expect(daysUntil("2028-02-28")).toBe(-1);
    });

    it("no bisiesto: 28 feb 2027 -> 1 mar 2027 es 1 día", () => {
      vi.setSystemTime(instanteHN("2027-02-28", hora));
      expect(daysUntil("2027-03-01")).toBe(1);
    });

    it("texto inválido da NaN", () => {
      vi.setSystemTime(instanteHN("2026-11-03", hora));
      expect(daysUntil("")).toBeNaN();
      expect(daysUntil("sin fecha")).toBeNaN();
    });
  });
});

const FILAS: FilaSimulada[] = [
  { id: "r-31", renewal_date: "2026-12-04", proyectos_clientes: { nombre_proyecto: "Proyecto C" } },
  { id: "r-hoy", renewal_date: "2026-11-03", proyectos_clientes: { nombre_proyecto: "Proyecto A" } },
  { id: "r-ayer", renewal_date: "2026-11-02", proyectos_clientes: { nombre_proyecto: "Proyecto A" } },
  { id: "r-30", renewal_date: "2026-12-03", proyectos_clientes: null },
  { id: "r-man", renewal_date: "2026-11-04", proyectos_clientes: { nombre_proyecto: "Proyecto B" } },
];

describe.each(ZONAS_CARACTERIZACION)("getUpcomingRenewals · proceso en $tz, 09:00 de Honduras", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instanteHN("2026-11-03", "09:00"));
    consultaSimulada.reiniciar({ filas: FILAS });
  });
  afterEach(() => {
    vi.useRealTimers();
    restaurarZona();
  });

  it("consulta project_services con el select, la ventana [hoy, hoy+30] y orden ascendente", async () => {
    await getUpcomingRenewals();
    expect(consultaSimulada.args("from")).toEqual(["project_services"]);
    expect(consultaSimulada.args("select")).toEqual(["*, proyectos_clientes(nombre_proyecto)"]);
    expect(consultaSimulada.args("gte")).toEqual(["renewal_date", "2026-11-03"]);
    expect(consultaSimulada.args("lte")).toEqual(["renewal_date", "2026-12-03"]);
    expect(consultaSimulada.args("order")).toEqual(["renewal_date", { ascending: true }]);
    expect(consultaSimulada.veces("gte")).toBe(1);
    expect(consultaSimulada.veces("lte")).toBe(1);
  });

  it("respeta el parámetro days", async () => {
    await getUpcomingRenewals(7);
    expect(consultaSimulada.args("gte")).toEqual(["renewal_date", "2026-11-03"]);
    expect(consultaSimulada.args("lte")).toEqual(["renewal_date", "2026-11-10"]);
  });

  it("devuelve solo hoy, mañana y +30, en orden de fecha, con nombre_proyecto", async () => {
    const r = await getUpcomingRenewals();
    expect(r.map((x) => x.id)).toEqual(["r-hoy", "r-man", "r-30"]);
    expect(r.map((x) => x.nombre_proyecto)).toEqual(["Proyecto A", "Proyecto B", ""]);
    expect(r[0]).toMatchObject({ id: "r-hoy", renewal_date: "2026-11-03" });
  });

  it("nombre_proyecto queda vacío si falta la relación", async () => {
    consultaSimulada.reiniciar({ datos: [{ id: "a", renewal_date: "2026-11-05" }, { id: "b", renewal_date: "2026-11-06", proyectos_clientes: {} }] });
    const r = await getUpcomingRenewals();
    expect(r.map((x) => x.nombre_proyecto)).toEqual(["", ""]);
  });

  it("sin datos (null) devuelve una lista vacía", async () => {
    consultaSimulada.reiniciar({ datos: null });
    await expect(getUpcomingRenewals()).resolves.toEqual([]);
  });

  it("propaga el error de la consulta", async () => {
    const error = new Error("fallo simulado");
    consultaSimulada.reiniciar({ error });
    await expect(getUpcomingRenewals()).rejects.toBe(error);
  });
});

