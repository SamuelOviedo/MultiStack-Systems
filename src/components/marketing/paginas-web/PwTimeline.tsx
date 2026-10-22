import type { PaginasWebTimeline } from "@/pages/marketing/paginasWebContent";
import PwFacts from "./PwFacts";
import PwLink from "./PwLink";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

interface PwTimelineProps {
  timeline: PaginasWebTimeline;
  /** Se llama al activar el CTA (ancla al formulario). */
  onContact: () => void;
}

/**
 * Proceso: lista ordenada, así que aquí sí van números. A un lado, los datos de
 * plazo y revisiones con el CTA; en pantallas angostas quedan debajo de los pasos.
 */
const PwTimeline = ({ timeline, onContact }: PwTimelineProps) => (
  <PwSection head={timeline} alt>
    <PwSectionHead head={timeline}>
      <p className="ms-pw-intro">{timeline.intro}</p>
    </PwSectionHead>
    <div className="ms-pw-timeline">
      <ol role="list" className="ms-pw-steps">
        {timeline.steps.map((step, index) => (
          <li key={step.title} className="ms-pw-step">
            <span className="ms-pw-step__n" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="ms-pw-h3">{step.title}</h3>
              <p className="ms-pw-text">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <PwFacts facts={timeline.facts} stack />
        <div className="ms-pw-actions">
          <PwLink link={timeline.cta} className="ms-pw-btn ms-pw-btn--primary" onContact={onContact} />
        </div>
      </div>
    </div>
  </PwSection>
);

export default PwTimeline;
