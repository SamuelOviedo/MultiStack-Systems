import { motion } from "framer-motion";
import { Layers, Server, BrainCircuit } from "lucide-react";
import { ServiceCard, type ServiceCardData } from "./ServiceCard";
import { useServiceExpand } from "./hooks/useServiceExpand";

const SERVICES: ServiceCardData[] = [
  {
    icon: <Layers className="h-5 w-5 text-primary" />,
    eyebrow: "Desarrollo a Medida",
    headline: "Tu negocio merece software que trabaje como tú.",
    teaser:
      "Sistemas hechos a la medida de tu operación — no plantillas, no compromisos.",
    benefits: [
      "Sistemas internos que eliminan procesos manuales",
      "Plataformas web y móviles listas para escalar",
      "Entrega por fases: pagas por resultados, no por promesas",
    ],
    ctaLabel: "Comenzar mi proyecto →",
    ctaIntent: "?intent=software-development",
  },
  {
    icon: <Server className="h-5 w-5 text-primary" />,
    eyebrow: "Web & Soporte TI",
    headline: "Infraestructura que no te falla cuando más importa.",
    teaser:
      "Hosting, redes y soporte técnico con garantía de respuesta — desde Honduras.",
    benefits: [
      "Hosting administrado con monitoreo activo",
      "Soporte técnico remoto y presencial en Honduras",
      "SLA con tiempo de respuesta garantizado",
    ],
    ctaLabel: "Solicitar soporte ahora →",
    ctaIntent: "?intent=tech-support",
  },
  {
    icon: <BrainCircuit className="h-5 w-5 text-primary" />,
    eyebrow: "IA & Automatización",
    headline: "Automatiza lo repetitivo. Enfócate en crecer.",
    teaser:
      "Integra inteligencia artificial donde más duele: flujos lentos, errores humanos, tareas repetitivas.",
    benefits: [
      "Chatbots empresariales integrados a tu operación",
      "Flujos automáticos que reducen carga operativa",
      "Integración con herramientas que ya usas",
    ],
    ctaLabel: "Ver cómo funciona →",
    ctaIntent: "?intent=ai-automation",
  },
];

export function HookSection() {
  const { isExpanded, toggle, expand, collapse } = useServiceExpand();

  return (
    <section
      id="servicios"
      className="relative py-24 px-6 overflow-hidden"
    >
      {/* Ambient depth glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <div className="relative container mx-auto max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className="mb-14 text-center"
        >
          <p className="eyebrow mb-3">// servicios principales</p>
          <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tighter text-foreground mb-4">
            Soluciones diseñadas para escalar.
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Más que proveedor — somos el equipo técnico que tu empresa
            necesita para crecer con confianza.
          </p>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SERVICES.map((service, i) => (
            <ServiceCard
              key={service.eyebrow}
              {...service}
              index={i}
              isOpen={isExpanded(i)}
              onExpand={() => expand(i)}
              onCollapse={() => collapse(i)}
              onToggle={() => toggle(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
