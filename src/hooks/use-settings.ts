import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";

export interface UserSettings {
  user_id: string;
  profile_visibility: string;
  post_default_audience: string;
  show_followers: boolean;
  allow_messages_from: string;
  allow_tagging: boolean;
  searchable: boolean;
  notify_likes: boolean;
  notify_comments: boolean;
  notify_follows: boolean;
  notify_messages: boolean;
  notify_email: boolean;
  language: string;
  region: string;
  theme: string;
  reduce_motion: boolean;
  larger_text: boolean;
  high_contrast: boolean;
  autoplay_video: boolean;
}

/** Loads (and creates on first use) the settings row belonging to the signed-in account only. */
export function useSettings() {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setSettings(data as unknown as UserSettings);
    } else {
      const { data: created } = await supabase
        .from("user_settings")
        .insert({ user_id: user.id } as never)
        .select("*")
        .maybeSingle();
      setSettings((created ?? null) as unknown as UserSettings | null);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(patch: Partial<UserSettings>) {
    if (!user || !settings) return;
    setSettings({ ...settings, ...patch });
    const { error } = await supabase
      .from("user_settings")
      .update(patch as never)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  return { settings, loading, update, reload: load };
}
