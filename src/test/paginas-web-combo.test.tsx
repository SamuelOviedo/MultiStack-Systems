import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Barra y pie fuera: traen auth, tickets y temas que estas pruebas no necesitan.
vi.mock("@/components/common/Navbar", async () => {
  const { createElement } = await import("react");
  return { default: () => createElement("nav", { "data-testid": "navbar-stub" }) };
});
vi.mock("@/components/common/Footer", async () => {
  const { createElement } = await import("react");
  return { default: () => createElement("footer", { "data-testid": "footer-stub" }) };
});
vi.mock("@/lib/contact", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/contact")>();
  return { ...actual, sendContactMessage: vi.fn() };
});
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackContactConversion: vi.fn(),
}));

import PwCombo from "@/components/marketing/paginas-web/PwCombo";
import PaginasWeb from "@/pages/marketing/PaginasWeb";
import { PACKAGE_INTENT_KEY, readPackageIntent } from "@/lib/packageIntent";
import { PACKAGES, lempiras } from "@/lib/webPackages";
import {
  COMMITMENTS,
  PACKAGES as CONTENT_PACKAGES,
  PAGINAS_WEB_CONTENT,
  SECTION_IDS,
  buildPaginasWebContent,
} from "@/pages/marketing/paginasWebContent";

const COMBO = PACKAGES.find((pkg) => pkg.id === "combo-emprendedor")!;
const STANDARD = PACKAGES.find((pkg) => pkg.id === "estandar")!;
const COMBO_HREF = "/solicitudes?paquete=combo-emprendedor";
const STANDARD_HREF = "/solicitudes?paquete=estandar";

/** Dónde está el router: sirve para ver a qué ruta navegó un clic. */
const LocationProbe = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="where">{`${pathname}${search}`}</p>;
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/paginas-web"]}>
      <Routes>
        <Route path="/paginas-web" element={<PaginasWeb />} />
        <Route path="/solicitudes" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const combo = () => document.getElementById(SECTION_IDS.combo) as HTMLElement;
const price = () => document.getElementById("precio") as HTMLElement;
const card = (id: string) => price().querySelector<HTMLElement>(`article[data-package="${id}"]`)!;

/** Texto que ve una persona: sin lo decorativo (aria-hidden). */
function visibleText(root: Element): string {
  const copy = root.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((el) => el.remove());
  return (copy.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Los enlaces con ese nombre accesible dentro de `root`. */
const linkIn = (root: HTMLElement, name: string | RegExp) => within(root).getByRole("link", { name });

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  document.head.innerHTML = "";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("/paginas-web · Combo Emprendedor · datos compartidos", () => {
  it("paginasWebContent reexporta los mismos PACKAGES de src/lib/webPackages", () => {
    expect(CONTENT_PACKAGES).toBe(PACKAGES);
  });

  it("los precios y los textos no cambiaron en el traslado", () => {
    expect(PACKAGES.map((pkg) => [pkg.id, pkg.name, pkg.priceLempiras, pkg.summary])).toEqual([
      ["estandar", "Plan Estándar", 3500, "Tú aportas tu logo."],
      ["combo-emprendedor", "Combo Emprendedor", 3950, "Incluye el diseño de tu logo."],
    ]);
    expect(lempiras(3950)).toBe("L 3,950");
  });
});

describe("/paginas-web · Combo Emprendedor · sección", () => {
  it("es la segunda sección, justo después del hero y antes de «Qué incluye», con el ancla combo-emprendedor", () => {
    renderPage();

    expect(SECTION_IDS.combo).toBe("combo-emprendedor");
    const ids = Array.from(document.querySelectorAll("main > section")).map((s) => s.id);
    expect(ids.slice(0, 3)).toEqual(["inicio", "combo-emprendedor", "que-incluye"]);
  });

  it("es una región con nombre «Combo Emprendedor» y su encabezado es un h2", () => {
    renderPage();

    const region = screen.getByRole("region", { name: "Combo Emprendedor" });
    expect(region).toBe(combo());
    expect(within(region).getByRole("heading", { level: 2, name: "Combo Emprendedor" })).toBeInTheDocument();
  });

  it("el rótulo nombra la alianza: «LAU Graphic × MultiStack Systems»", () => {
    renderPage();

    expect(visibleText(combo())).toContain("LAU Graphic × MultiStack Systems");
  });

  it("el subtítulo dice «Tu identidad de marca y presencia digital por L 3,950.» y un lector oye «3950 lempiras»", () => {
    renderPage();

    const lead = combo().querySelector<HTMLElement>(".ms-pw-lead")!;
    expect(within(lead).getByText("Tu identidad de marca y presencia digital por L 3,950.")).toHaveAttribute("aria-hidden", "true");
    expect(visibleText(lead)).toBe("Tu identidad de marca y presencia digital por 3950 lempiras.");
  });

  it("la columna «Logo profesional» dice «Lo diseña LAU Graphic» y lista los 7 entregables del paquete", () => {
    renderPage();

    const heading = within(combo()).getByRole("heading", { level: 3, name: "Logo profesional" });
    const column = heading.parentElement!;
    expect(within(column).getByText("Lo diseña LAU Graphic")).toBeInTheDocument();
    const items = Array.from(column.querySelectorAll("li")).map((li) => li.textContent?.trim());
    expect(items).toHaveLength(7);
    expect(items).toEqual([...COMBO.extras]);
    expect(items).toEqual([
      "Diseño de logotipo personalizado",
      "Variaciones de color del logotipo",
      "Archivos PNG, JPG y PDF",
      "Archivo editable",
      "Paleta oficial de colores",
      "Tipografías utilizadas",
      "Alta resolución para redes sociales y medios físicos",
    ]);
  });

  it("la columna «Página web» dice «La programa MultiStack Systems» y lista sus 6 entregables, con números de COMMITMENTS", () => {
    renderPage();

    const heading = within(combo()).getByRole("heading", { level: 3, name: "Página web" });
    const column = heading.parentElement!;
    expect(within(column).getByText("La programa MultiStack Systems")).toBeInTheDocument();
    expect(Array.from(column.querySelectorAll("li")).map((li) => li.textContent?.trim())).toEqual([
      "Diseño personalizado, con código propio y sin plantillas",
      `Una sola página con hasta ${COMMITMENTS.maxSections} secciones, adaptable al celular`,
      "Presentación de tu negocio, servicios y contacto",
      "Botón directo a WhatsApp y redes sociales",
      "Ubicación integrada con Google Maps",
      `Dominio y hosting incluidos durante los primeros ${COMMITMENTS.domainHostingMonths} meses`,
    ]);
  });

  it("los iconos de los entregables son decorativos (aria-hidden)", () => {
    renderPage();

    const icons = combo().querySelectorAll("li svg");
    expect(icons).toHaveLength(13);
    icons.forEach((icon) => expect(icon).toHaveAttribute("aria-hidden", "true"));
  });

  it("el precio grande es «L 3,950» (aria-hidden) con «3950 lempiras» para lectores", () => {
    renderPage();

    const amount = combo().querySelector<HTMLElement>(".ms-pw-combo__price")!;
    const [visual, spoken] = Array.from(amount.children);
    expect(amount.children).toHaveLength(2);
    expect(visual).toHaveAttribute("aria-hidden", "true");
    expect(visual).toHaveTextContent(/^L 3,950$/);
    expect(spoken.className).toBe("sr-only");
    expect(spoken).toHaveTextContent(/^3950 lempiras$/);
    expect(visibleText(amount)).toBe("3950 lempiras");
  });

  it("el precio sale de los datos: con otros precios la sección cambia y no queda el actual", () => {
    const distinct = buildPaginasWebContent(
      COMMITMENTS,
      PACKAGES.map((pkg) => ({ ...pkg, priceLempiras: pkg.id === "estandar" ? 5100 : 8800 })),
    );
    render(
      <MemoryRouter>
        <PwCombo combo={distinct.combo} />
      </MemoryRouter>,
    );

    const text = combo().textContent!;
    expect(text).toContain("L 8,800");
    expect(text).toContain("8800 lempiras");
    expect(text).toContain("Ver el Plan Estándar (L 5,100");
    expect(text).not.toMatch(/3,950|3950|3,500|3500/);
    expect(visibleText(combo())).toContain("Tu identidad de marca y presencia digital por 8800 lempiras.");
  });

  it("la nota bajo el CTA aclara que es una solicitud, no un pago ni un contrato", () => {
    renderPage();

    expect(
      within(combo()).getByText(
        "Es una solicitud, no un pago ni un contrato. Te contactamos para confirmar el paquete y los siguientes pasos.",
      ),
    ).toBeInTheDocument();
  });

  it("el contenido no afirma lo que el propietario no ha decidido (plazo, propuestas, revisiones del logo, vigencia)", () => {
    const json = JSON.stringify(PAGINAS_WEB_CONTENT.combo);
    expect(json.length).toBeGreaterThan(900); // no pasa en vacío
    expect(json).not.toMatch(
      /renov|promoci|vigencia|aliad|titular|a tu nombre|extensi[oó]n|ISV|impuesto|al año|anual|mensual|cada año|US\$|USD|propuesta|revisi[oó]n|d[ií]as/i,
    );
    renderPage();
    expect(visibleText(combo())).not.toMatch(/propuesta|revisi[oó]n|impuesto|promoci|vigencia|aliad/i);
  });
});

describe("/paginas-web · Combo Emprendedor · sin póster", () => {
  /** Todo el texto visible de la página, sin el contenido que solo leen los lectores de pantalla. */
  const pageText = () => visibleText(document.querySelector("main")!);

  it("la sección del Combo no tiene imágenes: ni <img>, ni <picture>, ni <source>, ni [role=img]", () => {
    renderPage();

    expect(combo().querySelectorAll("img, picture, source, svg[role='img'], [role='img']")).toHaveLength(0);
    expect(within(combo()).queryAllByRole("img")).toHaveLength(0);
  });

  it("la página tampoco tiene <img> ni <picture> en ninguna otra parte", () => {
    renderPage();

    expect(document.querySelectorAll("img, picture")).toHaveLength(0);
  });

  it("el contenido de /paginas-web no dice «una sola sección»: el término aprobado es «una sola página con hasta 6 secciones»", () => {
    const json = JSON.stringify(PAGINAS_WEB_CONTENT);
    expect(json.length).toBeGreaterThan(5000); // no pasa en vacío
    expect(json).not.toMatch(/unas+solas+secci[oó]n/i);
    expect(json).not.toMatch(/p[oó]ster/i);
    expect(JSON.stringify(PAGINAS_WEB_CONTENT.combo)).toContain("Una sola página con hasta 6 secciones");

    renderPage();
    expect(pageText()).not.toMatch(/unas+solas+secci[oó]n/i);
    expect(pageText()).toContain("Una sola página con hasta 6 secciones");
  });

  it("la sección escribe lo que decía la campaña: precio, quién hace qué y los entregables", () => {
    renderPage();

    const text = visibleText(combo());
    for (const needle of ["3950 lempiras", "Lo diseña LAU Graphic", "La programa MultiStack Systems", ...COMBO.extras]) {
      expect(text, needle).toContain(needle);
    }
  });

  it("no queda ningún archivo del póster en public/", async () => {
    const { existsSync } = await import("node:fs");
    const path = await import("node:path");
    expect(existsSync(path.join(process.cwd(), "public", "assets", "images", "promo"))).toBe(false);
  });
});

describe("/paginas-web · Combo Emprendedor · CTA", () => {
  it("«Solicitar Combo Emprendedor» es un enlace real a /solicitudes?paquete=combo-emprendedor", () => {
    renderPage();

    const cta = linkIn(combo(), "Solicitar Combo Emprendedor");
    expect(cta.tagName).toBe("A");
    expect(cta).toHaveAttribute("href", COMBO_HREF);
    expect(cta).not.toHaveAttribute("target");
  });

  it("al hacer clic guarda la intención (solo id y caducidad) y navega por la SPA a /solicitudes?paquete=combo-emprendedor", () => {
    renderPage();
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();

    fireEvent.click(linkIn(combo(), "Solicitar Combo Emprendedor"));

    expect(screen.getByTestId("where")).toHaveTextContent(COMBO_HREF);
    const saved = JSON.parse(window.localStorage.getItem(PACKAGE_INTENT_KEY)!) as { id: string; exp: number };
    expect(Object.keys(saved).sort()).toEqual(["exp", "id"]);
    expect(saved.id).toBe("combo-emprendedor");
    expect(saved.exp).toBeGreaterThan(Date.now());
    expect(readPackageIntent()).toBe("combo-emprendedor");
  });

  it("con clic medio (auxclick, botón 1) también guarda la intención; con el botón derecho no", () => {
    renderPage();
    const cta = linkIn(combo(), "Solicitar Combo Emprendedor");

    fireEvent(cta, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 2 }));
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();

    fireEvent(cta, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(readPackageIntent()).toBe("combo-emprendedor");
    // El clic medio abre otra pestaña: esta no navega.
    expect(screen.queryByTestId("where")).toBeNull();
  });

  it("el clic medio en la tarjeta del Estándar guarda el Estándar", () => {
    renderPage();

    fireEvent(
      within(card("estandar")).getByRole("link", { name: "Solicitar Plan Estándar" }),
      new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }),
    );

    expect(readPackageIntent()).toBe("estandar");
  });

  it("si el almacenamiento falla, el clic igual navega (el paquete viaja en la URL)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("sin almacenamiento");
    });
    renderPage();

    fireEvent.click(linkIn(combo(), "Solicitar Combo Emprendedor"));

    expect(screen.getByTestId("where")).toHaveTextContent(COMBO_HREF);
  });

  it("«Ver el Plan Estándar (L 3,500)» lleva a la tarjeta del Plan Estándar sin guardar nada", () => {
    renderPage();

    // Visible: «L 3,500». Un lector de pantalla oye «3500 lempiras».
    const link = linkIn(combo(), "Ver el Plan Estándar (3500 lempiras)");
    expect(link).toHaveAttribute("href", "#paquete-estandar");
    expect(link).not.toHaveAttribute("target");
    expect(link.textContent).toContain("Ver el Plan Estándar (L 3,500");
    expect(within(link).getByText("L 3,500")).toHaveAttribute("aria-hidden", "true");
    expect(document.getElementById("paquete-estandar")).toBe(card("estandar"));

    fireEvent.click(link);
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it("los dos CTA de la sección usan .ms-pw-btn (objetivo táctil de 48 px de alto mínimo, definido en index.css)", () => {
    renderPage();

    for (const name of ["Solicitar Combo Emprendedor", "Ver el Plan Estándar (3500 lempiras)"]) {
      expect(linkIn(combo(), name)).toHaveClass("ms-pw-btn");
    }
  });
});

describe("/paginas-web · CTA por tarjeta de paquete", () => {
  it.each([
    ["estandar", "Solicitar Plan Estándar", STANDARD_HREF],
    ["combo-emprendedor", "Solicitar Combo Emprendedor", COMBO_HREF],
  ])("la tarjeta %s lleva al fondo «%s» → %s", (id, name, href) => {
    renderPage();

    const article = card(id);
    const link = within(article).getByRole("link", { name });
    expect(link).toHaveAttribute("href", href);
    // Al fondo de la tarjeta: es lo último que contiene.
    expect(article.lastElementChild).toContainElement(link);
    expect(article.lastElementChild).toHaveClass("ms-pw-plan__cta");
  });

  it.each([
    ["estandar", "Solicitar Plan Estándar", STANDARD_HREF],
    ["combo-emprendedor", "Solicitar Combo Emprendedor", COMBO_HREF],
  ])("el CTA de %s guarda su intención y navega a /solicitudes?paquete=<id>", (id, name, href) => {
    renderPage();

    fireEvent.click(within(card(id)).getByRole("link", { name }));

    expect(screen.getByTestId("where")).toHaveTextContent(href);
    expect(readPackageIntent()).toBe(id);
    expect(JSON.parse(window.localStorage.getItem(PACKAGE_INTENT_KEY)!)).toMatchObject({ id });
  });

  it("el último clic manda: pedir el Estándar y luego el Combo deja el Combo", () => {
    renderPage();

    fireEvent.click(within(card("estandar")).getByRole("link", { name: "Solicitar Plan Estándar" }));
    cleanup();
    renderPage();
    fireEvent.click(within(card("combo-emprendedor")).getByRole("link", { name: "Solicitar Combo Emprendedor" }));

    expect(readPackageIntent()).toBe("combo-emprendedor");
  });

  it("el CTA general «Cotiza tu página web» se queda en el precio y sigue yendo a #contacto", () => {
    renderPage();

    const quote = within(price()).getByRole("link", { name: "Cotiza tu página web" });
    expect(quote).toHaveAttribute("href", "#contacto");
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
    fireEvent.click(quote);
    expect(window.localStorage.getItem(PACKAGE_INTENT_KEY)).toBeNull();
  });

  it("el Plan Estándar sigue disponible: su tarjeta, su precio L 3,500 y su CTA están en #precio", () => {
    renderPage();

    expect(within(card("estandar")).getByText(lempiras(STANDARD.priceLempiras))).toBeInTheDocument();
    expect(within(card("estandar")).getByRole("heading", { level: 3, name: "Plan Estándar" })).toBeInTheDocument();
    expect(card("estandar").querySelector("a")).toHaveAttribute("href", STANDARD_HREF);
  });

  it("los enlaces «Solicitar …» no se marcan como externos y no abren pestaña nueva", () => {
    renderPage();

    const links = screen.getAllByRole("link", { name: /^Solicitar / });
    expect(links).toHaveLength(3); // dos tarjetas y la sección del Combo
    for (const link of links) {
      expect(link.getAttribute("href")).toMatch(/^\/solicitudes\?paquete=(estandar|combo-emprendedor)$/);
      expect(link).not.toHaveAttribute("target");
      expect(link).not.toHaveAttribute("rel");
    }
  });
});

describe("/paginas-web · Combo Emprendedor · CSS (index.css)", () => {
  it("el panel y las columnas se apilan en pantallas angostas, y el CTA de la tarjeta usa margin-top: auto", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const postcss = (await import("postcss")).default;
    const css = readFileSync(path.join(process.cwd(), "src", "index.css"), "utf8");
    const root = postcss.parse(css);

    const decl = (selector: string, prop: string, media?: string): string | undefined => {
      let found: string | undefined;
      root.walkRules((rule) => {
        const parent = rule.parent as { type?: string; name?: string; params?: string } | undefined;
        const inMedia = parent?.type === "atrule" && parent.name === "media";
        if ((inMedia ? parent!.params!.replace(/\s+/g, "") : undefined) !== media) return;
        if (!rule.selectors.map((s) => s.trim()).includes(selector)) return;
        rule.walkDecls(prop, (d) => {
          found = d.value.replace(/\s+/g, " ").trim();
        });
      });
      return found;
    };

    expect(decl(".ms-pw-plan__cta", "margin-top")).toBe("auto");
    // A todo el ancho: el panel ya no es una cuadrícula de texto y póster; solo se apilan las columnas y el precio.
    expect(decl(".ms-pw-combo", "grid-template-columns")).toBeUndefined();
    expect(decl(".ms-pw-combo__cols", "grid-template-columns")).toBe("repeat(2, minmax(0, 1fr))");
    expect(decl(".ms-pw-combo__cols", "grid-template-columns", "(max-width:720px)")).toBe("minmax(0, 1fr)");
    expect(decl(".ms-pw-combo__buy", "grid-template-columns")).toBe("auto minmax(0, 1fr)");
    expect(decl(".ms-pw-combo__buy", "grid-template-columns", "(max-width:920px)")).toBe("minmax(0, 1fr)");
    expect(css).not.toMatch(/ms-pw-combo__poster/);
  });
});
