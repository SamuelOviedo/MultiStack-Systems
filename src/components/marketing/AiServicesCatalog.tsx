import { AI_SERVICES } from "@/lib/aiServices";
import type { AiService } from "@/types/aiServices";

const MONO = "'JetBrains Mono', monospace";

/**
 * Catálogo de Servicios Productizados de IA (#productos). Sección sólida que
 * sigue el tema activo (fuera de las escenas cinemáticas). El CTA delega en
 * Index, que prellena el formulario de contacto y desplaza hasta él.
 */
const AiServicesCatalog = ({ onSelect }: { onSelect: (service: AiService) => void }) => (
  <section
    id="productos"
    aria-label="Servicios productizados de IA"
    style={{ padding: "112px 0 96px", background: "var(--bg)" }}
  >
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
      <div style={{ fontFamily: MONO, fontSize: "13px", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "16px" }}>
        {"// servicios productizados"}
      </div>
      <h2
        style={{
          fontFamily: "'Sora', sans-serif",
          fontWeight: 600,
          fontSize: "clamp(30px,3.6vw,44px)",
          letterSpacing: "-0.025em",
          lineHeight: 1.08,
          color: "var(--text)",
          maxWidth: "22ch",
          marginBottom: "14px",
        }}
      >
        Servicios de IA listos para implementar.
      </h2>
      <p style={{ fontSize: "16.5px", lineHeight: 1.65, color: "var(--text2)", maxWidth: "54ch", marginBottom: "56px" }}>
        Alcance, entregables y plazo definidos desde el diagnóstico. Sin proyectos eternos ni sorpresas.
      </p>

      <ul className="ms-svc-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {AI_SERVICES.map((service, i) => (
          <li key={service.slug} className="ms-bento ms-svc-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--muted)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  border: "1px solid var(--hairline)",
                  color: "var(--text2)",
                }}
              >
                Estimado: {service.timeline}
              </span>
            </div>
            <h3
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                fontSize: "22px",
                letterSpacing: "-0.015em",
                color: "var(--text)",
                margin: "20px 0 8px",
              }}
            >
              {service.name}
            </h3>
            <p style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.5, color: "var(--text)", marginBottom: "20px" }}>
              {service.outcome}
            </p>
            <ul style={{ listStyle: "none", margin: "0 0 28px", padding: 0, display: "grid", gap: "10px" }}>
              {service.deliverables.map((d) => (
                <li key={d} style={{ display: "flex", gap: "10px", fontSize: "14px", lineHeight: 1.5, color: "var(--text2)" }}>
                  <span aria-hidden="true" style={{ color: "var(--primary)", fontFamily: MONO, flex: "none" }}>
                    ✓
                  </span>
                  {d}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => onSelect(service)}
              className="ms-linkcta ms-svc-cta"
              aria-label={`${service.ctaLabel}: ${service.name}`}
            >
              {service.ctaLabel} <span aria-hidden="true">→</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default AiServicesCatalog;
