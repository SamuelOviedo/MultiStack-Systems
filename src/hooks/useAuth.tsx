import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearRecoveryPending, isRecoveryPending, markRecoveryPending } from "@/lib/authRedirect";

/**
 * Authentication context for the app.
 *
 * `loading`  – true only while the initial session is being resolved from
 *              storage. It ALWAYS flips to false, even if the network fails.
 * `userType` – the caller's role (0 = admin, 1 = collaborator, 2 = client).
 *              Resolves to a number for every signed-in user; it is never left
 *              `null` while a user is present, so downstream `userType !== null`
 *              gates cannot deadlock.
 */
interface AuthContextType {
  session: Session | null;
  user: User | null;
  userType: number | null;
  loading: boolean;
  /** True while a password-recovery link session awaits a new password. */
  recoveryPending: boolean;
  /** Call once the new password is saved. */
  finishRecovery: () => void;
  signOut: () => Promise<void>;
}

/** Fallback role when the profile lookup fails — least-privileged (client). */
const DEFAULT_USER_TYPE = 2;
/** Hard ceiling so a stalled profile request can never hang the auth gate. */
const PROFILE_FETCH_TIMEOUT_MS = 8000;

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userType: null,
  loading: true,
  recoveryPending: false,
  finishRecovery: () => {},
  signOut: async () => {},
});

/**
 * Resolve a user's role from the `profiles` table.
 *
 * Guaranteed to resolve to a number: any error, missing row, or stalled
 * request falls back to {@link DEFAULT_USER_TYPE} instead of rejecting. This
 * is the safety net that prevents the post-login redirect and role-gated data
 * loads from hanging forever.
 */
const fetchUserType = async (userId: string): Promise<number> => {
  try {
    const query = supabase
      .from("profiles" as any)
      .select("user_type")
      .eq("id", userId)
      .single();

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("profile-fetch-timeout")), PROFILE_FETCH_TIMEOUT_MS)
    );

    const { data } = (await Promise.race([query, timeout])) as { data: { user_type?: number } | null };
    return typeof data?.user_type === "number" ? data.user_type : DEFAULT_USER_TYPE;
  } catch {
    // Network failure, RLS error, or timeout — degrade gracefully.
    return DEFAULT_USER_TYPE;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Seeded from the URL hash captured at startup (lib/authRedirect).
  const [recoveryPending, setRecoveryPending] = useState(() => isRecoveryPending());

  useEffect(() => {
    let active = true;
    // Who the current `userType` belongs to, and a counter that invalidates in-flight profile lookups.
    let currentUserId: string | null = null;
    let latestRequest = 0;

    /**
     * Synchronously mirrors the incoming session. When the user changes (sign-in as someone else without
     * signing out, or sign-out) the previous role is dropped IMMEDIATELY and any profile lookup still in
     * flight is invalidated, so the old account's role is never paired with the new account's session.
     * A refresh/update of the SAME user keeps the role (no flicker).
     */
    const syncIdentity = (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);
      const nextId = nextUser?.id ?? null;
      if (nextId !== currentUserId) {
        currentUserId = nextId;
        latestRequest++;
        setUserType(null);
      }
    };

    /**
     * Single funnel for both the initial session and every later auth event.
     * Always resolves `loading` and (for signed-in users) `userType`, so no
     * consumer gate can stall.
     */
    const applySession = async (nextSession: Session | null) => {
      if (!active) return;
      syncIdentity(nextSession);
      const nextUser = nextSession?.user ?? null;

      if (nextUser) {
        const request = ++latestRequest;
        const type = await fetchUserType(nextUser.id);
        // A newer session event (another account, sign-out) superseded this lookup: its answer is stale.
        if (!active || request !== latestRequest) return;
        setUserType(type);
      }
      if (active) setLoading(false);
    };

    // Initial load: reads the persisted session from localStorage (no network
    // round-trip). `finally` guarantees the loading gate is released even if
    // getSession itself rejects.
    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session))
      .catch(() => {
        if (active) setLoading(false);
      });

    // Listen for login/logout/refresh events after the initial load.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;

      // Fire welcome email on first sign-in; edge function handles idempotency.
      if (event === "SIGNED_IN") {
        supabase.functions.invoke("send-welcome-email").catch(() => {});
      }

      // Second signal for recovery links (the hash capture is the first).
      if (event === "PASSWORD_RECOVERY") {
        markRecoveryPending();
        setRecoveryPending(true);
      }
      if (event === "SIGNED_OUT") {
        clearRecoveryPending();
        setRecoveryPending(false);
      }

      // Invalidate the previous account's role right away (state only, no query): waiting for the deferred
      // lookup below would leave the old role paired with the new session for a while.
      syncIdentity(nextSession);

      // Defer DB work out of the callback: querying inside the onAuthStateChange
      // callback can deadlock the Supabase auth lock.
      setTimeout(() => {
        if (active) applySession(nextSession);
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const finishRecovery = () => {
    clearRecoveryPending();
    setRecoveryPending(false);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    // onAuthStateChange(SIGNED_OUT) clears session/user/userType via applySession.
  };

  return (
    <AuthContext.Provider value={{ session, user, userType, loading, recoveryPending, finishRecovery, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
