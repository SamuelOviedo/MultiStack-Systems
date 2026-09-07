const MONO = "'JetBrains Mono', monospace";

/** Bloque institucional mínimo. Sin misión/visión ni corporativo genérico. */
const BuiltHonduras = () => (
  <section aria-label="Origen" style={{ padding: "72px 0", background: "var(--bg)" }}>
    <div
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "0 32px",
        display: "flex",
        alignItems: "baseline",
        gap: "18px",
        flexWrap: "wrap",
      }}
    >
      <h2
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: "clamp(22px,2.4vw,30px)",
          letterSpacing: "-0.02em",
          color: "var(--text)",
        }}
      >
        Built in Honduras. Engineered for anywhere.
      </h2>
      <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--muted)" }}>
        Siguatepeque, HN — Remote First · 14.5951° N, 87.8321° W
      </span>
    </div>
  </section>
);

export default BuiltHonduras;
