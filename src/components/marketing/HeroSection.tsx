import EcosystemPreview from "./EcosystemPreview";
import { getTechonHref, isExternalHref } from "@/lib/products";

const HeroSection = () => {
  const techonHref = getTechonHref();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "96px 0 64px",
        background: "var(--page-bg)",
      }}
    >
      {/* Grid técnico sutil — solo hero, identidad sin ruido */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "var(--grid-image)",
          backgroundSize: "var(--grid-size)",
          WebkitMaskImage: "var(--grid-mask)",
          maskImage: "var(--grid-mask)",
          opacity: 0.6,
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 32px",
        }}
      >
        <div className="ms-hero-grid">
          {/* Copy — izquierda */}
          <div style={{ minWidth: 0, textAlign: "left" }}>
            <div
              style={{
                animation: "ms-rise .6s ease both",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12.5px",
                fontWeight: 500,
                letterSpacing: "0.22em",
                color: "var(--accent)",
                margin: "40px 0 24px",
                textTransform: "uppercase",
              }}
            >
              multistack.systems — ecosistema de productos
            </div>
            <h1
              style={{
                animation: "ms-rise .6s ease .06s both",
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                fontSize: "clamp(40px,5.2vw,60px)",
                lineHeight: 1.06,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                maxWidth: "16ch",
                textWrap: "balance",
              }}
            >
              Alto nivel de Ingeniería detrás de productos reales.
            </h1>
            <p
              style={{
                animation: "ms-rise .6s ease .12s both",
                marginTop: "22px",
                fontSize: "clamp(16px,1.3vw,18px)",
                lineHeight: 1.65,
                color: "var(--text2)",
                maxWidth: "42ch",
                textWrap: "balance",
              }}
            >
              MultiStack construye plataformas y productos tecnológicos — TechOn, Desarrollo,
              Licenciamiento — con ADN de ingeniero, desde Honduras.
            </p>
            <div
              style={{
                animation: "ms-rise .6s ease .18s both",
                marginTop: "32px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => scrollTo("productos")}
                className="ms-cta"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "14px",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "var(--btn-text)",
                  background: "var(--btn-bg)",
                  padding: "15px 28px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  border: "1px solid var(--btn-border)",
                  boxShadow: "var(--btn-shadow)",
                }}
              >
                Explorar productos
              </button>
              <button
                type="button"
                onClick={() => scrollTo("contacto")}
                style={{
                  fontSize: "14.5px",
                  fontWeight: 600,
                  color: "var(--text)",
                  background: "transparent",
                  padding: "15px 22px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  border: "1px solid var(--border)",
                }}
              >
                Hablar de un proyecto
              </button>
            </div>
            <a
              href={techonHref}
              {...(isExternalHref(techonHref)
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              style={{
                animation: "ms-rise .6s ease .22s both",
                display: "inline-block",
                marginTop: "18px",
                fontSize: "13.5px",
                fontWeight: 500,
                color: "var(--text2)",
                textDecoration: "none",
              }}
            >
              ¿Necesitas soporte? Ir a TechOn <span aria-hidden="true">→</span>
            </a>
          </div>

          {/* Visual — derecha, protagonista */}
          <div style={{ minWidth: 0, animation: "ms-rise .7s ease .24s both" }}>
            <EcosystemPreview />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
