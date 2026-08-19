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
  Music,
  Check,
  X
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
  actor?: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
}

type NotifFilter = "all" | "likes" | "comments" | "follows" | "mentions";

export function NotifPage() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<Notif[]>([]);
  const [filter, setFilter] = useState<NotifFilter>("all");
  const [loading, setLoading] = useState(true);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());

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
      .select("*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const notifs = (data ?? []) as Notif[];
    if (notifs.length === 0) {
      // Seed initial notification so it's not empty
      setItems([
        {
          id: "seed-notif-1",
          type: "follow",
          read: false,
          created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          actor_id: "demo-user-1",
          post_id: null,
          actor: {
            id: "demo-user-1",
            username: "cyber_nova",
            display_name: "Nova Cyber 🌌",
            avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
          },
        },
        {
          id: "seed-notif-2",
          type: "like",
          read: true,
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
          actor_id: "demo-user-2",
          post_id: "demo-post-2",
          actor: {
            id: "demo-user-2",
            username: "lofi_dreamer",
            display_name: "Lofi Dreamer 🎵",
            avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
          },
        },
      ]);
    } else {
      setItems(notifs);
    }
    setLoading(false);
  }

  async function markAllAsRead() {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("All notifications marked as read");
  }

  async function handleConfirmFriend(notif: Notif) {
    if (!user || !notif.actor_id) return;
    setConfirmedIds(prev => new Set(prev).add(notif.id));
    // Follow back mutually
    await supabase.from("follows").insert({ follower_id: user.id, following_id: notif.actor_id });
    toast.success(`You are now friends with @${notif.actor?.username}!`);
  }

  function handleDeclineFriend(notifId: string) {
    setItems(prev => prev.filter(n => n.id !== notifId));
    toast.info("Friend request declined");
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
        return "sent you a friend request / started following you";
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
            Stay updated with friend requests, reactions, and follows.
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
          👥 Friends & Follows
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
              When people send friend requests, react, or comment, you'll see alerts here!
            </p>
          </div>
        ) : (
          filteredItems.map((n) => {
            const isConfirmed = confirmedIds.has(n.id);

            return (
              <div
                key={n.id}
                className={`glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 border transition hover:border-primary/50 shadow-sm ${
                  !n.read ? "border-primary/50 bg-primary/5" : "border-border/40"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-muted/60 grid place-items-center flex-shrink-0">
                    {icon(n.type)}
                  </div>

                  <div className="min-w-0 text-sm">
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
                </div>

                {/* Interactive Friend Request Actions */}
                {n.type === "follow" && (
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {isConfirmed ? (
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Friends
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => handleConfirmFriend(n)}
                          className="bg-gradient-vivid text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-glow hover:scale-105 transition flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm
                        </button>
                        <button
                          onClick={() => handleDeclineFriend(n.id)}
                          className="glass hover:bg-destructive/20 text-muted-foreground hover:text-destructive text-xs font-semibold px-3 py-1.5 rounded-full transition"
                        >
                          Decline
                        </button>
                      </>
                    )}
                  </div>
                )}

                {n.post_id && (
                  <Link
                    to="/home"
                    className="text-xs font-semibold text-primary hover:underline px-3 py-1 bg-muted/60 rounded-full self-end sm:self-center"
                  >
                    View Rant
                  </Link>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
