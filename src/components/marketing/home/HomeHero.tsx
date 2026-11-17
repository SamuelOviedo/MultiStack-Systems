import PwFacts from "@/components/marketing/paginas-web/PwFacts";
import PwLink from "@/components/marketing/paginas-web/PwLink";
import PwRequestLink from "@/components/marketing/paginas-web/PwRequestLink";
import PwSection from "@/components/marketing/paginas-web/PwSection";
import { PwEyebrow } from "@/components/marketing/paginas-web/PwSectionHead";
import { titleId } from "@/components/marketing/paginas-web/ids";
import type { PackageIntentId } from "@/lib/packageIntent";
import type { HomeHero as HomeHeroContent } from "@/pages/marketing/homeContent";
import HomeHeroMock from "./HomeHeroMock";
import { rise } from "./motion";

interface HomeHeroProps {
  hero: HomeHeroContent;
  /** Paquete del CTA principal: se guarda como intención antes de navegar a /solicitudes. */
  primaryPackageId: PackageIntentId;
}

/**
 * Apertura de la home: el único h1, el CTA del Combo («Solicitar …» → /solicitudes?paquete=<id>), el enlace a
 * los planes, el microcopy y los tres datos. A la derecha (debajo en móvil), la ilustración con profundidad.
 * Entrada escalonada con CSS: cada bloque lleva su orden, y con movimiento reducido todo aparece sin animar.
 */
const HomeHero = ({ hero, primaryPackageId }: HomeHeroProps) => (
  <PwSection head={hero} className="ms-pw-hero ms-home-hero">
    <div className="ms-home-hero__grid">
      <div className="ms-home-hero__copy">
        <div {...rise(0)}>
          <PwEyebrow>{hero.eyebrow}</PwEyebrow>
        </div>
        <h1 id={titleId(hero.id)} className="ms-pw-h1 ms-home-rise" style={rise(1).style}>
          {hero.title}
        </h1>
        <p className="ms-pw-lead ms-home-rise" style={rise(2).style}>
          {hero.subtitle}
        </p>
        <div className="ms-pw-actions ms-home-rise" style={rise(3).style}>
          <PwRequestLink
            packageId={primaryPackageId}
            to={hero.primaryCta.href}
            className="ms-pw-btn ms-pw-btn--primary"
          >
            {hero.primaryCta.label}
          </PwRequestLink>
          <PwLink link={hero.secondaryCta} className="ms-pw-btn ms-pw-btn--ghost" />
        </div>
        <p className="ms-pw-note ms-home-rise" style={rise(4).style}>
          {hero.reassurance}
        </p>
        <div className="ms-home-rise" style={rise(5).style}>
          <PwFacts facts={hero.facts} />
        </div>
      </div>
      <div className="ms-home-hero__visual ms-home-rise" style={rise(3).style}>
        <HomeHeroMock cards={hero.floatingCards} alt={hero.mockAlt} />
      </div>
    </div>
  </PwSection>
);

export default HomeHero;
