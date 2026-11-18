import type { SiteFooterProps } from "@/components/site/SiteFooter";
import type { SiteHeaderProps } from "@/components/site/SiteHeader";
import type { SiteContent } from "./siteContent";

/** Props de la cabecera del sitio con los textos de `SITE_CONTENT.nav`. Las vistas del sitio comparten estas props. */
export function siteHeaderProps(content: SiteContent): SiteHeaderProps {
  const { nav } = content;
  return {
    nav: nav.items.map((item) => ({ to: item.href, label: item.label })),
    cta: { label: nav.cta.label, to: nav.cta.href },
    labels: { home: nav.homeLabel, menu: nav.menuLabel, login: nav.panel.label },
  };
}

/** Props del pie del sitio con los textos de `SITE_CONTENT.footer`, incluidos los enlaces legales. */
export function siteFooterProps(content: SiteContent, year: number = new Date().getFullYear()): SiteFooterProps {
  const { footer } = content;
  return {
    tagline: footer.description,
    logoLabel: footer.logoAlt,
    columns: [
      { title: footer.siteLabel, links: footer.siteLinks.map((link) => ({ label: link.label, to: link.href })) },
      {
        title: footer.contactLabel,
        links: [
          { label: footer.whatsapp.label, to: footer.whatsapp.href, newTab: true, ariaLabel: footer.whatsapp.ariaLabel },
          { label: footer.phone.label, to: footer.phone.href },
        ],
        lines: [footer.location],
      },
    ],
    copyright: footer.copyright(year),
  };
}
