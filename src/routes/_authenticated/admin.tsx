import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Users, FileText, Flag, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPage });

interface FlaggedPost {
  id: string;
  content: string | null;
  ai_score: number | null;
  ai_flags: Record<string, unknown> | null;
  is_hidden: boolean;
  author_id: string;
  created_at: string;
  profiles?: { username: string } | null;
}

function AdminPage() {
  const { user } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0, stories: 0 });
  const [reports, setReports] = useState<{ id: string; target_type: string; reason: string; status: string; created_at: string }[]>([]);
  const [flagged, setFlagged] = useState<FlaggedPost[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("*").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => {
      setIsAdmin(!!data);
      if (data) load();
    });
  }, [user?.id]);

  async function load() {
    const [u, p, r, s, rep, fl] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("stories").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("posts").select("id, content, ai_score, ai_flags, is_hidden, author_id, created_at, profiles(username)")
        .not("ai_score", "is", null).gte("ai_score", 0.5).order("ai_score", { ascending: false }).limit(20),
    ]);
    setStats({ users: u.count ?? 0, posts: p.count ?? 0, reports: r.count ?? 0, stories: s.count ?? 0 });
    setReports((rep.data as never) ?? []);
    setFlagged((fl.data as never) ?? []);
  }

  async function resolveReport(id: string) {
    await supabase.from("reports").update({ status: "resolved" as never }).eq("id", id);
    toast.success("Report resolved"); load();
  }
  async function removePost(id: string) {
    if (!confirm("Permanently delete this post?")) return;
    await supabase.from("posts").delete().eq("id", id);
    toast.success("Removed"); load();
  }
  async function approvePost(id: string) {
    await supabase.from("posts").update({ is_hidden: false, ai_score: null } as never).eq("id", id);
    toast.success("Approved"); load();
  }

  if (isAdmin === null) return <div className="p-12 text-center">Checking access...</div>;
  if (!isAdmin) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="font-display text-2xl font-bold">Admin only</h1>
      <p className="mt-2 text-muted-foreground text-sm">Ask an admin to grant you the role.</p>
    </div>
  );

  const cards = [
    { icon: Users, label: "Users", value: stats.users, color: "bg-primary/20 text-primary" },
    { icon: FileText, label: "Posts", value: stats.posts, color: "bg-accent/20 text-accent" },
    { icon: Activity, label: "Active stories", value: stats.stories, color: "bg-violet/20" },
    { icon: Flag, label: "Pending reports", value: stats.reports, color: "bg-destructive/20 text-destructive" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="font-display text-3xl font-bold mb-6">Admin dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-3xl p-5">
            <div className={`w-10 h-10 rounded-xl grid place-items-center ${c.color}`}><c.icon className="w-5 h-5" /></div>
            <div className="mt-3 font-display text-3xl font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-2xl font-bold mt-10 mb-4 flex items-center gap-2">
        <AlertTriangle className="w-6 h-6 text-destructive" /> AI flag queue
      </h2>
      <div className="glass rounded-3xl divide-y divide-border">
        {flagged.length === 0 && <div className="p-8 text-center text-muted-foreground">Nothing flagged. The sphere is calm.</div>}
        {flagged.map((p) => (
          <div key={p.id} className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-semibold">@{p.profiles?.username ?? "unknown"}</span>
              <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${(p.ai_score ?? 0) >= 0.75 ? "bg-destructive/20 text-destructive" : "bg-yellow-500/20 text-yellow-500"}`}>
                score {p.ai_score?.toFixed(2)}
              </span>
              {p.is_hidden && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">hidden</span>}
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">{p.content}</div>
            {p.ai_flags && (
              <div className="text-xs text-muted-foreground italic">{String((p.ai_flags as { reasoning?: string }).reasoning ?? "")}</div>
            )}
            <div className="flex gap-2">
              <button onClick={() => approvePost(p.id)} className="text-xs rounded-full bg-card px-3 py-1 hover:bg-primary/20">Approve</button>
              <button onClick={() => removePost(p.id)} className="text-xs rounded-full bg-destructive/80 text-white px-3 py-1">Remove</button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-2xl font-bold mt-10 mb-4">User reports</h2>
      <div className="glass rounded-3xl divide-y divide-border">
        {reports.length === 0 && <div className="p-8 text-center text-muted-foreground">No reports</div>}
        {reports.map((r) => (
          <div key={r.id} className="p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-medium">{r.target_type} — <span className="text-muted-foreground">{r.reason}</span></div>
              <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full ${r.status === "pending" ? "bg-destructive/20 text-destructive" : "bg-muted"}`}>{r.status}</span>
            {r.status === "pending" && <button onClick={() => resolveReport(r.id)} className="text-xs rounded-full bg-gradient-vivid px-3 py-1 text-white font-semibold">Resolve</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
