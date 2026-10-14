/**
 * Guion de Otto, el agente de demostración (spec Capa 5, C-7: puramente simulado).
 * Sin red ni almacenamiento: todo se resuelve en el navegador.
 * Las cifras coinciden con el catálogo (lib/aiServices.ts) y el copy es
 * cualitativo mientras se validan métricas reales (C-1).
 */

export interface DemoReply {
  text: string;
  /** Muestra el CTA "Agenda un diagnóstico" bajo la respuesta. */
  cta?: boolean;
}

interface Intent {
  keywords: string[];
  reply: DemoReply;
}

export const GREETING =
  "¡Hola! Soy Otto, el asistente de MultiStack. Pregúntame cómo puedo quitarte el trabajo manual de encima, cuánto tardamos en conectar tus sistemas o cómo funcionan nuestros agentes RAG.";

export const SUGGESTIONS = [
  "¿Cómo funciona un agente con mis documentos?",
  "¿Cuánto tarda implementarlo?",
  "¿Se conecta con mis sistemas?",
];

// Orden = prioridad: la primera intención con coincidencia gana.
const INTENTS: Intent[] = [
  {
    keywords: ["precio", "costo", "cuesta", "cotiz", "tarifa", "presupuesto"],
    reply: {
      text: "El costo depende del alcance: canales, volumen de consultas y sistemas a conectar. Lo definimos contigo en un diagnóstico, con alcance y entregables cerrados antes de empezar.",
      cta: true,
    },
  },
  {
    keywords: ["tarda", "tiempo", "semana", "plazo", "cuando", "implement"],
    reply: {
      text: "Un agente de atención se implementa en un estimado de 3 a 4 semanas: diagnóstico, carga de tus documentos, pruebas con tu equipo y salida a producción.",
      cta: true,
    },
  },
  {
    keywords: ["document", "funciona", "rag", "entren", "aprend", "pdf", "manual"],
    reply: {
      text: "Cargamos tus documentos, políticas y preguntas frecuentes. Cuando un cliente pregunta, el agente busca la información relevante y responde con ella (eso es RAG), en lugar de inventar.",
    },
  },
  {
    keywords: ["whatsapp", "web", "crm", "erp", "integr", "conect", "sistema", "n8n", "excel", "hoja"],
    reply: {
      text: "Se integra en tu sitio web y canales de mensajería. Con flujos de n8n se conecta a tu ERP, CRM u hojas de cálculo para consultar o registrar datos sin recaptura.",
    },
  },
  {
    keywords: ["humano", "persona", "asesor", "agente real", "escal", "equipo"],
    reply: {
      text: "Cuando una consulta necesita a una persona, el agente la escala a tu equipo con todo el contexto de la conversación. Nadie tiene que volver a preguntar lo mismo.",
    },
  },
  {
    keywords: ["dato", "segur", "privacidad", "confidencial", "acceso"],
    reply: {
      text: "Definimos contigo qué información usa el agente y quién tiene acceso. Y en esta demo, nada de lo que escribes sale de tu navegador.",
    },
  },
  {
    keywords: ["hola", "buenas", "buen dia", "saludos", "hey"],
    reply: {
      text: "¡Hola! ¿Qué te gustaría saber? Puedo contarte cómo funciona el agente, los plazos de implementación o cómo se integra con tus herramientas.",
    },
  },
];

const FALLBACK: DemoReply = {
  text: "Buena pregunta. Mis respuestas en esta demo son simuladas, pero en un diagnóstico revisamos tu caso concreto y te decimos qué se puede automatizar.",
  cta: true,
};

/** minúsculas + sin acentos, para coincidencias tolerantes. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function getDemoReply(input: string): DemoReply {
  const q = normalize(input);
  return INTENTS.find((i) => i.keywords.some((k) => q.includes(k)))?.reply ?? FALLBACK;
}

/** "Escribiendo…" proporcional a la respuesta, acotado a 700–1400 ms. */
export function typingDelay(reply: DemoReply): number {
  return Math.min(1400, Math.max(700, 400 + reply.text.length * 6));
}
