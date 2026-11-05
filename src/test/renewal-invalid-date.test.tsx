// Fecha de renovación que no se puede leer (`daysUntil` da NaN): ni «en NaN días» ni insignia de plazo. Se muestra el
// valor tal cual llegó con «Fecha no válida». Solo cambia la presentación: los umbrales, la ventana y `daysUntil` no.
// Se prueba en «Renovaciones próximas» (`RenewalAlerts`) y en la pestaña de servicios del detalle (`Renewal`, dentro
// de `ContentTabs`), y que una fecha válida se ve igual que antes.
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import RenewalAlerts from "@/components/dashboard/dashboard-home/RenewalAlerts";
import { renewalWhen } from "@/components/dashboard/dashboard-home/projectMetrics";
import ContentTabs from "@/components/dashboard/project-detail/ContentTabs";
import { daysUntil } from "@/lib/projects";
import { service } from "./helpers/projectFixtures";
import { aplicarZona, instanteHN, restaurarZona, sumarDias, ZONAS } from "./helpers/renewalDates";

vi.mock("@/integrations/supabase/client", async () => {
  const { clienteSimulado: supabase } = await import("./helpers/renewalDates");
  return { supabase };
});

const HOY = "2026-11-03";
/** Fechas que `daysUntil` no puede leer: imposible, mes 13 y texto. */
const INVALIDAS = ["2026-02-30", "2026-13-01", "pronto"];
const EN_CURSO = /\b(NaN|hoy|mañana|hace \d+ días?|en \d+ días)\b/;
const INSIGNIA = /Urgente|Próxima|Vencida/;

describe("control: lo que se arregla", () => {
  it("daysUntil da NaN para estas fechas y renewalWhen(NaN) sigue diciendo «en NaN días» (no se tocó)", () => {
    for (const f of INVALIDAS) expect(daysUntil(f)).toBeNaN();
    expect(renewalWhen(NaN)).toBe("en NaN días");
  });
});

describe.each(ZONAS)("fecha de renovación no válida · proceso en $tz", (zona) => {
  beforeEach(() => {
    aplicarZona(zona);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(instanteHN(HOY, "10:00"));
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    restaurarZona();
  });

  describe("Renovaciones próximas (RenewalAlerts)", () => {
    const fila = (nombre: string) => screen.getByText(nombre).closest("li") as HTMLElement;
    const renovaciones = () => [
      { ...service({ id: "ok-1", name: "Válida urgente", renewal_date: sumarDias(HOY, 3) }), nombre_proyecto: "Proyecto Alfa" },
      ...INVALIDAS.map((f, i) => ({ ...service({ id: `x-${i}`, name: `Inválida ${i}`, renewal_date: f }), nombre_proyecto: "Proyecto Alfa" })),
      { ...service({ id: "ok-2", name: "Válida próxima", renewal_date: sumarDias(HOY, 12) }), nombre_proyecto: "Proyecto Alfa" },
    ];

    it("no dice «NaN» en ninguna parte", () => {
      const { container } = render(createElement(RenewalAlerts, { renewals: renovaciones() }));
      expect(container.textContent).not.toMatch(/NaN/);
    });

    it.each(INVALIDAS.map((f, i) => [f, i] as const))("«%s»: sin insignia ni texto relativo; dice «Fecha no válida» y el valor tal cual", (valor, i) => {
      render(createElement(RenewalAlerts, { renewals: renovaciones() }));
      const li = fila(`Inválida ${i}`);
      const lado = li.querySelector("div:nth-child(2)") as HTMLElement;
      expect(lado.textContent).toBe(`Fecha no válida: ${valor}`);
      expect(lado.textContent).not.toMatch(INSIGNIA);
      expect(lado.textContent).not.toMatch(EN_CURSO);
      expect(lado.querySelector("svg")).toBeNull();
    });

    it("las fechas válidas se ven igual que antes (insignia, texto relativo y día)", () => {
      render(createElement(RenewalAlerts, { renewals: renovaciones() }));
      const lado = (n: string) => fila(n).querySelector("div:nth-child(2)")!.textContent;
      expect(lado("Válida urgente")).toMatch(/^Urgente.*en 3 días · .+/);
      expect(lado("Válida próxima")).toMatch(/^Próxima.*en 12 días · .+/);
      expect(lado("Válida urgente")).toContain("6 nov");
      expect(lado("Válida próxima")).toContain("15 nov");
    });
  });

  describe("Servicios del detalle de proyecto (ContentTabs)", () => {
    /** El bloque «Renovación» de la fila (la celda también trae el costo para pantallas angostas). */
    const celdaRenovacion = (nombre: string) => screen.getByText(nombre).closest("tr")!.querySelector("td:nth-child(4)")!.firstElementChild as HTMLElement;
    const abrir = () =>
      render(createElement(ContentTabs, {
        services: [
          service({ id: "a", name: "Vence en 3", renewal_date: sumarDias(HOY, 3) }),
          service({ id: "b", name: "Venció hace 2", renewal_date: sumarDias(HOY, -2) }),
          service({ id: "c", name: "Vence en 45", renewal_date: sumarDias(HOY, 45) }),
          ...INVALIDAS.map((f, i) => service({ id: `x-${i}`, name: `Inválida ${i}`, renewal_date: f })),
        ],
        tickets: [], tokens: [], maintenance: [], projectId: "p-1", showMaintenance: false,
        onRefresh: vi.fn(), onDeleteService: vi.fn(), onShowServiceForm: vi.fn(),
      }));

    it("no dice «NaN» en ninguna parte", () => {
      const { container } = abrir();
      expect(container.textContent).not.toMatch(/NaN/);
    });

    it.each(INVALIDAS.map((f, i) => [f, i] as const))("«%s»: sin insignia ni texto relativo; dice «Fecha no válida» y el valor tal cual", (valor, i) => {
      abrir();
      const celda = celdaRenovacion(`Inválida ${i}`);
      expect(celda.textContent).toBe(`Fecha no válida: ${valor}`);
      expect(celda.textContent).not.toMatch(INSIGNIA);
      expect(celda.textContent).not.toMatch(EN_CURSO);
      expect(celda.querySelector("svg")).toBeNull();
    });

    it("las fechas válidas se ven igual que antes: urgente, vencida y lejana sin insignia", () => {
      abrir();
      expect(celdaRenovacion("Vence en 3").textContent).toMatch(/^Urgente.*en 3 días · 6 nov 2026$/);
      expect(celdaRenovacion("Venció hace 2").textContent).toMatch(/^Vencida.*hace 2 días · 1 nov 2026$/);
      const lejana = celdaRenovacion("Vence en 45").textContent;
      expect(lejana).toMatch(/^en 45 días · /);
      expect(lejana).not.toMatch(INSIGNIA);
    });
  });
});
