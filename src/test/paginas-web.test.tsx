import { StrictMode } from "react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import postcss, { type Rule } from "postcss";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Barra y pie fuera: traen auth, tickets, logos y temas que esta página no necesita para sus pruebas.
vi.mock("@/components/common/Navbar", async () => {
  const { createElement } = await import("react");
  return { default: () => createElement("nav", { "data-testid": "navbar-stub" }) };
});
vi.mock("@/components/common/Footer", async () => {
  const { createElement } = await import("react");
  return { default: () => createElement("footer", { "data-testid": "footer-stub" }) };
});
// Nunca se llama al backend: se conserva la validación real y se sustituye solo el envío.
vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: vi.fn() };
});
// La medición de Google Ads tiene sus propias pruebas; aquí no debe tocar window.gtag ni el DOM.
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackContactConversion: vi.fn(),
}));

// El contenido de la página se puede cambiar por otro construido con compromisos y precios distintos para
// comprobar que los números llegan a la pantalla desde COMMITMENTS y PACKAGES y no están escritos en los
// componentes. Ninguna cifra distinta (ni los dígitos de un precio como «5,100») repite una de las reales.
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
const DISTINCT_COMMITMENTS = contentSwitch.commitments;
vi.mock("@/pages/marketing/paginasWebContent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/pages/marketing/paginasWebContent")>();
  const distinctPackages = actual.PACKAGES.map((pkg) => ({ ...pkg, priceLempiras: contentSwitch.prices[pkg.id] }));
  const distinct = actual.buildPaginasWebContent(contentSwitch.commitments, distinctPackages);
  return {
    ...actual,
    get PAGINAS_WEB_CONTENT() {
      return contentSwitch.distinct ? distinct : actual.PAGINAS_WEB_CONTENT;
    },
  };
});

import { sendContactMessage } from "@/lib/contact";
import { withRouteHead } from "@/lib/routeHead";
import { HOME_META, OG_IMAGES, PAGINAS_WEB_OG, ROUTE_META, SITE_ORIGIN, type RouteMeta } from "@/lib/routeMeta";
import PoliticaDePrivacidad from "@/pages/legal/PoliticaDePrivacidad";
import PaginasWeb from "@/pages/marketing/PaginasWeb";
import {
  CHANNELS,
  COMMITMENTS,
  PACKAGES,
  PAGINAS_WEB_CONTENT,
  SECTION_IDS,
  buildPaginasWebContent,
  type Commitments,
  type PaginasWebPackage,
} from "@/pages/marketing/paginasWebContent";

/** Los mismos paquetes con otros precios: para comprobar que los precios también salen de los datos. */
const DISTINCT_PACKAGES = PACKAGES.map((pkg) => ({ ...pkg, priceLempiras: contentSwitch.prices[pkg.id] }));

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const INDEX_LF = readFileSync(path.join(ROOT, "index.html"), "utf8").replace(/\r\n/g, "\n");

const SECTION_ORDER = [
  "inicio",
  "que-incluye",
  "precio",
  "proceso",
  "ingenieria",
  "honduras",
  "atencion",
  "como-trabajamos",
  "preguntas",
  "contacto",
];
const PREFILL = "Hola, quiero cotizar una página web.";
const MESSAGE_ID = "ms-contact-pw-message";
const FIELD_IDS = ["name", "phone", "email", "message"].map((f) => `ms-contact-pw-${f}`);

function renderPage({ path: url = "/paginas-web", strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[url]}>
      <PaginasWeb />
    </MemoryRouter>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

const message = () => document.getElementById(MESSAGE_ID) as HTMLTextAreaElement;
const section = (id: string) => document.getElementById(id) as HTMLElement;
const typeMessage = (value: string) => fireEvent.change(message(), { target: { value } });

/** Los CTA que llevan a #contacto y prellenan: [sección, nombre accesible del enlace]. */
const CTAS: ReadonlyArray<readonly [string, string]> = [
  ["inicio", "Cotiza tu página web"],
  ["precio", "Cotiza tu página web"],
  ["proceso", "Cotiza tu página web"],
  ["atencion", "Llena el formulario"],
];
const clickCta = ([id, name]: readonly [string, string]): boolean =>
  fireEvent.click(within(section(id)).getByRole("link", { name }));

/** Texto que ve una persona: sin lo decorativo (aria-hidden: números de paso, «// », iconos). */
function visibleText(root: Element): string {
  const copy = root.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

const numberTokens = (text: string): Set<string> => new Set(text.match(/\d+/g) ?? []);
/** Los dígitos de los datos de contacto (teléfono y WhatsApp), que no son compromisos. */
const CHANNEL_DIGITS = numberTokens(`${CHANNELS.phoneDisplay} ${CHANNELS.phoneHref} ${CHANNELS.whatsappUrl}`);
const withoutChannelDigits = (tokens: Set<string>): string[] =>
  [...tokens].filter((t) => !CHANNEL_DIGITS.has(t)).sort();

/** Cuadro de requestAnimationFrame con control manual: el salto por hash ocurre en el fotograma siguiente. */
class Frames {
  private next = 1;
  private pending = new Map<number, FrameRequestCallback>();

  install(): void {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const id = this.next++;
      this.pending.set(id, callback);
      return id;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((id) => {
      this.pending.delete(id);
    });
  }

  get size(): number {
    return this.pending.size;
  }

  flush(): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    callbacks.forEach((callback) => callback(0));
  }
}

const scrollIntoView = vi.fn();
let frames: Frames;

beforeEach(() => {
  vi.mocked(sendContactMessage).mockReset();
  scrollIntoView.mockReset();
  // jsdom no implementa scrollIntoView.
  Element.prototype.scrollIntoView = scrollIntoView;
  frames = new Frames();
  frames.install();
  contentSwitch.distinct = false;
  window.history.replaceState(null, "", "/");
  document.head.innerHTML = "";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  contentSwitch.distinct = false;
  window.history.replaceState(null, "", "/");
  document.head.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

describe("/paginas-web · estructura", () => {
  it("tiene un solo h1, «Páginas web en Honduras», y los encabezados no saltan niveles", () => {
    renderPage();

    const h1s = document.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/^Páginas web en Honduras$/);
    expect(screen.getByRole("heading", { level: 1, name: "Páginas web en Honduras" })).toBe(h1s[0]);

    const levels = Array.from(document.querySelectorAll("h1, h2, h3, h4, h5, h6")).map((h) => Number(h.tagName[1]));
    expect(levels[0]).toBe(1);
    levels.slice(1).forEach((level, i) => expect(level - levels[i], `encabezado ${i + 2}`).toBeLessThanOrEqual(1));
  });

  it("las 10 secciones llevan los ids estables, en orden de lectura, y SECTION_IDS no se ha movido", () => {
    expect(Object.values(SECTION_IDS)).toEqual(SECTION_ORDER);

    renderPage();

    const sections = Array.from(document.querySelectorAll("main > section"));
    expect(sections.map((s) => s.id)).toEqual(SECTION_ORDER);
    expect(document.querySelectorAll("main")).toHaveLength(1);
  });

  it("cada sección se nombra con un encabezado que existe dentro de ella (aria-labelledby)", () => {
    renderPage();

    for (const sec of Array.from(document.querySelectorAll("main > section"))) {
      const labelledBy = sec.getAttribute("aria-labelledby");
      expect(labelledBy, `#${sec.id} aria-labelledby`).toBeTruthy();
      const heading = document.getElementById(labelledBy!);
      expect(heading, `#${sec.id} encabezado`).not.toBeNull();
      expect(sec.contains(heading), `#${sec.id} contiene su encabezado`).toBe(true);
      expect(heading!.tagName, `#${sec.id}`).toBe(sec.id === "inicio" ? "H1" : "H2");
      expect(heading!.textContent!.trim(), `#${sec.id} texto`).not.toBe("");
    }
  });

  it("los lectores de pantalla las anuncian como 10 regiones con el nombre de su encabezado", () => {
    renderPage();

    const regions = screen.getAllByRole("region");
    expect(regions).toHaveLength(10);
    expect(screen.getByRole("region", { name: "Páginas web en Honduras" })).toBe(section("inicio"));
    expect(screen.getByRole("region", { name: "Precio claro desde el inicio" })).toBe(section("precio"));
    expect(screen.getByRole("region", { name: "Mira cómo trabajamos" })).toBe(section("como-trabajamos"));
    expect(screen.getByRole("region", { name: "Cotiza tu página web" })).toBe(section("contacto"));
  });

  it("todos los id del documento son únicos", () => {
    renderPage();

    const ids = Array.from(document.querySelectorAll("[id]")).map((el) => el.id);
    expect(ids.length).toBeGreaterThan(20);
    expect(ids.filter((id) => id === "")).toEqual([]);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it("las preguntas frecuentes son <details> nativos con su <summary> como primer hijo", () => {
    renderPage();

    const items = Array.from(section("preguntas").querySelectorAll("details"));
    expect(items.length).toBeGreaterThan(0);
    expect(items).toHaveLength(PAGINAS_WEB_CONTENT.faq.items.length);
    items.forEach((details, i) => {
      expect(details.firstElementChild?.tagName).toBe("SUMMARY");
      expect(details.firstElementChild).toHaveTextContent(PAGINAS_WEB_CONTENT.faq.items[i].question);
    });
  });

  it("todos los enlaces y botones tienen nombre accesible", () => {
    renderPage();

    const controls = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")];
    expect(controls.length).toBeGreaterThan(10);
    for (const control of controls) expect(control).toHaveAccessibleName();
  });

  it("la página es una oferta aparte: sin imágenes, sin testimonios y sin los otros productos ni la IA", () => {
    renderPage();

    expect(document.querySelectorAll("img, picture, video, canvas, iframe, object, embed, [role='img']")).toHaveLength(0);
    expect(document.querySelectorAll("blockquote, q, cite, figure, figcaption, [itemprop='review']")).toHaveLength(0);

    const text = visibleText(document.querySelector("main")!);
    expect(text.length).toBeGreaterThan(1500);
    const forbidden: ReadonlyArray<readonly [string, RegExp]> = [
      ["IA", /\bIA\b/],
      ["inteligencia artificial", /inteligencia artificial/i],
      ["automatización", /automati[zs]/i],
      ["TechOn", /techon/i],
      ["Licensing", /licensing/i],
      ["Development", /development/i],
      ["Reto", /\bReto\b/],
      ["n8n", /\bn8n\b/i],
      ["chatbot", /chatbot/i],
      ["RAG", /\bRAG\b/],
      ["testimonios, reseñas o calificaciones", /testimonio|rese[ñn]a|estrellas|calificaci[oó]n/i],
    ];
    for (const [name, pattern] of forbidden) expect(text, name).not.toMatch(pattern);
  });

  it("el contenido y los textos de las metas de la ruta tampoco mencionan IA, automatización ni otros productos", () => {
    const { title, description, ogTitle, ogDescription } = ROUTE_META["/paginas-web"];
    const json = JSON.stringify([PAGINAS_WEB_CONTENT, title, description, ogTitle, ogDescription]);
    expect(json).not.toMatch(/\bIA\b|inteligencia artificial|automati[zs]|techon|licensing|development|\bReto\b|\bn8n\b/i);
  });

  it("el texto alternativo de la imagen social de la ruta tampoco habla de IA ni de automatización", () => {
    expect(ROUTE_META["/paginas-web"].ogImageAlt).not.toMatch(/\bIA\b|inteligencia artificial|automati[zs]/i);
  });
});

// ---------------------------------------------------------------------------
// Contenido: cada título del anuncio está respaldado donde dice la matriz
// ---------------------------------------------------------------------------

describe("/paginas-web · títulos del anuncio", () => {
  beforeEach(() => renderPage());

  it("«Páginas web en Honduras» es el h1", () => {
    expect(within(section("inicio")).getByRole("heading", { level: 1 })).toHaveTextContent("Páginas web en Honduras");
  });

  it("«Cotiza tu página web» es el CTA del hero y el h2 de #contacto", () => {
    const cta = within(section("inicio")).getByRole("link", { name: "Cotiza tu página web" });
    expect(cta).toHaveAttribute("href", "#contacto");
    expect(within(section("contacto")).getByRole("heading", { level: 2 })).toHaveTextContent("Cotiza tu página web");
  });

  it("«Cotiza tu página web» también cierra el precio y el proceso, siempre hacia #contacto", () => {
    const links = screen.getAllByRole("link", { name: "Cotiza tu página web" });
    expect(links).toHaveLength(3);
    links.forEach((link) => expect(link).toHaveAttribute("href", "#contacto"));
  });

  it("«Precio claro desde el inicio» es el h2 de #precio", () => {
    expect(within(section("precio")).getByRole("heading", { level: 2 })).toHaveTextContent("Precio claro desde el inicio");
  });

  it("«Mira cómo trabajamos» es el h2 de #como-trabajamos, con sus enlaces a Instagram y Facebook", () => {
    const social = section("como-trabajamos");
    expect(within(social).getByRole("heading", { level: 2 })).toHaveTextContent("Mira cómo trabajamos");
    expect(within(social).getAllByRole("link")).toHaveLength(2);
  });

  it("«Hecho en Honduras» es el h2 de #honduras", () => {
    expect(within(section("honduras")).getByRole("heading", { level: 2 })).toHaveTextContent("Hecho en Honduras");
  });
});

// ---------------------------------------------------------------------------
// Velocidad: se cuenta como proceso (se mide con Lighthouse), nunca como promesa ni como resultado
// ---------------------------------------------------------------------------

/**
 * Palabras que prometen rapidez. La medición móvil real de la landing da Rendimiento 81-84, así que la página no
 * puede prometer velocidad: solo cuenta que la mide. (La home sí dice «Responde en segundos» en AgentValueSection;
 * eso no se prueba aquí, solo la landing.) Respecto a la lista pedida se añade «veloces» (el plural de «veloz» no
 * contiene «veloz», y «veloc» a secas atraparía el «Velocidad» aprobado) y las grafías sin tilde de rápid- y ágil.
 */
const SPEED_CLAIM = /r[aá]pid|veloz|veloces|[aá]gil|instant|inmediat|en segundos|enseguida/i;
/** Lo aprobado: el ítem de «Qué incluye» y de «Lo que incluye el precio», y el punto de ingeniería. */
const LIGHTHOUSE_ITEM = "Velocidad de carga medida con Lighthouse";
const LIGHTHOUSE_POINT = "Velocidad medida";

/** El fragmento (con contexto) donde aparece una promesa de rapidez, o null: así un fallo dice dónde está. */
function speedClaimIn(text: string): string | null {
  const hit = SPEED_CLAIM.exec(text);
  return hit ? `…${text.slice(Math.max(0, hit.index - 40), hit.index + hit[0].length + 40)}…` : null;
}

/** Todo lo que se lee o se anuncia en `root`: su texto y sus atributos aria-label, title, alt y placeholder. */
function textAndAccessibleAttributes(root: Element): string {
  const attributes = Array.from(root.querySelectorAll("[aria-label],[title],[alt],[placeholder]")).flatMap((el) =>
    ["aria-label", "title", "alt", "placeholder"].map((name) => el.getAttribute(name) ?? ""),
  );
  return [root.textContent ?? "", ...attributes].join("\n");
}

/** La lista (<ul>) que sigue al <h3> con ese texto dentro de `root`. */
function listAfterHeading(root: Element, headingText: string): Element {
  const heading = Array.from(root.querySelectorAll("h3")).find((h) => h.textContent?.trim() === headingText);
  expect(heading, `encabezado «${headingText}»`).toBeDefined();
  const list = heading!.nextElementSibling;
  expect(list?.tagName, `lista tras «${headingText}»`).toBe("UL");
  return list!;
}

describe("/paginas-web · la velocidad se cuenta como proceso, no como promesa", () => {
  it("el detector reconoce las promesas de rapidez y deja pasar lo aprobado", () => {
    for (const claim of [
      "Carga rápida",
      "Sitios rápidos",
      "una página veloz",
      "landing pages veloces",
      "carga rapida",
      "diseño agil",
      "un equipo ágil",
      "respuesta instantánea",
      "entrega inmediata",
      "Responde en segundos",
      "te contestamos enseguida",
      "CARGA RÁPIDA",
    ]) {
      expect(speedClaimIn(claim), claim).not.toBeNull();
    }
    for (const fine of [
      LIGHTHOUSE_ITEM,
      LIGHTHOUSE_POINT,
      "Medimos la velocidad de carga con Lighthouse.",
      "Entrega en 10 días hábiles",
      "Menos de 24 horas hábiles",
    ]) {
      expect(speedClaimIn(fine), fine).toBeNull();
    }
  });

  it("el texto de <main> y sus atributos accesibles no prometen rapidez", () => {
    renderPage();

    const text = textAndAccessibleAttributes(document.querySelector("main")!);

    expect(text.length).toBeGreaterThan(1500); // no pasa en vacío
    expect(speedClaimIn(text)).toBeNull();
  });

  it("PAGINAS_WEB_CONTENT no promete rapidez, ni con los compromisos reales ni con otros", () => {
    for (const content of [PAGINAS_WEB_CONTENT, buildPaginasWebContent(DISTINCT_COMMITMENTS, DISTINCT_PACKAGES)]) {
      const json = JSON.stringify(content);
      expect(json).toContain("Lighthouse"); // el texto de la velocidad sí está
      expect(speedClaimIn(json)).toBeNull();
    }
  });

  it("las cadenas de ROUTE_META['/paginas-web'] (title, description y Open Graph) no prometen rapidez", () => {
    const strings = Object.values(ROUTE_META["/paginas-web"]);

    expect(strings.length).toBeGreaterThanOrEqual(8);
    expect(speedClaimIn(strings.join("\n"))).toBeNull();
  });

  it("el rótulo «Carga rápida» ya no existe en la página ni en su contenido", () => {
    renderPage();

    expect(document.body.textContent).not.toMatch(/carga r[aá]pida/i);
    expect(JSON.stringify(PAGINAS_WEB_CONTENT)).not.toMatch(/carga r[aá]pida/i);
  });

  it("el hecho aprobado sigue en pantalla: «Velocidad de carga medida con Lighthouse» en Qué incluye y en el precio, y «Velocidad medida» en ingeniería", () => {
    renderPage();

    // Qué incluye: un término (dt) con su descripción (dd).
    const term = Array.from(section("que-incluye").querySelectorAll("dt")).find((dt) => dt.textContent?.trim() === LIGHTHOUSE_ITEM);
    expect(term, `ítem «${LIGHTHOUSE_ITEM}» en Qué incluye`).toBeDefined();
    expect(term!.nextElementSibling?.textContent).toMatch(/Lighthouse/);

    // Lo que incluye el precio: los mismos títulos.
    const included = Array.from(listAfterHeading(section("precio"), PAGINAS_WEB_CONTENT.price.includedTitle).querySelectorAll("li"));
    expect(included.map((li) => li.textContent?.trim())).toContain(LIGHTHOUSE_ITEM);

    // Ingeniería: «Velocidad medida» con la palabra Lighthouse.
    const point = within(section("ingenieria")).getByRole("heading", { level: 3, name: LIGHTHOUSE_POINT });
    expect(point.parentElement).toHaveTextContent(/Lighthouse/);
  });

  it("y el hecho aprobado está en el contenido, con la palabra Lighthouse en los tres sitios", () => {
    const { includes, price, engineering } = PAGINAS_WEB_CONTENT;

    const item = includes.items.find((i) => i.title === LIGHTHOUSE_ITEM);
    expect(item, "includes.items").toBeDefined();
    expect(item!.text).toMatch(/Lighthouse/);
    expect(price.included).toContain(LIGHTHOUSE_ITEM);
    const point = engineering.points.find((p) => p.title === LIGHTHOUSE_POINT);
    expect(point, "engineering.points").toBeDefined();
    expect(point!.text).toMatch(/Lighthouse/);
  });

  it("los conteos de ítems se conservan: 9 incluidos (los mismos 9 en el precio), 3 que no incluye y 3 puntos de ingeniería", () => {
    const { includes, price, engineering } = PAGINAS_WEB_CONTENT;
    expect(includes.items).toHaveLength(9);
    expect(price.included).toEqual(includes.items.map((i) => i.title));
    expect(price.notIncluded).toHaveLength(3);
    expect(engineering.points).toHaveLength(3);

    renderPage();

    expect(section("que-incluye").querySelectorAll("dt")).toHaveLength(9);
    expect(listAfterHeading(section("precio"), price.includedTitle).querySelectorAll("li")).toHaveLength(9);
    expect(listAfterHeading(section("precio"), price.notIncludedTitle).querySelectorAll("li")).toHaveLength(3);
    expect(section("ingenieria").querySelectorAll("li")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Números: todos salen de COMMITMENTS y de PACKAGES
// ---------------------------------------------------------------------------

describe("/paginas-web · los números salen de COMMITMENTS y PACKAGES", () => {
  /**
   * Las cifras que debe llevar el texto: los compromisos y los precios, escritos con coma («3,500» son el 3 y el
   * 500) y sin ella («3500», como los lee un lector de pantalla).
   */
  const figuresOf = (commitments: Commitments, packages: readonly PaginasWebPackage[]): string[] =>
    withoutChannelDigits(
      numberTokens(
        [
          ...Object.values(commitments),
          ...packages.flatMap((p) => [p.priceLempiras.toLocaleString("en-US"), String(p.priceLempiras)]),
        ].join(" "),
      ),
    );
  const DEFAULTS = figuresOf(COMMITMENTS, PACKAGES); // 2, 3, 6, 10, 12, 24, 500, 950, 3500, 3950
  const NEW_NUMBERS = figuresOf(DISTINCT_COMMITMENTS, DISTINCT_PACKAGES); // 100, 15, 4, 48, 5, 7, 800, 8, 9, 5100, 8800

  it("las cifras distintas no se parecen a las reales ni a los dígitos de contacto (si no, la prueba no distinguiría)", () => {
    expect(NEW_NUMBERS.filter((n) => DEFAULTS.includes(n))).toEqual([]);
    expect(NEW_NUMBERS.filter((n) => CHANNEL_DIGITS.has(n))).toEqual([]);
  });

  it("el contenido real solo usa cifras de COMMITMENTS y de PACKAGES (más los dígitos del teléfono)", () => {
    expect(withoutChannelDigits(numberTokens(JSON.stringify(buildPaginasWebContent(COMMITMENTS, PACKAGES))))).toEqual(DEFAULTS);
  });

  it("con compromisos y precios distintos aparecen los nuevos números y no sobrevive ninguno de los valores por defecto", () => {
    const content = buildPaginasWebContent(DISTINCT_COMMITMENTS, DISTINCT_PACKAGES);
    const json = JSON.stringify(content);

    for (const expected of [
      "L 5,100",
      "L 8,800",
      "Desde L 5,100",
      "Hasta 9 secciones",
      "4 rondas de revisión",
      "15 días hábiles",
      "48 horas hábiles",
      "7 meses",
    ]) {
      expect(json, expected).toContain(expected);
    }
    const tokens = withoutChannelDigits(numberTokens(json));
    expect(tokens).toEqual(NEW_NUMBERS);
    for (const old of DEFAULTS) expect(tokens, `quedó ${old}`).not.toContain(old);
  });

  it("con el valor 1 usa el singular en las cinco cantidades", () => {
    const json = JSON.stringify(
      buildPaginasWebContent(
        {
          ...DISTINCT_COMMITMENTS,
          maxSections: 1,
          revisionRounds: 1,
          deliveryBusinessDays: 1,
          responseBusinessHours: 1,
          domainHostingMonths: 1,
        },
        DISTINCT_PACKAGES,
      ),
    );
    for (const singular of ["1 sección", "1 ronda de revisión", "1 día hábil", "1 hora hábil", "1 mes"]) {
      expect(json, singular).toContain(singular);
    }
    expect(json).not.toMatch(/(^|[^\d])1 (secciones|rondas|días|horas|meses)/);
  });

  it("los miles llevan coma: 1200 se muestra como L 1,200", () => {
    const [standard, combo] = DISTINCT_PACKAGES;
    const content = buildPaginasWebContent(DISTINCT_COMMITMENTS, [{ ...standard, priceLempiras: 1200 }, combo]);
    expect(content.price.packages[0].amount).toBe("L 1,200");
    expect(content.hero.facts[0].value).toBe("Desde L 1,200");
    expect(content.price.packages[0].amountSpoken).toBe("1200 lempiras");
    expect(content.hero.facts[0].valueSpoken).toBe("Desde 1200 lempiras");
  });

  it("el precio «desde» del hero es el del paquete más barato, esté en el orden que esté", () => {
    const [standard, combo] = DISTINCT_PACKAGES;
    const content = buildPaginasWebContent(DISTINCT_COMMITMENTS, [{ ...combo, priceLempiras: 4000 }, standard]);
    expect(content.hero.facts[0].value).toBe("Desde L 4,000");
    expect(content.hero.facts[0].valueSpoken).toBe("Desde 4000 lempiras");
  });

  it("en pantalla se ven los compromisos y precios actuales y ninguna otra cifra escrita en los componentes", () => {
    renderPage();

    const main = document.querySelector("main")!;
    const text = visibleText(main);
    // El «Desde L 3,500» del hero se ve (aria-hidden) y un lector oye «Desde 3500 lempiras».
    expect(main.textContent).toContain("Desde L 3,500");
    expect(text).toContain("Desde 3500 lempiras");
    expect(withoutChannelDigits(numberTokens(text))).toEqual(DEFAULTS);
  });

  it("en pantalla, con otros compromisos y precios, cambian todas las cifras a la vez (ningún componente trae su número)", () => {
    contentSwitch.distinct = true;
    renderPage();

    const main = document.querySelector("main")!;
    const text = visibleText(main);
    expect(within(section("precio")).getByText("L 5,100")).toBeInTheDocument();
    expect(within(section("precio")).getByText("L 8,800")).toBeInTheDocument();
    expect(main.textContent).toContain("Desde L 5,100");
    expect(text).toContain("Desde 5100 lempiras");
    expect(text).toContain("15 días hábiles");
    expect(text).toContain("Menos de 48 horas hábiles");
    expect(text).toContain("Hasta 9 secciones");
    expect(text).toContain("4 rondas de revisión");
    expect(text).toContain("7 meses");
    const tokens = withoutChannelDigits(numberTokens(text));
    expect(tokens).toEqual(NEW_NUMBERS);
    for (const old of DEFAULTS) expect(tokens, `quedó ${old}`).not.toContain(old);
  });
});

// ---------------------------------------------------------------------------
// Paquetes: dos tarjetas con su precio, accesibles y con ancla estable
// ---------------------------------------------------------------------------

describe("/paginas-web · paquetes y precios", () => {
  // `spoken` es lo que anuncia el lector de pantalla: «L» se lee «ele», así que se dice «lempiras», y sin coma de
  // miles para que ninguna voz lo lea como decimal.
  const STANDARD = { id: "estandar", name: "Plan Estándar", amount: "L 3,500", spoken: "3500 lempiras" } as const;
  const COMBO = { id: "combo-emprendedor", name: "Combo Emprendedor", amount: "L 3,950", spoken: "3950 lempiras" } as const;
  const COMBO_EXTRAS = PACKAGES.find((pkg) => pkg.id === COMBO.id)!.extras;

  const card = (id: string): HTMLElement => {
    const found = section("precio").querySelector<HTMLElement>(`article[data-package="${id}"]`);
    expect(found, `tarjeta del paquete ${id}`).not.toBeNull();
    return found!;
  };
  /** Lo que se lee en la página y en lo que se anuncia: texto visible, atributos accesibles y el contenido serializado. */
  const everything = (): string => {
    const main = document.querySelector("main")!;
    return [textAndAccessibleAttributes(main), visibleText(main), JSON.stringify(PAGINAS_WEB_CONTENT)].join("\n");
  };

  it("los precios de los paquetes son exactamente L 3,500 y L 3,950, en este orden", () => {
    expect(PACKAGES.map((pkg) => [pkg.id, pkg.name, pkg.priceLempiras])).toEqual([
      [STANDARD.id, STANDARD.name, 3500],
      [COMBO.id, COMBO.name, 3950],
    ]);
    expect(PAGINAS_WEB_CONTENT.price.packages.map((pkg) => pkg.amount)).toEqual([STANDARD.amount, COMBO.amount]);
  });

  it("#precio muestra dos tarjetas, una por paquete, con su ancla estable y su data-package", () => {
    renderPage();

    const cards = Array.from(section("precio").querySelectorAll("article"));
    expect(cards.map((c) => c.getAttribute("data-package"))).toEqual([STANDARD.id, COMBO.id]);
    expect(cards.map((c) => c.id)).toEqual(["paquete-estandar", "paquete-combo-emprendedor"]);
    expect(card(STANDARD.id)).toBe(document.getElementById("paquete-estandar"));
    expect(card(COMBO.id)).toBe(document.getElementById("paquete-combo-emprendedor"));
  });

  it("los dos precios, «L 3,500» y «L 3,950», están visibles dentro de su tarjeta", () => {
    renderPage();

    expect(within(card(STANDARD.id)).getByText(STANDARD.amount)).toBeVisible();
    expect(within(card(COMBO.id)).getByText(COMBO.amount)).toBeVisible();
    expect(visibleText(card(STANDARD.id))).not.toContain(COMBO.amount);
    expect(visibleText(card(COMBO.id))).not.toContain(STANDARD.amount);
  });

  it.each([STANDARD, COMBO])(
    "la tarjeta de $name es un grupo con nombre accesible «nombre + precio»: encabezado y precio juntos",
    (pkg) => {
      renderPage();

      const group = screen.getByRole("article", { name: `${pkg.name} ${pkg.spoken}` });
      expect(group).toBe(card(pkg.id));
      expect(group).toHaveAccessibleName(`${pkg.name} ${pkg.spoken}`);
      expect(within(group).getByRole("heading", { level: 3, name: pkg.name })).toBeInTheDocument();
      expect(within(group).getByText(pkg.amount)).toBeInTheDocument();
      // El grupo se nombra con ids que existen y están dentro de la tarjeta.
      for (const id of group.getAttribute("aria-labelledby")!.split(" ")) {
        expect(group.contains(document.getElementById(id)), id).toBe(true);
      }
    },
  );

  it("las tarjetas están dentro de la región «Precio claro desde el inicio» y vienen después de su h2", () => {
    renderPage();

    const region = screen.getByRole("region", { name: "Precio claro desde el inicio" });
    expect(within(region).getAllByRole("article")).toHaveLength(2);
    expect(screen.getAllByRole("article")).toHaveLength(2);

    const h2 = within(region).getByRole("heading", { level: 2 });
    for (const article of within(region).getAllByRole("article")) {
      expect(h2.compareDocumentPosition(article) & Node.DOCUMENT_POSITION_FOLLOWING, article.id).toBeTruthy();
    }
  });

  it("el Combo Emprendedor muestra sus 7 entregables bajo «Tu logo profesional incluye»", () => {
    renderPage();

    expect(COMBO_EXTRAS).toHaveLength(7);
    const combo = within(card(COMBO.id));
    const title = combo.getByRole("heading", { level: 4, name: "Tu logo profesional incluye" });
    const list = title.nextElementSibling;
    expect(list?.tagName).toBe("UL");
    const items = Array.from(list!.querySelectorAll("li"));
    expect(items).toHaveLength(7);
    expect(items.map((li) => li.textContent?.trim())).toEqual([...COMBO_EXTRAS]);
    for (const extra of [
      "Diseño de logotipo personalizado",
      "Variaciones de color del logotipo",
      "Archivos PNG, JPG y PDF",
      "Archivo editable",
      "Paleta oficial de colores",
      "Tipografías utilizadas",
      "Alta resolución para redes sociales y medios físicos",
    ]) {
      expect(combo.getByText(extra), extra).toBeInTheDocument();
    }
  });

  it("el Plan Estándar no tiene lista de entregables: solo nombre, precio y «Tú aportas tu logo.»", () => {
    renderPage();

    const standard = card(STANDARD.id);
    expect(standard.querySelectorAll("ul, li, h4")).toHaveLength(0);
    expect(Array.from(standard.children).map((child) => child.textContent)).toEqual([
      STANDARD.name,
      `${STANDARD.amount}${STANDARD.spoken}`, // lo que se ve y, solo para lectores, lo que se dice
      "Tú aportas tu logo.",
    ]);
  });

  it.each([STANDARD, COMBO])(
    "el precio de $name se ve como «$amount» (aria-hidden) y se anuncia «$spoken» (solo lectores), sin que «L» se lea «ele»",
    (pkg) => {
      renderPage();

      const amount = card(pkg.id).querySelector<HTMLElement>(`[id$="-precio"]`)!;
      const [visual, spoken] = Array.from(amount.children);
      expect(amount.children).toHaveLength(2);
      expect(visual).toHaveAttribute("aria-hidden", "true");
      expect(visual).toHaveTextContent(new RegExp(`^${pkg.amount}$`));
      expect(spoken).not.toHaveAttribute("aria-hidden");
      expect(spoken.className).toBe("sr-only");
      expect(spoken).toHaveTextContent(new RegExp(`^${pkg.spoken}$`));
      // Lo que anuncia un lector no trae la «L» suelta.
      expect(visibleText(amount)).toBe(pkg.spoken);
    },
  );

  it("con otros precios, el nombre accesible y el texto para lectores siguen los datos (amountSpoken, sin coma)", () => {
    contentSwitch.distinct = true;
    renderPage();

    expect(screen.getByRole("article", { name: "Plan Estándar 5100 lempiras" })).toBe(card(STANDARD.id));
    expect(screen.getByRole("article", { name: "Combo Emprendedor 8800 lempiras" })).toBe(card(COMBO.id));
  });

  it("«One-Page» no se parte en la descripción del precio: va en un span sin saltos y el texto visible no cambia", () => {
    renderPage();

    const scope = section("precio").querySelector<HTMLElement>(".ms-pw-intro")!;
    expect(scope.textContent).toBe(PAGINAS_WEB_CONTENT.price.scope);
    const nowrap = Array.from(scope.querySelectorAll("span"));
    expect(nowrap.map((s) => [s.className, s.textContent])).toEqual([["ms-pw-nowrap", "One-Page"]]);
  });

  it("ni la página ni su contenido dicen «US$», «USD» ni «impuestos», con los precios reales y con otros", () => {
    renderPage();
    expect(everything()).not.toMatch(/US\$|USD|impuesto/i);
    expect(everything().length).toBeGreaterThan(3000); // no pasa en vacío
    cleanup();

    contentSwitch.distinct = true;
    renderPage();
    const main = document.querySelector("main")!;
    expect([textAndAccessibleAttributes(main), visibleText(main), JSON.stringify(buildPaginasWebContent(DISTINCT_COMMITMENTS, DISTINCT_PACKAGES))].join("\n")).not.toMatch(
      /US\$|USD|impuesto/i,
    );
  });

  it("el precio obsoleto «Desde US$500» y su rótulo ya no existen, ni en pantalla ni en el contenido", () => {
    renderPage();

    expect(everything()).not.toMatch(/US\$\s?500|Impuestos no incluidos|precio base/i);
  });

  it("el hero anuncia «Desde L 3,500» y el precio queda en lempiras en toda la página", () => {
    renderPage();

    expect(within(section("inicio")).getByText("Desde L 3,500")).toHaveAttribute("aria-hidden", "true");
    expect(within(section("inicio")).getByText("Desde 3500 lempiras")).toHaveClass("sr-only");
    const prices = document.querySelector("main")!.textContent!.match(/\bL\s?[\d,]+/g) ?? [];
    expect([...new Set(prices)].sort()).toEqual(["L 3,500", "L 3,950"]);
  });

  it("«Dominio» y «Hosting» no aparecen en «Lo que no está incluido»: están incluidos los primeros meses", () => {
    for (const content of [PAGINAS_WEB_CONTENT, buildPaginasWebContent(DISTINCT_COMMITMENTS, DISTINCT_PACKAGES)]) {
      expect(JSON.stringify(content.price.notIncluded)).not.toMatch(/dominio|hosting/i);
      expect(content.price.included.some((title) => /Dominio y hosting/.test(title))).toBe(true);
    }

    renderPage();
    const notIncluded = listAfterHeading(section("precio"), "Lo que no está incluido");
    expect(notIncluded.textContent).not.toMatch(/dominio|hosting/i);
    const included = listAfterHeading(section("precio"), "Lo que incluye cada plan");
    expect(included.textContent).toMatch(/Dominio y hosting por 12 meses/);
  });

  it("COMMITMENTS trae los meses de dominio y hosting y ningún precio de dominio ni de hosting", () => {
    expect(COMMITMENTS.domainHostingMonths).toBe(12);
    for (const key of ["domainYearlyUsd", "domainPrice", "hostingPrice", "priceFromUsd"]) {
      expect(COMMITMENTS, key).not.toHaveProperty(key);
    }
  });

  it("en pantalla, con otros compromisos, el dominio y el hosting dicen los meses nuevos", () => {
    contentSwitch.distinct = true;
    renderPage();

    const included = listAfterHeading(section("precio"), "Lo que incluye cada plan");
    expect(included.textContent).toMatch(/Dominio y hosting por 7 meses/);
    expect(visibleText(section("preguntas"))).toContain("Sí, durante los primeros 7 meses.");
  });
});

// ---------------------------------------------------------------------------
// Lo que el propietario no ha decidido no se afirma, y el plazo sigue ligado al material completo
// ---------------------------------------------------------------------------

describe("/paginas-web · lo no decidido y el plazo", () => {
  /** Renovaciones, promociones, titularidad del dominio, impuestos, tarifas periódicas y dólares: nada de esto se dice. */
  const UNDECIDED =
    /renov|promoci|vigencia|aliad|titular|a tu nombre|extensi[oó]n|ISV|impuesto|al año|anual|mensual|cada año|US\$|USD/i;
  const BOTH = [
    ["reales", () => PAGINAS_WEB_CONTENT],
    ["distintos", () => buildPaginasWebContent(DISTINCT_COMMITMENTS, DISTINCT_PACKAGES)],
  ] as const;
  const faqAnswer = (content: typeof PAGINAS_WEB_CONTENT, question: string): string => {
    const found = content.faq.items.filter((i) => i.question === question);
    expect(found, question).toHaveLength(1);
    return found[0].answer;
  };

  it("el detector reconoce cada cosa no decidida y deja pasar lo aprobado", () => {
    for (const bad of [
      "Se renueva cada año",
      "Renovación del dominio",
      "Promoción de lanzamiento",
      "Vigencia de la oferta",
      "Nuestros aliados",
      "El titular del dominio",
      "Registrado a tu nombre",
      "Extensión .com",
      "ISV incluido",
      "Impuestos no incluidos",
      "Pago anual",
      "Pago mensual",
      "US$500",
      "500 USD",
    ]) {
      expect(bad, bad).toMatch(UNDECIDED);
    }
    for (const fine of ["Sí, durante los primeros 12 meses.", "Plan Estándar: L 3,500.", "3500 lempiras", "2 rondas de revisión de la página"]) {
      expect(fine, fine).not.toMatch(UNDECIDED);
    }
  });

  it.each(BOTH)("con compromisos %s, nada del contenido (JSON completo) menciona lo no decidido", (label, build) => {
    const json = JSON.stringify(build());
    expect(json.length).toBeGreaterThan(5000); // no pasa en vacío
    expect(json.match(UNDECIDED)?.[0] ?? null).toBeNull();
  });

  it("en pantalla, el texto visible y los atributos accesibles de <main> tampoco lo mencionan", () => {
    renderPage();
    const main = document.querySelector("main")!;
    expect(textAndAccessibleAttributes(main).match(UNDECIDED)?.[0] ?? null).toBeNull();
    expect(visibleText(main).match(UNDECIDED)?.[0] ?? null).toBeNull();
  });

  it.each(BOTH)("con compromisos %s, la respuesta del dominio y el hosting es exactamente «Sí, durante los primeros N meses.»", (label, build) => {
    const content = build();
    const months = label === "reales" ? 12 : DISTINCT_COMMITMENTS.domainHostingMonths;
    expect(faqAnswer(content, "¿El dominio y el hosting están incluidos?")).toBe(`Sí, durante los primeros ${months} meses.`);
  });

  it.each(BOTH)(
    "con compromisos %s, el plazo corre desde el material completo (textos, logo y fotos) en el proceso, en el paso y en las preguntas",
    (label, build) => {
      const content = build();
      const days = label === "reales" ? "10 días hábiles" : `${DISTINCT_COMMITMENTS.deliveryBusinessDays} días hábiles`;

      expect(content.timeline.intro).toBe(`El plazo de ${days} corre desde que nos pasas tus textos, tu logo y tus fotos.`);
      const step = content.timeline.steps.find((s) => s.title === "Nos pasas tu material");
      expect(step?.text).toBe("Tus textos, tu logo y tus fotos. Con eso empieza a contar el plazo.");
      expect(faqAnswer(content, "¿Cuánto tardan en entregar la página?")).toBe(
        `Entregamos en ${days}, contados desde que nos pasas tus textos, tu logo y tus fotos.`,
      );
    },
  );

  it.each(BOTH)(
    "con compromisos %s, qué necesitas: el logo es tuyo en el Plan Estándar y su diseño está incluido en el Combo, sin atar eso al plazo",
    (label, build) => {
      const answer = faqAnswer(build(), "¿Qué necesito darles para empezar?");
      expect(answer).toBe(
        "Tus textos y tus fotos. Si eliges el Plan Estándar, también tu logo; en el Combo Emprendedor, el diseño de tu logo está incluido. La redacción de textos largos y la fotografía profesional no están incluidas.",
      );
      expect(answer).not.toMatch(/plazo|d[ií]as/i);
    },
  );

  it.each(BOTH)("con compromisos %s, ningún texto dice «lo diseñamos nosotros» ni insinúa un plazo propio del Combo", (label, build) => {
    const content = build();
    expect(JSON.stringify(content)).not.toMatch(/lo diseñamos nosotros/i);
    const engineering = content.engineering.points.find((p) => p.title === "Diseño a partir de tu material");
    expect(engineering?.text).toBe("Diseñamos con tus textos, tu logo y tus fotos, y escribimos el código para tu página.");
    // Las únicas frases con el plazo en días son las del compromiso de entrega, ninguna menciona el Combo.
    const allStrings = (value: unknown): string[] =>
      typeof value === "string"
        ? [value]
        : value && typeof value === "object"
          ? Object.values(value).flatMap(allStrings)
          : [];
    const withDays = allStrings(content)
      .flatMap((text) => text.split(/(?<=\.)\s/))
      .filter((sentence) => /d[ií]as h[aá]biles/.test(sentence));
    expect(withDays.length).toBeGreaterThan(0);
    for (const sentence of withDays) expect(sentence, sentence).not.toMatch(/combo/i);
  });

  it.each(BOTH)("con compromisos %s, las revisiones se nombran «de la página» en el ítem, la pregunta, el paso y el dato", (label, build) => {
    const content = build();
    const rounds = label === "reales" ? "2 rondas" : `${DISTINCT_COMMITMENTS.revisionRounds} rondas`;
    expect(content.price.included).toContain(`${rounds} de revisión de la página`);
    expect(faqAnswer(content, "¿Puedo pedir cambios?")).toContain(`Cada plan incluye ${rounds} de revisión de la página.`);
    expect(content.timeline.steps.find((s) => s.title === "Entrega y ajustes")?.text).toContain(
      `Cada plan incluye ${rounds} de revisión de la página:`,
    );
    expect(content.timeline.facts[1]).toEqual({ value: rounds, label: "De revisión de la página" });
  });
});

// ---------------------------------------------------------------------------
// CSS: las tarjetas de paquete van lado a lado y se apilan en pantallas angostas
// ---------------------------------------------------------------------------

describe("/paginas-web · tarjetas de paquete (index.css)", () => {
  const rules = (media?: string, property = "grid-template-columns"): Map<string, string> => {
    const css = readFileSync(path.join(ROOT, "src", "index.css"), "utf8");
    const found = new Map<string, string>();
    postcss.parse(css).walkRules((rule) => {
      const parent = rule.parent;
      const inMedia = parent?.type === "atrule" && (parent as { name?: string }).name === "media";
      const params = inMedia ? (parent as { params: string }).params.replace(/\s+/g, "") : undefined;
      if (params !== media) return;
      rule.walkDecls(property, (decl) => {
        for (const selector of rule.selectors) found.set(selector.trim(), decl.value.replace(/\s+/g, " ").trim());
      });
    });
    return found;
  };

  it("en escritorio son dos columnas iguales", () => {
    expect(rules().get(".ms-pw-plans")).toBe("repeat(2, minmax(0, 1fr))");
  });

  it("en @media (max-width: 920px) pasan a una sola columna (apiladas)", () => {
    expect(rules("(max-width:920px)").get(".ms-pw-plans")).toBe("minmax(0, 1fr)");
  });

  it("la rejilla alinea al inicio: ninguna tarjeta se estira a la altura de la otra y deja un hueco vacío", () => {
    expect(rules(undefined, "align-items").get(".ms-pw-plans")).toBe("start");
  });

  it("la clase de «One-Page» no permite saltos de línea", () => {
    expect(rules(undefined, "white-space").get(".ms-pw-nowrap")).toBe("nowrap");
  });
});

// ---------------------------------------------------------------------------
// Datos exactos y enlaces
// ---------------------------------------------------------------------------

describe("/paginas-web · datos de contacto y enlaces", () => {
  it("los datos de contacto del propietario son exactamente estos", () => {
    expect(CHANNELS).toEqual({
      whatsappUrl: "https://wa.me/50433023042",
      phoneDisplay: "+504 3302-3042",
      phoneHref: "tel:+50433023042",
      instagramUrl: "https://www.instagram.com/multistacksystems/",
      facebookUrl: "https://www.facebook.com/multistacksystems/",
      location: "Siguatepeque, Comayagua, Honduras",
    });
  });

  it("WhatsApp, teléfono, Instagram, Facebook y ubicación aparecen en pantalla con sus datos", () => {
    renderPage();

    const whatsapp = screen.getAllByRole("link", { name: /WhatsApp/ });
    expect(whatsapp.length).toBeGreaterThanOrEqual(3); // hero, atención y contacto
    whatsapp.forEach((link) => expect(link).toHaveAttribute("href", "https://wa.me/50433023042"));

    const phone = screen.getAllByRole("link", { name: "Llama al +504 3302-3042" });
    expect(phone.length).toBeGreaterThanOrEqual(2);
    phone.forEach((link) => expect(link).toHaveAttribute("href", "tel:+50433023042"));

    expect(screen.getByRole("link", { name: /^Mira cómo trabajamos en Instagram/ })).toHaveAttribute(
      "href",
      "https://www.instagram.com/multistacksystems/",
    );
    expect(screen.getByRole("link", { name: /^Visita nuestro Facebook/ })).toHaveAttribute(
      "href",
      "https://www.facebook.com/multistacksystems/",
    );
    expect(within(section("honduras")).getByText("Siguatepeque, Comayagua, Honduras")).toBeInTheDocument();
  });

  it("los enlaces externos abren pestaña nueva con noopener noreferrer y avisan en su aria-label", () => {
    renderPage();

    const external = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).filter((a) =>
      /^https?:/.test(a.getAttribute("href") ?? ""),
    );
    expect(external.length).toBeGreaterThanOrEqual(5);
    for (const link of external) {
      const visible = link.textContent!.trim();
      const name = link.getAttribute("aria-label");
      expect(link, link.href).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel"), link.href).toBe("noopener noreferrer");
      expect(visible, link.href).not.toBe("");
      expect(name, link.href).not.toBeNull();
      expect(name!.startsWith(visible), `«${name}» debe empezar con «${visible}»`).toBe(true);
      expect(name, link.href).toMatch(/pesta[ñn]a nueva/i);
    }
  });

  it("los únicos destinos externos son WhatsApp, Instagram y Facebook, siempre por https", () => {
    renderPage();

    const hosts = new Set(
      Array.from(document.querySelectorAll("a[href]"))
        .map((a) => a.getAttribute("href")!)
        .filter((href) => /^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith("tel:"))
        .map((href) => {
          const url = new URL(href);
          expect(url.protocol, href).toBe("https:");
          return url.host;
        }),
    );
    expect([...hosts].sort()).toEqual(["wa.me", "www.facebook.com", "www.instagram.com"]);
  });

  it("los tel: y las anclas internas no abren pestaña nueva, y cada ancla lleva a un id que existe", () => {
    renderPage();

    const local = Array.from(document.querySelectorAll<HTMLAnchorElement>("a")).filter((a) => {
      const href = a.getAttribute("href") ?? "";
      return href.startsWith("tel:") || href.startsWith("#");
    });
    expect(local.length).toBeGreaterThanOrEqual(6); // 4 CTA a #contacto y 2 enlaces tel:
    for (const link of local) {
      expect(link.hasAttribute("target"), link.getAttribute("href")!).toBe(false);
      expect(link.hasAttribute("rel"), link.getAttribute("href")!).toBe(false);
      const href = link.getAttribute("href")!;
      if (href.startsWith("#")) expect(document.getElementById(href.slice(1)), href).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Prellenado del formulario
// ---------------------------------------------------------------------------

describe("/paginas-web · prellenado del mensaje", () => {
  it("la frase de prellenado es la del contenido", () => {
    expect(PAGINAS_WEB_CONTENT.contact.messagePrefill).toBe(PREFILL);
  });

  it.each([
    ["normal", false],
    ["StrictMode", true],
  ] as const)("al montar (%s) el mensaje está vacío y el foco no está en ningún campo del formulario", (_mode, strict) => {
    renderPage({ strict });

    expect(message().value).toBe("");
    expect(document.activeElement).toBe(document.body);
    for (const id of FIELD_IDS) expect(document.activeElement?.id).not.toBe(id);
    // Y sigue igual tras dejar correr los efectos pendientes.
    frames.flush();
    expect(message().value).toBe("");
    expect(document.activeElement).toBe(document.body);
  });

  it("el primer clic en el CTA del hero con el campo vacío prellena el mensaje y deja el foco en el nombre", () => {
    renderPage();

    clickCta(CTAS[0]);

    expect(message().value).toBe(PREFILL);
    expect(document.activeElement).toBe(document.getElementById("ms-contact-pw-name"));
  });

  it.each(CTAS.map((cta) => [`${cta[0]} · «${cta[1]}»`, cta] as const))(
    "el CTA de %s no cancela la navegación nativa hacia #contacto (nadie llama a preventDefault)",
    (_name, cta) => {
      renderPage();

      const proceeded = clickCta(cta); // false si algún manejador canceló el clic

      expect(proceeded).toBe(true);
      expect(within(section(cta[0])).getByRole("link", { name: cta[1] })).toHaveAttribute("href", "#contacto");
    },
  );

  it.each(CTAS.map((cta, i) => [`${cta[0]} · «${cta[1]}»`, i] as const))(
    "el CTA de %s también prellena cuando es el primero",
    (_name, index) => {
      renderPage();
      clickCta(CTAS[index]);
      expect(message().value).toBe(PREFILL);
    },
  );

  it("un segundo clic en otro CTA no cambia nada", () => {
    renderPage();
    clickCta(CTAS[0]);
    const focused = document.activeElement;

    clickCta(CTAS[1]);
    clickCta(CTAS[2]);
    clickCta(CTAS[3]);

    expect(message().value).toBe(PREFILL);
    expect(document.activeElement).toBe(focused);
  });

  it("si la persona edita el mensaje después del primer prellenado, ningún CTA lo pisa", () => {
    renderPage();
    clickCta(CTAS[0]);
    typeMessage("mi mensaje");

    for (const cta of CTAS) clickCta(cta);

    expect(message().value).toBe("mi mensaje");
  });

  it("aplicado una vez, no vuelve a prellenar aunque la persona borre el texto (máximo una vez por visita)", () => {
    renderPage();
    clickCta(CTAS[0]);
    expect(message().value).toBe(PREFILL);

    typeMessage("");
    clickCta(CTAS[1]);
    clickCta(CTAS[2]);

    expect(message().value).toBe("");
  });

  it("si la persona escribió antes del primer clic, ningún CTA lo pisa", () => {
    renderPage();
    typeMessage("algo que ya escribí");

    for (const cta of CTAS) {
      clickCta(cta);
      expect(message().value, `${cta[0]} · ${cta[1]}`).toBe("algo que ya escribí");
    }
  });

  it("y si luego borra el texto, el siguiente CTA prellena una sola vez más", () => {
    renderPage();
    typeMessage("algo que ya escribí");
    clickCta(CTAS[0]);
    expect(message().value).toBe("algo que ya escribí");

    typeMessage("");
    clickCta(CTAS[1]);
    expect(message().value).toBe(PREFILL);

    typeMessage("");
    clickCta(CTAS[2]);
    expect(message().value).toBe("");
  });

  it("un mensaje de solo espacios o saltos de línea cuenta como vacío", () => {
    renderPage();
    typeMessage("   \n  \t ");

    clickCta(CTAS[0]);

    expect(message().value).toBe(PREFILL);
  });

  it("los enlaces externos y el teléfono no prellenan ni gastan el prellenado", () => {
    renderPage();
    // jsdom no navega a otros sitios: se cancela el clic en captura solo para estos enlaces.
    const stop = (event: Event) => event.preventDefault();
    document.addEventListener("click", stop, true);
    try {
      fireEvent.click(within(section("inicio")).getByRole("link", { name: /WhatsApp/ }));
      fireEvent.click(within(section("atencion")).getByRole("link", { name: /^Llama al/ }));
      fireEvent.click(within(section("como-trabajamos")).getAllByRole("link")[0]);
    } finally {
      document.removeEventListener("click", stop, true);
    }
    expect(message().value).toBe("");
    expect(document.activeElement).toBe(document.body);

    clickCta(CTAS[0]);
    expect(message().value).toBe(PREFILL);
  });

  it("en StrictMode el prellenado también ocurre una sola vez y solo tras la acción", () => {
    renderPage({ strict: true });
    expect(message().value).toBe("");

    clickCta(CTAS[0]);
    expect(message().value).toBe(PREFILL);

    typeMessage("");
    clickCta(CTAS[1]);
    expect(message().value).toBe("");
  });

  it("el embudo completo: CTA, nombre y teléfono, enviar → sendContactMessage recibe el mensaje prellenado", async () => {
    vi.mocked(sendContactMessage).mockResolvedValue(undefined);
    renderPage();

    clickCta(CTAS[0]);
    fireEvent.change(screen.getByLabelText("Nombre completo"), { target: { value: "Ana Prueba" } });
    fireEvent.change(screen.getByLabelText("Número de teléfono (opcional)"), { target: { value: "+504 9999-9999" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("¡Mensaje enviado!"));
    expect(sendContactMessage).toHaveBeenCalledTimes(1);
    expect(sendContactMessage).toHaveBeenCalledWith({
      name: "Ana Prueba",
      phone: "+504 9999-9999",
      email: "",
      message: PREFILL,
    });
  });

  it("sin nombre ni contacto, el formulario muestra los errores y no envía nada", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));

    expect(screen.getByText("Escribe tu nombre completo.")).toBeInTheDocument();
    expect(sendContactMessage).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Hash en la URL
// ---------------------------------------------------------------------------

describe("/paginas-web · hash en la URL", () => {
  it.each(["precio", "contacto", "preguntas", "inicio"])(
    "con /paginas-web#%s salta a esa sección en el siguiente fotograma, sin animación",
    (id) => {
      renderPage({ path: `/paginas-web#${id}` });
      expect(scrollIntoView).not.toHaveBeenCalled(); // todavía no: espera al fotograma
      expect(frames.size).toBeGreaterThanOrEqual(1);

      frames.flush();

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(section(id));
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto" });
    },
  );

  it("sin hash no salta a ningún sitio", () => {
    renderPage();
    frames.flush();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("con un hash que no corresponde a ningún elemento no salta y no falla", () => {
    renderPage({ path: "/paginas-web#no-existe" });
    expect(() => frames.flush()).not.toThrow();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("si se sale de la página antes del fotograma, el salto se cancela y no mueve la página siguiente", () => {
    const { unmount } = renderPage({ path: "/paginas-web#precio" });
    expect(frames.size).toBeGreaterThanOrEqual(1);

    unmount();
    // La página a la que se navega tiene su propio #precio: un salto que sobreviviera caería aquí.
    const next = document.createElement("div");
    next.id = "precio";
    document.body.appendChild(next);
    try {
      frames.flush();
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      next.remove();
    }
  });

  it("si el hash cambia dentro de la misma visita, salta a la nueva sección", () => {
    const Jump = ({ to }: { to: string }) => {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate(to)}>
          ir a {to}
        </button>
      );
    };
    render(
      <MemoryRouter initialEntries={["/paginas-web#precio"]}>
        <Jump to="/paginas-web#preguntas" />
        <PaginasWeb />
      </MemoryRouter>,
    );
    frames.flush();
    expect(scrollIntoView.mock.contexts).toEqual([section("precio")]);

    fireEvent.click(screen.getByRole("button", { name: "ir a /paginas-web#preguntas" }));
    frames.flush();

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrollIntoView.mock.contexts[1]).toBe(section("preguntas"));
  });
});

// ---------------------------------------------------------------------------
// Metas de la ruta
// ---------------------------------------------------------------------------

type Values = Record<string, string | null>;

const LABELS_AND_READERS: ReadonlyArray<readonly [string, () => string | null]> = [
  ["title", () => document.head.querySelector("title")?.textContent ?? null],
  ["description", () => meta("name", "description")],
  ["canonical", () => document.head.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null],
  ["og:title", () => meta("property", "og:title")],
  ["og:description", () => meta("property", "og:description")],
  ["og:url", () => meta("property", "og:url")],
  ["og:image", () => meta("property", "og:image")],
  ["og:image:alt", () => meta("property", "og:image:alt")],
  ["twitter:title", () => meta("name", "twitter:title")],
  ["twitter:description", () => meta("name", "twitter:description")],
  ["twitter:image", () => meta("name", "twitter:image")],
  ["twitter:image:alt", () => meta("name", "twitter:image:alt")],
];

function meta(attr: "name" | "property", key: string): string | null {
  const found = Array.from(document.head.querySelectorAll("meta")).filter((m) => m.getAttribute(attr) === key);
  if (found.length === 0) return null;
  return found.length > 1 ? `<<${found.length} elementos>>` : found[0].getAttribute("content");
}

const readHead = (): Values => Object.fromEntries(LABELS_AND_READERS.map(([label, read]) => [label, read()]));

const valuesOf = (m: RouteMeta): Values => ({
  title: m.title,
  description: m.description,
  canonical: m.canonical,
  "og:title": m.ogTitle,
  "og:description": m.ogDescription,
  "og:url": m.ogUrl,
  "og:image": m.ogImage,
  "og:image:alt": m.ogImageAlt,
  "twitter:title": m.ogTitle,
  "twitter:description": m.ogDescription,
  "twitter:image": m.ogImage,
  "twitter:image:alt": m.ogImageAlt,
});

/** El <head> sin scripts (en el navegador no corren al insertarlos así, pero aquí ni se intenta). */
const headOf = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.head.querySelectorAll("script").forEach((s) => s.remove());
  return doc.head.innerHTML;
};

/**
 * Lo que sirve Vercel al entrar a «/» y lo que sirve al entrar directo a «/paginas-web». Se calculan al usarlos,
 * no al cargar el archivo: si withRouteHead se rompe, fallan estas pruebas y no las 70 restantes.
 */
const homeHead = (): string => headOf(INDEX_LF);
const landingHead = (): string => headOf(withRouteHead(INDEX_LF, ROUTE_META["/paginas-web"]));
const elements = (): string[] => Array.from(document.head.children).map((e) => e.outerHTML);
const elementsOf = (headHtml: string): string[] => {
  const holder = document.createElement("head");
  holder.innerHTML = headHtml;
  return Array.from(holder.children).map((e) => e.outerHTML);
};

describe("/paginas-web · metas del <head>", () => {
  const LANDING = valuesOf(ROUTE_META["/paginas-web"]);
  const HOME = valuesOf(HOME_META);

  it.each([
    ["entrada desde la home por el SPA", homeHead],
    ["entrada directa (head estático de la landing)", landingHead],
  ])("%s: al montar se ven las metas de la landing y al desmontar las de la home", (_name, startHead) => {
    document.head.innerHTML = startHead();

    const { unmount } = renderPage();
    expect(readHead()).toEqual(LANDING);

    unmount();
    expect(readHead()).toEqual(HOME);
  });

  it.each([
    ["entrada desde la home por el SPA", homeHead],
    ["entrada directa (head estático de la landing)", landingHead],
  ])("%s, en StrictMode: el resultado es el mismo", (_name, startHead) => {
    document.head.innerHTML = startHead();

    const { unmount } = renderPage({ strict: true });
    expect(readHead()).toEqual(LANDING);

    unmount();
    expect(readHead()).toEqual(HOME);
  });

  it("desde la home por el SPA, el head queda idéntico después de ir y volver", () => {
    document.head.innerHTML = homeHead();
    const before = elements();

    renderPage({ strict: true }).unmount();

    expect(elements()).toEqual(before);
  });

  it("tras una entrada directa, el head de salida es el de la home (sin keywords, que la landing no trae)", () => {
    document.head.innerHTML = landingHead();

    renderPage().unmount();

    expect(elements()).toEqual(elementsOf(homeHead()).filter((e) => !/name="keywords"/.test(e)));
  });

  it("solo toca las 12 metas gestionadas: el resto del head no cambia mientras la página está montada", () => {
    document.head.innerHTML = landingHead();
    const managed = /<title>|name="description"|rel="canonical"|property="og:(title|description|url|image|image:alt)"|name="twitter:(title|description|image|image:alt)"/;
    const others = elements().filter((e) => !managed.test(e));
    expect(others.length).toBeGreaterThanOrEqual(8);

    renderPage();

    expect(elements().filter((e) => !managed.test(e))).toEqual(others);
  });

  it("cadena: entrada directa a la landing, SPA a la Política de Privacidad: sus og:* son los de la home, no los de la landing", () => {
    document.head.innerHTML = landingHead();

    renderPage().unmount(); // el visitante sale de la landing
    const legal = render(
      <MemoryRouter initialEntries={["/politica-de-privacidad"]}>
        <PoliticaDePrivacidad />
      </MemoryRouter>,
    );

    const during = readHead();
    expect(during.title).toContain("Política de Privacidad");
    expect(during.canonical).toBe("https://www.multistacksystems.com/politica-de-privacidad");
    for (const label of ["og:title", "og:description", "og:url", "og:image", "og:image:alt", "twitter:title", "twitter:image:alt"]) {
      expect(during[label], label).toBe(HOME[label]);
    }

    legal.unmount(); // vuelve a la home
    expect(readHead()).toEqual(HOME);
  });
});

describe("/paginas-web · metas de la ruta (ROUTE_META)", () => {
  const META = ROUTE_META["/paginas-web"];
  const publicFile = (urlPath: string) => path.join(ROOT, "public", ...urlPath.split("/").filter(Boolean));
  const OG_IMAGE_ALT =
    "MultiStack Systems — Páginas web para negocios de Honduras. Diseño a medida, código propio y precio claro antes de empezar.";

  it("el título tiene 60 caracteres o menos e incluye «Páginas web en Honduras»", () => {
    expect(META.title.length).toBeLessThanOrEqual(60);
    expect(META.title).toContain("Páginas web en Honduras");
  });

  it("la descripción tiene entre 120 y 155 caracteres", () => {
    expect(META.description.length).toBeGreaterThanOrEqual(120);
    expect(META.description.length).toBeLessThanOrEqual(155);
  });

  it("canonical y og:url son https://www.multistacksystems.com/paginas-web, sin barra final", () => {
    expect(SITE_ORIGIN).toBe("https://www.multistacksystems.com");
    expect(META.canonical).toBe("https://www.multistacksystems.com/paginas-web");
    expect(META.ogUrl).toBe("https://www.multistacksystems.com/paginas-web");
  });

  it("la imagen social es una URL absoluta con el origen www y el archivo existe en public/", () => {
    expect(META.ogImage.startsWith(`${SITE_ORIGIN}/`)).toBe(true);
    const url = new URL(META.ogImage);
    expect(url.origin).toBe("https://www.multistacksystems.com");
    expect(existsSync(publicFile(url.pathname)), `public${url.pathname}`).toBe(true);
    expect(META.ogImage).toBe(`${SITE_ORIGIN}${PAGINAS_WEB_OG.path}`);
    expect(META.ogImageAlt.length).toBeGreaterThan(0);
  });

  it("PAGINAS_WEB_OG es la imagen propia de la landing (OG_IMAGES.paginasWeb), no la de la home", () => {
    expect(PAGINAS_WEB_OG).toBe(OG_IMAGES.paginasWeb);
    expect(PAGINAS_WEB_OG.path).toBe("/assets/images/og/og-paginas-web.png");
    expect(PAGINAS_WEB_OG.path).not.toBe(OG_IMAGES.default.path);
  });

  it("el og:image:alt y el twitter:image:alt de la landing son el texto de su imagen, en el head estático y al montar la página", () => {
    expect(META.ogImageAlt).toBe(OG_IMAGE_ALT);

    document.head.innerHTML = headOf(withRouteHead(INDEX_LF, META));
    expect(meta("property", "og:image:alt")).toBe(OG_IMAGE_ALT);
    expect(meta("name", "twitter:image:alt")).toBe(OG_IMAGE_ALT);

    document.head.innerHTML = headOf(INDEX_LF);
    renderPage();
    expect(meta("property", "og:image:alt")).toBe(OG_IMAGE_ALT);
    expect(meta("name", "twitter:image:alt")).toBe(OG_IMAGE_ALT);
  });

  it("las imágenes sociales, la de la landing y la de la home, existen en public/", () => {
    for (const image of [PAGINAS_WEB_OG, OG_IMAGES.default]) {
      expect(image.path.startsWith("/"), image.path).toBe(true);
      expect(existsSync(publicFile(image.path)), `public${image.path}`).toBe(true);
    }
  });

  it("el PNG de la landing mide 1200×630 según su cabecera IHDR, como declara el head heredado, y pesa menos de 300 KB", () => {
    const home = new DOMParser().parseFromString(INDEX_LF, "text/html");
    const declared = (key: string) => home.querySelector(`meta[property="${key}"]`)?.getAttribute("content");
    expect(declared("og:image:type")).toBe("image/png");
    expect(PAGINAS_WEB_OG.path).toMatch(/\.png$/);

    const png = readFileSync(publicFile(PAGINAS_WEB_OG.path));
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // firma PNG
    expect(png.subarray(12, 16).toString("latin1")).toBe("IHDR");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect([String(png.readUInt32BE(16)), String(png.readUInt32BE(20))]).toEqual([
      declared("og:image:width"),
      declared("og:image:height"),
    ]);
    // WhatsApp no muestra la vista previa de una imagen mayor.
    expect(png.length).toBeLessThan(300_000);
  });

  it("las metas de la landing no se parecen a las de la home de IA", () => {
    expect(META.title).not.toBe(HOME_META.title);
    expect(META.description).not.toBe(HOME_META.description);
    expect(META.canonical).not.toBe(HOME_META.canonical);
    expect(META.ogTitle).not.toBe(HOME_META.ogTitle);
    expect(META.ogUrl).not.toBe(HOME_META.ogUrl);
  });
});

// ---------------------------------------------------------------------------
// CSS: en táctiles y en pantallas angostas los campos del formulario miden 16px
// ---------------------------------------------------------------------------

describe("/paginas-web · campos del formulario a 16px en táctiles y en pantallas angostas (index.css)", () => {
  // Safari en iOS hace zoom al enfocar un campo de menos de 16px, y ContactForm fija su tamaño en línea (13.5px):
  // solo un `!important` en la hoja lo vence. Un iPhone en horizontal mide 812-932px de ancho CSS, así que además de
  // max-width hace falta pointer: coarse.
  const QUERY = "(max-width:720px),(pointer:coarse)";

  it("dentro de @media (max-width: 720px), (pointer: coarse), el input y el textarea de la tarjeta llevan font-size: 16px !important", () => {
    // La hoja se lee con fs: Vitest devuelve una cadena vacía para cualquier import de CSS, también con ?raw.
    const css = readFileSync(path.join(ROOT, "src", "index.css"), "utf8");
    expect(css.length).toBeGreaterThan(10_000);

    const forced: string[] = [];
    postcss.parse(css).walkAtRules("media", (media) => {
      if (media.params.replace(/\s+/g, "").toLowerCase() !== QUERY) return;
      media.walkDecls("font-size", (decl) => {
        if (decl.value.trim() !== "16px" || decl.important !== true || decl.parent?.type !== "rule") return;
        for (const selector of (decl.parent as Rule).selectors) forced.push(selector.replace(/\s+/g, " ").trim());
      });
    });

    expect(forced.sort()).toEqual([".ms-pw-card input", ".ms-pw-card textarea"]);
  });
});
