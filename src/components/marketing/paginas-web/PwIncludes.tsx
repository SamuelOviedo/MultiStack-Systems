import type { PaginasWebIncludes } from "@/pages/marketing/paginasWebContent";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

/** Qué incluye la landing: lista de términos y descripciones, como una hoja de especificaciones. */
const PwIncludes = ({ includes }: { includes: PaginasWebIncludes }) => (
  <PwSection head={includes} alt>
    <PwSectionHead head={includes}>
      <p className="ms-pw-intro">{includes.intro}</p>
    </PwSectionHead>
    <dl className="ms-pw-rows">
      {includes.items.map((item) => (
        <div key={item.title} className="ms-pw-row">
          <dt className="ms-pw-row__term">{item.title}</dt>
          {item.text && <dd className="ms-pw-row__desc">{item.text}</dd>}
        </div>
      ))}
    </dl>
  </PwSection>
);

export default PwIncludes;
