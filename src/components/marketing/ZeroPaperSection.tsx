import ScrollScene from "@/components/marketing/cinematic/ScrollScene";
import FloatingCopy from "@/components/marketing/cinematic/FloatingCopy";
import type { CinematicSceneId, ScrubSource } from "@/types/cinematic";
import type { AiServiceSlug } from "@/types/aiServices";

const CAPABILITIES = ["Flujos con n8n", "Conecta ERP, CRM y hojas de cálculo", "Alertas y trazabilidad"];

/** Flujo ilustrativo: pasos genéricos, sin sistemas ni datos de clientes reales. */
const STEPS = [
  { label: "Factura recibida por correo", status: "capturada", at: 0.14 },
  { label: "Datos extraídos y validados con IA", status: "validados", at: 0.24 },
  { label: "Registro automático en tu ERP", status: "sincronizado", at: 0.34 },
  { label: "Aprobación y aviso a tu equipo", status: "notificado", at: 0.44 },
];

interface ZeroPaperSectionProps {
  onScrubSource?: (sceneId: CinematicSceneId, source: ScrubSource) => void;
  onRequestService: (slug: AiServiceSlug) => void;
}

/** Escena 3 — Automatización Cero Papel con n8n (escena de video "automation"). */
const ZeroPaperSection = ({ onScrubSource, onRequestService }: ZeroPaperSectionProps) => (
  <ScrollScene
    id="automatizacion"
    sceneId="automation"
    label="Automatización cero papel"
    onScrubSource={onScrubSource}
  >
    {(progress) => (
      <div className="ms-chapter">
        <div className="ms-chapter-copy">
          <FloatingCopy progress={progress} appearAt={0.02}>
            <div className="ms-chapter-eyebrow">{"// automatización n8n"}</div>
            <h2 className="ms-chapter-title">
              Cero papel. <span style={{ color: "var(--primary)" }}>Cero recaptura.</span>
            </h2>
            <p className="ms-chapter-lead">
              Formularios, facturas y aprobaciones fluyen solos entre tus sistemas. Tu equipo deja de
              copiar y pegar y se enfoca en lo que de verdad importa.
            </p>
          </FloatingCopy>
          <FloatingCopy progress={progress} appearAt={0.2}>
            <ul className="ms-chapter-chips" aria-label="Capacidades de automatización">
              {CAPABILITIES.map((label) => (
                <li key={label} className="ms-cine-chip">
                  <span aria-hidden="true" className="ms-chip-dot" />
                  {label}
                </li>
              ))}
            </ul>
          </FloatingCopy>
          <FloatingCopy progress={progress} appearAt={0.38}>
            <button type="button" className="ms-cine-cta" onClick={() => onRequestService("cero-papel")}>
              Quiero automatizar mis procesos
            </button>
          </FloatingCopy>
        </div>

        <div className="ms-glass-card" aria-label="Flujo de automatización ilustrativo">
          <div className="ms-glass-card-head">
            <span className="ms-glass-card-title">flujo · factura-proveedor</span>
            <span className="ms-glass-card-status">
              <span aria-hidden="true" className="ms-chip-dot" style={{ background: "var(--success)" }} />
              activo
            </span>
          </div>
          <ol className="ms-flow">
            {STEPS.map((step, i) => (
              <li key={step.label}>
                <FloatingCopy progress={progress} appearAt={step.at} className="ms-flow-step">
                  <span aria-hidden="true" className="ms-flow-node">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="ms-flow-label">{step.label}</span>
                  <span className="ms-flow-status">
                    <span aria-hidden="true" className="ms-chip-dot" style={{ background: "var(--success)" }} />
                    {step.status}
                  </span>
                </FloatingCopy>
              </li>
            ))}
          </ol>
          <div className="ms-glass-card-foot">flujo ilustrativo · sin intervención manual</div>
        </div>
      </div>
    )}
  </ScrollScene>
);

export default ZeroPaperSection;
