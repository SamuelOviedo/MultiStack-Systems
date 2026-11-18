import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));
// jsdom no tiene WebGL: las ondas son decorativas y no se prueban aquí.
vi.mock("@/components/site/WavesShader", () => ({ WavesShader: () => null }));

import { readPackageIntent } from "@/lib/packageIntent";
import { PLAN_COMPARISON, SITE_PLANS } from "@/lib/webPackages";
import Index from "@/pages/marketing/Index";
import Planes from "@/pages/marketing/Planes";
import { SITE_CONTENT, shortPlanName } from "@/pages/marketing/siteContent";

// Qué ya cubren otras pruebas: site-views (la tarjeta del Intermedio en /planes y la forma de la tabla), site-home (el
// Intermedio en la home), site-links (SiteLink con packageId) y web-packages (los datos). Aquí va lo que falta: los TRES
// planes en las DOS vistas, la atribución de Ads en el destino y la tabla ya pintada con «Hasta 8» en su columna.

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

// El último valor es el nivel del encabezado de cada tarjeta: h2 en /planes (cuelga del h1) y h3 en la home (bajo el h2 de su banda).
const VIEWS: readonly [string, () => ReactElement, () => HTMLElement, 2 | 3][] = [
  ["/planes", () => <Planes />, () => screen.getByRole("main"), 2],
  [
    "la home",
    () => <Index />,
    // La banda de planes de la home es una sección con nombre: su título.
    () => screen.getByRole("region", { name: SITE_CONTENT.homePlans.title }),
    3,
  ],
];

const renderAt = (view: ReactElement, entry = "/") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      {view}
      <Where />
    </MemoryRouter>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe.each(VIEWS)("planes en %s", (_name, view, scope, level) => {
  it("hay una tarjeta por plan, en el orden de SITE_PLANS", () => {
    renderAt(view());
    const headings = within(scope()).getAllByRole("heading", { level }).map((heading) => heading.textContent);
    expect(headings.filter((text) => SITE_PLANS.some((plan) => plan.name === text))).toEqual(SITE_PLANS.map((plan) => plan.name));
  });

  it.each(SITE_PLANS.map((plan) => [plan.id, plan] as const))(
    "«Solicitar» de %s lleva a /solicitudes?paquete=<id> y guarda la intención de ese plan",
    (_id, plan) => {
      renderAt(view());
      expect(readPackageIntent()).toBeNull();

      const link = within(scope()).getByRole("link", { name: SITE_CONTENT.planCard.requestLabel(plan.name) });
      expect(link).toHaveAttribute("href", `/solicitudes?paquete=${plan.id}`);
      expect(link).not.toHaveAttribute("target");
      // Mientras no se hace clic no se guarda nada: la intención es un gesto, no un efecto de mirar.
      expect(readPackageIntent()).toBeNull();

      fireEvent.click(link);
      expect(screen.getByTestId("where")).toHaveTextContent(`/solicitudes?paquete=${plan.id}`);
      expect(readPackageIntent()).toBe(plan.id);
    },
  );

  it("pedir otro plan reemplaza la intención anterior", () => {
    renderAt(view());
    const [first, , last] = SITE_PLANS;
    fireEvent.click(within(scope()).getByRole("link", { name: SITE_CONTENT.planCard.requestLabel(first!.name) }));
    expect(readPackageIntent()).toBe(first!.id);
    // Tras navegar la vista ya no está; se vuelve a pintar como lo haría el SPA al regresar.
    cleanup();
    renderAt(view());
    fireEvent.click(within(scope()).getByRole("link", { name: SITE_CONTENT.planCard.requestLabel(last!.name) }));
    expect(readPackageIntent()).toBe(last!.id);
  });

  it("conserva el click-id y los utm del anuncio en el destino, y deja atrás el resto de la query", () => {
    renderAt(view(), "/?gclid=abc&utm_campaign=x&token=secreto");
    const plan = SITE_PLANS[1]!;
    const link = within(scope()).getByRole("link", { name: SITE_CONTENT.planCard.requestLabel(plan.name) });
    expect(link).toHaveAttribute("href", `/solicitudes?paquete=${plan.id}&gclid=abc&utm_campaign=x`);
    expect(link.getAttribute("href")).not.toContain("token");
  });
});

describe("home: el enlace a la comparación", () => {
  it("«Compara todo lo que incluye cada plan» lleva a /planes", () => {
    renderAt(<Index />);
    const link = screen.getByRole("link", { name: SITE_CONTENT.homePlans.compareLink.label });
    expect(link).toHaveAttribute("href", "/planes");
    fireEvent.click(link);
    expect(screen.getByTestId("where")).toHaveTextContent("/planes");
    // Solo es navegación: no guarda ninguna intención de paquete.
    expect(readPackageIntent()).toBeNull();
  });
});

describe("/planes: la tabla pintada", () => {
  const table = () => screen.getByRole("table");
  const rowOf = (label: string) => {
    const header = within(table()).getByRole("rowheader", { name: label });
    return header.closest("tr") as HTMLElement;
  };
  /** La celda de un plan en una fila: la columna sigue el orden de SITE_PLANS. */
  const cellOf = (label: string, planId: string) =>
    within(rowOf(label)).getAllByRole("cell")[SITE_PLANS.findIndex((plan) => plan.id === planId)] as HTMLElement;

  it("tiene una cabecera de fila por característica y una de columna por plan (más la de «Incluye»)", () => {
    renderAt(<Planes />);
    expect(within(table()).getAllByRole("columnheader")).toHaveLength(SITE_PLANS.length + 1);
    expect(within(table()).getAllByRole("rowheader")).toHaveLength(PLAN_COMPARISON.length);
    for (const plan of SITE_PLANS) {
      expect(within(table()).getByRole("columnheader", { name: shortPlanName(plan.name) })).toHaveAttribute("scope", "col");
    }
  });

  it("«Páginas»: «Hasta 8» en el Intermedio y «1 (6 secciones)» en los otros dos", () => {
    renderAt(<Planes />);
    expect(rowOf("Páginas")).toBeInTheDocument();
    expect(cellOf("Páginas", "intermedio")).toHaveTextContent(/^Hasta 8$/);
    expect(cellOf("Páginas", "estandar")).toHaveTextContent(/^1 \(6 secciones\)$/);
    expect(cellOf("Páginas", "combo-emprendedor")).toHaveTextContent(/^1 \(6 secciones\)$/);
  });

  it("el logo de LAU Graphic solo se marca como incluido en el Combo; blog y Google, solo en el Intermedio", () => {
    renderAt(<Planes />);
    const included = SITE_CONTENT.plansView.comparison.included;
    const notIncluded = SITE_CONTENT.plansView.comparison.notIncluded;
    expect(cellOf("Logo profesional (LAU Graphic)", "combo-emprendedor")).toHaveTextContent(included);
    expect(cellOf("Logo profesional (LAU Graphic)", "estandar")).toHaveTextContent(notIncluded);
    expect(cellOf("Logo profesional (LAU Graphic)", "intermedio")).toHaveTextContent(notIncluded);
    for (const label of ["Blog o noticias", "Posicionamiento local en Google"]) {
      expect(cellOf(label, "intermedio"), label).toHaveTextContent(included);
      expect(cellOf(label, "estandar"), label).toHaveTextContent(notIncluded);
      expect(cellOf(label, "combo-emprendedor"), label).toHaveTextContent(notIncluded);
    }
  });

  it("las rondas y los días de entrega de la tabla son los de cada plan", () => {
    renderAt(<Planes />);
    for (const plan of SITE_PLANS) {
      expect(cellOf("Rondas de revisión", plan.id)).toHaveTextContent(new RegExp(`^${plan.revisionRounds}$`));
      expect(cellOf("Entrega (días hábiles)", plan.id)).toHaveTextContent(new RegExp(`^${plan.deliveryBusinessDays}$`));
    }
  });
});
