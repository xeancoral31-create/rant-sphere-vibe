import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  getFriends, getPendingRequests, getSentRequests, getBarkadaGroups, getSuggestedUsers,
  acceptFriendRequest, declineFriendRequest, sendFriendRequest, getFriendRequestStatus, removeFriend, cancelFriendRequest,
  subscribeFriendshipSync
} from "@/lib/friends-api";
import {
  Users, UserPlus, Bell, Users2, Compass, Check, X, Loader2,
  MessageCircle, Phone, Video, Search, ChevronRight, UserMinus, UserCheck,
  AlertTriangle, RefreshCw, SlidersHorizontal, Eye, Clock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({ component: FriendsPage });

type Tab = "overview" | "requests" | "groups" | "suggested";
type SortOption = "recent" | "online" | "name";

function FriendsPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [requestsSubTab, setRequestsSubTab] = useState<"incoming" | "sent">("incoming");
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  // Filtering and sorting state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  useEffect(() => {
    if (user) loadAll();
    const unsub = subscribeFriendshipSync(() => {
      if (user) loadAll();
    });
    return () => unsub();
  }, [user?.id]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [f, r, sReqs, g, s] = await Promise.all([
        getFriends(user.id),
        getPendingRequests(user.id),
        getSentRequests(user.id),
        getBarkadaGroups(user.id),
        getSuggestedUsers(user.id, 20),
      ]);
      setFriends(f);
      setRequests(r);
      setSentRequests(sReqs);
      setGroups(g);

      // Filter out existing friends from suggestions
      const friendIds = new Set(f.map((x: any) => x.friend?.id).filter(Boolean));
      const filtered = s.filter((u: any) => !friendIds.has(u.id) && u.id !== user.id);
      setSuggested(filtered.slice(0, 12));

      // Get statuses for suggested users
      const statuses: Record<string, string> = {};
      await Promise.all(
        filtered.slice(0, 12).map(async (su: any) => {
          statuses[su.id] = await getFriendRequestStatus(user.id, su.id);
        })
      );
      setFriendStatuses(statuses);
    } catch (e: any) {
      console.error("Failed to load friends data", e);
      setError("Failed to load friends data. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(req: any) {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [req.id]: true }));
    try {
      await acceptFriendRequest(req.id, req.sender_id, user.id);
      setRequests((r) => r.filter((x) => x.id !== req.id));
      await loadAll();
      toast.success(`You and @${req.sender?.username || "user"} are now friends! 🎉`);
    } catch {
      toast.error("Failed to accept request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [req.id]: false }));
    }
  }

  async function handleDecline(req: any) {
    setActionLoading((prev) => ({ ...prev, [req.id]: true }));
    try {
      await declineFriendRequest(req.id);
      setRequests((r) => r.filter((x) => x.id !== req.id));
      toast.info("Request declined");
    } catch {
      toast.error("Failed to decline request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [req.id]: false }));
    }
  }

  async function handleCancelSent(reqId: string, username: string) {
    setActionLoading((prev) => ({ ...prev, [reqId]: true }));
    try {
      await cancelFriendRequest(reqId);
      setSentRequests((prev) => prev.filter((r) => r.id !== reqId));
      toast.info(`Cancelled friend request to @${username}`);
    } catch {
      toast.error("Failed to cancel request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [reqId]: false }));
    }
  }

  async function handleAddFriend(targetId: string) {
    if (!user) return;
    setActionLoading((prev) => ({ ...prev, [targetId]: true }));
    try {
      await sendFriendRequest(user.id, targetId);
      setFriendStatuses((prev) => ({ ...prev, [targetId]: "sent" }));
      toast.success("Friend request sent!");
    } catch {
      toast.error("Failed to send request");
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  }

  async function handleRemoveFriend(friendId: string, username: string) {
    if (!user) return;
    if (!confirm(`Are you sure you want to remove @${username} from your friends?`)) return;
    setActionLoading((prev) => ({ ...prev, [friendId]: true }));
    try {
      await removeFriend(user.id, friendId);
      setFriends((prev) => prev.filter((f) => f.friend?.id !== friendId));
      toast.info(`Removed @${username} from friends.`);
      loadAll();
    } catch {
      toast.error("Failed to remove friend");
    } finally {
      setActionLoading((prev) => ({ ...prev, [friendId]: false }));
    }
  }

  // Filter & sort friends
  const filteredFriends = friends.filter((f) => {
    const q = searchQuery.toLowerCase();
    const name = (f.friend?.display_name || "").toLowerCase();
    const username = (f.friend?.username || "").toLowerCase();
    return name.includes(q) || username.includes(q);
  }).sort((a, b) => {
    if (sortBy === "name") {
      const nameA = a.friend?.display_name || a.friend?.username || "";
      const nameB = b.friend?.display_name || b.friend?.username || "";
      return nameA.localeCompare(nameB);
    }
    if (sortBy === "online") {
      const onlineA = a.friend?.is_online ? 1 : 0;
      const onlineB = b.friend?.is_online ? 1 : 0;
      return onlineB - onlineA;
    }
    // Default: recent
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const tabs = [
    { key: "overview", label: "Friends", icon: Users, badge: friends.length },
    { key: "requests", label: "Requests", icon: Bell, badge: requests.length },
    { key: "groups", label: "Groups", icon: Users2, badge: groups.length },
    { key: "suggested", label: "Discover", icon: Compass, badge: suggested.length },
  ] as const;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-border/40 px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-primary via-pink-400 to-rose-400 bg-clip-text text-transparent">
              Friends & Groups
            </h1>
            <p className="text-sm text-muted-foreground">Manage connections, requests, and Barkadas</p>
          </div>
          <Link
            to="/friends/create-group"
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-glow hover:scale-105 transition"
          >
            <Users2 className="w-4 h-4" /> New Group
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Dashboard Metrics Row */}
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Friends", value: friends.length, icon: Users, color: "from-violet-500 to-purple-700" },
              { label: "Pending", value: requests.length, icon: Bell, color: "from-pink-500 to-rose-600" },
              { label: "Groups", value: groups.length, icon: Users2, color: "from-blue-500 to-indigo-600" },
              { label: "Discover", value: suggested.length, icon: Compass, color: "from-emerald-500 to-teal-600" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl p-4 border border-white/10 hover:border-primary/40 transition group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} grid place-items-center mb-3 group-hover:scale-110 transition shadow-sm`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs navigation */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-card/50 border border-border/30">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition relative ${
                tab === t.key
                  ? "bg-gradient-to-r from-primary to-pink-500 text-white shadow-glow"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              {"badge" in t && (t as any).badge > 0 && (
                <span className={`min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-bold flex items-center justify-center px-1 ${
                  tab === t.key ? "bg-white/25 text-white" : "bg-primary text-white"
                }`}>
                  {(t as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="glass rounded-3xl p-8 text-center border border-destructive/40 shadow-card space-y-4 mb-6">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
            <div className="font-semibold text-lg">{error}</div>
            <button
              onClick={loadAll}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:scale-105 transition"
            >
              <RefreshCw className="w-4 h-4" /> Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ---- FRIENDS OVERVIEW & MANAGEMENT ---- */}
            {tab === "overview" && (
              <div className="space-y-4">
                {/* Search & Filter Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-2">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search friends..."
                      className="w-full pl-9 pr-4 py-2 text-sm rounded-full bg-card border border-border/40 outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <SlidersHorizontal className="w-3.5 h-3.5" /> Sort:
                    </span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                      className="bg-card border border-border/40 text-xs rounded-full px-3 py-1.5 outline-none font-medium text-foreground cursor-pointer"
                    >
                      <option value="recent">Recently Added</option>
                      <option value="online">Online First</option>
                      <option value="name">Alphabetical</option>
                    </select>
                  </div>
                </div>

                {filteredFriends.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-12 h-12 text-muted-foreground" />}
                    title={searchQuery ? "No matching friends found" : "No confirmed friends yet"}
                    description={searchQuery ? "Try searching for a different name or username." : "Connect with people and start building your OutLoud circle."}
                    action={
                      !searchQuery && (
                        <button onClick={() => setTab("suggested")} className="rounded-full bg-gradient-to-r from-primary to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:scale-105 transition">
                          Discover People
                        </button>
                      )
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredFriends.map((f: any) => (
                      <FriendCard
                        key={f.friendship_id}
                        friend={f.friend}
                        friendedAt={f.created_at}
                        removing={!!actionLoading[f.friend?.id]}
                        onRemove={() => handleRemoveFriend(f.friend?.id, f.friend?.username || "user")}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- PENDING & SENT REQUESTS ---- */}
            {tab === "requests" && (
              <div className="space-y-4">
                {/* Sub tabs: Incoming vs Sent */}
                <div className="flex items-center gap-2 border-b border-border/40 pb-3">
                  <button
                    onClick={() => setRequestsSubTab("incoming")}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                      requestsSubTab === "incoming"
                        ? "bg-gradient-vivid text-white shadow-glow"
                        : "glass text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Incoming Requests</span>
                    <span className="text-[10px] opacity-80">({requests.length})</span>
                  </button>
                  <button
                    onClick={() => setRequestsSubTab("sent")}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
                      requestsSubTab === "sent"
                        ? "bg-gradient-vivid text-white shadow-glow"
                        : "glass text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span>Sent Requests</span>
                    <span className="text-[10px] opacity-80">({sentRequests.length})</span>
                  </button>
                </div>

                {requestsSubTab === "incoming" ? (
                  requests.length === 0 ? (
                    <EmptyState
                      icon={<Bell className="w-12 h-12 text-muted-foreground" />}
                      title="No incoming friend requests"
                      description="When someone sends you a friend request, it will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {requests.map((req: any) => (
                        <div key={req.id} className="glass rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <Link to="/profile/$username" params={{ username: req.sender?.username || "user" }}>
                              <div className="w-12 h-12 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden flex-shrink-0 relative shadow-glow">
                                {req.sender?.avatar_url
                                  ? <img src={req.sender.avatar_url} className="w-full h-full object-cover" alt="" />
                                  : req.sender?.username?.[0]?.toUpperCase()}
                              </div>
                            </Link>
                            <div className="min-w-0">
                              <Link to="/profile/$username" params={{ username: req.sender?.username || "user" }} className="font-semibold truncate hover:text-primary transition block">
                                {req.sender?.display_name || req.sender?.username}
                              </Link>
                              <div className="text-xs text-primary">@{req.sender?.username}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Sent {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAccept(req)}
                              disabled={actionLoading[req.id]}
                              className="px-3.5 py-1.5 rounded-full bg-emerald-500 text-white shadow-glow hover:scale-105 text-xs font-semibold flex items-center gap-1 transition"
                            >
                              {actionLoading[req.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm
                            </button>
                            <button
                              onClick={() => handleDecline(req)}
                              disabled={actionLoading[req.id]}
                              className="px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-xs font-semibold transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  sentRequests.length === 0 ? (
                    <EmptyState
                      icon={<Clock className="w-12 h-12 text-muted-foreground" />}
                      title="No pending sent requests"
                      description="You haven't sent any friend requests that are pending acceptance."
                    />
                  ) : (
                    <div className="space-y-3">
                      {sentRequests.map((req: any) => (
                        <div key={req.id} className="glass rounded-2xl p-4 border border-white/10 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <Link to="/profile/$username" params={{ username: req.receiver?.username || "user" }}>
                              <div className="w-12 h-12 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden flex-shrink-0 relative shadow-glow">
                                {req.receiver?.avatar_url
                                  ? <img src={req.receiver.avatar_url} className="w-full h-full object-cover" alt="" />
                                  : req.receiver?.username?.[0]?.toUpperCase()}
                              </div>
                            </Link>
                            <div className="min-w-0">
                              <Link to="/profile/$username" params={{ username: req.receiver?.username || "user" }} className="font-semibold truncate hover:text-primary transition block">
                                {req.receiver?.display_name || req.receiver?.username}
                              </Link>
                              <div className="text-xs text-primary">@{req.receiver?.username}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                Sent {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleCancelSent(req.id, req.receiver?.username || "user")}
                            disabled={actionLoading[req.id]}
                            className="px-3.5 py-1.5 rounded-full bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 text-xs font-semibold transition flex items-center gap-1"
                          >
                            {actionLoading[req.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Cancel Request
                          </button>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            )}

            {/* ---- GROUPS TAB ---- */}
            {tab === "groups" && (
              <div>
                {groups.length === 0 ? (
                  <EmptyState
                    icon={<Users2 className="w-12 h-12 text-muted-foreground" />}
                    title="No groups yet"
                    description="Create your first group and bring your friends together."
                    action={
                      <Link to="/friends/create-group" className="rounded-full bg-gradient-to-r from-primary to-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow hover:scale-105 transition">
                        Create Group
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {groups.map((g: any) => (
                      <GroupCard key={g.id} group={g} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- SUGGESTED / DISCOVER TAB ---- */}
            {tab === "suggested" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suggested.length === 0 ? (
                  <EmptyState
                    icon={<Compass className="w-12 h-12 text-muted-foreground" />}
                    title="No suggestions"
                    description="You've already connected with everyone!"
                  />
                ) : (
                  suggested.map((s: any) => (
                    <SuggestedCard
                      key={s.id}
                      profile={s}
                      status={friendStatuses[s.id] ?? "none"}
                      loading={!!actionLoading[s.id]}
                      onAdd={() => handleAddFriend(s.id)}
                    />
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---- Sub-components ----

function FriendCard({
  friend,
  friendedAt,
  removing,
  onRemove
}: {
  friend: any;
  friendedAt: string;
  removing?: boolean;
  onRemove?: () => void;
}) {
  const isOnline = friend?.is_online ?? true;
  const username = friend?.username || "user";
  const displayName = friend?.display_name || username;

  return (
    <div className="glass rounded-2xl p-4 border border-white/10 hover:border-primary/40 transition flex flex-col justify-between space-y-3 group relative">
      <div className="flex items-start gap-3">
        <Link to="/profile/$username" params={{ username }} className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
            {friend?.avatar_url ? (
              <img src={friend.avatar_url} className="w-full h-full object-cover" alt="" />
            ) : (
              username[0]?.toUpperCase()
            )}
          </div>
          <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
            isOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`} />
        </Link>

        <div className="flex-1 min-w-0">
          <Link to="/profile/$username" params={{ username }} className="font-semibold text-foreground hover:text-primary transition truncate block">
            {displayName}
          </Link>
          <div className="text-xs text-muted-foreground">@{username}</div>
          <div className="text-[11px] text-muted-foreground/80 mt-1 flex items-center gap-1">
            <span className={isOnline ? "text-emerald-400 font-medium" : ""}>
              {isOnline ? "Online now" : "Active recently"}
            </span>
            <span>•</span>
            <span>Friends since {formatDistanceToNow(new Date(friendedAt), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex items-center justify-between pt-2 border-t border-border/30 gap-1.5">
        <div className="flex items-center gap-1">
          <Link
            to="/messages"
            className="w-8 h-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20 grid place-items-center transition"
            title="Send message"
          >
            <MessageCircle className="w-4 h-4" />
          </Link>
          <button
            onClick={() => toast.info(`Starting voice call with @${username}...`)}
            className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 grid place-items-center transition"
            title="Voice call"
          >
            <Phone className="w-4 h-4" />
          </button>
          <button
            onClick={() => toast.info(`Starting video call with @${username}...`)}
            className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 grid place-items-center transition"
            title="Video call"
          >
            <Video className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <Link
            to="/profile/$username"
            params={{ username }}
            className="w-8 h-8 rounded-full glass hover:bg-muted text-muted-foreground grid place-items-center transition"
            title="View Profile"
          >
            <Eye className="w-4 h-4" />
          </Link>
          <button
            onClick={onRemove}
            disabled={removing}
            className="w-8 h-8 rounded-full glass hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 grid place-items-center transition"
            title="Remove Friend"
          >
            {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: any }) {
  const members = group.conversation_participants ?? [];
  return (
    <Link
      to="/groups/$groupId/chat"
      params={{ groupId: group.id }}
      className="glass rounded-2xl p-4 border border-white/10 hover:border-primary/40 transition flex items-center gap-4 group"
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-vivid grid place-items-center text-white font-bold text-lg overflow-hidden flex-shrink-0">
        {group.avatar_url ? (
          <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
        ) : (
          group.name?.[0]?.toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{group.name}</div>
        {group.description && (
          <div className="text-sm text-muted-foreground truncate">{group.description}</div>
        )}
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> {members.length} members
          </span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(group.updated_at), { addSuffix: true })}
          </span>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
    </Link>
  );
}

function SuggestedCard({ profile, status, loading, onAdd }: { profile: any; status: string; loading: boolean; onAdd: () => void }) {
  return (
    <div className="glass rounded-2xl p-4 border border-white/10 hover:border-primary/20 transition">
      <Link to="/profile/$username" params={{ username: profile.username || "user" }} className="flex items-center gap-3 mb-3">
        <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
          ) : (
            profile.username?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{profile.display_name || profile.username}</div>
          <div className="text-sm text-muted-foreground">@{profile.username}</div>
        </div>
      </Link>
      <button
        onClick={onAdd}
        disabled={loading || status === "sent" || status === "friends"}
        className={`w-full py-2 rounded-full text-sm font-semibold transition ${
          status === "friends"
            ? "bg-emerald-500/20 text-emerald-400 cursor-default"
            : status === "sent"
            ? "bg-muted text-muted-foreground cursor-default"
            : "bg-gradient-to-r from-primary to-pink-500 text-white hover:scale-105 shadow-glow"
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        ) : status === "friends" ? (
          "✓ Friends"
        ) : status === "sent" ? (
          "Request Sent"
        ) : (
          <span className="flex items-center justify-center gap-1">
            <UserPlus className="w-4 h-4" /> Add Friend
          </span>
        )}
      </button>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="opacity-40">{icon}</div>
      <div>
        <div className="font-semibold text-lg">{title}</div>
        <div className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</div>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
