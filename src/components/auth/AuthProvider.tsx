import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
}

interface AuthCtx {
  user: any | null;
  session: any | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id);
    } else {
      setProfile(null);
    }
  }, [user?.id]);

  async function loadProfile(uid: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) {
      setProfile(data as Profile);
    } else if (user) {
      setProfile({
        id: user.id,
        username: user.username || user.firstName || "user",
        display_name: user.fullName || user.username || null,
        bio: "",
        avatar_url: user.imageUrl,
        cover_url: null,
        is_private: false,
      });
    }
  }

  return (
    <Ctx.Provider value={{
      user: user || null,
      session: null,
      profile,
      loading: !isLoaded,
      refreshProfile: () => { if (user?.id) loadProfile(user.id); }
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuthContext() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuthContext outside provider");
  return v;
}
