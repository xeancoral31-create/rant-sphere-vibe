import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import {
  Search,
  Users,
  MessageSquare,
  Music,
  Hash,
  X,
  History,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";

export const Route = createFileRoute("/_authenticated/search")({ component: SearchPage });

type SearchCategory = "all" | "users" | "rants" | "music" | "tags";

const RECENT_SEARCHES_DEFAULT = ["#lofi", "xeancoral", "#vibes", "chill beats"];

export function SearchPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [matchingMusic, setMatchingMusic] = useState<MusicTrack[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(RECENT_SEARCHES_DEFAULT);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setUsers([]);
      setPosts([]);
      setMatchingMusic([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const term = q.trim();

      const [usersRes, postsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
          .limit(15),
        supabase
          .from("posts")
          .select("*, profiles(username, display_name, avatar_url)")
          .ilike("content", `%${term}%`)
          .limit(15),
      ]);

      setUsers(usersRes.data ?? []);
      setPosts((postsRes.data ?? []) as PostWithMeta[]);

      // Search local music library
      const matchedTracks = MUSIC_LIBRARY.filter(
        (t) =>
          t.title.toLowerCase().includes(term.toLowerCase()) ||
          t.artist.toLowerCase().includes(term.toLowerCase()) ||
          t.genre.toLowerCase().includes(term.toLowerCase())
      );
      setMatchingMusic(matchedTracks);
      setLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  function handleSelectRecent(term: string) {
    setQ(term);
  }

  function handleClearRecent() {
    setRecentSearches([]);
  }

  const hasResults = users.length > 0 || posts.length > 0 || matchingMusic.length > 0;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Search className="w-7 h-7 text-primary" />
          <span>Search RantSphere</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find creators, rants, tags, and music across the entire sphere.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by keywords, @username, or #hashtags..."
          className="w-full rounded-2xl bg-card border border-border/60 pl-12 pr-10 py-3.5 outline-none focus:ring-2 focus:ring-primary text-sm shadow-card"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setCategory("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
            category === "all" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          All Results
        </button>
        <button
          onClick={() => setCategory("users")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
            category === "users" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Users ({users.length})
        </button>
        <button
          onClick={() => setCategory("rants")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
            category === "rants" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Posts ({posts.length})
        </button>
        <button
          onClick={() => setCategory("music")}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
            category === "music" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-muted text-foreground"
          }`}
        >
          <Music className="w-3.5 h-3.5" /> Music ({matchingMusic.length})
        </button>
      </div>

      {/* Recent Searches Pills when empty */}
      {!q && recentSearches.length > 0 && (
        <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4" />
              <span>Recent Searches</span>
            </span>
            <button onClick={handleClearRecent} className="hover:text-destructive transition">
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleSelectRecent(term)}
                className="px-3.5 py-1.5 rounded-full bg-card hover:bg-primary/20 hover:text-primary transition text-xs font-medium border border-border/40"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="grid place-items-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      )}

      {/* Search Results Display */}
      {!loading && q && (
        <div className="space-y-6">
          {/* No results empty state */}
          {!hasResults && (
            <div className="glass rounded-3xl p-12 text-center border border-border/40 space-y-3 shadow-card">
              <Sparkles className="w-10 h-10 text-muted-foreground mx-auto" />
              <h3 className="font-display font-bold text-base">No results found for "{q}"</h3>
              <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                Try searching for different keywords, topics, or usernames.
              </p>
            </div>
          )}

          {/* Users Section */}
          {(category === "all" || category === "users") && users.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Creators</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {users.map((u) => (
                  <Link
                    key={u.id}
                    to="/profile/$username"
                    params={{ username: u.username }}
                    className="flex items-center justify-between p-3.5 glass rounded-2xl hover:border-primary/50 transition border border-border/40 group shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow-glow flex-shrink-0">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          u.username?.[0]?.toUpperCase() || "U"
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm group-hover:text-primary transition truncate">
                          {u.display_name || u.username}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">@{u.username}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Music Results Section */}
          {(category === "all" || category === "music") && matchingMusic.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Music Tracks</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchingMusic.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 glass rounded-2xl border border-border/40 shadow-sm"
                  >
                    <img src={track.coverUrl} className="w-12 h-12 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-foreground truncate">{track.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{track.artist} • {track.genre}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Posts Section */}
          {(category === "all" || category === "rants") && posts.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rants & Posts</div>
              <div className="space-y-4">
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
