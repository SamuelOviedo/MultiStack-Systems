import { useEffect } from "react";
import { Hero } from "@/components/site/home/Hero";
import { HomePlans } from "@/components/site/home/HomePlans";
import { Portfolio } from "@/components/site/home/Portfolio";
import { ProjectTracker } from "@/components/site/home/ProjectTracker";
import { ServicesBento } from "@/components/site/home/ServicesBento";
import { WhyAndProcess } from "@/components/site/home/WhyAndProcess";
import { SiteLayout } from "@/components/site/SiteLayout";
import { applyPageMeta, routeMetaToPageMeta } from "@/lib/pageMeta";
import { HOME_META } from "@/lib/routeMeta";
import { SITE_PLANS } from "@/lib/webPackages";
import { SITE_CONTENT as CONTENT } from "./siteContent";
import { siteFooterProps, siteHeaderProps } from "./siteLayoutProps";

const HOME_PAGE_META = routeMetaToPageMeta(HOME_META);
const HEADER = siteHeaderProps(CONTENT);
const FOOTER = siteFooterProps(CONTENT);

/**
 * Home pública (`/`): páginas web para negocios en Honduras. Se importa de forma eager en App (va en el chunk de
 * entrada): lazy retrasaba el LCP de la home. Las vistas /planes, /servicios y /contacto sí son lazy. Todo el texto
 * sale de SITE_CONTENT (siteContent.ts) y los planes de SITE_PLANS (webPackages.ts).
 */
const Index = () => {
  // Los metas de la home están en index.html (la entrada directa ya los trae); esto los reafirma al llegar desde otra
  // vista del SPA, por si esa los reemplazó y su limpieza no corrió todavía.
  useEffect(() => applyPageMeta(HOME_PAGE_META), []);

  return (
    <SiteLayout header={HEADER} footer={FOOTER}>
      <Hero hero={CONTENT.hero} />
      <ServicesBento bento={CONTENT.bento} />
      <HomePlans content={CONTENT.homePlans} plans={SITE_PLANS} cardText={CONTENT.planCard} />
      <Portfolio content={CONTENT.portfolio} />
      <WhyAndProcess content={CONTENT.why} />
      <ProjectTracker content={CONTENT.tracker} />
    </SiteLayout>
  );
};

export default Index;
