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

const defaultSettings: UserSettings = {
  user_id: user?.id || "",
  profile_visibility: "public",
  post_default_audience: "public",
  show_followers: true,
  allow_messages_from: "everyone",
  allow_tagging: true,
  searchable: true,
  notify_likes: true,
  notify_comments: true,
  notify_follows: true,
  notify_messages: true,
  notify_email: true,
  language: "en",
  region: "PH",
  theme: "dark",
  reduce_motion: false,
  larger_text: false,
  high_contrast: false,
  autoplay_video: true,
};

  const load = useCallback(async () => {
    if (!user) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setSettings(data as unknown as UserSettings);
      } else {
        const { data: created, error } = await supabase
          .from("user_settings")
          .insert({ user_id: user.id } as never)
          .select("*")
          .maybeSingle();
        if (error) {
          console.warn("Failed to insert settings, using fallback", error);
          setSettings(defaultSettings);
        } else {
          setSettings((created ?? defaultSettings) as unknown as UserSettings);
        }
      }
    } catch (err) {
      console.warn("Database error loading settings, using fallback", err);
      setSettings(defaultSettings);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(patch: Partial<UserSettings>) {
    if (!user || !settings) return;
    setSettings({ ...settings, ...patch });
    try {
      const { error } = await supabase
        .from("user_settings")
        .update(patch as never)
        .eq("user_id", user.id);
      if (error) console.warn("Failed to save settings remotely:", error);
    } catch (err) {
      console.warn("Error saving settings:", err);
    }
  }

  return { settings, loading, update, reload: load };
}
