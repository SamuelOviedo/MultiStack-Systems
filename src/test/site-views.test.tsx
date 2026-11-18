import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn() }));

// Solo se simula la red y la conversión de Ads; el formulario, sus validaciones y su honeypot son los reales.
const send = vi.hoisted(() => vi.fn());
vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: send };
});
const trackConversion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics")>();
  return { ...actual, trackContactConversion: trackConversion };
});

import ContactForm from "@/components/marketing/ContactForm";
import { SITE_CONTACT_LOOK } from "@/components/site/contactFormLook";
import { readPackageIntent } from "@/lib/packageIntent";
import { ROUTE_META } from "@/lib/routeMeta";
import { PLAN_COMPARISON, SITE_PLANS } from "@/lib/webPackages";
import Contacto from "@/pages/marketing/Contacto";
import Planes from "@/pages/marketing/Planes";
import Servicios from "@/pages/marketing/Servicios";
import { SITE_CONTENT, shortPlanName, whatsappMessageUrl } from "@/pages/marketing/siteContent";

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{`${pathname}${search}`}</output>;
}

const renderView = (view: ReactElement) =>
  render(
    <MemoryRouter>
      {view}
      <Where />
    </MemoryRouter>,
  );

const metaContent = (selector: string, attr: string) => document.head.querySelector(selector)?.getAttribute(attr);

beforeEach(() => {
  localStorage.clear();
  send.mockReset();
  trackConversion.mockReset();
  document.title = "";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe.each([
  ["/planes", () => <Planes />, SITE_CONTENT.plansView.title],
  ["/servicios", () => <Servicios />, SITE_CONTENT.servicesView.title],
  ["/contacto", () => <Contacto />, SITE_CONTENT.contactView.title],
] as const)("vista %s", (path, view, heading) => {
  it("tiene un solo H1, y aplica sus metas", () => {
    renderView(view());
    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveAccessibleName(heading);

    const meta = ROUTE_META[path];
    expect(document.title).toBe(meta.title);
    expect(metaContent('meta[name="description"]', "content")).toBe(meta.description);
    expect(metaContent('link[rel="canonical"]', "href")).toBe(meta.canonical);
    expect(metaContent('meta[property="og:title"]', "content")).toBe(meta.ogTitle);
  });

  it("comparte la cabecera y el pie del sitio, con un solo <main>", () => {
    renderView(view());
    expect(screen.getAllByRole("main")).toHaveLength(1);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute(
      "href",
      "/politica-de-privacidad",
    );
  });
});

describe("/planes", () => {
  it("cada tarjeta lleva a /solicitudes?paquete=<id> y guarda la intención del plan", () => {
    renderView(<Planes />);
    expect(readPackageIntent()).toBeNull();
    for (const plan of SITE_PLANS) {
      const link = screen.getByRole("link", { name: SITE_CONTENT.planCard.requestLabel(plan.name) });
      expect(link).toHaveAttribute("href", `/solicitudes?paquete=${plan.id}`);
    }
    const intermedio = SITE_PLANS.find((plan) => plan.id === "intermedio")!;
    fireEvent.click(screen.getByRole("link", { name: SITE_CONTENT.planCard.requestLabel(intermedio.name) }));
    expect(screen.getByTestId("where")).toHaveTextContent("/solicitudes?paquete=intermedio");
    expect(readPackageIntent()).toBe("intermedio");
  });

  describe("tabla «Comparación completa»", () => {
    const comparison = SITE_CONTENT.plansView.comparison;
    const table = () => screen.getByRole("table");

    it("tiene una cabecera de columna por plan y una de fila por característica", () => {
      renderView(<Planes />);
      const columns = within(table()).getAllByRole("columnheader");
      expect(columns.map((th) => th.textContent)).toEqual([
        comparison.featureHeader,
        ...SITE_PLANS.map((plan) => shortPlanName(plan.name)),
      ]);
      for (const th of columns) expect(th).toHaveAttribute("scope", "col");

      const rowHeaders = within(table()).getAllByRole("rowheader");
      expect(rowHeaders.map((th) => th.textContent)).toEqual(PLAN_COMPARISON.map((row) => row.label));
      for (const th of rowHeaders) expect(th).toHaveAttribute("scope", "row");
    });

    it("dice «Incluido» o «No incluido» con texto, y los iconos son decorativos", () => {
      renderView(<Planes />);
      PLAN_COMPARISON.forEach((row, index) => {
        // Fila 0 = cabecera de columnas; los datos empiezan en 1.
        const cells = within(within(table()).getAllByRole("row")[index + 1]!).getAllByRole("cell");
        expect(cells).toHaveLength(SITE_PLANS.length);
        SITE_PLANS.forEach((plan, column) => {
          const value = row.values[plan.id];
          const expected = value === true ? comparison.included : value === false ? comparison.notIncluded : value;
          expect(cells[column]!.textContent).toBe(expected);
          if (typeof value === "boolean") {
            expect(cells[column]!.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
          }
        });
      });
    });

    it("se desplaza dentro de su contenedor (región con nombre y enfocable), no en la página", () => {
      renderView(<Planes />);
      const region = screen.getByRole("region", { name: comparison.title });
      expect(region).toHaveAttribute("tabindex", "0");
      expect(region).toContainElement(table());
      // Las clases se arman en ejecución: Tailwind escanea src/ y un literal con forma de clase añadiría CSS muerto.
      const scrollX = ["overflow", "x", "auto"].join("-");
      expect(region.className.split(" ")).toContain(scrollX);
      // Sin un ancestro posicionado dentro de la región, el texto «sr-only» (absoluto) no queda recortado por su overflow y
      // alarga la página a lo ancho (se vio a 390 px: scrollWidth 573). Lo mide la comparación en navegador.
      expect(region.className.split(" ")).toContain(["re", "lative"].join(""));
      expect(table().className).toMatch(/min-w-\[\d+px\]/);
    });
  });
});

describe("/servicios", () => {
  const items = SITE_CONTENT.servicesView.items;

  it("muestra los cuatro servicios, cada uno con sus cuatro elementos", () => {
    renderView(<Servicios />);
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(screen.getByRole("heading", { level: 2, name: item.title })).toBeInTheDocument();
      expect(item.items).toHaveLength(4);
      for (const text of item.items) expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("escribe TechOn con su grafía del producto", () => {
    renderView(<Servicios />);
    expect(screen.getByRole("heading", { level: 2, name: /TechOn/ })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Techon/);
  });

  it("«Consultar» abre WhatsApp con el mensaje del servicio en pestaña nueva y lo avisa", () => {
    renderView(<Servicios />);
    for (const item of items) {
      const link = screen.getByRole("link", { name: `Consultar ${item.title} (se abre en una pestaña nueva)` });
      expect(link).toHaveTextContent("Consultar");
      expect(link).toHaveAttribute(
        "href",
        whatsappMessageUrl(`Hola, MultiStack. Quiero información sobre ${item.title}.`),
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toMatch(/noopener/);
      expect(link.getAttribute("rel")).toMatch(/noreferrer/);
    }
  });
});

describe("/contacto", () => {
  const view = SITE_CONTENT.contactView;
  const fill = (label: RegExp | string, value: string) =>
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const submit = () => fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

  it("trae el encabezado de la referencia y los otros canales", () => {
    renderView(<Contacto />);
    const main = within(screen.getByRole("main"));
    expect(main.getByText(view.eyebrow)).toBeInTheDocument(); // el pie repite «// contacto» como rótulo de columna
    expect(main.getByText(view.intro)).toBeInTheDocument();
    const channels = screen.getByRole("list", { name: view.alternativesLabel });

    const whatsapp = within(channels).getByRole("link", { name: view.whatsapp.ariaLabel });
    expect(whatsapp).toHaveAttribute("href", view.whatsapp.href);
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp.getAttribute("rel")).toMatch(/noopener/);

    const phone = within(channels).getByRole("link", { name: view.phone.label });
    expect(phone).toHaveAttribute("href", view.phone.href);
    expect(phone.getAttribute("href")).toMatch(/^tel:/);
    expect(phone).not.toHaveAttribute("target");
  });

  it("el formulario valida antes de enviar y lleva el foco al primer campo con error", () => {
    renderView(<Contacto />);
    submit();
    expect(send).not.toHaveBeenCalled();
    const name = screen.getByLabelText("Nombre completo");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveFocus();
    expect(document.getElementById(name.getAttribute("aria-describedby")!)).toHaveTextContent("Escribe tu nombre completo.");
  });

  it("envía por la Edge Function (simulada), registra la conversión y confirma", async () => {
    send.mockResolvedValue(undefined);
    renderView(<Contacto />);
    fill("Nombre completo", "Visitante PRUEBA");
    fill(/Número de teléfono/, "+504 0000-0001");
    fill("Mensaje", "Mensaje de PRUEBA: quiero cotizar una pagina");
    submit();

    // (el <output> de Where también es un «status»: se busca por su texto)
    const confirmation = await screen.findByText("¡Mensaje enviado! Te responderemos a la brevedad.");
    expect(confirmation).toHaveAttribute("role", "status");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Visitante PRUEBA",
        phone: "+504 0000-0001",
        message: "Mensaje de PRUEBA: quiero cotizar una pagina",
      }),
    );
    expect(trackConversion).toHaveBeenCalledTimes(1);
  });

  it("un error del envío se avisa y no registra la conversión", async () => {
    send.mockRejectedValue(new Error("red"));
    renderView(<Contacto />);
    fill("Nombre completo", "Visitante PRUEBA");
    fill(/Correo electrónico/, "visitante.prueba@example.test");
    fill("Mensaje", "Mensaje de PRUEBA: quiero cotizar una pagina");
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos enviar tu mensaje. Inténtalo de nuevo.");
    expect(trackConversion).not.toHaveBeenCalled();
  });

  it("conserva el honeypot: un campo lleno no se envía", async () => {
    renderView(<Contacto />);
    fill("Nombre completo", "Visitante PRUEBA");
    fill(/Número de teléfono/, "+504 0000-0001");
    fill("Mensaje", "Mensaje de PRUEBA: quiero cotizar una pagina");
    const honeypot = document.querySelector<HTMLInputElement>('input[name="ms_hp"]')!;
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honeypot.tabIndex).toBe(-1);
    fireEvent.change(honeypot, { target: { value: "https://spam.example.test" } });
    submit();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await waitFor(() => expect(honeypot.value).toBe(""));
    expect(send).not.toHaveBeenCalled();
  });
});

describe("ContactForm · aspecto", () => {
  it("por omisión (la de /paginas-web) sigue con estilo en línea y la clase de siempre", () => {
    const { container } = render(<ContactForm idPrefix="pw" />);
    const form = container.querySelector("form")!;
    expect(form.className).toBe("ms-contact-form");
    expect(form.getAttribute("style")).toContain("flex-direction: column");
    expect(form.querySelector(".ms-contact-pair")).not.toBeNull();
    expect(screen.getByLabelText("Nombre completo").getAttribute("style")).toContain("var(--input-bg)");
    expect(screen.getByRole("button", { name: "Enviar mensaje" }).getAttribute("style")).toContain("var(--primary)");
  });

  it("el aspecto del sitio no usa los tokens MS (no existen en .ms-site): clases del sitio y ningún estilo en línea", () => {
    const { container } = render(<ContactForm idPrefix="site" look={SITE_CONTACT_LOOK} />);
    const form = container.querySelector("form")!;
    expect(form.className).not.toContain("ms-contact-form");
    expect(form.hasAttribute("style")).toBe(false);
    for (const control of container.querySelectorAll("input:not([name=ms_hp]), textarea, button, label:not([for$=-hp])")) {
      expect(control.hasAttribute("style"), control.outerHTML).toBe(false);
    }
    expect(container.innerHTML).not.toMatch(/var\(--(?:text|input-bg|primary|muted|danger|success|btn-primary-text)\)/);
  });
});
