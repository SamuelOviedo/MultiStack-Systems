import { Link } from "react-router-dom";
import { PwLedger, PwPlan } from "@/components/marketing/paginas-web/PwPrice";
import PwSection from "@/components/marketing/paginas-web/PwSection";
import PwSectionHead from "@/components/marketing/paginas-web/PwSectionHead";
import { withoutBreaks } from "@/components/marketing/paginas-web/withoutBreaks";
import type { HomePlans as HomePlansContent } from "@/pages/marketing/homeContent";
import { reveal } from "./motion";

/**
 * Planes: el Combo y el Estándar lado a lado (PwPlan, con el id `paquete-<id>` y su CTA de solicitud). El
 * recomendado lleva su etiqueta y el borde de marca; debajo, lo incluido, lo no incluido y el enlace a
 * /paginas-web con el detalle completo.
 */
const HomePlans = ({ plans }: { plans: HomePlansContent }) => (
  <PwSection head={plans} alt>
    <PwSectionHead head={plans}>
      <p className="ms-pw-intro">{plans.intro}</p>
    </PwSectionHead>

    <div className="ms-pw-plans">
      {plans.packages.map((plan, index) => {
        const recommended = plan.id === plans.recommendedId;
        return (
          <div key={plan.id} className="ms-home-plan-slot" {...reveal(index)}>
            <PwPlan plan={plan} badge={recommended ? plans.recommendedLabel : undefined} featured={recommended} />
          </div>
        );
      })}
    </div>

    <p className="ms-pw-intro">{withoutBreaks(plans.scope)}</p>

    <div {...reveal()}>
      <PwLedger
        price={{
          includedTitle: plans.includedTitle,
          included: plans.included,
          notIncludedTitle: plans.notIncludedTitle,
          notIncluded: plans.notIncluded,
        }}
      />
    </div>

    <div className="ms-pw-actions">
      {/* Ruta interna: Link navega sin recargar la SPA (PwLink es para anclas y enlaces externos). */}
      <Link to={plans.seeAllLink.href} className="ms-pw-btn ms-pw-btn--ghost">
        {plans.seeAllLink.label}
      </Link>
    </div>
  </PwSection>
);

export default HomePlans;
