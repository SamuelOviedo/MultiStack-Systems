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
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            animation: "ms-rise .6s ease both",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12.5px",
            fontWeight: 500,
            letterSpacing: "0.22em",
            color: "var(--accent)",
            margin: "56px 0 26px",
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
            fontSize: "clamp(44px,6.4vw,68px)",
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: "var(--text)",
            maxWidth: "18ch",
            textWrap: "balance",
          }}
        >
          High-Level Engineering{" "}
          <span style={{ color: "var(--primary)" }}>behind real products.</span>
        </h1>
        <p
          style={{
            animation: "ms-rise .6s ease .12s both",
            marginTop: "24px",
            fontSize: "clamp(16px,1.4vw,19px)",
            lineHeight: 1.65,
            color: "var(--text2)",
            maxWidth: "46ch",
            textWrap: "balance",
          }}
        >
          MultiStack construye plataformas y productos tecnológicos — TechOn, Licensing, Development
          — con ADN de ingeniero, desde Honduras.
        </p>
        <div
          style={{
            animation: "ms-rise .6s ease .18s both",
            marginTop: "36px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            flexWrap: "wrap",
            justifyContent: "center",
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
          {...(isExternalHref(techonHref) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          style={{
            animation: "ms-rise .6s ease .22s both",
            marginTop: "18px",
            fontSize: "13.5px",
            fontWeight: 500,
            color: "var(--text2)",
            textDecoration: "none",
          }}
        >
          ¿Necesitas soporte? Ir a TechOn <span aria-hidden="true">→</span>
        </a>

        <EcosystemPreview />
      </div>
    </section>
  );
};

export default HeroSection;
