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
import {
  getFriendRequestStatus,
  sendFriendRequest,
  cancelFriendRequestByUser,
  acceptFriendRequest,
  removeFriend,
  getMutualFriendsCountMap,
  getUserByUsername
} from "@/lib/friends-api";
import { EditProfileModal } from "@/components/profile/EditProfileModal";

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
  const [friendStatus, setFriendStatus] = useState<"none" | "sent" | "received" | "friends">("none");
  const [mutualCount, setMutualCount] = useState<number>(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);

  useEffect(() => {
    load();
  }, [username, user?.id]);

  async function load() {
    // 1. Fetch user profile
    let currentProf: any = null;
    try {
      const { data: p } = await (supabase
        .from("profiles") as any)
        .select("*")
        .eq("username", username)
        .maybeSingle();
      if (p) currentProf = p;
    } catch {}

    if (!currentProf) {
      currentProf = await getUserByUsername(username);
    }

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
            bio: "Creating aesthetics and sharing thoughts in OutLoud ✨",
            cover_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&h=400&fit=crop",
          };
        }
      }
    }

    if (!currentProf) return;
    setProfile(currentProf);

    // 2. Fetch posts by this author ONLY (Strict ownership filter)
    const [{ data: ps }, { data: followersData }, { data: followingData }, isFollowing, { data: saved }] = await Promise.all([
      (supabase
        .from("posts") as any)
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("author_id", currentProf.id)
        .order("created_at", { ascending: false }),
      (supabase
        .from("follows") as any)
        .select("follower:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
        .eq("following_id", currentProf.id),
      (supabase
        .from("follows") as any)
        .select("following:profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
        .eq("follower_id", currentProf.id),
      user
        ? (supabase
            .from("follows") as any)
            .select("*")
            .eq("follower_id", user.id)
            .eq("following_id", currentProf.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      user && user.id === currentProf.id
        ? (supabase
            .from("bookmarks" as never) as any)
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

    if (user && currentProf.id !== user.id) {
      try {
        const [status, mutualMap] = await Promise.all([
          getFriendRequestStatus(user.id, currentProf.id),
          getMutualFriendsCountMap(user.id, [currentProf.id]),
        ]);
        setFriendStatus(status);
        setMutualCount(mutualMap[currentProf.id] ?? 0);
      } catch (err) {
        console.error("Error loading friendship status:", err);
      }
    } else {
      setFriendStatus("none");
      setMutualCount(0);
    }

    if (saved) {
      setSavedPosts((saved as any[]).map((s) => s.posts).filter(Boolean));
    }
  }

  async function handleAddFriend() {
    if (!user || !profile) return toast.error("Please sign in");
    if (actionLoading) return;
    setActionLoading(true);

    try {
      if (friendStatus === "friends") {
        if (!confirm(`Are you sure you want to remove @${profile.username} from your friends?`)) {
          setActionLoading(false);
          return;
        }
        await removeFriend(user.id, profile.id);
        setFriendStatus("none");
        toast.info(`Removed @${profile.username} from friends`);
      } else if (friendStatus === "sent") {
        await cancelFriendRequestByUser(user.id, profile.id);
        setFriendStatus("none");
        toast.info(`Cancelled friend request to @${profile.username}`);
      } else if (friendStatus === "received") {
        await acceptFriendRequest("", profile.id, user.id);
        setFriendStatus("friends");
        toast.success(`You and @${profile.username} are now friends! 🎉`);
      } else {
        await sendFriendRequest(user.id, profile.id);
        setFriendStatus("sent");
        toast.success(`Friend request sent to @${profile.username}!`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update friendship status. Please try again.");
    } finally {
      setActionLoading(false);
    }
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
    <div className="max-w-4xl mx-auto pb-16 pt-4 md:pt-8 px-4 sm:px-6">
      {/* Profile Header Card */}
      <div className="glass rounded-3xl p-6 md:p-10 shadow-2xl border border-white/10 backdrop-blur-xl mb-8 relative overflow-hidden bg-card/40 hover:bg-card/50 transition-colors duration-500">
        {/* Cover Photo / Background */}
        {profile.cover_url ? (
          <div className="absolute inset-0 z-0">
            <img src={profile.cover_url} alt="Profile cover" className="w-full h-full object-cover opacity-25" />
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/85 to-transparent" />
          </div>
        ) : (
          <>
            {/* Abstract background blobs for aesthetics */}
            <div className="absolute -top-32 -right-32 w-80 h-80 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-pink-500/20 rounded-full blur-[100px] pointer-events-none" />
          </>
        )}
        
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
          {/* Avatar */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background/50 bg-gradient-vivid grid place-items-center text-white font-bold text-5xl overflow-hidden shadow-2xl shrink-0 ring-4 ring-primary/20 ring-offset-4 ring-offset-background/50">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              profile.username?.[0]?.toUpperCase() || "U"
            )}
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left mt-2 md:mt-0 w-full">
            <h1 className="font-display text-3xl md:text-4xl font-bold bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent tracking-tight">
              {profile.display_name || profile.username}
            </h1>
            <div className="text-sm font-medium text-primary mt-1">@{profile.username}</div>
            
            {profile.bio && (
              <p className="text-sm text-foreground/80 mt-4 leading-relaxed max-w-lg mx-auto md:mx-0">
                {profile.bio}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center justify-center md:justify-start gap-10 mt-8 bg-black/20 p-4 rounded-2xl border border-white/5 inline-flex w-full md:w-auto">
              <div className="flex flex-col items-center">
                <span className="font-display font-bold text-2xl text-foreground drop-shadow-sm">{stats.postsCount}</span>
                <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mt-1">Posts</span>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <button onClick={() => setFollowersModalOpen(true)} className="flex flex-col items-center hover:scale-105 transition-transform">
                <span className="font-display font-bold text-2xl text-foreground drop-shadow-sm">{stats.followers}</span>
                <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mt-1">Followers</span>
              </button>
              <div className="w-px h-8 bg-white/10" />
              <button onClick={() => setFollowingModalOpen(true)} className="flex flex-col items-center hover:scale-105 transition-transform">
                <span className="font-display font-bold text-2xl text-foreground drop-shadow-sm">{stats.following}</span>
                <span className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mt-1">Following</span>
              </button>
            </div>
          </div>

            {/* Action Buttons */}
          <div className="flex flex-row md:flex-col gap-3 w-full md:w-36 mt-6 md:mt-0 shrink-0">
            {isMe ? (
              <button
                onClick={() => setEditModalOpen(true)}
                className="w-full rounded-full bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm backdrop-blur-md"
              >
                <Edit3 className="w-4 h-4" /> Edit Profile
              </button>
            ) : (
              <>
                <Link
                  to="/messages"
                  className="w-full rounded-full bg-white/5 hover:bg-white/10 border border-white/10 py-3 text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-sm backdrop-blur-md flex-1 md:flex-none"
                >
                  <MessageCircle className="w-4 h-4" /> Message
                </Link>
                <button
                  onClick={handleAddFriend}
                  disabled={actionLoading}
                  className={`w-full rounded-full py-3 text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-lg backdrop-blur-md flex-1 md:flex-none ${
                    friendStatus === "friends"
                      ? "bg-emerald-500/15 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400 border border-emerald-500/30"
                      : friendStatus === "sent"
                      ? "bg-amber-500/15 text-amber-300 hover:bg-rose-500/20 hover:text-rose-300 border border-amber-500/30"
                      : friendStatus === "received"
                      ? "bg-gradient-vivid text-white shadow-glow hover:scale-105"
                      : "bg-gradient-vivid text-white shadow-glow hover:scale-105 hover:shadow-xl border-0"
                  }`}
                  title={friendStatus === "sent" ? "Click to cancel request" : friendStatus === "friends" ? "Click to unfriend" : undefined}
                >
                  {friendStatus === "friends" ? (
                    <><UserCheck className="w-4 h-4" /> Friends</>
                  ) : friendStatus === "sent" ? (
                    <><Clock className="w-4 h-4" /> Request Sent</>
                  ) : friendStatus === "received" ? (
                    <><UserCheck className="w-4 h-4" /> Confirm Request</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Add Friend</>
                  )}
                </button>
              </>
            )}
          </div>
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
      {isMe && profile && (
        <EditProfileModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          initialProfile={{
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            bio: profile.bio,
            avatar_url: profile.avatar_url,
            cover_url: profile.cover_url,
          }}
          onProfileUpdated={(updated) => {
            setProfile((prev: any) => ({
              ...prev,
              ...updated,
            }));
            load();
          }}
        />
      )}
    </div>
  );
}
