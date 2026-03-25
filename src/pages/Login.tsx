import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { Terminal, LogIn, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      toast({ title: "Error de autenticación", description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 pt-20 pb-10">
      <div className="w-full max-w-md">
        {/* Terminal header */}
        <div className="mb-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 mb-6">
            <Terminal className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-semibold tracking-tighter text-foreground">
              MultiStack<span className="text-primary">.</span>
            </span>
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-card p-1">
          {/* Terminal title bar */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-primary/70" />
            </div>
            <span className="font-display text-xs text-muted-foreground ml-2">~/auth/login</span>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <p className="font-display text-xs text-primary mb-1">$ multistack login</p>
              <h1 className="text-xl font-display font-bold text-foreground">Iniciar Sesión</h1>
              <p className="text-sm text-muted-foreground mt-1">Accede a tu panel de cliente</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="font-display text-xs text-muted-foreground mb-1.5 block">email:</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="bg-background border-border font-mono-code text-sm"
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <label className="font-display text-xs text-muted-foreground mb-1.5 block">password:</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-background border-border font-mono-code text-sm pr-10"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full font-display text-sm bg-primary text-primary-foreground hover:bg-primary/90 glow-green"
              >
                {loading ? (
                  <span className="animate-pulse">Autenticando...</span>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    [ LOGIN ]
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              ¿No tienes cuenta?{" "}
              <Link to="/signup" className="text-primary hover:underline font-display">
                Crear cuenta
              </Link>
            </p>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Login;
