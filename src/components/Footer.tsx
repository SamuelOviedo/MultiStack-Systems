import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Terminal, MessageCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/* ── Inline SVG brand icons ──────────────────────────────────────────────── */

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

/* ── Data ────────────────────────────────────────────────────────────────── */

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 } as const,
  viewport: { once: true },
};

const NAV_LINKS = [
  { label: "Inicio",    href: "#hero" },
  { label: "Servicios", href: "#servicios" },
  { label: "Stack",     href: "#stack" },
  { label: "Soporte",   href: "/login" },
];

const LEGAL_LINKS = [
  { label: "Política de Privacidad", href: "/politica-de-privacidad" },
  { label: "Términos del Servicio",  href: "/terminos-del-servicio" },
];

const SOCIAL_LINKS = [
  { label: "Facebook",  href: "https://www.facebook.com/multistacksystems",  icon: FacebookIcon },
  { label: "Instagram", href: "https://www.instagram.com/multistacksystems/", icon: InstagramIcon },
];

const colLabel = "font-mono text-[10px] text-muted-foreground/40 uppercase tracking-widest mb-4";
const navItem  = "font-display text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 w-fit";

/* ── Contact micro-form ──────────────────────────────────────────────────── */

type FormStatus = "idle" | "loading" | "success" | "error";

function ContactForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus]   = useState<FormStatus>("idle");
  const [errMsg, setErrMsg]   = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading" || message.trim().length < 5) return;

    setStatus("loading");
    setErrMsg("");

    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: { message: message.trim() },
      });
      if (error) throw error;
      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
      setErrMsg("No se pudo enviar. Intenta de nuevo.");
    }
  };

  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-2.5 rounded-sm border border-primary/20 bg-primary/5 px-4 py-3"
      >
        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="font-display text-xs text-primary leading-relaxed">
          ¡Mensaje enviado con éxito! Te responderemos a la brevedad.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe tu mensaje o consulta aquí..."
        rows={4}
        disabled={status === "loading"}
        className={cn(
          "w-full resize-none rounded-sm border bg-background/40 px-3 py-2.5",
          "font-mono text-xs text-foreground placeholder:text-muted-foreground/40",
          "border-border/40 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20",
          "transition-colors duration-200 disabled:opacity-50",
          "leading-relaxed"
        )}
      />

      {status === "error" && (
        <p className="font-mono text-[10px] text-destructive">{errMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading" || message.trim().length < 5}
        className={cn(
          "group/contact inline-flex items-center gap-2 self-start rounded-sm",
          "bg-primary/10 border border-primary/30 px-4 py-2.5",
          "font-display text-xs font-medium text-primary",
          "hover:bg-primary/20 hover:shadow-[0_0_16px_hsl(var(--primary)/0.25)]",
          "transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        )}
      >
        <span>{status === "loading" ? "Enviando..." : "Enviar mensaje"}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover/contact:translate-x-1" />
      </button>
    </form>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */

const Footer = () => (
  <footer id="footer" className="border-t border-foreground/5 pt-20 pb-10 px-6 scroll-mt-20">
    <div className="container mx-auto max-w-6xl">

      {/* ── Main grid ───────────────────────────────────────────────────── */}
      <motion.div
        {...fadeUp}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1.5fr] gap-12 lg:gap-8"
      >

        {/* Col 1 — Brand & Identity */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Terminal className="h-4 w-4 text-primary shrink-0" />
              <span className="font-display text-sm font-semibold tracking-tighter text-foreground">
                MultiStack<span className="text-primary">.</span>
              </span>
            </div>
            <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
              Siguatepeque, HN
              <br />
              14.5951° N, 87.8321° W
            </p>
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-2">
            {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="rounded-sm p-2 border border-border/40 bg-card/30 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all duration-200"
              >
                <Icon className="h-3.5 w-3.5" />
              </a>
            ))}
          </div>
        </div>

        {/* Col 2 — Navegación */}
        <div>
          <p className={colLabel}>Navegación</p>
          <nav className="flex flex-col gap-2.5">
            {NAV_LINKS.map(({ label, href }) => (
              <a key={label} href={href} className={navItem}>
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Col 3 — Legal */}
        <div>
          <p className={colLabel}>Legal</p>
          <nav className="flex flex-col gap-2.5">
            {LEGAL_LINKS.map(({ label, href }) => (
              <Link key={label} to={href} className={navItem}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Col 4 — Contacto */}
        <div>
          <p className={colLabel}>Contacto</p>
          <div className="flex flex-col gap-3">
            <ContactForm />
            <a
              href="https://wa.me/50433023042"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-sm bg-accent/10 px-4 py-2.5 font-display text-xs text-accent border border-accent/20 hover:bg-accent/20 hover:shadow-[0_0_20px_hsla(187,100%,42%,0.2)] transition-all duration-300 w-fit"
            >
              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
              Escríbenos por WhatsApp
            </a>
          </div>
        </div>
      </motion.div>

      {/* ── Bottom bar ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="mt-16 pt-6 border-t border-foreground/5 text-center"
      >
        <p className="font-mono text-[10px] text-muted-foreground/50 tracking-wider">
          © {new Date().getFullYear()} MultiStack Systems. Todos los derechos reservados.
          <span className="animate-blink ml-1">_</span>
        </p>
      </motion.div>

    </div>
  </footer>
);

export default Footer;
