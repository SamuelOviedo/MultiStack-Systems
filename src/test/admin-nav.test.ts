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
  it("solo las 3 pantallas existentes son funcionales y no hay rutas inventadas", () => {
    const funcionales = allItems().filter((i) => i.status === "funcional");
    expect(funcionales.map((i) => i.label).sort()).toEqual(["Proyectos", "Resumen", "Tickets"]);
    const hrefs = new Set(funcionales.map((i) => i.href));
    expect([...hrefs].sort()).toEqual(["/dashboard", "/dashboard/proyectos", "/dashboard/tickets"]);
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
  it("el administrador ve las 11 entradas", () => {
    expect(labels(0)).toHaveLength(allItems().length);
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

  it("Tickets: Soporte / Tickets", () => {
    expect(breadcrumbsFor("/dashboard/tickets").map((c) => c.label)).toEqual(["Soporte", "Tickets"]);
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
      ["Gestión comercial", ["Proyectos"]],
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
    // Las definiciones siguen completas en la configuración: nada se borró.
    expect(allItems()).toHaveLength(11);
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
