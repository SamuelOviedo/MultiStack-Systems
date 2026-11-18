import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { SITE_CONTACT_LOOK } from "@/components/site/contactFormLook";
import { GlowCard } from "@/components/site/GlowCard";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SiteLink } from "@/components/site/SiteLink";
import ContactForm from "@/components/marketing/ContactForm";
import { applyPageMeta, routeMetaToPageMeta } from "@/lib/pageMeta";
import { ROUTE_META } from "@/lib/routeMeta";
import { SITE_CONTENT as CONTENT } from "./siteContent";
import { siteFooterProps, siteHeaderProps } from "./siteLayoutProps";

const PAGE_META = routeMetaToPageMeta(ROUTE_META["/contacto"]);
const HEADER = siteHeaderProps(CONTENT);
const FOOTER = siteFooterProps(CONTENT);

const CHANNEL =
  "flex items-center justify-between gap-3 rounded-site-lg border border-site-primary/70 px-6 py-3 font-mono text-sm font-semibold text-site-foreground transition-colors hover:bg-site-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-ring";

/**
 * `/contacto`: encabezado de la referencia y, al lado, los otros canales. El formulario es el de siempre
 * (ContactForm: Edge Function, consentimiento y honeypot), con el aspecto del sitio. Los textos del formulario no están
 * en SITE_CONTENT: son los de ContactForm.
 *
 * Aquí NO se envía la conversión de Ads: `/contacto` no está en `ADS_ROUTES` (lib/analytics) porque la Política de
 * Privacidad v1.2 solo nombra la home, `/paginas-web` y las páginas legales. Medir `/contacto` exige antes publicar una
 * Política nueva que nombre la ruta; sin eso no se añade a `ADS_ROUTES`.
 */
const Contacto = () => {
  useEffect(() => applyPageMeta(PAGE_META), []);
  const view = CONTENT.contactView;

  return (
    <SiteLayout header={HEADER} footer={FOOTER}>
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="bg-grid absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 md:py-24">
          <p className="font-mono text-sm text-site-primary-text">{view.eyebrow}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">{view.title}</h1>
          <p className="mt-4 max-w-[52ch] text-base leading-relaxed text-site-muted-foreground md:text-[16.5px]">
            {view.intro}
          </p>

          <div className="mt-12 grid items-start gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
            <GlowCard radius="2xl" contentClassName="block md:p-7">
              <ContactForm idPrefix="contacto" look={SITE_CONTACT_LOOK} />
            </GlowCard>
            <div>
              <p id="contacto-alternativas" className="font-mono text-xs text-site-muted-foreground">
                {view.alternativesLabel}
              </p>
              <ul role="list" aria-labelledby="contacto-alternativas" className="mt-3 flex flex-col gap-3">
                <li>
                  <SiteLink
                    to={view.whatsapp.href}
                    target="_blank"
                    aria-label={view.whatsapp.ariaLabel}
                    className={CHANNEL}
                  >
                    {view.whatsapp.label}
                    <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-site-muted-foreground" />
                  </SiteLink>
                </li>
                <li>
                  <SiteLink to={view.phone.href} className={CHANNEL}>
                    {view.phone.label}
                  </SiteLink>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
};

export default Contacto;
