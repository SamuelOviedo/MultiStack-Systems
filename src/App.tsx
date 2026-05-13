import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Terminal } from "lucide-react";

// Pages cargadas al inicio (rutas públicas críticas — no se lazy-load)
import Index from "./pages/Index.tsx";

// Lazy-load: cada página genera su propio chunk
const Login          = lazy(() => import("./pages/Login.tsx"));
const Signup         = lazy(() => import("./pages/Signup.tsx"));
const Dashboard      = lazy(() => import("./pages/Dashboard.tsx"));
const ProjectDetail  = lazy(() => import("./pages/ProjectDetail.tsx"));
const TicketsGlobal  = lazy(() => import("./pages/TicketsGlobal.tsx"));
const MisSolicitudes = lazy(() => import("./pages/MisSolicitudes.tsx"));
const ClientPortal   = lazy(() => import("./pages/ClientPortal.tsx"));
const AuthCallback   = lazy(() => import("./pages/AuthCallback.tsx"));
const ResetPassword  = lazy(() => import("./pages/ResetPassword.tsx"));
const NotFound       = lazy(() => import("./pages/NotFound.tsx"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Terminal className="h-7 w-7 text-primary animate-pulse" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/project/:id"
                element={
                  <ProtectedRoute>
                    <ProjectDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/tickets"
                element={
                  <ProtectedRoute>
                    <TicketsGlobal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solicitudes"
                element={
                  <ProtectedRoute allowedTypes={[2]}>
                    <MisSolicitudes />
                  </ProtectedRoute>
                }
              />
              <Route path="/client/:token" element={<ClientPortal />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
