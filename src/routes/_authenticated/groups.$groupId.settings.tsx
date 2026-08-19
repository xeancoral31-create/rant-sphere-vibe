import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  getGroupDetails, addGroupMember, removeGroupMember, leaveGroup,
  promoteToAdmin, demoteToMember, deleteGroup, updateGroupInfo,
  getFriends, uploadGroupAvatar, getTrustedContacts, addTrustedContact, removeTrustedContact,
} from "@/lib/barkada-api";
import {
  ChevronLeft, Users, Settings, Camera, Trash2, LogOut, Crown, Shield,
  ShieldOff, UserPlus, UserMinus, Loader2, MoreVertical, Bell, BellOff,
  X, Check, AlertTriangle, Star, StarOff, Phone,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/groups/$groupId/settings")({ component: GroupSettingsPage });

function GroupSettingsPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<any[]>([]);
  const [trustedContacts, setTrustedContacts] = useState<any[]>([]);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"members" | "media" | "trusted" | "privacy">("members");

  useEffect(() => {
    if (user && groupId) { loadAll(); }
  }, [groupId, user?.id]);

  async function loadAll() {
    setLoading(true);
    try {
      const [g, f, tc] = await Promise.all([
        getGroupDetails(groupId),
        getFriends(user!.id),
        getTrustedContacts(user!.id),
      ]);
      setGroup(g);
      setEditName(g.name ?? "");
      setEditDesc(g.description ?? "");
      setFriends(f);
      setTrustedContacts(tc);
    } catch { toast.error("Failed to load group settings"); }
    finally { setLoading(false); }
  }

  const members = group?.conversation_participants ?? [];
  const myMembership = members.find((m: any) => m.user_id === user?.id);
  const myRole = myMembership?.role ?? "member";
  const isAdminOrOwner = myRole === "owner" || myRole === "admin";

  const nonMemberFriendIds = friends
    .map((f: any) => f.friend?.id)
    .filter((id: string) => id && !members.find((m: any) => m.user_id === id));

  async function handleSave() {
    setSaving(true);
    try {
      await updateGroupInfo(groupId, { name: editName.trim(), description: editDesc.trim() });
      setGroup((g: any) => ({ ...g, name: editName.trim(), description: editDesc.trim() }));
      setEditMode(false);
      toast.success("Group updated!");
    } catch { toast.error("Failed to update group"); }
    finally { setSaving(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadGroupAvatar(file, groupId);
      await updateGroupInfo(groupId, { avatar_url: url });
      setGroup((g: any) => ({ ...g, avatar_url: url }));
      toast.success("Group photo updated!");
    } catch { toast.error("Failed to upload photo"); }
  }

  async function handleRemoveMember(userId: string, username: string) {
    setActionLoading((p) => ({ ...p, [userId]: true }));
    try {
      await removeGroupMember(groupId, userId, user!.id);
      setGroup((g: any) => ({ ...g, conversation_participants: g.conversation_participants.filter((m: any) => m.user_id !== userId) }));
      toast.success(`${username} removed from group`);
    } catch { toast.error("Failed to remove member"); }
    finally { setActionLoading((p) => ({ ...p, [userId]: false })); }
  }

  async function handlePromote(userId: string) {
    try {
      await promoteToAdmin(groupId, userId);
      setGroup((g: any) => ({ ...g, conversation_participants: g.conversation_participants.map((m: any) => m.user_id === userId ? { ...m, role: "admin" } : m) }));
      toast.success("Promoted to admin");
    } catch { toast.error("Failed to promote"); }
  }

  async function handleDemote(userId: string) {
    try {
      await demoteToMember(groupId, userId);
      setGroup((g: any) => ({ ...g, conversation_participants: g.conversation_participants.map((m: any) => m.user_id === userId ? { ...m, role: "member" } : m) }));
      toast.success("Demoted to member");
    } catch { toast.error("Failed to demote"); }
  }

  async function handleAddMember(friendId: string, username: string) {
    setActionLoading((p) => ({ ...p, [friendId]: true }));
    try {
      await addGroupMember(groupId, friendId, user!.id);
      await loadAll();
      toast.success(`${username} added to group!`);
    } catch { toast.error("Failed to add member"); }
    finally { setActionLoading((p) => ({ ...p, [friendId]: false })); }
  }

  async function handleLeave() {
    try {
      await leaveGroup(groupId, user!.id);
      navigate({ to: "/friends" });
      toast.info("You left the group");
    } catch { toast.error("Failed to leave group"); }
  }

  async function handleDelete() {
    try {
      await deleteGroup(groupId);
      navigate({ to: "/friends" });
      toast.success("Group deleted");
    } catch { toast.error("Failed to delete group"); }
  }

  async function handleAddTrusted(userId: string) {
    try {
      await addTrustedContact(user!.id, userId);
      await loadAll();
      toast.success("Added to trusted contacts");
    } catch { toast.error("Failed to add trusted contact"); }
  }

  async function handleRemoveTrusted(userId: string) {
    try {
      await removeTrustedContact(user!.id, userId);
      await loadAll();
      toast.info("Removed from trusted contacts");
    } catch { toast.error("Failed to remove trusted contact"); }
  }

  if (loading) return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  const trustedIds = new Set(trustedContacts.map((t: any) => t.trusted_user_id));

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 glass border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Link to="/groups/$groupId/chat" params={{ groupId }} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold flex-1">Group Settings</h1>
        {isAdminOrOwner && !editMode && (
          <button onClick={() => setEditMode(true)} className="text-sm text-primary font-medium">Edit</button>
        )}
        {editMode && (
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="text-sm text-muted-foreground">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="text-sm text-primary font-medium">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
          </div>
        )}
      </div>

      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Group info card */}
        <div className="glass rounded-2xl p-5 border border-white/10 text-center">
          <label className="cursor-pointer relative w-20 h-20 mx-auto block">
            <div className="w-20 h-20 rounded-2xl bg-gradient-vivid grid place-items-center text-white font-bold text-2xl overflow-hidden mx-auto hover:opacity-80 transition">
              {group?.avatar_url
                ? <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
                : group?.name?.[0]?.toUpperCase()}
            </div>
            {isAdminOrOwner && <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />}
            {isAdminOrOwner && (
              <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary border-2 border-background grid place-items-center">
                <Camera className="w-3 h-3 text-white" />
              </div>
            )}
          </label>

          {editMode ? (
            <div className="mt-4 space-y-3">
              <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full rounded-xl bg-card border border-border px-3 py-2 text-center font-semibold outline-none focus:ring-2 focus:ring-primary" maxLength={60} />
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-muted-foreground outline-none focus:ring-2 focus:ring-primary resize-none" rows={2} maxLength={200} placeholder="Group description..." />
            </div>
          ) : (
            <div className="mt-3">
              <div className="font-bold text-lg">{group?.name}</div>
              {group?.description && <div className="text-sm text-muted-foreground mt-1">{group?.description}</div>}
              <div className="text-xs text-muted-foreground mt-1">{members.length} members</div>
            </div>
          )}
        </div>

        {/* Navigation tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-card/50 border border-border/30">
          {(["members", "media", "trusted", "privacy"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition capitalize ${activeTab === t ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Members tab */}
        {activeTab === "members" && (
          <div className="space-y-3">
            {isAdminOrOwner && (
              <button onClick={() => setShowAddMember(p => !p)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition text-sm font-medium">
                <UserPlus className="w-4 h-4" /> Add Members
              </button>
            )}

            {showAddMember && nonMemberFriendIds.length > 0 && (
              <div className="glass rounded-xl border border-border p-3 space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Add from friends:</div>
                {friends.filter((f: any) => nonMemberFriendIds.includes(f.friend?.id)).map((f: any) => (
                  <button key={f.friendship_id} onClick={() => handleAddMember(f.friend?.id, f.friend?.username)} disabled={actionLoading[f.friend?.id]}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-card text-left">
                    <div className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden">
                      {f.friend?.avatar_url ? <img src={f.friend.avatar_url} className="w-full h-full object-cover" alt="" /> : f.friend?.username?.[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm">{f.friend?.display_name || f.friend?.username}</span>
                    {actionLoading[f.friend?.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
            )}

            {members.map((m: any) => {
              const isMe = m.user_id === user?.id;
              const isOwner = m.role === "owner";
              const isAdmin = m.role === "admin";
              const p = m.profiles;
              return (
                <div key={m.user_id} className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                    {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : p?.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-1.5">
                      {p?.display_name || p?.username}
                      {isOwner && <Crown className="w-3 h-3 text-yellow-400" />}
                      {isAdmin && !isOwner && <Shield className="w-3 h-3 text-blue-400" />}
                      {isMe && <span className="text-xs text-primary">(You)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">@{p?.username} · {m.role}</div>
                  </div>
                  {isAdminOrOwner && !isMe && !isOwner && (
                    <div className="flex gap-1">
                      {!isAdmin && (
                        <button onClick={() => handlePromote(m.user_id)} className="w-7 h-7 rounded-full hover:bg-card grid place-items-center text-blue-400 transition" title="Promote to admin">
                          <Shield className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isAdmin && myRole === "owner" && (
                        <button onClick={() => handleDemote(m.user_id)} className="w-7 h-7 rounded-full hover:bg-card grid place-items-center text-muted-foreground transition" title="Demote">
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => handleRemoveMember(m.user_id, p?.username)} disabled={actionLoading[m.user_id]} className="w-7 h-7 rounded-full hover:bg-red-500/20 grid place-items-center text-red-400 transition">
                        {actionLoading[m.user_id] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Media tab */}
        {activeTab === "media" && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="font-semibold">Group Media</div>
            <div className="text-sm">Photos, videos, and files shared in this group will appear here.</div>
            <Link to="/groups/$groupId/media" params={{ groupId }} className="mt-4 inline-block px-4 py-2 rounded-full bg-primary/10 text-primary text-sm hover:bg-primary/20 transition">View Media</Link>
          </div>
        )}

        {/* Trusted contacts tab */}
        {activeTab === "trusted" && (
          <div className="space-y-3">
            <div className="glass rounded-xl p-4 border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-muted-foreground">
                  Trusted contacts receive emergency location alerts only when <strong>you</strong> explicitly activate the emergency share feature.
                </div>
              </div>
            </div>
            {members.filter((m: any) => m.user_id !== user?.id).map((m: any) => {
              const isTrusted = trustedIds.has(m.user_id);
              const p = m.profiles;
              return (
                <div key={m.user_id} className="glass rounded-xl p-3 border border-white/5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-sm font-bold overflow-hidden">
                    {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" alt="" /> : p?.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{p?.display_name || p?.username}</div>
                  </div>
                  <button onClick={() => isTrusted ? handleRemoveTrusted(m.user_id) : handleAddTrusted(m.user_id)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${isTrusted ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30" : "bg-card hover:bg-card/80 text-muted-foreground"}`}>
                    {isTrusted ? <><Star className="w-3 h-3" /> Trusted</> : <><StarOff className="w-3 h-3" /> Add Trusted</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Privacy tab */}
        {activeTab === "privacy" && (
          <div className="space-y-3">
            <div className="glass rounded-xl p-4 border border-border">
              <div className="text-sm font-medium mb-1">Location Sharing</div>
              <div className="text-xs text-muted-foreground">Location sharing is OFF by default. You can share your location or start a live location session from the chat.</div>
            </div>
          </div>
        )}

        {/* Danger zone */}
        <div className="glass rounded-2xl p-4 border border-red-500/20 space-y-3">
          <div className="text-sm font-semibold text-red-400">Danger Zone</div>
          {myRole !== "owner" && (
            <button onClick={handleLeave} className="w-full flex items-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-medium">
              <LogOut className="w-4 h-4" /> Leave Group
            </button>
          )}
          {myRole === "owner" && (
            confirmDelete ? (
              <div className="space-y-2">
                <div className="text-sm text-red-400">Are you sure? This cannot be undone.</div>
                <div className="flex gap-2">
                  <button onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold">Yes, Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="flex-1 py-2 rounded-xl bg-card text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="w-full flex items-center gap-2 py-2.5 px-4 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition text-sm font-medium">
                <Trash2 className="w-4 h-4" /> Delete Group
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
