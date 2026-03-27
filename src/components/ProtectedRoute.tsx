import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Terminal } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedTypes?: number[];
}

const ProtectedRoute = ({ children, allowedTypes = [0, 1] }: ProtectedRouteProps) => {
  const { session, userType, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Terminal className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (userType !== null && !allowedTypes.includes(userType)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
