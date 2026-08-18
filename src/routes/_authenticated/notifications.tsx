import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { formatDistanceToNow } from "date-fns";
import { Heart, UserPlus, MessageCircle, AtSign } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotifPage });

interface Notif {
  id: string; type: string; read: boolean; created_at: string; actor_id: string | null; post_id: string | null;
  actor?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function NotifPage() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase.channel("notifs").on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from("notifications").select("*, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setItems((data ?? []) as Notif[]);
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  }

  const icon = (t: string) => t === "like" ? <Heart className="w-5 h-5 text-primary" /> : t === "follow" ? <UserPlus className="w-5 h-5 text-accent" /> : t === "comment" ? <MessageCircle className="w-5 h-5 text-violet" /> : <AtSign className="w-5 h-5" />;
  const label = (t: string) => t === "like" ? "liked your rant" : t === "follow" ? "followed you" : t === "comment" ? "commented" : t;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <h1 className="font-display text-3xl font-bold mb-6">Notifications</h1>
      <div className="space-y-2">
        {items.length === 0 && <div className="glass rounded-3xl p-12 text-center text-muted-foreground">All quiet. For now.</div>}
        {items.map((n) => (
          <div key={n.id} className={`glass rounded-2xl p-4 flex items-center gap-3 ${!n.read ? "border-primary/40" : ""}`}>
            {icon(n.type)}
            <div className="flex-1 text-sm">
              <Link to="/profile/$username" params={{ username: n.actor?.username ?? "" }} className="font-semibold hover:underline">
                @{n.actor?.username ?? "someone"}
              </Link>{" "}{label(n.type)}
              <div className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
