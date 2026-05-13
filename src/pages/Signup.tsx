import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getAuthEmailRedirectUrl } from "@/lib/siteUrl";
import AuthBrandPanel from "@/components/AuthBrandPanel";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: getAuthEmailRedirectUrl() },
    });

    if (error) {
      toast({ title: "Error al crear cuenta", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "¡Cuenta creada!",
        description: "Revisa tu email para confirmar tu cuenta.",
      });
      navigate("/login");
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] min-h-screen">
      {/* Left: brand panel */}
      <AuthBrandPanel />

      {/* Right: form panel */}
      <div className="bg-background flex flex-col px-12 py-8 min-h-screen">
        {/* Top row */}
        <div className="flex justify-end items-center gap-4">
          <span className="text-[13px] text-muted-foreground">¿Ya tienes cuenta?</span>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Iniciar sesión
          </Link>
        </div>

        {/* Center: form */}
        <div className="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full py-8">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground mb-2">
            Crear cuenta
          </h2>
          <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed mb-8">
            Únete a la plataforma MultiStack.
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
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
              <label htmlFor="password" className="block text-xs font-medium text-muted-foreground mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
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
            <p className="text-xs text-muted-foreground">
              Al crear tu cuenta aceptas los términos del servicio.
            </p>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-md mt-2 hover:bg-primary/90 hover:shadow-[0_0_16px_rgba(14,165,233,0.30)] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando cuenta…
                </>
              ) : (
                "Crear cuenta"
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

export default Signup;
