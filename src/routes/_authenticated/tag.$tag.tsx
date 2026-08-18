import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { Hash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tag/$tag")({ component: TagPage });

function TagPage() {
  const { tag } = Route.useParams();
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [tab, setTab] = useState<"top" | "latest" | "media">("latest");
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [tag, tab]);

  async function load() {
    setLoading(true);
    const { data: tagRow } = await supabase.from("hashtags").select("id").eq("tag", tag.toLowerCase()).maybeSingle();
    if (!tagRow) { setPosts([]); setLoading(false); return; }
    const { data: links } = await supabase.from("post_hashtags").select("post_id").eq("hashtag_id", tagRow.id);
    const ids = (links ?? []).map(l => l.post_id);
    if (ids.length === 0) { setPosts([]); setLoading(false); return; }
    let q = supabase.from("posts").select("*, profiles(username, display_name, avatar_url)").in("id", ids).eq("is_hidden", false);
    if (tab === "media") q = q.not("media_url", "is", null);
    q = q.order("created_at", { ascending: false }).limit(50);
    const { data } = await q;
    let list = (data ?? []) as PostWithMeta[];
    if (tab === "top") {
      // Sort by recency for now; could fetch reaction counts
      list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    setPosts(list);
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-vivid grid place-items-center text-white">
            <Hash className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">#{tag}</h1>
            <p className="text-sm text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""} in the sphere</p>
          </div>
        </div>
      </div>
      <div className="flex gap-2 border-b border-border">
        {(["latest", "top", "media"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            {t}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="grid place-items-center py-12"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted-foreground">
          No posts tagged <span className="text-primary">#{tag}</span> yet. <Link to="/home" className="text-primary hover:underline">Be the first.</Link>
        </div>
      ) : posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)}
    </div>
  );
}
