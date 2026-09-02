import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import Logo from "@/components/common/Logo";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center space-y-6">
        <Logo className="h-10 mx-auto" />
        <div className="space-y-2">
          <p className="font-mono text-[11px] text-muted-foreground tracking-[0.1em]">
            multistack@secure:~$ cd {location.pathname}
          </p>
          <h1 className="font-display text-5xl font-bold text-foreground tracking-tight">
            404
          </h1>
          <p className="font-display text-sm text-muted-foreground">
            bash: ruta no encontrada
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-sm bg-primary/10 border border-primary/30 px-4 py-2.5 font-display text-xs font-medium text-primary hover:bg-primary/20 hover:shadow-[0_0_16px_hsl(var(--primary)/0.25)] transition-all duration-200"
        >
          [ VOLVER AL INICIO ]
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
