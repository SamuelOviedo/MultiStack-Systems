import type { PaginasWebEngineering } from "@/pages/marketing/paginasWebContent";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

/** Ingeniería: tres puntos en columnas separadas por una línea fina. */
const PwEngineering = ({ engineering }: { engineering: PaginasWebEngineering }) => (
  <PwSection head={engineering}>
    <PwSectionHead head={engineering}>
      <p className="ms-pw-intro">{engineering.intro}</p>
    </PwSectionHead>
    <ul role="list" className="ms-pw-points">
      {engineering.points.map((point) => (
        <li key={point.title} className="ms-pw-point">
          <h3 className="ms-pw-h3">{point.title}</h3>
          {point.text && <p className="ms-pw-text">{point.text}</p>}
        </li>
      ))}
    </ul>
  </PwSection>
);

export default PwEngineering;
