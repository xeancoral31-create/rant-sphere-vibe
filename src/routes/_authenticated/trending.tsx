import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import {
  TrendingUp,
  Flame,
  Hash,
  Music,
  Play,
  Pause,
  Award,
  Sparkles,
  ArrowUpRight
} from "lucide-react";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";

export const Route = createFileRoute("/_authenticated/trending")({ component: Trending });

const CURATED_TRENDS = [
  { rank: 1, title: "#NoFilterSphere", category: "Community", rants: "48.2k", change: "+140%" },
  { rank: 2, title: "#LofiMidnightVibes", category: "Music", rants: "31.9k", change: "+85%" },
  { rank: 3, title: "#DevLifeRant", category: "Tech & Work", rants: "22.4k", change: "+54%" },
  { rank: 4, title: "#CyberpunkAesthetic", category: "Design & Art", rants: "18.6k", change: "+42%" },
  { rank: 5, title: "#DailyMotivation", category: "Mindset", rants: "14.1k", change: "+30%" },
  { rank: 6, title: "#CoffeeFirst", category: "Lifestyle", rants: "11.8k", change: "+25%" },
];

export function Trending() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [activeTab, setActiveTab] = useState<"topics" | "music" | "rants">("topics");
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setPosts((data ?? []) as PostWithMeta[]));
  }, []);

  function togglePlayTrack(track: MusicTrack) {
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <audio ref={audioRef} onEnded={() => setPlayingTrackId(null)} className="hidden" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500 animate-pulse" />
            <span>Trending in the Sphere</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time viral rants, trending audio beats, and rising topics.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-full border border-border/40 w-fit">
          <button
            onClick={() => setActiveTab("topics")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "topics" ? "bg-gradient-vivid text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🔥 Topics
          </button>
          <button
            onClick={() => setActiveTab("music")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "music" ? "bg-gradient-vivid text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            🎵 Top Music
          </button>
          <button
            onClick={() => setActiveTab("rants")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "rants" ? "bg-gradient-vivid text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            💬 Hot Posts
          </button>
        </div>
      </div>

      {/* 1. Topics Tab */}
      {activeTab === "topics" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CURATED_TRENDS.map((t) => (
            <Link
              key={t.rank}
              to="/tag/$tag"
              params={{ tag: t.title.replace("#", "").toLowerCase() }}
              className="glass rounded-3xl p-5 border border-border/40 hover:border-primary transition group shadow-card flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-2xl grid place-items-center font-display font-bold text-sm ${
                  t.rank === 1 ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-glow" :
                  t.rank === 2 ? "bg-slate-300/20 text-slate-200 border border-slate-300/40" :
                  t.rank === 3 ? "bg-amber-700/20 text-amber-600 border border-amber-700/40" :
                  "bg-muted text-muted-foreground"
                }`}>
                  #{t.rank}
                </div>

                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">{t.category}</div>
                  <div className="font-display font-bold text-base text-foreground group-hover:text-primary transition">
                    {t.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t.rants} rants</div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-right">
                <span className="text-xs font-bold text-emerald-400">{t.change}</span>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 2. Top Music Charts */}
      {activeTab === "music" && (
        <div className="glass rounded-3xl p-6 border border-border/40 shadow-card space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/30">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Award className="w-5 h-5 text-primary" />
              <span>Top Soundtracks on RantSphere</span>
            </h3>
            <span className="text-xs text-muted-foreground">Updated hourly</span>
          </div>

          <div className="divide-y divide-border/30">
            {MUSIC_LIBRARY.map((track, i) => {
              const isPlaying = playingTrackId === track.id;
              return (
                <div
                  key={track.id}
                  className="py-3.5 flex items-center justify-between gap-4 group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="font-display font-bold text-base text-muted-foreground w-5 text-center">
                      {i + 1}
                    </span>
                    <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover shadow flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition">
                        {track.title}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{track.artist} • {track.genre}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground hidden sm:inline">{track.duration}</span>
                    <button
                      type="button"
                      onClick={() => togglePlayTrack(track)}
                      className={`w-9 h-9 rounded-full grid place-items-center transition shadow-glow ${
                        isPlaying ? "bg-gradient-vivid text-white scale-105" : "bg-muted text-foreground hover:bg-primary hover:text-white"
                      }`}
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Hot Posts Feed */}
      {activeTab === "rants" && (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
