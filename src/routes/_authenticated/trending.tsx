import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { TrendingUp, Hash } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trending")({ component: Trending });

function Trending() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([]);

  useEffect(() => {
    supabase.from("posts").select("*, profiles(username, display_name, avatar_url)").eq("is_hidden", false)
      .order("created_at", { ascending: false }).limit(30)
      .then(({ data }) => setPosts((data ?? []) as PostWithMeta[]));

    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase.from("post_hashtags").select("hashtag_id, posts!inner(created_at)").gte("posts.created_at", since).limit(500);
      const map: Record<string, number> = {};
      (recent ?? []).forEach((r: { hashtag_id: string }) => { map[r.hashtag_id] = (map[r.hashtag_id] ?? 0) + 1; });
      const top = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (top.length === 0) return;
      const { data: tagRows } = await supabase.from("hashtags").select("id, tag").in("id", top.map(t => t[0]));
      setTags(top.map(([id, count]) => ({ tag: (tagRows ?? []).find(r => r.id === id)?.tag ?? "", count })).filter(t => t.tag));
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="w-7 h-7 text-primary" />
        <h1 className="font-display text-3xl font-bold">Trending now</h1>
      </div>
      {tags.length > 0 && (
        <div className="glass rounded-3xl p-5">
          <div className="font-semibold mb-3 text-sm text-muted-foreground">HOT TAGS · LAST 24H</div>
          <div className="flex gap-2 flex-wrap">
            {tags.map(t => (
              <Link key={t.tag} to="/tag/$tag" params={{ tag: t.tag }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-card hover:bg-primary/10 hover:text-primary transition text-sm">
                <Hash className="w-3.5 h-3.5" />{t.tag}<span className="text-xs text-muted-foreground">· {t.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
