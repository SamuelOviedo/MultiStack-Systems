import { Repeat } from "lucide-react";
import { describe, expect, it } from "vitest";
import {
  ADMIN_NAV_GROUPS,
  availableNavGroups,
  breadcrumbsFor,
  countNavItems,
  isNavItemCurrent,
  navGroupsForRole,
  upcomingNavGroups,
  type NavGroup,
  type NavItem,
} from "@/components/admin/adminNav";

const allItems = (): NavItem[] => ADMIN_NAV_GROUPS.flatMap((g) => [...g.items]);
const labels = (userType: number | null) =>
  navGroupsForRole(userType).flatMap((g) => g.items.map((i) => i.label));

describe("adminNav · estructura", () => {
  it("define los seis grupos en orden", () => {
    expect(ADMIN_NAV_GROUPS.map((g) => g.label)).toEqual([
      "Inicio",
      "Gestión comercial",
      "Finanzas",
      "Centro de Operaciones",
      "Soporte",
      "Administración",
    ]);
  });

  it("ids únicos, etiquetas con texto y un icono por entrada", () => {
    const ids = allItems().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of allItems()) {
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.icon).toBeTruthy();
    }
  });

  it("cada entrada declara uno de los dos estados", () => {
    for (const item of allItems()) {
      expect(["funcional", "proximamente"]).toContain(item.status);
    }
  });

  it("ninguna entrada «proximamente» lleva enlace ni regla de ruta actual", () => {
    const pronto = allItems().filter((i) => i.status === "proximamente");
    expect(pronto.length).toBeGreaterThan(0);
    for (const item of pronto) {
      expect(item.href, item.label).toBeUndefined();
      expect(item.match, item.label).toBeUndefined();
      expect(item.badge, item.label).toBeUndefined();
    }
  });

  it("toda entrada funcional tiene una ruta interna", () => {
    for (const item of allItems().filter((i) => i.status !== "proximamente")) {
      expect(item.href, item.label).toMatch(/^\/dashboard(\/|$)/);
    }
  });

  // «Proyectos» pasó de compartir /dashboard con «Resumen» a tener su ruta propia, /dashboard/proyectos.
  // Por la entrada «Cotizaciones» (solo administrador): ahora son 4 pantallas funcionales y su ruta es una más.
  it("solo las 4 pantallas del panel son funcionales y no hay rutas inventadas", () => {
    const funcionales = allItems().filter((i) => i.status === "funcional");
    expect(funcionales.map((i) => i.label).sort()).toEqual(["Cotizaciones", "Proyectos", "Resumen", "Tickets"]);
    const hrefs = new Set(funcionales.map((i) => i.href));
    expect([...hrefs].sort()).toEqual([
      "/dashboard",
      "/dashboard/cotizaciones",
      "/dashboard/proyectos",
      "/dashboard/tickets",
    ]);
  });

  it("cada entrada funcional tiene su propia ruta (Resumen y Proyectos ya no comparten /dashboard)", () => {
    const funcionales = allItems().filter((i) => i.status === "funcional");
    expect(new Set(funcionales.map((i) => i.href)).size).toBe(funcionales.length);
    expect(funcionales.find((i) => i.label === "Proyectos")!.href).toBe("/dashboard/proyectos");
    expect(funcionales.find((i) => i.label === "Proyectos")!.status).toBe("funcional");
  });

  it("los módulos nuevos aún no tienen ruta", () => {
    const nuevos = ["Clientes", "Servicios y renovaciones", "Cobros y comprobantes", "Costos y márgenes",
      "Recursos e infraestructura", "Integraciones", "Equipo y roles", "Auditoría"];
    for (const name of nuevos) {
      const item = allItems().find((i) => i.label === name);
      expect(item, name).toBeDefined();
      expect(item!.status, name).toBe("proximamente");
      expect(item!.href, name).toBeUndefined();
    }
  });

  it("roles: todas las entradas son solo del administrador ([0]), también Resumen, Proyectos y Tickets", () => {
    for (const item of allItems()) {
      expect([...item.roles], item.label).toEqual([0]);
    }
  });

  it("no inventa insignias: solo Tickets declara una y es el conteo real de abiertos", () => {
    const conInsignia = allItems().filter((i) => i.badge);
    expect(conInsignia.map((i) => [i.label, i.badge])).toEqual([["Tickets", "openTickets"]]);
  });
});

describe("adminNav · visibilidad por rol (solo presentación)", () => {
  // Por la entrada «Cotizaciones»: el menú completo pasa de 11 a 12 entradas.
  it("el administrador ve las 12 entradas", () => {
    expect(labels(0)).toHaveLength(allItems().length);
    expect(labels(0)).toHaveLength(12);
    expect(labels(0)).toContain("Cotizaciones");
    expect(labels(0)).toContain("Cobros y comprobantes");
    expect(labels(0)).toContain("Equipo y roles");
  });

  it("el colaborador no ve ninguna entrada y no queda ningún grupo", () => {
    expect(labels(1)).toEqual([]);
    expect(navGroupsForRole(1)).toEqual([]);
  });

  it("con el rol aún sin resolver (null) no se muestra ninguna entrada", () => {
    expect(labels(null)).toEqual([]);
    expect(navGroupsForRole(null)).toEqual([]);
  });

  it("un cliente (2) no ve ningún menú del panel", () => {
    expect(navGroupsForRole(2)).toEqual([]);
  });
});

describe("adminNav · entrada actual (aria-current)", () => {
  const byLabel = (l: string) => allItems().find((i) => i.label === l)!;

  it("Resumen solo en /dashboard (con o sin barra final)", () => {
    expect(isNavItemCurrent(byLabel("Resumen"), "/dashboard")).toBe(true);
    expect(isNavItemCurrent(byLabel("Resumen"), "/dashboard/")).toBe(true);
    expect(isNavItemCurrent(byLabel("Resumen"), "/dashboard/tickets")).toBe(false);
    expect(isNavItemCurrent(byLabel("Resumen"), "/dashboard/project/abc")).toBe(false);
  });

  it("Proyectos en su lista y en el detalle de un proyecto, sin marcar Resumen", () => {
    expect(isNavItemCurrent(byLabel("Proyectos"), "/dashboard/proyectos")).toBe(true);
    expect(isNavItemCurrent(byLabel("Proyectos"), "/dashboard/proyectos/")).toBe(true);
    expect(isNavItemCurrent(byLabel("Proyectos"), "/dashboard/project/abc")).toBe(true);
    expect(isNavItemCurrent(byLabel("Proyectos"), "/dashboard")).toBe(false);
    expect(isNavItemCurrent(byLabel("Resumen"), "/dashboard/proyectos")).toBe(false);
  });

  it("Tickets en /dashboard/tickets", () => {
    expect(isNavItemCurrent(byLabel("Tickets"), "/dashboard/tickets")).toBe(true);
    expect(isNavItemCurrent(byLabel("Tickets"), "/dashboard")).toBe(false);
  });

  it("una entrada «proximamente» nunca es la actual", () => {
    for (const item of allItems().filter((i) => i.status === "proximamente")) {
      expect(isNavItemCurrent(item, "/dashboard")).toBe(false);
    }
  });

  it("como mucho una entrada es la actual en cada ruta existente", () => {
    for (const path of ["/dashboard", "/dashboard/proyectos", "/dashboard/tickets", "/dashboard/project/1"]) {
      expect(allItems().filter((i) => isNavItemCurrent(i, path))).toHaveLength(1);
    }
  });
});

describe("adminNav · migas", () => {
  it("Resumen: Inicio / Resumen", () => {
    expect(breadcrumbsFor("/dashboard").map((c) => c.label)).toEqual(["Inicio", "Resumen"]);
  });

  it("Lista de proyectos: Gestión comercial / Proyectos", () => {
    expect(breadcrumbsFor("/dashboard/proyectos").map((c) => c.label)).toEqual(["Gestión comercial", "Proyectos"]);
  });

  it("Tickets: Panel / Tickets, con «Panel» como enlace al Resumen y sin enlace en la miga actual", () => {
    const crumbs = breadcrumbsFor("/dashboard/tickets");
    expect(crumbs.map((c) => c.label)).toEqual(["Panel", "Tickets"]);
    expect(crumbs[0].href).toBe("/dashboard");
    expect(crumbs[1].href).toBeUndefined();
  });

  it("el menú sigue agrupando Tickets bajo «Soporte»: solo cambian las migas", () => {
    const group = ADMIN_NAV_GROUPS.find((g) => g.items.some((i) => i.id === "tickets"));
    expect(group?.label).toBe("Soporte");
  });

  it("Detalle de proyecto: Gestión comercial / Proyectos (enlace) / Detalle", () => {
    const crumbs = breadcrumbsFor("/dashboard/project/abc");
    expect(crumbs.map((c) => c.label)).toEqual(["Gestión comercial", "Proyectos", "Detalle"]);
    expect(crumbs[1].href).toBe("/dashboard/proyectos");
    expect(crumbs[2].href).toBeUndefined();
  });

  it("ruta desconocida: sin migas", () => {
    expect(breadcrumbsFor("/otra")).toEqual([]);
  });

  // En pantallas angostas la miga se queda en una línea; para eso las etiquetas largas traen una corta. Ningún módulo
  // con ruta tiene hoy una etiqueta larga: se comprueba con «Servicios y renovaciones» como si ya tuviera pantalla.
  it("las migas de un módulo con etiqueta larga traen una versión corta; las demás no inventan ninguna", () => {
    const servicios: NavItem = {
      id: "servicios",
      label: "Servicios y renovaciones",
      icon: Repeat,
      status: "funcional",
      href: "/dashboard/servicios",
      roles: [0],
      match: { exact: ["/dashboard/servicios"], prefix: ["/dashboard/servicios/"] },
    };
    const conRuta: NavGroup[] = [{ id: "gestion-comercial", label: "Gestión comercial", items: [servicios] }];
    const ficha = breadcrumbsFor("/dashboard/servicios/srv-02", conRuta);
    expect(ficha.map((c) => c.label)).toEqual(["Gestión comercial", "Servicios y renovaciones", "Detalle"]);
    expect(ficha[1]).toMatchObject({ shortLabel: "Servicios", href: "/dashboard/servicios" });
    expect(Object.keys(ficha[0])).not.toContain("shortLabel");
    expect(Object.keys(ficha[2])).not.toContain("shortLabel");
    for (const crumb of breadcrumbsFor("/dashboard/project/abc")) {
      expect(Object.keys(crumb), crumb.label).not.toContain("shortLabel");
    }
    for (const crumb of breadcrumbsFor("/dashboard/servicios", conRuta)) {
      expect(crumb.shortLabel === undefined || crumb.shortLabel.length < "Servicios y renovaciones".length).toBe(true);
    }
  });
});

describe("adminNav · disponibles y próximamente", () => {
  const names = (groups: readonly { label: string; items: readonly NavItem[] }[]) =>
    groups.map((g) => [g.label, g.items.map((i) => i.label)]);

  it("el administrador ve primero lo disponible, sin grupos vacíos: Inicio, Gestión comercial y Soporte", () => {
    expect(names(availableNavGroups(0))).toEqual([
      ["Inicio", ["Resumen"]],
      // Por la entrada «Cotizaciones»: queda después de Proyectos.
      ["Gestión comercial", ["Proyectos", "Cotizaciones"]],
      ["Soporte", ["Tickets"]],
    ]);
    for (const item of availableNavGroups(0).flatMap((g) => g.items)) {
      expect(item.status).not.toBe("proximamente");
      expect(item.href, item.label).toMatch(/^\/dashboard/);
    }
  });

  it("las «proximamente» se agrupan por su área de la arquitectura del ERP, en el orden del menú", () => {
    expect(names(upcomingNavGroups(0))).toEqual([
      ["Gestión comercial", ["Clientes", "Servicios y renovaciones"]],
      ["Finanzas", ["Cobros y comprobantes", "Costos y márgenes"]],
      ["Centro de Operaciones", ["Recursos e infraestructura", "Integraciones"]],
      ["Administración", ["Equipo y roles", "Auditoría"]],
    ]);
    expect(countNavItems(upcomingNavGroups(0))).toBe(8);
    for (const item of upcomingNavGroups(0).flatMap((g) => g.items)) {
      expect(item.status).toBe("proximamente");
      expect(item.href, item.label).toBeUndefined();
    }
  });

  it("no se pierde ni se repite ninguna entrada: disponibles + próximamente = el menú del rol", () => {
    for (const role of [0, 1, null, 2]) {
      const todas = navGroupsForRole(role).flatMap((g) => g.items.map((i) => i.id));
      const partidas = [...availableNavGroups(role), ...upcomingNavGroups(role)].flatMap((g) => g.items.map((i) => i.id));
      expect([...partidas].sort(), String(role)).toEqual([...todas].sort());
    }
    // Las definiciones siguen completas en la configuración: nada se borró. Son 12 por la entrada «Cotizaciones».
    expect(allItems()).toHaveLength(12);
  });

  it("colaborador, rol sin resolver y cliente no ven «Próximamente» (todo lo pendiente es solo del administrador)", () => {
    for (const role of [1, null, 2]) {
      expect(upcomingNavGroups(role), String(role)).toEqual([]);
      expect(countNavItems(upcomingNavGroups(role))).toBe(0);
    }
    for (const role of [1, null, 2]) expect(availableNavGroups(role), String(role)).toEqual([]);
  });

  it("los grupos devueltos son copias: no mutan la configuración", () => {
    const antes = ADMIN_NAV_GROUPS.map((g) => g.items.length);
    availableNavGroups(0);
    upcomingNavGroups(0);
    expect(ADMIN_NAV_GROUPS.map((g) => g.items.length)).toEqual(antes);
  });
});

// Entrada «Cotizaciones» (módulo de cotizaciones): una sola entrada del menú cubre la lista, el catálogo y el detalle.
describe("adminNav · Cotizaciones", () => {
  // UUID sintético: la navegación no valida el identificador, solo ve que la ruta cuelga de /dashboard/cotizaciones/.
  const COTIZACION_ID = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
  const LISTA = "/dashboard/cotizaciones";
  const CATALOGO = "/dashboard/cotizaciones/catalogo";
  const cotizaciones = () => allItems().find((i) => i.label === "Cotizaciones")!;
  const actuales = (path: string) => allItems().filter((i) => isNavItemCurrent(i, path)).map((i) => i.label);
  const etiquetas = (groups: readonly NavGroup[]) => groups.flatMap((g) => g.items.map((i) => i.label));

  it("es una sola entrada funcional, solo del administrador, en Gestión comercial entre Proyectos y Clientes", () => {
    expect(allItems().filter((i) => i.label === "Cotizaciones")).toHaveLength(1);
    // El catálogo y el detalle no añaden entradas: ninguna otra apunta a una ruta de cotizaciones.
    expect(allItems().filter((i) => i.href?.startsWith(LISTA))).toHaveLength(1);
    const item = cotizaciones();
    expect(item.status).toBe("funcional");
    expect(item.href).toBe(LISTA);
    expect([...item.roles]).toEqual([0]);
    const grupo = ADMIN_NAV_GROUPS.find((g) => g.label === "Gestión comercial")!;
    expect(grupo.items.map((i) => i.label)).toEqual(["Proyectos", "Cotizaciones", "Clientes", "Servicios y renovaciones"]);
  });

  describe("entrada actual (aria-current)", () => {
    it.each([
      ["la lista", LISTA],
      ["la lista con barra final", `${LISTA}/`],
      ["el catálogo", CATALOGO],
      ["el catálogo con barra final", `${CATALOGO}/`],
      ["el detalle de una cotización", `${LISTA}/${COTIZACION_ID}`],
    ])("en %s la entrada actual es Cotizaciones y solo ella", (_n, path) => {
      expect(isNavItemCurrent(cotizaciones(), path)).toBe(true);
      expect(actuales(path)).toEqual(["Cotizaciones"]);
    });

    it.each([
      "/dashboard",
      "/dashboard/proyectos",
      "/dashboard/project/abc",
      "/dashboard/tickets",
      "/dashboard/cotizacion",
      "/dashboard/cotizacionesx",
      "/dashboard/cotizacion/abc",
      "/cotizaciones",
    ])("en %s Cotizaciones no es la entrada actual", (path) => {
      expect(isNavItemCurrent(cotizaciones(), path)).toBe(false);
      expect(actuales(path)).not.toContain("Cotizaciones");
    });
  });

  describe("migas", () => {
    it("lista: Gestión comercial / Cotizaciones, con o sin barra final y sin enlace en la miga actual", () => {
      for (const path of [LISTA, `${LISTA}/`]) {
        const crumbs = breadcrumbsFor(path);
        expect(crumbs.map((c) => c.label), path).toEqual(["Gestión comercial", "Cotizaciones"]);
        expect(crumbs[0].href, path).toBeUndefined();
        expect(crumbs[1].href, path).toBeUndefined();
      }
    });

    it("catálogo: Gestión comercial / Cotizaciones (enlace a la lista) / Catálogo, y no «Detalle»", () => {
      for (const path of [CATALOGO, `${CATALOGO}/`]) {
        const crumbs = breadcrumbsFor(path);
        expect(crumbs.map((c) => c.label), path).toEqual(["Gestión comercial", "Cotizaciones", "Catálogo"]);
        expect(crumbs[1].href, path).toBe(LISTA);
        expect(crumbs[2].href, path).toBeUndefined();
      }
    });

    it.each([
      ["un UUID", COTIZACION_ID],
      ["un texto que no es UUID", "xyz"],
      ["un texto que solo empieza igual que el catálogo", "catalogos"],
    ])("detalle con %s: Gestión comercial / Cotizaciones (enlace a la lista) / Detalle", (_n, id) => {
      const crumbs = breadcrumbsFor(`${LISTA}/${id}`);
      expect(crumbs.map((c) => c.label)).toEqual(["Gestión comercial", "Cotizaciones", "Detalle"]);
      expect(crumbs[1].href).toBe(LISTA);
      expect(crumbs[2].href).toBeUndefined();
    });

    it("las migas de las demás entradas y de las rutas vecinas no cambian con la entrada nueva", () => {
      expect(breadcrumbsFor("/dashboard")).toEqual([{ label: "Inicio" }, { label: "Resumen" }]);
      expect(breadcrumbsFor("/dashboard/proyectos")).toEqual([{ label: "Gestión comercial" }, { label: "Proyectos" }]);
      expect(breadcrumbsFor("/dashboard/project/abc")).toEqual([
        { label: "Gestión comercial" },
        { label: "Proyectos", href: "/dashboard/proyectos" },
        { label: "Detalle" },
      ]);
      expect(breadcrumbsFor("/dashboard/tickets")).toEqual([{ label: "Panel", href: "/dashboard" }, { label: "Tickets" }]);
      for (const path of ["/otra", "/dashboard/cotizacion", "/dashboard/cotizacionesx", "/dashboard/cotizacion/abc"]) {
        expect(breadcrumbsFor(path), path).toEqual([]);
      }
    });
  });

  describe("visibilidad por rol (solo presentación)", () => {
    it("el administrador (0) la ve entre las disponibles, con su ruta, y no entre las «proximamente»", () => {
      expect(labels(0)).toContain("Cotizaciones");
      const disponible = availableNavGroups(0).flatMap((g) => g.items).find((i) => i.label === "Cotizaciones");
      expect(disponible?.href).toBe(LISTA);
      expect(etiquetas(upcomingNavGroups(0))).not.toContain("Cotizaciones");
    });

    it.each([
      ["colaborador (1)", 1],
      ["cliente (2)", 2],
      ["sin sesión (null)", null],
    ])("%s no la ve en ninguna lista del menú", (_n, role) => {
      expect(labels(role)).not.toContain("Cotizaciones");
      for (const groups of [navGroupsForRole(role), availableNavGroups(role), upcomingNavGroups(role)]) {
        expect(etiquetas(groups)).not.toContain("Cotizaciones");
      }
    });
  });
});
