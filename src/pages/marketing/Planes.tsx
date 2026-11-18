import { useEffect } from "react";
import { PlanCard } from "@/components/site/PlanCard";
import { PlanComparison } from "@/components/site/PlanComparison";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SiteLayout } from "@/components/site/SiteLayout";
import { applyPageMeta, routeMetaToPageMeta } from "@/lib/pageMeta";
import { ROUTE_META } from "@/lib/routeMeta";
import { PLAN_COMPARISON, SITE_PLANS } from "@/lib/webPackages";
import { SITE_CONTENT as CONTENT } from "./siteContent";
import { siteFooterProps, siteHeaderProps } from "./siteLayoutProps";

const PAGE_META = routeMetaToPageMeta(ROUTE_META["/planes"]);
const HEADER = siteHeaderProps(CONTENT);
const FOOTER = siteFooterProps(CONTENT);

/**
 * `/planes`: los tres planes y la tabla «Comparación completa». Los textos son de SITE_CONTENT.plansView y los datos
 * de SITE_PLANS y PLAN_COMPARISON (webPackages.ts). Cada tarjeta lleva al flujo de solicitudes con su paquete.
 */
const Planes = () => {
  useEffect(() => applyPageMeta(PAGE_META), []);
  const view = CONTENT.plansView;

  return (
    <SiteLayout header={HEADER} footer={FOOTER}>
      <section aria-labelledby="planes-titulo" className="relative overflow-hidden">
        <div aria-hidden="true" className="bg-grid absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-20">
          <SectionTitle as="h1" id="planes-titulo" tag={view.tag} title={view.title} text={view.text} />
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {SITE_PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} text={CONTENT.planCard} as="h2" />
            ))}
          </div>
        </div>
      </section>
      <PlanComparison plans={SITE_PLANS} rows={PLAN_COMPARISON} text={view.comparison} />
    </SiteLayout>
  );
};

export default Planes;
