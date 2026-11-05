import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { peekAuthLinkError } from "@/lib/authRedirect";

export const UPDATE_PASSWORD_PATH = "/auth/update-password";

/**
 * Global guard for e-mail auth links. Supabase sends recovery links back to
 * whatever allowed URL it resolves (often the Site URL "/"), so the app — not a
 * specific route — must notice a pending recovery or a rejected link and show
 * the "new password" screen. Renders nothing.
 */
const RecoveryRedirect = () => {
  const { session, loading, recoveryPending } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === UPDATE_PASSWORD_PATH) return;
    if (peekAuthLinkError() || (!loading && session && recoveryPending)) {
      navigate(UPDATE_PASSWORD_PATH, { replace: true });
    }
  }, [loading, session, recoveryPending, location.pathname, navigate]);

  return null;
};

export default RecoveryRedirect;
