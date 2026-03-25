import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Terminal, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const cmdBtn =
  "rounded-sm px-3 py-1.5 text-xs font-display font-medium border transition-all whitespace-nowrap";

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHome) {
      e.preventDefault();
      scrollTo("hero");
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const navLinkClass =
    "text-sm text-muted-foreground hover:text-foreground transition-colors font-sans";

  const sectionNav = [
    { label: "Servicios", id: "services" as const },
    { label: "Stack", id: "stack" as const },
    { label: "Contacto", id: "footer" as const },
  ];

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-background/60 backdrop-blur-md glow-border" : "bg-transparent"
      )}
    >
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-y-3 px-6 py-4">
        <Link
          to="/"
          onClick={handleLogoClick}
          className="flex items-center gap-2 group"
        >
          <Terminal className="h-5 w-5 text-primary" />
          <span className="font-display text-sm font-semibold tracking-tighter text-foreground">
            MultiStack<span className="text-primary">.</span>
          </span>
        </Link>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-x-6 gap-y-2 md:flex-nowrap md:justify-end">
          <div className="hidden md:flex items-center gap-8">
            {sectionNav.map((item) =>
              isHome ? (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={navLinkClass}
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.id}
                  to={`/#${item.id}`}
                  className={navLinkClass}
                >
                  {item.label}
                </Link>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            {loading ? (
              <span
                className="font-display text-xs text-muted-foreground animate-pulse border border-border/60 px-3 py-1.5 rounded-sm"
                aria-hidden
              >
                [ ... ]
              </span>
            ) : user ? (
              <>
                <Link
                  to="/dashboard"
                  className={cn(
                    cmdBtn,
                    "inline-flex items-center gap-1.5 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:glow-green"
                  )}
                >
                  <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                  [ DASHBOARD ]
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={cn(
                    cmdBtn,
                    "inline-flex items-center gap-1.5 bg-background/80 text-muted-foreground border-border hover:text-foreground hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  [ LOGOUT ]
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className={cn(
                    cmdBtn,
                    "inline-flex items-center gap-1.5 bg-background/80 text-muted-foreground border-border hover:text-primary hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  [ LOGIN ]
                </Link>
                <Link
                  to="/signup"
                  className={cn(
                    cmdBtn,
                    "inline-flex items-center gap-1.5 bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 hover:glow-green"
                  )}
                >
                  [ SIGN UP ]
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
