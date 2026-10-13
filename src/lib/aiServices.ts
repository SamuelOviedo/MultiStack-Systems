import type { AiService, AiServiceSlug } from "@/types/aiServices";

/**
 * Catálogo de Servicios Productizados de IA (spec C-2).
 * Separado de PRODUCTS a propósito: PRODUCTS describe el ecosistema
 * (TechOn, Licensing…) y sus tipos se usan en tests y en el Footer.
 *
 * Copy cualitativo mientras se validan métricas reales (spec C-1).
 * Plazos = estimaciones a confirmar en el diagnóstico; sin precios publicados.
 */
export const AI_SERVICES: AiService[] = [
  {
    slug: "agente-rag",
    name: "Agente de Atención IA",
    outcome: "Responde 24/7 con la información real de tu negocio.",
    deliverables: [
      "Agente entrenado con tus documentos y preguntas frecuentes (RAG)",
      "Integración en tu sitio web y canales de mensajería",
      "Escalamiento a tu equipo con todo el contexto",
      "Panel de conversaciones y ajustes continuos",
    ],
    timeline: "3–4 semanas",
    ctaLabel: "Quiero este servicio",
  },
  {
    slug: "cero-papel",
    name: "Automatización Cero Papel",
    outcome: "Formularios, facturas y aprobaciones sin recaptura manual.",
    deliverables: [
      "Mapeo de tus procesos manuales y cuellos de botella",
      "Flujos automatizados con n8n entre tus sistemas",
      "Digitalización de formularios y documentos",
      "Monitoreo y alertas de cada flujo",
    ],
    timeline: "2–4 semanas",
    ctaLabel: "Quiero este servicio",
  },
  {
    slug: "integracion-a-medida",
    name: "Integración IA a Medida",
    outcome: "IA conectada a los sistemas que ya usas.",
    deliverables: [
      "Diagnóstico técnico de tu operación",
      "Conectores a ERP, CRM y APIs existentes",
      "Modelos y prompts ajustados a tu caso",
      "Entrega por fases con seguimiento directo",
    ],
    timeline: "Según alcance",
    ctaLabel: "Quiero este servicio",
  },
];

export function getAiService(slug: AiServiceSlug): AiService {
  const found = AI_SERVICES.find((s) => s.slug === slug);
  if (!found) throw new Error(`Servicio desconocido: ${slug}`);
  return found;
}

/** Mensaje con el que se prellena el formulario de contacto. */
export function serviceContactMessage(service: AiService): string {
  return `Hola, me interesa el servicio «${service.name}». Quisiera agendar un diagnóstico para mi empresa.`;
}
