import { useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { getTechonHref, isExternalHref } from "@/lib/products";
import { HOME_CONTENT } from "@/pages/marketing/homeContent";
import type { CSSProperties } from "react";
import { DevCredit } from "../../../snippets/credito-multistack/DevCredit";

const MONO = "'JetBrains Mono', monospace";

const colTitle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 600,
  color: "var(--text)",
  marginBottom: "14px",
};
const linkStyle: CSSProperties = {
  textAlign: "left",
  background: "none",
  border: "none",
  color: "var(--text2)",
  cursor: "pointer",
  padding: "3px 0",
  fontSize: "14px",
  textDecoration: "none",
};

const anchorLink: CSSProperties = {
  ...linkStyle,
  display: "inline-block",
};

const scrollTo = (id: string, navigate: ReturnType<typeof useNavigate>) => {
  const el = document.getElementById(id);
  // Rect-based, like the Navbar: lands exactly below the fixed 72px bar.
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (el) {
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72), behavior: reduced ? "auto" : "smooth" });
  } else navigate(`/#${id}`);
};

const Footer = () => {
  const navigate = useNavigate();
  const techonHref = getTechonHref();
  const techonExternal = isExternalHref(techonHref);

  return (
    <footer
      id="footer"
      style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border-soft)" }}
    >
      <div
        className="ms-footer-grid"
        style={{ maxWidth: "1200px", margin: "0 auto" }}
      >
        {/* Col 1 — brand */}
        <div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
            <Logo className="h-[26px]" />
          </div>
          <div
            style={{ fontFamily: MONO, fontSize: "12.5px", lineHeight: 1.7, color: "var(--text2)" }}
          >
            {HOME_CONTENT.footer.description}
            <br />
            {HOME_CONTENT.footer.location}
          </div>
        </div>

        {/* Col 2 — Navegación de la home (solo páginas web: ya no hay columna de productos) */}
        <div>
          <div style={colTitle}>MultiStack</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {HOME_CONTENT.nav.items.map((item) => (
              <button
                key={item.href}
                type="button"
                className="ms-foot-link"
                style={linkStyle}
                onClick={() => scrollTo(item.href.replace(/^#/, ""), navigate)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Col 3 — Cuenta + Legal */}
        <div>
          <div style={colTitle}>Cuenta</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => navigate("/login")}
            >
              Acceder
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => navigate("/signup")}
            >
              Registrarse
            </button>
            {techonExternal ? (
              <a
                href={techonHref}
                target="_blank"
                rel="noopener noreferrer"
                className="ms-foot-link"
                style={anchorLink}
              >
                TechOn ↗
              </a>
            ) : (
              <button
                type="button"
                className="ms-foot-link"
                style={linkStyle}
                onClick={() => navigate(techonHref)}
              >
                TechOn — Soporte
              </button>
            )}
          </div>
          <div style={{ ...colTitle, marginTop: "22px" }}>Legal</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => navigate("/politica-de-privacidad")}
            >
              Política de Privacidad
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => navigate("/terminos-del-servicio")}
            >
              Términos del Servicio
            </button>
          </div>
        </div>
      </div>

      <div
        className="ms-footer-bar"
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          borderTop: "1px solid var(--border-soft)",
          fontFamily: MONO,
          fontSize: "12px",
          color: "var(--text2)",
        }}
      >
        © 2026 MultiStack Systems. Todos los derechos reservados.
        <span style={{ animation: "ms-blink 1.1s steps(1) infinite" }}>_</span>
        {/* Separador y crédito: el CSS de .ms-footer-bar los pone al lado del copyright o en su propia línea. */}
        <span className="ms-footer-bar__sep" aria-hidden="true" />
        {/* Sitio propio (estándar del crédito, sección 15): enlace a la home, misma pestaña, sin UTM. */}
        <DevCredit ownSite className="ms-footer-bar__credit" />
      </div>
    </footer>
  );
};

export default Footer;
