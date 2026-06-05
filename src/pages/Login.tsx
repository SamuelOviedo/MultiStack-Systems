import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSiteOrigin } from "@/lib/siteUrl";
import { useAuth } from "@/hooks/useAuth";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AuthBrandPanel from "@/components/AuthBrandPanel";

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
);

const AuthLoadingScreen = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
    <div className="text-center space-y-1">
      <p className="font-mono text-[11px] text-muted-foreground tracking-[0.1em]">
        multistack-auth@secure:~$
      </p>
      <p className="text-[17px] font-semibold text-foreground tracking-tight">
        MultiStack<span className="text-primary">.</span>
      </p>
    </div>
    <div className="h-5 w-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { user, userType, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user || userType === null) return;

    // Consume sessionStorage intent set by HookSection CTA
    const storedIntent = sessionStorage.getItem("postLoginIntent");
    if (storedIntent && (userType === 0 || userType === 1)) {
      sessionStorage.removeItem("postLoginIntent");
      navigate(`/dashboard/new-request${storedIntent}`, { replace: true });
      return;
    }

    // Honour ?redirect= param (safe: must start with /)
    const params = new URLSearchParams(location.search);
    const redirectTo = params.get("redirect");
    if (redirectTo?.startsWith("/") && (userType === 0 || userType === 1)) {
      navigate(redirectTo, { replace: true });
      return;
    }

    if (userType === 0 || userType === 1) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/solicitudes", { replace: true });
    }
  }, [user, userType, authLoading, navigate, location.search]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      toast({ title: "Error de autenticación", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${getSiteOrigin()}/auth/callback` },
    });
    if (error) {
      toast({ title: "Error de autenticación", description: error.message, variant: "destructive" });
      setOauthLoading(null);
    }
  };

  // Hold the loading screen while Supabase resolves the session, and keep it
  // up while user is set so the redirect useEffect fires without a form flash.
  if (authLoading || user) return <AuthLoadingScreen />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] min-h-screen">
      {/* Left: brand panel */}
      <AuthBrandPanel />

      {/* Right: form panel */}
      <div className="bg-background flex flex-col px-12 py-8 min-h-screen">
        {/* Top row */}
        <div className="flex justify-between items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-muted-foreground">¿Aún no tienes cuenta?</span>
            <Link
              to="/signup"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              Regístrate
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Center: form */}
        <div className="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full py-8">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground mb-2">
            Iniciar sesión
          </h2>
          <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed mb-8">
            Bienvenido de vuelta. Continúa con tu cuenta.
          </p>

          {/* SSO */}
          <div className="grid grid-cols-2 gap-2.5 mb-6">
            <Button
              variant="outline"
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("google")}
              className="h-11 border-border text-foreground font-medium gap-2.5 hover:bg-foreground/5 hover:border-border/80 disabled:opacity-60"
            >
              {oauthLoading === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Google
            </Button>
            <Button
              variant="outline"
              type="button"
              disabled={!!oauthLoading}
              onClick={() => handleOAuth("github")}
              className="h-11 border-border text-foreground font-medium gap-2.5 hover:bg-foreground/5 hover:border-border/80 disabled:opacity-60"
            >
              {oauthLoading === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitHubIcon />}
              GitHub
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] uppercase tracking-[0.1em] font-mono text-muted-foreground">o</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-muted-foreground mb-1.5">
                Email de trabajo
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                className="h-[42px] bg-background/60 border-border text-foreground text-sm font-sans rounded-md focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0"
                required
                maxLength={255}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-muted-foreground">
                  Contraseña
                </label>
                <Link to="/auth/reset-password" className="text-xs text-primary hover:underline">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-[42px] bg-background/60 border-border text-foreground text-sm font-sans rounded-md focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0 pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-md mt-2 hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(14,165,233,0.30)] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iniciando sesión…
                </>
              ) : (
                "Iniciar sesión"
              )}
            </Button>
          </form>
        </div>

        {/* Bottom: footer */}
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <span className="font-mono">© 2026 multistack.dev</span>
          <div className="flex gap-3.5">
            <a href="#" className="hover:text-foreground transition-colors">Soporte</a>
            <a href="#" className="hover:text-foreground transition-colors">Estado</a>
            <a href="#" className="hover:text-foreground transition-colors">Docs</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
