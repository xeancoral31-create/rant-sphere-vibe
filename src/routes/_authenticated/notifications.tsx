import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  Heart,
  UserPlus,
  MessageCircle,
  AtSign,
  CheckCheck,
  Sparkles,
  Repeat2,
  Music
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({ component: NotifPage });

interface Notif {
  id: string;
  type: string;
  read: boolean;
  created_at: string;
  actor_id: string | null;
  post_id: string | null;
  actor?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

type NotifFilter = "all" | "likes" | "comments" | "follows" | "mentions";

export function NotifPage() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    load();

    const ch = supabase
      .channel("notifs-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    setItems((data ?? []) as Notif[]);
    setLoading(false);
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  }

  const filteredItems = items.filter((n) => {
    if (filter === "likes") return n.type === "like";
    if (filter === "comments") return n.type === "comment";
    if (filter === "follows") return n.type === "follow";
    if (filter === "mentions") return n.type === "mention";
    return true;
  });

  const icon = (t: string) => {
    switch (t) {
      case "like":
        return <Heart className="w-5 h-5 text-rose-500 fill-rose-500/20" />;
      case "follow":
        return <UserPlus className="w-5 h-5 text-primary" />;
      case "comment":
        return <MessageCircle className="w-5 h-5 text-sky-400" />;
      case "repost":
        return <Repeat2 className="w-5 h-5 text-emerald-400" />;
      case "music":
        return <Music className="w-5 h-5 text-amber-400" />;
      default:
        return <AtSign className="w-5 h-5 text-purple-400" />;
    }
  };

  const label = (t: string) => {
    switch (t) {
      case "like":
        return "reacted to your rant";
      case "follow":
        return "started following your sphere";
      case "comment":
        return "commented on your rant";
      case "repost":
        return "reposted your thoughts";
      case "music":
        return "shared a song with you";
      default:
        return "mentioned you in a rant";
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" />
            <span>Activity & Alerts</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Stay updated with interactions, reactions, and follows.
          </p>
        </div>

        {items.some(n => !n.read) && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline bg-primary/10 px-3 py-1.5 rounded-full transition"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark all read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter("all")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
            filter === "all" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          All ({items.length})
        </button>
        <button
          onClick={() => setFilter("likes")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
            filter === "likes" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          ❤️ Likes
        </button>
        <button
          onClick={() => setFilter("comments")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
            filter === "comments" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          💬 Comments
        </button>
        <button
          onClick={() => setFilter("follows")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
            filter === "follows" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          👥 Follows
        </button>
        <button
          onClick={() => setFilter("mentions")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${
            filter === "mentions" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          @ Mentions
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {loading ? (
          <div className="grid place-items-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center border border-border/40 shadow-card space-y-3">
            <Sparkles className="w-10 h-10 text-muted-foreground mx-auto" />
            <h3 className="font-display font-bold text-base">All quiet for now</h3>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              When people react, comment, or follow your rants, you'll see alerts here!
            </p>
          </div>
        ) : (
          filteredItems.map((n) => (
            <div
              key={n.id}
              className={`glass rounded-2xl p-4 flex items-center gap-3.5 border transition hover:border-primary/50 shadow-sm ${
                !n.read ? "border-primary/50 bg-primary/5" : "border-border/40"
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-muted/60 grid place-items-center flex-shrink-0">
                {icon(n.type)}
              </div>

              <div className="flex-1 min-w-0 text-sm">
                <div>
                  <Link
                    to="/profile/$username"
                    params={{ username: n.actor?.username ?? "user" }}
                    className="font-bold text-foreground hover:text-primary transition"
                  >
                    @{n.actor?.username || "Someone"}
                  </Link>{" "}
                  <span className="text-muted-foreground">{label(n.type)}</span>
                </div>
                <div className="text-xs text-muted-foreground/80 mt-0.5">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </div>
              </div>

              {n.post_id && (
                <Link
                  to="/home"
                  className="text-xs font-semibold text-primary hover:underline px-3 py-1 bg-muted/60 rounded-full"
                >
                  View Rant
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
