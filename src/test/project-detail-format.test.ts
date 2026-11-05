import { afterEach, describe, expect, it } from "vitest";
import {
  RESPONSABLE_ASIGNADO,
  formatDateOnly,
  formatInstantDay,
  formatMoney,
  formatMonthLabel,
  isUuid,
  responsableLabel,
} from "@/components/dashboard/project-detail/format";

const TZ_ORIGINAL = process.env.TZ;
afterEach(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe("responsableLabel · el identificador de una cuenta nunca se muestra crudo", () => {
  it("un nombre escrito se muestra tal cual (recortado)", () => {
    expect(responsableLabel("Persona Demo")).toBe("Persona Demo");
    expect(responsableLabel("  Persona Demo  ")).toBe("Persona Demo");
  });

  it("un UUID (en minúscula o mayúscula) se sustituye por un texto neutro", () => {
    expect(responsableLabel("0000000a-0000-4000-8000-000000000001")).toBe(RESPONSABLE_ASIGNADO);
    expect(responsableLabel("0000000A-0000-4000-8000-00000000ABCD")).toBe(RESPONSABLE_ASIGNADO);
    expect(RESPONSABLE_ASIGNADO).toBe("Responsable asignado");
  });

  it("sin dato devuelve null (se omite)", () => {
    expect(responsableLabel(null)).toBeNull();
    expect(responsableLabel(undefined)).toBeNull();
    expect(responsableLabel("   ")).toBeNull();
  });

  it("un nombre que solo se parece a un UUID no se oculta", () => {
    expect(responsableLabel("0000000a-0000-4000-8000")).toBe("0000000a-0000-4000-8000");
    expect(isUuid("no-es-uuid")).toBe(false);
    expect(isUuid("0000000a-0000-4000-8000-000000000001")).toBe(true);
  });
});

describe("formatMonthLabel · mes legible en minúscula natural, igual en cualquier zona horaria", () => {
  it.each(["UTC", "America/Tegucigalpa", "America/Mexico_City", "Asia/Tokyo", "Pacific/Auckland"])(
    "2026-11-01 es «noviembre de 2026» con la zona %s",
    (tz) => {
      process.env.TZ = tz;
      expect(formatMonthLabel("2026-11-01")).toBe("noviembre de 2026");
      expect(formatMonthLabel("2026-01-01")).toBe("enero de 2026");
      expect(formatMonthLabel("2026-12-01")).toBe("diciembre de 2026");
    },
  );

  it("nunca sale con mayúsculas de título («Noviembre De 2026»)", () => {
    expect(formatMonthLabel("2026-11-01")).not.toMatch(/[A-ZÁÉÍÓÚ]/);
  });

  it("un valor ilegible se devuelve tal cual en vez de «Invalid Date»", () => {
    expect(formatMonthLabel("no es fecha")).toBe("no es fecha");
  });
});

describe("fechas", () => {
  it.each(["UTC", "America/Tegucigalpa", "Asia/Tokyo"])("una fecha sin hora no corre de día con la zona %s", (tz) => {
    process.env.TZ = tz;
    expect(formatDateOnly("2026-11-07")).toBe("7 nov 2026");
  });

  it("un instante se muestra como día corto y uno ilegible como raya", () => {
    process.env.TZ = "UTC";
    expect(formatInstantDay("2026-10-05T15:00:00.000Z")).toBe("5 oct 2026");
    expect(formatInstantDay("basura")).toBe("—");
  });
});

describe("formatMoney · la moneda solo si está registrada", () => {
  it("con moneda: importe y moneda", () => {
    expect(formatMoney(12, "USD")).toBe("12 USD");
    expect(formatMoney("12.00", "HNL")).toBe("12.00 HNL");
  });

  it("sin moneda NO se inventa una", () => {
    expect(formatMoney(100)).toBe("100");
    expect(formatMoney(100, null)).toBe("100");
    expect(formatMoney(100, "  ")).toBe("100");
  });

  it("sin importe devuelve null (el cero es un importe)", () => {
    expect(formatMoney(null, "USD")).toBeNull();
    expect(formatMoney(undefined)).toBeNull();
    expect(formatMoney("")).toBeNull();
    expect(formatMoney(0, "USD")).toBe("0 USD");
  });
});
