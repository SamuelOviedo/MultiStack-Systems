import ContactForm from "@/components/marketing/ContactForm";
import { getTechonHref, isExternalHref } from "@/lib/products";

const MONO = "'JetBrains Mono', monospace";

/**
 * Contacto con intenciones separadas:
 * soporte → TechOn · proyecto → MultiStack (form directo).
 */
const ContactSplit = () => {
  const techonHref = getTechonHref();
  const external = isExternalHref(techonHref);

  return (
    <section
      id="contacto"
      aria-label="Contacto"
      style={{ padding: "96px 0", background: "var(--surface-2)" }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 32px" }}>
        <div
          style={{ fontFamily: MONO, fontSize: "13px", color: "var(--accent)", marginBottom: "16px" }}
        >
          {"// contacto"}
        </div>
        <h2
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 600,
            fontSize: "clamp(30px,3.6vw,44px)",
            letterSpacing: "-0.025em",
            color: "var(--text)",
            marginBottom: "14px",
          }}
        >
          Hablemos de lo que necesitas.
        </h2>
        <p
          style={{
            fontSize: "16.5px",
            lineHeight: 1.65,
            color: "var(--text2)",
            maxWidth: "52ch",
            marginBottom: "48px",
          }}
        >
          Dos caminos, cero vueltas: soporte va a TechOn, proyectos vienen a MultiStack.
        </p>

        <div className="ms-contact-split">
          <div
            style={{
              borderRadius: "12px",
              border: "1px solid var(--hairline)",
              background: "var(--bg)",
              padding: "30px 28px",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: "11.5px",
                color: "var(--muted)",
                marginBottom: "12px",
              }}
            >
              01 / soporte
            </div>
            <h3
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                fontSize: "22px",
                color: "var(--text)",
                marginBottom: "10px",
              }}
            >
              ¿Necesitas soporte?
            </h3>
            <p
              style={{
                fontSize: "14.5px",
                lineHeight: 1.65,
                color: "var(--text2)",
                marginBottom: "22px",
              }}
            >
              Incidencias, solicitudes y seguimiento en TechOn, la plataforma de soporte del
              ecosistema.
            </p>
            <a
              href={techonHref}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "14.5px",
                fontWeight: 600,
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              Ir a TechOn <span aria-hidden="true">→</span>
            </a>
          </div>

          <div
            style={{
              borderRadius: "12px",
              border: "1px solid var(--hairline)",
              background: "var(--bg)",
              padding: "30px 28px",
            }}
          >
            <div
              style={{
                fontFamily: MONO,
                fontSize: "11.5px",
                color: "var(--muted)",
                marginBottom: "12px",
              }}
            >
              02 / proyecto
            </div>
            <h3
              style={{
                fontFamily: "'Sora', sans-serif",
                fontWeight: 600,
                fontSize: "22px",
                color: "var(--text)",
                marginBottom: "10px",
              }}
            >
              ¿Quieres desarrollar un proyecto?
            </h3>
            <p
              style={{
                fontSize: "14.5px",
                lineHeight: 1.65,
                color: "var(--text2)",
                marginBottom: "18px",
              }}
            >
              Escríbenos directo. Respondemos desde MultiStack.
            </p>
            <ContactForm idPrefix="ms-contact-split" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSplit;
