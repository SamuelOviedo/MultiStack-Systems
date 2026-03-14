import { useState, useEffect } from "react";
import { Terminal } from "lucide-react";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/60 backdrop-blur-md glow-border"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto flex items-center justify-between px-6 py-4">
        <button onClick={() => scrollTo("hero")} className="flex items-center gap-2 group">
          <Terminal className="h-5 w-5 text-primary" />
          <span className="font-display text-sm font-semibold tracking-tighter text-foreground">
            MultiStack<span className="text-primary">.</span>
          </span>
        </button>
        <div className="hidden md:flex items-center gap-8">
          {[
            { label: "Servicios", id: "services" },
            { label: "Stack", id: "stack" },
            { label: "Contacto", id: "footer" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors font-sans"
            >
              {item.label}
            </button>
          ))}
          <button
            onClick={() => scrollTo("services")}
            className="rounded-sm bg-primary/10 px-4 py-2 text-xs font-display font-medium text-primary border border-primary/20 hover:bg-primary/20 hover:glow-green transition-all"
          >
            [ EXPLORAR ]
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
