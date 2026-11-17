import PwSection from "@/components/marketing/paginas-web/PwSection";
import PwSectionHead from "@/components/marketing/paginas-web/PwSectionHead";
import type { HomeProcess as HomeProcessContent } from "@/pages/marketing/homeContent";
import { reveal } from "./motion";

/**
 * Proceso: lista ordenada, así que aquí sí van números. El encabezado queda a la izquierda y los pasos a la
 * derecha; en pantallas angostas, uno debajo del otro.
 */
const HomeProcess = ({ process }: { process: HomeProcessContent }) => (
  <PwSection head={process} alt>
    <div className="ms-home-process">
      <div className="ms-home-process__head">
        <PwSectionHead head={process}>
          <p className="ms-pw-intro">{process.intro}</p>
        </PwSectionHead>
      </div>
      <ol role="list" className="ms-pw-steps">
        {process.steps.map((step, index) => (
          <li key={step.title} className="ms-pw-step" {...reveal(Math.min(index, 3))}>
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
    </div>
  </PwSection>
);

export default HomeProcess;
