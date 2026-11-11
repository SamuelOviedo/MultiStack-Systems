import {
  FileText,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Plug,
  Receipt,
  Repeat,
  ScrollText,
  Server,
  TrendingUp,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * Navegación del panel del administrador.
 *
 * Es SOLO presentación: qué entradas se dibujan según el rol. La autorización
 * real sigue en `ProtectedRoute` (`allowedTypes` de cada ruta) y en RLS; ocultar
 * una entrada aquí no protege nada. El panel es solo del administrador: todas
 * las entradas llevan `roles: [0]` y el colaborador (1) no ve ninguna.
 *
 * - `funcional`: la pantalla existe hoy con datos reales.
 * - `proximamente`: aún sin ruta. Se dibuja como texto atenuado, no es un
 *   enlace y no lleva a ninguna pantalla vacía.
 */
export type NavStatus = "funcional" | "proximamente";

/** Roles de la tabla de perfiles: 0 administrador, 1 colaborador (2 = cliente, sin panel). */
export type NavRole = 0 | 1;

/** Insignias con dato real y barato de leer (`src/lib`). Solo existe una. */
export type NavBadgeKey = "openTickets";

export interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly status: NavStatus;
  /** Ruta interna. Ausente en `proximamente`. */
  readonly href?: string;
  readonly roles: readonly NavRole[];
  /**
   * Cuándo es «la página actual» (`aria-current="page"`). Si falta, coincide
   * `href` exacto. Sirve también para que el detalle de un registro marque la
   * entrada de su lista (`/dashboard/project/:id` marca «Proyectos»).
   */
  readonly match?: { readonly exact?: readonly string[]; readonly prefix?: readonly string[] };
  readonly badge?: NavBadgeKey;
  /**
   * Primera miga en lugar del nombre del grupo: un enlace al inicio del panel (`Panel / Tickets`). Solo cambia lo que
   * dicen las migas; el menú lateral sigue agrupado por `NavGroup.label`.
   */
  readonly breadcrumbRoot?: { readonly label: string; readonly href: string };
  /**
   * Pantallas fijas de esta entrada que no son un detalle (`/dashboard/cotizaciones/catalogo`). Solo cambian las migas:
   * la última dice la etiqueta de la subpágina en lugar de «Detalle». No añade entradas al menú, y la ruta debe caer
   * también dentro de `match` para que la entrada sea la página actual.
   */
  readonly subpages?: readonly { readonly path: string; readonly label: string }[];
}

export interface NavGroup {
  readonly id: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

const SOLO_ADMIN = [0] as const satisfies readonly NavRole[];

/** Menú completo: los módulos con pantalla y los que aún no la tienen (`proximamente`). */
export function buildAdminNavGroups(): readonly NavGroup[] {
  return [
    {
      id: "inicio",
      label: "Inicio",
      items: [
        {
          id: "resumen",
          label: "Resumen",
          icon: LayoutDashboard,
          status: "funcional",
          href: "/dashboard",
          roles: SOLO_ADMIN,
          match: { exact: ["/dashboard"] },
        },
      ],
    },
    {
      id: "gestion-comercial",
      label: "Gestión comercial",
      items: [
        {
          id: "proyectos",
          label: "Proyectos",
          icon: FolderKanban,
          status: "funcional",
          href: "/dashboard/proyectos",
          roles: SOLO_ADMIN,
          // El detalle de un proyecto (`/dashboard/project/:id`) también pertenece a esta entrada.
          match: { exact: ["/dashboard/proyectos"], prefix: ["/dashboard/project/"] },
        },
        {
          id: "cotizaciones",
          label: "Cotizaciones",
          icon: FileText,
          status: "funcional",
          href: "/dashboard/cotizaciones",
          roles: SOLO_ADMIN,
          // La lista, el catálogo y el detalle (`/dashboard/cotizaciones/:id`) pertenecen a esta única entrada.
          match: {
            exact: ["/dashboard/cotizaciones", "/dashboard/cotizaciones/catalogo"],
            prefix: ["/dashboard/cotizaciones/"],
          },
          subpages: [{ path: "/dashboard/cotizaciones/catalogo", label: "Catálogo" }],
        },
        { id: "clientes", label: "Clientes", icon: Users, status: "proximamente", roles: SOLO_ADMIN },
        {
          id: "servicios",
          label: "Servicios y renovaciones",
          icon: Repeat,
          status: "proximamente",
          roles: SOLO_ADMIN,
        },
      ],
    },
    {
      id: "finanzas",
      label: "Finanzas",
      items: [
        { id: "cobros", label: "Cobros y comprobantes", icon: Receipt, status: "proximamente", roles: SOLO_ADMIN },
        { id: "margenes", label: "Costos y márgenes", icon: TrendingUp, status: "proximamente", roles: SOLO_ADMIN },
      ],
    },
    {
      id: "operaciones",
      label: "Centro de Operaciones",
      items: [
        {
          id: "recursos",
          label: "Recursos e infraestructura",
          icon: Server,
          status: "proximamente",
          roles: SOLO_ADMIN,
        },
        { id: "integraciones", label: "Integraciones", icon: Plug, status: "proximamente", roles: SOLO_ADMIN },
      ],
    },
    {
      id: "soporte",
      label: "Soporte",
      items: [
        {
          id: "tickets",
          label: "Tickets",
          icon: LifeBuoy,
          status: "funcional",
          href: "/dashboard/tickets",
          roles: SOLO_ADMIN,
          match: { exact: ["/dashboard/tickets"] },
          badge: "openTickets",
          breadcrumbRoot: { label: "Panel", href: "/dashboard" },
        },
      ],
    },
    {
      id: "administracion",
      label: "Administración",
      items: [
        { id: "equipo", label: "Equipo y roles", icon: UsersRound, status: "proximamente", roles: SOLO_ADMIN },
        { id: "auditoria", label: "Auditoría", icon: ScrollText, status: "proximamente", roles: SOLO_ADMIN },
      ],
    },
  ];
}

/** Menú vigente del panel. */
export const ADMIN_NAV_GROUPS: readonly NavGroup[] = buildAdminNavGroups();

const trimSlash = (path: string): string => (path.length > 1 ? path.replace(/\/+$/, "") : path);

function visibleTo(item: NavItem, userType: number | null): boolean {
  // Rol sin resolver: solo lo que ven los dos roles (nunca parpadea lo exclusivo del administrador).
  if (userType === null) return item.roles.length === 2;
  return (item.roles as readonly number[]).includes(userType);
}

/** Grupos y entradas visibles para un rol; los grupos que quedan vacíos se omiten. */
export function navGroupsForRole(userType: number | null, groups: readonly NavGroup[] = ADMIN_NAV_GROUPS): NavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => visibleTo(item, userType)),
  })).filter((group) => group.items.length > 0);
}

/** ¿Es esta entrada la página actual? Las `proximamente` nunca lo son. */
export function isNavItemCurrent(item: NavItem, pathname: string): boolean {
  if (item.status === "proximamente" || !item.href) return false;
  const path = trimSlash(pathname);
  const rule = item.match ?? { exact: [item.href] };
  return Boolean(rule.exact?.some((p) => trimSlash(p) === path) || rule.prefix?.some((p) => path.startsWith(p)));
}

/**
 * Lo que ya se puede abrir (`funcional`), por área y sin grupos vacíos: es el cuerpo de la barra
 * lateral. Las `proximamente` no entran aquí (ver `upcomingNavGroups`).
 */
export function availableNavGroups(userType: number | null, groups: readonly NavGroup[] = ADMIN_NAV_GROUPS): NavGroup[] {
  return navGroupsForRole(userType, groups)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.status !== "proximamente" && item.href) }))
    .filter((group) => group.items.length > 0);
}

/**
 * Lo que aún no tiene pantalla (`proximamente`), conservando el área de la arquitectura del ERP a la que pertenece
 * cada módulo (Finanzas, Centro de Operaciones…). Alimenta la sección secundaria «Próximamente» de la barra.
 */
export function upcomingNavGroups(userType: number | null, groups: readonly NavGroup[] = ADMIN_NAV_GROUPS): NavGroup[] {
  return navGroupsForRole(userType, groups)
    .map((group) => ({ ...group, items: group.items.filter((item) => item.status === "proximamente") }))
    .filter((group) => group.items.length > 0);
}

export function countNavItems(groups: readonly NavGroup[]): number {
  return groups.reduce((total, group) => total + group.items.length, 0);
}

export interface Crumb {
  readonly label: string;
  /** Versión corta para pantallas angostas (solo si la etiqueta es larga). */
  readonly shortLabel?: string;
  /** Ausente en la última miga y en el grupo (no es una página). */
  readonly href?: string;
}

/**
 * Etiquetas cortas por entrada para las migas en móvil (una sola línea, sin texto cortado a medias). Solo hace falta
 * donde la etiqueta no cabe en ~150 px; las `proximamente` nunca son una página, así que no la usan hasta tener ruta.
 */
const SHORT_LABELS: Readonly<Record<string, string>> = {
  servicios: "Servicios",
};

/**
 * Migas simples a partir de la configuración: Grupo (o `breadcrumbRoot`) / Entrada (/ Subpágina o Detalle). Una ruta
 * que coincide con `subpages` usa su etiqueta; cualquier otra ruta distinta del `href` de la entrada es un «Detalle».
 */
export function breadcrumbsFor(pathname: string, groups: readonly NavGroup[] = ADMIN_NAV_GROUPS): Crumb[] {
  for (const group of groups) {
    for (const item of group.items) {
      if (!isNavItemCurrent(item, pathname)) continue;
      const short = SHORT_LABELS[item.id];
      const shortLabel = short ? { shortLabel: short } : {};
      const path = trimSlash(pathname);
      const isDetail = path !== trimSlash(item.href ?? "");
      const root: Crumb = item.breadcrumbRoot ?? { label: group.label };
      const subpage = item.subpages?.find((sub) => trimSlash(sub.path) === path);
      if (subpage) return [root, { label: item.label, ...shortLabel, href: item.href }, { label: subpage.label }];
      return isDetail
        ? [root, { label: item.label, ...shortLabel, href: item.href }, { label: "Detalle" }]
        : [root, { label: item.label, ...shortLabel }];
    }
  }
  return [];
}
