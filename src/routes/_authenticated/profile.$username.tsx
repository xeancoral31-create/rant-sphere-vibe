import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { toast } from "sonner";
import {
  MessageCircle,
  Settings,
  Calendar,
  MapPin,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Music,
  Sparkles,
  Bookmark,
  FileText,
  Edit3,
  X
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile/$username")({ component: ProfilePage });

type ProfileTab = "posts" | "photos" | "videos" | "music" | "notes" | "saved";

export function ProfilePage() {
  const { username } = useParams({ from: "/_authenticated/profile/$username" });
  const { user, profile: myProfile, refreshProfile } = useAuthContext();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostWithMeta[]>([]);
  const [following, setFollowing] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, totalLikes: 0 });
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editCover, setEditCover] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    load();
  }, [username, user?.id]);

  async function load() {
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    if (!p) {
      if (myProfile && (myProfile.username === username || user?.username === username)) {
        setProfile(myProfile);
      }
      return;
    }

    setProfile(p);
    setEditName(p.display_name || "");
    setEditBio(p.bio || "");
    setEditAvatar(p.avatar_url || "");
    setEditCover(p.cover_url || "");

    const [{ data: ps }, fc, gc, isFollowing, { data: saved }] = await Promise.all([
      supabase
        .from("posts")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("author_id", p.id)
        .order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      user
        ? supabase
            .from("follows")
            .select("*")
            .eq("follower_id", user.id)
            .eq("following_id", p.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user && user.id === p.id
        ? supabase
            .from("bookmarks" as never)
            .select("posts(*, profiles(username, display_name, avatar_url))")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    setPosts((ps ?? []) as PostWithMeta[]);
    setStats({
      followers: fc.count ?? 0,
      following: gc.count ?? 0,
      totalLikes: 0,
    });
    setFollowing(!!isFollowing.data);
    if (saved) {
      setSavedPosts((saved as any[]).map((s) => s.posts).filter(Boolean));
    }
  }

  async function toggleFollow() {
    if (!user || !profile) return toast.error("Please sign in");
    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      setFollowing(false);
      setStats((s) => ({ ...s, followers: Math.max(0, s.followers - 1) }));
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: profile.id });
      setFollowing(true);
      setStats((s) => ({ ...s, followers: s.followers + 1 }));
      await supabase
        .from("notifications")
        .insert({ user_id: profile.id, actor_id: user.id, type: "follow" });
      toast.success(`Followed @${profile.username}`);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: editName.trim() || null,
        bio: editBio.trim() || null,
        avatar_url: editAvatar.trim() || null,
        cover_url: editCover.trim() || null,
      })
      .eq("id", user.id);

    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated!");
    setEditModalOpen(false);
    refreshProfile();
    load();
  }

  if (!profile) {
    return (
      <div className="p-16 text-center text-muted-foreground">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-3" />
        Loading profile...
      </div>
    );
  }

  const isMe = user?.id === profile.id;

  // Filter posts based on active subtab
  const filteredPosts =
    activeTab === "saved"
      ? savedPosts
      : posts.filter((p) => {
          if (activeTab === "photos") return p.post_type === "image";
          if (activeTab === "videos") return p.post_type === "video";
          if (activeTab === "music") return p.post_type === "music";
          if (activeTab === "notes") return p.post_type === "note";
          return true; // "posts" tab includes all
        });

  return (
    <div className="max-w-4xl mx-auto pb-16">
      {/* Cover Photo Banner */}
      <div className="h-48 sm:h-64 bg-gradient-vivid relative overflow-hidden">
        {profile.cover_url ? (
          <img src={profile.cover_url} className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-purple-900/60 via-pink-600/40 to-indigo-900/60" />
        )}
      </div>

      <div className="px-4 sm:px-6 -mt-16 sm:-mt-20">
        {/* Avatar & Action Button Row */}
        <div className="flex items-end justify-between">
          <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-background bg-gradient-vivid grid place-items-center text-white font-bold text-4xl overflow-hidden shadow-2xl">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              profile.username?.[0]?.toUpperCase() || "U"
            )}
          </div>

          <div className="flex items-center gap-2">
            {isMe ? (
              <button
                onClick={() => setEditModalOpen(true)}
                className="glass rounded-full px-5 py-2 text-xs font-semibold hover:border-primary/50 transition flex items-center gap-1.5 shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <Link
                  to="/messages"
                  className="glass rounded-full px-4 py-2 text-xs font-semibold hover:bg-muted transition flex items-center gap-1.5 shadow-sm"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Message</span>
                </Link>
                <button
                  onClick={toggleFollow}
                  className={`rounded-full px-6 py-2 text-xs font-semibold transition ${
                    following
                      ? "glass hover:bg-destructive/20 hover:text-destructive"
                      : "bg-gradient-vivid text-white shadow-glow hover:scale-105"
                  }`}
                >
                  {following ? "Following" : "Follow"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profile Info Header */}
        <div className="mt-4 space-y-3">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
              {profile.display_name || profile.username}
            </h1>
            <div className="text-sm text-muted-foreground">@{profile.username}</div>
          </div>

          {profile.bio && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed max-w-2xl">
              {profile.bio}
            </p>
          )}

          {/* Followers & Following Stats */}
          <div className="flex items-center gap-6 text-sm pt-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{stats.followers}</span>
              <span className="text-muted-foreground">Followers</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{stats.following}</span>
              <span className="text-muted-foreground">Following</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{posts.length}</span>
              <span className="text-muted-foreground">Rants</span>
            </div>
          </div>
        </div>

        {/* Sub-Tabs: Posts | Photos | Videos | Music | Notes | Saved */}
        <div className="mt-8 border-b border-border/40 flex items-center gap-1 sm:gap-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setActiveTab("posts")}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "posts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Posts
          </button>
          <button
            onClick={() => setActiveTab("photos")}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "photos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Photos
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "videos"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Video className="w-3.5 h-3.5" /> Videos
          </button>
          <button
            onClick={() => setActiveTab("music")}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "music"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Music className="w-3.5 h-3.5" /> Music
          </button>
          <button
            onClick={() => setActiveTab("notes")}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "notes"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Notes
          </button>
          {isMe && (
            <button
              onClick={() => setActiveTab("saved")}
              className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
                activeTab === "saved"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" /> Saved
            </button>
          )}
        </div>

        {/* Tab Content List */}
        <div className="mt-6 space-y-4">
          {filteredPosts.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center border border-border/40 shadow-card space-y-2">
              <Sparkles className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="font-display font-semibold text-base">No {activeTab} yet</h3>
              <p className="text-xs text-muted-foreground">
                {isMe ? "Share something in this category!" : `@${profile.username} hasn't posted any ${activeTab} yet.`}
              </p>
            </div>
          ) : (
            filteredPosts.map((p) => (
              <PostCard key={p.id} post={p} onChange={load} />
            ))
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setEditModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-card border border-border/60 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h2 className="font-display text-xl font-bold">Edit Profile</h2>
              <button onClick={() => setEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Display Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your full name"
                  className="w-full bg-input border border-border/40 rounded-xl px-3.5 py-2 text-sm outline-none mt-1 focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Bio</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  placeholder="Tell the sphere about yourself..."
                  rows={3}
                  maxLength={160}
                  className="w-full bg-input border border-border/40 rounded-xl p-3 text-sm outline-none mt-1 focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Avatar Image URL</label>
                <input
                  type="url"
                  value={editAvatar}
                  onChange={(e) => setEditAvatar(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-input border border-border/40 rounded-xl px-3.5 py-2 text-sm outline-none mt-1 focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">Cover Banner URL</label>
                <input
                  type="url"
                  value={editCover}
                  onChange={(e) => setEditCover(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-input border border-border/40 rounded-xl px-3.5 py-2 text-sm outline-none mt-1 focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-gradient-vivid px-6 py-2 text-xs font-semibold text-white shadow-glow hover:scale-105 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
