import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostWithMeta } from "@/components/post/PostCard";

export const Route = createFileRoute("/_authenticated/explore")({ component: ExplorePage });

function ExplorePage() {
  const [posts, setPosts] = useState<PostWithMeta[]>([]);
  useEffect(() => {
    supabase.from("posts").select("*, profiles(username, display_name, avatar_url)").not("media_url", "is", null).order("created_at", { ascending: false }).limit(60).then(({ data }) => setPosts((data ?? []) as PostWithMeta[]));
  }, []);
  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <h1 className="font-display text-3xl font-bold mb-6">Explore</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {posts.map((p) => (
          <div key={p.id} className="aspect-square rounded-2xl overflow-hidden glass hover:scale-[1.02] transition cursor-pointer">
            {p.media_url && <img src={p.media_url} className="w-full h-full object-cover" />}
          </div>
        ))}
      </div>
    </div>
  );
}
