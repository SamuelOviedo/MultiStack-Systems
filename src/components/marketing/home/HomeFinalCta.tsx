import PwLink from "@/components/marketing/paginas-web/PwLink";
import PwRequestLink from "@/components/marketing/paginas-web/PwRequestLink";
import PwSection from "@/components/marketing/paginas-web/PwSection";
import { titleId } from "@/components/marketing/paginas-web/ids";
import type { PackageIntentId } from "@/lib/packageIntent";
import type { HomeFinalCta as HomeFinalCtaContent } from "@/pages/marketing/homeContent";
import { reveal } from "./motion";

interface HomeFinalCtaProps {
  cta: HomeFinalCtaContent;
  comboId: PackageIntentId;
  standardId: PackageIntentId;
}

/** Cierre: los dos CTA de solicitud (Combo principal, Estándar secundario) y, aparte, WhatsApp para quien prefiere escribir. */
const HomeFinalCta = ({ cta, comboId, standardId }: HomeFinalCtaProps) => (
  <PwSection head={cta} tight>
    <div className="ms-home-final" {...reveal()}>
      <h2 id={titleId(cta.id)} className="ms-pw-h2">
        {cta.title}
      </h2>
      <p className="ms-pw-lead">{cta.text}</p>
      <div className="ms-pw-actions ms-home-final__actions">
        <PwRequestLink packageId={comboId} to={cta.comboCta.href} className="ms-pw-btn ms-pw-btn--primary">
          {cta.comboCta.label}
        </PwRequestLink>
        <PwRequestLink packageId={standardId} to={cta.standardCta.href} className="ms-pw-btn ms-pw-btn--ghost">
          {cta.standardCta.label}
        </PwRequestLink>
      </div>
      <p className="ms-pw-note ms-home-final__alt">{cta.alternativeLabel}</p>
      <PwLink link={cta.whatsapp} className="ms-home-textlink" />
    </div>
  </PwSection>
);

export default HomeFinalCta;
