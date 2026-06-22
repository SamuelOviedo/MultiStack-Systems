import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { KeyRound, Code2, Cpu, Bot, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceCTA } from "./landing/ServiceCTA";

interface CatalogEntry {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "partner";
  ctaIntent: string;
  comingSoon?: boolean;
}

const CATALOG: CatalogEntry[] = [
  {
    icon: KeyRound,
    title: "Licenciamiento de Software",
    description:
      "Proveedor oficial de Windows, Office 365 y Kaspersky. Gestionamos la adquisición, activación y renovación de licencias empresariales, garantizando cumplimiento legal y continuidad operativa para su organización.",
    badge: "Socio Oficial",
    badgeVariant: "partner",
    ctaIntent: "?intent=software-licensing",
  },
  {
    icon: Code2,
    title: "Desarrollo Web a Medida",
    description:
      "Plataformas web y sistemas internos desarrollados con las tecnologías más sólidas del ecosistema moderno. Diseñados para escalar, optimizados para el rendimiento y orientados a experiencias de usuario excepcionales.",
    ctaIntent: "?intent=web-development",
  },
  {
    icon: Cpu,
    title: "Soporte Técnico 2.0",
    description:
      "Soporte técnico especializado para laptops, equipos de escritorio e impresoras. Atención presencial en Siguatepeque y asistencia remota a nivel nacional, con tiempos de respuesta definidos y garantizados.",
    ctaIntent: "?intent=tech-support",
  },
  {
    icon: Bot,
    title: "IA y Automatización",
    description:
      "Implementación de flujos de trabajo inteligentes, chatbots corporativos y automatización de procesos empresariales. Reducimos la carga operativa para que su equipo se concentre en decisiones de alto impacto.",
    ctaIntent: "?intent=ai-automation",
    comingSoon: true,
  },
  {
    icon: ShieldCheck,
    title: "Auditoría en Ciberseguridad",
    description:
      "Análisis de vulnerabilidades, blindaje de activos digitales y consultoría estratégica en seguridad informática. Protegemos su infraestructura con metodologías de clase mundial adaptadas al contexto regional.",
    ctaIntent: "?intent=cybersecurity",
    comingSoon: true,
  },
];

const partnerBadgeCls = "text-primary/80 bg-primary/10 border border-primary/20";

const ServicesSection = () => {
  const [active, setActive] = useState(0);

  return (
    <section id="services" className="py-24 px-6 scroll-mt-20">
      <div className="container mx-auto max-w-6xl">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="mb-12 text-center"
        >
          <p className="eyebrow mb-3">// catálogo de servicios</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tighter text-foreground">
            Todo lo que hacemos, en detalle.
          </h2>
        </motion.div>

        {/* Two-column tab layout */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.4, 0, 0.2, 1] }}
          className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] rounded-sm border border-border bg-card dark:bg-card/20 dark:backdrop-blur-sm overflow-hidden"
        >
          {/* ── Left: service navigator ── */}
          <div className="border-b lg:border-b-0 lg:border-r border-border/40 p-3">
            <p className="font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest px-2 pt-1 pb-2">
              Servicios
            </p>
            <nav className="flex flex-col gap-1" aria-label="Catálogo de servicios">
              {CATALOG.map((entry, i) => {
                const EntryIcon = entry.icon;
                const isActive = active === i;
                return (
                  <button
                    key={entry.title}
                    type="button"
                    onClick={() => setActive(i)}
                    aria-current={isActive ? "true" : undefined}
                    className={cn(
                      "group flex items-center gap-3 w-full px-3 py-3 rounded-sm text-left",
                      "transition-all duration-200",
                      isActive
                        ? "bg-primary/10 border border-primary/20 shadow-[inset_2px_0_0_hsl(var(--primary))]"
                        : "border border-transparent hover:bg-card-muted dark:hover:bg-card/60 hover:border-border/40"
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "shrink-0 p-2 rounded-sm transition-colors duration-200",
                        isActive
                          ? "bg-primary/15"
                          : "bg-muted/40 group-hover:bg-muted/60"
                      )}
                    >
                      <EntryIcon
                        className={cn(
                          "h-3.5 w-3.5 transition-colors duration-200",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                    </div>

                    {/* Label */}
                    <span
                      className={cn(
                        "flex-1 font-display text-[13px] font-medium leading-tight transition-colors duration-200",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground/80"
                      )}
                    >
                      {entry.title}
                    </span>

                    {/* Badge — partner only */}
                    {entry.badgeVariant === "partner" && (
                      <span className={cn(
                        "shrink-0 hidden sm:inline font-mono text-[9px] px-1.5 py-0.5 rounded-sm whitespace-nowrap",
                        partnerBadgeCls
                      )}>
                        {entry.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ── Right: detail panel ── */}
          <div className="relative p-7 sm:p-8 min-h-[380px] flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="flex flex-col gap-5 flex-1"
              >
                {/* Title row */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="shrink-0 rounded-sm bg-primary/10 border border-primary/15 p-2.5">
                    {(() => {
                      const PanelIcon = CATALOG[active].icon;
                      return <PanelIcon className="h-5 w-5 text-primary" />;
                    })()}
                  </div>
                  <div className="flex flex-col gap-1">
                    <h3 className="font-display text-lg font-semibold text-foreground tracking-tight leading-tight">
                      {CATALOG[active].title}
                    </h3>
                    {CATALOG[active].badgeVariant === "partner" && (
                      <span className={cn("font-mono text-[10px] px-2 py-0.5 rounded-sm w-fit", partnerBadgeCls)}>
                        {CATALOG[active].badge}
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed">
                  {CATALOG[active].description}
                </p>

                {/* CTA */}
                <div className="mt-auto pt-2">
                  {CATALOG[active].comingSoon ? (
                    <div className="inline-flex items-center gap-2.5 rounded-sm bg-warning/10 border border-warning/30 px-4 py-2.5 text-sm font-display text-warning cursor-default">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse shrink-0" />
                      Disponible próximamente
                    </div>
                  ) : (
                    <ServiceCTA
                      label="Solicitar este servicio"
                      intent={CATALOG[active].ctaIntent}
                    />
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ServicesSection;
