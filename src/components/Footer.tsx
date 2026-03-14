import { Terminal, Mail, MessageCircle } from "lucide-react";

const Footer = () => (
  <footer id="footer" className="border-t border-foreground/5 py-16 px-6">
    <div className="container mx-auto max-w-6xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start mb-3">
            <Terminal className="h-4 w-4 text-primary" />
            <span className="font-display text-sm font-semibold tracking-tighter text-foreground">
              MultiStack Systems
            </span>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Siguatepeque, HN // 14.5951° N, 87.8321° W
          </p>
        </div>

        <div className="flex items-center gap-4">
          <a
            href="mailto:contacto@multistacksystems.com"
            className="flex items-center gap-2 rounded-sm bg-primary/10 px-4 py-2.5 font-display text-xs text-primary border border-primary/20 hover:bg-primary/20 hover:shadow-[0_0_20px_hsla(142,70%,50%,0.3)] transition-all duration-300"
          >
            <Mail className="h-3.5 w-3.5" />
            [ EMAIL_INIT ]
          </a>
          <a
            href="https://wa.me/50494000000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-sm bg-accent/10 px-4 py-2.5 font-display text-xs text-accent border border-accent/20 hover:bg-accent/20 hover:shadow-[0_0_20px_hsla(187,100%,42%,0.2)] transition-all duration-300"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            [ WHATSAPP_INIT ]
          </a>
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-foreground/5 text-center">
        <p className="font-mono text-[10px] text-muted-foreground/60 tracking-wider">
          © {new Date().getFullYear()} MultiStack Systems. All rights reserved.
          <span className="animate-blink ml-1">_</span>
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
