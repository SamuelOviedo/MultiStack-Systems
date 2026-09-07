import type { CSSProperties } from "react";
import { getProduct, isExternalHref } from "@/lib/products";
import ProductPreview from "@/components/marketing/ProductPreview";
import type { Product } from "@/types/products";

const MONO = "'JetBrains Mono', monospace";

const sectionStyle: CSSProperties = {
  padding: "96px 0",
  background: "var(--bg)",
};

const innerStyle: CSSProperties = {
  maxWidth: "1200px",
  margin: "0 auto",
  padding: "0 32px",
};

const eyebrow: CSSProperties = {
  fontFamily: MONO,
  fontSize: "13px",
  letterSpacing: "0.1em",
  color: "var(--accent)",
  marginBottom: "16px",
};

const h2: CSSProperties = {
  fontFamily: "'Sora', sans-serif",
  fontWeight: 600,
  fontSize: "clamp(30px,3.6vw,44px)",
  letterSpacing: "-0.025em",
  color: "var(--text)",
  lineHeight: 1.08,
};

const statusPill = (status: Product["status"]): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  fontFamily: MONO,
  fontSize: "11.5px",
  padding: "5px 12px",
  borderRadius: "999px",
  color: "var(--text2)",
  border: "1px solid var(--hairline)",
  background: "transparent",
  width: "max-content",
});

const statusDot = (status: Product["status"]): string =>
  status === "live" ? "#10b981" : status === "soon" ? "#f59e0b" : "var(--muted)";

const ProductCopy = ({ product, index }: { product: Product; index: string }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontFamily: MONO, fontSize: "12px", color: "var(--muted)", marginBottom: "14px" }}>
      {index}
    </div>
    <div style={{ ...statusPill(product.status), marginBottom: "18px" }}>
      <span
        aria-hidden="true"
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: statusDot(product.status),
        }}
      />
      {product.statusLabel}
    </div>
    <h3
      style={{
        fontFamily: "'Sora', sans-serif",
        fontWeight: 600,
        fontSize: "clamp(28px,3vw,38px)",
        letterSpacing: "-0.02em",
        color: "var(--text)",
        marginBottom: "12px",
        lineHeight: 1.1,
      }}
    >
      {product.name}
    </h3>
    <p style={{ fontSize: "17px", fontWeight: 600, color: "var(--text)", marginBottom: "10px" }}>
      {product.tagline}
    </p>
    <p style={{ fontSize: "15.5px", lineHeight: 1.7, color: "var(--text2)", marginBottom: "22px" }}>
      {product.description}
    </p>
    {product.href && product.ctaLabel ? (
      <a
        href={product.href}
        {...(isExternalHref(product.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}
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
        {product.ctaLabel} <span aria-hidden="true">→</span>
      </a>
    ) : (
      <span style={{ fontFamily: MONO, fontSize: "12.5px", color: "var(--muted)" }}>
        Próximamente — la gestionamos directo con el equipo.
      </span>
    )}
  </div>
);

/**
 * Product showcase editorial. TechOn domina; Licensing invertido;
 * Development retoma ritmo; WhatsApp fila discreta full-width.
 */
const ProductsShowcase = () => {
  const techon = getProduct("techon");
  const licensing = getProduct("licensing");
  const development = getProduct("development");
  const whatsapp = getProduct("whatsapp");

  return (
    <section id="productos" style={sectionStyle} aria-label="Productos del ecosistema">
      <div style={innerStyle}>
        <div style={{ ...eyebrow }}>{"// ecosistema de productos"}</div>
        <h2 style={{ ...h2, maxWidth: "22ch", marginBottom: "14px" }}>
          Un ecosistema. Productos especializados.
        </h2>
        <p
          style={{
            fontSize: "16.5px",
            lineHeight: 1.65,
            color: "var(--text2)",
            maxWidth: "52ch",
            marginBottom: "64px",
          }}
        >
          MultiStack es el punto central. Cada necesidad vive en la herramienta adecuada.
        </p>

        {/* TechOn — protagonista */}
        <div className="ms-showcase-techon">
          <ProductCopy product={techon} index="01 / soporte" />
          <div style={{ minWidth: 0 }}>
            <ProductPreview slug="techon" />
          </div>
        </div>

        {/* Licensing — invertido, sin CTA ficticio */}
        <div className="ms-showcase-row" style={{ marginTop: "96px" }}>
          <div style={{ minWidth: 0, order: 1 }}>
            <ProductPreview slug="licensing" />
          </div>
          <div style={{ order: 2 }}>
            <ProductCopy product={licensing} index="02 / licencias" />
          </div>
        </div>

        {/* Development — ritmo retomado */}
        <div className="ms-showcase-row" style={{ marginTop: "96px" }}>
          <ProductCopy product={development} index="03 / desarrollo" />
          <div style={{ minWidth: 0 }}>
            <ProductPreview slug="development" />
          </div>
        </div>

        {/* WhatsApp — discreto */}
        <div
          style={{
            marginTop: "72px",
            padding: "22px 0",
            borderTop: "1px solid var(--hairline)",
            borderBottom: "1px solid var(--hairline)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--muted)" }}>04</span>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, color: "var(--text)" }}>
            {whatsapp.name}
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: "11px",
              padding: "4px 11px",
              borderRadius: "999px",
              border: "1px solid var(--hairline)",
              color: "var(--text2)",
            }}
          >
            {whatsapp.statusLabel}
          </span>
          <span style={{ fontSize: "14px", color: "var(--text2)", flex: "1 1 220px" }}>
            {whatsapp.tagline} {whatsapp.description}
          </span>
        </div>
      </div>
    </section>
  );
};

export default ProductsShowcase;
