import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import {
  Compass,
  Image as ImageIcon,
  Video,
  Music,
  Flame,
  Heart,
  MessageCircle,
  Play,
  Pause,
  Search,
  Sparkles,
  Users,
  Clapperboard,
  Bot,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  X,
  UserPlus,
  Check,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";
import { SEED_POSTS, DEMO_REELS, type DemoReel } from "@/lib/seedData";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/explore")({ component: ExplorePage });

type FilterType = "all" | "reels" | "photos" | "videos" | "music" | "trending";
type VideoCategory = "For You" | "Funny" | "Trending" | "Comedy" | "Entertainment" | "Music" | "Sports" | "Gaming" | "Pets" | "Popular";

const VIDEO_CATEGORIES: VideoCategory[] = [
  "For You", "Funny", "Trending", "Comedy", "Entertainment", "Music", "Sports", "Gaming", "Pets", "Popular"
];

export function ExplorePage() {
  const { user } = useAuthContext();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [creatorsPool, setCreatorsPool] = useState<any[]>([]);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [creatorsError, setCreatorsError] = useState(false);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterType>("all");
  const [videoCategory, setVideoCategory] = useState<VideoCategory>("For You");
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostWithMeta | null>(null);

  // Selected reel index for vertical short-video viewer modal
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [savedReels, setSavedReels] = useState<Set<string>>(new Set());

  // Music preview
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadContent();
  }, [filter, videoCategory]);

  useEffect(() => {
    if (user?.id) loadCreators();
  }, [user?.id]);

  async function loadContent() {
    setLoading(true);
    let query = supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(60);

    if (filter === "photos") {
      query = query.eq("post_type", "image" as never);
    } else if (filter === "videos") {
      query = query.eq("post_type", "video" as never);
    } else if (filter === "music") {
      query = query.eq("post_type", "music" as never);
    }

    const { data } = await query;
    const dbPosts = (data ?? []) as PostWithMeta[];

    if (dbPosts.length > 0) {
      if (filter === "music") {
        setPosts(dbPosts.filter(p => p.post_type === "music" || p.media_url?.includes("audio")));
      } else if (filter === "photos") {
        setPosts(dbPosts.filter(p => p.post_type === "image"));
      } else if (filter === "videos") {
        setPosts(dbPosts.filter(p => p.post_type === "video"));
      } else {
        setPosts(dbPosts);
      }
    } else {
      if (filter === "photos") {
        setPosts(SEED_POSTS.filter(p => p.post_type === "image"));
      } else if (filter === "music") {
        setPosts(SEED_POSTS.filter(p => p.post_type === "music"));
      } else if (filter === "videos") {
        setPosts(SEED_POSTS.filter(p => p.post_type === "video"));
      } else {
        setPosts(SEED_POSTS);
      }
    }

    setLoading(false);
  }

  const loadCreators = useCallback(async () => {
    if (!user?.id) return;
    setCreatorsLoading(true);
    setCreatorsError(false);

    try {
      // 1. Fetch who the current user already follows
      const { data: followData } = await (supabase
        .from("follows") as any)
        .select("following_id")
        .eq("follower_id", user.id);

      const alreadyFollowedIds = new Set<string>(
        (followData ?? []).map((f: any) => f.following_id as string)
      );
      setFollowedIds(alreadyFollowedIds);

      // 2. Fetch eligible creators — exclude self and already-followed users
      const { data: profileData, error } = await (supabase
        .from("profiles") as any)
        .select("id, username, display_name, avatar_url, bio, updated_at")
        .neq("id", user.id)         // NEVER show the current user
        .not("username", "is", null)
        .order("updated_at", { ascending: false })
        .limit(40);

      if (error) throw error;

      const eligible = (profileData ?? []).filter(
        (p: any) =>
          p.username &&
          p.username.trim() !== "" &&
          !alreadyFollowedIds.has(p.id)
      );

      // 3. Shuffle for variety and show first 6
      const shuffled = eligible.sort(() => Math.random() - 0.5);
      setCreatorsPool(shuffled);
      setCreators(shuffled.slice(0, 6));
    } catch (err) {
      console.error("Creator load error:", err);
      setCreatorsError(true);
    } finally {
      setCreatorsLoading(false);
    }
  }, [user?.id]);

  async function handleFollow(creator: any) {
    if (!user?.id || followingInProgress.has(creator.id)) return;

    setFollowingInProgress(prev => new Set(prev).add(creator.id));

    try {
      const alreadyFollowing = followedIds.has(creator.id);

      if (alreadyFollowing) {
        // Unfollow
        await (supabase.from("follows") as any)
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", creator.id);

        setFollowedIds(prev => {
          const next = new Set(prev);
          next.delete(creator.id);
          return next;
        });
        toast.info(`Unfollowed @${creator.username}`);
      } else {
        // Follow — upsert to prevent duplicates
        await (supabase.from("follows") as any)
          .upsert(
            { follower_id: user.id, following_id: creator.id },
            { onConflict: "follower_id,following_id" }
          );

        setFollowedIds(prev => new Set(prev).add(creator.id));
        toast.success(`Now following @${creator.username}! 🎉`);

        // Remove from recommendations and pull in a replacement
        setCreators(prev => {
          const remaining = prev.filter(c => c.id !== creator.id);
          // Find a replacement from the pool not already shown or followed
          const shown = new Set(remaining.map((c: any) => c.id));
          const replacement = creatorsPool.find(
            (c: any) => !shown.has(c.id) && c.id !== creator.id && !followedIds.has(c.id)
          );
          return replacement ? [...remaining, replacement] : remaining;
        });
      }
    } catch (err) {
      console.error("Follow error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setFollowingInProgress(prev => {
        const next = new Set(prev);
        next.delete(creator.id);
        return next;
      });
    }
  }

  function toggleAudioTrack(track: MusicTrack) {
    if (playingTrackId === track.id) {
      audioRef.current?.pause();
      setPlayingTrackId(null);
    } else {
      setPlayingTrackId(track.id);
      if (audioRef.current) {
        audioRef.current.src = track.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    }
  }

  const activeReel = selectedReelIndex !== null ? DEMO_REELS[selectedReelIndex] : null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <audio ref={audioRef} onEnded={() => setPlayingTrackId(null)} className="hidden" />

      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Compass className="w-8 h-8 text-primary" />
            <span>Explore Discovery</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover trending visual stories, short videos, AI art, music beats, and creators.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
              filter === "all" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            🌟 For You
          </button>
          <button
            onClick={() => setFilter("reels")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              filter === "reels" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" /> Videos
          </button>
          <button
            onClick={() => setFilter("photos")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              filter === "photos" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Photos
          </button>
          <button
            onClick={() => setFilter("videos")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              filter === "videos" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            <Video className="w-3.5 h-3.5" /> Rants Video
          </button>
          <button
            onClick={() => setFilter("music")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              filter === "music" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            <Music className="w-3.5 h-3.5" /> Music
          </button>
          <button
            onClick={() => setFilter("trending")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              filter === "trending" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> Trending
          </button>
        </div>
      </div>

      {/* Video Category Sub-Navigation (When filter === "reels" or "all") */}
      {(filter === "reels" || filter === "videos") && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            {VIDEO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setVideoCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  videoCategory === cat
                    ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                    : "glass text-muted-foreground hover:text-foreground"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1. Videos Showcase (If "all" or "reels") */}
      {(filter === "all" || filter === "reels") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" />
              <span>Trending Short Videos ({videoCategory})</span>
            </h2>
            <span className="text-xs text-muted-foreground">Tap any video to open player</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {DEMO_REELS.map((reel, idx) => (
              <div
                key={reel.id}
                onClick={() => setSelectedReelIndex(idx)}
                className="relative rounded-2xl overflow-hidden glass aspect-[9/16] cursor-pointer group shadow-card border border-border/40 hover:border-primary transition"
              >
                <img src={reel.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    {reel.is_ai ? (
                      <span className="flex items-center gap-1 bg-purple-600/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-400/40">
                        <Bot className="w-3 h-3" /> AI Video
                      </span>
                    ) : (
                      <span className="bg-black/60 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        👁️ 42.1K
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur grid place-items-center text-white ml-auto group-hover:scale-110 transition shadow-glow">
                      <Play className="w-4 h-4 ml-0.5 fill-current" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <img src={reel.author.avatar_url} className="w-5 h-5 rounded-full object-cover" alt="" />
                      <span className="text-white text-xs font-semibold truncate">@{reel.author.username}</span>
                    </div>
                    <p className="text-white text-[11px] line-clamp-2 leading-tight">{reel.caption}</p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-white/80">
                      <Music className="w-3 h-3 text-primary animate-pulse" />
                      <span className="truncate">{reel.music_title}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Popular Creators Showcase */}
      {filter === "all" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Creators You May Know</span>
            </h2>
            <button
              onClick={loadCreators}
              disabled={creatorsLoading}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition disabled:opacity-50 cursor-pointer"
              title="Refresh suggestions"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${creatorsLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Loading Skeletons */}
          {creatorsLoading && (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="glass rounded-2xl p-4 flex flex-col items-center gap-2.5 min-w-[140px] max-w-[150px] flex-shrink-0 border border-border/30 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-muted/60" />
                  <div className="h-2.5 w-20 rounded-full bg-muted/60" />
                  <div className="h-2 w-14 rounded-full bg-muted/40" />
                  <div className="h-6 w-full rounded-full bg-muted/40 mt-1" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!creatorsLoading && creatorsError && (
            <div className="glass rounded-2xl p-6 border border-border/30 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Unable to load creator recommendations.</p>
              <button
                onClick={loadCreators}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!creatorsLoading && !creatorsError && creators.length === 0 && (
            <div className="glass rounded-2xl p-6 border border-border/30 text-center space-y-2">
              <Users className="w-6 h-6 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">No new creators to recommend right now.</p>
              <p className="text-xs text-muted-foreground">Check back later to discover more people in the OutLoud community.</p>
              <button
                onClick={loadCreators}
                className="text-xs text-primary font-semibold hover:underline cursor-pointer mt-1"
              >
                Refresh Suggestions
              </button>
            </div>
          )}

          {/* Creator Cards */}
          {!creatorsLoading && !creatorsError && creators.length > 0 && (
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              {creators.map((c) => {
                const isFollowed = followedIds.has(c.id);
                const isPending = followingInProgress.has(c.id);
                return (
                  <div
                    key={c.id}
                    className="glass rounded-2xl p-4 flex flex-col items-center text-center gap-2 min-w-[148px] max-w-[160px] flex-shrink-0 hover:scale-105 hover:border-primary/40 transition-all border border-border/40 group"
                  >
                    {/* Avatar — links to profile */}
                    <Link to="/profile/$username" params={{ username: c.username || "user" }}>
                      <div className="w-14 h-14 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold text-lg overflow-hidden shadow-glow ring-2 ring-transparent group-hover:ring-primary/40 transition">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} className="w-full h-full object-cover" alt={c.username} />
                        ) : (
                          (c.display_name?.[0] || c.username?.[0] || "U").toUpperCase()
                        )}
                      </div>
                    </Link>

                    {/* Display name */}
                    <Link to="/profile/$username" params={{ username: c.username || "user" }} className="leading-tight">
                      <div className="font-semibold text-xs truncate max-w-[130px] group-hover:text-primary transition">
                        {c.display_name || c.username}
                      </div>
                    </Link>

                    {/* @username */}
                    <span className="text-[10px] text-muted-foreground truncate max-w-[130px]">@{c.username}</span>

                    {/* Bio snippet */}
                    {c.bio && (
                      <span className="text-[9px] text-muted-foreground line-clamp-2 max-w-[130px] leading-relaxed">{c.bio}</span>
                    )}

                    {/* Follow / Following Button */}
                    <button
                      onClick={() => handleFollow(c)}
                      disabled={isPending}
                      className={`mt-auto w-full text-[10px] font-bold py-1.5 rounded-full shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 ${
                        isFollowed
                          ? "bg-muted/60 text-muted-foreground hover:bg-destructive/20 hover:text-rose-400 border border-border/50"
                          : "bg-gradient-vivid text-white shadow-glow hover:scale-105"
                      }`}
                      title={isFollowed ? "Unfollow" : `Follow @${c.username}`}
                    >
                      {isPending ? (
                        <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : isFollowed ? (
                        <><Check className="w-3 h-3" /> Following</>
                      ) : (
                        <><UserPlus className="w-3 h-3" /> Follow</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Music Library Section (If "music") */}
      {filter === "music" && (
        <div className="glass rounded-3xl p-6 border border-border/40 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              <span>Explore Soundtrack Catalog</span>
            </h2>
            <span className="text-xs text-muted-foreground">{MUSIC_LIBRARY.length} Tracks Available</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {MUSIC_LIBRARY.map((track) => {
              const isPlaying = playingTrackId === track.id;
              return (
                <div
                  key={track.id}
                  className="p-3 glass rounded-2xl border border-border/40 flex items-center gap-3 hover:border-primary/50 transition group"
                >
                  <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover shadow" alt="" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-xs truncate text-foreground group-hover:text-primary transition">
                      {track.title}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{track.artist}</div>
                    <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md mt-1 inline-block">
                      {track.genre}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAudioTrack(track)}
                    className={`w-9 h-9 rounded-full grid place-items-center transition shadow-glow ${
                      isPlaying ? "bg-gradient-vivid text-white scale-105" : "bg-muted text-foreground hover:bg-primary hover:text-white"
                    }`}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Discovery Media Grid */}
      {filter !== "reels" && filter !== "music" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>Popular Rants & Media</span>
            </h2>
          </div>

          {loading ? (
            <div className="grid place-items-center py-20">
              <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {posts.map((p) => {
                const isVideo = p.post_type === "video" || p.media_url?.includes(".mp4");
                let musicMeta = null;
                if (p.post_type === "music" && p.media_url) {
                  try { musicMeta = JSON.parse(p.media_url); } catch {}
                }

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPost(p)}
                    className="group relative rounded-2xl overflow-hidden glass aspect-square border border-border/40 hover:border-primary transition cursor-pointer shadow-sm hover:shadow-glow"
                  >
                    {musicMeta ? (
                      <div className="w-full h-full relative bg-gradient-to-br from-indigo-950 to-purple-900 flex flex-col items-center justify-center p-3 text-center">
                        <img src={musicMeta.coverUrl} className="w-16 h-16 rounded-xl object-cover shadow-lg mb-2" alt="" />
                        <div className="text-white text-xs font-bold truncate max-w-full">{musicMeta.title}</div>
                        <div className="text-white/70 text-[10px] truncate max-w-full">{musicMeta.artist}</div>
                        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 grid place-items-center text-primary">
                          <Music className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    ) : p.media_url ? (
                      isVideo ? (
                        <div className="w-full h-full relative bg-black">
                          <video src={p.media_url} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 grid place-items-center text-white">
                            <Video className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      ) : (
                        <img src={p.media_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="" />
                      )
                    ) : (
                      <div className="w-full h-full p-4 flex items-center justify-center text-center bg-gradient-to-br from-card to-muted/60 text-xs font-medium text-foreground line-clamp-4">
                        {p.content || "Vibing in the sphere"}
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-3 z-10">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-gradient-vivid grid place-items-center text-white text-[10px] font-bold overflow-hidden">
                          {p.profiles?.avatar_url ? (
                            <img src={p.profiles.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            p.profiles?.username?.[0]?.toUpperCase() || "U"
                          )}
                        </div>
                        <span className="text-white text-xs font-semibold truncate">@{p.profiles?.username}</span>
                      </div>

                      <div className="flex items-center justify-center gap-4 text-white text-xs font-bold">
                        <span className="flex items-center gap-1">
                          <Heart className="w-4 h-4 fill-white" />
                          <span>View Rant</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Selected Post Modal Lightbox */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <PostCard post={selectedPost} onChange={() => { setSelectedPost(null); loadContent(); }} />
          </div>
        </div>
      )}

      {/* Fullscreen Vertical Short Video / Reel Experience Modal */}
      {activeReel && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fade-in"
          onClick={() => setSelectedReelIndex(null)}
        >
          <div
            className="relative w-full max-w-sm h-[88vh] rounded-3xl overflow-hidden shadow-2xl bg-black flex flex-col justify-between p-4 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar: Creator Info & Close */}
            <div className="relative z-20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={activeReel.author.avatar_url} className="w-9 h-9 rounded-full object-cover border border-white/20" alt="" />
                <div>
                  <div className="text-white text-xs font-bold flex items-center gap-1">
                    <span>@{activeReel.author.username}</span>
                    <button
                      onClick={() => {
                        const reelCreator = { id: activeReel.author.username, username: activeReel.author.username };
                        handleFollow(reelCreator);
                      }}
                      className="text-[10px] text-primary hover:underline font-semibold ml-1"
                    >
                      {followedIds.has(activeReel.author.username) ? "Following" : "+ Follow"}
                    </button>
                  </div>
                  {activeReel.is_ai && (
                    <span className="text-[10px] text-purple-300 font-semibold flex items-center gap-1">
                      <Bot className="w-3 h-3 text-purple-400" /> AI Video
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedReelIndex(null)}
                className="w-8 h-8 rounded-full bg-black/50 text-white grid place-items-center hover:bg-black/80 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player element */}
            <video
              src={activeReel.video_url}
              autoPlay
              loop
              controls
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0"
            />

            {/* Vertical Interaction Side Action Bar */}
            <div className="absolute right-3 bottom-24 z-20 flex flex-col items-center gap-4 text-white">
              <button
                onClick={() => {
                  setLikedReels((prev) => {
                    const next = new Set(prev);
                    next.has(activeReel.id) ? next.delete(activeReel.id) : next.add(activeReel.id);
                    return next;
                  });
                }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-10 h-10 rounded-full glass border border-white/20 grid place-items-center transition ${
                  likedReels.has(activeReel.id) ? "bg-rose-500 text-white" : "hover:bg-white/20"
                }`}>
                  <Heart className={`w-5 h-5 ${likedReels.has(activeReel.id) ? "fill-white" : ""}`} />
                </div>
                <span className="text-[10px] font-bold">
                  {likedReels.has(activeReel.id) ? "Liked" : "Like"}
                </span>
              </button>

              <button
                onClick={() => toast.info("Comments section opened")}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-10 h-10 rounded-full glass border border-white/20 grid place-items-center hover:bg-white/20 transition">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold">Comment</span>
              </button>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Video link copied!");
                }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-10 h-10 rounded-full glass border border-white/20 grid place-items-center hover:bg-white/20 transition">
                  <Share2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold">Share</span>
              </button>

              <button
                onClick={() => {
                  setSavedReels((prev) => {
                    const next = new Set(prev);
                    next.has(activeReel.id) ? next.delete(activeReel.id) : next.add(activeReel.id);
                    return next;
                  });
                }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className={`w-10 h-10 rounded-full glass border border-white/20 grid place-items-center transition ${
                  savedReels.has(activeReel.id) ? "bg-amber-400 text-black" : "hover:bg-white/20"
                }`}>
                  <Bookmark className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold">Save</span>
              </button>
            </div>

            {/* Next / Prev Navigation overlay buttons */}
            <div className="absolute left-3 bottom-24 z-20 flex flex-col gap-2">
              <button
                disabled={selectedReelIndex === 0}
                onClick={() => setSelectedReelIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                className="w-8 h-8 rounded-full bg-black/60 text-white grid place-items-center disabled:opacity-30 hover:bg-black transition"
                title="Previous video"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                disabled={selectedReelIndex === DEMO_REELS.length - 1}
                onClick={() => setSelectedReelIndex((i) => (i !== null && i < DEMO_REELS.length - 1 ? i + 1 : i))}
                className="w-8 h-8 rounded-full bg-black/60 text-white grid place-items-center disabled:opacity-30 hover:bg-black transition"
                title="Next video"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Bottom Info Bar */}
            <div className="relative z-20 space-y-2 pr-14">
              <p className="text-white text-xs drop-shadow-md font-medium leading-snug">{activeReel.caption}</p>
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-white text-xs w-fit border border-white/10">
                <Music className="w-3.5 h-3.5 text-primary animate-spin" />
                <span className="truncate">{activeReel.music_title} — {activeReel.music_artist}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
