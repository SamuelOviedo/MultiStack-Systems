import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import BrandLoader from "@/components/common/BrandLoader";

// Pages cargadas al inicio (rutas públicas críticas — no se lazy-load)
import Index from "./pages/marketing/Index.tsx";

// Lazy-load: cada página genera su propio chunk
const Login                 = lazy(() => import("./pages/auth/Login.tsx"));
const Signup                = lazy(() => import("./pages/auth/Signup.tsx"));
const Dashboard             = lazy(() => import("./pages/dashboard/Dashboard.tsx"));
const ProjectDetail         = lazy(() => import("./pages/dashboard/ProjectDetail.tsx"));
const TicketsGlobal         = lazy(() => import("./pages/dashboard/TicketsGlobal.tsx"));
const MisSolicitudes        = lazy(() => import("./pages/client/MisSolicitudes.tsx"));
const ClientPortal          = lazy(() => import("./pages/client/ClientPortal.tsx"));
const AuthCallback          = lazy(() => import("./pages/auth/AuthCallback.tsx"));
const ResetPassword         = lazy(() => import("./pages/auth/ResetPassword.tsx"));
const PoliticaDePrivacidad  = lazy(() => import("./pages/legal/PoliticaDePrivacidad.tsx"));
const TerminosDelServicio   = lazy(() => import("./pages/legal/TerminosDelServicio.tsx"));
const NotFound              = lazy(() => import("./pages/marketing/NotFound.tsx"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <BrandLoader className="h-7" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
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
              <Route path="/politica-de-privacidad" element={<PoliticaDePrivacidad />} />
              <Route path="/terminos-del-servicio" element={<TerminosDelServicio />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
