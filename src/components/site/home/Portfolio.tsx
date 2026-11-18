import { useId } from "react";
import { ArrowUpRight } from "lucide-react";
import type { SitePortfolio } from "@/pages/marketing/siteContent";
import lauShot from "@/assets/site/laugraphic-sitio.webp";
import { GlowCard } from "../GlowCard";
import { SectionTitle } from "../SectionTitle";
import { SiteLink } from "../SiteLink";

export interface PortfolioProps {
  content: SitePortfolio;
}

/**
 * «Webs que ya lanzamos»: LAU Graphic, el único proyecto externo. Toda la tarjeta es clicable con el enlace
 * «Visitar sitio» (patrón de tarjeta clicable, como los títulos del bento): abre en una pestaña nueva, lo avisa en su
 * nombre accesible y se describe con el nombre del proyecto.
 */
export function Portfolio({ content }: PortfolioProps) {
  const { project } = content;
  const nameId = useId();

  return (
    <section aria-labelledby="home-proyectos-titulo" className="mx-auto max-w-6xl px-5 py-24">
      <SectionTitle id="home-proyectos-titulo" tag={content.tag} title={content.title} />
      <div className="mt-14">
        <GlowCard contentClassName="grid items-center gap-10 p-4 md:grid-cols-[1.4fr_1fr] md:p-6">
          <div className="overflow-hidden rounded-site-2xl border border-site-border">
            <div className="flex items-center gap-1.5 bg-site-surface px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-site-muted-foreground/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-site-muted-foreground/40" />
              <span className="h-2.5 w-2.5 rounded-full bg-site-muted-foreground/40" />
              <span className="ml-3 font-mono text-xs text-site-muted-foreground">{project.hostLabel}</span>
            </div>
            <img
              src={lauShot}
              alt={project.imageAlt}
              width={1280}
              height={720}
              loading="lazy"
              className="h-auto w-full transition duration-500 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.02]"
            />
          </div>
          <div className="p-2">
            <p className="font-mono text-xs text-site-primary-text">{project.kind}</p>
            <h3 id={nameId} className="mt-2 text-3xl font-bold">
              {project.name}
            </h3>
            <p className="mt-4 text-site-muted-foreground">{project.description}</p>
            <SiteLink
              to={project.link.href}
              target="_blank"
              aria-label={project.link.ariaLabel}
              aria-describedby={nameId}
              className="mt-6 inline-flex items-center gap-2 rounded-site-3xl text-sm font-medium text-site-primary-text outline-none after:absolute after:inset-0 after:rounded-site-3xl focus-visible:after:ring-2 focus-visible:after:ring-site-ring"
            >
              {project.link.label} <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </SiteLink>
          </div>
        </GlowCard>
      </div>
    </section>
  );
}
