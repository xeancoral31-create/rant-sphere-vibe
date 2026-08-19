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
  X,
  Clapperboard,
  UserPlus,
  UserCheck,
  Clock,
  Users
} from "lucide-react";
import { SEED_POSTS, DEMO_REELS } from "@/lib/seedData";

export const Route = createFileRoute("/_authenticated/profile/$username")({ component: ProfilePage });

type ProfileTab = "posts" | "photos" | "videos" | "reels" | "music" | "notes" | "saved";

export function ProfilePage() {
  const { username } = useParams({ from: "/_authenticated/profile/$username" });
  const { user, profile: myProfile, refreshProfile } = useAuthContext();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [savedPosts, setSavedPosts] = useState<PostWithMeta[]>([]);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [stats, setStats] = useState({ followers: 0, following: 0, postsCount: 0 });
  const [activeTab, setActiveTab] = useState<ProfileTab>("posts");
  const [friendStatus, setFriendStatus] = useState<"none" | "sent" | "friends">("none");

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);

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
    // 1. Fetch user profile
    const { data: p } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();

    let currentProf = p;
    if (!currentProf) {
      if (myProfile && (myProfile.username === username || user?.username === username)) {
        currentProf = myProfile;
      } else {
        // Fallback for seed creator profiles
        const seedPost = SEED_POSTS.find(sp => sp.profiles?.username === username);
        if (seedPost && seedPost.profiles) {
          currentProf = {
            id: seedPost.author_id,
            username: seedPost.profiles.username,
            display_name: seedPost.profiles.display_name,
            avatar_url: seedPost.profiles.avatar_url,
            bio: "Creating aesthetics and sharing thoughts in RantSphere ✨",
            cover_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop",
          };
        }
      }
    }

    if (!currentProf) return;
    setProfile(currentProf);
    setEditName(currentProf.display_name || "");
    setEditBio(currentProf.bio || "");
    setEditAvatar(currentProf.avatar_url || "");
    setEditCover(currentProf.cover_url || "");

    // 2. Fetch posts by this author ONLY (Strict ownership filter)
    const [{ data: ps }, { data: followersData }, { data: followingData }, isFollowing, { data: saved }] = await Promise.all([
      supabase
        .from("posts")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("author_id", currentProf.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("follows")
        .select("follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
        .eq("following_id", currentProf.id),
      supabase
        .from("follows")
        .select("following:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
        .eq("follower_id", currentProf.id),
      user
        ? supabase
            .from("follows")
            .select("*")
            .eq("follower_id", user.id)
            .eq("following_id", currentProf.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user && user.id === currentProf.id
        ? supabase
            .from("bookmarks" as never)
            .select("posts(*, profiles(username, display_name, avatar_url))")
            .eq("user_id", user.id)
        : Promise.resolve({ data: [] }),
    ]);

    let userOwnedPosts = (ps ?? []) as PostWithMeta[];
    // If it's a seed profile, pull its matching seed posts
    if (userOwnedPosts.length === 0) {
      userOwnedPosts = SEED_POSTS.filter(sp => sp.profiles?.username === username);
    }

    setPosts(userOwnedPosts);
    const fList = (followersData ?? []).map((f: any) => f.follower).filter(Boolean);
    const gList = (followingData ?? []).map((f: any) => f.following).filter(Boolean);
    setFollowersList(fList);
    setFollowingList(gList);

    setStats({
      followers: fList.length || (username === "cyber_nova" ? 1420 : username === "lofi_dreamer" ? 890 : 0),
      following: gList.length || (username === "cyber_nova" ? 312 : username === "lofi_dreamer" ? 210 : 0),
      postsCount: userOwnedPosts.length,
    });

    if (isFollowing?.data) {
      setFriendStatus("friends");
    } else {
      setFriendStatus("none");
    }

    if (saved) {
      setSavedPosts((saved as any[]).map((s) => s.posts).filter(Boolean));
    }
  }

  async function handleAddFriend() {
    if (!user || !profile) return toast.error("Please sign in");
    if (friendStatus === "friends") {
      // Unfriend
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", profile.id);
      setFriendStatus("none");
      setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }));
      toast.success(`Removed @${profile.username} from friends`);
    } else if (friendStatus === "none") {
      // Send friend request
      setFriendStatus("sent");
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, following_id: profile.id });
      await supabase
        .from("notifications")
        .insert({
          user_id: profile.id,
          actor_id: user.id,
          type: "follow" as never,
        });
      setStats(s => ({ ...s, followers: s.followers + 1 }));
      toast.success(`Friend request sent to @${profile.username}!`);
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

  // Strict ownership filtering for each sub-tab
  const filteredPosts =
    activeTab === "saved"
      ? savedPosts
      : posts.filter((p) => {
          if (activeTab === "photos") return p.post_type === "image";
          if (activeTab === "videos") return p.post_type === "video";
          if (activeTab === "reels") return p.post_type === "video" || p.media_url?.includes(".mp4");
          if (activeTab === "music") return p.post_type === "music" || p.media_url?.includes("audio");
          if (activeTab === "notes") return p.post_type === "note";
          return true; // "posts" tab
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

                {/* Add Friend / Request Sent / Friends Button */}
                <button
                  onClick={handleAddFriend}
                  className={`rounded-full px-5 py-2 text-xs font-semibold transition flex items-center gap-1.5 ${
                    friendStatus === "friends"
                      ? "glass text-foreground hover:bg-destructive/20 hover:text-destructive"
                      : friendStatus === "sent"
                      ? "bg-muted text-muted-foreground cursor-default"
                      : "bg-gradient-vivid text-white shadow-glow hover:scale-105"
                  }`}
                >
                  {friendStatus === "friends" ? (
                    <>
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Friends</span>
                    </>
                  ) : friendStatus === "sent" ? (
                    <>
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Request Sent</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Add Friend</span>
                    </>
                  )}
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

          {/* Clickable Followers & Following Stats */}
          <div className="flex items-center gap-6 text-sm pt-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground">{stats.postsCount}</span>
              <span className="text-muted-foreground">Posts</span>
            </div>
            <button
              onClick={() => setFollowersModalOpen(true)}
              className="flex items-center gap-1.5 hover:text-primary transition"
            >
              <span className="font-bold text-foreground">{stats.followers}</span>
              <span className="text-muted-foreground">Followers</span>
            </button>
            <button
              onClick={() => setFollowingModalOpen(true)}
              className="flex items-center gap-1.5 hover:text-primary transition"
            >
              <span className="font-bold text-foreground">{stats.following}</span>
              <span className="text-muted-foreground">Following</span>
            </button>
          </div>
        </div>

        {/* Strict Sub-Tabs: Posts | Photos | Videos | Reels | Music | Notes | Saved */}
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
            onClick={() => setActiveTab("reels")}
            className={`px-3 sm:px-4 py-2.5 text-xs font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === "reels"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clapperboard className="w-3.5 h-3.5" /> Reels
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
                {isMe ? `You haven't posted any ${activeTab} yet.` : `@${profile.username} hasn't posted any ${activeTab} yet.`}
              </p>
            </div>
          ) : (
            filteredPosts.map((p) => (
              <PostCard key={p.id} post={p} onChange={load} />
            ))
          )}
        </div>
      </div>

      {/* Followers Modal */}
      {followersModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFollowersModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border/60 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Followers ({followersList.length})</span>
              </h3>
              <button onClick={() => setFollowersModalOpen(false)} className="text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {followersList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No followers yet.</div>
              ) : (
                followersList.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/40 transition">
                    <Link
                      to="/profile/$username"
                      params={{ username: f.username }}
                      onClick={() => setFollowersModalOpen(false)}
                      className="flex items-center gap-2.5"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden">
                        {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : f.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{f.display_name || f.username}</div>
                        <div className="text-[10px] text-muted-foreground">@{f.username}</div>
                      </div>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Following Modal */}
      {followingModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setFollowingModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-card border border-border/60 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-3">
              <h3 className="font-display font-bold text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Following ({followingList.length})</span>
              </h3>
              <button onClick={() => setFollowingModalOpen(false)} className="text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {followingList.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">Not following anyone yet.</div>
              ) : (
                followingList.map((f) => (
                  <div key={f.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/40 transition">
                    <Link
                      to="/profile/$username"
                      params={{ username: f.username }}
                      onClick={() => setFollowingModalOpen(false)}
                      className="flex items-center gap-2.5"
                    >
                      <div className="w-9 h-9 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden">
                        {f.avatar_url ? <img src={f.avatar_url} className="w-full h-full object-cover" /> : f.username?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{f.display_name || f.username}</div>
                        <div className="text-[10px] text-muted-foreground">@{f.username}</div>
                      </div>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

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
