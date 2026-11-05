import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Mail } from "lucide-react";
import BrandLoader from "@/components/common/BrandLoader";
import { roleHome } from "@/lib/roleRoutes";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Roles que pueden ver la ruta (0 administrador, 1 colaborador, 2 cliente). Obligatorio y sin valor por
   * defecto: una ruta nueva no hereda acceso por omisión, quien la declara decide quién entra.
   */
  allowedTypes: readonly number[];
}

const FullScreenLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <BrandLoader />
  </div>
);

const ProtectedRoute = ({ children, allowedTypes }: ProtectedRouteProps) => {
  const { session, userType, loading, signOut } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!session.user.email_confirmed_at) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-warning/30 rounded-lg bg-warning/5 p-8 space-y-5 text-center">
          <div className="flex justify-center">
            <div className="p-3 rounded-full border border-warning/30 bg-warning/10">
              <Mail className="h-6 w-6 text-warning" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs text-warning uppercase tracking-wider">
              [ EMAIL_NOT_CONFIRMED ]
            </p>
            <p className="font-sans text-sm text-foreground">
              Confirmá tu cuenta antes de continuar.
            </p>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              Te enviamos un enlace de confirmación a{" "}
              <span className="text-warning font-mono">{session.user.email}</span>.
              Revisá tu bandeja de entrada y carpeta de spam.
            </p>
          </div>
          <button
            onClick={() => signOut()}
            className="font-mono text-xs text-muted-foreground hover:text-foreground border border-border rounded-sm px-4 py-2 transition-colors"
          >
            [ VOLVER AL LOGIN ]
          </button>
        </div>
      </div>
    );
  }

  // Con sesión pero rol aún desconocido (hasta 8 s tras un SIGNED_IN en la misma pestaña): no se monta nada de la
  // ruta. Los hijos lanzan consultas al montarse y no deben correr antes de saber quién es.
  if (userType === null) return <FullScreenLoader />;

  if (!allowedTypes.includes(userType)) {
    return <Navigate to={roleHome(userType)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
