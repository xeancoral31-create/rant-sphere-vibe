import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getGroupActivity, getGroupDetails } from "@/lib/barkada-api";
import {
  ChevronLeft, Users, UserPlus, UserMinus, MapPin, Navigation,
  Image, Film, BarChart2, Settings, Pin, Loader2, RefreshCw,
  Activity, Sparkles,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/groups/$groupId/activity")({
  component: GroupActivityPage,
});

// ─── Activity event types ────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  member_joined:   { icon: UserPlus,  color: "text-emerald-400 bg-emerald-400/10", label: "joined the group" },
  member_left:     { icon: UserMinus, color: "text-rose-400 bg-rose-400/10",       label: "left the group" },
  member_removed:  { icon: UserMinus, color: "text-orange-400 bg-orange-400/10",   label: "was removed" },
  member_promoted: { icon: Users,     color: "text-violet-400 bg-violet-400/10",   label: "was promoted to admin" },
  member_demoted:  { icon: Users,     color: "text-slate-400 bg-slate-400/10",     label: "was demoted to member" },
  group_created:   { icon: Sparkles,  color: "text-primary bg-primary/10",         label: "created this group" },
  group_updated:   { icon: Settings,  color: "text-blue-400 bg-blue-400/10",       label: "updated group info" },
  message_pinned:  { icon: Pin,       color: "text-yellow-400 bg-yellow-400/10",   label: "pinned a message" },
  location_shared: { icon: MapPin,    color: "text-cyan-400 bg-cyan-400/10",       label: "shared their location" },
  location_stopped:{ icon: Navigation,color: "text-slate-400 bg-slate-400/10",     label: "stopped sharing location" },
  photo_shared:    { icon: Image,     color: "text-pink-400 bg-pink-400/10",       label: "shared photos" },
  video_shared:    { icon: Film,      color: "text-indigo-400 bg-indigo-400/10",   label: "shared a video" },
  poll_created:    { icon: BarChart2, color: "text-amber-400 bg-amber-400/10",     label: "created a poll" },
  reel_shared:     { icon: Film,      color: "text-fuchsia-400 bg-fuchsia-400/10", label: "shared a reel" },
};

// ─── Page ────────────────────────────────────────────────────────────────────

function GroupActivityPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuthContext();
  const [group, setGroup] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!user || !groupId) return;
    loadGroup();
    loadActivity();

    // Realtime subscription
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`group-activity-${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_activity", filter: `conversation_id=eq.${groupId}` },
        async (payload) => {
          // Fetch full activity with actor join
          const { data } = await supabase
            .from("group_activity")
            .select("*, actor:actor_id(id, username, display_name, avatar_url), target:target_user_id(id, username, display_name, avatar_url)")
            .eq("id", (payload.new as any).id)
            .single();
          if (data) {
            setItems((prev) => [...prev, data]);
          }
        }
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [groupId, user?.id]);

  async function loadGroup() {
    try {
      const g = await getGroupDetails(groupId);
      setGroup(g);
    } catch { /* non-fatal */ }
  }

  async function loadActivity() {
    setLoading(true);
    setError(null);
    try {
      const data = await getGroupActivity(groupId, 60);
      setItems(data);
    } catch (e: any) {
      setError(e.message ?? "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 glass border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Link
          to="/groups/$groupId/chat"
          params={{ groupId }}
          className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold truncate">Group Activity</h1>
          {group && (
            <p className="text-xs text-muted-foreground truncate">{group.name}</p>
          )}
        </div>
        <button
          onClick={loadActivity}
          className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition text-muted-foreground hover:text-primary"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── Group info banner ── */}
      {group && (
        <div className="px-4 py-4 flex items-center gap-4 glass border-b border-border/30">
          <div className="w-14 h-14 rounded-2xl bg-gradient-vivid grid place-items-center text-white font-bold text-lg overflow-hidden flex-shrink-0">
            {group.avatar_url
              ? <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
              : group.name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div className="font-display font-bold text-lg">{group.name}</div>
            {group.description && (
              <div className="text-sm text-muted-foreground">{group.description}</div>
            )}
            <div className="text-xs text-muted-foreground mt-0.5">
              {(group.conversation_participants ?? []).length} members · Activity feed
            </div>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-20 space-y-3">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
            <div className="font-semibold">Failed to load activity</div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              onClick={loadActivity}
              className="px-4 py-2 rounded-full bg-primary text-white text-sm hover:opacity-90 transition"
            >
              Retry
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <Activity className="w-12 h-12 mx-auto text-muted-foreground opacity-40" />
            <div className="font-semibold">No activity yet</div>
            <p className="text-sm text-muted-foreground">
              Activity like joining, sharing locations, and creating polls will appear here.
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border/50" />

            <div className="space-y-1">
              {/* Group by date */}
              {groupByDate(items).map(({ date, events }) => (
                <div key={date}>
                  {/* Date divider */}
                  <div className="flex items-center gap-3 py-3">
                    <div className="w-10 h-10 rounded-full bg-card border border-border/50 grid place-items-center flex-shrink-0 relative z-10">
                      <span className="text-[9px] font-bold text-muted-foreground text-center leading-tight">
                        {formatDateLabel(date)}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-border/30" />
                  </div>

                  {/* Events for this date */}
                  {events.map((item, idx) => (
                    <ActivityItem
                      key={item.id ?? idx}
                      item={item}
                      currentUserId={user?.id ?? ""}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Nav links ── */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden glass border-t border-border/40 flex">
        {[
          { to: "/groups/$groupId/chat" as const, label: "Chat", icon: "💬" },
          { to: "/groups/$groupId/map" as const, label: "Map", icon: "🗺️" },
          { to: "/groups/$groupId/media" as const, label: "Media", icon: "🖼️" },
          { to: "/groups/$groupId/activity" as const, label: "Activity", icon: "📋" },
          { to: "/groups/$groupId/settings" as const, label: "Settings", icon: "⚙️" },
        ].map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            params={{ groupId }}
            className="flex-1 flex flex-col items-center py-2 gap-0.5 text-muted-foreground hover:text-primary transition text-[10px]"
            activeProps={{ className: "text-primary" }}
          >
            <span className="text-lg">{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── ActivityItem ─────────────────────────────────────────────────────────────

function ActivityItem({ item, currentUserId }: { item: any; currentUserId: string }) {
  const meta = ACTIVITY_ICONS[item.activity_type] ?? {
    icon: Activity,
    color: "text-muted-foreground bg-card",
    label: item.activity_type?.replace(/_/g, " "),
  };
  const Icon = meta.icon;
  const actor = item.actor;
  const target = item.target;
  const isMe = actor?.id === currentUserId;

  return (
    <div className="flex gap-4 items-start py-3 group">
      {/* Icon bubble on timeline */}
      <div
        className={`w-10 h-10 rounded-full grid place-items-center flex-shrink-0 relative z-10 border border-border/50 transition group-hover:scale-110 ${meta.color}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Content card */}
      <div className="flex-1 min-w-0 glass rounded-2xl px-4 py-3 border border-white/5 hover:border-primary/20 transition">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Actor avatar + name */}
          {actor && (
            <Link
              to="/profile/$username"
              params={{ username: actor.username || "user" }}
              className="flex items-center gap-1.5 hover:opacity-80 transition"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-vivid grid place-items-center text-white text-[8px] font-bold overflow-hidden flex-shrink-0">
                {actor.avatar_url
                  ? <img src={actor.avatar_url} className="w-full h-full object-cover" alt="" />
                  : actor.username?.[0]?.toUpperCase()}
              </div>
              <span className="font-semibold text-sm">
                {isMe ? "You" : (actor.display_name || actor.username)}
              </span>
            </Link>
          )}

          <span className="text-sm text-muted-foreground">{meta.label}</span>

          {/* Target user (for promotions, removals, etc.) */}
          {target && (
            <Link
              to="/profile/$username"
              params={{ username: target.username || "user" }}
              className="font-semibold text-sm text-primary hover:opacity-80 transition"
            >
              {target.display_name || target.username}
            </Link>
          )}
        </div>

        {/* Timestamp */}
        <div className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          <span className="ml-2 opacity-50">
            {format(new Date(item.created_at), "MMM d · h:mm a")}
          </span>
        </div>

        {/* Extra metadata */}
        {item.metadata && Object.keys(item.metadata).length > 0 && (
          <div className="mt-2">
            {/* Location shared */}
            {item.activity_type === "location_shared" && item.metadata.latitude && (
              <div className="flex items-center gap-1.5 text-xs text-cyan-400">
                <MapPin className="w-3 h-3" />
                <span>
                  {Number(item.metadata.latitude).toFixed(5)}, {Number(item.metadata.longitude).toFixed(5)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupByDate(items: any[]): { date: string; events: any[] }[] {
  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const d = new Date(item.created_at).toDateString();
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  }
  return Object.entries(groups).map(([date, events]) => ({ date, events }));
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return format(d, "MMM d");
}
