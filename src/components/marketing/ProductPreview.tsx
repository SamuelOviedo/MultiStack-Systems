import type { CSSProperties } from "react";
import { getProduct } from "@/lib/products";
import type { ProductSlug } from "@/types/products";

const MONO = "'JetBrains Mono', monospace";

type Tone = "live" | "soon" | "muted";

interface DemoRow {
  id: string;
  title: string;
  state: string;
  tone: Tone;
}

const TONE_COLOR: Record<Tone, string> = {
  live: "#10b981",
  soon: "#f59e0b",
  muted: "var(--muted)",
};

const WINDOW_TITLE: Record<ProductSlug, string> = {
  techon: "techon — solicitudes",
  licensing: "licensing — catálogo",
  development: "development — pipeline",
  whatsapp: "whatsapp — vista previa",
};

/** Datos neutros de ejemplo. Ficticios a propósito: ningún cliente, ticket ni métrica real. */
const DEMO_ROWS: Record<Exclude<ProductSlug, "whatsapp">, DemoRow[]> = {
  techon: [
    { id: "SOL-0241", title: "Solicitud demo · acceso remoto", state: "Abierta", tone: "live" },
    { id: "SOL-0240", title: "Solicitud demo · impresora", state: "En curso", tone: "soon" },
    { id: "SOL-0239", title: "Solicitud demo · respaldo", state: "Resuelta", tone: "muted" },
  ],
  licensing: [
    { id: "LIC-0101", title: "Sistema operativo · ejemplo", state: "En preparación", tone: "soon" },
    { id: "LIC-0102", title: "Suite ofimática · ejemplo", state: "En preparación", tone: "soon" },
    { id: "LIC-0103", title: "Antivirus · ejemplo", state: "En preparación", tone: "soon" },
  ],
  development: [
    { id: "F-01", title: "Análisis · proyecto de ejemplo", state: "Hecho", tone: "live" },
    { id: "F-02", title: "Desarrollo · proyecto de ejemplo", state: "Activo", tone: "soon" },
    { id: "F-03", title: "Despliegue · proyecto de ejemplo", state: "Pendiente", tone: "muted" },
  ],
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px 12px",
  padding: "11px 14px",
  borderBottom: "1px solid var(--hairline)",
  flexWrap: "wrap",
};

const WhatsAppPreview = () => (
  <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
    <div
      style={{
        alignSelf: "flex-start",
        maxWidth: "80%",
        padding: "9px 13px",
        borderRadius: "4px 12px 12px 12px",
        background: "var(--hover-bg)",
        border: "1px solid var(--hairline)",
        fontSize: "13px",
        color: "var(--text2)",
      }}
    >
      Hola, este es un mensaje de ejemplo.
    </div>
    <div
      style={{
        alignSelf: "flex-end",
        maxWidth: "80%",
        padding: "9px 13px",
        borderRadius: "12px 4px 12px 12px",
        background: "var(--primary-soft)",
        border: "1px solid var(--border-accent)",
        fontSize: "13px",
        color: "var(--text)",
      }}
    >
      Respuesta automática de ejemplo.
    </div>
    <div style={{ fontFamily: MONO, fontSize: "11px", color: "var(--muted)" }}>
      vista ilustrativa · en desarrollo
    </div>
  </div>
);

/**
 * Preview de producto con UI real (no stock, no métricas inventadas).
 * Todo dato visible es demo y se marca como tal.
 */
const ProductPreview = ({ slug }: { slug: ProductSlug }) => {
  const product = getProduct(slug);

  return (
    <div
      role="img"
      aria-label={`Vista de ejemplo de ${product.name} con datos ficticios`}
      style={{
        borderRadius: "12px",
        overflow: "hidden",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 12px",
          padding: "11px 16px",
          borderBottom: "1px solid var(--hairline)",
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: "11.5px", color: "var(--muted)" }}>
          {WINDOW_TITLE[slug]}
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "10.5px",
            padding: "3px 9px",
            borderRadius: "999px",
            color: "var(--text2)",
            border: "1px solid var(--hairline)",
            whiteSpace: "nowrap",
          }}
        >
          {product.statusLabel}
        </span>
      </div>

      {slug === "whatsapp" ? (
        <WhatsAppPreview />
      ) : (
        <div>
          {DEMO_ROWS[slug].map((row) => (
            <div key={row.id} style={rowStyle}>
              <span
                aria-hidden="true"
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  flex: "none",
                  background: TONE_COLOR[row.tone],
                }}
              />
              <span style={{ fontFamily: MONO, fontSize: "11.5px", color: "var(--muted)" }}>
                {row.id}
              </span>
              <span style={{ fontSize: "13.5px", color: "var(--text)", flex: 1 }}>{row.title}</span>
              <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--text2)" }}>
                {row.state}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "9px 16px",
          fontFamily: MONO,
          fontSize: "10.5px",
          color: "var(--muted)",
          borderTop: "1px solid var(--hairline)",
        }}
      >
        datos de ejemplo · vista ilustrativa
      </div>
    </div>
  );
};

export default ProductPreview;
