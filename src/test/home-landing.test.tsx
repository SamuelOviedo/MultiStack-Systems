import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// La home real (Navbar y Footer incluidos) con el backend simulado: la sesión es anónima y nunca se envía nada.
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, userType: null, loading: false, signOut: vi.fn() }),
}));
vi.mock("@/lib/tickets", () => ({ getOpenTicketsCount: vi.fn().mockResolvedValue(0) }));
vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: vi.fn() };
});
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackContactConversion: vi.fn(),
}));

// El contenido se puede cambiar por otro construido con compromisos y precios distintos: los números deben llegar a
// la pantalla desde COMMITMENTS y PACKAGES, no estar escritos en los componentes. Ninguna cifra distinta repite una real.
const contentSwitch = vi.hoisted(() => ({
  distinct: false,
  commitments: {
    maxSections: 9,
    revisionRounds: 4,
    deliveryBusinessDays: 15,
    responseBusinessHours: 48,
    domainHostingMonths: 7,
  },
  prices: { estandar: 5100, "combo-emprendedor": 8800 } as Record<string, number>,
}));
vi.mock("@/pages/marketing/homeContent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/pages/marketing/homeContent")>();
  const { PACKAGES } = await import("@/lib/webPackages");
  const distinctPackages = PACKAGES.map((pkg) => ({ ...pkg, priceLempiras: contentSwitch.prices[pkg.id] }));
  const distinct = actual.buildHomeContent(contentSwitch.commitments, distinctPackages);
  return {
    ...actual,
    get HOME_CONTENT() {
      return contentSwitch.distinct ? distinct : actual.HOME_CONTENT;
    },
  };
});

import { CONTACT_MESSAGE_ID, packageCardId } from "@/components/marketing/paginas-web/ids";
import { PACKAGE_INTENT_KEY, readPackageIntent } from "@/lib/packageIntent";
import { PACKAGES } from "@/lib/webPackages";
import Index from "@/pages/marketing/Index";
import {
  HOME_CONTENT,
  HOME_SECTION_IDS,
  buildHomeContent,
} from "@/pages/marketing/homeContent";
import { COMMITMENTS } from "@/pages/marketing/paginasWebContent";

// ---------------------------------------------------------------- helpers

type IOCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let observers: { callback: IOCallback; targets: Element[] }[] = [];

class FakeIntersectionObserver {
  private readonly entry: { callback: IOCallback; targets: Element[] };
  constructor(callback: IOCallback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }
  observe(target: Element) {
    this.entry.targets.push(target);
  }
  unobserve(target: Element) {
    this.entry.targets = this.entry.targets.filter((t) => t !== target);
  }
  disconnect() {
    this.entry.targets = [];
  }
  takeRecords() {
    return [];
  }
}

function stubMotion(reduced: boolean): void {
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/** Deja ver dónde está el router: ruta, query, hash y cómo llegó (PUSH o REPLACE). */
const Probe = () => {
  const { pathname, search, hash } = useLocation();
  const type = useNavigationType();
  return <output data-testid="probe">{JSON.stringify({ pathname, search, hash, type })}</output>;
};
const where = (): { pathname: string; search: string; hash: string; type: string } =>
  JSON.parse(screen.getByTestId("probe").textContent!);

const renderHome = (entry = "/") =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Index />
      <Probe />
    </MemoryRouter>,
  );

const main = (): HTMLElement => document.querySelector("main")!;
const sections = (): HTMLElement[] => Array.from(main().children) as HTMLElement[];
const root = (): HTMLElement => document.querySelector(".ms-home")!;
const revealTargets = (): Element[] => observers.flatMap((o) => o.targets).filter((t) => t.hasAttribute("data-reveal"));

/** Texto que ve una persona: sin lo que está oculto a lectores de pantalla ni el texto solo para ellos duplicado. */
const bodyText = (): string => document.body.textContent ?? "";

beforeEach(() => {
  observers = [];
  localStorage.clear();
  stubMotion(false);
  window.scrollTo = (() => {}) as typeof window.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  contentSwitch.distinct = false;
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ---------------------------------------------------------------- estructura

describe("home · estructura", () => {
  it("las secciones salen en el orden aprobado y con las anclas estables", () => {
    renderHome();
    expect(sections().map((s) => s.id)).toEqual([
      HOME_SECTION_IDS.hero,
      HOME_SECTION_IDS.combo,
      HOME_SECTION_IDS.plans,
      HOME_SECTION_IDS.why,
      HOME_SECTION_IDS.process,
      HOME_SECTION_IDS.services,
      HOME_SECTION_IDS.faq,
      HOME_SECTION_IDS.finalCta,
      HOME_SECTION_IDS.contact,
    ]);
    expect(sections().map((s) => s.id)).toEqual([
      "inicio",
      "combo-emprendedor",
      "planes",
      "por-que-elegirnos",
      "proceso",
      "servicios",
      "preguntas",
      "solicitar",
      "contacto",
    ]);
  });

  it("cada sección es una región con nombre: aria-labelledby apunta a un encabezado que existe", () => {
    renderHome();
    for (const section of sections()) {
      expect(section.tagName, section.id).toBe("SECTION");
      const labelId = section.getAttribute("aria-labelledby");
      expect(labelId, section.id).toBeTruthy();
      const heading = document.getElementById(labelId!);
      expect(heading, section.id).not.toBeNull();
      expect(heading!.textContent, section.id).not.toBe("");
      expect(section.contains(heading), section.id).toBe(true);
    }
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
  });

  it("hay un solo h1 (el de la portada) y los encabezados no se saltan niveles", () => {
    renderHome();
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(HOME_CONTENT.hero.title);
    expect(sections()[0].contains(h1s[0])).toBe(true);

    const levels = Array.from(main().querySelectorAll("h1, h2, h3, h4")).map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i += 1) {
      expect(levels[i] - levels[i - 1], `encabezado ${i}`).toBeLessThanOrEqual(1);
    }
    // Cada sección abre con su h2 (la portada, con el h1).
    for (const section of sections().slice(1)) {
      expect(within(section).getAllByRole("heading", { level: 2 }).length, section.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("la barra trae los enlaces de la home y el botón «Solicitar Combo»", () => {
    renderHome();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    for (const item of HOME_CONTENT.nav.items) {
      expect(within(nav).getByRole("button", { name: item.label })).toBeInTheDocument();
    }
    const cta = within(nav).getByRole("link", { name: HOME_CONTENT.nav.cta.ariaLabel! });
    expect(cta).toHaveTextContent(HOME_CONTENT.nav.cta.label);
    expect(cta).toHaveAttribute("href", HOME_CONTENT.nav.cta.href);
    // Los destinos de la barra existen en la página.
    for (const item of HOME_CONTENT.nav.items) {
      expect(document.getElementById(item.href.replace(/^#/, "")), item.href).not.toBeNull();
    }
  });

  it("cada tarjeta de plan lleva su id estable y la etiqueta «Recomendado» solo está en el Combo", () => {
    renderHome();
    const plans = document.getElementById(HOME_SECTION_IDS.plans)!;
    for (const pkg of PACKAGES) {
      const card = plans.querySelector(`#${packageCardId(pkg.id)}`);
      expect(card, pkg.id).not.toBeNull();
      expect(card!.getAttribute("data-package")).toBe(pkg.id);
    }
    const combo = plans.querySelector(`#${packageCardId("combo-emprendedor")}`)!;
    const standard = plans.querySelector(`#${packageCardId("estandar")}`)!;
    expect(within(combo as HTMLElement).getByText(HOME_CONTENT.plans.recommendedLabel)).toBeInTheDocument();
    expect(within(standard as HTMLElement).queryByText(HOME_CONTENT.plans.recommendedLabel)).toBeNull();
    // El Combo va primero.
    expect(Array.from(plans.querySelectorAll("article")).map((a) => a.getAttribute("data-package"))).toEqual([
      "combo-emprendedor",
      "estandar",
    ]);
    expect(within(plans).getByRole("link", { name: HOME_CONTENT.plans.seeAllLink.label })).toHaveAttribute(
      "href",
      "/paginas-web",
    );
  });
});

// ---------------------------------------------------------------- CTA

describe("home · los CTA guardan la intención de paquete", () => {
  const linksNamed = (name: string): HTMLElement[] => screen.getAllByRole("link", { name });

  it("«Solicitar Combo Emprendedor» (portada, Combo, tarjeta y cierre) apunta a /solicitudes?paquete=combo-emprendedor y la guarda", () => {
    renderHome();
    const links = linksNamed(`Solicitar ${PACKAGES[1].name}`);
    // portada, sección Combo, tarjeta del plan, cierre y, en la barra, el botón corto con su nombre accesible completo.
    expect(links.length).toBeGreaterThanOrEqual(4);
    for (const link of links) {
      localStorage.clear();
      expect(link, link.textContent ?? "").toHaveAttribute("href", "/solicitudes?paquete=combo-emprendedor");
      fireEvent.click(link);
      expect(readPackageIntent(), link.textContent ?? "").toBe("combo-emprendedor");
    }
  });

  it("«Solicitar Plan Estándar» (tarjeta y cierre) apunta a /solicitudes?paquete=estandar y la guarda", () => {
    renderHome();
    const links = linksNamed("Solicitar Plan Estándar");
    expect(links).toHaveLength(2);
    for (const link of links) {
      localStorage.clear();
      expect(link).toHaveAttribute("href", "/solicitudes?paquete=estandar");
      fireEvent.click(link);
      expect(readPackageIntent()).toBe("estandar");
    }
  });

  it("el clic del medio también guarda la intención, y el otro botón no guarda nada", () => {
    renderHome();
    const [first] = linksNamed(`Solicitar ${PACKAGES[1].name}`);
    fireEvent(first, new MouseEvent("auxclick", { bubbles: true, button: 1 }));
    expect(JSON.parse(localStorage.getItem(PACKAGE_INTENT_KEY)!).id).toBe("combo-emprendedor");

    localStorage.clear();
    fireEvent(first, new MouseEvent("auxclick", { bubbles: true, button: 2 }));
    expect(localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it("«Ver planes» y «Ver el Plan Estándar» son anclas a secciones y tarjetas que existen", () => {
    renderHome();
    expect(screen.getByRole("link", { name: HOME_CONTENT.hero.secondaryCta.label })).toHaveAttribute(
      "href",
      `#${HOME_SECTION_IDS.plans}`,
    );
    const standardLink = screen.getByRole("link", { name: /Ver el Plan Estándar/ });
    const target = standardLink.getAttribute("href")!;
    expect(target).toBe(`#${packageCardId("estandar")}`);
    expect(document.getElementById(target.slice(1))).not.toBeNull();
  });
});

// ---------------------------------------------------------------- cifras

describe("home · los precios y los números salen de los datos", () => {
  it("con precios y compromisos distintos, la pantalla muestra los nuevos y ninguno de los reales", () => {
    contentSwitch.distinct = true;
    renderHome();
    const text = bodyText();
    expect(text).toContain("L 5,100");
    expect(text).toContain("L 8,800");
    expect(text).toContain("Desde L 5,100");
    for (const real of ["3,500", "3,950", "3500", "3950"]) expect(text, real).not.toContain(real);
    // Lectores de pantalla: «5100 lempiras» (sin la «L» suelta ni la coma).
    expect(text).toContain("5100 lempiras");
    expect(text).toContain("8800 lempiras");
    // Compromisos: entrega, hosting, revisiones, respuesta y secciones.
    expect(text).toContain("15 días hábiles");
    expect(text).toContain("7 meses");
    expect(text).toContain("4 rondas");
    expect(text).toContain("48 horas hábiles");
    expect(text).toContain("hasta 9 secciones");
    for (const real of ["12 meses", "10 días", "24 horas", "6 secciones", "2 rondas"]) {
      expect(text, real).not.toContain(real);
    }
  });

  it("el contenido construido con otros valores no conserva ninguna cifra de los reales", () => {
    const distinct = buildHomeContent(
      contentSwitch.commitments,
      PACKAGES.map((pkg) => ({ ...pkg, priceLempiras: contentSwitch.prices[pkg.id] })),
    );
    // Se quitan teléfono y enlaces de WhatsApp (canales, no cifras de la oferta).
    const json = JSON.stringify(distinct).replace(/wa\.me\/\d+|tel:\+\d+|\+504 \d{4}-\d{4}/g, "");
    const found = new Set(json.match(/\d[\d,]*/g) ?? []);
    const allowed = new Set(["9", "4", "15", "48", "7", "5,100", "5100", "8,800", "8800"]);
    for (const value of found) expect(allowed.has(value), `cifra inesperada: ${value}`).toBe(true);
    // Y los reales sí estaban en el contenido real.
    const real = JSON.stringify(HOME_CONTENT);
    for (const value of ["3,500", "3,950", "12", "10", "24", "6", "2"]) expect(real, value).toContain(value);
    expect(COMMITMENTS.deliveryBusinessDays).toBe(10);
  });

  it("los componentes de la home no escriben cifras ni precios: ni «L 3,500» ni números sueltos en el texto", () => {
    const dirs = ["src/components/marketing/home", "src/pages/marketing/Index.tsx"];
    const files: string[] = [];
    for (const entry of dirs) {
      const full = path.join(process.cwd(), entry);
      if (entry.endsWith(".tsx")) files.push(full);
      else for (const f of readdirSync(full)) if (/\.(tsx|ts)$/.test(f)) files.push(path.join(full, f));
    }
    expect(files.length).toBeGreaterThanOrEqual(9);
    for (const file of files) {
      // Sin comentarios: la documentación puede nombrar un ejemplo; el código no.
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, path.basename(file)).not.toMatch(/\bL\s?\d|\d,\d{3}|\b\d{4,}\b\s*lempiras|lempiras/i);
    }
  });
});

// ---------------------------------------------------------------- servicios y contacto

describe("home · servicios bajo cotización y prellenado del formulario", () => {
  const message = (): HTMLTextAreaElement => document.getElementById(CONTACT_MESSAGE_ID) as HTMLTextAreaElement;

  it("los dos servicios llevan «Bajo cotización» y «Cuéntanos tu proyecto»", () => {
    renderHome();
    const services = document.getElementById(HOME_SECTION_IDS.services)!;
    const items = Array.from(services.querySelectorAll<HTMLElement>("[data-service]"));
    expect(items.map((i) => i.dataset.service)).toEqual(["software-a-medida", "agentes-ia"]);
    for (const item of items) {
      expect(within(item).getByText("Bajo cotización")).toBeInTheDocument();
      const cta = within(item).getByRole("link", { name: /Cuéntanos tu proyecto/ });
      expect(cta).toHaveAttribute("href", `#${HOME_SECTION_IDS.contact}`);
    }
    // Sin precios ni plazos en los servicios.
    expect(services.textContent).not.toMatch(/\bL\s?\d|lempiras|\d+\s*(días|horas|semanas|meses)/i);
  });

  it("el CTA de cada servicio prellena el mensaje con su texto y cada clic lo vuelve a aplicar", async () => {
    renderHome();
    const [software, agents] = HOME_CONTENT.services.items;
    expect(message().value).toBe("");
    const ctas = screen.getAllByRole("link", { name: /Cuéntanos tu proyecto/ });
    // Con modificador (abrir en otra pestaña) manda el enlace nativo: no se prellena ni se cancela el clic.
    expect(fireEvent.click(ctas[0], { ctrlKey: true })).toBe(true);
    expect(message().value).toBe("");

    const scroll = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
    scroll.mockClear();
    expect(fireEvent.click(ctas[0])).toBe(false); // preventDefault: el router lleva a #contacto sin quitar el foco
    await vi.waitFor(() => expect(scroll).toHaveBeenCalled());
    expect(scroll.mock.contexts.at(-1)).toBe(document.getElementById(HOME_SECTION_IDS.contact));
    expect(message().value).toBe(software.messagePrefill);
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre completo"));

    fireEvent.click(ctas[1]);
    expect(message().value).toBe(agents.messagePrefill);

    fireEvent.change(message(), { target: { value: "otra cosa" } });
    fireEvent.click(ctas[1]);
    expect(message().value).toBe(agents.messagePrefill);
  });

  it("al ir a «Contacto» desde la barra se prellena el mensaje por defecto una sola vez, sin pisar lo escrito", () => {
    renderHome();
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(message().value).toBe("");

    fireEvent.click(within(nav).getByRole("button", { name: "Contacto" }));
    expect(message().value).toBe(HOME_CONTENT.contact.messagePrefill);

    fireEvent.change(message(), { target: { value: "Mi mensaje" } });
    fireEvent.click(within(nav).getByRole("button", { name: "Contacto" }));
    expect(message().value).toBe("Mi mensaje");
  });

  it("no pisa lo que la persona ya escribió antes de usar la barra", () => {
    renderHome();
    fireEvent.change(message(), { target: { value: "Ya escribí algo" } });
    fireEvent.click(within(screen.getByRole("navigation", { name: "Principal" })).getByRole("button", { name: "Contacto" }));
    expect(message().value).toBe("Ya escribí algo");
  });

  it("el CTA de un servicio conserva la query de la URL (gclid de Ads) y reemplaza la entrada del historial", () => {
    renderHome("/?gclid=abc&utm_source=x");
    expect(where().search).toBe("?gclid=abc&utm_source=x");

    const ctas = screen.getAllByRole("link", { name: /Cuéntanos tu proyecto/ });
    fireEvent.click(ctas[0]);
    expect(where()).toMatchObject({ pathname: "/", search: "?gclid=abc&utm_source=x", hash: "#contacto", type: "REPLACE" });

    fireEvent.click(ctas[1]);
    expect(where()).toMatchObject({ search: "?gclid=abc&utm_source=x", hash: "#contacto", type: "REPLACE" });
    expect(message().value).toBe(HOME_CONTENT.services.items[1].messagePrefill);
  });

  it("cada «Cuéntanos tu proyecto» tiene un nombre accesible distinto que empieza por el texto visible", () => {
    renderHome();
    const labels = HOME_CONTENT.services.items.map((s) => s.cta.ariaLabel);
    expect(new Set(labels).size).toBe(labels.length);
    for (const service of HOME_CONTENT.services.items) {
      expect(service.cta.ariaLabel, service.id).toBeTruthy();
      expect(service.cta.ariaLabel!.startsWith(service.cta.label), service.id).toBe(true);
      expect(screen.getByRole("link", { name: service.cta.ariaLabel! })).toBeInTheDocument();
    }
  });

  it("el formulario es el de siempre: nombre, teléfono, correo, mensaje y envío", () => {
    renderHome();
    const contact = document.getElementById(HOME_SECTION_IDS.contact)!;
    for (const label of ["Nombre completo", "Mensaje"]) expect(within(contact).getByLabelText(label)).toBeInTheDocument();
    expect(within(contact).getByRole("button", { name: /Enviar mensaje/ })).toBeInTheDocument();
    // WhatsApp: pestaña nueva, con noopener noreferrer.
    const whatsapp = within(contact).getByRole("link", { name: /WhatsApp/ });
    expect(whatsapp).toHaveAttribute("target", "_blank");
    expect(whatsapp.getAttribute("rel")).toContain("noopener");
    expect(whatsapp.getAttribute("rel")).toContain("noreferrer");
  });
});

// ---------------------------------------------------------------- lo que ya no está

describe("home · sin la narrativa anterior ni lo no decidido", () => {
  const OLD_NARRATIVE = /24\/7|RAG|piloto automático|productizad|n8n|cero papel/i;
  // Misma lista que paginas-web.test.tsx: renovaciones, promociones, titularidad, impuestos, tarifas periódicas y dólares.
  const UNDECIDED =
    /renov|promoci|vigencia|aliad|titular|a tu nombre|extensi[oó]n|ISV|impuesto|al año|anual|mensual|cada año|US\$|USD/i;

  it("el texto de la página no contiene nada de la landing de IA", () => {
    renderHome();
    expect(bodyText()).not.toMatch(OLD_NARRATIVE);
    // Ni los productos del ecosistema como oferta: la columna «Productos» del pie ya no existe.
    expect(bodyText()).not.toMatch(/Licensing|Development|WhatsApp — En desarrollo|Ecosistema/);
    expect(screen.queryByText("Productos")).toBeNull();
  });

  it.each([
    ["reales", () => HOME_CONTENT],
    [
      "distintos",
      () =>
        buildHomeContent(
          contentSwitch.commitments,
          PACKAGES.map((pkg) => ({ ...pkg, priceLempiras: contentSwitch.prices[pkg.id] })),
        ),
    ],
  ])("con valores %s, el contenido no afirma nada que el propietario no haya decidido", (_name, build) => {
    const content = build();
    expect(JSON.stringify(content)).not.toMatch(UNDECIDED);
    expect(JSON.stringify(content)).not.toMatch(OLD_NARRATIVE);
  });

  it("la página renderizada tampoco menciona lo no decidido", () => {
    renderHome();
    expect(main().textContent).not.toMatch(UNDECIDED);
  });

  it("no hay imágenes de newMedia ni capturas: la maqueta es HTML y CSS", () => {
    renderHome();
    for (const img of Array.from(document.querySelectorAll("img"))) {
      expect(img.getAttribute("src") ?? "", "img").not.toMatch(/newMedia/i);
      // Solo el logo oficial de la marca puede ser una imagen.
      expect(img.getAttribute("src") ?? "", "img").toMatch(/brand|logo|isotipo|wordmark|data:/i);
    }
    expect(main().querySelectorAll("img, video, canvas, picture, iframe, object")).toHaveLength(0);
    const sources = readdirSync(path.join(process.cwd(), "src/components/marketing/home")).map((f) =>
      readFileSync(path.join(process.cwd(), "src/components/marketing/home", f), "utf8"),
    );
    for (const source of sources) expect(source).not.toMatch(/newMedia|framer-motion|three|webgl/i);
    expect(existsSync(path.join(process.cwd(), "src/components/marketing/home"))).toBe(true);
  });

  it("«LAU Graphic × MultiStack Systems» va en texto, con el marcado de cada parte listo para un logo", () => {
    renderHome();
    const combo = document.getElementById(HOME_SECTION_IDS.combo)!;
    expect(combo.textContent).toContain("LAU Graphic × MultiStack Systems");
    expect(combo.querySelector("[data-partner='lau-graphic']")).not.toBeNull();
    expect(combo.querySelector("[data-partner='multistack-systems']")).not.toBeNull();
    expect(combo.querySelectorAll("img")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- ilustración

describe("home · proceso", () => {
  it("el paso 1 es «Envías tu solicitud», sin nombrar paquetes ni plazos", () => {
    const [first, ...rest] = HOME_CONTENT.process.steps;
    expect(first).toEqual({
      title: "Envías tu solicitud",
      text: "Es una solicitud, no un pago ni un contrato. Te contactamos para confirmar el paquete y los siguientes pasos.",
    });
    expect(JSON.stringify(first)).not.toMatch(/Combo|Est[aá]ndar|\d/);
    // Los demás pasos son los aprobados de /paginas-web, sin cambios.
    expect(rest.length).toBeGreaterThanOrEqual(3);
    renderHome();
    const steps = within(document.getElementById(HOME_SECTION_IDS.process)!).getAllByRole("heading", { level: 3 });
    expect(steps[0]).toHaveTextContent("Envías tu solicitud");
  });
});

describe("home · pie", () => {
  const footerLink = (): HTMLElement => within(document.querySelector("footer")!).getByRole("button", { name: "Planes" });

  it("los enlaces del pie se desplazan suave, o de golpe con prefers-reduced-motion: reduce", () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    renderHome();
    fireEvent.click(footerLink());
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "smooth" }));
    cleanup();

    stubMotion(true);
    scrollTo.mockClear();
    renderHome();
    fireEvent.click(footerLink());
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: "auto" }));
  });
});

describe("home · ilustración del hero", () => {
  it("es una ilustración con descripción, con las tarjetas flotantes ocultas a lectores de pantalla", () => {
    renderHome();
    const illustration = screen.getByRole("img", { name: HOME_CONTENT.hero.mockAlt });
    expect(illustration.querySelectorAll("img")).toHaveLength(0);
    const scene = illustration.querySelector(".ms-home-scene")!;
    expect(scene).toHaveAttribute("aria-hidden", "true");
    const cards = Array.from(scene.querySelectorAll(".ms-home-float"));
    expect(cards.map((c) => c.textContent)).toEqual([...HOME_CONTENT.hero.floatingCards]);
  });
});

// ---------------------------------------------------------------- movimiento

describe("home · movimiento", () => {
  it("con prefers-reduced-motion: reduce nada se arma ni se oculta: todo el contenido es visible", () => {
    stubMotion(true);
    renderHome();
    expect(root()).not.toHaveAttribute("data-reveal-ready");
    // (La barra tiene su propio observador del scroll; ninguno observa elementos de aparición.)
    expect(revealTargets()).toHaveLength(0);
    const hidden = Array.from(document.querySelectorAll("[data-reveal]"));
    expect(hidden.length).toBeGreaterThan(5);
    for (const el of hidden) {
      expect(el.classList.contains("is-in")).toBe(false);
      // Sin el atributo del contenedor, el CSS no tiene ninguna regla que oculte estos elementos.
      expect(el.closest("[data-reveal-ready]")).toBeNull();
    }
    expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  });

  it("sin movimiento reducido las secciones se arman y aparecen al entrar en pantalla", () => {
    // jsdom no hace layout: lo que está en pantalla es lo que cabe en la altura de la ventana.
    const rect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const top = this.hasAttribute("data-reveal") ? 5000 : 0;
      return { top, bottom: top + 10, left: 0, right: 10, width: 10, height: 10, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    renderHome();
    rect.mockRestore();
    expect(root()).toHaveAttribute("data-reveal-ready");
    const first = observers.find((o) => o.targets.some((t) => t.hasAttribute("data-reveal")))!;
    expect(first.targets.length).toBeGreaterThan(0);

    const target = first.targets[0] as HTMLElement;
    expect(target.classList.contains("is-in")).toBe(false);
    act(() => first.callback([{ target, isIntersecting: false }]));
    expect(target.classList.contains("is-in")).toBe(false);
    act(() => first.callback([{ target, isIntersecting: true }]));
    expect(target.classList.contains("is-in")).toBe(true);
    expect(first.targets).not.toContain(target);
  });

  it("sin IntersectionObserver nada se oculta (el contenido no depende de la animación)", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    renderHome();
    expect(root()).not.toHaveAttribute("data-reveal-ready");
  });

  it("el CSS oculta solo bajo [data-reveal-ready], anima solo opacity y transform y apaga todo con movimiento reducido", () => {
    const css = readFileSync(path.join(process.cwd(), "src/index.css"), "utf8").replace(/\r\n/g, "\n");
    const start = css.indexOf("Home web-first");
    expect(start).toBeGreaterThan(0);
    const home = css.slice(start, css.indexOf("Panel de administración", start));

    // Cada regla que pone opacity: 0 está bajo [data-reveal-ready] (o dentro del bloque de movimiento reducido).
    const hiding = home.match(/[^{}]+\{[^{}]*opacity:\s*0\s*;[^{}]*\}/g) ?? [];
    expect(hiding.length).toBeGreaterThan(0);
    for (const rule of hiding) {
      const selector = rule.split("{")[0];
      if (/^\s*(from|to|\d+%)/.test(selector)) continue; // fotogramas clave
      expect(selector, rule).toContain("[data-reveal-ready]");
    }

    // Los fotogramas clave solo tocan opacity y transform.
    for (const frames of home.match(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})+\s*\}/g) ?? []) {
      const props = Array.from(frames.matchAll(/(?:^|[;{\s])([a-z-]+)\s*:/g)).map((m) => m[1]);
      for (const prop of props) expect(["opacity", "transform"], `${prop} en ${frames.slice(0, 30)}`).toContain(prop);
    }

    const reduced = home.slice(home.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    for (const selector of [".ms-home-rise", ".ms-home-float", "[data-reveal].is-in", ".ms-home-scene"]) {
      expect(reduced, selector).toContain(selector);
    }
    expect(reduced).toMatch(/animation:\s*none/);
    expect(reduced).toMatch(/\[data-reveal\]:not\(\.is-in\)\s*\{\s*opacity:\s*1/);
  });

  it("la home no importa framer-motion ni nada de las escenas cinemáticas", () => {
    const index = readFileSync(path.join(process.cwd(), "src/pages/marketing/Index.tsx"), "utf8");
    expect(index).not.toMatch(/framer-motion|CinematicBackground|CinematicChapters|AiChat|HeroSection|AiServicesCatalog|AgentValue|ZeroPaper|EcosystemConnect|TechStack/i);
    for (const hook of ["useRevealOnScroll.ts", "usePointerTilt.ts"]) {
      expect(readFileSync(path.join(process.cwd(), "src/hooks", hook), "utf8")).not.toMatch(/framer-motion/);
    }
  });
});
