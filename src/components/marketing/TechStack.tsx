const GROUPS = [
  {
    name: "Frontend",
    note: "interfaces de producto",
    techs: ["React", "TypeScript", "TailwindCSS"],
  },
  {
    name: "Backend & Datos",
    note: "base del ecosistema",
    techs: ["Node.js", "Supabase", "PostgreSQL"],
  },
  {
    name: "Cloud & Deploy",
    note: "producción",
    techs: ["Vercel", "AWS", "Linux"],
  },
  {
    name: "Tooling",
    note: "cómo trabajamos",
    techs: ["Git", "GitHub", "Figma"],
  },
];

/**
 * Engineering detrás de los productos — no vitrina de logos.
 * 4 grupos, 12 tecnologías core, filas abiertas, cero glass/glow.
 */
const TechStack = () => (
  <section id="stack" style={{ padding: "96px 0", background: "var(--bg)" }}>
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "20px",
          marginBottom: "48px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              letterSpacing: "0.1em",
              color: "var(--accent)",
              marginBottom: "14px",
            }}
          >
            {"// engineering"}
          </div>
          <h2
            style={{
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(30px,3.6vw,44px)",
              letterSpacing: "-0.025em",
              color: "var(--text)",
              lineHeight: 1.08,
              maxWidth: "20ch",
            }}
          >
            La ingeniería detrás de cada producto.
          </h2>
          <p
            style={{
              marginTop: "14px",
              fontSize: "16px",
              lineHeight: 1.65,
              color: "var(--text2)",
              maxWidth: "50ch",
            }}
          >
            Stack real, limitado y probado en producción. Lo que usamos para construir TechOn y el
            resto del ecosistema.
          </p>
        </div>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            color: "var(--muted)",
          }}
        >
          04 grupos · 12 tecnologías core
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--hairline)" }}>
        {GROUPS.map((g) => (
          <div
            key={g.name}
            className="ms-eng-row"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(200px, 280px) 1fr",
              gap: "24px",
              alignItems: "baseline",
              padding: "26px 4px",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: 600,
                  fontSize: "18px",
                  color: "var(--text)",
                }}
              >
                {g.name}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11.5px",
                  color: "var(--muted)",
                  marginTop: "4px",
                }}
              >
                {g.note}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              {g.techs.map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12.5px",
                    color: "var(--text2)",
                    padding: "7px 13px",
                    borderRadius: "8px",
                    border: "1px solid var(--hairline)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TechStack;
