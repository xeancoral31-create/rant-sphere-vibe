import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile/$username")({ component: ProfilePage });

function ProfilePage() {
  const { username } = useParams({ from: "/_authenticated/profile/$username" });
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [following, setFollowing] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0 });

  useEffect(() => { load(); }, [username, user?.id]);

  async function load() {
    const { data: p } = await supabase.from("profiles").select("*").eq("username", username).maybeSingle();
    if (!p) return;
    setProfile(p);
    const [{ data: ps }, fc, gc, isFollowing] = await Promise.all([
      supabase.from("posts").select("*, profiles(username, display_name, avatar_url)").eq("author_id", p.id).order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", p.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", p.id),
      user ? supabase.from("follows").select("*").eq("follower_id", user.id).eq("following_id", p.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    setPosts((ps ?? []) as PostWithMeta[]);
    setStats({ followers: fc.count ?? 0, following: gc.count ?? 0 });
    setFollowing(!!isFollowing.data);
  }

  async function toggleFollow() {
    if (!user || !profile) return;
    if (following) {
      await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profile.id);
      setFollowing(false); setStats((s) => ({ ...s, followers: s.followers - 1 }));
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.id });
      setFollowing(true); setStats((s) => ({ ...s, followers: s.followers + 1 }));
      await supabase.from("notifications").insert({ user_id: profile.id, actor_id: user.id, type: "follow" });
      toast.success(`Now following @${profile.username}`);
    }
  }

  if (!profile) return <div className="p-12 text-center text-muted-foreground">Loading...</div>;

  const isMe = user?.id === profile.id;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="h-48 md:h-64 bg-gradient-vivid relative">
        {profile.cover_url && <img src={profile.cover_url} className="w-full h-full object-cover" />}
      </div>
      <div className="px-6 -mt-16">
        <div className="flex items-end justify-between">
          <div className="w-32 h-32 rounded-full border-4 border-background bg-gradient-vivid grid place-items-center text-white font-bold text-4xl overflow-hidden">
            {profile.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile.username[0]?.toUpperCase()}
          </div>
          {!isMe && (
            <button onClick={toggleFollow} className={`rounded-full px-6 py-2 font-semibold transition ${following ? "glass" : "bg-gradient-vivid text-white shadow-glow"}`}>
              {following ? "Following" : "Follow"}
            </button>
          )}
        </div>
        <div className="mt-4">
          <h1 className="font-display text-3xl font-bold">{profile.display_name || profile.username}</h1>
          <div className="text-muted-foreground">@{profile.username}</div>
          {profile.bio && <p className="mt-3">{profile.bio}</p>}
          <div className="mt-4 flex gap-6 text-sm">
            <div><span className="font-bold">{stats.followers}</span> <span className="text-muted-foreground">Followers</span></div>
            <div><span className="font-bold">{stats.following}</span> <span className="text-muted-foreground">Following</span></div>
            <div><span className="font-bold">{posts.length}</span> <span className="text-muted-foreground">Rants</span></div>
          </div>
        </div>
        <div className="mt-8 space-y-4 pb-12">
          {posts.length === 0 ? <div className="glass rounded-3xl p-12 text-center text-muted-foreground">No rants yet.</div> : posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)}
        </div>
      </div>
    </div>
  );
}
