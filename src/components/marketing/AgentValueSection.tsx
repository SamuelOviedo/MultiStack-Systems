import ScrollScene from "@/components/marketing/cinematic/ScrollScene";
import FloatingCopy from "@/components/marketing/cinematic/FloatingCopy";
import type { CinematicSceneId, ScrubSource } from "@/types/cinematic";
import type { AiServiceSlug } from "@/types/aiServices";

const CAPABILITIES = ["Disponible 24/7", "Responde con tus documentos", "Escala a tu equipo con contexto"];

/** Conversación ficticia a propósito: ningún cliente ni dato real. */
const CHAT: { from: "user" | "agent"; text: string; tag?: string; at: number }[] = [
  { from: "user", text: "¿Hacen envíos a San Pedro Sula? ¿Cuánto tardan?", at: 0.12 },
  {
    from: "agent",
    text: "Sí, enviamos a todo Honduras. A San Pedro Sula llega en 24 a 48 horas hábiles.",
    tag: "fuente · politica-de-envios.pdf",
    at: 0.24,
  },
  { from: "user", text: "Perfecto. ¿Puedo pagar contra entrega?", at: 0.36 },
  {
    from: "agent",
    text: "Claro. Te paso con un asesor para confirmar tu pedido.",
    tag: "escalado a ventas · con contexto",
    at: 0.48,
  },
];

interface AgentValueSectionProps {
  onScrubSource?: (sceneId: CinematicSceneId, source: ScrubSource) => void;
  onRequestService: (slug: AiServiceSlug) => void;
}

/** Escena 2 — Propuesta de valor: Agente de Atención 24/7 (escena "agent", secuencia en modo scrub). */
const AgentValueSection = ({ onScrubSource, onRequestService }: AgentValueSectionProps) => (
  <ScrollScene id="agente" sceneId="agent" label="Agente de atención 24/7" onScrubSource={onScrubSource}>
    {(progress) => (
      <div className="ms-chapter">
        <div className="ms-chapter-copy">
          <FloatingCopy progress={progress} appearAt={0.02}>
            <div className="ms-chapter-eyebrow">{"// agente de atención"}</div>
            <h2 className="ms-chapter-title">
              Responde en segundos. <span style={{ color: "var(--primary)" }}>A cualquier hora.</span>
            </h2>
            <p className="ms-chapter-lead">
              Un agente entrenado con tus documentos (RAG) que resuelve las consultas repetitivas y escala
              lo complejo a tu equipo, con todo el contexto de la conversación.
            </p>
          </FloatingCopy>
          <FloatingCopy progress={progress} appearAt={0.2}>
            <ul className="ms-chapter-chips" aria-label="Capacidades del agente">
              {CAPABILITIES.map((label) => (
                <li key={label} className="ms-cine-chip">
                  <span aria-hidden="true" className="ms-chip-dot" />
                  {label}
                </li>
              ))}
            </ul>
          </FloatingCopy>
          <FloatingCopy progress={progress} appearAt={0.38}>
            <button type="button" className="ms-cine-cta" onClick={() => onRequestService("agente-rag")}>
              Quiero un agente para mi negocio
            </button>
          </FloatingCopy>
        </div>

        <div className="ms-glass-card" aria-label="Conversación ilustrativa con un agente de IA">
          <div className="ms-glass-card-head">
            <span aria-hidden="true" className="ms-agent-avatar">IA</span>
            <span style={{ fontWeight: 600, color: "var(--text)" }}>Agente de atención</span>
            <span className="ms-glass-card-status">
              <span aria-hidden="true" className="ms-chip-dot" style={{ background: "var(--success)" }} />
              en línea
            </span>
          </div>
          <ol className="ms-chat-log">
            {CHAT.map((msg) => (
              <li key={msg.text} className={msg.from === "user" ? "ms-chat-row is-user" : "ms-chat-row"}>
                <FloatingCopy progress={progress} appearAt={msg.at} className="ms-chat-bubble">
                  <span className="sr-only">{msg.from === "user" ? "Cliente:" : "Agente:"} </span>
                  {msg.text}
                  {msg.tag && <span className="ms-chat-tag">{msg.tag}</span>}
                </FloatingCopy>
              </li>
            ))}
          </ol>
          <div className="ms-glass-card-foot">conversación ilustrativa · datos ficticios</div>
        </div>
      </div>
    )}
  </ScrollScene>
);

export default AgentValueSection;
