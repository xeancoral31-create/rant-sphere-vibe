import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { getFriends, createBarkadaGroup, uploadGroupAvatar } from "@/lib/barkada-api";
import { Users2, Camera, X, Check, Loader2, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends/create-group")({ component: CreateGroupPage });

function CreateGroupPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [friendsLoaded, setFriendsLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useState(() => {
    if (user) {
      getFriends(user.id).then((f) => { setFriends(f); setFriendsLoaded(true); });
    }
  });

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleCreate() {
    if (!user || !name.trim()) { toast.error("Group name is required"); return; }
    if (selectedIds.size === 0) { toast.error("Select at least one friend"); return; }
    setLoading(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        // Temp ID for upload path before group is created
        const tempId = `temp-${Date.now()}`;
        avatarUrl = await uploadGroupAvatar(avatarFile, tempId);
      }
      const group = await createBarkadaGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        avatarUrl,
        creatorId: user.id,
        memberIds: Array.from(selectedIds),
      });
      toast.success(`${name} group created! 🎉`);
      navigate({ to: "/groups/$groupId/chat", params: { groupId: group.id } });
    } catch (e: any) {
      toast.error("Failed to create group: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const presets = ["Barkada 🤙", "Family 👨‍👩‍👧‍👦", "Classmates 📚", "IT Friends 💻", "Gaming Squad 🎮", "Travel Group ✈️", "Project Team 🚀"];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 glass border-b border-border/40 px-6 py-4 flex items-center gap-3">
        <button onClick={() => navigate({ to: "/friends" })} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-xl font-bold">Create Barkada Group</h1>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <button onClick={() => fileRef.current?.click()} className="relative w-24 h-24 rounded-2xl bg-gradient-vivid grid place-items-center text-white overflow-hidden group hover:scale-105 transition">
            {avatarPreview
              ? <img src={avatarPreview} className="w-full h-full object-cover" alt="" />
              : <Users2 className="w-10 h-10" />}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition grid place-items-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          <p className="text-sm text-muted-foreground">Tap to add group photo</p>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Group Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Barkada ni XYZ"
            className="w-full rounded-xl bg-card border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-medium"
            maxLength={60}
          />
          <div className="flex flex-wrap gap-2 mt-2">
            {presets.map((p) => (
              <button key={p} onClick={() => setName(p)} className="text-xs px-3 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            className="w-full rounded-xl bg-card border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={3}
            maxLength={200}
          />
        </div>

        {/* Friends */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
            Invite Friends ({selectedIds.size} selected)
          </label>
          {!friendsLoaded ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : friends.length === 0 ? (
            <div className="glass rounded-xl p-6 text-center text-muted-foreground">
              <Users2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
              You need friends before you can create a group. Add some friends first!
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl border border-border">
              {friends.map((f: any) => {
                const selected = selectedIds.has(f.friend?.id);
                return (
                  <button
                    key={f.friendship_id}
                    onClick={() => toggleMember(f.friend?.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition text-left ${selected ? "bg-primary/10" : "hover:bg-card"}`}
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                      {f.friend?.avatar_url
                        ? <img src={f.friend.avatar_url} className="w-full h-full object-cover" alt="" />
                        : f.friend?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{f.friend?.display_name || f.friend?.username}</div>
                      <div className="text-xs text-muted-foreground">@{f.friend?.username}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 grid place-items-center transition ${selected ? "bg-primary border-primary" : "border-border"}`}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Create button */}
        <button
          onClick={handleCreate}
          disabled={loading || !name.trim() || selectedIds.size === 0}
          className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-pink-500 text-white font-bold shadow-glow hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users2 className="w-5 h-5" />}
          {loading ? "Creating..." : "Create Barkada"}
        </button>
      </div>
    </div>
  );
}
