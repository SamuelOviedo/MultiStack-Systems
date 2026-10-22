import type { PaginasWebHonduras } from "@/pages/marketing/paginasWebContent";
import PwSection from "./PwSection";
import PwSectionHead from "./PwSectionHead";

/** Franja de origen, como BuiltHonduras de la home: titular a la izquierda; texto y ubicación (mono) a la derecha. */
const PwHonduras = ({ honduras }: { honduras: PaginasWebHonduras }) => (
  <PwSection head={honduras} alt tight>
    <div className="ms-pw-split">
      <PwSectionHead head={honduras} />
      <div>
        <p className="ms-pw-text">{honduras.text}</p>
        <p className="ms-pw-location">{honduras.location}</p>
      </div>
    </div>
  </PwSection>
);

export default PwHonduras;
