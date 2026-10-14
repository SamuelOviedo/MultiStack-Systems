import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Link2Off, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import BrandLoader from "@/components/common/BrandLoader";
import { useAuth } from "@/hooks/useAuth";
import {
  authErrorCode, describeAuthError, INVALID_LINK_CODES, PASSWORD_RULES, updatePassword, validateNewPassword,
} from "@/lib/auth";
import { clearAuthLinkError, peekAuthLinkError } from "@/lib/authRedirect";

const INPUT =
  "h-[42px] bg-background/60 border-border text-foreground text-sm font-sans rounded-md pr-10 focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-0";

type InvalidReason = "link" | "no-session" | "not-recovery";

/**
 * Last step of password recovery: the user arrives here with the session
 * created by the e-mail link (implicit flow) and chooses a new password.
 * Without a recovery session the page only offers to request a new link.
 */
const UpdatePassword = () => {
  const navigate = useNavigate();
  const { session, userType, loading, recoveryPending, finishRecovery } = useAuth();

  // Captured at startup from the URL hash (otp_expired, access_denied…).
  const [linkError] = useState(() => peekAuthLinkError());
  useEffect(() => { if (linkError) clearAuthLinkError(); }, [linkError]);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionRejected, setSessionRejected] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(password, confirmation);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePassword(password);
      finishRecovery();
      setDone(true);
    } catch (err) {
      const code = authErrorCode(err);
      if (code && INVALID_LINK_CODES.has(code)) setSessionRejected(true);
      else setError(describeAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const goToApp = () =>
    navigate(userType === 0 || userType === 1 ? "/dashboard" : "/solicitudes", { replace: true });

  let invalid: InvalidReason | null = null;
  if (!done) {
    if (linkError || sessionRejected) invalid = "link";
    else if (!loading && !session) invalid = "no-session";
    else if (!loading && !recoveryPending) invalid = "not-recovery";
  }

  let body: React.ReactNode;
  if (loading && !linkError) {
    body = (
      <div className="flex justify-center py-16">
        <BrandLoader />
      </div>
    );
  } else if (done) {
    body = (
      <div className="space-y-4" role="status">
        <div className="w-12 h-12 rounded-xl bg-primary/12 border border-primary/30 flex items-center justify-center">
          <CheckCircle2 className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">Contraseña actualizada</h2>
        <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed">
          Ya puedes usar tu nueva contraseña. Por seguridad, cerramos las demás sesiones abiertas de tu cuenta.
        </p>
        <Button onClick={goToApp} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
          Continuar
        </Button>
      </div>
    );
  } else if (invalid) {
    const text =
      invalid === "link"
        ? "El enlace no es válido o ya expiró. Cada enlace funciona una sola vez y caduca en 1 hora."
        : invalid === "no-session"
          ? "Abre el enlace más reciente que te enviamos por correo para elegir una nueva contraseña."
          : "Para cambiar tu contraseña, solicita un enlace de recuperación y ábrelo desde tu correo.";
    body = (
      <div className="space-y-4" role="alert">
        <div className="w-12 h-12 rounded-xl bg-muted border border-border flex items-center justify-center">
          <Link2Off className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground">
          {invalid === "link" ? "Enlace no válido" : "Necesitas un enlace de recuperación"}
        </h2>
        <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed">{text}</p>
        <Button asChild className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">
          <Link to="/auth/reset-password">Solicitar un nuevo enlace</Link>
        </Button>
      </div>
    );
  } else {
    body = (
      <>
        <div className="w-12 h-12 rounded-xl bg-primary/12 border border-primary/30 flex items-center justify-center mb-4">
          <KeyRound className="h-5 w-5 text-primary" />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground mb-2">Crea una nueva contraseña</h2>
        <p className="text-sm text-[hsl(var(--body-foreground))] leading-relaxed mb-8">
          {session?.user.email ? <>Para la cuenta <span className="font-mono text-foreground">{session.user.email}</span>. </> : null}
          Usa al menos {PASSWORD_RULES.min} caracteres combinando letras y números.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="new-password" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Nueva contraseña
            </label>
            <div className="relative">
              <Input
                id="new-password"
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "password-error" : undefined}
                maxLength={PASSWORD_RULES.max}
                className={INPUT}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="confirm-password" className="block text-xs font-medium text-muted-foreground mb-1.5">
              Confirmar contraseña
            </label>
            <Input
              id="confirm-password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "password-error" : undefined}
              maxLength={PASSWORD_RULES.max}
              className={INPUT}
            />
          </div>

          {error && (
            <p id="password-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={saving}
            className="w-full h-11 bg-primary text-primary-foreground font-sans font-medium text-sm rounded-md mt-2 hover:bg-primary/90 disabled:opacity-70"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando…
              </>
            ) : (
              "Guardar nueva contraseña"
            )}
          </Button>
        </form>
      </>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] min-h-screen">
      <AuthBrandPanel />
      {/* Mobile: the form comes first — recovery links are mostly opened on phones. */}
      <div className="order-first lg:order-none bg-background flex flex-col px-6 sm:px-12 py-8 min-h-screen">
        <div className="flex justify-start">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio de sesión
          </Link>
        </div>
        <main className="flex-1 flex flex-col justify-center max-w-[400px] mx-auto w-full py-8">{body}</main>
      </div>
    </div>
  );
};

export default UpdatePassword;
