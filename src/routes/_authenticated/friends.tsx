import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  getFriends, getPendingRequests, getBarkadaGroups, getSuggestedUsers,
  acceptFriendRequest, declineFriendRequest, sendFriendRequest, getFriendRequestStatus,
} from "@/lib/barkada-api";
import {
  Users, UserPlus, Bell, Users2, Compass, Check, X, Loader2,
  MessageCircle, MapPin, ChevronRight, Star
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends")({ component: FriendsPage });

type Tab = "overview" | "requests" | "groups" | "suggested";

function FriendsPage() {
  const { user, profile } = useAuthContext();
  const [tab, setTab] = useState<Tab>("overview");
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (user) loadAll();
  }, [user?.id]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);
    try {
      const [f, r, g, s] = await Promise.all([
        getFriends(user.id),
        getPendingRequests(user.id),
        getBarkadaGroups(user.id),
        getSuggestedUsers(user.id, 20),
      ]);
      setFriends(f);
      setRequests(r);
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
      toast.error("Failed to load friends data");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(req: any) {
    setActionLoading((prev) => ({ ...prev, [req.id]: true }));
    try {
      await acceptFriendRequest(req.id, req.sender_id, user!.id);
      setRequests((r) => r.filter((x) => x.id !== req.id));
      await loadAll();
      toast.success(`You and ${req.sender?.display_name || req.sender?.username} are now friends! 🎉`);
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

  const tabs = [
    { key: "overview", label: "Overview", icon: Users },
    { key: "requests", label: "Requests", icon: Bell, badge: requests.length },
    { key: "groups", label: "Groups", icon: Users2 },
    { key: "suggested", label: "Discover", icon: Compass },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 glass border-b border-border/40 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-primary to-pink-400 bg-clip-text text-transparent">
              Friends & Groups
            </h1>
            <p className="text-sm text-muted-foreground">Barkada system</p>
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
        {/* Stats row */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Friends", value: friends.length, icon: Users, color: "from-violet-500 to-purple-700" },
              { label: "Pending", value: requests.length, icon: Bell, color: "from-pink-500 to-rose-600" },
              { label: "Groups", value: groups.length, icon: Users2, color: "from-blue-500 to-indigo-600" },
              { label: "Discover", value: suggested.length, icon: Compass, color: "from-emerald-500 to-teal-600" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-2xl p-4 border border-white/10 hover:border-primary/40 transition group">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} grid place-items-center mb-3 group-hover:scale-110 transition`}>
                  <s.icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-xl bg-card/50 border border-border/30">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition relative ${
                tab === t.key ? "bg-gradient-to-r from-primary to-pink-500 text-white shadow-glow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              {"badge" in t && (t as any).badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {(t as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* ---- OVERVIEW ---- */}
            {tab === "overview" && (
              <div>
                {friends.length === 0 ? (
                  <EmptyState
                    icon={<Users className="w-12 h-12 text-muted-foreground" />}
                    title="No friends yet"
                    description="Discover people to connect with."
                    action={<button onClick={() => setTab("suggested")} className="btn-primary">Discover People</button>}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {friends.map((f: any) => (
                      <FriendCard key={f.friendship_id} friend={f.friend} friendedAt={f.created_at} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---- REQUESTS ---- */}
            {tab === "requests" && (
              <div className="space-y-3">
                {requests.length === 0 ? (
                  <EmptyState
                    icon={<Bell className="w-12 h-12 text-muted-foreground" />}
                    title="No pending requests"
                    description="When someone sends you a friend request, it will appear here."
                  />
                ) : (
                  requests.map((req: any) => (
                    <div key={req.id} className="glass rounded-2xl p-4 border border-white/10 flex items-center gap-4 animate-in slide-in-from-bottom-2">
                      <div className="w-12 h-12 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden flex-shrink-0">
                        {req.sender?.avatar_url
                          ? <img src={req.sender.avatar_url} className="w-full h-full object-cover" alt="" />
                          : req.sender?.username?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold">{req.sender?.display_name || req.sender?.username}</div>
                        <div className="text-sm text-muted-foreground">@{req.sender?.username}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccept(req)}
                          disabled={actionLoading[req.id]}
                          className="w-9 h-9 rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/40 grid place-items-center transition"
                        >
                          {actionLoading[req.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDecline(req)}
                          disabled={actionLoading[req.id]}
                          className="w-9 h-9 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 grid place-items-center transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ---- GROUPS ---- */}
            {tab === "groups" && (
              <div>
                {groups.length === 0 ? (
                  <EmptyState
                    icon={<Users2 className="w-12 h-12 text-muted-foreground" />}
                    title="No Barkada groups yet"
                    description="Create your first Barkada group and invite your friends."
                    action={
                      <Link to="/friends/create-group" className="btn-primary">
                        Create Barkada
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

            {/* ---- SUGGESTED ---- */}
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

function FriendCard({ friend, friendedAt }: { friend: any; friendedAt: string }) {
  return (
    <Link
      to="/profile/$username"
      params={{ username: friend?.username || "user" }}
      className="glass rounded-2xl p-4 border border-white/10 hover:border-primary/40 transition flex items-center gap-3 group"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden flex-shrink-0">
        {friend?.avatar_url
          ? <img src={friend.avatar_url} className="w-full h-full object-cover" alt="" />
          : friend?.username?.[0]?.toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{friend?.display_name || friend?.username}</div>
        <div className="text-sm text-muted-foreground">@{friend?.username}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Friends since {formatDistanceToNow(new Date(friendedAt), { addSuffix: true })}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition" />
    </Link>
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
        {group.avatar_url
          ? <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
          : group.name?.[0]?.toUpperCase()}
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
          {profile.avatar_url
            ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
            : profile.username?.[0]?.toUpperCase()}
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
            ? "bg-green-500/20 text-green-400 cursor-default"
            : status === "sent"
            ? "bg-muted text-muted-foreground cursor-default"
            : "bg-gradient-to-r from-primary to-pink-500 text-white hover:scale-105 shadow-glow"
        }`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          : status === "friends" ? "✓ Friends"
          : status === "sent" ? "Request Sent"
          : <span className="flex items-center justify-center gap-1"><UserPlus className="w-4 h-4" /> Add Friend</span>}
      </button>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="opacity-40">{icon}</div>
      <div>
        <div className="font-semibold text-lg">{title}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      {action && action}
    </div>
  );
}
