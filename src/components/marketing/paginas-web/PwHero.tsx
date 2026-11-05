import type { PaginasWebHero } from "@/pages/marketing/paginasWebContent";
import PwFacts from "./PwFacts";
import PwLink from "./PwLink";
import PwSection from "./PwSection";
import { PwEyebrow } from "./PwSectionHead";
import { titleId } from "./ids";

interface PwHeroProps {
  hero: PaginasWebHero;
  /** Se llama al activar el CTA principal (ancla al formulario). */
  onContact: () => void;
}

/** Apertura: el único h1 de la página, los dos CTA y la franja de datos. */
const PwHero = ({ hero, onContact }: PwHeroProps) => (
  <PwSection head={hero} className="ms-pw-hero">
    <PwEyebrow>{hero.eyebrow}</PwEyebrow>
    <h1 id={titleId(hero.id)} className="ms-pw-h1">
      {hero.title}
    </h1>
    <p className="ms-pw-lead">{hero.subtitle}</p>
    <div className="ms-pw-actions">
      <PwLink link={hero.primaryCta} className="ms-pw-btn ms-pw-btn--primary" onContact={onContact} />
      <PwLink link={hero.secondaryCta} className="ms-pw-btn ms-pw-btn--ghost" />
    </div>
    <p className="ms-pw-note">{hero.reassurance}</p>
    <PwFacts facts={hero.facts} />
  </PwSection>
);

export default PwHero;
