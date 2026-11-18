import { Check } from "lucide-react";
import { packageRequestPath } from "@/lib/packageIntent";
import { lempiras, lempirasSpoken, type PaginasWebPackage } from "@/lib/webPackages";
import type { SitePlanCardText } from "@/pages/marketing/siteContent";
import { cn } from "./cn";
import { GlowCard } from "./GlowCard";
import { SiteButton } from "./SiteButton";
import { SiteLink } from "./SiteLink";

export interface PlanCardProps {
  plan: PaginasWebPackage;
  /** Textos sueltos de la tarjeta (`SITE_CONTENT.planCard`). El resto sale del plan. */
  text: SitePlanCardText;
  /**
   * Nivel del encabezado con el nombre del plan: `h3` por omisión, que es el correcto bajo el `<h2>` de la banda de la
   * home; `/planes` pasa `h2` porque sus tarjetas cuelgan directo del `<h1>`. El aspecto no cambia.
   */
  as?: "h2" | "h3";
}

/**
 * Tarjeta de un plan. La usan la home y la vista `/planes`. El plan destacado lleva brillo y fondo de acento; la
 * insignia es la del plan. El botón va a `/solicitudes?paquete=<id>` y guarda la intención del paquete antes de
 * navegar (ver SiteLink), de modo que sobreviva al login o al registro.
 */
export function PlanCard({ plan, text, as: Heading = "h3" }: PlanCardProps) {
  return (
    <GlowCard
      className={cn(
        "transition-transform duration-300 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1",
        plan.highlight && "glow",
      )}
      edgeClassName={plan.highlight ? "bg-site-primary/60" : ""}
      faceClassName={plan.highlight ? "bg-site-accent" : ""}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-medium text-site-primary-foreground">
          {plan.badge}
        </span>
      )}
      <Heading className="text-lg font-semibold">{plan.name}</Heading>
      <p className="mt-1 min-h-[3.75rem] text-sm text-site-muted-foreground">{plan.tagline}</p>
      <p className="mt-5 text-4xl font-bold tracking-tight">
        <span aria-hidden="true">{lempiras(plan.priceLempiras)}</span>
        <span className="sr-only">{lempirasSpoken(plan.priceLempiras)}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-site-primary-text">{text.deliveryLine(plan.deliveryBusinessDays)}</p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-site-primary" />
            <span className="text-site-foreground/90">{feature}</span>
          </li>
        ))}
      </ul>
      {/* Bajo `sm` el rótulo puede partirse en dos líneas: con `nowrap` («Solicitar Combo Emprendedor») la pista de la
          cuadrícula no baja de 327 px y la tarjeta se sale del contenedor a 360 px o menos. Con la primera línea completa a
          360 px y más, el aspecto es el de siempre. */}
      <SiteButton
        asChild
        variant={plan.highlight ? "hero" : "glass"}
        size="lg"
        className="mt-7 w-full max-sm:h-auto max-sm:min-h-10 max-sm:whitespace-normal max-sm:px-4 max-sm:py-2 max-sm:text-center"
      >
        <SiteLink to={packageRequestPath(plan.id)} packageId={plan.id}>
          {text.requestLabel(plan.name)}
        </SiteLink>
      </SiteButton>
    </GlowCard>
  );
}
