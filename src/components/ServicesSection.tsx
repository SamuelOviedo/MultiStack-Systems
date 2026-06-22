import { useNavigate } from "react-router-dom";
import MsIcon from "@/components/landing/MsIcon";

type Service = {
  icon: string;
  title: string;
  desc: string;
  badge?: string;
  coming?: boolean;
};

const SERVICES: Service[] = [
  {
    icon: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
    title: "Licenciamiento de Software",
    badge: "Socio Oficial",
    desc: "Proveedor oficial de Windows, Office 365 y Kaspersky. Gestionamos la adquisición, activación y renovación de licencias empresariales, garantizando cumplimiento legal y continuidad operativa para su organización.",
  },
  {
    icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    title: "Desarrollo Web a Medida",
    desc: "Plataformas web y sistemas internos desarrollados con las tecnologías más sólidas del ecosistema moderno. Diseñados para escalar, optimizados para el rendimiento y orientados a experiencias de usuario excepcionales.",
  },
  {
    icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
    title: "Soporte Técnico 2.0",
    desc: "Soporte técnico especializado para laptops, equipos de escritorio e impresoras. Atención presencial en Siguatepeque y asistencia remota a nivel nacional, con tiempos de respuesta definidos y garantizados.",
  },
  {
    icon: '<path d="M12 8V4H8"/><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M2 14h2M20 14h2M15 13v2M9 13v2"/>',
    title: "IA y Automatización",
    desc: "Implementación de flujos de trabajo inteligentes, chatbots corporativos y automatización de procesos empresariales. Reducimos la carga operativa para que su equipo se concentre en decisiones de alto impacto.",
    coming: true,
  },
  {
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    title: "Auditoría en Ciberseguridad",
    desc: "Análisis de vulnerabilidades, blindaje de activos digitales y consultoría estratégica en seguridad informática. Protegemos su infraestructura con metodologías de clase mundial adaptadas al contexto regional.",
    coming: true,
  },
];

const ServiceBento = ({
  service,
  idx,
  large,
  onSolicitar,
}: {
  service: Service;
  idx: number;
  large: boolean;
  onSolicitar: () => void;
}) => {
  const iconSize = large ? 48 : 46;
  return (
    <div
      className="ms-bento"
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minHeight: large ? "264px" : "232px",
        padding: large ? "32px 30px" : "26px 24px",
        borderRadius: "14px",
        background: "var(--glass-bg)",
        backdropFilter: "var(--glass-blur)",
        WebkitBackdropFilter: "var(--glass-blur)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: large ? "20px" : "18px" }}>
        <div style={{ width: `${iconSize}px`, height: `${iconSize}px`, borderRadius: "11px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--primary-soft)", color: "var(--primary)" }}>
          <MsIcon path={service.icon} />
        </div>
        {service.badge && (
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", padding: "4px 10px", borderRadius: "6px", color: "var(--accent)", background: "var(--primary-soft)", border: "1px solid var(--border-accent)", whiteSpace: "nowrap" }}>
            {service.badge}
          </span>
        )}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: large ? "10px" : "9px" }}>
        service.{String(idx + 1).padStart(2, "0")}
      </div>
      <h3 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: large ? "21px" : "18px", lineHeight: large ? 1.22 : 1.25, color: "var(--text)", marginBottom: large ? "12px" : "11px" }}>
        {service.title}
      </h3>
      <p style={{ fontSize: large ? "14px" : "13.5px", lineHeight: large ? 1.65 : 1.62, color: "var(--text2)", marginBottom: large ? "22px" : "20px", flex: 1 }}>
        {service.desc}
      </p>
      {service.coming ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", width: "max-content", fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", padding: "9px 15px", borderRadius: "8px", color: "var(--warning)", background: "var(--warning-soft)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--warning)", animation: "ms-pulse 1.6s infinite" }} />
          Disponible próximamente
        </span>
      ) : (
        <button
          type="button"
          onClick={onSolicitar}
          className="ms-linkcta"
          style={{ display: "inline-flex", alignItems: "center", gap: "7px", width: "max-content", fontSize: "14px", fontWeight: 600, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          Solicitar este servicio <span>→</span>
        </button>
      )}
    </div>
  );
};

const ServicesSection = () => {
  const navigate = useNavigate();
  const solicitar = () => navigate("/login");

  return (
    <section
      id="services"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "112px 0",
        background: "var(--surface-2)",
        borderTop: "1px solid var(--hairline)",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div style={{ position: "absolute", top: "8%", right: "-120px", width: "560px", height: "560px", borderRadius: "50%", pointerEvents: "none", background: "var(--glow-b)" }} />
      <div style={{ position: "relative", maxWidth: "1240px", margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", marginBottom: "42px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", letterSpacing: "0.1em", color: "var(--accent)", marginBottom: "16px" }}>
              // catálogo de servicios
            </div>
            <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "clamp(30px,3.6vw,44px)", letterSpacing: "-0.025em", color: "var(--text)" }}>
              Todo lo que hacemos, en detalle.
            </h2>
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", letterSpacing: "0.04em", color: "var(--muted)" }}>
            05 — servicios
          </div>
        </div>

        <div className="ms-bento-a">
          {SERVICES.slice(0, 2).map((s, i) => (
            <ServiceBento key={s.title} service={s} idx={i} large onSolicitar={solicitar} />
          ))}
        </div>
        <div className="ms-bento-b">
          {SERVICES.slice(2).map((s, i) => (
            <ServiceBento key={s.title} service={s} idx={i + 2} large={false} onSolicitar={solicitar} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;
