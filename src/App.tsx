import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AdsTagRouteSync from "@/components/common/AdsTagRouteSync";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/common/ProtectedRoute";
import BrandLoader from "@/components/common/BrandLoader";
import RecoveryRedirect from "@/components/auth/RecoveryRedirect";

// Pages cargadas al inicio (rutas públicas críticas — no se lazy-load)
import Index from "./pages/marketing/Index.tsx";
import { preloadPanelForPath } from "./components/admin/preloadPanel.ts";
import PanelLoader from "./components/admin/PanelLoader.tsx";

// Lazy-load: cada página genera su propio chunk
// Armazón del panel del administrador: chunk propio, fuera de la entrada.
const AdminShell            = lazy(() => import("./components/admin/AdminShell.tsx"));
const Login                 = lazy(() => import("./pages/auth/Login.tsx"));
const Signup                = lazy(() => import("./pages/auth/Signup.tsx"));
const Dashboard             = lazy(() => import("./pages/dashboard/Dashboard.tsx"));
const ProjectsList          = lazy(() => import("./pages/dashboard/ProjectsList.tsx"));
const ProjectDetail         = lazy(() => import("./pages/dashboard/ProjectDetail.tsx"));
const TicketsGlobal         = lazy(() => import("./pages/dashboard/TicketsGlobal.tsx"));
const MisSolicitudes        = lazy(() => import("./pages/client/MisSolicitudes.tsx"));
const ClientPortal          = lazy(() => import("./pages/client/ClientPortal.tsx"));
const AuthCallback          = lazy(() => import("./pages/auth/AuthCallback.tsx"));
const ResetPassword         = lazy(() => import("./pages/auth/ResetPassword.tsx"));
const UpdatePassword        = lazy(() => import("./pages/auth/UpdatePassword.tsx"));
const PoliticaDePrivacidad  = lazy(() => import("./pages/legal/PoliticaDePrivacidad.tsx"));
const TerminosDelServicio   = lazy(() => import("./pages/legal/TerminosDelServicio.tsx"));
const NotFound              = lazy(() => import("./pages/marketing/NotFound.tsx"));
const PaginasWeb = lazy(() => import("./pages/marketing/PaginasWeb.tsx"));

// Visita directa a /dashboard o /dashboard/proyectos: pide el armazón y la página a la vez (ver preloadPanel.ts).
preloadPanelForPath(window.location.pathname);

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <BrandLoader className="h-7" />
  </div>
);

// Resumen y lista de proyectos: indicador ligero (solo texto) en vez del logotipo mientras llegan el armazón y la página.
const SHELL_PATHS = new Set(["/dashboard", "/dashboard/proyectos"]);
const RouteFallback = () => {
  const { pathname } = useLocation();
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return SHELL_PATHS.has(path) ? <PanelLoader /> : <PageLoader />;
};

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RecoveryRedirect />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/paginas-web" element={<PaginasWeb />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <AdminShell>
                      <Dashboard />
                    </AdminShell>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/proyectos"
                element={
                  <ProtectedRoute>
                    <AdminShell>
                      <ProjectsList />
                    </AdminShell>
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
              <Route path="/auth/update-password" element={<UpdatePassword />} />
              <Route path="/politica-de-privacidad" element={<PoliticaDePrivacidad />} />
              <Route path="/terminos-del-servicio" element={<TerminosDelServicio />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
        <AdsTagRouteSync />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
