import { useEffect, useId, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import Logo from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { getOpenTicketsCount } from "@/lib/tickets";
import type { PackageIntentId } from "@/lib/packageIntent";
import { cn } from "./cn";
import { SiteButton } from "./SiteButton";
import { SiteLink } from "./SiteLink";

export interface SiteNavItem {
  /** Ruta de la vista (`/planes`). Se marca activa cuando coincide con la ruta actual. */
  to: string;
  label: string;
}

export interface SiteHeaderCta {
  label: string;
  to: string;
  /** Nombre accesible, si el texto visible no basta. */
  ariaLabel?: string;
  /** Paquete que pide el CTA: se guarda como intención antes de navegar (ver SiteLink). */
  packageId?: PackageIntentId;
}

/** Textos fijos de la interfaz del encabezado. Todos opcionales: los valores por omisión son los del sitio. */
export interface SiteHeaderLabels {
  /** Nombre accesible del logo (enlace a la home). */
  home: string;
  /** `aria-label` de la navegación de escritorio. */
  navigation: string;
  /** `aria-label` de la navegación del menú móvil. */
  mobileNavigation: string;
  /** Nombre del botón del menú móvil; el estado lo dice `aria-expanded`. */
  menu: string;
  /** Sin sesión: acceso al panel (va a /login). */
  login: string;
  /** Cliente: sus solicitudes. */
  requests: string;
  /** Administrador: el panel. */
  panel: string;
  /** Administrador: bandeja de tickets. */
  tickets: string;
  signOut: string;
  /** Texto para lectores de pantalla junto al contador de tickets abiertos. */
  openTickets: (count: number) => string;
}

const DEFAULT_LABELS: SiteHeaderLabels = {
  home: "MultiStack Systems, ir al inicio",
  navigation: "Principal",
  mobileNavigation: "Menú principal",
  menu: "Menú",
  login: "[ mi panel ]",
  requests: "[ SOLICITUDES ]",
  panel: "[ PANEL ]",
  tickets: "[ TICKETS ]",
  signOut: "[ SALIR ]",
  openTickets: (count) => `${count} abiertos`,
};

export interface SiteHeaderProps {
  nav: readonly SiteNavItem[];
  /** «Cotizar mi web». Solo se muestra sin sesión, como el CTA de la barra actual. */
  cta: SiteHeaderCta;
  labels?: Partial<SiteHeaderLabels>;
}

/** Desde este ancho (Tailwind `md`, 768 px) se muestra la navegación de escritorio. */
const DESKTOP_QUERY = "(min-width: 768px)";

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring focus-visible:ring-offset-2 focus-visible:ring-offset-site-background";

const PILL = cn(
  "rounded-full px-4 py-2 text-sm text-site-muted-foreground transition-colors duration-200 hover:text-site-foreground",
  FOCUS_RING,
);
const PILL_ACTIVE = "bg-site-secondary text-site-foreground";

const MOBILE_ROW = cn(
  "flex min-h-11 w-full items-center gap-2 rounded-site-lg px-3 py-3 text-left transition-colors duration-200 hover:bg-site-secondary/60",
  FOCUS_RING,
);

type SessionItem =
  | { kind: "link"; key: string; to: string; label: string; badge?: number }
  | { kind: "signout"; key: string; label: string };

interface Session {
  loading: boolean;
  signedIn: boolean;
  isClient: boolean;
  isAdmin: boolean;
  openTickets: number;
}

/**
 * Qué se ofrece según la sesión (misma lógica que `Navbar`): sin sesión, el acceso; el cliente, sus solicitudes;
 * solo el administrador tiene panel y tickets (el colaborador y el rol aún sin resolver solo pueden salir). Ocultar
 * enlaces no es una barrera: la barrera real es ProtectedRoute y RLS.
 */
function sessionItems(session: Session, labels: SiteHeaderLabels): SessionItem[] {
  const signOut: SessionItem = { kind: "signout", key: "signout", label: labels.signOut };
  if (!session.signedIn) return [{ kind: "link", key: "login", to: "/login", label: labels.login }];
  if (session.isClient) return [{ kind: "link", key: "requests", to: "/solicitudes", label: labels.requests }, signOut];
  if (session.isAdmin) {
    return [
      { kind: "link", key: "panel", to: "/dashboard", label: labels.panel },
      { kind: "link", key: "tickets", to: "/dashboard/tickets", label: labels.tickets, badge: session.openTickets },
      signOut,
    ];
  }
  return [signOut];
}

function TicketBadge({ count, label }: { count: number; label: string }) {
  if (count <= 0) return null;
  return (
    <>
      {" "}
      <span
        aria-hidden="true"
        className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-site-primary-deep px-1 font-sans text-[9px] font-bold text-site-primary-foreground"
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="sr-only">{label}</span>
    </>
  );
}

interface SessionControlsProps {
  items: SessionItem[];
  labels: SiteHeaderLabels;
  layout: "desktop" | "mobile";
  onSignOut: () => void;
}

function SessionControls({ items, labels, layout, onSignOut }: SessionControlsProps) {
  return (
    <>
      {items.map((item) => {
        if (layout === "desktop") {
          const content = (
            <>
              {item.label}
              {item.kind === "link" && item.badge !== undefined && (
                <TicketBadge count={item.badge} label={labels.openTickets(item.badge)} />
              )}
            </>
          );
          const cls = "relative px-4 font-mono text-xs";
          return item.kind === "link" ? (
            <SiteButton key={item.key} asChild variant="glass" size="sm" className={cls}>
              <SiteLink to={item.to}>{content}</SiteLink>
            </SiteButton>
          ) : (
            <SiteButton key={item.key} variant="glass" size="sm" className={cls} onClick={onSignOut}>
              {item.label}
            </SiteButton>
          );
        }
        const tone = item.kind === "link" && item.key !== "tickets" ? "text-site-primary-text" : "text-site-muted-foreground";
        return item.kind === "link" ? (
          <SiteLink key={item.key} to={item.to} className={cn(MOBILE_ROW, "relative font-mono", tone)}>
            {item.label}
            {item.badge !== undefined && item.badge > 0 && " "}
            {item.badge !== undefined && item.badge > 0 && (
              <span
                aria-hidden="true"
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-site-primary-deep px-1 font-sans text-[9px] font-bold text-site-primary-foreground"
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
            {item.badge !== undefined && item.badge > 0 && <span className="sr-only">{labels.openTickets(item.badge)}</span>}
          </SiteLink>
        ) : (
          <button key={item.key} type="button" onClick={onSignOut} className={cn(MOBILE_ROW, "font-mono", tone)}>
            {item.label}
          </button>
        );
      })}
    </>
  );
}

const pathOf = (to: string): string => to.split(/[?#]/)[0] || "/";

/**
 * Encabezado del sitio público (port del `Header` de la referencia): isotipo oficial, navegación en píldoras con
 * estado activo, acceso según la sesión y «Cotizar mi web». Bajo 768 px la navegación pasa a un menú desplegable.
 *
 * Menú móvil (patrón de divulgación, no un diálogo modal): el botón lleva `aria-expanded` y `aria-controls`; el panel
 * existe siempre (oculto con `hidden`) para que `aria-controls` apunte a algo; Escape lo cierra y devuelve el foco al
 * botón; también se cierra al navegar y al crecer la ventana hasta el escritorio. No atrapa el foco: el panel es lo
 * siguiente en el orden del documento y el resto de la página sigue accesible.
 *
 * Los enlaces internos pasan por `SiteLink` (conservan la query de atribución de Ads). La sesión sale de `useAuth` y
 * el contador de tickets de `lib/tickets`, igual que `Navbar`; este componente no habla con Supabase.
 */
export function SiteHeader({ nav, cta, labels: labelOverrides }: SiteHeaderProps) {
  const labels: SiteHeaderLabels = { ...DEFAULT_LABELS, ...labelOverrides };
  const [open, setOpen] = useState(false);
  const [openTickets, setOpenTickets] = useState(0);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { user, userType, loading, signOut } = useAuth();
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();

  const isClient = userType === 2;
  // Solo el administrador tiene panel; el colaborador (1) aún no tiene zona propia (ver Navbar).
  const isAdmin = userType === 0;

  useEffect(() => {
    if (!user || !isAdmin) return;
    let alive = true;
    getOpenTicketsCount()
      .then((count) => alive && setOpenTickets(count))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user, isAdmin, pathname]);

  // Cerrar al navegar (ruta, query o ancla).
  useEffect(() => {
    setOpen(false);
  }, [pathname, search, hash]);

  // Mientras está abierto: Escape cierra y devuelve el foco al botón; crecer hasta el escritorio lo cierra.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("keydown", onKeyDown);

    let list: MediaQueryList | undefined;
    const onChange = () => {
      if (list?.matches) setOpen(false);
    };
    if (typeof window.matchMedia === "function") {
      list = window.matchMedia(DESKTOP_QUERY);
      list.addEventListener("change", onChange);
    }
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      list?.removeEventListener("change", onChange);
    };
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate("/");
  };

  const items = loading ? [] : sessionItems({ loading, signedIn: !!user, isClient, isAdmin, openTickets }, labels);
  const showCta = !user;
  const isActive = (to: string) => pathname === pathOf(to);

  return (
    <header className="sticky top-0 z-50 border-b border-site-border/60 bg-site-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5">
        <SiteLink to="/" className={cn("flex items-center rounded-site-md", FOCUS_RING)}>
          {/* Isotipo oficial, versión para fondo oscuro (el sitio es solo oscuro, sea cual sea el tema de la app).
              Proporción original: solo se fija la altura. */}
          <Logo variant="isotipo" tone="light" priority alt={labels.home} className="h-9" />
        </SiteLink>

        <nav aria-label={labels.navigation} className="hidden items-center gap-1 md:flex">
          {nav.map((item) => (
            <SiteLink
              key={item.to}
              to={item.to}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={cn(PILL, isActive(item.to) && PILL_ACTIVE)}
            >
              {item.label}
            </SiteLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <span aria-hidden="true" className="px-4 font-mono text-xs text-site-muted-foreground">
              [ ... ]
            </span>
          ) : (
            <SessionControls items={items} labels={labels} layout="desktop" onSignOut={handleSignOut} />
          )}
          {showCta && (
            <SiteButton asChild variant="hero" size="sm" className="px-5">
              <SiteLink to={cta.to} aria-label={cta.ariaLabel} packageId={cta.packageId}>
                {cta.label}
              </SiteLink>
            </SiteButton>
          )}
        </div>

        <button
          ref={toggleRef}
          type="button"
          aria-label={labels.menu}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-site-md text-site-foreground transition-colors duration-200 hover:bg-site-secondary/60 md:hidden",
            FOCUS_RING,
          )}
        >
          {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
        </button>
      </div>

      <div id={menuId} hidden={!open} className="border-t border-site-border md:hidden">
        <nav aria-label={labels.mobileNavigation} className="site-menu-in mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
          {nav.map((item) => (
            <SiteLink
              key={item.to}
              to={item.to}
              aria-current={isActive(item.to) ? "page" : undefined}
              className={cn(MOBILE_ROW, "text-site-muted-foreground", isActive(item.to) && PILL_ACTIVE)}
            >
              {item.label}
            </SiteLink>
          ))}
          <div aria-hidden="true" className="my-2 h-px bg-site-border" />
          {loading ? (
            <span aria-hidden="true" className="px-3 py-3 font-mono text-site-muted-foreground">
              [ ... ]
            </span>
          ) : (
            <SessionControls items={items} labels={labels} layout="mobile" onSignOut={handleSignOut} />
          )}
          {showCta && (
            <SiteButton asChild variant="hero" size="lg" className="mt-2 w-full">
              <SiteLink to={cta.to} aria-label={cta.ariaLabel} packageId={cta.packageId}>
                {cta.label}
              </SiteLink>
            </SiteButton>
          )}
        </nav>
      </div>
    </header>
  );
}
