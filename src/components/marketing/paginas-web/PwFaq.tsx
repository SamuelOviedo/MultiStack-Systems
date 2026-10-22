import type { PaginasWebFaq } from "@/pages/marketing/paginasWebContent";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

/**
 * Preguntas frecuentes con <details>/<summary> nativos (teclado y lectores de pantalla de serie, sin
 * JavaScript). El marcador y el foco se dibujan en CSS (.ms-pw-faq__q).
 */
const PwFaq = ({ faq }: { faq: PaginasWebFaq }) => (
  <PwSection head={faq}>
    <PwSectionHead head={faq} />
    <div className="ms-pw-faq">
      {faq.items.map((item) => (
        <details key={item.question} className="ms-pw-faq__item">
          <summary className="ms-pw-faq__q">{item.question}</summary>
          <p className="ms-pw-faq__a">{item.answer}</p>
        </details>
      ))}
    </div>
  </PwSection>
);

export default PwFaq;
