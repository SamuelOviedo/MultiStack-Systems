import { motion } from "framer-motion";
import TerminalHero from "./TerminalHero";

const HeroSection = () => {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20 overflow-hidden"
    >
      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 text-center max-w-4xl mx-auto mb-12">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-mono text-xs text-accent tracking-widest uppercase mb-6"
        >
          Siguatepeque, HN — Remote First
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tighter text-foreground leading-tight"
        >
          MultiStack Systems:
          <br />
          <span className="text-primary">High-Level Engineering</span>{" "}
          Solutions.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-6 text-lg text-muted-foreground font-sans max-w-2xl mx-auto leading-relaxed"
        >
          Desarrollo, Soporte y Licenciamiento con ADN de Ingeniero.
          <br />
          Construimos la infraestructura que tu crecimiento exige.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <button
            onClick={() => scrollTo("services")}
            className="rounded-sm bg-primary/10 px-6 py-3 font-display text-sm font-medium text-primary border border-primary/20 hover:bg-primary/20 hover:shadow-[0_0_20px_hsla(142,70%,50%,0.3)] transition-all duration-300"
          >
            [ EXPLORAR_SERVICIOS ]
          </button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="relative z-10 w-full flex justify-center"
      >
        <TerminalHero />
      </motion.div>
    </section>
  );
};

export default HeroSection;
