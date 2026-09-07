import { useState } from "react";
import { isExternalHref, PRODUCTS } from "@/lib/products";
import ProductPreview from "@/components/marketing/ProductPreview";
import type { ProductSlug } from "@/types/products";

const MONO = "'JetBrains Mono', monospace";

const SOLUTIONS: ProductSlug[] = ["techon", "licensing", "development", "whatsapp"];

/**
 * Hero visual: el ecosistema como producto real.
 * Selector de soluciones + preview + estado de sistema. Datos demo, marcados como tal.
 */
const EcosystemPreview = () => {
  const [active, setActive] = useState<ProductSlug>("techon");
  const activeProduct = PRODUCTS.find((p) => p.slug === active);
  if (!activeProduct) throw new Error(`Producto desconocido: ${active}`);
  const product = activeProduct;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1240px",
        margin: "56px auto 24px",
        borderRadius: "16px",
        overflow: "hidden",
        background: "var(--surface)",
        border: "1px solid var(--hairline)",
        textAlign: "left",
      }}
    >
      {/* Switcher */}
      <div
        role="group"
        aria-label="Soluciones del ecosistema"
        style={{
          display: "flex",
          gap: "4px",
          padding: "10px 12px",
          borderBottom: "1px solid var(--hairline)",
          overflowX: "auto",
        }}
      >
        {SOLUTIONS.map((slug) => {
          const item = PRODUCTS.find((candidate) => candidate.slug === slug);
          if (!item) throw new Error(`Producto desconocido: ${slug}`);
          const selected = slug === active;
          return (
            <button
              key={slug}
              type="button"
              aria-pressed={selected}
              onClick={() => setActive(slug)}
              style={{
                fontFamily: MONO,
                fontSize: "12px",
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: selected ? "var(--border-accent)" : "transparent",
                background: selected ? "var(--primary-soft)" : "transparent",
                color: selected ? "var(--primary)" : "var(--text2)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {item.name}
            </button>
          );
        })}
        <span
          style={{
            marginLeft: "auto",
            alignSelf: "center",
            fontFamily: MONO,
            fontSize: "11px",
            color: "var(--muted)",
            whiteSpace: "nowrap",
            paddingLeft: "12px",
          }}
        >
          ecosystem · 04 soluciones
        </span>
      </div>

      {/* Body: preview + system status */}
      <div className="ms-eco-body">
        <div style={{ minWidth: 0 }}>
          <ProductPreview slug={active} />
        </div>
        <aside
          aria-label="Estado del ecosistema"
          className="ms-eco-aside"
          style={{
            padding: "22px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ fontFamily: MONO, fontSize: "11px", color: "var(--muted)" }}>
            system.status
          </div>
          {PRODUCTS.map((p) => (
            <div
              key={p.slug}
              style={{ display: "flex", alignItems: "center", gap: "9px", fontSize: "13px" }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  flex: "none",
                  background:
                    p.status === "live"
                      ? "#10b981"
                      : p.status === "soon"
                        ? "#f59e0b"
                        : "var(--muted)",
                }}
              />
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{p.name}</span>
              <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--muted)" }}>
                {p.statusLabel.toLowerCase()}
              </span>
            </div>
          ))}
          <div
            style={{
              marginTop: "6px",
              paddingTop: "14px",
              borderTop: "1px solid var(--hairline)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>
              {product.name}
            </div>
            <div style={{ fontSize: "13px", lineHeight: 1.6, color: "var(--text2)" }}>
              {product.tagline}
            </div>
            {product.href && product.ctaLabel && (
              <a
                href={product.href}
                {...(isExternalHref(product.href)
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
                style={{
                  fontSize: "13.5px",
                  fontWeight: 600,
                  color: "var(--primary)",
                  textDecoration: "none",
                }}
              >
                {product.ctaLabel} →
              </a>
            )}
          </div>
          <div style={{ fontFamily: MONO, fontSize: "10.5px", color: "var(--muted)" }}>
            vista ilustrativa · datos ficticios
          </div>
        </aside>
      </div>
    </div>
  );
};

export default EcosystemPreview;
