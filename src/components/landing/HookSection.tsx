import { useNavigate } from "react-router-dom";
import MsIcon from "@/components/landing/MsIcon";

const HOOK_CARDS = [
  {
    icon: 'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z M22 17.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65 M22 12.65l-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65',
    eyebrow: "Desarrollo a Medida",
    headline: "Tu negocio merece software que trabaje como tú.",
    teaser: "Sistemas hechos a la medida de tu operación — no plantillas, no compromisos.",
    benefits: [
      "Sistemas internos que eliminan procesos manuales",
      "Plataformas web y móviles listas para escalar",
      "Entrega por fases: pagas por resultados, no por promesas",
    ],
    cta: "Comenzar mi proyecto",
  },
  {
    icon: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
    eyebrow: "Web & Soporte TI",
    headline: "Infraestructura que no te falla cuando más importa.",
    teaser: "Hosting, redes y soporte técnico con garantía de respuesta — desde Honduras.",
    benefits: [
      "Hosting administrado con monitoreo activo",
      "Soporte técnico remoto y presencial en Honduras",
      "SLA con tiempo de respuesta garantizado",
    ],
    cta: "Solicitar soporte ahora",
  },
  {
    icon: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
    eyebrow: "IA & Automatización",
    headline: "Automatiza lo repetitivo. Enfócate en crecer.",
    teaser: "Integra inteligencia artificial donde más duele: flujos lentos, errores humanos, tareas repetitivas.",
    benefits: [
      "Chatbots empresariales integrados a tu operación",
      "Flujos automáticos que reducen carga operativa",
      "Integración con herramientas que ya usas",
    ],
    cta: "Ver cómo funciona",
  },
];

// Card 1 stores space-separated absolute sub-paths; wrap each in a <path>.
const toPaths = (icon: string) =>
  icon.startsWith("<")
    ? icon
    : icon
        .split(" M")
        .map((seg, i) => `<path d="${i === 0 ? seg : "M" + seg}"/>`)
        .join("");

export const HookSection = () => {
  const navigate = useNavigate();

  return (
    <section
      id="servicios"
      style={{ position: "relative", overflow: "hidden", padding: "112px 0", background: "var(--bg)" }}
    >
      <div
        style={{
          position: "absolute",
          top: "-120px",
          left: "-80px",
          width: "520px",
          height: "520px",
          borderRadius: "50%",
          pointerEvents: "none",
          background: "var(--glow-a)",
        }}
      />
      <div
        className="ms-grid-servicios"
        style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", padding: "0 32px" }}
      >
        <div className="ms-sticky">
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "18px" }}>
            // servicios principales
          </div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "clamp(30px,3.6vw,44px)", lineHeight: 1.06, letterSpacing: "-0.025em", color: "var(--text)" }}>
            Soluciones diseñadas para escalar.
          </h2>
          <p style={{ marginTop: "18px", fontSize: "16.5px", lineHeight: 1.65, color: "var(--text2)", maxWidth: "32ch" }}>
            Más que proveedor — somos el equipo técnico que tu empresa necesita para crecer con confianza.
          </p>
          <div style={{ marginTop: "30px", height: "1px", width: "72%", background: "var(--hairline)" }} />
          <div style={{ marginTop: "18px", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.04em", color: "var(--muted)" }}>
            03 — capacidades centrales
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--hairline)" }}>
          {HOOK_CARDS.map((c, i) => (
            <div
              key={c.eyebrow}
              className="ms-hook-row"
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "auto 1fr",
                gap: "24px",
                padding: "32px 22px",
                borderBottom: "1px solid var(--hairline)",
                borderRadius: "10px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "13px" }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--muted)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div style={{ width: "46px", height: "46px", borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--primary-soft)", color: "var(--primary)" }}>
                  <MsIcon path={toPaths(c.icon)} />
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11.5px", letterSpacing: "0.06em", color: "var(--accent)", textTransform: "uppercase", marginBottom: "9px" }}>
                  {c.eyebrow}
                </div>
                <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "21px", lineHeight: 1.22, color: "var(--text)", marginBottom: "10px" }}>
                  {c.headline}
                </h3>
                <p style={{ fontSize: "14.5px", lineHeight: 1.6, color: "var(--text2)", marginBottom: "16px" }}>{c.teaser}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "9px 20px", marginBottom: "18px" }}>
                  {c.benefits.map((b) => (
                    <div key={b} style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px", lineHeight: 1.5, color: "var(--text2)", flex: "1 1 44%" }}>
                      <span style={{ color: "var(--success)", flex: "none", marginTop: "1px" }}>✓</span>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="ms-linkcta"
                  style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "14px", fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  {c.cta} <span>→</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HookSection;
