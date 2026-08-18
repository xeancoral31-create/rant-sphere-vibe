import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/search")({ component: SearchPage });

function SearchPage() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  useEffect(() => {
    if (q.length < 2) return setUsers([]);
    supabase.from("profiles").select("*").or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20).then(({ data }) => setUsers(data ?? []));
  }, [q]);
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="font-display text-3xl font-bold mb-4">Search</h1>
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find users..." className="w-full rounded-xl bg-input border border-border px-4 py-3 outline-none focus:ring-2 focus:ring-primary" />
      <div className="mt-6 space-y-2">
        {users.map((u) => (
          <Link key={u.id} to="/profile/$username" params={{ username: u.username }} className="flex items-center gap-3 p-3 glass rounded-2xl hover:border-primary/40">
            <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
              {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.username[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-semibold">{u.display_name || u.username}</div>
              <div className="text-xs text-muted-foreground">@{u.username}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
