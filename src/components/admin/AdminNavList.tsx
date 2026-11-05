import { useId, useState } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  availableNavGroups,
  countNavItems,
  isNavItemCurrent,
  upcomingNavGroups,
  type NavGroup,
  type NavItem,
} from "./adminNav";

interface AdminNavListProps {
  /** Rol de la sesión (solo presentación: la autorización real está en ProtectedRoute y RLS). */
  userType: number | null;
  pathname: string;
  /** Barra lateral plegada: solo iconos. En el cajón móvil siempre es `false`. */
  collapsed: boolean;
  /** Conteo real de tickets abiertos (0 = sin insignia). */
  openTickets: number;
  /** Se llama al elegir un enlace (cierra el cajón móvil). */
  onNavigate?: () => void;
  /** Pide expandir la barra lateral plegada. Solo la barra de escritorio lo usa (desde el botón «Próximamente»). */
  onExpand?: () => void;
}

// 44 px de área táctil en el cajón móvil (< 1024 px); en la barra de escritorio, los 36 px de siempre.
const ROW =
  "relative flex min-h-11 items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 text-sm leading-5 lg:min-h-9 " +
  "transition-colors duration-150 motion-reduce:transition-none";

const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

function ticketCount(n: number): string {
  return n > 99 ? "99+" : String(n);
}

/** Entrada con pantalla (`funcional`): siempre un enlace real. */
function NavEntry({
  item,
  current,
  collapsed,
  openTickets,
  onNavigate,
}: {
  item: NavItem;
  current: boolean;
  collapsed: boolean;
  openTickets: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const showCount = item.badge === "openTickets" && openTickets > 0;
  if (!item.href) return null;

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cn(
        ROW,
        "text-foreground hover:bg-card hover:border-border",
        FOCUS_RING,
        "aria-[current=page]:border-border aria-[current=page]:bg-card aria-[current=page]:font-medium aria-[current=page]:shadow-card",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("size-4 shrink-0", current && "text-primary")} aria-hidden="true" />
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>{item.label}</span>
      {showCount && !collapsed && (
        <span className="tabular shrink-0 rounded-full border border-border bg-card px-1.5 text-xs font-medium leading-4 text-foreground">
          {ticketCount(openTickets)}
          <span className="sr-only"> abiertos</span>
        </span>
      )}
      {showCount && collapsed && (
        <>
          <span aria-hidden="true" className="absolute right-2 top-1.5 size-2 rounded-full bg-primary" />
          <span className="sr-only">, {ticketCount(openTickets)} abiertos</span>
        </>
      )}
    </Link>
  );
}

/**
 * Módulo sin ruta: texto atenuado (contraste AA), sin enlace y sin foco. No lleva una insignia «Pronto» por fila:
 * lo dice el título de la sección. Su área (Finanzas, Administración…) la da el encabezado de su lista.
 */
function UpcomingEntry({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <span
      aria-disabled="true"
      className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-1 text-sm leading-5 text-muted-foreground"
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">{item.label}</span>
    </span>
  );
}

/**
 * Sección secundaria al final de la barra: los módulos que aún no tienen pantalla, agrupados por su área. Cerrada
 * por defecto; con la barra plegada queda un único botón de icono que, al pulsarlo, expande la barra y la abre
 * (es el mismo elemento, así que el foco no se pierde).
 */
function UpcomingSection({
  groups,
  collapsed,
  uid,
  onExpand,
}: {
  groups: readonly NavGroup[];
  collapsed: boolean;
  uid: string;
  onExpand?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const count = countNavItems(groups);
  const panelId = `${uid}-upcoming`;
  const shown = open && !collapsed;

  const onClick = () => {
    if (collapsed) {
      setOpen(true);
      onExpand?.();
      return;
    }
    setOpen(!open);
  };

  return (
    <div className="border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={shown}
        aria-controls={panelId}
        onClick={onClick}
        title={collapsed ? `Próximamente (${count} módulos)` : undefined}
        className={cn(
          ROW,
          "w-full text-left text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
          FOCUS_RING,
          collapsed && "justify-center px-0",
        )}
      >
        <Clock className="size-4 shrink-0" aria-hidden="true" />
        <span className={collapsed ? "sr-only" : "min-w-0 flex-1"}>Próximamente</span>{" "}
        <span
          className={
            collapsed
              ? "sr-only"
              : "tabular shrink-0 rounded-full border border-border px-1.5 text-xs font-medium leading-4"
          }
        >
          {count}{" "}
          <span className="sr-only">módulos</span>
        </span>
        {!collapsed && (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
              shown && "rotate-180",
            )}
          />
        )}
      </button>
      {/* Siempre en el árbol (aria-controls apunta a él); `hidden` lo saca del diseño y de las tecnologías de apoyo. */}
      <div id={panelId} hidden={!shown}>
        {groups.map((group) => {
          const labelId = `${uid}-up-${group.id}`;
          return (
            <div key={group.id} className="mt-2">
              <div id={labelId} className="px-2 pb-0.5 text-xs font-medium text-muted-foreground">
                {group.label}
              </div>
              <ul aria-labelledby={labelId} className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <UpcomingEntry item={item} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Lista de navegación agrupada. Se usa en la barra lateral y dentro del cajón móvil. */
export default function AdminNavList({
  userType,
  pathname,
  collapsed,
  openTickets,
  onNavigate,
  onExpand,
}: AdminNavListProps) {
  const uid = useId();
  const groups = availableNavGroups(userType);
  const upcoming = upcomingNavGroups(userType);
  return (
    <nav aria-label="Principal" className="flex flex-1 flex-col overflow-y-auto px-3 py-3">
      {groups.map((group, index) => {
        const labelId = `${uid}-${group.id}`;
        return (
          <div
            key={group.id}
            className={cn("shrink-0", index > 0 && (collapsed ? "mt-3 border-t border-border pt-3" : "mt-5"))}
          >
            <div
              id={labelId}
              className={collapsed ? "sr-only" : "px-2 pb-1 text-xs font-medium text-muted-foreground"}
            >
              {group.label}
            </div>
            <ul aria-labelledby={labelId} className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavEntry
                    item={item}
                    current={isNavItemCurrent(item, pathname)}
                    collapsed={collapsed}
                    openTickets={openTickets}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {upcoming.length > 0 && (
        <div className={cn("mt-auto shrink-0", collapsed ? "pt-3" : "pt-5")}>
          <UpcomingSection groups={upcoming} collapsed={collapsed} uid={uid} onExpand={onExpand} />
        </div>
      )}
    </nav>
  );
}
