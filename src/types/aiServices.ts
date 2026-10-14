export type AiServiceSlug = "agente-rag" | "cero-papel" | "integracion-a-medida";

/** Servicio productizado de IA (spec 001 · Key Entities · AiService). */
export interface AiService {
  slug: AiServiceSlug;
  name: string;
  /** Resultado tangible que promete el servicio (copy cualitativo, spec C-1). */
  outcome: string;
  deliverables: string[];
  /** Plazo estimado de implementación, mostrado como estimación. */
  timeline: string;
  /** Sin precio publicado hasta confirmarlo (spec C-2). */
  priceFrom?: string;
  ctaLabel: string;
}
