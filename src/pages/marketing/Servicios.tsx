import { useEffect } from "react";
import { Boxes, Bot, Globe, Wrench, type LucideIcon } from "lucide-react";
import { GlowCard } from "@/components/site/GlowCard";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SiteButton } from "@/components/site/SiteButton";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SiteLink } from "@/components/site/SiteLink";
import { applyPageMeta, routeMetaToPageMeta } from "@/lib/pageMeta";
import { ROUTE_META } from "@/lib/routeMeta";
import { SITE_CONTENT as CONTENT, type SiteServiceItem } from "./siteContent";
import { siteFooterProps, siteHeaderProps } from "./siteLayoutProps";

const PAGE_META = routeMetaToPageMeta(ROUTE_META["/servicios"]);
const HEADER = siteHeaderProps(CONTENT);
const FOOTER = siteFooterProps(CONTENT);

const SERVICE_ICONS: Record<SiteServiceItem["id"], LucideIcon> = {
  web: Globe,
  techon: Wrench,
  ia: Bot,
  tools: Boxes,
};

function ServiceCard({ service }: { service: SiteServiceItem }) {
  const Icon = SERVICE_ICONS[service.id];
  const { cta } = service;
  return (
    <GlowCard contentClassName="p-8">
      <div className="flex items-center justify-between">
        <span className="grid h-12 w-12 place-items-center rounded-site-2xl bg-site-primary/15 text-site-primary">
          <Icon aria-hidden="true" />
        </span>
        <span className="font-mono text-xs text-site-primary-text">{service.code}</span>
      </div>
      <h2 className="mt-6 text-2xl font-bold">{service.title}</h2>
      <p className="mt-1 text-sm text-site-muted-foreground">{service.price}</p>
      <ul className="mt-5 grid flex-1 grid-cols-2 gap-2 text-sm">
        {service.items.map((item) => (
          <li key={item} className="rounded-site-lg bg-site-secondary px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
      <SiteButton asChild variant="glass" className="mt-6 self-start">
        {/* WhatsApp con el mensaje del servicio, en pestaña nueva; el nombre accesible lo avisa y nombra el servicio. */}
        <SiteLink to={cta.href} target="_blank" aria-label={cta.ariaLabel}>
          {cta.label}
        </SiteLink>
      </SiteButton>
    </GlowCard>
  );
}

/**
 * `/servicios`: los cuatro servicios en tarjetas con brillo y un «Consultar» que abre WhatsApp con el mensaje del
 * servicio. Todo el texto sale de SITE_CONTENT.servicesView.
 */
const Servicios = () => {
  useEffect(() => applyPageMeta(PAGE_META), []);
  const view = CONTENT.servicesView;

  return (
    <SiteLayout header={HEADER} footer={FOOTER}>
      <section aria-labelledby="servicios-titulo" className="relative overflow-hidden">
        <div aria-hidden="true" className="bg-grid absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-20">
          <SectionTitle as="h1" id="servicios-titulo" tag={view.tag} title={view.title} text={view.text} />
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-5 pb-24 md:grid-cols-2">
        {view.items.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </section>
    </SiteLayout>
  );
};

export default Servicios;
