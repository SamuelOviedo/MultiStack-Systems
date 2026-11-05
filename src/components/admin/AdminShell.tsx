import { Fragment, Suspense, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { ChevronLeft, ChevronRight, Globe, LogOut, Menu, Moon, PanelLeft, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { getOpenTicketsCount } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import BrandLoader from "@/components/common/BrandLoader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PortalContainerProvider } from "@/components/ui/portal-container-context";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import AdminNavList from "./AdminNavList";
import BrandMark from "./BrandMark";
import { breadcrumbsFor, type Crumb } from "./adminNav";
import { useSidebarCollapsed } from "./useSidebarCollapsed";
import "@/assets/fonts/erp-fonts.css";

// 44×44 px de área táctil por debajo de 1024 px; en escritorio, los 36 px de siempre.
const ICON_BUTTON =
  "inline-flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground lg:h-9 lg:min-w-9 " +
  "transition-colors duration-150 hover:bg-muted hover:text-foreground motion-reduce:transition-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Cajón móvil: 200 ms al abrir y 150 ms al cerrar (el Sheet base dura 500/300),
 * curva ease-out fuerte y, con movimiento reducido, solo fundido.
 */
/** El Sheet dibuja su «X» como hijo directo (16 px, `right-4 top-4`): aquí se agranda a 44 px sobre la franja de marca. */
const DRAWER_CLOSE = [
  "[&>button]:right-2 [&>button]:top-1.5 [&>button]:grid [&>button]:size-11",
  "[&>button]:place-items-center [&>button]:rounded-md",
].join(" ");

const DRAWER_MOTION = [
  "data-[state=open]:duration-200 data-[state=closed]:duration-150",
  "[animation-timing-function:cubic-bezier(0.23,1,0.32,1)]",
  "motion-reduce:data-[state=open]:slide-in-from-left-0 motion-reduce:data-[state=closed]:slide-out-to-left-0",
].join(" ");

const ROLE_LABELS: Record<number, string> = { 0: "Administrador", 1: "Colaborador" };

/** Conteo real de tickets abiertos (mismo dato que mostraba el Navbar); se relee al cambiar de ruta. */
function useOpenTickets(userId: string | undefined, pathname: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getOpenTicketsCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, pathname]);
  return count;
}

function initialOf(email: string | undefined): string {
  return (email?.trim().charAt(0) || "?").toUpperCase();
}

/** El correo completo, con un punto de salto limpio justo después de la arroba (el texto no cambia ni se recorta). */
function EmailText({ email }: { email: string }) {
  const at = email.indexOf("@");
  if (at < 0) return <>{email}</>;
  return (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

/** Etiqueta de una miga: en pantallas angostas usa la versión corta (si existe) para no cortar el texto. */
function CrumbLabel({ crumb }: { crumb: Crumb }) {
  if (!crumb.shortLabel) return <>{crumb.label}</>;
  return (
    <>
      <span className="md:hidden">{crumb.shortLabel}</span>
      <span className="hidden md:inline">{crumb.label}</span>
    </>
  );
}

/**
 * Migas de pan. Desde 768 px se ven completas (Grupo › Entrada › Detalle). Por debajo es UNA sola miga en una línea,
 * sin texto cortado a medias: la actual o, en un detalle, un enlace corto «‹ Proyectos» al padre (la página de
 * detalle ya trae su propio «Volver»). El resto sigue en la lista, solo oculto por CSS.
 */
function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = breadcrumbsFor(pathname);
  if (crumbs.length === 0) return null;
  const narrowIndex = crumbs.length > 2 ? crumbs.length - 2 : crumbs.length - 1;
  return (
    <nav aria-label="Migas de pan" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          const showOnNarrow = i === narrowIndex;
          return (
            <Fragment key={`${crumb.label}-${i}`}>
              <li className={cn("min-w-0", !showOnNarrow && "hidden md:block")}>
                {crumb.href && !last ? (
                  <Link
                    to={crumb.href}
                    className="inline-flex min-h-11 items-center gap-0.5 rounded-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none md:min-h-0 md:gap-0"
                  >
                    <ChevronLeft className="size-4 shrink-0 md:hidden" aria-hidden="true" />
                    <CrumbLabel crumb={crumb} />
                  </Link>
                ) : (
                  <span
                    aria-current={last ? "page" : undefined}
                    className={cn("block truncate", last ? "font-medium text-foreground" : "text-muted-foreground")}
                  >
                    <CrumbLabel crumb={crumb} />
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="hidden text-muted-foreground md:block">
                  <ChevronRight className="size-3.5" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Bloque de marca de la barra lateral y del cajón. Expandido: logotipo completo de 80 px dentro de un bloque de 104 px
 * (12 px de aire arriba y abajo), alineado a la izquierda con los iconos del menú (16 px de bloque + 4 px del enlace =
 * 20 px, igual que 12 px de la lista + 8 px de cada fila). Sin línea inferior: una línea a 104 px junto a la de 56 px de
 * la cabecera daría dos filos desalineados en columnas contiguas; el espacio y el rótulo del primer grupo bastan para
 * separar. Plegado: isotipo de 32 px en un bloque de 56 px, centrado a la altura del botón de plegar, y ahí sí una línea
 * inferior que continúa la de la cabecera. El nombre accesible lo da BrandMark (el enlace no repite el texto).
 */
function BrandLink({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center",
        collapsed ? "h-14 justify-center border-b border-border" : "h-[104px] px-4",
      )}
    >
      <Link
        to="/dashboard"
        onClick={onNavigate}
        className="inline-flex rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {collapsed ? <BrandMark variant="isotipo" className="h-8" /> : <BrandMark variant="logo" className="h-20" />}
      </Link>
    </div>
  );
}

/**
 * Armazón del panel del administrador: barra lateral (256 px / 68 px plegada),
 * cabecera de 56 px, cajón móvil y contenido. Se carga perezoso (React.lazy en
 * App.tsx) y envuelve las páginas DENTRO de `ProtectedRoute`; el rol solo decide
 * qué entradas se dibujan, la autorización real sigue en la ruta y en RLS.
 */
export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, userType, signOut } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Elemento `.erp`: los menús y diálogos de Radix cuelgan de él para heredar los tokens.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const openTickets = useOpenTickets(user?.id, location.pathname);

  // El cajón se cierra al cambiar de ruta (también por teclado o por el botón Atrás).
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const isDark = resolvedTheme !== "light";
  const email = user?.email ?? undefined;
  const roleLabel = userType !== null ? ROLE_LABELS[userType] : undefined;

  // Mismo mecanismo que el Navbar: cerrar sesión y volver a la landing.
  const handleLogout = async () => {
    await signOut();
    setDrawerOpen(false);
    navigate("/");
  };

  const skipToContent = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    mainRef.current?.focus();
  };

  return (
    <div ref={setRoot} className="erp flex min-h-dvh w-full bg-background text-foreground">
      <PortalContainerProvider value={root}>
        <a
          href="#contenido"
          onClick={skipToContent}
          className="sr-only rounded-md border border-border bg-card px-3 py-2 text-sm font-medium shadow-card focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Saltar al contenido
        </a>

        {/* Barra lateral (≥ 1024 px). Por debajo, el mismo menú vive en el cajón. */}
        <div
          id="admin-sidebar"
          className={cn(
            "hidden shrink-0 border-r border-border bg-subtle lg:block",
            collapsed ? "w-[68px]" : "w-64",
          )}
        >
          <div className="sticky top-0 flex h-dvh flex-col">
            <BrandLink collapsed={collapsed} />
            <AdminNavList
              userType={userType}
              pathname={location.pathname}
              collapsed={collapsed}
              openTickets={openTickets}
              onExpand={() => {
                if (collapsed) toggleCollapsed();
              }}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background px-3 sm:px-4">
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button type="button" aria-label="Abrir menú" className={cn(ICON_BUTTON, "lg:hidden")}>
                  <Menu className="size-5" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                closeLabel="Cerrar menú"
                overlayClassName="bg-black/50"
                className={cn(
                  "flex w-72 max-w-[85vw] flex-col gap-0 border-r border-border bg-subtle p-0 shadow-none sm:max-w-[18rem]",
                  DRAWER_CLOSE,
                  DRAWER_MOTION,
                )}
              >
                <SheetTitle className="sr-only">Navegación del panel</SheetTitle>
                <SheetDescription className="sr-only">
                  Secciones del panel de administración y acceso a tu cuenta.
                </SheetDescription>
                <BrandLink collapsed={false} onNavigate={() => setDrawerOpen(false)} />
                <AdminNavList
                  userType={userType}
                  pathname={location.pathname}
                  collapsed={false}
                  openTickets={openTickets}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </SheetContent>
            </Sheet>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expandir barra lateral" : "Contraer barra lateral"}
              aria-expanded={!collapsed}
              aria-controls="admin-sidebar"
              className={cn(ICON_BUTTON, "hidden lg:inline-flex")}
            >
              <PanelLeft className="size-4" aria-hidden="true" />
            </button>

            <Breadcrumbs pathname={location.pathname} />

            <div className="ml-auto flex items-center gap-1">
              <Link to="/" className={cn(ICON_BUTTON, "gap-1.5 px-2.5 text-sm")}>
                <Globe className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Ver sitio</span>
              </Link>

              <button
                type="button"
                onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
                aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                className={ICON_BUTTON}
              >
                {isDark ? <Sun className="size-4" aria-hidden="true" /> : <Moon className="size-4" aria-hidden="true" />}
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger
                  title={email}
                  className={cn(ICON_BUTTON, "ml-1 gap-2 border border-border bg-card px-1.5 text-foreground md:px-2")}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium"
                  >
                    {initialOf(email)}
                  </span>
                  {/* El correo completo va en el nombre accesible; a la vista solo el rol, corto y estable. */}
                  <span className="sr-only">
                    {email ? `Cuenta: ${email}` : "Cuenta"}
                    {roleLabel ? "." : ""}
                  </span>
                  {roleLabel && (
                    <>
                      {" "}
                      <span className="hidden whitespace-nowrap pr-1 text-sm md:inline">{roleLabel}</span>
                    </>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-max min-w-60 max-w-[min(22rem,calc(100vw-1.5rem))]">
                  <DropdownMenuLabel className="font-normal">
                    <span title={email} className="block break-words text-sm font-medium text-foreground">
                      {email ? <EmailText email={email} /> : "Sesión activa"}
                    </span>
                    {roleLabel && <span className="block text-xs text-muted-foreground">{roleLabel}</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="min-h-11 lg:min-h-0" onSelect={() => void handleLogout()}>
                    <LogOut aria-hidden="true" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Las páginas traen su propio `min-h-screen` (de cuando vivían bajo el Navbar):
              aquí ocupan exactamente lo que queda bajo la cabecera y el relleno superior. */}
          <main
            id="contenido"
            ref={mainRef}
            tabIndex={-1}
            className="min-w-0 flex-1 pt-6 outline-none [&>.min-h-screen]:min-h-[calc(100dvh-5rem)]"
          >
            <Suspense
              fallback={
                <div className="flex justify-center py-24">
                  <BrandLoader />
                </div>
              }
            >
              {children}
            </Suspense>
          </main>
        </div>
      </PortalContainerProvider>
    </div>
  );
}
