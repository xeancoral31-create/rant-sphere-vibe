import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  X
} from "lucide-react";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";
import { SEED_POSTS, DEMO_REELS, type DemoReel } from "@/lib/seedData";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/explore")({ component: ExplorePage });

type FilterType = "all" | "reels" | "photos" | "videos" | "music" | "trending";

export function ExplorePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostWithMeta | null>(null);
  const [selectedReel, setSelectedReel] = useState<DemoReel | null>(null);

  // Music preview
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    loadContent();
    loadCreators();
  }, [filter]);

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

    // If DB has posts, use them; if few or none, blend with SEED_POSTS
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
      // Use filtered seed posts
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

  async function loadCreators() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .limit(8);

    if (data && data.length > 0) {
      setCreators(data);
    } else {
      // Seed creators fallback
      setCreators([
        { id: "c1", username: "cyber_nova", display_name: "Nova Cyber 🌌", avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop" },
        { id: "c2", username: "lofi_dreamer", display_name: "Lofi Dreamer 🎵", avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop" },
        { id: "c3", username: "kenji_tokyo", display_name: "Kenji Sato 🗼", avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop" },
        { id: "c4", username: "bionic_architect", display_name: "Aura AI Lab 🔮", avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop" },
      ]);
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
            Discover trending visual stories, AI art, vertical Reels, music beats, and creators.
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
            <Clapperboard className="w-3.5 h-3.5" /> Reels
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
            <Video className="w-3.5 h-3.5" /> Videos
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

      {/* 1. Reels Showcase (If "all" or "reels") */}
      {(filter === "all" || filter === "reels") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Clapperboard className="w-4 h-4 text-primary" />
              <span>Trending Reels</span>
            </h2>
            <span className="text-xs text-muted-foreground">9:16 Short Videos</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {DEMO_REELS.map((reel) => (
              <div
                key={reel.id}
                onClick={() => setSelectedReel(reel)}
                className="relative rounded-2xl overflow-hidden glass aspect-[9/16] cursor-pointer group shadow-card border border-border/40 hover:border-primary transition"
              >
                <img src={reel.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    {reel.is_ai && (
                      <span className="flex items-center gap-1 bg-purple-600/80 backdrop-blur text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-400/40">
                        <Bot className="w-3 h-3" /> AI Generated
                      </span>
                    )}
                    <div className="w-6 h-6 rounded-full bg-black/40 backdrop-blur grid place-items-center text-white ml-auto">
                      <Play className="w-3 h-3 ml-0.5" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <img src={reel.author.avatar_url} className="w-5 h-5 rounded-full object-cover" />
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
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {creators.map((c) => (
              <Link
                key={c.id}
                to="/profile/$username"
                params={{ username: c.username || "user" }}
                className="glass rounded-2xl p-4 flex flex-col items-center text-center gap-2 min-w-[140px] max-w-[150px] flex-shrink-0 hover:scale-105 transition border border-border/40 group"
              >
                <div className="w-14 h-14 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow-glow">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    c.username?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <div className="font-semibold text-xs truncate max-w-[120px] group-hover:text-primary transition">
                  {c.display_name || c.username}
                </div>
                <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">@{c.username}</span>
                <button
                  onClick={(e) => { e.preventDefault(); toast.success(`Followed @${c.username}`); }}
                  className="mt-1 w-full bg-gradient-vivid text-white text-[10px] font-semibold py-1 rounded-full shadow-sm"
                >
                  Follow
                </button>
              </Link>
            ))}
          </div>
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
                  <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover shadow" />
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
                        <img src={musicMeta.coverUrl} className="w-16 h-16 rounded-xl object-cover shadow-lg mb-2" />
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
                        <img src={p.media_url} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
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
                            <img src={p.profiles.avatar_url} className="w-full h-full object-cover" />
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

      {/* Fullscreen Vertical Reel Player Modal */}
      {selectedReel && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedReel(null)}
        >
          <div
            className="relative w-full max-w-sm h-[85vh] rounded-3xl overflow-hidden shadow-2xl bg-black flex flex-col justify-between p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Reel Bar */}
            <div className="relative z-20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={selectedReel.author.avatar_url} className="w-8 h-8 rounded-full object-cover" />
                <div>
                  <div className="text-white text-xs font-bold">@{selectedReel.author.username}</div>
                  {selectedReel.is_ai && (
                    <span className="text-[10px] text-purple-400 font-semibold flex items-center gap-1">
                      <Bot className="w-3 h-3" /> AI Generated
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedReel(null)}
                className="w-8 h-8 rounded-full bg-black/50 text-white grid place-items-center hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player */}
            <video
              src={selectedReel.video_url}
              autoPlay
              loop
              controls
              playsInline
              className="absolute inset-0 w-full h-full object-cover z-0"
            />

            {/* Bottom Info & Action Bar */}
            <div className="relative z-20 space-y-3">
              <p className="text-white text-xs drop-shadow-md">{selectedReel.caption}</p>
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur px-3 py-1.5 rounded-full text-white text-xs w-fit">
                <Music className="w-3.5 h-3.5 text-primary animate-spin" />
                <span>{selectedReel.music_title} — {selectedReel.music_artist}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
