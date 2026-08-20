import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { StoryRail } from "@/components/story/StoryRail";
import { InlineComposer, ComposeDialog } from "@/components/post/ComposeDialog";
import { Logo } from "@/components/brand/Logo";
import { SEED_POSTS } from "@/lib/seedData";
import {
  Bell,
  MessageCircle,
  Search,
  TrendingUp,
  Sparkles,
  UserPlus,
  Flame,
  Plus,
  RefreshCw,
  WifiOff,
  Users,
  ChevronRight,
  Hash,
  Play,
  Zap,
  Star,
  ArrowUpRight,
  Circle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({ component: HomePage });

// ─── Static Data ────────────────────────────────────────────────────────────

const TRENDING_TAGS = [
  { tag: "technews", posts: "12.4k", trend: "+18%" },
  { tag: "vibes", posts: "8.9k", trend: "+7%" },
  { tag: "rantlife", posts: "24.1k", trend: "+31%" },
  { tag: "chillbeats", posts: "5.2k", trend: "+4%" },
  { tag: "aigenerated", posts: "18.3k", trend: "+22%" },
  { tag: "tokyovibes", posts: "3.6k", trend: "+11%" },
];

type FeedFilter = "foryou" | "following" | "trending" | "barkada";

const FEED_FILTERS: { key: FeedFilter; label: string; icon?: React.ElementType }[] = [
  { key: "foryou", label: "For You", icon: Sparkles },
  { key: "following", label: "Following", icon: Users },
  { key: "trending", label: "Trending", icon: TrendingUp },
  { key: "barkada", label: "Barkada", icon: Zap },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Mobile-only sticky header — hidden at md+ */
function MobileHomeHeader({
  unreadNotifs,
  unreadMessages,
}: {
  unreadNotifs: number;
  unreadMessages: number;
}) {
  return (
    <header
      className="md:hidden sticky top-0 z-30 -mx-4 px-4 py-3 glass border-b border-border/40 flex items-center justify-between backdrop-blur-xl"
      aria-label="Home header"
    >
      <Link to="/home" className="flex items-center gap-2.5">
        <Logo className="w-7 h-7 text-primary" plain />
        <span className="font-display font-bold text-lg text-gradient">OutLoud</span>
      </Link>

      <div className="flex items-center gap-1.5">
        <Link
          to="/search"
          aria-label="Search"
          className="w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-muted-foreground hover:text-primary transition"
        >
          <Search className="w-4 h-4" />
        </Link>
        <Link
          to="/notifications"
          aria-label={`Notifications${unreadNotifs > 0 ? ` — ${unreadNotifs} unread` : ""}`}
          className="relative w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-muted-foreground hover:text-primary transition"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifs > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full grid place-items-center px-0.5 shadow-glow">
              {unreadNotifs > 9 ? "9+" : unreadNotifs}
            </span>
          )}
        </Link>
        <Link
          to="/messages"
          aria-label={`Messages${unreadMessages > 0 ? ` — ${unreadMessages} unread` : ""}`}
          className="relative w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-muted-foreground hover:text-primary transition"
        >
          <MessageCircle className="w-4 h-4" />
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary text-white text-[10px] font-bold rounded-full grid place-items-center px-0.5 shadow-glow">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/** Desktop-only page title bar */
function DesktopHomeHeader({
  unreadNotifs,
  unreadMessages,
}: {
  unreadNotifs: number;
  unreadMessages: number;
}) {
  return (
    <header className="hidden md:flex sticky top-0 z-20 px-0 py-3.5 glass border-b border-border/40 mb-0 items-center justify-between backdrop-blur-xl -mx-4 px-4">
      <h1 className="font-display text-2xl font-bold">Home</h1>
      <div className="flex items-center gap-2">
        <Link
          to="/search"
          className="flex items-center gap-2 bg-input/80 hover:bg-input text-xs text-muted-foreground px-4 py-2 rounded-full border border-border/40 transition"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search rants, people...</span>
        </Link>
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-muted-foreground hover:text-primary transition"
        >
          <Bell className="w-4 h-4" />
          {unreadNotifs > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full grid place-items-center px-0.5">
              {unreadNotifs > 9 ? "9+" : unreadNotifs}
            </span>
          )}
        </Link>
        <Link
          to="/messages"
          aria-label="Messages"
          className="relative w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-muted-foreground hover:text-primary transition"
        >
          <MessageCircle className="w-4 h-4" />
          {unreadMessages > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary text-white text-[10px] font-bold rounded-full grid place-items-center px-0.5">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

/** Animated pill filter tabs */
function FeedFilters({
  active,
  onChange,
}: {
  active: FeedFilter;
  onChange: (f: FeedFilter) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1" role="tablist" aria-label="Feed filters">
      {FEED_FILTERS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary ${
            active === key
              ? "bg-gradient-vivid text-white shadow-glow scale-105"
              : "glass border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

/** Shimmer skeleton for a single post card */
function PostSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 border border-border/40 space-y-3 animate-pulse" aria-hidden="true">
      {/* Author row */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full skeleton shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 skeleton rounded-full w-32" />
          <div className="h-2.5 skeleton rounded-full w-20" />
        </div>
      </div>
      {/* Content lines */}
      <div className="space-y-2">
        <div className="h-3 skeleton rounded-full w-full" />
        <div className="h-3 skeleton rounded-full w-4/5" />
        <div className="h-3 skeleton rounded-full w-3/5" />
      </div>
      {/* Media placeholder */}
      <div className="h-48 skeleton rounded-2xl w-full" />
      {/* Actions row */}
      <div className="flex items-center gap-3 pt-2 border-t border-border/30">
        <div className="h-7 skeleton rounded-full w-16" />
        <div className="h-7 skeleton rounded-full w-20" />
        <div className="h-7 skeleton rounded-full w-12" />
      </div>
    </div>
  );
}

/** 3 skeleton cards for initial feed loading */
function FeedSkeletonLoader() {
  return (
    <div className="space-y-4" aria-label="Loading posts">
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}

/** Network error state with retry */
function FeedError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="glass rounded-3xl p-10 text-center border border-border/40 shadow-card space-y-4">
      <div className="w-16 h-16 rounded-full bg-destructive/15 grid place-items-center mx-auto">
        <WifiOff className="w-8 h-8 text-destructive" />
      </div>
      <div>
        <h3 className="font-display font-bold text-lg text-foreground">Couldn't load your feed</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
          There was a problem connecting. Check your internet and try again.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full bg-gradient-vivid px-6 py-2.5 font-semibold text-sm text-white shadow-glow hover:scale-105 transition"
      >
        <RefreshCw className="w-4 h-4" />
        Retry
      </button>
    </div>
  );
}

/** Empty feed state */
function EmptyFeedState({ onCompose }: { onCompose: () => void }) {
  return (
    <div className="glass rounded-3xl p-12 text-center border border-border/40 shadow-card space-y-5">
      <div className="w-20 h-20 rounded-full bg-gradient-vivid/20 grid place-items-center mx-auto">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h3 className="font-display font-bold text-xl text-foreground">The sphere is quiet… for now</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Be the first voice to echo across the sphere. Share a thought, photo, beat, or rant — the community is waiting.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onCompose}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-vivid px-6 py-2.5 font-semibold text-sm text-white shadow-glow hover:scale-105 transition"
        >
          <Plus className="w-4 h-4" />
          Create First Note
        </button>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 rounded-full glass border border-border/40 px-6 py-2.5 font-semibold text-sm text-foreground hover:border-primary/60 transition"
        >
          <Search className="w-4 h-4" />
          Explore People
        </Link>
      </div>
    </div>
  );
}

/** Enhanced right sidebar — Trending panel */
function HomeTrendingPanel() {
  return (
    <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          Trending Rants
        </h2>
        <Link
          to="/trending"
          className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5"
        >
          All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-1">
        {TRENDING_TAGS.map((t, idx) => (
          <Link
            key={t.tag}
            to="/tag/$tag"
            params={{ tag: t.tag }}
            className="flex items-center justify-between group p-2 rounded-xl hover:bg-muted/40 transition-all duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xs font-bold text-muted-foreground/50 w-4 shrink-0">#{idx + 1}</span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground group-hover:text-primary transition truncate flex items-center gap-1">
                  <Hash className="w-3 h-3 text-primary/60 shrink-0" />
                  {t.tag}
                </div>
                <div className="text-[11px] text-muted-foreground">{t.posts} rants</div>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 shrink-0">
              <ArrowUpRight className="w-3 h-3" />
              {t.trend}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Right sidebar — Suggested people widget */
function SuggestedFriendsWidget({ users, currentUserId }: { users: any[]; currentUserId?: string }) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  function handleFollow(id: string) {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visible = users.filter((u) => u.id !== currentUserId).slice(0, 4);

  if (visible.length === 0) return null;

  return (
    <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          Who to Follow
        </h2>
        <Link to="/explore" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
          More <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-3">
        {visible.map((su) => {
          const isFollowed = followed.has(su.id);
          return (
            <div key={su.id} className="flex items-center gap-2.5">
              <Link
                to="/profile/$username"
                params={{ username: su.username || "user" }}
                className="flex items-center gap-2.5 flex-1 min-w-0 group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden shadow-glow shrink-0">
                  {su.avatar_url ? (
                    <img src={su.avatar_url} className="w-full h-full object-cover" alt={su.username} loading="lazy" />
                  ) : (
                    su.username?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold group-hover:text-primary transition truncate">
                    {su.display_name || su.username}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">@{su.username}</div>
                </div>
              </Link>
              <button
                onClick={() => handleFollow(su.id)}
                aria-label={isFollowed ? `Unfollow ${su.username}` : `Follow ${su.username}`}
                className={`shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 ${
                  isFollowed
                    ? "bg-muted text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                    : "bg-primary/15 text-primary hover:bg-primary hover:text-white"
                }`}
              >
                {isFollowed ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Right sidebar — Barkada / Groups activity */
function BarkadaActivityWidget({ userId }: { userId?: string }) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    supabase
      .from("group_members" as never)
      .select("group_id, groups(id, name, avatar_url, description)")
      .eq("user_id", userId)
      .limit(4)
      .then(({ data }) => {
        const mapped = (data as any[] ?? [])
          .map((m: any) => m.groups)
          .filter(Boolean);
        setGroups(mapped);
        setLoading(false);
      });
  }, [userId]);

  return (
    <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-violet-400" />
          Barkada
        </h2>
        <Link to="/friends" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
          All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl skeleton shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 skeleton rounded-full w-28" />
                <div className="h-2.5 skeleton rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/15 grid place-items-center mx-auto">
            <Users className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">No Barkada yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Create or join a friend group</p>
          </div>
          <Link
            to="/friends"
            className="inline-flex items-center gap-1.5 text-xs bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 px-4 py-2 rounded-full font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Group
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <Link
              key={g.id}
              to="/groups/$groupId/chat"
              params={{ groupId: g.id }}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-muted/40 transition group"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden shrink-0">
                {g.avatar_url ? (
                  <img src={g.avatar_url} className="w-full h-full object-cover" alt={g.name} loading="lazy" />
                ) : (
                  g.name?.[0]?.toUpperCase() || "G"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold group-hover:text-primary transition truncate">{g.name}</div>
                <div className="text-[11px] text-muted-foreground">Tap to open chat</div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Active/online friends strip — right sidebar */
function ActiveFriendsWidget({ currentUserId }: { currentUserId?: string }) {
  const [friends, setFriends] = useState<any[]>([]);

  useEffect(() => {
    // Show recent profiles as "recently active" (real presence would use Realtime)
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .neq("id", currentUserId ?? "")
      .limit(6)
      .then(({ data }) => {
        if (data && data.length > 0) setFriends(data);
      });
  }, [currentUserId]);

  if (friends.length === 0) return null;

  return (
    <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-3">
      <h2 className="font-display font-bold text-base flex items-center gap-2">
        <Circle className="w-3 h-3 fill-emerald-400 text-emerald-400 online-dot" />
        Active Now
      </h2>
      <div className="flex flex-wrap gap-2.5">
        {friends.slice(0, 8).map((f) => (
          <Link
            key={f.id}
            to="/profile/$username"
            params={{ username: f.username || "user" }}
            title={f.display_name || f.username}
            aria-label={f.display_name || f.username}
            className="relative group"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-vivid grid place-items-center text-white text-xs font-bold ring-2 ring-background hover:ring-primary transition-all duration-200">
              {f.avatar_url ? (
                <img src={f.avatar_url} className="w-full h-full object-cover" alt={f.username} loading="lazy" />
              ) : (
                f.username?.[0]?.toUpperCase() || "U"
              )}
            </div>
            {/* Online indicator */}
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background shadow-sm online-dot" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Funny & Trending Videos Widget for Home feed */
function FunnyVideoFeedSection() {
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const FUNNY_VIDEOS = [
    {
      id: "fv-1",
      title: "Cat vs Laser Pointer Ultra Instinct 😼⚡",
      creator: "paws_and_claws",
      thumbnail: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=600&h=400&fit=crop",
      duration: "0:24",
      views: "142.8K",
      likesCount: 12400,
    },
    {
      id: "fv-2",
      title: "When the code works on the first try 😂💻",
      creator: "dev_humor",
      thumbnail: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&h=400&fit=crop",
      duration: "0:45",
      views: "98.3K",
      likesCount: 8900,
    },
    {
      id: "fv-3",
      title: "Dog trying boba for the first time 🧋🐶",
      creator: "bark_vibes",
      thumbnail: "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?w=600&h=400&fit=crop",
      duration: "0:18",
      views: "215.1K",
      likesCount: 23100,
    },
  ];

  function toggleLike(id: string) {
    setLiked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSave(id: string) {
    setSaved((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="glass rounded-3xl p-4 sm:p-5 border border-border/40 space-y-3 my-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-500 fill-rose-500/20" />
          <span>Funny & Trending Clips</span>
        </h2>
        <Link to="/explore" className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5">
          See All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {FUNNY_VIDEOS.map((vid) => {
          const isLiked = liked.has(vid.id);
          const isSaved = saved.has(vid.id);

          return (
            <div key={vid.id} className="relative rounded-2xl overflow-hidden glass border border-white/10 group hover:border-primary/50 transition">
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <img src={vid.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt={vid.title} />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition grid place-items-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white shadow-glow group-hover:scale-110 transition">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  {vid.duration}
                </span>
                <span className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  👁️ {vid.views}
                </span>
              </div>

              <div className="p-3 space-y-1.5">
                <div className="text-xs font-semibold text-foreground line-clamp-1">{vid.title}</div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30">
                  <span className="truncate">@{vid.creator}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleLike(vid.id)} className={`hover:scale-110 transition ${isLiked ? "text-rose-500 font-bold" : "hover:text-rose-400"}`}>
                      ❤️ {vid.likesCount + (isLiked ? 1 : 0)}
                    </button>
                    <button onClick={() => toggleSave(vid.id)} className={`hover:scale-110 transition ${isSaved ? "text-amber-400 font-bold" : "hover:text-amber-400"}`}>
                      ⭐
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function HomePage() {
  const { user, profile } = useAuthContext();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("foryou");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const activeFilterRef = useRef<FeedFilter>("foryou");

  // 20-minute content rotation calculation
  useEffect(() => {
    const currentWindow = Math.floor(Date.now() / (20 * 60 * 1000));
    const lastSeenWindowStr = localStorage.getItem("outloud_last_feed_window");
    const lastSeenWindow = lastSeenWindowStr ? parseInt(lastSeenWindowStr, 10) : currentWindow;

    if (currentWindow > lastSeenWindow) {
      setHasNewPosts(true);
    }
    localStorage.setItem("outloud_last_feed_window", currentWindow.toString());

    // Schedule check every 60 seconds
    const interval = setInterval(() => {
      const w = Math.floor(Date.now() / (20 * 60 * 1000));
      const last = parseInt(localStorage.getItem("outloud_last_feed_window") || w.toString(), 10);
      if (w > last) {
        setHasNewPosts(true);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // ── Data loading ──

  const load = useCallback(
    async (filter: FeedFilter = activeFilter) => {
      setLoading(true);
      setError(false);
      try {
        let query = supabase
          .from("posts")
          .select("*, profiles(username, display_name, avatar_url)")
          .eq("is_hidden", false);

        if (filter === "trending") {
          // Order by created_at desc — a real trending score could be added later
          query = query.order("created_at", { ascending: false }).limit(30);
        } else if (filter === "barkada" && user?.id) {
          // Posts from users in the same groups — graceful fallback to all posts
          query = query.order("created_at", { ascending: false }).limit(30);
        } else if (filter === "following" && user?.id) {
          // Posts from friends/follows — graceful fallback to all posts for now
          query = query.order("created_at", { ascending: false }).limit(50);
        } else {
          // "For You" — full feed
          query = query.order("created_at", { ascending: false }).limit(50);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        const userPosts = (data ?? []) as PostWithMeta[];
        if (userPosts.length > 0) {
          // Only use DB posts when available — do NOT mix in seed data to prevent
          // stale/duplicate posts appearing on refresh
          setPosts(userPosts);
        } else {
          setPosts(SEED_POSTS);
        }
      } catch {
        setError(true);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, user?.id]
  );

  const loadSuggested = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .limit(5);

    if (data && data.length > 0) {
      setSuggestedUsers(data);
    } else {
      setSuggestedUsers([
        {
          id: "s1",
          username: "cyber_nova",
          display_name: "Nova Cyber 🌌",
          avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop",
        },
        {
          id: "s2",
          username: "lofi_dreamer",
          display_name: "Lofi Dreamer 🎵",
          avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop",
        },
        {
          id: "s3",
          username: "kenji_tokyo",
          display_name: "Kenji Sato 🗼",
          avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
        },
        {
          id: "s4",
          username: "aesthetic_ai",
          display_name: "Aesthetic AI ✨",
          avatar_url: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop",
        },
      ]);
    }
  }, []);

  const loadUnreadCounts = useCallback(async () => {
    if (!user?.id) return;
    const [notifs, msgs] = await Promise.all([
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
      supabase
        .from("messages" as never)
        .select("id", { count: "exact", head: true })
        .eq("receiver_id" as never, user.id)
        .eq("read" as never, false),
    ]);
    setUnreadNotifs(notifs.count ?? 0);
    setUnreadMessages(msgs.count ?? 0);
  }, [user?.id]);

  // ── Effects ──

  // Keep the activeFilter ref in sync so the feed channel callback is never stale
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    load(activeFilter);
  }, [activeFilter]);

  useEffect(() => {
    loadSuggested();
    loadUnreadCounts();

    // ── Realtime: posts feed ──────────────────────────────────────────────────
    // Always tear down any existing feed channel before creating a fresh one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const feedChannel = supabase
      .channel(`posts-feed-realtime-${user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        // Use the ref so we always read the current filter without a stale closure
        () => load(activeFilterRef.current)
      )
      .subscribe();
    channelRef.current = feedChannel;

    // ── Realtime: notification count ─────────────────────────────────────────
    // Tear down any existing notif channel before creating a fresh one
    if (notifChannelRef.current) {
      supabase.removeChannel(notifChannelRef.current);
      notifChannelRef.current = null;
    }

    if (user?.id) {
      // Build the entire chain — all .on() BEFORE .subscribe()
      const notifChannel = supabase
        .channel(`home-notif-count-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => loadUnreadCounts()
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            // Realtime failure is non-fatal — page stays usable
            console.warn("[home] notification realtime channel error, will rely on polling");
          }
        });
      notifChannelRef.current = notifChannel;
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (notifChannelRef.current) {
        supabase.removeChannel(notifChannelRef.current);
        notifChannelRef.current = null;
      }
    };
  }, [user?.id]);

  function handleFilterChange(f: FeedFilter) {
    setActiveFilter(f);
  }

  // ── Render ──

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Mobile header */}
      <MobileHomeHeader unreadNotifs={unreadNotifs} unreadMessages={unreadMessages} />

      <div className="flex gap-0 xl:gap-6 px-3 sm:px-4 md:px-4 xl:px-6">

        {/* ── Center Feed Column ── */}
        <section
          className="flex-1 min-w-0 max-w-2xl xl:max-w-none py-4 md:py-5 space-y-4"
          aria-label="Main feed"
        >
          {/* Desktop header inside feed column */}
          <DesktopHomeHeader unreadNotifs={unreadNotifs} unreadMessages={unreadMessages} />

          {/* 1. Stories Rail */}
          <StoryRail />

          {/* 2. Post Composer */}
          <InlineComposer onPostCreated={() => load(activeFilter)} />

          {/* 3. Feed Filters */}
          <FeedFilters active={activeFilter} onChange={handleFilterChange} />

          {/* 3.5 Funny & Trending Video Carousel */}
          <FunnyVideoFeedSection />

          {/* 3.6 New Posts Available Banner (20-min content rotation) */}
          {hasNewPosts && (
            <button
              onClick={() => { setHasNewPosts(false); load(activeFilter); }}
              className="w-full py-2.5 px-4 rounded-full bg-gradient-vivid text-white text-xs font-bold shadow-glow flex items-center justify-center gap-2 hover:scale-[1.02] transition animate-pulse cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>New posts available from scheduled 20-min rotation! Tap to update feed</span>
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 4. Feed Posts */}
          <div role="feed" aria-label="Posts feed" aria-busy={loading}>
            {loading ? (
              <FeedSkeletonLoader />
            ) : error ? (
              <FeedError onRetry={() => load(activeFilter)} />
            ) : posts.length === 0 ? (
              <EmptyFeedState onCompose={() => setComposeModalOpen(true)} />
            ) : (
              <div className="space-y-4">
                {posts.map((p, i) => (
                  <div
                    key={p.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 30, 300)}ms` }}
                  >
                    <PostCard post={p} onChange={() => load(activeFilter)} />
                  </div>
                ))}
                {/* End of feed indicator */}
                <div className="text-center py-6 text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Star className="w-3.5 h-3.5 text-primary/50" />
                  <span>You're all caught up!</span>
                  <Star className="w-3.5 h-3.5 text-primary/50" />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Right Sidebar ── */}
        <aside
          className="hidden xl:flex flex-col gap-4 w-80 shrink-0 py-5 sticky top-0 h-screen overflow-y-auto scrollbar-none"
          aria-label="Sidebar — trending and suggestions"
        >
          {/* Top spacing to align with content */}
          <div className="h-[52px]" aria-hidden="true" />

          <HomeTrendingPanel />
          <SuggestedFriendsWidget users={suggestedUsers} currentUserId={user?.id} />
          <BarkadaActivityWidget userId={user?.id} />
          <ActiveFriendsWidget currentUserId={user?.id} />

          {/* Footer links */}
          <div className="text-[11px] text-muted-foreground/50 space-y-1 pb-4 px-1">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <Link to="/settings" className="hover:text-muted-foreground transition">Settings</Link>
              <span>·</span>
              <Link to="/explore" className="hover:text-muted-foreground transition">Explore</Link>
              <span>·</span>
              <Link to="/trending" className="hover:text-muted-foreground transition">Trending</Link>
            </div>
            <p>© 2026 OutLoud. Speak freely.</p>
          </div>
        </aside>
      </div>

      {/* Mobile floating compose button — shows only on mobile when scrolled */}
      <button
        onClick={() => setComposeModalOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-gradient-vivid shadow-glow grid place-items-center text-white hover:scale-110 active:scale-95 transition-transform"
        aria-label="Create a new note"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Compose Modal */}
      <ComposeDialog
        open={composeModalOpen}
        onOpenChange={setComposeModalOpen}
        onPostCreated={() => load(activeFilter)}
      />
    </div>
  );
}
