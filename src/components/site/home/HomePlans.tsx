import type { PaginasWebPackage } from "@/lib/webPackages";
import type { SiteHomePlans, SitePlanCardText } from "@/pages/marketing/siteContent";
import { PlanCard } from "../PlanCard";
import { SectionTitle } from "../SectionTitle";
import { SiteLink } from "../SiteLink";

export interface HomePlansProps {
  content: SiteHomePlans;
  plans: readonly PaginasWebPackage[];
  cardText: SitePlanCardText;
}

/** Los planes en una banda con borde superior e inferior y fondo de superficie; el destacado va al centro. */
export function HomePlans({ content, plans, cardText }: HomePlansProps) {
  return (
    <section aria-labelledby="home-planes-titulo" className="relative border-y border-site-border bg-site-surface py-24">
      <div className="mx-auto max-w-6xl px-5">
        <SectionTitle id="home-planes-titulo" tag={content.tag} title={content.title} text={content.text} />
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} text={cardText} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-site-muted-foreground">
          {content.note}{" "}
          <SiteLink to={content.compareLink.href} className="text-site-primary-text hover:underline">
            {content.compareLink.label}
          </SiteLink>
        </p>
      </div>
    </section>
  );
}
