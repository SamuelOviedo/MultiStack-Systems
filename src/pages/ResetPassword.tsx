import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSiteOrigin } from "@/lib/siteUrl";
import { Terminal, ArrowLeft, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import AuthBrandPanel from "@/components/AuthBrandPanel";

const ResetPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getSiteOrigin()}/auth/callback`,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] min-h-screen">
      <AuthBrandPanel />

      <div className="bg-background flex flex-col px-12 py-8 min-h-screen">
        {/* Top row */}
        <div className="flex justify-start">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio de sesión
          </Link>
        </div>

        {/* Center */}
        <div className="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full py-8">
          {sent ? (
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/12 border border-primary/30 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                Revisa tu email
              </h2>
              <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed">
                Enviamos un enlace de recuperación a{" "}
                <span className="font-mono text-foreground">{email}</span>.
                Revisa tu bandeja de entrada y carpeta de spam.
              </p>
              <Button
                variant="outline"
                className="h-11 border-border text-foreground hover:bg-foreground/5"
                onClick={() => setSent(false)}
              >
                Intentar con otro email
              </Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground mb-2">
                Recuperar contraseña
              </h2>
              <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed mb-8">
                Ingresa tu email y te enviamos un enlace para restablecer tu contraseña.
              </p>

              <form onSubmit={handleReset} className="space-y-4">
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
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-md mt-2 hover:bg-primary/90 dark:hover:shadow-[0_0_16px_rgba(14,165,233,0.30)] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all disabled:opacity-70"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando…
                    </>
                  ) : (
                    "Enviar enlace de recuperación"
                  )}
                </Button>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
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

export default ResetPassword;
