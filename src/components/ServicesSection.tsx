import { motion } from "framer-motion";
import { KeyRound, Code2, Cpu, Bot, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ServiceCard {
  icon: LucideIcon;
  title: string;
  description: string;
  tag: string;
}

const services: ServiceCard[] = [
  {
    icon: KeyRound,
    title: "Software Licensing",
    description:
      "Proveedor oficial de Windows, Office y Kaspersky. Gestión completa de activos digitales y licencias empresariales.",
    tag: "Official Partner",
  },
  {
    icon: Code2,
    title: "Custom Web Dev",
    description:
      "Desarrollo a medida con Next.js/React, enfocado en rendimiento, SEO y experiencias de usuario excepcionales.",
    tag: "Next.js / React",
  },
  {
    icon: Cpu,
    title: "Tech Support 2.0",
    description:
      "Soporte técnico especializado para laptops, PC e impresoras. Presencial en Siguatepeque y remoto a nivel nacional.",
    tag: "Local & Remote",
  },
  {
    icon: Bot,
    title: "AI & Automation",
    description:
      "Implementación de flujos de trabajo inteligentes, chatbots personalizados y automatización de procesos empresariales.",
    tag: "Workflow AI",
  },
  {
    icon: ShieldCheck,
    title: "Cybersecurity Audit",
    description:
      "Análisis de vulnerabilidades, blindaje de activos digitales y consultoría en seguridad informática.",
    tag: "Vulnerability Analysis",
  },
];

const ServicesSection = () => (
  <section id="services" className="py-24 px-6">
    <div className="container mx-auto max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">
          services.map()
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tighter text-foreground">
          Lo que construimos
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {services.map((service, i) => {
          const Icon = service.icon;
          const span = i < 3 ? "md:col-span-2" : "md:col-span-3";
          return (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`${span} group relative rounded-lg p-6 bg-card glow-border hover:-translate-y-1 transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)] hover:shadow-[0_0_30px_hsla(187,100%,42%,0.08)]`}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 rounded-md bg-primary/10 p-2.5">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                      {service.title}
                    </h3>
                    <span className="font-mono text-[10px] text-accent/70 bg-accent/10 px-2 py-0.5 rounded-sm">
                      {service.tag}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  </section>
);

export default ServicesSection;
