import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { getOpenTicketsCount } from "@/lib/tickets";
import Logo from "@/components/common/Logo";
import { cinematicToken, cinematicVars, useMsThemeVars } from "@/lib/msTokens";
import { useCinematicTheme } from "@/hooks/useCinematicTheme";
import { rememberPackageIntent } from "@/lib/packageIntent";
import type { HomeNav } from "@/components/common/legacyNav";

const MONO = "'JetBrains Mono', monospace";

// Drawer (shadcn Sheet + react-remove-scroll…) en su propio chunk: el Navbar
// vive en el chunk de entrada que comparte /dashboard.
const MobileNavDrawer = lazy(() => import("@/components/common/MobileNavDrawer"));

const cmdGhost: CSSProperties = {
  fontFamily: MONO,
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.04em",
  color: "var(--text2)",
  background: "none",
  cursor: "pointer",
  padding: "8px 13px",
  borderRadius: "8px",
  whiteSpace: "nowrap",
  border: "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  textDecoration: "none",
};

const cmdPrimary: CSSProperties = {
  fontFamily: MONO,
  fontSize: "12px",
  fontWeight: 500,
  letterSpacing: "0.04em",
  color: "var(--primary)",
  cursor: "pointer",
  padding: "8px 14px",
  borderRadius: "8px",
  whiteSpace: "nowrap",
  border: "1px solid var(--border-accent)",
  background: "var(--primary-soft)",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  textDecoration: "none",
};

const mobileLink: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "12px",
  borderRadius: "8px",
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--text)",
  background: "none",
  border: "none",
  cursor: "pointer",
  minHeight: "44px",
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: "8px",
};

interface SectionLink {
  label: string;
  id: string;
}

/**
 * Section anchors for the `homeNav` prop (shape and legacy copy in `legacyNav.ts`).
 * Rendered ONLY when `isHome` and the page passes it. No page passes it any more
 * (the public site has its own header, `SiteHeader`): the dashboard, client and
 * legal pages never show them.
 */
const NO_SECTIONS: readonly SectionLink[] = [];

function sectionLinks(nav: HomeNav | undefined): readonly SectionLink[] {
  if (!nav) return NO_SECTIONS;
  return nav.items.map((item) => ({ label: item.label, id: item.href.replace(/^#/, "") }));
}

const NAV_HEIGHT = 72;
/** Desktop navigation from Tailwind `lg` (1024px) up; below it, only the drawer. */
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * Desktop link: color transition + underline that grows from the left via
 * `transform: scaleX` (no layout shift). Active section = same underline,
 * brighter text. Colors resolve from the bar's MS variables.
 */
const DESKTOP_LINK = [
  "relative rounded-md px-3 py-2 text-[14.5px] font-medium xl:px-3.5",
  "text-[color:var(--text2)] transition-colors duration-200 hover:text-[color:var(--text)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
  "after:pointer-events-none after:absolute after:inset-x-3 after:bottom-1 after:h-px after:rounded-full xl:after:inset-x-3.5",
  "after:origin-left after:scale-x-0 after:bg-[color:var(--primary)] after:transition-transform after:duration-200 after:ease-out",
  "hover:after:scale-x-100 aria-[current=location]:text-[color:var(--text)] aria-[current=location]:after:scale-x-100",
  "motion-reduce:transition-none motion-reduce:after:transition-none",
].join(" ");

/** Drawer link: full-width row, tinted when it is the active section. */
const DRAWER_LINK = [
  "flex min-h-[48px] w-full items-center justify-between rounded-lg px-3 text-left text-[15px] font-semibold",
  "text-[color:var(--text)] transition-colors duration-200 hover:bg-[color:var(--hover-bg)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
  "aria-[current=location]:bg-[color:var(--primary-soft)] aria-[current=location]:text-[color:var(--primary)]",
].join(" ");

/** Visibility ONLY through classes: an inline `display` would override `lg:hidden`. */
const BURGER = [
  "flex h-10 w-10 flex-none cursor-pointer flex-col items-center justify-center gap-[5px] p-0 lg:hidden",
  "rounded-lg border border-solid border-[color:var(--border)] bg-transparent",
  "transition-colors duration-200 hover:bg-[color:var(--hover-bg)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]",
].join(" ");

/**
 * overlay: true while an element marked `data-nav-overlay` (the cinematic
 * scenes) is still under the bar. rAF-throttled passive scroll listener.
 */
function useOverCinematic(enabled: boolean): boolean {
  const [over, setOver] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      const el = document.querySelector<HTMLElement>("[data-nav-overlay]");
      setOver(!!el && el.getBoundingClientRect().bottom > NAV_HEIGHT);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [enabled]);

  return enabled && over;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface NavbarProps {
  variant?: "default" | "overlay";
  /** Section links and primary CTA of the home. Only shown at "/". */
  homeNav?: HomeNav;
  /** Called with the section id when a home link scrolls to it (the page can prepare that section). */
  onHomeNavigate?: (id: string) => void;
}

/**
 * @param variant "overlay": translucent glass bar that wears the cinematic
 * scene tokens (light or dark, like the imagery) while over the scenes. Only
 * honored on "/"; every other route always renders the solid themed bar.
 */
const Navbar = ({ variant = "default", homeNav, onHomeNavigate }: NavbarProps) => {
  const [openTickets, setOpenTickets] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerArmed, setDrawerArmed] = useState(false);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const { user, userType, loading, signOut } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const msVars = useMsThemeVars();
  const isClient = userType === 2;
  // Solo el administrador tiene panel. El colaborador (1) aún no tiene zona propia y, mientras el rol llega (null),
  // no se ofrece ningún enlace administrativo. Ocultar enlaces no es una barrera: la barrera real es ProtectedRoute y RLS.
  const isAdmin = userType === 0;
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";
  const overCinematic = useOverCinematic(variant === "overlay" && isHome);
  const sections = useMemo(() => sectionLinks(homeNav), [homeNav]);
  const sectionIds = useMemo(() => sections.map((s) => s.id), [sections]);
  const showHomeNav = isHome && sections.length > 0;
  const activeSection = useScrollSpy(sectionIds, showHomeNav);

  const cineTheme = useCinematicTheme();
  // The home's solid bar wears the AA-checked tones of the landing (as /paginas-web does):
  // the primary button on the bar needs 4.5:1 in light mode.
  const navVars: CSSProperties = overCinematic || showHomeNav ? cinematicVars(cineTheme) : msVars;

  useEffect(() => {
    if (!user || !isAdmin) return;
    getOpenTicketsCount().then(setOpenTickets).catch(() => {});
  }, [user, isAdmin, location.pathname]);

  // Cerrar el drawer al cambiar de ruta.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Cerrar el drawer si la ventana crece hasta el layout de escritorio.
  useEffect(() => {
    if (!mobileOpen || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => {
      if (mql.matches) setMobileOpen(false);
    };
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mobileOpen]);

  /** Navega a una sección de la landing (desde cualquier ruta) y cierra el drawer. */
  const scrollToY = (top: number) =>
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });

  const goToSection = (id: string) => {
    setMobileOpen(false);
    if (!isHome) {
      navigate(`/#${id}`);
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    onHomeNavigate?.(id);
    // Rect-based: correct inside positioned containers and lands exactly below
    // the fixed bar (the old `offsetTop - 60` hid 12px of the section).
    scrollToY(el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT);
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHome) {
      e.preventDefault();
      scrollToY(0);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setMobileOpen(false);
    navigate("/");
  };

  const toggleTheme = () => setTheme(resolvedTheme === "light" ? "dark" : "light");

  const ticketBadge = (style: CSSProperties) =>
    openTickets > 0 && (
      <span
        style={{
          minWidth: "16px",
          height: "16px",
          padding: "0 4px",
          borderRadius: "8px",
          background: "var(--accent)",
          color: "#001018",
          fontSize: "9px",
          fontWeight: 700,
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        {openTickets > 99 ? "99" : openTickets}
      </span>
    );

  return (
    <nav
      aria-label="Principal"
      style={{
        ...navVars,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        minHeight: `${NAV_HEIGHT}px`,
        // Over the cinematic scenes: lighter glass so the imagery reads through.
        background: overCinematic ? cinematicToken(cineTheme, "cine-nav-bg") : "var(--nav-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: overCinematic ? "1px solid transparent" : "1px solid var(--border-soft)",
        transition: "border-color .45s, background .45s",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 32px",
          height: `${NAV_HEIGHT}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        <Link
          to="/"
          onClick={handleLogoClick}
          style={{ display: "flex", alignItems: "center", textDecoration: "none", flex: "none" }}
        >
          {/* Isotipo + rótulo oficiales (el rótulo ya dice «MultiStack SYSTEMS»: no se repite como texto). */}
          <Logo priority className="h-7" tone={overCinematic && cineTheme === "dark" ? "light" : "auto"} />
        </Link>

        {/* Enlaces de sección: solo landing, solo ≥ 1024px */}
        {showHomeNav && (
          <ul role="list" className="m-0 hidden list-none items-center gap-0.5 p-0 lg:flex">
            {sections.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => goToSection(item.id)}
                  aria-current={activeSection === item.id ? "location" : undefined}
                  className={DESKTOP_LINK}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: "none" }}>
          {/* Theme toggle — track + knob (Notion light ⟷ Kiro dark) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
            style={{
              position: "relative",
              width: "56px",
              height: "29px",
              borderRadius: "999px",
              border: "1px solid var(--track-border)",
              background: "var(--track-bg)",
              cursor: "pointer",
              padding: 0,
              transition: "background .4s, border-color .4s",
              flex: "none",
            }}
          >
            <span style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", opacity: "var(--sun-op)", transition: "opacity .4s" }}>☀</span>
            <span style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "10px", opacity: "var(--moon-op)", transition: "opacity .4s" }}>☾</span>
            <span
              style={{
                position: "absolute",
                top: "3px",
                left: 0,
                width: "21px",
                height: "21px",
                borderRadius: "50%",
                background: "var(--knob-bg)",
                boxShadow: "var(--knob-shadow)",
                transform: "translateX(var(--knob-x))",
                transition: "transform .35s cubic-bezier(.4,1.3,.5,1), background .4s, box-shadow .4s",
              }}
            />
          </button>

          {/* Primary CTA of the home, only without a session (clients and admins already have their own links;
              with the admin's [ TICKETS ] and [ SALIR ] it would clip the bar at 1120-1155px). From 1120px: at 1024px
              it would push the auth buttons out (measured). Below 1024px it is the first item of the drawer; in
              between the hero carries it. */}
          {showHomeNav && homeNav && !user && (
            <Link
              to={homeNav.cta.href}
              aria-label={homeNav.cta.ariaLabel}
              className="ms-home-navcta hidden min-[1120px]:inline-flex"
              onClick={() => rememberPackageIntent(homeNav.packageId)}
              onAuxClick={(e) => {
                if (e.button === 1) rememberPackageIntent(homeNav.packageId);
              }}
            >
              {homeNav.cta.label}
            </Link>
          )}

          {/* Auth desktop (≥ 1024px); debajo vive en el drawer */}
          <div className="hidden items-center lg:flex">
            {loading ? (
              <span style={{ ...cmdGhost, border: "1px solid var(--border-soft)" }} aria-hidden>
                [ ... ]
              </span>
            ) : !user ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Link to="/login" className="ms-cmd ms-cmd-ghost" style={cmdGhost}>[ ACCEDER ]</Link>
                <Link to="/signup" className="ms-cmd ms-cmd-primary" style={cmdPrimary}>[ REGISTRARSE ]</Link>
              </div>
            ) : isClient ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Link to="/solicitudes" className="ms-cmd ms-cmd-primary" style={cmdPrimary}>[ SOLICITUDES ]</Link>
                <button type="button" onClick={handleLogout} className="ms-cmd ms-cmd-danger" style={cmdGhost}>[ SALIR ]</button>
              </div>
            ) : isAdmin ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Link to="/dashboard" className="ms-cmd ms-cmd-primary" style={cmdPrimary}>[ PANEL ]</Link>
                <Link to="/dashboard/tickets" className="ms-cmd ms-cmd-ghost" style={{ ...cmdGhost, position: "relative" }}>
                  [ TICKETS ]
                  {ticketBadge({ position: "absolute", top: "-4px", right: "-4px", display: "flex" })}
                </Link>
                <button type="button" onClick={handleLogout} className="ms-cmd ms-cmd-danger" style={cmdGhost}>[ SALIR ]</button>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button type="button" onClick={handleLogout} className="ms-cmd ms-cmd-danger" style={cmdGhost}>[ SALIR ]</button>
              </div>
            )}
          </div>

          {/* Drawer móvil/tablet (< 1024px). El botón es eager; el Sheet se
              descarga en la primera intención (hover/focus/touch) o al clic.
              Visibilidad SOLO por clases: un `display` inline anularía `lg:hidden`. */}
          <button
            ref={burgerRef}
            type="button"
            aria-label="Abrir menú"
            aria-haspopup="dialog"
            aria-expanded={mobileOpen}
            className={BURGER}
            onPointerEnter={() => setDrawerArmed(true)}
            onFocus={() => setDrawerArmed(true)}
            onTouchStart={() => setDrawerArmed(true)}
            onClick={() => {
              setDrawerArmed(true);
              setMobileOpen(true);
            }}
          >
            {[0, 1, 2].map((i) => (
              <span key={i} aria-hidden="true" className="h-0.5 w-[18px] rounded-sm bg-[color:var(--text)]" />
            ))}
          </button>
          {(drawerArmed || mobileOpen) && (
            <Suspense fallback={null}>
              <MobileNavDrawer open={mobileOpen} onOpenChange={setMobileOpen} returnFocusRef={burgerRef} vars={navVars}>
                {showHomeNav && homeNav && (
                  <>
                    {!user && (
                      <>
                        <Link
                          to={homeNav.cta.href}
                          aria-label={homeNav.cta.ariaLabel}
                          className="ms-home-navcta ms-home-navcta--block"
                          onClick={() => {
                            rememberPackageIntent(homeNav.packageId);
                            setMobileOpen(false);
                          }}
                        >
                          {homeNav.cta.label}
                        </Link>
                        <div aria-hidden="true" style={{ height: "1px", background: "var(--border-soft)", margin: "14px 0" }} />
                      </>
                    )}
                    <ul role="list" className="m-0 flex list-none flex-col gap-1 p-0">
                      {sections.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => goToSection(item.id)}
                            aria-current={activeSection === item.id ? "location" : undefined}
                            className={DRAWER_LINK}
                          >
                            {item.label}
                            <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: "12px", opacity: 0.6 }}>
                              →
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div aria-hidden="true" style={{ height: "1px", background: "var(--border-soft)", margin: "14px 0" }} />
                  </>
                )}

                {loading ? (
                  <span style={{ ...cmdGhost, border: "1px solid var(--border-soft)" }} aria-hidden>
                    [ ... ]
                  </span>
                ) : !user ? (
                  <>
                    <Link to="/login" className="ms-mobile-link" style={{ ...mobileLink, color: "var(--primary)" }} onClick={() => setMobileOpen(false)}>
                      [ ACCEDER ]
                    </Link>
                    <Link to="/signup" className="ms-mobile-link" style={{ ...mobileLink, color: "var(--primary)" }} onClick={() => setMobileOpen(false)}>
                      [ REGISTRARSE ]
                    </Link>
                  </>
                ) : isClient ? (
                  <>
                    <Link to="/solicitudes" className="ms-mobile-link" style={{ ...mobileLink, color: "var(--primary)" }} onClick={() => setMobileOpen(false)}>
                      [ SOLICITUDES ]
                    </Link>
                    <button type="button" onClick={handleLogout} className="ms-mobile-link" style={{ ...mobileLink, color: "var(--text2)" }}>
                      [ SALIR ]
                    </button>
                  </>
                ) : isAdmin ? (
                  <>
                    <Link to="/dashboard" className="ms-mobile-link" style={{ ...mobileLink, color: "var(--primary)" }} onClick={() => setMobileOpen(false)}>
                      [ PANEL ]
                    </Link>
                    <Link
                      to="/dashboard/tickets"
                      className="ms-mobile-link"
                      style={{ ...mobileLink, color: "var(--text2)", position: "relative" }}
                      onClick={() => setMobileOpen(false)}
                    >
                      [ TICKETS ]
                      {ticketBadge({ display: "inline-flex" })}
                    </Link>
                    <button type="button" onClick={handleLogout} className="ms-mobile-link" style={{ ...mobileLink, color: "var(--text2)" }}>
                      [ SALIR ]
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={handleLogout} className="ms-mobile-link" style={{ ...mobileLink, color: "var(--text2)" }}>
                    [ SALIR ]
                  </button>
                )}
              </MobileNavDrawer>
            </Suspense>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
