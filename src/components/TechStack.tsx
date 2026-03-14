import { motion } from "framer-motion";

const techs = [
  "React", "Next.js", "TypeScript", "Python", "Node.js",
  "TailwindCSS", "PostgreSQL", "Docker", "AWS", "OpenAI",
  "Supabase", "Vercel", "Linux", "Git", "Figma",
  "Kaspersky", "Windows Server", "Cloudflare",
];

const TechStack = () => (
  <section id="stack" className="py-24 overflow-hidden">
    <div className="container mx-auto px-6 max-w-6xl mb-12 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <p className="font-mono text-xs text-accent tracking-widest uppercase mb-3">
          tech.stack
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold tracking-tighter text-foreground">
          Nuestro Arsenal
        </h2>
      </motion.div>
    </div>

    {/* Marquee */}
    <div className="relative">
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />
      <div className="flex animate-scroll w-max">
        {[...techs, ...techs].map((tech, i) => (
          <div
            key={`${tech}-${i}`}
            className="mx-3 flex items-center gap-2 rounded-sm glow-border bg-card px-5 py-3 shrink-0"
          >
            <span className="text-primary font-mono text-xs">●</span>
            <span className="font-display text-sm text-foreground/80 whitespace-nowrap">
              {tech}
            </span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TechStack;
