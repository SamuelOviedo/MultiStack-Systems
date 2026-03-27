import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userType: number | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  userType: null,
  loading: true,
  signOut: async () => {},
});

const fetchUserType = async (userId: string): Promise<number> => {
  const { data } = await (supabase
    .from("profiles" as any)
    .select("user_type")
    .eq("id", userId)
    .single() as any);
  return typeof data?.user_type === "number" ? data.user_type : 2;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Initial load: reads from localStorage (no network), then fetches profile
    const initialize = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        const type = await fetchUserType(session.user.id);
        if (!isMounted) return;
        setUserType(type);
      }
      setLoading(false);
    };

    initialize();

    // Listen for login/logout events after initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const userId = session.user.id;
          // setTimeout(0) avoids Supabase deadlock when querying inside this callback
          setTimeout(() => {
            fetchUserType(userId).then((type) => {
              if (isMounted) setUserType(type);
            });
          }, 0);
        } else {
          setUserType(null);
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserType(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, userType, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
