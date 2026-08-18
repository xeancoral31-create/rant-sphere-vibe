import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { StoryRail } from "@/components/story/StoryRail";
import { InlineComposer, ComposeDialog } from "@/components/post/ComposeDialog";
import {
  Bell,
  MessageCircle,
  Search,
  TrendingUp,
  Sparkles,
  UserPlus,
  Flame,
  Music,
  Plus
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export const Route = createFileRoute("/_authenticated/home")({ component: HomePage });

const TRENDING_TAGS = [
  { tag: "technews", posts: "12.4k" },
  { tag: "vibes", posts: "8.9k" },
  { tag: "rantlife", posts: "24.1k" },
  { tag: "chillbeats", posts: "5.2k" },
];

export function HomePage() {
  const { user, profile } = useAuthContext();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeModalOpen, setComposeModalOpen] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<any[]>([]);

  useEffect(() => {
    load();
    loadSuggested();

    const ch = supabase
      .channel("posts-feed-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function load() {
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .limit(50);
    setPosts((data ?? []) as PostWithMeta[]);
    setLoading(false);
  }

  async function loadSuggested() {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .limit(4);
    setSuggestedUsers(data ?? []);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-4 md:py-6">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 -mx-4 px-4 py-3 glass border-b border-border/40 mb-6 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link to="/home" className="flex items-center gap-2 md:hidden">
            <Logo className="w-7 h-7 text-primary" plain />
            <span className="font-display font-bold text-lg">RantSphere</span>
          </Link>
          <h1 className="hidden md:block font-display text-2xl font-bold">Home Feed</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/search"
            className="flex items-center gap-2 bg-input/80 hover:bg-input text-xs text-muted-foreground px-3.5 py-2 rounded-full border border-border/40 transition"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Search rants, people, music...</span>
          </Link>
          <Link
            to="/notifications"
            className="w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-foreground hover:text-primary transition"
          >
            <Bell className="w-4 h-4" />
          </Link>
          <Link
            to="/messages"
            className="w-9 h-9 rounded-full glass border border-border/40 grid place-items-center text-foreground hover:text-primary transition"
          >
            <MessageCircle className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Main 2-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Center Main Feed Column (2 cols on large screen) */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Stories / My Day Rail */}
          <StoryRail />

          {/* 2. Professional Inline Create Rant Composer */}
          <InlineComposer onPostCreated={load} />

          {/* 3. Feed Posts Section */}
          <div className="space-y-4">
            {loading ? (
              <div className="grid place-items-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-xs text-muted-foreground">Loading the sphere...</span>
                </div>
              </div>
            ) : posts.length === 0 ? (
              /* Clean In-Feed Empty State (Never covers modals) */
              <div className="glass rounded-3xl p-12 text-center border border-border/40 shadow-card space-y-4">
                <div className="w-16 h-16 rounded-full bg-gradient-vivid/20 grid place-items-center mx-auto text-primary">
                  <Sparkles className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-xl text-foreground">No rants yet in your feed</h3>
                  <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                    Be the first voice to shout into the sphere. Share a thought, photo, video, note, or music track!
                  </p>
                </div>
                <button
                  onClick={() => setComposeModalOpen(true)}
                  className="rounded-full bg-gradient-vivid px-6 py-2.5 font-semibold text-sm text-white shadow-glow hover:scale-105 transition inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Create First Rant
                </button>
              </div>
            ) : (
              posts.map((p) => (
                <PostCard key={p.id} post={p} onChange={load} />
              ))
            )}
          </div>
        </div>

        {/* Right Sidebar Widgets Column (Explore & Trending Shortcuts) */}
        <div className="hidden lg:block space-y-5">
          {/* Trending Topics Widget */}
          <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>Trending Rants</span>
              </h3>
              <Link to="/trending" className="text-xs text-primary hover:underline font-semibold">
                See all
              </Link>
            </div>
            <div className="space-y-3">
              {TRENDING_TAGS.map((t, idx) => (
                <Link
                  key={t.tag}
                  to="/tag/$tag"
                  params={{ tag: t.tag }}
                  className="flex items-center justify-between group p-1.5 rounded-xl hover:bg-muted/40 transition"
                >
                  <div>
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition">
                      #{t.tag}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{t.posts} rants</div>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground/60">#{idx + 1}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Suggested Users to Follow */}
          <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <span>Who to follow</span>
              </h3>
              <Link to="/explore" className="text-xs text-primary hover:underline font-semibold">
                Explore
              </Link>
            </div>
            <div className="space-y-3">
              {suggestedUsers.filter(u => u.id !== user?.id).slice(0, 3).map((su) => (
                <div key={su.id} className="flex items-center justify-between">
                  <Link
                    to="/profile/$username"
                    params={{ username: su.username || "user" }}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden shadow-glow">
                      {su.avatar_url ? (
                        <img src={su.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        su.username?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold group-hover:text-primary transition truncate">
                        {su.display_name || su.username}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">@{su.username}</div>
                    </div>
                  </Link>
                  <Link
                    to="/profile/$username"
                    params={{ username: su.username || "user" }}
                    className="text-xs bg-muted hover:bg-primary hover:text-white px-3 py-1 rounded-full font-semibold transition"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Standalone Compose Modal Triggered by Button */}
      <ComposeDialog
        open={composeModalOpen}
        onOpenChange={setComposeModalOpen}
        onPostCreated={load}
      />
    </div>
  );
}
