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

// El contenido de la página se puede cambiar por otro construido con compromisos distintos para
// comprobar que los números llegan a la pantalla desde COMMITMENTS y no están escritos en los componentes.
const contentSwitch = vi.hoisted(() => ({
  distinct: false,
  commitments: {
    priceFromUsd: 777,
    maxSections: 9,
    revisionRounds: 3,
    deliveryBusinessDays: 12,
    responseBusinessHours: 48,
  },
}));
const DISTINCT_COMMITMENTS = contentSwitch.commitments;
vi.mock("@/pages/marketing/paginasWebContent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/pages/marketing/paginasWebContent")>();
  const distinct = actual.buildPaginasWebContent(contentSwitch.commitments);
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
  PAGINAS_WEB_CONTENT,
  SECTION_IDS,
  buildPaginasWebContent,
} from "@/pages/marketing/paginasWebContent";

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
    for (const content of [PAGINAS_WEB_CONTENT, buildPaginasWebContent(DISTINCT_COMMITMENTS)]) {
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

  it("los conteos de ítems se conservan: 7 incluidos (los mismos 7 en el precio), 5 que no incluye y 3 puntos de ingeniería", () => {
    const { includes, price, engineering } = PAGINAS_WEB_CONTENT;
    expect(includes.items).toHaveLength(7);
    expect(price.included).toEqual(includes.items.map((i) => i.title));
    expect(price.notIncluded).toHaveLength(5);
    expect(engineering.points).toHaveLength(3);

    renderPage();

    expect(section("que-incluye").querySelectorAll("dt")).toHaveLength(7);
    expect(listAfterHeading(section("precio"), price.includedTitle).querySelectorAll("li")).toHaveLength(7);
    expect(listAfterHeading(section("precio"), price.notIncludedTitle).querySelectorAll("li")).toHaveLength(5);
    expect(section("ingenieria").querySelectorAll("li")).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Números: todos salen de COMMITMENTS
// ---------------------------------------------------------------------------

describe("/paginas-web · los números salen de COMMITMENTS", () => {
  const DEFAULTS = Object.values(COMMITMENTS).map(String); // 500, 6, 2, 10, 24
  const NEW_NUMBERS = Object.values(DISTINCT_COMMITMENTS).map(String).sort(); // 777, 9, 3, 12, 48

  it("el contenido real solo usa cifras de COMMITMENTS (más los dígitos del teléfono)", () => {
    expect(withoutChannelDigits(numberTokens(JSON.stringify(buildPaginasWebContent(COMMITMENTS))))).toEqual(
      [...DEFAULTS].sort(),
    );
  });

  it("con compromisos distintos aparecen los nuevos números y no sobrevive ninguno de los valores por defecto", () => {
    const content = buildPaginasWebContent(DISTINCT_COMMITMENTS);
    const json = JSON.stringify(content);

    for (const expected of ["US$777", "Hasta 9 secciones", "3 rondas de revisión", "12 días hábiles", "48 horas hábiles"]) {
      expect(json, expected).toContain(expected);
    }
    const tokens = withoutChannelDigits(numberTokens(json));
    expect(tokens).toEqual(NEW_NUMBERS);
    for (const old of DEFAULTS) expect(tokens, `quedó ${old}`).not.toContain(old);
  });

  it("con el valor 1 usa el singular en las cuatro cantidades", () => {
    const json = JSON.stringify(
      buildPaginasWebContent({ ...DISTINCT_COMMITMENTS, maxSections: 1, revisionRounds: 1, deliveryBusinessDays: 1, responseBusinessHours: 1 }),
    );
    for (const singular of ["1 sección", "1 ronda de revisión", "1 día hábil", "1 hora hábil"]) {
      expect(json, singular).toContain(singular);
    }
    expect(json).not.toMatch(/(^|[^\d])1 (secciones|rondas|días|horas)/);
  });

  it("los miles llevan coma: 1200 se muestra como US$1,200", () => {
    const content = buildPaginasWebContent({ ...DISTINCT_COMMITMENTS, priceFromUsd: 1200 });
    expect(content.price.amount).toBe("US$1,200");
    expect(content.hero.facts[0].value).toBe("Desde US$1,200");
  });

  it("en pantalla se ven los compromisos actuales y ninguna otra cifra escrita en los componentes", () => {
    renderPage();

    const text = visibleText(document.querySelector("main")!);
    expect(text).toContain(`Desde US$${COMMITMENTS.priceFromUsd}`);
    expect(withoutChannelDigits(numberTokens(text))).toEqual([...DEFAULTS].sort());
  });

  it("en pantalla, con otros compromisos, cambian todas las cifras a la vez (ningún componente trae su número)", () => {
    contentSwitch.distinct = true;
    renderPage();

    const text = visibleText(document.querySelector("main")!);
    expect(within(section("precio")).getByText("US$777")).toBeInTheDocument();
    expect(text).toContain("Desde US$777");
    expect(text).toContain("12 días hábiles");
    expect(text).toContain("Menos de 48 horas hábiles");
    expect(text).toContain("Hasta 9 secciones");
    expect(text).toContain("3 rondas de revisión");
    const tokens = withoutChannelDigits(numberTokens(text));
    expect(tokens).toEqual(NEW_NUMBERS);
    for (const old of DEFAULTS) expect(tokens, `quedó ${old}`).not.toContain(old);
  });
});

// ---------------------------------------------------------------------------
// Dominio: no se cotiza en la página, así que no lleva ninguna cifra al lado
// ---------------------------------------------------------------------------

describe("/paginas-web · el dominio no lleva cifra", () => {
  const DOMAIN_ITEM = "Dominio";
  const DOMAIN_SENTENCE = "No incluye el dominio: lo compras a tu nombre y te ayudamos a elegirlo y configurarlo.";
  const FAQ_QUESTION = "¿El dominio y el hosting están incluidos?";
  const FAQ_ANSWER =
    "No incluye el dominio: lo compras a tu nombre y te ayudamos a elegirlo y configurarlo. El hosting, el servicio donde vive tu página, tampoco está en el precio base.";

  /** Lo primero que parece una cifra o una tarifa: un dígito, un símbolo de dólar (US$ incluido) o una periodicidad de cobro. */
  const figureIn = (text: string): string | null =>
    text.match(/\d|\$|d[oó]lar|\b(?:al|por|cada)\s+(?:año|mes)\b|\/\s?(?:año|mes)\b|\banual|\bmensual/i)?.[0] ?? null;

  const domainItemRow = (): HTMLElement => {
    const list = listAfterHeading(section("precio"), PAGINAS_WEB_CONTENT.price.notIncludedTitle);
    const rows = Array.from(list.querySelectorAll("li")).filter((li) => within(li).queryByText(DOMAIN_ITEM));
    expect(rows, `ítems «${DOMAIN_ITEM}» en lo que no incluye`).toHaveLength(1);
    return rows[0];
  };
  const domainFaqItem = (): HTMLElement => {
    const items = Array.from(section("preguntas").querySelectorAll("details")).filter((d) =>
      within(d).queryByText(FAQ_QUESTION),
    );
    expect(items, `preguntas «${FAQ_QUESTION}»`).toHaveLength(1);
    return items[0];
  };

  it("el detector de cifras reconoce un importe o una tarifa junto al dominio y deja pasar el texto aprobado", () => {
    for (const figure of [
      "Dominio US$21 al año",
      "El dominio cuesta US$ 21",
      "Dominio: $15",
      "Dominio: veintiún dólares",
      "Se renueva cada año",
      "Se paga por año",
      "Cuesta quince/año",
      "Se cobra al mes",
      "Pago anual",
      "Cuota mensual",
    ]) {
      expect(figureIn(figure), figure).not.toBeNull();
    }
    for (const fine of [DOMAIN_ITEM, DOMAIN_SENTENCE, FAQ_QUESTION, FAQ_ANSWER]) {
      expect(figureIn(fine), fine).toBeNull();
    }
  });

  it("COMMITMENTS ya no trae un precio del dominio", () => {
    expect(COMMITMENTS).not.toHaveProperty("domainYearlyUsd");
    expect(COMMITMENTS).not.toHaveProperty("domainPrice");
  });

  it("en el contenido, el ítem «Dominio» y la respuesta de las preguntas dicen exactamente esto, con los compromisos reales y con otros", () => {
    for (const content of [PAGINAS_WEB_CONTENT, buildPaginasWebContent(DISTINCT_COMMITMENTS)]) {
      const items = content.price.notIncluded.filter((i) => i.title === DOMAIN_ITEM);
      expect(items).toHaveLength(1);
      expect(items[0].text).toBe(DOMAIN_SENTENCE);

      const faq = content.faq.items.filter((i) => i.question === FAQ_QUESTION);
      expect(faq).toHaveLength(1);
      expect(faq[0].answer).toBe(FAQ_ANSWER);
    }
  });

  it("en pantalla, el «Dominio» de lo que no incluye el precio base muestra exactamente la frase", () => {
    renderPage();

    expect(within(domainItemRow()).getByText(DOMAIN_SENTENCE)).toBeInTheDocument();
  });

  it("en pantalla, la pregunta «¿El dominio y el hosting están incluidos?» responde exactamente el texto nuevo", () => {
    renderPage();

    expect(within(domainFaqItem()).getByText(FAQ_ANSWER)).toBeInTheDocument();
  });

  it.each([
    ["reales", false, "US$500"],
    ["distintos", true, "US$777"],
  ] as const)(
    "en pantalla, con compromisos %s, ni el ítem «Dominio» ni su pregunta llevan «al año», importe en US$ ni otra cifra",
    (_label, distinct, price) => {
      contentSwitch.distinct = distinct;
      renderPage();

      // El precio sigue en su sitio: la ausencia de cifras junto al dominio no es porque la página no tenga ninguna.
      expect(within(section("precio")).getByText(price)).toBeInTheDocument();
      expect(visibleText(document.querySelector("main")!)).toContain(`Desde ${price}`);

      for (const [place, el] of [
        ["lo que no incluye", domainItemRow()],
        ["las preguntas", domainFaqItem()],
      ] as const) {
        const text = visibleText(el);
        expect(text, place).toMatch(/dominio/i); // no pasa en vacío
        expect(figureIn(text), place).toBeNull();
        expect(text, place).not.toMatch(/al año|US\$/i);
      }
    },
  );
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
