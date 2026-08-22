import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import {
  Search,
  Users,
  MessageSquare,
  Music,
  X,
  History,
  Sparkles,
  UserPlus,
  UserCheck,
  Clock,
  Check,
  Loader2,
  ExternalLink,
  MessageCircle,
  Shield,
  HelpCircle,
  ArrowRight,
  TrendingUp,
  UserMinus,
  MoreHorizontal
} from "lucide-react";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";
import {
  searchDatabaseUsers,
  getFriendshipStateMap,
  getMutualFriendsCountMap,
  sendFriendRequest,
  cancelFriendRequestByUser,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  subscribeFriendshipSync
} from "@/lib/friends-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/search")({ component: SearchPage });

type SearchCategory = "all" | "users" | "rants" | "music";

const RECENT_SEARCHES_DEFAULT = ["coralxian", "Coral Xian", "xiancoral", "vibes", "chill beats", "#technews"];

export function SearchPage() {
  const { user } = useAuthContext();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<SearchCategory>("all");
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [matchingMusic, setMatchingMusic] = useState<MusicTrack[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("outloud_recent_searches");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return RECENT_SEARCHES_DEFAULT;
  });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeDropdownUser, setActiveDropdownUser] = useState<string | null>(null);

  // Friendship & Mutual Friends state maps
  const [friendshipMap, setFriendshipMap] = useState<Record<string, "friends" | "sent" | "received" | "none">>({});
  const [mutualMap, setMutualMap] = useState<Record<string, number>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Real-time synchronization
  useEffect(() => {
    const unsub = subscribeFriendshipSync(() => {
      if (users.length > 0 && user?.id) {
        refreshFriendshipStates(users.map((u) => u.id));
      }
    });
    return () => unsub();
  }, [user?.id, users]);

  async function refreshFriendshipStates(userIds: string[]) {
    if (!user || userIds.length === 0) return;
    try {
      const [fMap, mMap] = await Promise.all([
        getFriendshipStateMap(user.id, userIds),
        getMutualFriendsCountMap(user.id, userIds),
      ]);
      setFriendshipMap((prev) => ({ ...prev, ...fMap }));
      setMutualMap((prev) => ({ ...prev, ...mMap }));
    } catch (e) {
      console.error("Error refreshing friendship state:", e);
    }
  }

  // Debounced search effect (300ms)
  useEffect(() => {
    const raw = q.trim();
    // Normalize: remove all @ symbols and trim
    const cleanTerm = raw.replace(/[@]/g, "").trim();

    if (!cleanTerm) {
      setUsers([]);
      setPosts([]);
      setMatchingMusic([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);

    const timer = setTimeout(async () => {
      try {
        let postData: any[] = [];
        try {
          const res = await supabase
            .from("posts")
            .select("*, profiles(username, display_name, avatar_url)")
            .ilike("content", `%${cleanTerm}%`)
            .limit(20);
          postData = (res.data as any) ?? [];
        } catch {}

        const foundUsers = await searchDatabaseUsers(cleanTerm, user?.id);
        const returnedUsers = foundUsers ?? [];
        setUsers(returnedUsers);
        setPosts(postData as PostWithMeta[]);

        // Search music library
        const termLower = cleanTerm.toLowerCase();
        const matchedTracks = MUSIC_LIBRARY.filter(
          (t) =>
            t.title.toLowerCase().includes(termLower) ||
            t.artist.toLowerCase().includes(termLower) ||
            t.genre.toLowerCase().includes(termLower)
        );
        setMatchingMusic(matchedTracks);

        // Fetch friendship state & mutual friends for all found users
        if (user && returnedUsers.length > 0) {
          const userIds = returnedUsers.map((u: any) => u.id);
          const [fMap, mMap] = await Promise.all([
            getFriendshipStateMap(user.id, userIds),
            getMutualFriendsCountMap(user.id, userIds),
          ]);
          setFriendshipMap(fMap);
          setMutualMap(mMap);
        }
      } catch (err) {
        console.error("Search error:", err);
        toast.error("Unable to load search results. Please try again.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [q, user?.id]);

  function handleSelectRecent(term: string) {
    setQ(term);
  }

  function handleClearRecent() {
    setRecentSearches([]);
    try {
      localStorage.removeItem("outloud_recent_searches");
    } catch {}
  }

  function saveRecentSearch(term: string) {
    const clean = term.trim();
    if (!clean || recentSearches.includes(clean)) return;
    const updated = [clean, ...recentSearches.filter((t) => t !== clean)].slice(0, 8);
    setRecentSearches(updated);
    try {
      localStorage.setItem("outloud_recent_searches", JSON.stringify(updated));
    } catch {}
  }

  // ---- Friend Request Actions ----

  async function handleSendRequest(targetUser: any) {
    if (!user) {
      toast.error("Please sign in to add friends");
      return;
    }
    if (targetUser.id === user.id) return;

    setActionLoading((prev) => ({ ...prev, [targetUser.id]: true }));
    // Optimistic update
    setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "sent" }));

    try {
      await sendFriendRequest(user.id, targetUser.id);
      saveRecentSearch(targetUser.username);
      toast.success(`Friend request sent to @${targetUser.username}!`);
    } catch (err: any) {
      setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "none" }));
      toast.error(err.message || "Unable to send friend request. Please try again.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  }

  async function handleCancelRequest(targetUser: any) {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [targetUser.id]: true }));
    // Optimistic update
    setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "none" }));

    try {
      await cancelFriendRequestByUser(user.id, targetUser.id);
      toast.info(`Friend request to @${targetUser.username} cancelled.`);
    } catch (err: any) {
      setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "sent" }));
      toast.error("Failed to cancel request.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  }

  async function handleConfirmRequest(targetUser: any) {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [targetUser.id]: true }));
    // Optimistic update
    setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "friends" }));

    try {
      await acceptFriendRequest("", targetUser.id, user.id);
      toast.success(`You and @${targetUser.username} are now friends! 🎉`);
    } catch (err: any) {
      setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "received" }));
      toast.error("Failed to accept request.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  }

  async function handleDeclineRequest(targetUser: any) {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [targetUser.id]: true }));
    setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "none" }));

    try {
      await declineFriendRequest("", targetUser.id, user.id);
      toast.info(`Request from @${targetUser.username} declined.`);
    } catch (err: any) {
      setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "received" }));
      toast.error("Failed to decline request.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  }

  async function handleUnfriend(targetUser: any) {
    if (!user) return;
    if (!confirm(`Are you sure you want to unfriend @${targetUser.username}?`)) return;

    setActionLoading((prev) => ({ ...prev, [targetUser.id]: true }));
    setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "none" }));
    setActiveDropdownUser(null);

    try {
      await removeFriend(user.id, targetUser.id);
      toast.info(`Removed @${targetUser.username} from friends.`);
    } catch (err: any) {
      setFriendshipMap((prev) => ({ ...prev, [targetUser.id]: "friends" }));
      toast.error("Failed to remove friend.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetUser.id]: false }));
    }
  }

  const totalResults = users.length + posts.length + matchingMusic.length;
  const hasResults = totalResults > 0;
  const cleanQuery = q.replace(/[@]/g, "").trim();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-vivid grid place-items-center shadow-glow">
            <Search className="w-5 h-5 text-white" />
          </div>
          <span>Search OutLoud</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Find creators, rants, tags, and music across the entire sphere.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search users, posts, music, or topics..."
          className="w-full rounded-2xl bg-card border border-border/60 pl-12 pr-12 py-3.5 outline-none focus:ring-2 focus:ring-primary text-sm shadow-card placeholder:text-muted-foreground transition"
        />
        {loading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : q ? (
          <button
            onClick={() => setQ("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition"
            title="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {/* Category Tabs with Dynamic Counters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setCategory("all")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition shrink-0 ${
            category === "all"
              ? "bg-gradient-vivid text-white shadow-glow"
              : "glass hover:bg-muted text-foreground border border-border/40"
          }`}
        >
          All Results {hasSearched ? `(${totalResults})` : ""}
        </button>
        <button
          onClick={() => setCategory("users")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
            category === "users"
              ? "bg-gradient-vivid text-white shadow-glow"
              : "glass hover:bg-muted text-foreground border border-border/40"
          }`}
        >
          <Users className="w-3.5 h-3.5" /> Users ({users.length})
        </button>
        <button
          onClick={() => setCategory("rants")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
            category === "rants"
              ? "bg-gradient-vivid text-white shadow-glow"
              : "glass hover:bg-muted text-foreground border border-border/40"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Posts ({posts.length})
        </button>
        <button
          onClick={() => setCategory("music")}
          className={`px-4 py-2 rounded-full text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
            category === "music"
              ? "bg-gradient-vivid text-white shadow-glow"
              : "glass hover:bg-muted text-foreground border border-border/40"
          }`}
        >
          <Music className="w-3.5 h-3.5" /> Music ({matchingMusic.length})
        </button>
      </div>

      {/* Recent Searches Pills when empty */}
      {!q && recentSearches.length > 0 && (
        <div className="glass rounded-3xl p-5 border border-border/40 shadow-card space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <History className="w-4 h-4" />
              <span>Suggested & Recent Searches</span>
            </span>
            <button onClick={handleClearRecent} className="hover:text-destructive transition text-[11px]">
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((term) => (
              <button
                key={term}
                onClick={() => handleSelectRecent(term)}
                className="px-3.5 py-1.5 rounded-full bg-card hover:bg-primary/20 hover:text-primary transition text-xs font-medium border border-border/40 flex items-center gap-1.5"
              >
                <TrendingUp className="w-3 h-3 opacity-60" />
                <span>{term}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="grid place-items-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-xs text-muted-foreground font-medium">Searching OutLoud database...</p>
          </div>
        </div>
      )}

      {/* Search Results Display */}
      {!loading && hasSearched && (
        <div className="space-y-8 animate-fade-in">
          {/* No results empty state with helpful tips */}
          {!hasResults && (
            <div className="glass rounded-3xl p-10 md:p-12 text-center border border-border/40 space-y-4 shadow-card">
              <div className="w-14 h-14 rounded-2xl bg-muted/40 grid place-items-center mx-auto text-muted-foreground">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-bold text-lg text-foreground">
                  No results found for “{cleanQuery}”
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  We couldn't find any users, posts, or music matching your query.
                </p>
              </div>

              {/* Suggestions */}
              <div className="max-w-md mx-auto bg-card/60 rounded-2xl p-4 border border-border/40 text-left text-xs space-y-2">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-primary" /> Suggestions:
                </div>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 text-[11px]">
                  <li>Check the spelling of the username or display name.</li>
                  <li>Try searching without the <code className="bg-muted px-1 rounded text-foreground">@</code> symbol.</li>
                  <li>Search using the user's display name or partial username.</li>
                  <li>Try searching for a different keyword or topic.</li>
                </ul>
              </div>
            </div>
          )}

          {/* 1. USERS SECTION */}
          {(category === "all" || category === "users") && users.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span>Users ({users.length})</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {users.map((u) => {
                  const isMe = user?.id === u.id;
                  const status = isMe ? "self" : friendshipMap[u.id] ?? "none";
                  const mutuals = mutualMap[u.id] ?? 0;
                  const isOpLoading = !!actionLoading[u.id];
                  const isDropdownOpen = activeDropdownUser === u.id;

                  return (
                    <div
                      key={u.id}
                      className="glass rounded-2xl p-4 border border-border/40 hover:border-primary/40 transition shadow-card flex flex-col justify-between space-y-3.5 group relative"
                    >
                      {/* Top: Avatar, Name, Username, Bio, Role */}
                      <div className="flex items-start gap-3.5">
                        <Link
                          to="/profile/$username"
                          params={{ username: u.username }}
                          className="relative shrink-0"
                        >
                          <div className="w-13 h-13 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold text-base overflow-hidden shadow-glow">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              u.username?.[0]?.toUpperCase() || "U"
                            )}
                          </div>
                        </Link>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Link
                              to="/profile/$username"
                              params={{ username: u.username }}
                              className="font-bold text-sm hover:text-primary transition truncate text-foreground"
                            >
                              {u.display_name || u.username}
                            </Link>
                            {u.role && (
                              <span className="text-[10px] bg-primary/15 text-primary border border-primary/30 px-1.5 py-0.2 rounded-md font-semibold truncate max-w-[140px]">
                                {u.role}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-primary font-medium">@{u.username}</div>

                          {u.bio && (
                            <p className="text-xs text-foreground/80 line-clamp-2 mt-1 leading-relaxed">
                              {u.bio}
                            </p>
                          )}

                          {/* Mutual Friends Count */}
                          {!isMe && (
                            <div className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                              <Users className="w-3 h-3 text-muted-foreground/70" />
                              <span>
                                {mutuals > 0 ? `${mutuals} Mutual Friend${mutuals > 1 ? "s" : ""}` : "No mutual friends yet"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bottom Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                        <Link
                          to="/profile/$username"
                          params={{ username: u.username }}
                          className="flex-1 py-2 px-3 rounded-xl bg-card hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground text-center border border-border/40 transition flex items-center justify-center gap-1"
                        >
                          <span>View Profile</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>

                        {/* Relationship Action Button */}
                        {isMe ? (
                          <Link
                            to="/profile/$username"
                            params={{ username: u.username }}
                            className="py-2 px-3.5 rounded-xl bg-white/5 text-muted-foreground hover:text-foreground text-xs font-semibold border border-white/5 transition"
                          >
                            This is you
                          </Link>
                        ) : status === "friends" ? (
                          <div className="relative">
                            <button
                              onClick={() => setActiveDropdownUser(isDropdownOpen ? null : u.id)}
                              className="py-2 px-3.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 text-xs font-semibold transition flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Friends</span>
                              <MoreHorizontal className="w-3 h-3 opacity-60" />
                            </button>

                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                              <div className="absolute right-0 bottom-full mb-1 w-40 glass rounded-xl border border-border/60 shadow-xl p-1.5 z-20 space-y-1 animate-fade-in">
                                <Link
                                  to="/profile/$username"
                                  params={{ username: u.username }}
                                  onClick={() => setActiveDropdownUser(null)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted text-foreground flex items-center gap-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>View Profile</span>
                                </Link>
                                <Link
                                  to="/messages"
                                  onClick={() => setActiveDropdownUser(null)}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted text-foreground flex items-center gap-2"
                                >
                                  <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                                  <span>Message</span>
                                </Link>
                                <button
                                  onClick={() => handleUnfriend(u)}
                                  disabled={isOpLoading}
                                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-destructive/15 text-destructive flex items-center gap-2"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                  <span>Unfriend</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : status === "sent" ? (
                          <button
                            onClick={() => handleCancelRequest(u)}
                            disabled={isOpLoading}
                            className="py-2 px-3.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 text-xs font-semibold transition flex items-center gap-1.5 group/btn"
                            title="Click to cancel pending request"
                          >
                            {isOpLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Clock className="w-3.5 h-3.5 group-hover/btn:hidden" />
                            )}
                            <X className="w-3.5 h-3.5 hidden group-hover/btn:inline" />
                            <span className="group-hover/btn:hidden">Request Sent</span>
                            <span className="hidden group-hover/btn:inline">Cancel</span>
                          </button>
                        ) : status === "received" ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleConfirmRequest(u)}
                              disabled={isOpLoading}
                              className="py-2 px-3 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-glow hover:scale-105 transition flex items-center gap-1"
                            >
                              {isOpLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                              <span>Confirm</span>
                            </button>
                            <button
                              onClick={() => handleDeclineRequest(u)}
                              disabled={isOpLoading}
                              className="py-2 px-2.5 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs transition"
                              title="Delete request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleSendRequest(u)}
                            disabled={isOpLoading}
                            className="py-2 px-4 rounded-xl bg-gradient-vivid text-white text-xs font-bold shadow-glow hover:scale-105 transition flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {isOpLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5" />
                            )}
                            <span>+ Add Friend</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. MUSIC RESULTS SECTION */}
          {(category === "all" || category === "music") && matchingMusic.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-primary" />
                <span>Music Tracks ({matchingMusic.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {matchingMusic.map((track) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3.5 glass rounded-2xl border border-border/40 shadow-sm hover:border-primary/40 transition"
                  >
                    <img src={track.coverUrl} className="w-13 h-13 rounded-xl object-cover shadow-sm shrink-0" alt="" />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-foreground truncate">{track.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{track.artist} • {track.genre}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. POSTS SECTION */}
          {(category === "all" || category === "rants") && posts.length > 0 && (
            <div className="space-y-3">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-primary" />
                <span>Rants & Posts ({posts.length})</span>
              </div>
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
