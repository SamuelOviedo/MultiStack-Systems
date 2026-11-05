// Módulo puro de fechas de calendario (`src/lib/calendarDate.ts`). Todo corre con el proceso en UTC, en Honduras y en
// Tokio: ningún resultado puede depender de la zona del proceso. Las tablas se comparan como objetos para que, si
// algo falla, el diff muestre todos los casos a la vez.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMMERCIAL_TIME_ZONE, addCalendarDays, calendarDayOf, calendarDaysBetween, commercialToday,
} from "@/lib/calendarDate";
import { aplicarZona, instanteHN, restaurarZona, ZONAS } from "./helpers/renewalDates";

const tabla = <T>(casos: readonly (readonly [string, T])[]) => Object.fromEntries(casos);
const dias = (cadenas: readonly string[]) => Object.fromEntries(cadenas.map((c) => [c, calendarDayOf(c)]));

describe.each(ZONAS)("calendarDate · proceso en $tz", (zona) => {
  beforeEach(() => aplicarZona(zona));
  afterEach(() => {
    vi.useRealTimers();
    restaurarZona();
  });

  // ── commercialToday ─────────────────────────────────────────────────────────

  it("hoy comercial con el reloj del sistema: cambia a medianoche de Honduras, no a la del proceso", () => {
    expect(COMMERCIAL_TIME_ZONE).toBe("America/Tegucigalpa");
    vi.useFakeTimers({ toFake: ["Date"] });
    const casos: [string, string][] = [
      ["2026-11-03 00:00", "2026-11-03"],
      ["2026-11-03 17:59", "2026-11-03"], // 23:59Z
      ["2026-11-03 18:00", "2026-11-03"], // 00:00Z del 4: en UTC ya es otro día
      ["2026-11-03 23:59", "2026-11-03"],
      ["2026-11-03 23:59:59.999", "2026-11-03"],
      ["2026-11-04 00:00", "2026-11-04"],
      ["2026-12-31 23:59", "2026-12-31"], // en UTC y en Tokio ya es 2027
    ];
    const leidos = casos.map(([cuando]): [string, string] => {
      const [dia, hora] = cuando.split(" ");
      vi.setSystemTime(instanteHN(dia, hora));
      return [cuando, commercialToday()];
    });
    expect(tabla(leidos)).toEqual(tabla(casos));
  });

  it("hoy comercial de un instante explícito (Date o número) ignora el reloj; fuera de rango lanza", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instanteHN("2030-06-15", "12:00"));
    expect(commercialToday(instanteHN("2026-11-03", "18:00"))).toBe("2026-11-03");
    expect(commercialToday(instanteHN("2026-11-03", "18:00").getTime())).toBe("2026-11-03");
    expect(commercialToday(Date.UTC(2026, 10, 4, 5, 59, 59, 999))).toBe("2026-11-03");
    expect(commercialToday(Date.UTC(2026, 10, 4, 6))).toBe("2026-11-04");
    expect(() => commercialToday(NaN)).toThrow(RangeError);
    expect(() => commercialToday(new Date("sin fecha"))).toThrow(RangeError);
    expect(() => commercialToday(Date.UTC(10000, 0, 1, 12))).toThrow(RangeError);
  });

  // ── addCalendarDays y calendarDaysBetween ───────────────────────────────────

  it("suma de días con cruces de mes, año y bisiesto", () => {
    const casos: [string, number, string][] = [
      ["2026-11-03", 0, "2026-11-03"],
      ["2026-11-03", 30, "2026-12-03"],
      ["2026-01-31", 1, "2026-02-01"],
      ["2026-01-31", 30, "2026-03-02"],
      ["2026-12-31", 1, "2027-01-01"],
      ["2027-01-01", -1, "2026-12-31"],
      ["2028-02-28", 1, "2028-02-29"],
      ["2027-02-28", 1, "2027-03-01"],
      ["2028-02-10", 30, "2028-03-11"],
      ["2027-03-01", 366, "2028-03-01"],
      ["0100-01-01", 1, "0100-01-02"], // límite inferior del dominio
    ];
    const clave = (dia: string, n: number) => `${dia} ${n >= 0 ? "+" : ""}${n}`;
    expect(Object.fromEntries(casos.map(([d, n]) => [clave(d, n), addCalendarDays(d, n)])))
      .toEqual(Object.fromEntries(casos.map(([d, n, r]) => [clave(d, n), r])));
  });

  it("suma de días: fecha inválida, n no entero o resultado fuera del dominio lanzan RangeError", () => {
    const malas: [string, number][] = [
      ["2026-02-30", 1], ["sin fecha", 1], ["2026-11-03", 1.5], ["2026-11-03", NaN],
      ["9999-12-31", 1], ["0100-01-01", -1], ["2026-11-03", Number.MAX_SAFE_INTEGER],
    ];
    for (const [dia, n] of malas) expect(() => addCalendarDays(dia, n), `${dia} + ${n}`).toThrow(RangeError);
  });

  it("diferencia de días de calendario con cruces de mes, año y bisiesto", () => {
    const casos: [string, string, number][] = [
      ["2026-11-03", "2026-11-04", 1],
      ["2026-11-04", "2026-11-03", -1],
      ["2026-11-30", "2026-12-01", 1],
      ["2026-12-31", "2027-01-01", 1],
      ["2028-02-28", "2028-03-01", 2],
      ["2027-02-28", "2027-03-01", 1],
      ["2026-03-01", "2027-03-01", 365],
      ["2027-03-01", "2028-03-01", 366],
    ];
    expect(Object.fromEntries(casos.map(([a, b]) => [`${a} -> ${b}`, calendarDaysBetween(a, b)])))
      .toEqual(Object.fromEntries(casos.map(([a, b, n]) => [`${a} -> ${b}`, n])));
  });

  it("diferencia: el mismo día es 0 (nunca -0); fechas inválidas o con hora dan NaN", () => {
    expect(Object.is(calendarDaysBetween("2026-11-03", "2026-11-03"), 0)).toBe(true);
    expect(calendarDaysBetween("2026-02-30", "2026-11-03")).toBeNaN();
    expect(calendarDaysBetween("2026-11-03", "")).toBeNaN();
    expect(calendarDaysBetween("2026-11-03", "2026-11-04T00:00:00Z")).toBeNaN();
  });

  // ── calendarDayOf ───────────────────────────────────────────────────────────

  it("fecha de calendario: la fecha literal; las imposibles dan null", () => {
    const validas = ["2026-11-04", "2028-02-29", "2026-12-31", "0100-01-01", "0226-11-04", "9999-12-31"];
    expect(dias(validas)).toEqual(Object.fromEntries(validas.map((f) => [f, f])));
    const imposibles = ["2026-02-30", "2027-02-29", "2026-11-31", "2026-04-31", "2026-13-01", "2026-00-10", "2026-11-00"];
    expect(dias(imposibles)).toEqual(Object.fromEntries(imposibles.map((f) => [f, null])));
  });

  it("instante con zona: el día en que cae en Honduras", () => {
    const casos: [string, string | null][] = [
      ["2026-11-04T03:00:00Z", "2026-11-03"], // 3 nov 21:00 en Honduras
      ["2026-11-04T06:00:00Z", "2026-11-04"], // 4 nov 00:00 en Honduras
      ["2026-11-04T00:30:00-06:00", "2026-11-04"],
      ["2026-11-04T03:00:00+00:00", "2026-11-03"],
      ["2026-11-04T03:00:00-00:00", "2026-11-03"],
      ["2026-11-04T03:00:00+0000", "2026-11-03"],
      ["2026-11-04T08:00:00+09", "2026-11-03"], // 3 nov 17:00 en Honduras
      ["2026-11-04T15:00+09:00", "2026-11-04"], // sin segundos
      ["2026-11-04 03:00:00+00", "2026-11-03"], // salida de Postgres para timestamptz
      ["2026-11-04 05:59:59.999999+00", "2026-11-03"], // microsegundos: se truncan, no se redondean
      ["2027-01-01T05:00:00Z", "2026-12-31"],
      ["2028-03-01T03:00:00Z", "2028-02-29"],
      ["0999-12-31T12:00:00Z", "0999-12-31"], // Intl da «999»: se completa a cuatro cifras
      ["2026-02-30T12:00:00Z", null], // fecha imposible
    ];
    expect(dias(casos.map(([c]) => c))).toEqual(tabla(casos));
  });

  it("fecha y hora sin zona: hora de pared de Honduras, cuenta su parte de fecha", () => {
    const casos: [string, string | null][] = [
      ["2026-11-04T23:00:00", "2026-11-04"],
      ["2026-11-04 00:00:00", "2026-11-04"],
      ["2026-11-04T23:59:59.999999", "2026-11-04"],
      ["2026-11-04T23:59", "2026-11-04"],
      ["2028-02-29T12:00:00", "2028-02-29"],
      ["2027-02-29T12:00:00", null],
    ];
    expect(dias(casos.map(([c]) => c))).toEqual(tabla(casos));
  });

  it("texto inválido, horas fuera de rango, años fuera de 0100-9999 y no-cadenas dan null", () => {
    const malas = [
      "", "sin fecha", " 2026-11-04", "2026-11-04 ", "2026-1-04", "20261104", "2026-11-04T",
      "2026-11-04T24:00:00Z", "2026-11-04T23:60:00", "2026-11-04T23:59:60Z",
      "2026-11-04T03:00:00+24:00", "2026-11-04T03:00:00+05:60", "2026-11-04T03:00:00+05:", "2026-11-04T03:00:00+5",
      "2026-11-04t03:00:00z", "2026-11-04T03:00:00 Z", "0099-12-31", "0000-01-01", "10000-01-01",
    ];
    expect(dias(malas)).toEqual(Object.fromEntries(malas.map((m) => [m, null])));
    for (const raro of [null, undefined, 20261104]) expect(calendarDayOf(raro as unknown as string)).toBeNull();
  });
});
