import type { Product, ProductSlug } from "@/types/products";

/**
 * URLs del ecosistema. Centralizadas y configurables vía env.
 * Sin URL inventada: si el env no existe, el href queda undefined.
 *
 * - VITE_TECHON_URL: plataforma independiente de TechOn (cuando tenga DNS propio).
 * - VITE_LICENSING_URL: futura plataforma de licenciamiento.
 * - VITE_WHATSAPP_PLATFORM_URL: plataforma de WhatsApp (en desarrollo).
 */
const env = import.meta.env as unknown as Record<string, string | undefined>;

const clean = (value: string | undefined): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const TECHON_URL = clean(env.VITE_TECHON_URL);
export const LICENSING_URL = clean(env.VITE_LICENSING_URL);
export const WHATSAPP_PLATFORM_URL = clean(env.VITE_WHATSAPP_PLATFORM_URL);

/**
 * El soporte hoy vive dentro de MultiStack (login → solicitudes/tickets).
 * Cuando TechOn tenga URL propia (VITE_TECHON_URL), este helper la usa.
 */
export function getTechonHref(): string {
  return TECHON_URL ?? "/login";
}

export function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export const PRODUCTS: Product[] = [
  {
    slug: "techon",
    name: "TechOn",
    tagline: "Soporte técnico y gestión de solicitudes.",
    description:
      "La plataforma de soporte del ecosistema: crea solicitudes, sigue cada incidencia y habla directo con el equipo.",
    status: "live",
    statusLabel: "Disponible",
    href: getTechonHref(),
    ctaLabel: "Abrir TechOn",
  },
  {
    slug: "licensing",
    name: "Licensing",
    tagline: "Licencias de software, sin fricción.",
    description:
      "Futura plataforma especializada para adquirir y gestionar licencias. Hoy la gestionamos directo con el equipo.",
    status: "soon",
    statusLabel: "En preparación",
  },
  {
    slug: "development",
    name: "Development",
    tagline: "Desarrollo a medida, gestionado aquí.",
    description:
      "Plataformas y sistemas construidos por MultiStack, con seguimiento directo y entrega por fases.",
    status: "live",
    statusLabel: "Desde MultiStack",
    href: "#contacto",
    ctaLabel: "Iniciar proyecto",
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    tagline: "Atención por WhatsApp, integrada.",
    description: "Plataforma personalizada de atención por WhatsApp. Actualmente en construcción.",
    status: "dev",
    statusLabel: "En desarrollo",
  },
];

export function getProduct(slug: ProductSlug): Product {
  const found = PRODUCTS.find((p) => p.slug === slug);
  if (!found) throw new Error(`Producto desconocido: ${slug}`);
  return found;
}
