import TerminalHero from "./TerminalHero";

const HeroSection = () => {
  const scrollToServicios = () => {
    const el = document.getElementById("servicios");
    if (el) window.scrollTo({ top: el.offsetTop - 60, behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "72px 0 40px",
        background: "var(--page-bg)",
      }}
    >
      {/* Grid overlay — dense dots (light) / faint lines (dark), masked radially */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: "var(--grid-image)",
          backgroundSize: "var(--grid-size)",
          WebkitMaskImage: "var(--grid-mask)",
          maskImage: "var(--grid-mask)",
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: "1240px",
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
            fontSize: "13px",
            fontWeight: 500,
            letterSpacing: "0.3em",
            color: "var(--accent)",
            margin: "72px 0 28px",
            textTransform: "uppercase",
          }}
        >
          Siguatepeque, HN — Remote First
        </div>
        <h1
          style={{
            animation: "ms-rise .6s ease .06s both",
            fontFamily: "'Sora', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(38px,6vw,64px)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: "var(--text)",
            maxWidth: "15ch",
            textWrap: "balance",
          }}
        >
          MultiStack Systems: <span style={{ color: "var(--primary)" }}>High-Level Engineering</span> Solutions.
        </h1>
        <p
          style={{
            animation: "ms-rise .6s ease .12s both",
            marginTop: "26px",
            fontSize: "clamp(16px,1.4vw,19px)",
            lineHeight: 1.65,
            color: "var(--text2)",
            maxWidth: "40ch",
            textWrap: "balance",
          }}
        >
          Desarrollo, Soporte y Licenciamiento con ADN de Ingeniero. Construimos la infraestructura que tu crecimiento exige.
        </p>
        <button
          type="button"
          onClick={scrollToServicios}
          className="ms-cta"
          style={{
            animation: "ms-rise .6s ease .18s both",
            marginTop: "38px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "14px",
            fontWeight: 600,
            letterSpacing: "0.05em",
            color: "var(--btn-text)",
            background: "var(--btn-bg)",
            padding: "15px 28px",
            borderRadius: "11px",
            cursor: "pointer",
            whiteSpace: "nowrap",
            border: "1px solid var(--btn-border)",
            boxShadow: "var(--btn-shadow)",
          }}
        >
          [ EXPLORAR_SERVICIOS ]
        </button>

        <TerminalHero />
      </div>
    </section>
  );
};

export default HeroSection;
