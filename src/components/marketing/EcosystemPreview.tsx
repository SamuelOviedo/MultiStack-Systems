import { PRODUCTS } from "@/lib/products";
import type { ProductStatus } from "@/types/products";

const MONO = "'JetBrains Mono', monospace";

const dotColor = (status: ProductStatus): string =>
  status === "live" ? "#10b981" : status === "soon" ? "#f59e0b" : "var(--muted)";

interface ModuleCard {
  slug: string;
  name: string;
  status: string;
  tone: ProductStatus;
  featured?: boolean;
  detail: string[];
}

/** Contenido demo neutro. Ficticio a propósito: ningún cliente, ticket ni métrica real. */
const CARDS: ModuleCard[] = [
  {
    slug: "techon",
    name: "TechOn",
    status: "Disponible",
    tone: "live",
    featured: true,
    detail: ["SOL-0241 · Abierta", "SOL-0240 · En curso"],
  },
  {
    slug: "licensing",
    name: "Licenciamiento",
    status: "En preparación",
    tone: "soon",
    detail: ["LIC-0101 · En preparación", "LIC-0102 · En preparación"],
  },
  {
    slug: "development",
    name: "Desarrollo",
    status: "Activo",
    tone: "live",
    detail: ["F-02 · Activo", "F-01 · Hecho"],
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    status: "En desarrollo",
    tone: "dev",
    detail: ["Vista ilustrativa", "En construcción"],
  },
];

/**
 * Centro de Control del Ecosistema MultiStack.
 * Panel tipo dashboard realista: sidebar + 4 tarjetas de módulo + estado.
 * Interfaz ilustrativa con datos ficticios — sin métricas ni clientes reales.
 */
const EcosystemPreview = () => (
  <div
    role="img"
    aria-label="Centro de control del ecosistema MultiStack con TechOn, Licenciamiento, Desarrollo y WhatsApp. Vista ilustrativa con datos ficticios."
    style={{
      width: "100%",
      borderRadius: "16px",
      overflow: "hidden",
      background: "var(--surface)",
      border: "1px solid var(--hairline)",
      textAlign: "left",
    }}
  >
    {/* Header */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "14px 20px",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <span
        style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "14px", color: "var(--text)" }}
      >
        Ecosistema de productos
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
        <span
          aria-hidden="true"
          style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981" }}
        />
        <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--muted)" }}>
          system · operativo
        </span>
      </span>
    </div>

    {/* Body: sidebar + módulos */}
    <div className="ms-cc-body">
      {/* Sidebar interna */}
      <div className="ms-cc-sidebar" aria-hidden="true">
        <div
          style={{
            fontFamily: "'Sora', sans-serif",
            fontWeight: 700,
            fontSize: "13.5px",
            color: "var(--primary)",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "var(--primary-soft)",
            border: "1px solid var(--border-accent)",
            marginBottom: "6px",
          }}
        >
          MultiStack
        </div>
        {PRODUCTS.map((p) => (
          <div
            key={p.slug}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "9px 12px",
              borderRadius: "8px",
              border: "1px solid transparent",
              borderColor: p.slug === "techon" ? "var(--hairline)" : "transparent",
              background: p.slug === "techon" ? "var(--hover-bg)" : "transparent",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                flex: "none",
                background: dotColor(p.status),
              }}
            />
            <span style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--text)" }}>
              {p.name}
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: "auto",
            paddingTop: "12px",
            fontFamily: MONO,
            fontSize: "10px",
            color: "var(--muted)",
          }}
        >
          multistack core
        </div>
      </div>

      {/* Módulos */}
      <div style={{ minWidth: 0, padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="ms-cc-cards">
          {CARDS.map((c) => (
            <div
              key={c.slug}
              style={{
                borderRadius: "12px",
                border: "1px solid",
                borderColor: c.featured ? "var(--border-accent)" : "var(--hairline)",
                background: c.featured ? "var(--primary-soft)" : "var(--bg)",
                padding: "14px",
                minWidth: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "8px" }}>
                <span
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    flex: "none",
                    background: dotColor(c.tone),
                  }}
                />
                <span
                  style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: "13.5px", color: "var(--text)" }}
                >
                  {c.name}
                </span>
              </div>
              <div
                style={{
                  fontFamily: MONO,
                  fontSize: "10.5px",
                  color: "var(--text2)",
                  marginBottom: "10px",
                }}
              >
                {c.status}
              </div>
              <div className="ms-cc-detail" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {c.detail.map((line) => (
                  <div
                    key={line}
                    style={{
                      fontFamily: MONO,
                      fontSize: "10.5px",
                      color: "var(--muted)",
                      padding: "6px 9px",
                      borderRadius: "6px",
                      background: "var(--hover-bg)",
                      border: "1px solid var(--hairline)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Conexión sutil: una sola línea de sistema, no diagrama */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 4px 0",
            borderTop: "1px solid var(--hairline)",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: "10.5px", color: "var(--muted)" }}>
            multistack core · identidad + soporte + desarrollo
          </span>
        </div>
      </div>
    </div>

    {/* Footer de estado */}
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        flexWrap: "wrap",
        padding: "11px 20px",
        borderTop: "1px solid var(--hairline)",
      }}
    >
      {PRODUCTS.map((p) => (
        <span
          key={p.slug}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: MONO,
            fontSize: "10.5px",
            color: "var(--muted)",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: dotColor(p.status),
            }}
          />
          {p.name.toLowerCase()}
        </span>
      ))}
      <span
        style={{
          marginLeft: "auto",
          fontFamily: MONO,
          fontSize: "10px",
          color: "var(--muted)",
        }}
      >
        vista ilustrativa · datos ficticios
      </span>
    </div>
  </div>
);

export default EcosystemPreview;
