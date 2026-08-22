import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { StoryRail } from "@/components/story/StoryRail";
import { InlineComposer, ComposeDialog } from "@/components/post/ComposeDialog";
import { VideoPlayerModal } from "@/components/post/VideoPlayerModal";
import { Logo } from "@/components/brand/Logo";
import { SEED_POSTS, DEMO_REELS } from "@/lib/seedData";
import { getFriends } from "@/lib/friends-api";
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
  Users2,
  ChevronRight,
  Hash,
  Play,
  Zap,
  Star,
  ArrowUpRight,
  Circle,
  ArrowUp,
  Video as VideoIcon
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({ component: HomePage });

// ─── Constants & Types ────────────────────────────────────────────────────────

const TRENDING_TAGS = [
  { tag: "technews", posts: "12.4k", trend: "+18%" },
  { tag: "vibes", posts: "8.9k", trend: "+7%" },
  { tag: "rantlife", posts: "24.1k", trend: "+31%" },
  { tag: "chillbeats", posts: "5.2k", trend: "+4%" },
  { tag: "aigenerated", posts: "18.3k", trend: "+22%" },
  { tag: "tokyovibes", posts: "3.6k", trend: "+11%" },
];

export type FeedFilter = "foryou" | "following" | "trending" | "friends";

const FEED_FILTERS: { key: FeedFilter; label: string; icon: React.ElementType }[] = [
  { key: "foryou", label: "For You", icon: Sparkles },
  { key: "following", label: "Following", icon: Users },
  { key: "trending", label: "Trending", icon: TrendingUp },
  { key: "friends", label: "Friends", icon: Users2 },
];

export interface VideoClipItem {
  id: string;
  title: string;
  creator: {
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  video_url: string;
  thumbnail_url: string;
  duration: string;
  views: string;
  likesCount: number;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

/** Mobile Header */
function MobileHomeHeader({
  unreadNotifs,
  unreadMessages,
}: {
  unreadNotifs: number;
  unreadMessages: number;
}) {
  return (
    <header
      className="md:hidden sticky top-0 z-30 -mx-3 sm:-mx-4 px-4 py-3 glass border-b border-border/40 flex items-center justify-between backdrop-blur-xl"
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

/** Desktop Header */
function DesktopHomeHeader({
  unreadNotifs,
  unreadMessages,
}: {
  unreadNotifs: number;
  unreadMessages: number;
}) {
  return (
    <header className="hidden md:flex sticky top-0 z-20 px-4 py-3.5 glass border-b border-border/40 -mx-4 items-center justify-between backdrop-blur-xl">
      <h1 className="font-display text-2xl font-bold tracking-tight">Home</h1>
      <div className="flex items-center gap-2">
        <Link
          to="/search"
          className="flex items-center gap-2 bg-input/80 hover:bg-input text-xs text-muted-foreground px-4 py-2 rounded-full border border-border/40 transition hover:border-primary/40"
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

/** Animated Filter Tabs */
function FeedFilters({
  active,
  onChange,
}: {
  active: FeedFilter;
  onChange: (f: FeedFilter) => void;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1" role="tablist" aria-label="Feed filters">
      {FEED_FILTERS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={active === key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-primary cursor-pointer ${
            active === key
              ? "bg-gradient-vivid text-white shadow-glow scale-105"
              : "glass border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/40"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Shimmer Skeleton */
function PostSkeleton() {
  return (
    <div className="glass rounded-3xl p-5 border border-border/40 space-y-3 animate-pulse" aria-hidden="true">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-muted/60 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-muted/60 rounded-full w-32" />
          <div className="h-2.5 bg-muted/40 rounded-full w-20" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-muted/60 rounded-full w-full" />
        <div className="h-3 bg-muted/60 rounded-full w-4/5" />
      </div>
      <div className="h-44 bg-muted/40 rounded-2xl w-full" />
      <div className="flex items-center gap-3 pt-2 border-t border-border/30">
        <div className="h-7 bg-muted/50 rounded-full w-16" />
        <div className="h-7 bg-muted/50 rounded-full w-20" />
      </div>
    </div>
  );
}

function FeedSkeletonLoader() {
  return (
    <div className="space-y-4" aria-label="Loading posts">
      <PostSkeleton />
      <PostSkeleton />
      <PostSkeleton />
    </div>
  );
}

/** Error state */
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
        className="inline-flex items-center gap-2 rounded-full bg-gradient-vivid px-6 py-2.5 font-semibold text-sm text-white shadow-glow hover:scale-105 transition cursor-pointer"
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
    <div className="glass rounded-3xl p-10 sm:p-12 text-center border border-border/40 shadow-card space-y-5">
      <div className="w-20 h-20 rounded-full bg-gradient-vivid/20 grid place-items-center mx-auto">
        <Sparkles className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h3 className="font-display font-bold text-xl text-foreground">No posts yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Be the first to share something with the OutLoud community. Post a thought, photo, beat, or video!
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onCompose}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-vivid px-6 py-2.5 font-semibold text-sm text-white shadow-glow hover:scale-105 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create Post
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

/** Funny & Trending Clips Section */
function FunnyVideoFeedSection({ onPlayClip }: { onPlayClip: (clip: VideoClipItem) => void }) {
  const [clips, setClips] = useState<VideoClipItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadClips();
  }, []);

  async function loadClips() {
    setLoading(true);
    try {
      // 1. Fetch real video posts from DB
      const { data } = await supabase
        .from("posts")
        .select("id, content, media_url, post_type, created_at, profiles(username, display_name, avatar_url)")
        .or("post_type.eq.video,media_url.ilike.%.mp4%,media_url.ilike.%.webm%")
        .eq("is_hidden", false)
        .order("created_at", { ascending: false })
        .limit(6);

      const dbClips: VideoClipItem[] = (data || []).map((p: any) => ({
        id: p.id,
        title: p.content || "Video post on OutLoud ✨",
        creator: {
          username: p.profiles?.username || "user",
          display_name: p.profiles?.display_name || undefined,
          avatar_url: p.profiles?.avatar_url || undefined,
        },
        video_url: p.media_url,
        thumbnail_url: p.profiles?.avatar_url || "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=600&h=400&fit=crop",
        duration: "0:30",
        views: "1.2K",
        likesCount: 142,
      }));

      if (dbClips.length >= 3) {
        setClips(dbClips.slice(0, 3));
      } else {
        // Fallback to verified working clips from DEMO_REELS
        const fallbackClips: VideoClipItem[] = [
          ...dbClips,
          ...DEMO_REELS.map((r, idx) => ({
            id: `seed-reel-${r.id}`,
            title: r.caption,
            creator: {
              username: r.author.username,
              display_name: r.author.display_name,
              avatar_url: r.author.avatar_url,
            },
            video_url: r.video_url,
            thumbnail_url: r.thumbnail_url,
            duration: idx === 0 ? "0:24" : idx === 1 ? "0:45" : "0:18",
            views: idx === 0 ? "142.8K" : idx === 1 ? "98.3K" : "215.1K",
            likesCount: r.likes,
          })),
        ];
        setClips(fallbackClips.slice(0, 3));
      }
    } catch {
      setClips(
        DEMO_REELS.map((r, idx) => ({
          id: `fallback-${r.id}`,
          title: r.caption,
          creator: {
            username: r.author.username,
            display_name: r.author.display_name,
            avatar_url: r.author.avatar_url,
          },
          video_url: r.video_url,
          thumbnail_url: r.thumbnail_url,
          duration: idx === 0 ? "0:24" : idx === 1 ? "0:45" : "0:18",
          views: idx === 0 ? "142.8K" : idx === 1 ? "98.3K" : "215.1K",
          likesCount: r.likes,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleLike(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setLiked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (clips.length === 0 && !loading) return null;

  return (
    <div className="glass rounded-3xl p-4 sm:p-5 border border-border/40 space-y-3 my-2">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Flame className="w-4 h-4 text-rose-500 fill-rose-500/20" />
          <span>Funny & Trending Clips</span>
        </h2>
        <Link
          to="/explore"
          className="text-xs text-primary font-semibold hover:underline flex items-center gap-0.5"
        >
          See All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {clips.map((vid) => {
          const isLiked = liked.has(vid.id);

          return (
            <div
              key={vid.id}
              onClick={() => onPlayClip(vid)}
              className="relative rounded-2xl overflow-hidden glass border border-white/10 group hover:border-primary/50 transition cursor-pointer"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                <img
                  src={vid.thumbnail_url}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  alt={vid.title}
                  loading="lazy"
                />
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
                  <span className="truncate">@{vid.creator.username}</span>
                  <button
                    onClick={(e) => toggleLike(vid.id, e)}
                    className={`hover:scale-110 transition ${
                      isLiked ? "text-rose-500 font-bold" : "hover:text-rose-400"
                    }`}
                  >
                    ❤️ {vid.likesCount + (isLiked ? 1 : 0)}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Right Sidebar Trending Panel */
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

/** Right Sidebar Who to Follow */
function SuggestedFriendsWidget({ users, currentUserId }: { users: any[]; currentUserId?: string }) {
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  function handleFollow(id: string) {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    toast.success("Followed creator!");
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
                className={`shrink-0 text-xs px-3.5 py-1.5 rounded-full font-semibold transition-all duration-200 cursor-pointer ${
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

/** Right Sidebar Friends Widget */
function FriendsCommunityWidget({ userId }: { userId?: string }) {
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    getFriends(userId)
      .then((data) => {
        setFriendsList(data.slice(0, 4));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  return (
    <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-base flex items-center gap-2">
          <Users2 className="w-4 h-4 text-violet-400" />
          Friends & Barkada
        </h2>
        <Link to="/friends" className="text-xs text-primary hover:underline font-semibold flex items-center gap-0.5">
          All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-muted/60 skeleton shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-muted/60 rounded-full w-28" />
                <div className="h-2.5 bg-muted/40 rounded-full w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : friendsList.length === 0 ? (
        <div className="text-center py-4 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/15 grid place-items-center mx-auto">
            <Users2 className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Connect with friends</p>
            <p className="text-xs text-muted-foreground mt-0.5">Discover friends or create a group</p>
          </div>
          <Link
            to="/friends"
            className="inline-flex items-center gap-1.5 text-xs bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 px-4 py-2 rounded-full font-semibold transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Find Friends
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {friendsList.map((f) => {
            const userObj = f.friend || f;
            return (
              <Link
                key={f.id || userObj.id}
                to="/profile/$username"
                params={{ username: userObj.username || "user" }}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-muted/40 transition group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden shrink-0">
                  {userObj.avatar_url ? (
                    <img src={userObj.avatar_url} className="w-full h-full object-cover" alt={userObj.username} loading="lazy" />
                  ) : (
                    userObj.username?.[0]?.toUpperCase() || "F"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold group-hover:text-primary transition truncate">{userObj.display_name || userObj.username}</div>
                  <div className="text-[11px] text-muted-foreground">@{userObj.username}</div>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Active Online Friends */
function ActiveFriendsWidget({ currentUserId }: { currentUserId?: string }) {
  const [friends, setFriends] = useState<any[]>([]);

  useEffect(() => {
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
            <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background shadow-sm online-dot" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page Component ─────────────────────────────────────────────────────

export function HomePage() {
  const { user, profile } = useAuthContext();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [initialComposeMode, setInitialComposeMode] = useState<"post" | "photo" | "video" | "note" | "music">("post");
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);
  const [activeFilter, setActiveFilter] = useState<FeedFilter>("foryou");
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // New Posts Notification Buffer (30s Polling / Realtime)
  const [pendingNewPosts, setPendingNewPosts] = useState<PostWithMeta[]>([]);
  const activeFilterRef = useRef<FeedFilter>("foryou");
  const postsRef = useRef<PostWithMeta[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Video Modal State
  const [activeVideoClip, setActiveVideoClip] = useState<VideoClipItem | null>(null);

  // Keep refs in sync for interval / realtime closures
  useEffect(() => {
    activeFilterRef.current = activeFilter;
  }, [activeFilter]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  // ── Data Fetcher ──
  const fetchFeedPosts = useCallback(
    async (filter: FeedFilter): Promise<PostWithMeta[]> => {
      try {
        let query = supabase
          .from("posts")
          .select("*, profiles(username, display_name, avatar_url)")
          .eq("is_hidden", false);

        if (filter === "trending") {
          query = query.order("created_at", { ascending: false }).limit(40);
        } else if (filter === "friends" && user?.id) {
          try {
            const friends = await getFriends(user.id);
            const friendIds = friends.map((f: any) => f.friend?.id || f.id).filter(Boolean);
            if (friendIds.length > 0) {
              query = query.in("author_id", [...friendIds, user.id]).order("created_at", { ascending: false }).limit(40);
            } else {
              query = query.order("created_at", { ascending: false }).limit(40);
            }
          } catch {
            query = query.order("created_at", { ascending: false }).limit(40);
          }
        } else if (filter === "following" && user?.id) {
          query = query.order("created_at", { ascending: false }).limit(40);
        } else {
          // "For You" - Latest posts ordered by creation timestamp
          query = query.order("created_at", { ascending: false }).limit(50);
        }

        const { data, error: fetchError } = await query;
        if (fetchError) throw fetchError;

        const dbPosts = (data ?? []) as PostWithMeta[];
        if (dbPosts.length > 0) {
          return dbPosts;
        }
        return SEED_POSTS;
      } catch (err) {
        console.error("[feed] Error fetching posts:", err);
        return [];
      }
    },
    [user?.id]
  );

  // ── Initial & Filter Load ──
  const load = useCallback(
    async (filter: FeedFilter = activeFilter) => {
      setLoading(true);
      setError(false);
      setPendingNewPosts([]);
      try {
        const fetched = await fetchFeedPosts(filter);
        setPosts(fetched);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, fetchFeedPosts]
  );

  // ── 30-Second Background Auto Refresh ──
  const checkBackgroundUpdates = useCallback(async () => {
    // Skip polling if document is hidden or user is offline
    if (document.hidden || !navigator.onLine) return;

    try {
      const currentPosts = postsRef.current;
      const existingIds = new Set(currentPosts.map((p) => p.id));
      const latestFetched = await fetchFeedPosts(activeFilterRef.current);

      if (latestFetched.length === 0) return;

      // Find posts not currently present in feed
      const newItems = latestFetched.filter((p) => !existingIds.has(p.id));

      if (newItems.length > 0) {
        // If user is scrolled near top (< 120px), prepend automatically without interrupting
        if (window.scrollY < 120) {
          setPosts((prev) => {
            const prevIds = new Set(prev.map((x) => x.id));
            const distinctNew = newItems.filter((x) => !prevIds.has(x.id));
            return [...distinctNew, ...prev];
          });
          setPendingNewPosts([]);
        } else {
          // User is scrolled down reading: buffer and show notification pill
          setPendingNewPosts((prev) => {
            const combined = [...newItems, ...prev];
            const seen = new Set<string>();
            return combined.filter((item) => {
              if (seen.has(item.id)) return false;
              seen.add(item.id);
              return true;
            });
          });
        }
      }
    } catch (err) {
      console.warn("[auto-refresh] background check failed:", err);
    }
  }, [fetchFeedPosts]);

  // Setup 30-second interval + Tab visibility handling
  useEffect(() => {
    const interval = setInterval(checkBackgroundUpdates, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Trigger a check when user switches back to this tab
        checkBackgroundUpdates();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkBackgroundUpdates]);

  // ── Load Suggested & Unread Counts ──
  const loadSuggested = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .limit(5);

      if (data && data.length > 0) {
        setSuggestedUsers(data);
      }
    } catch {}
  }, []);

  const loadUnreadCounts = useCallback(async () => {
    if (!user?.id) return;
    try {
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
    } catch {}
  }, [user?.id]);

  // Load feed on activeFilter change
  useEffect(() => {
    load(activeFilter);
  }, [activeFilter]);

  // Setup Realtime subscriptions
  useEffect(() => {
    loadSuggested();
    loadUnreadCounts();

    // 1. Posts Realtime Channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const feedChannel = supabase
      .channel(`posts-feed-realtime-${user?.id ?? "anon"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "posts" },
        () => checkBackgroundUpdates()
      )
      .subscribe();
    channelRef.current = feedChannel;

    // 2. Notification Count Realtime Channel
    if (notifChannelRef.current) {
      supabase.removeChannel(notifChannelRef.current);
      notifChannelRef.current = null;
    }

    if (user?.id) {
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
        .subscribe();
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
  }, [user?.id, checkBackgroundUpdates, loadSuggested, loadUnreadCounts]);

  function handleFilterChange(f: FeedFilter) {
    setActiveFilter(f);
  }

  // Handle "Show New Posts" notification pill click
  function handleShowPendingNewPosts() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setPosts((prev) => {
      const prevIds = new Set(prev.map((x) => x.id));
      const distinct = pendingNewPosts.filter((x) => !prevIds.has(x.id));
      return [...distinct, ...prev];
    });
    setPendingNewPosts([]);
  }

  // Handle post created by current user
  function handlePostCreated() {
    load(activeFilter);
    toast.success("Post published to the sphere!");
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Mobile Sticky Header */}
      <MobileHomeHeader unreadNotifs={unreadNotifs} unreadMessages={unreadMessages} />

      <div className="flex gap-0 xl:gap-6 px-3 sm:px-4 md:px-4 xl:px-6">

        {/* ── Main Feed Column ── */}
        <section
          className="flex-1 min-w-0 max-w-2xl xl:max-w-none py-4 md:py-5 space-y-4"
          aria-label="Main feed"
        >
          {/* Desktop Title Header */}
          <DesktopHomeHeader unreadNotifs={unreadNotifs} unreadMessages={unreadMessages} />

          {/* 1. Stories Rail */}
          <StoryRail />

          {/* 2. Post Composer */}
          <InlineComposer onPostCreated={handlePostCreated} />

          {/* 3. Dynamic Feed Category Filters */}
          <FeedFilters active={activeFilter} onChange={handleFilterChange} />

          {/* 4. Funny & Trending Video Carousel */}
          <FunnyVideoFeedSection onPlayClip={(clip) => setActiveVideoClip(clip)} />

          {/* 5. "New Posts Available" Floating Notification Pill */}
          {pendingNewPosts.length > 0 && (
            <div className="sticky top-16 z-30 flex justify-center animate-bounce pt-1">
              <button
                onClick={handleShowPendingNewPosts}
                className="py-2.5 px-6 rounded-full bg-gradient-vivid text-white text-xs sm:text-sm font-bold shadow-glow flex items-center gap-2 hover:scale-105 transition cursor-pointer border border-white/20"
              >
                <ArrowUp className="w-4 h-4 animate-pulse" />
                <span>
                  ↑ {pendingNewPosts.length} new {pendingNewPosts.length === 1 ? "post" : "posts"} available — Show
                </span>
              </button>
            </div>
          )}

          {/* 6. Feed Posts Stream */}
          <div role="feed" aria-label="Posts feed" aria-busy={loading}>
            {loading ? (
              <FeedSkeletonLoader />
            ) : error ? (
              <FeedError onRetry={() => load(activeFilter)} />
            ) : posts.length === 0 ? (
              <EmptyFeedState onCompose={() => { setInitialComposeMode("post"); setComposeModalOpen(true); }} />
            ) : (
              <div className="space-y-4">
                {posts.map((p, i) => (
                  <div
                    key={p.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${Math.min(i * 30, 200)}ms` }}
                  >
                    <PostCard post={p} onChange={() => load(activeFilter)} />
                  </div>
                ))}

                {/* All Caught Up Indicator */}
                <div className="text-center py-8 text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Star className="w-3.5 h-3.5 text-primary/50" />
                  <span>You're all caught up! Feed auto-refreshes every 30s.</span>
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
          <div className="h-[52px]" aria-hidden="true" />

          <HomeTrendingPanel />
          <SuggestedFriendsWidget users={suggestedUsers} currentUserId={user?.id} />
          <FriendsCommunityWidget userId={user?.id} />
          <ActiveFriendsWidget currentUserId={user?.id} />

          {/* Footer Info */}
          <div className="text-[11px] text-muted-foreground/50 space-y-1 pb-4 px-1">
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              <Link to="/settings" className="hover:text-muted-foreground transition">Settings</Link>
              <span>·</span>
              <Link to="/explore" className="hover:text-muted-foreground transition">Explore</Link>
              <span>·</span>
              <Link to="/trending" className="hover:text-muted-foreground transition">Trending</Link>
              <span>·</span>
              <Link to="/friends" className="hover:text-muted-foreground transition">Friends</Link>
            </div>
            <p>© 2026 OutLoud. Speak freely.</p>
          </div>
        </aside>
      </div>

      {/* Mobile Floating Compose Button */}
      <button
        onClick={() => { setInitialComposeMode("post"); setComposeModalOpen(true); }}
        className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-gradient-vivid shadow-glow grid place-items-center text-white hover:scale-110 active:scale-95 transition-transform cursor-pointer"
        aria-label="Create a new post"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Main Compose Modal */}
      <ComposeDialog
        open={composeModalOpen}
        onOpenChange={setComposeModalOpen}
        initialMode={initialComposeMode}
        onPostCreated={handlePostCreated}
      />

      {/* Interactive Video Clip Player Modal */}
      {activeVideoClip && (
        <VideoPlayerModal
          open={!!activeVideoClip}
          onClose={() => setActiveVideoClip(null)}
          videoUrl={activeVideoClip.video_url}
          title={activeVideoClip.title}
          creator={activeVideoClip.creator}
          likesCount={activeVideoClip.likesCount}
          viewsCount={activeVideoClip.views}
        />
      )}
    </div>
  );
}
