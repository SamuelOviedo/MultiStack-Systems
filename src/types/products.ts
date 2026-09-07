export type ProductStatus = "live" | "soon" | "dev";

export type ProductSlug = "techon" | "licensing" | "development" | "whatsapp";

export interface Product {
  slug: ProductSlug;
  name: string;
  tagline: string;
  description: string;
  status: ProductStatus;
  statusLabel: string;
  /** External URL when product lives outside MultiStack. Undefined = no CTA link yet. */
  href?: string;
  ctaLabel?: string;
}

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  live: "Disponible",
  soon: "En preparación",
  dev: "En desarrollo",
};
