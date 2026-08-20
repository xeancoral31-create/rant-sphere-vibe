import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { getFriends, createBarkadaGroup, uploadGroupAvatar } from "@/lib/friends-api";
import {
  Users2, Camera, X, Check, Loader2, ChevronLeft, ChevronRight, Lock, Eye,
  Search, UserPlus, Image as ImageIcon, Sparkles, Shield
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/friends/create-group")({ component: CreateGroupPage });

type PrivacyOption = "private" | "invite_only";

export function CreateGroupPage() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  // Wizard Step (1: Info, 2: Members, 3: Preview)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<PrivacyOption>("private");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Step 2: Members
  const [friends, setFriends] = useState<any[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [friendsLoaded, setFriendsLoaded] = useState(false);

  const [loading, setLoading] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      getFriends(user.id).then((f) => {
        setFriends(f);
        setFriendsLoaded(true);
      });
    }
  }, [user?.id]);

  function toggleMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function removeMember(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverPreview(URL.createObjectURL(file));
  }

  async function handleCreateGroup() {
    if (!user || !name.trim()) {
      toast.error("Group name is required");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Please select at least one friend to add to the group");
      return;
    }

    setLoading(true);
    try {
      let avatarUrl: string | undefined;
      if (avatarFile) {
        const tempId = `temp-${Date.now()}`;
        avatarUrl = await uploadGroupAvatar(avatarFile, tempId);
      }

      const group: any = await createBarkadaGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        avatarUrl,
        creatorId: user.id,
        memberIds: Array.from(selectedIds),
      });

      toast.success(`Group "${name}" created successfully! 🎉`);
      navigate({ to: "/groups/$groupId/chat", params: { groupId: group.id } });
    } catch (e: any) {
      toast.error("Failed to create group: " + (e.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  const filteredFriends = friends.filter((f) => {
    const q = memberSearch.toLowerCase();
    const displayName = (f.friend?.display_name || "").toLowerCase();
    const username = (f.friend?.username || "").toLowerCase();
    return displayName.includes(q) || username.includes(q);
  });

  const selectedFriends = friends.filter((f) => selectedIds.has(f.friend?.id));

  const presets = ["Barkada 🤙", "Family 👨‍👩‍👧‍👦", "Classmates 📚", "Tech Vibe 💻", "Gaming Squad 🎮", "Travelers ✈️", "Rant Club 🚀"];

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Top Header */}
      <div className="sticky top-0 z-30 glass border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (step > 1) setStep((s) => (s - 1) as any);
              else navigate({ to: "/friends" });
            }}
            className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold bg-gradient-to-r from-primary to-pink-400 bg-clip-text text-transparent">
              Create Barkada Group
            </h1>
            <p className="text-xs text-muted-foreground">Step {step} of 3</p>
          </div>
        </div>

        {/* Wizard Step Indicators */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold transition ${
                step === s
                  ? "bg-primary text-white shadow-glow"
                  : step > s
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                  : "glass text-muted-foreground"
              }`}
            >
              {step > s ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-8">
        {/* STEP 1: GROUP INFORMATION */}
        {step === 1 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* Cover & Avatar Header */}
            <div className="relative rounded-2xl overflow-hidden glass border border-white/10 p-4">
              <div
                onClick={() => coverFileRef.current?.click()}
                className="h-28 rounded-xl bg-gradient-to-r from-purple-900/60 via-indigo-900/60 to-pink-900/60 relative cursor-pointer group flex items-center justify-center overflow-hidden border border-white/10"
              >
                {coverPreview ? (
                  <img src={coverPreview} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-white/70 group-hover:text-white transition">
                    <ImageIcon className="w-4 h-4" /> Upload Group Cover
                  </div>
                )}
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </div>

              {/* Avatar position */}
              <div className="flex justify-center -mt-10 mb-2">
                <button
                  onClick={() => avatarFileRef.current?.click()}
                  className="relative w-20 h-20 rounded-2xl bg-gradient-vivid grid place-items-center text-white border-4 border-background overflow-hidden group shadow-glow hover:scale-105 transition"
                >
                  {avatarPreview ? (
                    <img src={avatarPreview} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <Users2 className="w-8 h-8" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition grid place-items-center">
                    <Camera className="w-5 h-5 text-white" />
                  </div>
                </button>
                <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <p className="text-center text-xs text-muted-foreground">Click icon to set group profile photo</p>
            </div>

            {/* Group Name */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Group Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Barkada Squad 🤙"
                className="w-full rounded-xl bg-card border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary font-medium"
                maxLength={60}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {presets.map((p) => (
                  <button
                    key={p}
                    onClick={() => setName(p)}
                    className="text-xs px-2.5 py-1 rounded-full glass border border-border/40 hover:border-primary hover:text-primary transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Group Description */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                className="w-full rounded-xl bg-card border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                rows={3}
                maxLength={200}
              />
            </div>

            {/* Privacy Setting */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Privacy Setting</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPrivacy("private")}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    privacy === "private"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/40 glass text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Lock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Private</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Only added members can see group content and chat</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrivacy("invite_only")}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    privacy === "invite_only"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border/40 glass text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Shield className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-sm">Invite Only</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Members can invite friends with admin approval</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Next Step Button */}
            <button
              onClick={() => {
                if (!name.trim()) {
                  toast.error("Please enter a group name");
                  return;
                }
                setStep(2);
              }}
              className="w-full py-3.5 rounded-full bg-gradient-to-r from-primary to-pink-500 text-white font-bold shadow-glow hover:scale-105 transition flex items-center justify-center gap-2"
            >
              Continue to Add Members <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: ADD MEMBERS */}
        {step === 2 && (
          <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
            {/* Search Friends */}
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search friends to add..."
                className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl bg-card border border-border/40 outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Selected Members Bar */}
            {selectedIds.size > 0 && (
              <div className="glass rounded-xl p-3 border border-primary/30 space-y-2">
                <div className="text-xs font-semibold text-primary flex items-center justify-between">
                  <span>Selected Members ({selectedIds.size})</span>
                  <button onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-rose-400 text-[11px]">
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto scrollbar-none">
                  {selectedFriends.map((f: any) => (
                    <div key={f.friend?.id} className="flex items-center gap-1.5 bg-primary/20 text-primary border border-primary/30 rounded-full pl-1.5 pr-2 py-0.5 text-xs font-medium">
                      <div className="w-5 h-5 rounded-full bg-gradient-vivid grid place-items-center text-[10px] text-white font-bold overflow-hidden">
                        {f.friend?.avatar_url ? <img src={f.friend.avatar_url} className="w-full h-full object-cover" alt="" /> : f.friend?.username?.[0]?.toUpperCase()}
                      </div>
                      <span className="truncate max-w-[100px]">{f.friend?.display_name || f.friend?.username}</span>
                      <button onClick={() => removeMember(f.friend?.id)} className="hover:text-rose-400">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends Selection List */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Your Friends List
              </label>
              {!friendsLoaded ? (
                <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filteredFriends.length === 0 ? (
                <div className="glass rounded-xl p-8 text-center text-muted-foreground space-y-2">
                  <Users2 className="w-8 h-8 mx-auto opacity-40" />
                  <div className="text-sm font-medium">No friends available to add</div>
                  <div className="text-xs text-muted-foreground">Confirm friend requests first to invite them to groups.</div>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl border border-border/40 p-1">
                  {filteredFriends.map((f: any) => {
                    const friendId = f.friend?.id;
                    const selected = selectedIds.has(friendId);
                    return (
                      <button
                        key={f.friendship_id}
                        onClick={() => toggleMember(friendId)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition text-left ${
                          selected ? "bg-primary/15 border border-primary/40" : "hover:bg-card/60 border border-transparent"
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white text-sm font-bold overflow-hidden flex-shrink-0">
                          {f.friend?.avatar_url ? (
                            <img src={f.friend.avatar_url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            f.friend?.username?.[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate">{f.friend?.display_name || f.friend?.username}</div>
                          <div className="text-xs text-muted-foreground">@{f.friend?.username}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 grid place-items-center transition ${
                          selected ? "bg-primary border-primary text-white" : "border-border"
                        }`}>
                          {selected && <Check className="w-3 h-3" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-full glass border border-border/40 font-semibold text-sm hover:bg-card transition"
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (selectedIds.size === 0) {
                    toast.error("Please select at least 1 friend");
                    return;
                  }
                  setStep(3);
                }}
                className="flex-[2] py-3 rounded-full bg-gradient-to-r from-primary to-pink-500 text-white font-bold shadow-glow hover:scale-105 transition flex items-center justify-center gap-1.5 text-sm"
              >
                Preview Group <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: GROUP PREVIEW & SUBMIT */}
        {step === 3 && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="glass rounded-3xl p-6 border border-white/10 space-y-6 shadow-card">
              <h2 className="text-center font-display text-lg font-bold text-gradient">Group Preview</h2>

              {/* Card preview */}
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-card/60 p-4 space-y-4">
                {coverPreview && (
                  <div className="h-24 -mx-4 -mt-4 mb-2 overflow-hidden">
                    <img src={coverPreview} className="w-full h-full object-cover" alt="" />
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-vivid grid place-items-center text-white font-bold text-2xl overflow-hidden shadow-glow shrink-0">
                    {avatarPreview ? <img src={avatarPreview} className="w-full h-full object-cover" alt="" /> : name[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-lg text-foreground truncate">{name}</h3>
                    {description && <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 font-semibold flex items-center gap-1">
                        <Lock className="w-3 h-3" /> {privacy === "private" ? "Private Group" : "Invite Only"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedIds.size + 1} members total
                      </span>
                    </div>
                  </div>
                </div>

                {/* Member Preview List */}
                <div className="pt-3 border-t border-border/30">
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Member List ({selectedIds.size + 1})</div>
                  <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
                    {/* You (Owner) */}
                    <div className="flex flex-col items-center shrink-0 w-12 text-center">
                      <div className="w-10 h-10 rounded-full bg-primary grid place-items-center text-white text-xs font-bold ring-2 ring-primary">
                        You
                      </div>
                      <span className="text-[10px] text-primary font-bold mt-1">Owner</span>
                    </div>

                    {selectedFriends.map((f: any) => (
                      <div key={f.friend?.id} className="flex flex-col items-center shrink-0 w-12 text-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden">
                          {f.friend?.avatar_url ? <img src={f.friend.avatar_url} className="w-full h-full object-cover" alt="" /> : f.friend?.username?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-[10px] text-muted-foreground truncate w-full mt-1">@{f.friend?.username}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                disabled={loading}
                className="flex-1 py-3.5 rounded-full glass border border-border/40 font-semibold text-sm hover:bg-card transition"
              >
                Back to Members
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={loading}
                className="flex-[2] py-3.5 rounded-full bg-gradient-to-r from-primary to-pink-500 text-white font-bold shadow-glow hover:scale-105 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                {loading ? "Creating Group..." : "Create Group"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
