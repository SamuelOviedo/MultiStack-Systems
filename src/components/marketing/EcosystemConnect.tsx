import { PRODUCTS } from "@/lib/products";

const MONO = "'JetBrains Mono', monospace";

/**
 * Cómo se conecta MultiStack: centro + soluciones, sin diagrama corporativo.
 * Superficie abierta, líneas hairline, mono solo para labels técnicos.
 */
const EcosystemConnect = () => (
  <section
    id="ecosistema"
    aria-label="Cómo se conecta el ecosistema"
    style={{ padding: "96px 0", background: "var(--surface-2)" }}
  >
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
      <div style={{ fontFamily: MONO, fontSize: "13px", color: "var(--accent)", marginBottom: "16px" }}>
        {"// arquitectura del ecosistema"}
      </div>
      <h2
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: "clamp(28px,3.2vw,40px)",
          letterSpacing: "-0.025em",
          color: "var(--text)",
          lineHeight: 1.1,
          maxWidth: "20ch",
          marginBottom: "14px",
        }}
      >
        One ecosystem. Multiple specialized products.
      </h2>
      <p
        style={{
          fontSize: "16px",
          lineHeight: 1.65,
          color: "var(--text2)",
          maxWidth: "54ch",
          marginBottom: "52px",
        }}
      >
        MultiStack conecta cada solución: identidad, soporte y desarrollo comparten la misma base de
        ingeniería. Entras por un producto, el resto ya te conoce.
      </p>

      <div className="ms-eco-connect" aria-hidden="true">
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "18px",
            color: "var(--text)",
            padding: "20px 28px",
            border: "1px solid var(--border-accent)",
            borderRadius: "12px",
            background: "var(--primary-soft)",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          MultiStack
        </div>
        <div className="ms-eco-links">
          {PRODUCTS.map((p) => (
            <div key={p.slug} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  width: "28px",
                  height: "1px",
                  background: "var(--hairline)",
                  flex: "none",
                }}
              />
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--text)",
                  padding: "12px 18px",
                  border: "1px solid var(--hairline)",
                  borderRadius: "8px",
                  background: "var(--bg)",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </span>
              <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--muted)" }}>
                {p.statusLabel.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only">
        MultiStack conecta TechOn, Licensing, Development y WhatsApp en un solo ecosistema.
      </p>
    </div>
  </section>
);

export default EcosystemConnect;
