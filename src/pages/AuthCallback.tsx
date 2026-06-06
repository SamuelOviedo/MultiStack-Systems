import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Terminal } from "lucide-react";

const AuthCallback = () => {
  const navigate = useNavigate();
  const { user, userType, loading } = useAuth();
  const exchanged = useRef(false);

  // Step 1: exchange the OAuth code for a session (runs once)
  useEffect(() => {
    if (exchanged.current) return;
    exchanged.current = true;

    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      navigate("/login", { replace: true });
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        navigate("/login?error=auth_failed", { replace: true });
      }
      // On success: onAuthStateChange in useAuth picks up the session.
      // Step 2 below waits for userType to resolve before redirecting.
    });
  }, [navigate]);

  // Step 2: once the session and userType are fully loaded, redirect
  useEffect(() => {
    if (loading || !user || userType === null) return;

    // Clean up any stored service intent from landing CTA
    sessionStorage.removeItem("postLoginIntent");

    if (userType === 0 || userType === 1) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/solicitudes", { replace: true });
    }
  }, [user, userType, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Terminal className="h-8 w-8 text-primary animate-pulse" />
    </div>
  );
};

export default AuthCallback;
