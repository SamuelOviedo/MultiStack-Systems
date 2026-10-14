import { useNavigate } from "react-router-dom";
import Logo from "@/components/common/Logo";
import { getTechonHref, isExternalHref } from "@/lib/products";
import type { CSSProperties } from "react";

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
  padding: 0,
  fontSize: "14px",
  textDecoration: "none",
};

const anchorLink: CSSProperties = {
  ...linkStyle,
  display: "inline-block",
};

const scrollTo = (id: string, navigate: ReturnType<typeof useNavigate>) => {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
  else navigate(`/#${id}`);
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
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "56px 32px 28px" }}
      >
        {/* Col 1 — brand */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "16px" }}>
            <Logo className="h-[26px]" />
            <span
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 700,
                fontSize: "16px",
                color: "var(--text)",
              }}
            >
              MultiStack Systems
            </span>
          </div>
          <div
            style={{ fontFamily: MONO, fontSize: "12.5px", lineHeight: 1.7, color: "var(--muted)" }}
          >
            Built in Honduras. Engineered for anywhere.
            <br />
            Siguatepeque, HN — Remote First
          </div>
        </div>

        {/* Col 2 — Productos */}
        <div>
          <div style={colTitle}>Productos</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("productos", navigate)}
            >
              TechOn — Soporte
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("productos", navigate)}
            >
              Licensing
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("productos", navigate)}
            >
              Development
            </button>
            <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--muted)" }}>
              WhatsApp — En desarrollo
            </span>
          </div>
        </div>

        {/* Col 3 — MultiStack */}
        <div>
          <div style={colTitle}>MultiStack</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("ecosistema", navigate)}
            >
              Ecosistema
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("stack", navigate)}
            >
              Engineering
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("empresa", navigate)}
            >
              Empresa
            </button>
            <button
              type="button"
              className="ms-foot-link"
              style={linkStyle}
              onClick={() => scrollTo("contacto", navigate)}
            >
              Contacto
            </button>
          </div>
        </div>

        {/* Col 4 — Cuenta + Legal */}
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
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "18px 32px",
          borderTop: "1px solid var(--border-soft)",
          fontFamily: MONO,
          fontSize: "12px",
          color: "var(--muted)",
        }}
      >
        © 2026 MultiStack Systems. Todos los derechos reservados.
        <span style={{ animation: "ms-blink 1.1s steps(1) infinite" }}>_</span>
      </div>
    </footer>
  );
};

export default Footer;
