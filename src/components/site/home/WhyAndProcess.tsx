import { Cpu, Gauge, MapPin, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { SiteReasonIcon, SiteWhy } from "@/pages/marketing/siteContent";
import { GlowCard } from "../GlowCard";
import { SectionTitle } from "../SectionTitle";

const REASON_ICONS: Record<SiteReasonIcon, LucideIcon> = {
  cpu: Cpu,
  gauge: Gauge,
  "map-pin": MapPin,
  users: Users,
  "shield-check": ShieldCheck,
};

export interface WhyAndProcessProps {
  content: SiteWhy;
}

/** Las cinco razones y, debajo, los cuatro pasos del proceso. */
export function WhyAndProcess({ content }: WhyAndProcessProps) {
  return (
    // Los ids `por-que-elegirnos` y `proceso` son anclas antiguas de la home anterior (/#por-que-elegirnos, /#proceso):
    // ver lib/legacyHomeHash.ts. `scroll-mt-24` deja la cabecera fija (64 px) y un margen sobre el destino.
    <section id="por-que-elegirnos" aria-labelledby="home-por-que-titulo" className="mx-auto max-w-6xl scroll-mt-24 px-5 pb-24">
      <SectionTitle id="home-por-que-titulo" tag={content.tag} title={content.title} />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {content.reasons.map((reason) => {
          const Icon = REASON_ICONS[reason.icon];
          return (
            <li key={reason.title} className="flex">
              <GlowCard radius="2xl" className="flex-1" contentClassName="p-5">
                <Icon aria-hidden="true" className="h-6 w-6 text-site-primary" />
                <h3 className="mt-4 font-semibold">{reason.title}</h3>
                <p className="mt-1 text-sm text-site-muted-foreground">{reason.text}</p>
              </GlowCard>
            </li>
          );
        })}
      </ul>
      <ol id="proceso" className="mt-20 grid scroll-mt-24 gap-4 md:grid-cols-4">
        {content.steps.map((step) => (
          <li key={step.number} className="flex">
            <GlowCard radius="2xl" className="flex-1" faceClassName="bg-site-background">
              <p aria-hidden="true" className="font-mono text-3xl font-bold text-site-primary/80">
                {step.number}
              </p>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-site-muted-foreground">{step.text}</p>
            </GlowCard>
          </li>
        ))}
      </ol>
    </section>
  );
}
