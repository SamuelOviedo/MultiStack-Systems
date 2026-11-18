import { Check } from "lucide-react";
import type { SiteTracker } from "@/pages/marketing/siteContent";
import { cn } from "../cn";
import { GlowCard } from "../GlowCard";
import { SiteButton } from "../SiteButton";
import { SiteLink } from "../SiteLink";

export interface ProjectTrackerProps {
  content: SiteTracker;
}

type PhaseState = "done" | "current" | "pending";

const stateOf = (index: number, current: number): PhaseState =>
  index < current ? "done" : index === current ? "current" : "pending";

/**
 * Vista previa del panel del cliente: las ocho fases, con las anteriores a la actual hechas y la actual activa; las
 * dos tarjetas de pago y la entrada al panel. El ticket es de ejemplo, no un cliente real. El estado de cada fase,
 * que la marca visual no dice con texto, va como texto solo para lectores de pantalla.
 */
export function ProjectTracker({ content }: ProjectTrackerProps) {
  const current = content.currentPhaseIndex;

  return (
    <section aria-labelledby="home-seguimiento-titulo" className="mx-auto max-w-6xl px-5 pb-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="font-mono text-sm text-site-primary-text">
            <span aria-hidden="true">&gt;_ </span>
            {content.tag}
          </p>
          <h2 id="home-seguimiento-titulo" className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            {content.title}
          </h2>
          <p className="mt-4 text-site-muted-foreground">{content.text}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            {content.payments.map((payment) => (
              <GlowCard key={payment.label} radius="2xl" contentClassName="p-4">
                <p className="text-3xl font-bold text-site-primary">{payment.value}</p>
                <p className="text-sm text-site-muted-foreground">{payment.label}</p>
              </GlowCard>
            ))}
          </div>
          <SiteButton asChild variant="hero" size="xl" className="mt-8">
            <SiteLink to={content.cta.href}>{content.cta.label}</SiteLink>
          </SiteButton>
        </div>
        <GlowCard className="shadow-card" contentClassName="block p-6">
          <div className="flex items-center justify-between border-b border-site-border pb-4">
            <p className="font-mono text-sm">{content.ticket.label}</p>
            <span className="rounded-full bg-site-primary/15 px-3 py-1 font-mono text-xs text-site-primary-text">
              {content.ticket.status}
            </span>
          </div>
          <ol className="mt-5 space-y-1">
            {content.phases.map((phase, k) => {
              const state = stateOf(k, current);
              const done = state === "done";
              const active = state === "current";
              return (
                <li key={phase.name} className="flex gap-4" aria-current={active ? "step" : undefined}>
                  <div className="flex flex-col items-center">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs",
                        done && "border-site-primary bg-site-primary text-site-primary-foreground",
                        active && "glow border-site-primary text-site-primary-text",
                        state === "pending" && "border-site-border text-site-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : k + 1}
                    </span>
                    {k < content.phases.length - 1 && (
                      <span aria-hidden="true" className={cn("w-px flex-1", done ? "bg-site-primary" : "bg-site-border")} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={cn("text-sm font-semibold", state === "pending" && "text-site-muted-foreground")}>
                      {phase.name} <span className="sr-only">({content.phaseStatus[state]})</span>
                    </p>
                    <p className="text-xs text-site-muted-foreground">{phase.text}</p>
                    {active && (
                      <p className="mt-2 rounded-site-lg bg-site-secondary px-3 py-2 font-mono text-xs text-site-foreground/90">
                        <span className="text-site-primary-text">{content.update.label}</span> {content.update.text}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </GlowCard>
      </div>
    </section>
  );
}
