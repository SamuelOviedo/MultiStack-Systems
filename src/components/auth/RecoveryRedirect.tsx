import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { clearConfirmationLinkError, peekAuthLinkError } from "@/lib/authRedirect";

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

  // A rejected sign-up confirmation link is explained on /login (see authRedirect).
  // With a session nobody is sent there, so the marker is dropped instead of
  // surfacing as a stale notice after a later sign-out.
  useEffect(() => {
    if (!loading && session) clearConfirmationLinkError();
  }, [loading, session]);

  return null;
};

export default RecoveryRedirect;
