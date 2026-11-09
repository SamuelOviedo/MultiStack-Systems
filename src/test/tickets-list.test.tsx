// Lista de tickets (`/dashboard/tickets`): estructura accesible, `aria-sort`, teclado, insignias, fechas,
// búsqueda, estados de carga/vacío/error y disposición móvil. Los datos son inventados sobre dominios reservados.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const WAIT = { timeout: 8000 };
vi.setConfig({ testTimeout: 20000 });

const auth = vi.hoisted(() => ({
  session: null as unknown,
  user: null as { id: string; email: string } | null,
  userType: null as number | null,
  loading: false,
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      throw new Error("supabase.from no está simulado: cada consulta debe pasar por un mock de src/lib");
    },
  },
}));
const toastSpy = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastSpy }) }));

const libs = vi.hoisted(() => ({
  getAllTickets: vi.fn(),
  getTicketMessages: vi.fn(),
  getTeamMembers: vi.fn(),
}));
vi.mock("@/lib/tickets", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tickets")>()),
  ...libs,
}));

import TicketsGlobal from "@/pages/dashboard/TicketsGlobal";

const NOW = "2026-11-02T15:00:00.000Z";
type Over = Record<string, unknown>;
const ticket = (id: string, title: string, over: Over = {}) => ({
  id,
  project_id: "p1",
  client_name: "Cliente Demo",
  client_email: "cliente@example.test",
  type: "bug",
  priority: "media",
  status: "abierto",
  title,
  description: `Descripción de ${title}`,
  created_at: "2026-10-30T10:00:00.000Z",
  updated_at: "2026-11-01T10:00:00.000Z",
  resolved_at: null,
  assigned_to: null,
  assignee_email: null,
  nombre_proyecto: "Tienda Demo",
  message_count: 0,
  ...over,
});
const TICKETS = [
  ticket("t1", "Botón de pago roto", { priority: "alta", updated_at: "2026-11-02T14:00:00.000Z", message_count: 2 }),
  ticket("t2", "Servidor caído", { priority: "urgente", status: "en_revision", nombre_proyecto: "Portal Ejemplo", updated_at: "2026-11-02T09:00:00.000Z" }),
  ticket("t3", "Cambiar logotipo", { type: "modificacion", status: "en_progreso", assigned_to: "u-ana", assignee_email: "ana@example.test", updated_at: "2026-11-01T10:00:00.000Z", message_count: 4 }),
  ticket("t4", "Duda de factura", { type: "pago", priority: "baja", status: "resuelto", nombre_proyecto: "Portal Ejemplo", updated_at: "2026-10-20T10:00:00.000Z", created_at: "2026-10-01T10:00:00.000Z" }),
];

function signIn(userType: number | null) {
  const user = { id: userType === 1 ? "u-colab" : "u-admin", email: "persona@example.test" };
  auth.user = user;
  auth.session = { user };
  auth.userType = userType;
}
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/tickets"]}>
      <TicketsGlobal />
    </MemoryRouter>,
  );
async function cargar(userType = 0) {
  signIn(userType);
  const view = renderPage();
  await screen.findByText("Botón de pago roto", {}, WAIT);
  return view;
}
const titulosEnOrden = () => {
  const todos = TICKETS.flatMap((t) => screen.queryAllByText(t.title).filter((e) => e.closest('[role="dialog"]') === null));
  todos.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  return todos.map((e) => e.textContent);
};
const eligeEnLista = (campo: string, opcion: string) => {
  fireEvent.keyDown(screen.getByRole("combobox", { name: campo }), { key: "ArrowDown" });
  fireEvent.click(screen.getAllByRole("option").find((o) => o.textContent === opcion)!);
};
const filaDe = (titulo: string) => screen.getByText(titulo).closest("tr") as HTMLTableRowElement;

const AVISO_DESPLAZAR = "Desliza la tabla para ver más columnas";
/** Ancho mínimo de la tabla en px (`min-w-[59.5rem]`): jsdom no hace layout, así que se emula lo que mediría un navegador. */
const TABLA_MIN = 952;
/** Emula el ancho total (`scrollWidth`) y el visible (`clientWidth`) de la región de la tabla; el resto de elementos mide 0. */
function emulaAnchoDeRegion(total: number, visible: number) {
  for (const [prop, valor] of [["scrollWidth", total], ["clientWidth", visible]] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get(this: HTMLElement) {
        return this.getAttribute("role") === "region" ? valor : 0;
      },
    });
  }
}
const quitaAnchoDeRegion = () => {
  for (const prop of ["scrollWidth", "clientWidth"]) Reflect.deleteProperty(HTMLElement.prototype, prop);
};

const realMatchMedia = window.matchMedia;
function emulaPantalla(opts: { angosta?: boolean; reducirMovimiento?: boolean }) {
  window.matchMedia = ((query: string) => ({
    matches: (opts.angosta === true && query.includes("max-width: 640px")) || (opts.reducirMovimiento === true && query.includes("prefers-reduced-motion")),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  auth.session = null;
  auth.user = null;
  auth.userType = null;
  toastSpy.mockReset();
  libs.getAllTickets.mockReset().mockResolvedValue(TICKETS);
  libs.getTicketMessages.mockReset().mockResolvedValue([]);
  libs.getTeamMembers.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  quitaAnchoDeRegion();
  window.matchMedia = realMatchMedia;
  vi.useRealTimers();
});

describe("estructura accesible", () => {
  it("un solo h1 «Tickets», con descripción según el rol", async () => {
    await cargar(0);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Tickets" })).toBeInTheDocument();
    expect(screen.getByText(/todos los proyectos/i)).toBeInTheDocument();
    cleanup();
    await cargar(1);
    expect(screen.getByText(/que tienes asignados/i)).toBeInTheDocument();
  });

  it("los indicadores son grupos con nombre y sus cifras salen de los datos cargados", async () => {
    await cargar(0);
    expect(screen.getByRole("group", { name: "Abiertos" })).toHaveTextContent("3");
    expect(screen.getByRole("group", { name: "Urgentes abiertos" })).toHaveTextContent("1");
    expect(screen.getByRole("group", { name: "Total de tickets" })).toHaveTextContent("4");
  });

  it("los indicadores no inventan cifras: «Cargando…» al esperar y «Sin datos» si falla", async () => {
    libs.getAllTickets.mockReturnValue(new Promise(() => {}));
    signIn(0);
    renderPage();
    expect(await screen.findAllByText("Cargando…")).not.toHaveLength(0);
    expect(screen.getByRole("group", { name: "Abiertos" })).toHaveAttribute("aria-busy", "true");
    cleanup();
    libs.getAllTickets.mockRejectedValue(new Error("x"));
    renderPage();
    await screen.findByRole("alert", {}, WAIT);
    expect(screen.getByRole("group", { name: "Abiertos" })).toHaveTextContent("Sin datos");
    expect(screen.getByRole("group", { name: "Abiertos" })).not.toHaveTextContent(/\b0\b/);
  });

  it("la lista es una región con nombre y la tabla tiene sus encabezados", async () => {
    await cargar(0);
    expect(screen.getByRole("heading", { level: 2, name: "Lista de tickets" })).toBeInTheDocument();
    const nombres = screen.getAllByRole("columnheader").map((h) => h.textContent?.trim());
    expect(nombres).toEqual(["Ticket", "Proyecto", "Estado", "Prioridad", "Asignado", "Creado", "Actividad", "Mensajes"]);
  });

  it("el desplazamiento horizontal tiene una región con nombre y `tabindex`", async () => {
    await cargar(0);
    const region = screen.getByRole("region", { name: /tabla de tickets/i });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toMatch(/overflow-x-auto/);
    expect(region.className).toMatch(/focus-visible:ring/);
    expect(within(region).getByRole("table")).toBeInTheDocument();
  });

  // Cambio de marcado: antes el aviso era siempre visible bajo `lg` y oculto desde `lg`, aunque en 1 024–1 262 px
  // (con la barra lateral) la tabla también se desplazaba sin avisar. Ahora depende de que de verdad desborde; el
  // detalle de esa medición está en «tabla · ocho columnas y desplazamiento controlado».
  it("sin desbordamiento no hay aviso de desplazamiento, y en tarjetas tampoco", async () => {
    await cargar(0);
    expect(screen.queryByText(AVISO_DESPLAZAR)).toBeNull();
    cleanup();
    emulaAnchoDeRegion(TABLA_MIN, 600);
    emulaPantalla({ angosta: true });
    await cargar(0);
    expect(screen.queryByText(AVISO_DESPLAZAR)).toBeNull();
    expect(screen.queryByRole("region", { name: /tabla de tickets/i })).toBeNull();
  });

  it("los filtros tienen etiqueta visible y nombre accesible (cinco + búsqueda)", async () => {
    await cargar(0);
    for (const n of ["Estado", "Tipo", "Prioridad", "Proyecto", "Asignado"]) {
      const c = screen.getByRole("combobox", { name: n });
      expect(c).toBeInTheDocument();
      expect(screen.getAllByText(n, { selector: "label" }).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("searchbox", { name: "Buscar tickets" })).toBeInTheDocument();
  });
});

describe("tabla · ocho columnas y desplazamiento controlado", () => {
  const COLUMNAS = ["Ticket", "Proyecto", "Estado", "Prioridad", "Asignado", "Creado", "Actividad", "Mensajes"];
  const cabecera = (n: string) => screen.getByRole("columnheader", { name: new RegExp(`^${n}`) });

  it("siguen las ocho columnas, en su orden, también en las filas", async () => {
    await cargar(0);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())).toEqual(COLUMNAS);
    for (const fila of screen.getAllByRole("row").slice(1)) expect(within(fila).getAllByRole("cell")).toHaveLength(8);
  });

  it("el diseño es fijo: cada columna menos «Ticket» tiene ancho propio y «Ticket» absorbe lo que sobra", async () => {
    await cargar(0);
    const tabla = screen.getByRole("table");
    expect(tabla.className).toMatch(/\btable-fixed\b/);
    expect(tabla.className).toMatch(/min-w-\[59\.5rem\]/);
    for (const n of COLUMNAS.slice(1)) expect(cabecera(n).className, n).toMatch(/(^|\s)w-(\[[\d.]+(rem|%)\]|20)(\s|$)/);
    expect(cabecera("Ticket").className).not.toMatch(/(^|\s)w-/);
  });

  it("la columna «Ticket» queda fija a la izquierda, en la cabecera y en cada fila", async () => {
    await cargar(0);
    expect(cabecera("Ticket").className).toMatch(/\bsticky\b.*\bleft-0\b/);
    for (const fila of screen.getAllByRole("row").slice(1)) {
      const celda = within(fila).getAllByRole("cell")[0];
      expect(celda.className).toMatch(/\bsticky\b.*\bleft-0\b/);
      expect(celda.className).toMatch(/\bbg-card\b/);
    }
  });

  it("el texto largo se corta con puntos suspensivos y el valor completo queda en `title`", async () => {
    libs.getAllTickets.mockResolvedValue([
      ticket("t9", "Un título muy largo que ocupa varias líneas dentro de la columna fija de la tabla", {
        nombre_proyecto: "Portal corporativo de la cooperativa regional",
        assigned_to: "u-ana",
        assignee_email: "ana.maria.fernandez@example.test",
      }),
    ]);
    signIn(0);
    renderPage();
    await screen.findByText(/Un título muy largo/, {}, WAIT);
    const fila = screen.getAllByRole("row")[1];
    const [titulo, proyecto, , , asignado] = within(fila).getAllByRole("cell");
    expect(titulo.querySelector("p")).toHaveAttribute("title", expect.stringMatching(/^Un título muy largo/));
    expect(proyecto).toHaveAttribute("title", "Portal corporativo de la cooperativa regional");
    expect(proyecto.className).toMatch(/\btruncate\b/);
    expect(asignado.querySelector("[title]")).toHaveAttribute("title", "ana.maria.fernandez@example.test");
    expect(asignado.querySelector("[title]")!.className).toMatch(/\btruncate\b/);
  });

  it("el responsable muestra la parte local del correo; el correo completo queda para lectores de pantalla y `title`", async () => {
    await cargar(0);
    const celda = within(filaDe("Cambiar logotipo")).getAllByRole("cell")[4];
    expect(celda.querySelector('[aria-hidden="true"]')).toHaveTextContent(/^ana$/);
    expect(celda.querySelector(".sr-only")).toHaveTextContent("ana@example.test");
    expect(celda.querySelector("[title]")).toHaveAttribute("title", "ana@example.test");
    // La parte visible no se repite para los lectores: el nombre accesible es el correo completo.
    expect(celda).toHaveTextContent("ana@example.test");
  });

  it("sin responsable dice «Sin asignar» en gris y no inventa un correo", async () => {
    await cargar(0);
    const celda = within(filaDe("Botón de pago roto")).getAllByRole("cell")[4];
    expect(celda).toHaveTextContent("Sin asignar");
    expect(celda.querySelector("[title]")).toBeNull();
    expect(celda.querySelector(".text-muted-foreground")).not.toBeNull();
  });

  it("cabe entera: si la región es tan ancha como la tabla no hay aviso ni sombra", async () => {
    emulaAnchoDeRegion(TABLA_MIN, 961); // 1 280 px con barra lateral y barra de desplazamiento
    await cargar(0);
    const region = screen.getByRole("region", { name: /tabla de tickets/i });
    expect(region.dataset.moreRight).toBe("false");
    expect(region.dataset.scrolled).toBe("false");
    expect(region.parentElement!.querySelector('[data-edge="right"]')).toBeNull();
    expect(screen.queryByText(AVISO_DESPLAZAR)).toBeNull();
  });

  it("si desborda: aviso en texto, sombra en el borde derecho y, al desplazarse, sombra bajo «Ticket»", async () => {
    emulaAnchoDeRegion(TABLA_MIN, 700); // ≈ 1 024 px con barra lateral
    await cargar(0);
    expect(await screen.findByText(AVISO_DESPLAZAR)).toBeInTheDocument();
    const region = screen.getByRole("region", { name: /tabla de tickets/i });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.dataset.moreRight).toBe("true");
    expect(region.dataset.scrolled).toBe("false");
    const marca = region.parentElement!.querySelector('[data-edge="right"]');
    expect(marca).not.toBeNull();
    expect(marca).toHaveAttribute("aria-hidden", "true"); // decorativa
    expect(cabecera("Ticket").className).toMatch(/group-data-\[scrolled=true\]\/scroll:shadow-/);
    expect(region.className).toMatch(/\bgroup\/scroll\b/);

    // Se desplaza hasta el final: ya no hay más a la derecha y la columna fija se separa con sombra.
    Object.defineProperty(region, "scrollLeft", { configurable: true, value: TABLA_MIN - 700 });
    fireEvent.scroll(region);
    await waitFor(() => expect(region.dataset.scrolled).toBe("true"));
    expect(region.dataset.moreRight).toBe("false");
    expect(region.parentElement!.querySelector('[data-edge="right"]')).toBeNull();
    expect(screen.getByText(AVISO_DESPLAZAR)).toBeInTheDocument(); // sigue habiendo desplazamiento
  });

  it("el aviso se retira si la lista pasa a tarjetas o queda vacía", async () => {
    emulaAnchoDeRegion(TABLA_MIN, 700);
    await cargar(0);
    await screen.findByText(AVISO_DESPLAZAR);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tickets" }), { target: { value: "zzzz" } });
    expect(await screen.findByText("Ningún ticket coincide")).toBeInTheDocument();
    expect(screen.queryByText(AVISO_DESPLAZAR)).toBeNull();
  });
});

describe("aria-sort y orden", () => {
  it("solo las tres columnas ordenables llevan aria-sort; por defecto manda «Actividad» descendente", async () => {
    await cargar(0);
    const th = (n: string) => screen.getByRole("columnheader", { name: new RegExp(`^${n}`) });
    expect(th("Actividad")).toHaveAttribute("aria-sort", "descending");
    expect(th("Prioridad")).toHaveAttribute("aria-sort", "none");
    expect(th("Creado")).toHaveAttribute("aria-sort", "none");
    for (const n of ["Ticket", "Proyecto", "Estado", "Asignado", "Mensajes"]) expect(th(n)).not.toHaveAttribute("aria-sort");
  });

  it("al ordenar, aria-sort sigue a la columna activa y su sentido", async () => {
    await cargar(0);
    const th = (n: string) => screen.getByRole("columnheader", { name: new RegExp(`^${n}`) });
    fireEvent.click(within(th("Prioridad")).getByRole("button"));
    expect(th("Prioridad")).toHaveAttribute("aria-sort", "descending");
    expect(th("Actividad")).toHaveAttribute("aria-sort", "none");
    expect(titulosEnOrden()[0]).toBe("Servidor caído");
    fireEvent.click(within(th("Prioridad")).getByRole("button"));
    expect(th("Prioridad")).toHaveAttribute("aria-sort", "ascending");
    expect(titulosEnOrden()[0]).toBe("Duda de factura");
    fireEvent.click(within(th("Creado")).getByRole("button"));
    expect(th("Creado")).toHaveAttribute("aria-sort", "descending");
    expect(th("Prioridad")).toHaveAttribute("aria-sort", "none");
  });

  it("cada cabecera ordenable es un botón con el nombre de su columna", async () => {
    await cargar(0);
    for (const n of ["Prioridad", "Creado", "Actividad"]) expect(screen.getByRole("button", { name: n })).toBeInTheDocument();
  });
});

describe("teclado y foco", () => {
  it("cada fila es alcanzable con Tab (tabindex 0) y tiene foco visible", async () => {
    await cargar(0);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r).toHaveAttribute("tabindex", "0");
      expect(r.className).toMatch(/focus-visible:ring-2/);
      expect(r.className).toMatch(/cursor-pointer/);
    }
  });

  it("Enter abre el cajón con ese ticket", async () => {
    await cargar(0);
    const fila = filaDe("Servidor caído");
    fila.focus();
    fireEvent.keyDown(fila, { key: "Enter" });
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    expect(within(dialog).getByRole("heading", { name: "Servidor caído" })).toBeInTheDocument();
  });

  it("Espacio abre el cajón y no desplaza la página (preventDefault)", async () => {
    await cargar(0);
    const fila = filaDe("Cambiar logotipo");
    fila.focus();
    const notPrevented = fireEvent.keyDown(fila, { key: " " });
    expect(notPrevented).toBe(false);
    expect(await screen.findByRole("dialog", {}, WAIT)).toBeInTheDocument();
  });

  it("otras teclas no abren nada", async () => {
    await cargar(0);
    const fila = filaDe("Servidor caído");
    for (const key of ["a", "Tab", "Escape", "ArrowDown"]) fireEvent.keyDown(fila, { key });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("al cerrar el cajón el foco vuelve a la fila que lo abrió", async () => {
    await cargar(0);
    const fila = filaDe("Servidor caído");
    fila.focus();
    fireEvent.keyDown(fila, { key: "Enter" });
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), WAIT);
    await waitFor(() => expect(fila).toHaveFocus(), WAIT);
  });

  it("la fila abierta se marca como seleccionada mientras el cajón está abierto", async () => {
    await cargar(0);
    const fila = filaDe("Servidor caído");
    fireEvent.click(fila);
    await screen.findByRole("dialog", {}, WAIT);
    expect(fila).toHaveAttribute("data-state", "selected");
    expect(filaDe("Botón de pago roto")).not.toHaveAttribute("data-state");
  });

  it("la fila seleccionada usa la superficie sólida `--row-selected` (insignias AA) y la barra de marca, en la fila y en la columna fija", async () => {
    await cargar(0);
    const fila = filaDe("Servidor caído");
    fireEvent.click(fila);
    await screen.findByRole("dialog", {}, WAIT);
    expect(fila.className).toContain("data-[state=selected]:bg-[hsl(var(--row-selected))]");
    expect(fila.className).not.toContain("data-[state=selected]:bg-muted");
    const fija = fila.querySelector("td")!;
    expect(fija.className).toContain("group-data-[state=selected]:bg-[hsl(var(--row-selected))]");
    expect(fija.className).toContain("group-data-[state=selected]:before:bg-primary");
    expect(fija.className).not.toContain("group-data-[state=selected]:bg-muted");
    // Sigue siendo la columna fija y opaca (bg-card), y la tabla conserva sus 8 columnas.
    expect(fija.className).toMatch(/\bsticky\b.*\bbg-card\b/);
    expect(fila.querySelectorAll("td")).toHaveLength(8);
  });
});

describe("insignias y fechas", () => {
  it("estado y prioridad son insignias con texto (nunca solo color) y no se parten en dos líneas", async () => {
    await cargar(0);
    const fila = within(filaDe("Servidor caído"));
    const estado = fila.getByText("En revisión");
    expect(estado.closest("[data-kind]")).toHaveAttribute("data-kind", "ticket");
    expect(estado.closest("[data-kind]")!.className).toMatch(/whitespace-nowrap/);
    const prioridad = fila.getByText("Urgente");
    expect(prioridad.closest("[data-kind]")).toHaveAttribute("data-kind", "priority");
    expect(prioridad.closest("[data-kind]")!.className).toMatch(/whitespace-nowrap/);
    // La prioridad lleva un prefijo solo para lectores de pantalla.
    expect(prioridad.closest("[data-kind]")).toHaveTextContent("Prioridad: Urgente");
  });

  it("el tipo se muestra con texto bajo el título", async () => {
    await cargar(0);
    expect(within(filaDe("Cambiar logotipo")).getByText("Modificación")).toBeInTheDocument();
    expect(within(filaDe("Duda de factura")).getByText("Pago")).toBeInTheDocument();
  });

  it("la actividad es relativa y la fecha exacta está en `time` (dateTime y title)", async () => {
    await cargar(0);
    const fila = filaDe("Botón de pago roto");
    const t = [...fila.querySelectorAll("time")].find((x) => x.getAttribute("datetime") === "2026-11-02T14:00:00.000Z")!;
    expect(t).toBeTruthy();
    expect(t).toHaveTextContent(/hace \d+ h|ayer|justo ahora|hace \d+ min/);
    expect(t.getAttribute("title")).toMatch(/noviembre/i);
  });

  it("proyecto vacío = «—»; sin responsable = «Sin asignar»; con responsable, su correo", async () => {
    libs.getAllTickets.mockResolvedValue([...TICKETS, ticket("t5", "Sin proyecto", { nombre_proyecto: "", project_id: null })]);
    await cargar(0);
    expect(within(filaDe("Sin proyecto")).getByText("—")).toBeInTheDocument();
    expect(within(filaDe("Sin proyecto")).getByText("Sin asignar")).toBeInTheDocument();
    expect(within(filaDe("Cambiar logotipo")).getByText("ana@example.test")).toBeInTheDocument();
  });

  it("la cuenta de mensajes es un número alineado a la derecha", async () => {
    await cargar(0);
    const celdas = filaDe("Botón de pago roto").querySelectorAll("td");
    const ultima = celdas[celdas.length - 1];
    expect(ultima).toHaveTextContent("2");
    expect(ultima.className).toMatch(/text-right/);
    expect(ultima.className).toMatch(/tabular/);
  });
});

describe("búsqueda y filtros", () => {
  it("buscar sin distinguir acentos ni mayúsculas, con contador «Mostrando n de m»", async () => {
    await cargar(0);
    expect(screen.getByText("4 tickets")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tickets" }), { target: { value: "BOTON" } });
    expect(titulosEnOrden()).toEqual(["Botón de pago roto"]);
    expect(screen.getByText("Mostrando 1 de 4 tickets")).toBeInTheDocument();
  });

  it("buscar también por proyecto y por responsable", async () => {
    await cargar(0);
    const caja = screen.getByRole("searchbox", { name: "Buscar tickets" });
    fireEvent.change(caja, { target: { value: "portal" } });
    expect(titulosEnOrden()).toEqual(["Servidor caído", "Duda de factura"]);
    fireEvent.change(caja, { target: { value: "ana@example" } });
    expect(titulosEnOrden()).toEqual(["Cambiar logotipo"]);
  });

  it("sin coincidencias: estado vacío con «Quitar filtros» que lo deja todo como estaba", async () => {
    await cargar(0);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar tickets" }), { target: { value: "zzzz" } });
    expect(screen.getByRole("heading", { name: "Ningún ticket coincide" })).toBeInTheDocument();
    const quitar = screen.getAllByRole("button", { name: "Quitar filtros" });
    expect(quitar.length).toBeGreaterThan(0);
    fireEvent.click(quitar[quitar.length - 1]);
    expect(titulosEnOrden()).toHaveLength(4);
    expect(screen.getByRole("searchbox", { name: "Buscar tickets" })).toHaveValue("");
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
  });

  it("«Quitar filtros» aparece al filtrar con un selector y restablece los cinco", async () => {
    await cargar(0);
    expect(screen.queryByRole("button", { name: "Quitar filtros" })).toBeNull();
    eligeEnLista("Estado", "Resuelto");
    eligeEnLista("Proyecto", "Portal Ejemplo");
    expect(titulosEnOrden()).toEqual(["Duda de factura"]);
    fireEvent.click(screen.getByRole("button", { name: "Quitar filtros" }));
    expect(titulosEnOrden()).toHaveLength(4);
    expect(screen.getByRole("combobox", { name: "Estado" })).toHaveTextContent("Todos");
    expect(screen.getByRole("combobox", { name: "Proyecto" })).toHaveTextContent("Todos");
  });

  it("el colaborador no tiene el filtro «Asignado» y el filtro de proyecto solo existe si hay proyectos", async () => {
    await cargar(1);
    expect(screen.queryByRole("combobox", { name: "Asignado" })).toBeNull();
    cleanup();
    libs.getAllTickets.mockResolvedValue(TICKETS.map((t) => ({ ...t, nombre_proyecto: "" })));
    await cargar(0);
    expect(screen.queryByRole("combobox", { name: "Proyecto" })).toBeNull();
  });
});

describe("estados de carga, vacío y error", () => {
  it("cargando: marcador accesible con barras de carga y sin tabla ni filtros", async () => {
    libs.getAllTickets.mockReturnValue(new Promise(() => {}));
    signIn(0);
    renderPage();
    const estado = await screen.findByRole("status");
    expect(estado).toHaveAttribute("aria-busy", "true");
    expect(estado).toHaveTextContent("Cargando tickets…");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("sin ningún ticket: estado vacío con un enlace a Proyectos (administrador)", async () => {
    libs.getAllTickets.mockResolvedValue([]);
    signIn(0);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Aún no hay tickets" }, WAIT)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver proyectos" })).toHaveAttribute("href", "/dashboard/proyectos");
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(screen.getByRole("group", { name: "Total de tickets" })).toHaveTextContent("0");
  });

  it("sin tickets para un colaborador: dice que no tiene asignados", async () => {
    libs.getAllTickets.mockResolvedValue([]);
    signIn(1);
    renderPage();
    expect(await screen.findByText(/te asignen un ticket/i, {}, WAIT)).toBeInTheDocument();
  });

  it("error: mensaje claro en español con reintento, sin el texto técnico ni aviso destructivo", async () => {
    libs.getAllTickets.mockRejectedValue(Object.assign(new Error('relation "tickets" does not exist'), { code: "42P01" }));
    signIn(0);
    renderPage();
    const alerta = await screen.findByRole("alert", {}, WAIT);
    expect(alerta).toHaveTextContent("No se pudieron cargar los tickets. Revisa tu conexión e inténtalo de nuevo.");
    expect(document.body.textContent).not.toMatch(/relation|does not exist|42P01/);
    expect(toastSpy).not.toHaveBeenCalled();
    expect(within(alerta).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("error de permisos: lo dice distinto", async () => {
    libs.getAllTickets.mockRejectedValue(Object.assign(new Error("denied"), { code: "42501" }));
    signIn(0);
    renderPage();
    expect(await screen.findByText(/No tienes permiso para ver los tickets/, {}, WAIT)).toBeInTheDocument();
  });

  it("«Reintentar» vuelve a pedir los datos y muestra la lista", async () => {
    libs.getAllTickets.mockRejectedValueOnce(new Error("fallo")).mockResolvedValue(TICKETS);
    signIn(0);
    renderPage();
    fireEvent.click(await within(await screen.findByRole("alert", {}, WAIT)).findByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Botón de pago roto", {}, WAIT)).toBeInTheDocument();
    expect(libs.getAllTickets).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("una respuesta tardía de una carga anterior no pisa a la más reciente", async () => {
    let tarde!: (v: unknown) => void;
    libs.getAllTickets.mockReturnValueOnce(new Promise((r) => (tarde = r))).mockResolvedValue(TICKETS);
    signIn(0);
    const view = renderPage();
    // Cambia la sesión: nueva carga con los datos buenos.
    auth.user = { id: "u-otro", email: "otra@example.test" };
    view.rerender(
      <MemoryRouter initialEntries={["/dashboard/tickets"]}>
        <TicketsGlobal />
      </MemoryRouter>,
    );
    await screen.findByText("Botón de pago roto", {}, WAIT);
    tarde([ticket("viejo", "Dato de otra sesión")]);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByText("Dato de otra sesión")).toBeNull();
    expect(screen.getByText("Botón de pago roto")).toBeInTheDocument();
  });
});

describe("pantalla angosta (≤ 640 px): tarjetas", () => {
  beforeEach(() => emulaPantalla({ angosta: true }));

  it("no hay tabla: cada ticket es una tarjeta (botón) y no pierde estado ni prioridad", async () => {
    await cargar(0);
    expect(screen.queryByRole("table")).toBeNull();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(4);
    const tarjeta = within(items[1]); // «Servidor caído» (por actividad)
    expect(tarjeta.getByRole("button", { name: /Servidor caído/ })).toBeInTheDocument();
    expect(tarjeta.getByText("En revisión")).toBeInTheDocument();
    expect(tarjeta.getByText("Urgente")).toBeInTheDocument();
    expect(tarjeta.getByText(/Bug \/ Error en Portal Ejemplo/)).toBeInTheDocument();
    expect(tarjeta.getByText("Sin asignar")).toBeInTheDocument();
    expect(tarjeta.getByText(/^Creado /)).toBeInTheDocument();
    expect(tarjeta.getByText(/^Actividad /)).toBeInTheDocument();
  });

  it("las insignias de la tarjeta no se parten en dos líneas", async () => {
    await cargar(0);
    for (const el of document.querySelectorAll("[data-kind]")) expect(el.className).toMatch(/whitespace-nowrap/);
  });

  it("la cuenta de mensajes se lee con texto («2 mensajes»)", async () => {
    await cargar(0);
    const tarjeta = within(screen.getAllByRole("listitem")[0]); // «Botón de pago roto»: 2 mensajes
    expect(tarjeta.getByText("2")).toBeInTheDocument();
    expect(tarjeta.getByText("mensajes", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("los filtros quedan tras «Filtros y orden» (aria-expanded) y se abren y cierran", async () => {
    await cargar(0);
    const boton = screen.getByRole("button", { name: /Filtros y orden/ });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(boton.getAttribute("aria-controls")!)!.className).toMatch(/\bhidden\b/);
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(boton.getAttribute("aria-controls")!)!.className).not.toMatch(/\bhidden\b/);
    expect(screen.getByRole("combobox", { name: "Estado" })).toBeInTheDocument();
  });

  it("el botón de filtros avisa cuántos hay activos", async () => {
    await cargar(0);
    fireEvent.click(screen.getByRole("button", { name: /Filtros y orden/ }));
    eligeEnLista("Estado", "Resuelto");
    expect(screen.getByRole("button", { name: /Filtros y orden/ })).toHaveTextContent("1 filtro activo");
  });

  it("sin encabezados de tabla, el orden se elige con «Ordenar por» y un botón de sentido", async () => {
    await cargar(0);
    fireEvent.click(screen.getByRole("button", { name: /Filtros y orden/ }));
    eligeEnLista("Ordenar por", "Prioridad");
    expect(titulosEnOrden()[0]).toBe("Servidor caído");
    const sentido = screen.getByRole("button", { name: /Orden descendente/ });
    fireEvent.click(sentido);
    expect(titulosEnOrden()[0]).toBe("Duda de factura");
    expect(screen.getByRole("button", { name: /Orden ascendente/ })).toBeInTheDocument();
  });

  it("tocar una tarjeta abre el cajón y al cerrarlo el foco vuelve a la tarjeta", async () => {
    await cargar(0);
    const tarjeta = screen.getByRole("button", { name: /Servidor caído/ });
    tarjeta.focus();
    fireEvent.click(tarjeta);
    const dialog = await screen.findByRole("dialog", {}, WAIT);
    expect(within(dialog).getByRole("heading", { name: "Servidor caído" })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(tarjeta).toHaveFocus(), WAIT);
  });

  it("en pantalla ancha vuelve la tabla y no hay «Filtros y orden»", async () => {
    emulaPantalla({ angosta: false });
    await cargar(0);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Filtros y orden/ })).toBeNull();
  });
});
