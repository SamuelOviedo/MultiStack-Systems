import { getTechonHref, isExternalHref } from "@/lib/products";

const MONO = "'JetBrains Mono', monospace";

const CAPABILITIES = ["Agentes RAG 24/7", "Automatización con n8n", "Integración con tus sistemas"];

/**
 * Hero cinemático. Se pinta sobre CinematicBackground (lo provee Index) y no
 * depende de las imágenes animadas ni de JS de animación para ser legible (spec FR-017):
 * solo animaciones CSS de entrada, desactivadas con prefers-reduced-motion.
 */
interface HeroSectionProps {
  /** Abre el agente de demostración. Sin él, el CTA secundario lleva a los servicios. */
  onTryAgent?: () => void;
  /** Primera intención sobre el CTA: precarga el chat. */
  onTryAgentIntent?: () => void;
}

const HeroSection = ({ onTryAgent, onTryAgentIntent }: HeroSectionProps) => {
  const techonHref = getTechonHref();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 60, behavior: "smooth" });
  };

  return (
    <section id="hero" className="ms-cine-hero" aria-label="Inteligencia artificial aplicada a tu operación">
      <div style={{ width: "100%", maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
        <div style={{ maxWidth: "660px" }}>
          <div
            className="ms-cine-rise"
            style={{
              fontFamily: MONO,
              fontSize: "12.5px",
              fontWeight: 500,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--accent)",
              marginBottom: "24px",
            }}
          >
            {"// inteligencia artificial aplicada"}
          </div>

          <h1
            className="ms-cine-rise"
            style={{
              animationDelay: ".08s",
              fontFamily: "'Sora', sans-serif",
              fontWeight: 600,
              fontSize: "clamp(40px,6.2vw,76px)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              color: "var(--text)",
              textWrap: "balance",
              textShadow: "var(--cine-text-shadow)",
            }}
          >
            Tu operación,{" "}
            <span style={{ color: "var(--primary)" }}>en piloto automático.</span>
          </h1>

          <p
            className="ms-cine-rise"
            style={{
              animationDelay: ".16s",
              marginTop: "24px",
              fontSize: "clamp(16px,1.4vw,19px)",
              lineHeight: 1.65,
              color: "var(--text2)",
              maxWidth: "46ch",
              textWrap: "pretty",
            }}
          >
            Agentes de IA y automatizaciones que reducen{" "}
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>hasta un 70% la carga operativa</strong>{" "}
            de tu equipo. Implementados en semanas, no en meses.
          </p>

          <div
            className="ms-cine-rise"
            style={{
              animationDelay: ".24s",
              marginTop: "36px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button type="button" onClick={() => scrollTo("contacto")} className="ms-cine-cta">
              Agenda un diagnóstico
            </button>
            {onTryAgent ? (
              <button
                type="button"
                onClick={onTryAgent}
                onPointerEnter={onTryAgentIntent}
                onFocus={onTryAgentIntent}
                aria-haspopup="dialog"
                className="ms-cine-ghost"
              >
                Probar el agente <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button type="button" onClick={() => scrollTo("productos")} className="ms-cine-ghost">
                Ver servicios <span aria-hidden="true">→</span>
              </button>
            )}
          </div>

          <ul
            className="ms-cine-rise"
            aria-label="Capacidades"
            style={{
              animationDelay: ".32s",
              listStyle: "none",
              margin: "40px 0 0",
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {CAPABILITIES.map((label) => (
              <li key={label} className="ms-cine-chip">
                <span
                  aria-hidden="true"
                  style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--accent)" }}
                />
                {label}
              </li>
            ))}
          </ul>

          <a
            href={techonHref}
            {...(isExternalHref(techonHref) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="ms-cine-rise ms-foot-link"
            style={{
              animationDelay: ".4s",
              display: "inline-block",
              marginTop: "28px",
              fontSize: "13.5px",
              fontWeight: 500,
              color: "var(--text2)",
              textDecoration: "none",
            }}
          >
            ¿Ya eres cliente? Soporte en TechOn <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>

      <div className="ms-cine-scrollcue" aria-hidden="true">
        <span>scroll</span>
        <span className="ms-cine-scrollcue-line" />
      </div>
    </section>
  );
};

export default HeroSection;
