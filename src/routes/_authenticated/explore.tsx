import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  Search,
  Sparkles,
  Users
} from "lucide-react";
import { MUSIC_LIBRARY } from "@/lib/music";

export const Route = createFileRoute("/_authenticated/explore")({ component: ExplorePage });

type FilterType = "all" | "photos" | "videos" | "music" | "trending";

export function ExplorePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<PostWithMeta | null>(null);

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
      query = query.eq("post_type", "image");
    } else if (filter === "videos") {
      query = query.eq("post_type", "video");
    } else if (filter === "music") {
      query = query.eq("post_type", "music");
    }

    const { data } = await query;
    setPosts((data ?? []) as PostWithMeta[]);
    setLoading(false);
  }

  async function loadCreators() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, bio")
      .limit(6);
    setCreators(data ?? []);
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Compass className="w-8 h-8 text-primary" />
            <span>Explore the Sphere</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Discover trending visual stories, viral rants, music beats, and creators.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
              filter === "all" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
            }`}
          >
            🌟 All
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

      {/* Featured Creators Carousel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Popular Creators</span>
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
              <button className="mt-1 w-full bg-gradient-vivid text-white text-[10px] font-semibold py-1 rounded-full shadow-sm">
                Follow
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* Discovery Media Grid */}
      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center border border-border/40 shadow-card space-y-3">
          <Sparkles className="w-10 h-10 text-primary mx-auto opacity-70" />
          <h3 className="font-display font-bold text-lg">No content in this category yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Check out other tabs or create a post to share with the community!
          </p>
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
                {/* Media Presentation */}
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
                  /* Text / Note Card in Explore */
                  <div className="w-full h-full p-4 flex items-center justify-center text-center bg-gradient-to-br from-card to-muted/60 text-xs font-medium text-foreground line-clamp-4">
                    {p.content || "Vibing in the sphere"}
                  </div>
                )}

                {/* Hover Overlay with Author & Engagement Stats */}
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
                      <span>View</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Post Modal Lightbox */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
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
    </div>
  );
}
