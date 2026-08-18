import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";
import { StoryRail } from "@/components/story/StoryRail";

export const Route = createFileRoute("/_authenticated/home")({ component: HomePage });

function HomePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const ch = supabase.channel("posts-feed").on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const { data } = await supabase.from("posts").select("*, profiles(username, display_name, avatar_url)").eq("is_hidden", false).order("created_at", { ascending: false }).limit(50);
    setPosts((data ?? []) as PostWithMeta[]);
    setLoading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-4">
      <header className="sticky top-0 z-30 -mx-4 md:-mx-6 px-4 md:px-6 py-3 glass border-b border-border/40">
        <h1 className="font-display text-2xl font-bold">Home</h1>
      </header>
      <StoryRail />
      {loading ? (
        <div className="grid place-items-center py-12"><div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">No rants yet. Be the first to shout into the sphere.</p>
        </div>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChange={load} />)
      )}
    </div>
  );
}
