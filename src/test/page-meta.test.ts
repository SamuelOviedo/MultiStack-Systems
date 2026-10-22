import { StrictMode, createElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup as cleanupRender, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Navbar fuera: estas pruebas miran el <head>, no la barra (que trae auth, tickets y temas).
vi.mock("@/components/common/Navbar", async () => {
  const { createElement: h } = await import("react");
  return { default: () => h("nav", { "data-testid": "navbar-stub" }) };
});

import { applyPageMeta, routeMetaToPageMeta, type PageMeta } from "@/lib/pageMeta";
import { HOME_META, ROUTE_META, type RouteMeta } from "@/lib/routeMeta";
import PoliticaDePrivacidad from "@/pages/legal/PoliticaDePrivacidad";
import TerminosDelServicio from "@/pages/legal/TerminosDelServicio";

// ---------------------------------------------------------------------------
// Utilidades: un <head> como el de index.html y un lector independiente del código bajo prueba
// ---------------------------------------------------------------------------

const LABELS = [
  "title",
  "description",
  "canonical",
  "og:title",
  "og:description",
  "og:url",
  "og:image",
  "og:image:alt",
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
] as const;
type Label = (typeof LABELS)[number];
type Values = Record<Label, string | null>;

/** Las nueve metas de `extra`: [atributo, clave]. Escritas a mano, no sacadas de routeMetaToPageMeta. */
const EXTRA_PAIRS = [
  ["property", "og:title"],
  ["property", "og:description"],
  ["property", "og:url"],
  ["property", "og:image"],
  ["property", "og:image:alt"],
  ["name", "twitter:title"],
  ["name", "twitter:description"],
  ["name", "twitter:image"],
  ["name", "twitter:image:alt"],
] as const;

const RENDER_TAG: Record<Label, (value: string) => string> = {
  title: (v) => `<title>${v}</title>`,
  description: (v) => `<meta name="description" content="${v}" />`,
  canonical: (v) => `<link rel="canonical" href="${v}" />`,
  "og:title": (v) => `<meta property="og:title" content="${v}" />`,
  "og:description": (v) => `<meta property="og:description" content="${v}" />`,
  "og:url": (v) => `<meta property="og:url" content="${v}" />`,
  "og:image": (v) => `<meta property="og:image" content="${v}" />`,
  "og:image:alt": (v) => `<meta property="og:image:alt" content="${v}" />`,
  "twitter:title": (v) => `<meta name="twitter:title" content="${v}" />`,
  "twitter:description": (v) => `<meta name="twitter:description" content="${v}" />`,
  "twitter:image": (v) => `<meta name="twitter:image" content="${v}" />`,
  "twitter:image:alt": (v) => `<meta name="twitter:image:alt" content="${v}" />`,
};

/** Orden del head de index.html: etiquetas gestionadas (por nombre) mezcladas con las que nadie debe tocar. */
const HEAD_SPEC: ReadonlyArray<Label | "keywords" | string> = [
  '<meta charset="UTF-8" />',
  "title",
  "description",
  "keywords",
  "canonical",
  '<meta property="og:site_name" content="MultiStack Systems" />',
  "og:title",
  "og:description",
  '<meta property="og:type" content="website" />',
  "og:url",
  "og:image",
  '<meta property="og:image:type" content="image/png" />',
  "og:image:alt",
  '<meta property="og:locale" content="es_HN" />',
  '<meta name="twitter:card" content="summary_large_image" />',
  "twitter:title",
  "twitter:description",
  "twitter:image",
  "twitter:image:alt",
  '<script type="application/ld+json">{"@type":"Organization"}</script>',
];

/** HTML de un head con solo los valores dados (lo que falte, no se escribe). */
function headHtml(values: Partial<Values>, { keywords = false }: { keywords?: boolean } = {}): string {
  const lines: string[] = [];
  for (const entry of HEAD_SPEC) {
    if (entry === "keywords") {
      if (keywords) lines.push('<meta name="keywords" content="uno, dos, tres" />');
    } else if ((LABELS as readonly string[]).includes(entry)) {
      const value = values[entry as Label];
      if (value != null) lines.push(RENDER_TAG[entry as Label](value));
    } else {
      lines.push(entry);
    }
  }
  return lines.join("\n");
}

function setHead(html: string): void {
  document.head.innerHTML = html;
}

/** Lo que devuelve innerHTML para ese HTML (el navegador normaliza «<meta … />» a «<meta …>»). */
function serialized(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.innerHTML;
}

const elementsWith = (selector: string, attr: string, key: string): Element[] =>
  Array.from(document.head.querySelectorAll(selector)).filter((e) => e.getAttribute(attr) === key);

/** Valor de cada una de las 12 metas gestionadas; null si falta y «<<n elementos>>» si está repetida. */
function readHead(): Values {
  const one = (els: Element[], read: (el: Element) => string | null): string | null =>
    els.length === 0 ? null : els.length > 1 ? `<<${els.length} elementos>>` : read(els[0]);
  const out = {} as Values;
  out.title = one(Array.from(document.head.querySelectorAll("title")), (e) => e.textContent);
  out.description = one(elementsWith("meta", "name", "description"), (e) => e.getAttribute("content"));
  out.canonical = one(Array.from(document.head.querySelectorAll('link[rel="canonical"]')), (e) =>
    e.getAttribute("href"),
  );
  for (const [attr, key] of EXTRA_PAIRS) {
    out[key] = one(elementsWith("meta", attr, key), (e) => e.getAttribute("content"));
  }
  return out;
}

/** El head sin ninguna de las 12 metas. */
const NONE = Object.fromEntries(LABELS.map((l) => [l, null])) as Values;

/** Los 12 valores que debe tener el head tras aplicar `meta`. */
function valuesOf(meta: PageMeta): Values {
  const out: Values = { ...NONE };
  out.title = meta.title;
  out.description = meta.description;
  out.canonical = meta.canonical;
  for (const [, key, content] of meta.extra ?? []) out[key as Label] = content;
  return out;
}

/** El contenido de una meta de `extra` por clave (para no depender de su posición en el arreglo). */
const extraOf = (meta: PageMeta, key: string): string => meta.extra!.find(([, k]) => k === key)![2];

/** PageMeta de juguete con los 12 valores distintos entre sí y entre prefijos. */
function make(prefix: string): PageMeta {
  return {
    title: `${prefix} title`,
    description: `${prefix} description`,
    canonical: `https://example.test/${prefix}`,
    extra: [
      ["property", "og:title", `${prefix} og:title`],
      ["property", "og:description", `${prefix} og:description`],
      ["property", "og:url", `https://example.test/${prefix}/og`],
      ["property", "og:image", `https://example.test/${prefix}.png`],
      ["property", "og:image:alt", `${prefix} og:image:alt`],
      ["name", "twitter:title", `${prefix} twitter:title`],
      ["name", "twitter:description", `${prefix} twitter:description`],
      ["name", "twitter:image", `https://example.test/${prefix}-tw.png`],
      ["name", "twitter:image:alt", `${prefix} twitter:image:alt`],
    ],
  };
}

const HOME = make("home");
const PAGE = make("page");
const OTHER = make("other");

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value as Record<string, unknown>)) deepFreeze(inner);
  }
  return value;
}

/** Mismos nodos, en el mismo orden (identidad, no igualdad estructural). */
function expectSameNodes(actual: Element[], expected: Element[]): void {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((node, i) => expect(node).toBe(expected[i]));
}

const children = (): Element[] => Array.from(document.head.children);

beforeEach(() => {
  setHead("");
});

afterEach(() => {
  cleanupRender();
  vi.unstubAllGlobals();
  setHead("");
});

// ---------------------------------------------------------------------------
// applyPageMeta
// ---------------------------------------------------------------------------

/** Heads de partida: lo que encuentra la página al montarse según cómo se haya entrado al sitio. */
const START_HEADS: ReadonlyArray<readonly [string, string]> = [
  ["todos los elementos existen (home de index.html, con keywords)", headHtml(valuesOf(HOME), { keywords: true })],
  ["ningún elemento gestionado existe", headHtml({})],
  [
    "solo existen title, canonical y og:title",
    headHtml({ title: "viejo", canonical: "https://example.test/viejo", "og:title": "viejo og" }),
  ],
];

describe("applyPageMeta · ida y vuelta sobre distintos heads de partida", () => {
  describe.each(START_HEADS)("head de partida: %s", (_name, html) => {
    beforeEach(() => setHead(html));

    it("aplica los 12 valores y, al limpiar, deja el head exactamente como estaba", () => {
      const before = document.head.innerHTML;
      const nodesBefore = children();

      const cleanup = applyPageMeta(PAGE);
      expect(readHead()).toEqual(valuesOf(PAGE));
      cleanup();

      expect(document.head.innerHTML).toBe(before);
      // Los nodos que ya estaban son los mismos: nada se reemplazó ni se eliminó.
      expectSameNodes(children(), nodesBefore);
    });

    it("StrictMode (aplicar, limpiar, aplicar, limpiar) termina igual que al empezar", () => {
      const before = document.head.innerHTML;

      const first = applyPageMeta(PAGE);
      first();
      expect(document.head.innerHTML).toBe(before);
      const second = applyPageMeta(PAGE);
      expect(readHead()).toEqual(valuesOf(PAGE));
      second();

      expect(document.head.innerHTML).toBe(before);
    });

    it("llamadas anidadas, limpiadas en orden inverso, vuelven paso a paso", () => {
      const initial = document.head.innerHTML;

      const outer = applyPageMeta(PAGE);
      const afterOuter = document.head.innerHTML;
      const inner = applyPageMeta(OTHER);
      expect(readHead()).toEqual(valuesOf(OTHER));

      inner();
      expect(readHead()).toEqual(valuesOf(PAGE));
      expect(document.head.innerHTML).toBe(afterOuter);

      outer();
      expect(document.head.innerHTML).toBe(initial);
    });

    it("limpiar dos veces no hace nada la segunda vez (no pisa lo que cambió en medio)", () => {
      const cleanup = applyPageMeta(PAGE);
      cleanup();
      const afterFirst = document.head.innerHTML;

      // Alguien más toca el head entre la primera y la segunda limpieza.
      document.title = "cambio ajeno";
      let description = document.querySelector('meta[name="description"]');
      if (!description) {
        description = document.createElement("meta");
        description.setAttribute("name", "description");
        document.head.appendChild(description);
      }
      description.setAttribute("content", "descripción ajena");
      const afterTouch = document.head.innerHTML;
      expect(afterTouch).not.toBe(afterFirst);

      cleanup();
      cleanup();

      expect(document.head.innerHTML).toBe(afterTouch);
    });
  });
});

describe("applyPageMeta · elementos que ya existen", () => {
  beforeEach(() => setHead(headHtml(valuesOf(HOME), { keywords: true })));

  it("no elimina el canonical ni la description de la página anterior (bug original de las páginas legales)", () => {
    const canonical = document.querySelector('link[rel="canonical"]')!;
    const description = document.querySelector('meta[name="description"]')!;
    const title = document.head.querySelector("title")!;

    const cleanup = applyPageMeta({ title: "t", description: "d", canonical: "https://example.test/c" });
    expect(canonical).toHaveAttribute("href", "https://example.test/c");
    expect(description).toHaveAttribute("content", "d");
    cleanup();

    expect(document.head.contains(canonical)).toBe(true);
    expect(document.head.contains(description)).toBe(true);
    expect(document.head.contains(title)).toBe(true);
    expect(canonical).toHaveAttribute("href", HOME.canonical);
    expect(description).toHaveAttribute("content", HOME.description);
    expect(document.title).toBe(HOME.title);
  });

  it("solo toca lo que gestiona: keywords, og:site_name, twitter:card, JSON-LD y demás quedan igual", () => {
    const untouched = ['meta[name="keywords"]', 'meta[property="og:site_name"]', 'meta[property="og:type"]', 'meta[name="twitter:card"]', 'script[type="application/ld+json"]'];
    const snapshots = untouched.map((s) => document.head.querySelector(s)!.outerHTML);

    const cleanup = applyPageMeta(PAGE);
    expect(untouched.map((s) => document.head.querySelector(s)!.outerHTML)).toEqual(snapshots);
    cleanup();
    expect(untouched.map((s) => document.head.querySelector(s)!.outerHTML)).toEqual(snapshots);
  });

  it("si extra no se pasa, solo gestiona title, description y canonical", () => {
    const cleanup = applyPageMeta({ title: "t", description: "d", canonical: "https://example.test/c" });
    const read = readHead();
    expect(read.title).toBe("t");
    expect(read.description).toBe("d");
    expect(read.canonical).toBe("https://example.test/c");
    expect(read["og:title"]).toBe(extraOf(HOME, "og:title")); // sin extra, Open Graph no se toca
    cleanup();
    expect(readHead()).toEqual(valuesOf(HOME));
  });

  it("un elemento sin el atributo content (o href) queda sin él al limpiar, no con un valor vacío", () => {
    setHead(
      '<title>x</title><meta name="description"><link rel="canonical"><meta property="og:title">',
    );
    const description = document.querySelector('meta[name="description"]')!;
    const canonical = document.querySelector('link[rel="canonical"]')!;
    const ogTitle = document.querySelector('meta[property="og:title"]')!;

    const cleanup = applyPageMeta({ ...PAGE, extra: [["property", "og:title", "nuevo"]] });
    expect(description).toHaveAttribute("content", PAGE.description);
    expect(canonical).toHaveAttribute("href", PAGE.canonical);
    expect(ogTitle).toHaveAttribute("content", "nuevo");
    cleanup();

    expect(description.hasAttribute("content")).toBe(false);
    expect(canonical.hasAttribute("href")).toBe(false);
    expect(ogTitle.hasAttribute("content")).toBe(false);
  });
});

describe("applyPageMeta · elementos que no existían", () => {
  beforeEach(() => setHead(headHtml({}, { keywords: true })));

  it("crea los 12, detrás de lo que ya había, y al limpiar los elimina, <title> incluido", () => {
    expect(document.head.querySelector("title")).toBeNull();
    const before = document.head.innerHTML;
    const original = children();

    const cleanup = applyPageMeta(PAGE);
    expect(readHead()).toEqual(valuesOf(PAGE));
    expect(document.head.children).toHaveLength(original.length + 12);
    expectSameNodes(children().slice(0, original.length), original);
    expect(document.head.querySelector("title")).not.toBeNull();
    // Cada elemento creado lleva el atributo correcto y vive en el <head>, no en el <body>.
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute("href", PAGE.canonical);
    expect(document.body.querySelector("title, meta, link")).toBeNull();
    cleanup();

    expect(document.head.querySelector("title")).toBeNull();
    expect(document.head.innerHTML).toBe(before);
    expect(readHead()).toEqual(NONE);
  });

  it("mezcla: lo que existía se restaura y lo que creó la llamada se elimina", () => {
    setHead(headHtml({ title: "viejo", "og:title": "viejo og", "twitter:image": "https://example.test/viejo.png" }));
    const before = document.head.innerHTML;

    const cleanup = applyPageMeta(PAGE);
    expect(readHead()).toEqual(valuesOf(PAGE));
    cleanup();

    expect(document.head.innerHTML).toBe(before);
    const read = readHead();
    expect(read.title).toBe("viejo");
    expect(read["og:title"]).toBe("viejo og");
    expect(read.description).toBeNull();
    expect(read.canonical).toBeNull();
  });

  it("crea cada meta con el atributo que le toca (property u name) y el elemento canonical como <link>", () => {
    const cleanup = applyPageMeta(PAGE);
    expect(document.head.querySelector('meta[property="og:title"]')).toHaveAttribute("content", "page og:title");
    expect(document.head.querySelector('meta[name="twitter:title"]')).toHaveAttribute("content", "page twitter:title");
    expect(document.head.querySelector('meta[name="og:title"]')).toBeNull();
    expect(document.head.querySelector('meta[property="twitter:title"]')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')?.tagName).toBe("LINK");
    cleanup();
  });

  it("anidadas: la interior ve lo que creó la exterior como existente y no lo elimina al limpiar", () => {
    const initial = document.head.innerHTML;
    const outer = applyPageMeta(PAGE);
    const inner = applyPageMeta(OTHER);
    expect(readHead()).toEqual(valuesOf(OTHER));
    inner();
    expect(readHead()).toEqual(valuesOf(PAGE));
    outer();
    expect(document.head.innerHTML).toBe(initial);
  });
});

describe("applyPageMeta · extra con claves repetidas", () => {
  const repeated: PageMeta = {
    title: "t",
    description: "d",
    canonical: "https://example.test/c",
    extra: [
      ["property", "og:title", "primero"],
      ["property", "og:title", "segundo"],
    ],
  };

  it("sobre un elemento existente: gana el último, hay uno solo y al limpiar vuelve al valor original", () => {
    setHead(headHtml(valuesOf(HOME)));
    const before = document.head.innerHTML;

    const cleanup = applyPageMeta(repeated);
    expect(elementsWith("meta", "property", "og:title")).toHaveLength(1);
    expect(readHead()["og:title"]).toBe("segundo");
    cleanup();

    expect(document.head.innerHTML).toBe(before);
    expect(readHead()["og:title"]).toBe(extraOf(HOME, "og:title"));
  });

  it("sobre un elemento ausente: se crea una sola vez, gana el último y al limpiar desaparece", () => {
    setHead(headHtml({}));
    const before = document.head.innerHTML;

    const cleanup = applyPageMeta(repeated);
    expect(elementsWith("meta", "property", "og:title")).toHaveLength(1);
    expect(readHead()["og:title"]).toBe("segundo");
    cleanup();

    expect(document.head.innerHTML).toBe(before);
  });

  it("la misma clave con atributos distintos son elementos distintos y no se confunden", () => {
    setHead('<meta name="og:title" content="por name"><meta property="og:title" content="por property">');
    const before = document.head.innerHTML;

    const cleanup = applyPageMeta({
      ...PAGE,
      extra: [
        ["property", "og:title", "nuevo property"],
        ["name", "og:title", "nuevo name"],
      ],
    });
    expect(elementsWith("meta", "property", "og:title")[0]).toHaveAttribute("content", "nuevo property");
    expect(elementsWith("meta", "name", "og:title")[0]).toHaveAttribute("content", "nuevo name");
    cleanup();

    expect(document.head.innerHTML).toBe(before);
  });

  it("con un [atributo, clave] que solo existe con el otro atributo, crea el suyo y deja el ajeno quieto", () => {
    setHead('<meta name="og:title" content="ajena">');
    const cleanup = applyPageMeta({ ...PAGE, extra: [["property", "og:title", "mía"]] });
    expect(elementsWith("meta", "name", "og:title")[0]).toHaveAttribute("content", "ajena");
    expect(elementsWith("meta", "property", "og:title")[0]).toHaveAttribute("content", "mía");
    cleanup();
    expect(document.head.innerHTML).toBe('<meta name="og:title" content="ajena">');
  });

  it("una clave con comillas o corchetes no rompe ni inyecta (no se arma ningún selector con ella)", () => {
    const key = 'x"] , body [y="';
    let cleanup: () => void = () => undefined;
    expect(() => {
      cleanup = applyPageMeta({ ...PAGE, extra: [["name", key, "v"]] });
    }).not.toThrow();
    expect(elementsWith("meta", "name", key)).toHaveLength(1);
    expect(elementsWith("meta", "name", key)[0]).toHaveAttribute("content", "v");
    cleanup();
    expect(elementsWith("meta", "name", key)).toHaveLength(0);
  });
});

describe("applyPageMeta · sin document", () => {
  it("devuelve una función vacía: ni lanza al aplicar ni al limpiar (SSR)", () => {
    let cleanup: (() => void) | undefined;
    vi.stubGlobal("document", undefined);
    try {
      expect(typeof document).toBe("undefined");
      expect(() => {
        cleanup = applyPageMeta(PAGE);
        cleanup();
        cleanup();
        applyPageMeta(PAGE, { restoreTo: HOME })();
      }).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
    expect(typeof cleanup).toBe("function");
  });

  it("con document pero sin <head> tampoco hace nada ni lanza", () => {
    const head = document.head;
    head.remove();
    try {
      expect(document.head).toBeNull();
      expect(() => applyPageMeta(PAGE)()).not.toThrow();
      expect(() => applyPageMeta(PAGE, { restoreTo: HOME })()).not.toThrow();
    } finally {
      document.documentElement.prepend(head);
    }
    expect(document.head).toBe(head);
    expect(head.children).toHaveLength(0);
  });
});

describe("applyPageMeta · no modifica lo que recibe", () => {
  it("acepta meta y restoreTo congelados (si los mutara, el modo estricto lanzaría)", () => {
    setHead(headHtml(valuesOf(PAGE)));
    const meta = deepFreeze(make("page"));
    const restoreTo = deepFreeze(make("home"));
    expect(() => applyPageMeta(meta, { restoreTo })()).not.toThrow();
    expect(readHead()).toEqual(valuesOf(HOME));
  });
});

// ---------------------------------------------------------------------------
// applyPageMeta · restoreTo
// ---------------------------------------------------------------------------

describe("applyPageMeta · opción restoreTo", () => {
  /** Entrada directa a /paginas-web: el head estático ya trae las metas de la landing (y no trae keywords). */
  const DIRECT_ENTRY = headHtml(valuesOf(PAGE));
  /** Navegación dentro del SPA desde la home: el head trae las de la home. */
  const SPA_ENTRY = headHtml(valuesOf(HOME), { keywords: true });

  it("entrada directa: al limpiar, los 12 valores son los de restoreTo y no los que había al aplicar", () => {
    setHead(DIRECT_ENTRY);

    const cleanup = applyPageMeta(PAGE, { restoreTo: HOME });
    expect(readHead()).toEqual(valuesOf(PAGE));
    cleanup();

    expect(readHead()).toEqual(valuesOf(HOME));
    // Y el resto del head (incluido lo que restoreTo no menciona) sigue idéntico: el head es el de la home.
    expect(document.head.innerHTML).toBe(serialized(headHtml(valuesOf(HOME))));
  });

  it("sin restoreTo, la misma entrada directa se queda con los valores de la landing", () => {
    setHead(DIRECT_ENTRY);
    applyPageMeta(PAGE)();
    expect(readHead()).toEqual(valuesOf(PAGE));
  });

  it("desde la home por el SPA: aplicar y limpiar deja el head byte a byte igual", () => {
    setHead(SPA_ENTRY);
    const before = document.head.innerHTML;
    applyPageMeta(PAGE, { restoreTo: HOME })();
    expect(document.head.innerHTML).toBe(before);
  });

  it("cada elemento se restaura a restoreTo aunque el estado previo sea otro distinto (mezcla)", () => {
    setHead(headHtml({ ...valuesOf(OTHER), title: null, "twitter:image": null }));

    const cleanup = applyPageMeta(PAGE, { restoreTo: HOME });
    cleanup();

    expect(readHead()).toEqual(valuesOf(HOME));
  });

  it("StrictMode: tras el primer limpiar queda la home y tras el segundo aplicar vuelve la landing; al final, la home", () => {
    setHead(DIRECT_ENTRY);

    const first = applyPageMeta(PAGE, { restoreTo: HOME });
    first();
    expect(readHead()).toEqual(valuesOf(HOME));
    const second = applyPageMeta(PAGE, { restoreTo: HOME });
    expect(readHead()).toEqual(valuesOf(PAGE));
    second();

    expect(readHead()).toEqual(valuesOf(HOME));
    expect(document.head.innerHTML).toBe(serialized(headHtml(valuesOf(HOME))));
  });

  it("doble limpieza: la segunda no pisa lo que cambió después de la primera", () => {
    setHead(DIRECT_ENTRY);
    const cleanup = applyPageMeta(PAGE, { restoreTo: HOME });
    cleanup();
    document.title = "cambio ajeno";
    document.querySelector('link[rel="canonical"]')!.setAttribute("href", "https://example.test/ajeno");

    cleanup();

    expect(document.title).toBe("cambio ajeno");
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", "https://example.test/ajeno");
  });

  describe("elementos que faltan en el documento", () => {
    beforeEach(() => setHead(headHtml({})));

    it("se crean al aplicar y, con restoreTo, QUEDAN al limpiar con el valor de restoreTo (title incluido)", () => {
      const cleanup = applyPageMeta(PAGE, { restoreTo: HOME });
      expect(readHead()).toEqual(valuesOf(PAGE));
      cleanup();

      expect(readHead()).toEqual(valuesOf(HOME));
      expect(document.head.querySelectorAll("title")).toHaveLength(1);
      expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    });

    it("StrictMode no duplica ningún elemento", () => {
      applyPageMeta(PAGE, { restoreTo: HOME })();
      const second = applyPageMeta(PAGE, { restoreTo: HOME });
      second();
      expect(readHead()).toEqual(valuesOf(HOME));
      // charset + og:site_name + og:type + og:image:type + og:locale + twitter:card + JSON-LD = 7 estáticos.
      expect(document.head.children).toHaveLength(7 + 12);
    });

    it("sin restoreTo, esos mismos elementos se eliminan al limpiar (comportamiento de siempre)", () => {
      const before = document.head.innerHTML;
      applyPageMeta(PAGE)();
      expect(document.head.innerHTML).toBe(before);
    });
  });

  it("un elemento que alguien quitó entre aplicar y limpiar se vuelve a crear con el valor de restoreTo", () => {
    setHead(DIRECT_ENTRY);
    const cleanup = applyPageMeta(PAGE, { restoreTo: HOME });
    document.querySelector('meta[property="og:image"]')!.remove();
    document.querySelector('link[rel="canonical"]')!.remove();
    document.head.querySelector("title")!.remove();

    cleanup();

    expect(readHead()).toEqual(valuesOf(HOME));
  });

  describe("cobertura parcial: lo que restoreTo no cubre vuelve a su estado previo", () => {
    it("restoreTo sin description ni la mayoría de extra: esos elementos existentes vuelven a lo que tenían", () => {
      setHead(DIRECT_ENTRY);
      const partial: PageMeta = {
        title: HOME.title,
        description: undefined as unknown as string,
        canonical: HOME.canonical,
        extra: [["property", "og:title", extraOf(HOME, "og:title")]],
      };

      applyPageMeta(PAGE, { restoreTo: partial })();

      const read = readHead();
      expect(read.title).toBe(HOME.title);
      expect(read.canonical).toBe(HOME.canonical);
      expect(read["og:title"]).toBe(extraOf(HOME, "og:title"));
      // No cubiertos: vuelven al estado de la landing (el previo), no a la home.
      expect(read.description).toBe(PAGE.description);
      expect(read["og:description"]).toBe(extraOf(PAGE, "og:description"));
      expect(read["twitter:title"]).toBe(extraOf(PAGE, "twitter:title"));
      expect(read["twitter:image:alt"]).toBe(extraOf(PAGE, "twitter:image:alt"));
    });

    it("los no cubiertos que creó la llamada se eliminan, y los cubiertos se quedan", () => {
      setHead(headHtml({ title: "viejo" }));
      const partial: PageMeta = {
        title: HOME.title,
        description: undefined as unknown as string,
        canonical: HOME.canonical,
        extra: [["property", "og:title", extraOf(HOME, "og:title")]],
      };

      applyPageMeta(PAGE, { restoreTo: partial })();

      const read = readHead();
      expect(read.title).toBe(HOME.title);
      expect(read.canonical).toBe(HOME.canonical);
      expect(read["og:title"]).toBe(extraOf(HOME, "og:title"));
      expect(read.description).toBeNull();
      for (const label of LABELS.filter((l) => !["title", "canonical", "og:title"].includes(l))) {
        expect(read[label]).toBeNull();
      }
    });

    it("un valor que no es texto (undefined, null, número, objeto) cuenta como no cubierto", () => {
      setHead(DIRECT_ENTRY);
      const weird = {
        title: undefined,
        description: null,
        canonical: 42,
        extra: [
          ["property", "og:title", undefined],
          ["property", "og:description", 123],
          ["property", "og:url", {}],
          ["name", "twitter:title", null],
        ],
      } as unknown as PageMeta;

      expect(() => applyPageMeta(PAGE, { restoreTo: weird })()).not.toThrow();

      // Nada de eso cubre: todo vuelve a lo que había (la landing), sin «undefined» ni «42» en el head.
      expect(readHead()).toEqual(valuesOf(PAGE));
    });

    it("la pareja [atributo, clave] cuenta: [name, og:title] no cubre [property, og:title]", () => {
      setHead(DIRECT_ENTRY);
      const crossed: PageMeta = {
        ...HOME,
        extra: [
          ["name", "og:title", "NO DEBE USARSE"],
          ...HOME.extra!.filter(([, key]) => key !== "og:title"),
        ],
      };

      applyPageMeta(PAGE, { restoreTo: crossed })();

      expect(readHead()["og:title"]).toBe(extraOf(PAGE, "og:title"));
      expect(document.head.innerHTML).not.toContain("NO DEBE USARSE");
    });

    it("si restoreTo repite la pareja, gana la última", () => {
      setHead(DIRECT_ENTRY);
      applyPageMeta(PAGE, {
        restoreTo: {
          ...HOME,
          extra: [
            ["property", "og:title", "primero"],
            ["property", "og:title", "último"],
          ],
        },
      })();
      expect(readHead()["og:title"]).toBe("último");
    });

    it("lo que solo está en restoreTo y meta no gestiona no se toca ni se crea", () => {
      setHead(DIRECT_ENTRY);
      const siteName = () => elementsWith("meta", "property", "og:site_name")[0].getAttribute("content");
      const before = siteName();

      applyPageMeta(PAGE, {
        restoreTo: {
          ...HOME,
          extra: [...HOME.extra!, ["property", "og:site_name", "OTRO"], ["name", "robots", "noindex"]],
        },
      })();

      expect(siteName()).toBe(before);
      expect(elementsWith("meta", "name", "robots")).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// routeMetaToPageMeta
// ---------------------------------------------------------------------------

describe("routeMetaToPageMeta", () => {
  /** Ocho campos con valores distintos entre sí: una pareja cruzada saldría con el valor equivocado. */
  const SYN: RouteMeta = {
    title: "T",
    description: "D",
    canonical: "C",
    ogTitle: "OT",
    ogDescription: "OD",
    ogUrl: "OU",
    ogImage: "OI",
    ogImageAlt: "OA",
  };

  const byPair = (meta: PageMeta) =>
    Object.fromEntries((meta.extra ?? []).map(([attr, key, content]) => [`${attr}|${key}`, content]));

  it("title, description y canonical pasan tal cual", () => {
    const meta = routeMetaToPageMeta(SYN);
    expect(meta.title).toBe("T");
    expect(meta.description).toBe("D");
    expect(meta.canonical).toBe("C");
  });

  it("extra lleva exactamente las nueve metas de Open Graph y Twitter, cada una con su atributo y su campo", () => {
    const meta = routeMetaToPageMeta(SYN);
    expect(meta.extra).toHaveLength(9);
    expect(byPair(meta)).toEqual({
      "property|og:title": "OT",
      "property|og:description": "OD",
      "property|og:url": "OU",
      "property|og:image": "OI",
      "property|og:image:alt": "OA",
      "name|twitter:title": "OT",
      "name|twitter:description": "OD",
      "name|twitter:image": "OI",
      "name|twitter:image:alt": "OA",
    });
  });

  it("og:url sale de ogUrl (no del canonical) y no hay twitter:url", () => {
    const pairs = byPair(routeMetaToPageMeta({ ...SYN, canonical: "CANON", ogUrl: "OGURL" }));
    expect(pairs["property|og:url"]).toBe("OGURL");
    expect(Object.keys(pairs).some((k) => k.includes("twitter:url"))).toBe(false);
  });

  it.each([
    ["la home (HOME_META)", HOME_META],
    ["/paginas-web (ROUTE_META)", ROUTE_META["/paginas-web"]],
  ])("con los valores reales de %s, los 12 coinciden con sus campos", (_name, route) => {
    const meta = routeMetaToPageMeta(route);
    const pairs = byPair(meta);
    expect(meta.title).toBe(route.title);
    expect(meta.description).toBe(route.description);
    expect(meta.canonical).toBe(route.canonical);
    expect(pairs["property|og:title"]).toBe(route.ogTitle);
    expect(pairs["property|og:description"]).toBe(route.ogDescription);
    expect(pairs["property|og:url"]).toBe(route.ogUrl);
    expect(pairs["property|og:image"]).toBe(route.ogImage);
    expect(pairs["property|og:image:alt"]).toBe(route.ogImageAlt);
    expect(pairs["name|twitter:title"]).toBe(route.ogTitle);
    expect(pairs["name|twitter:description"]).toBe(route.ogDescription);
    expect(pairs["name|twitter:image"]).toBe(route.ogImage);
    expect(pairs["name|twitter:image:alt"]).toBe(route.ogImageAlt);
  });

  it("aplicado a un head, deja en el documento los 12 valores del RouteMeta", () => {
    setHead(headHtml({}));
    const cleanup = applyPageMeta(routeMetaToPageMeta(SYN));
    expect(readHead()).toEqual({
      title: "T",
      description: "D",
      canonical: "C",
      "og:title": "OT",
      "og:description": "OD",
      "og:url": "OU",
      "og:image": "OI",
      "og:image:alt": "OA",
      "twitter:title": "OT",
      "twitter:description": "OD",
      "twitter:image": "OI",
      "twitter:image:alt": "OA",
    });
    cleanup();
  });
});

// ---------------------------------------------------------------------------
// Regresión: las páginas legales no deben borrar el canonical ni la description de index.html
// ---------------------------------------------------------------------------

describe("páginas legales · applyPageMeta al montar y desmontar", () => {
  /** El head de partida: las metas reales de la home (HOME_META) con la forma de index.html. */
  const HOME_VALUES = valuesOf(routeMetaToPageMeta(HOME_META));
  const START = headHtml(HOME_VALUES, { keywords: true });

  const LEGAL = [
    {
      name: "PoliticaDePrivacidad",
      Page: PoliticaDePrivacidad,
      path: "/politica-de-privacidad",
      titleHas: "Política de Privacidad",
      canonical: "https://www.multistacksystems.com/politica-de-privacidad",
      descriptionHas: /datos personales/i,
    },
    {
      name: "TerminosDelServicio",
      Page: TerminosDelServicio,
      path: "/terminos-del-servicio",
      titleHas: "Términos del Servicio",
      canonical: "https://www.multistacksystems.com/terminos-del-servicio",
      descriptionHas: /t[eé]rminos y condiciones/i,
    },
  ];

  const mount = (Page: () => JSX.Element, path: string, strict: boolean) => {
    const tree = createElement(MemoryRouter, { initialEntries: [path] }, createElement(Page));
    return render(strict ? createElement(StrictMode, null, tree) : tree);
  };

  describe.each(LEGAL)("$name", ({ Page, path, titleHas, canonical, descriptionHas }) => {
    describe.each([
      ["normal", false],
      ["StrictMode", true],
    ] as const)("en modo %s", (_mode, strict) => {
      it("mientras está montada, title, description y canonical son los suyos y og:* siguen siendo los de la home", () => {
        setHead(START);
        mount(Page, path, strict);

        const read = readHead();
        expect(read.title).toContain(titleHas);
        expect(read.title).not.toBe(HOME_VALUES.title);
        expect(read.description).toMatch(descriptionHas);
        expect(read.description).not.toBe(HOME_VALUES.description);
        expect(read.canonical).toBe(canonical);
        // La página legal no gestiona Open Graph: lo de la home no se toca.
        for (const label of LABELS.filter((l) => l.startsWith("og:") || l.startsWith("twitter:"))) {
          expect(read[label]).toBe(HOME_VALUES[label]);
        }
      });

      it("al desmontar, el canonical y la description de partida siguen en el documento con su valor y el título se restaura", () => {
        setHead(START);
        const canonicalNode = document.querySelector('link[rel="canonical"]')!;
        const descriptionNode = document.querySelector('meta[name="description"]')!;
        const before = document.head.innerHTML;

        const { unmount } = mount(Page, path, strict);
        unmount();

        expect(document.head.contains(canonicalNode)).toBe(true);
        expect(document.head.contains(descriptionNode)).toBe(true);
        expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", HOME_VALUES.canonical!);
        expect(document.querySelector('meta[name="description"]')).toHaveAttribute("content", HOME_VALUES.description!);
        expect(document.title).toBe(HOME_VALUES.title);
        expect(document.head.innerHTML).toBe(before);
      });

      it("sobre un head sin esas etiquetas, al desmontar no deja ninguna de las que creó", () => {
        setHead(headHtml({}));
        const before = document.head.innerHTML;

        const { unmount } = mount(Page, path, strict);
        expect(readHead().canonical).toBe(canonical);
        unmount();

        expect(document.head.innerHTML).toBe(before);
        expect(document.head.querySelector("title")).toBeNull();
      });
    });
  });

  it("visitar las dos páginas legales una tras otra y volver deja el head de la home intacto", () => {
    setHead(START);
    const before = document.head.innerHTML;

    mount(PoliticaDePrivacidad, "/politica-de-privacidad", true).unmount();
    mount(TerminosDelServicio, "/terminos-del-servicio", true).unmount();

    expect(document.head.innerHTML).toBe(before);
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute("href", HOME_VALUES.canonical!);
  });
});
