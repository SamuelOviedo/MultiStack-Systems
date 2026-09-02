import { useState, useEffect, type CSSProperties } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { getOpenTicketsCount } from "@/lib/tickets";
import Logo from "@/components/common/Logo";
import { useMsThemeVars } from "@/lib/msTokens";

const MONO = "'JetBrains Mono', monospace";

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

const Navbar = () => {
  const [openTickets, setOpenTickets] = useState(0);
  const { user, userType, loading, signOut } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const msVars = useMsThemeVars();
  const isClient = userType === 2;
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  useEffect(() => {
    if (!user || isClient) return;
    getOpenTicketsCount().then(setOpenTickets).catch(() => {});
  }, [user, isClient, location.pathname]);

  const scrollTo = (id: string) => {
    if (!isHome) {
      navigate("/");
      requestAnimationFrame(() =>
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
        }, 60)
      );
      return;
    }
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHome) {
      e.preventDefault();
      scrollTo("hero");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const toggleTheme = () => setTheme(resolvedTheme === "light" ? "dark" : "light");

  const sectionNav = [
    { label: "Inicio", id: "hero" },
    { label: "Servicios", id: "servicios" },
    { label: "Stack", id: "stack" },
    { label: "Contacto", id: "footer" },
  ];

  return (
    <nav
      style={{
        ...msVars,
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        height: "72px",
        background: "var(--nav-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border-soft)",
        transition: "border-color .45s, background .45s",
      }}
    >
      <div
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "0 32px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
        }}
      >
        <Link
          to="/"
          onClick={handleLogoClick}
          style={{ display: "flex", alignItems: "center", gap: "11px", textDecoration: "none" }}
        >
          <Logo className="h-7" />
          <span
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 700,
              fontSize: "16.5px",
              letterSpacing: "-0.02em",
              color: "var(--text)",
            }}
          >
            MultiStack <span style={{ color: "var(--text2)", fontWeight: 600 }}>Systems</span>
          </span>
        </Link>

        {isHome && (
          <div className="hidden md:flex" style={{ alignItems: "center", gap: "2px" }}>
            {sectionNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className="ms-navlink"
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "14.5px",
                  fontWeight: 500,
                  color: "var(--text2)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Link to="/dashboard" className="ms-cmd ms-cmd-primary" style={cmdPrimary}>[ PANEL ]</Link>
              <Link to="/dashboard/tickets" className="ms-cmd ms-cmd-ghost" style={{ ...cmdGhost, position: "relative" }}>
                [ SOPORTE ]
                {openTickets > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: "-4px",
                      right: "-4px",
                      minWidth: "16px",
                      height: "16px",
                      padding: "0 4px",
                      borderRadius: "8px",
                      background: "var(--accent)",
                      color: "#001018",
                      fontSize: "9px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {openTickets > 99 ? "99" : openTickets}
                  </span>
                )}
              </Link>
              <button type="button" onClick={handleLogout} className="ms-cmd ms-cmd-danger" style={cmdGhost}>[ SALIR ]</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
