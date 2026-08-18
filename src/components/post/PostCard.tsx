import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Repeat2, Share2, MoreHorizontal, EyeOff, Bookmark, Flag, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const REACTIONS = ["like", "love", "laugh", "wow", "sad", "fire"] as const;
const EMOJI: Record<string, string> = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", sad: "😢", fire: "🔥" };

export interface PostWithMeta {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  post_type: string;
  is_anonymous: boolean;
  is_hidden?: boolean;
  poll_options?: { text: string }[] | null;
  reposted_from?: string | null;
  created_at: string;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

function renderContent(text: string) {
  return text.split(/(\s+)/).map((part, i) => {
    if (/^#[A-Za-z0-9_]{2,40}$/.test(part)) {
      const tag = part.slice(1).toLowerCase();
      return <Link key={i} to="/tag/$tag" params={{ tag }} className="text-primary hover:underline">{part}</Link>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostCard({ post, onChange }: { post: PostWithMeta; onChange?: () => void }) {
  const { user } = useAuthContext();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [comments, setComments] = useState(0);
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [original, setOriginal] = useState<PostWithMeta | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => { loadCounts(); }, [post.id, user?.id]);
  useEffect(() => {
    if (post.reposted_from) {
      supabase.from("posts").select("*, profiles(username, display_name, avatar_url)").eq("id", post.reposted_from).maybeSingle()
        .then(({ data }) => setOriginal(data as PostWithMeta | null));
    }
  }, [post.reposted_from]);

  async function loadCounts() {
    const [r, c, mine, bm, rep] = await Promise.all([
      supabase.from("reactions").select("reaction").eq("post_id", post.id),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      user ? supabase.from("reactions").select("reaction").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from("bookmarks" as never).select("post_id").eq("user_id", user.id).eq("post_id", post.id).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from("posts").select("id", { head: true, count: "exact" }).eq("reposted_from", post.id).eq("author_id", user.id) : Promise.resolve({ count: 0 }),
    ]);
    const map: Record<string, number> = {};
    (r.data ?? []).forEach((row: { reaction: string }) => { map[row.reaction] = (map[row.reaction] ?? 0) + 1; });
    setCounts(map);
    setComments(c.count ?? 0);
    setMyReaction((mine as { data: { reaction: string } | null }).data?.reaction ?? null);
    setBookmarked(!!(bm as { data: unknown }).data);
    setReposted(((rep as { count: number | null }).count ?? 0) > 0);
  }

  async function toggleReaction(emoji: string) {
    if (!user) return;
    setShowReactions(false);
    if (myReaction === emoji) {
      await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
    } else {
      if (myReaction) await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      await supabase.from("reactions").insert({ post_id: post.id, user_id: user.id, reaction: emoji });
      if (post.author_id !== user.id) {
        await supabase.from("notifications").insert({
          user_id: post.author_id, actor_id: user.id, type: "like" as never, post_id: post.id,
        });
      }
    }
    loadCounts();
  }

  async function toggleBookmark() {
    if (!user) return;
    if (bookmarked) {
      await supabase.from("bookmarks" as never).delete().eq("user_id", user.id).eq("post_id", post.id);
    } else {
      await supabase.from("bookmarks" as never).insert({ user_id: user.id, post_id: post.id } as never);
    }
    setBookmarked(!bookmarked);
  }

  async function toggleRepost() {
    if (!user) return;
    if (reposted) {
      await supabase.from("posts").delete().eq("author_id", user.id).eq("reposted_from", post.id);
      setReposted(false);
      toast.success("Repost removed");
    } else {
      const { error } = await supabase.from("posts").insert({
        author_id: user.id, reposted_from: post.id, post_type: "text" as never, is_anonymous: false,
      });
      if (error) return toast.error(error.message);
      setReposted(true); toast.success("Reposted");
    }
    onChange?.();
  }

  async function reportPost() {
    if (!user) return;
    const reason = prompt("Why are you reporting this?");
    if (!reason) return;
    await supabase.from("reports").insert({ reporter_id: user.id, target_type: "post", target_id: post.id, reason });
    toast.success("Reported. Thanks for keeping the sphere safe.");
  }

  async function deletePost() {
    if (!confirm("Delete this rant?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); onChange?.();
  }

  const author = post.is_anonymous
    ? { username: "anonymous", display_name: "Anonymous", avatar_url: null }
    : post.profiles ?? { username: "user", display_name: "User", avatar_url: null };

  if (post.is_hidden && !revealed && user?.id !== post.author_id) {
    return (
      <article className="glass rounded-3xl p-5 shadow-card border-destructive/30 border">
        <div className="flex items-center gap-3 text-sm">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <span className="text-muted-foreground">Hidden by AI moderation.</span>
          <button onClick={() => setRevealed(true)} className="ml-auto text-xs text-primary hover:underline">Show anyway</button>
        </div>
      </article>
    );
  }

  return (
    <article className="glass rounded-3xl p-5 shadow-card hover:border-primary/30 transition">
      <div className="flex gap-3">
        {post.is_anonymous ? (
          <div className="w-11 h-11 rounded-full bg-muted grid place-items-center"><EyeOff className="w-5 h-5" /></div>
        ) : (
          <Link to="/profile/$username" params={{ username: author.username }} className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold flex-shrink-0 overflow-hidden">
            {author.avatar_url ? <img src={author.avatar_url} className="w-full h-full object-cover" /> : author.username?.[0]?.toUpperCase()}
          </Link>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            {post.is_anonymous ? (
              <span className="font-semibold">Anonymous</span>
            ) : (
              <Link to="/profile/$username" params={{ username: author.username }} className="font-semibold hover:underline">
                {author.display_name || author.username}
              </Link>
            )}
            {!post.is_anonymous && <span className="text-muted-foreground">@{author.username}</span>}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground text-xs">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            {post.is_hidden && <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-destructive/20 text-destructive">Hidden</span>}
            <div className="ml-auto flex items-center gap-1">
              {user && user.id !== post.author_id && (
                <button onClick={reportPost} className="text-muted-foreground hover:text-destructive p-1" title="Report"><Flag className="w-4 h-4" /></button>
              )}
              {user?.id === post.author_id && (
                <button onClick={deletePost} className="text-muted-foreground hover:text-destructive p-1">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {post.content && (
            <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {renderContent(post.content)}
            </p>
          )}

          {post.post_type === "poll" && post.poll_options && (
            <PollView postId={post.id} options={post.poll_options} />
          )}

          {post.media_url && post.post_type === "video" ? (
            <video src={post.media_url} controls playsInline className="mt-3 rounded-2xl w-full max-h-[500px] bg-black" />
          ) : post.media_url ? (
            <div className="mt-3 rounded-2xl overflow-hidden border border-border">
              <img src={post.media_url} className="w-full max-h-[500px] object-cover" loading="lazy" />
            </div>
          ) : null}

          {original && (
            <div className="mt-3 rounded-2xl border border-border p-3">
              <div className="text-xs text-muted-foreground mb-1">Reposted from @{original.profiles?.username}</div>
              <div className="text-sm whitespace-pre-wrap">{original.content}</div>
              {original.media_url && original.post_type !== "video" && (
                <img src={original.media_url} className="mt-2 rounded-xl max-h-60 object-cover" loading="lazy" />
              )}
            </div>
          )}

          <div className="mt-3 flex items-center gap-1 text-muted-foreground relative">
            <div className="relative">
              <button
                onMouseEnter={() => setShowReactions(true)}
                onMouseLeave={() => setShowReactions(false)}
                onClick={() => toggleReaction("like")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition ${myReaction ? "text-primary" : ""}`}
              >
                {myReaction ? <span className="text-base leading-none">{EMOJI[myReaction]}</span> : <Heart className="w-4 h-4" />}
                <span className="text-sm">{Object.values(counts).reduce((a, b) => a + b, 0)}</span>
              </button>
              {showReactions && (
                <div onMouseEnter={() => setShowReactions(true)} onMouseLeave={() => setShowReactions(false)}
                  className="absolute -top-12 left-0 glass rounded-full px-2 py-1.5 flex gap-1 shadow-card z-10">
                  {REACTIONS.map(r => (
                    <button key={r} onClick={() => toggleReaction(r)} className="text-xl hover:scale-125 transition w-8 h-8 grid place-items-center">
                      {EMOJI[r]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-accent/10 hover:text-accent transition">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm">{comments}</span>
            </button>
            <button onClick={toggleRepost} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-violet/20 transition ${reposted ? "text-primary" : ""}`}>
              <Repeat2 className="w-4 h-4" />
            </button>
            <button onClick={toggleBookmark} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-card transition ml-auto ${bookmarked ? "text-primary" : ""}`}>
              <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-current" : ""}`} />
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-card transition"
              onClick={() => { navigator.clipboard.writeText(window.location.origin + "/post/" + post.id); toast.success("Link copied"); }}>
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {showComments && <CommentsThread postId={post.id} onChange={() => setComments((n) => n + 1)} />}
        </div>
      </div>
    </article>
  );
}

function PollView({ postId, options }: { postId: string; options: { text: string }[] }) {
  const { user } = useAuthContext();
  const [votes, setVotes] = useState<number[]>(options.map(() => 0));
  const [myVote, setMyVote] = useState<number | null>(null);

  useEffect(() => { load(); }, [postId, user?.id]);
  useEffect(() => {
    const ch = supabase.channel(`poll-${postId}`).on("postgres_changes", {
      event: "*", schema: "public", table: "poll_votes", filter: `post_id=eq.${postId}`,
    }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  async function load() {
    const { data } = await supabase.from("poll_votes" as never).select("option_index, user_id").eq("post_id", postId);
    const counts = options.map(() => 0);
    (data as { option_index: number; user_id: string }[] | null ?? []).forEach((v) => {
      if (counts[v.option_index] !== undefined) counts[v.option_index]++;
      if (user && v.user_id === user.id) setMyVote(v.option_index);
    });
    setVotes(counts);
  }

  async function vote(i: number) {
    if (!user || myVote !== null) return;
    await supabase.from("poll_votes" as never).insert({ post_id: postId, user_id: user.id, option_index: i } as never);
    setMyVote(i); load();
  }

  const total = votes.reduce((a, b) => a + b, 0);
  return (
    <div className="mt-3 space-y-2">
      {options.map((opt, i) => {
        const pct = total > 0 ? (votes[i] / total) * 100 : 0;
        const isMine = myVote === i;
        return (
          <button key={i} onClick={() => vote(i)} disabled={myVote !== null}
            className={`relative w-full text-left rounded-xl border ${isMine ? "border-primary" : "border-border"} px-4 py-2.5 overflow-hidden hover:border-primary/60 transition disabled:cursor-default`}>
            <div className="absolute inset-y-0 left-0 bg-primary/20 transition-all" style={{ width: myVote !== null ? `${pct}%` : 0 }} />
            <div className="relative flex justify-between items-center text-sm">
              <span>{opt.text}</span>
              {myVote !== null && <span className="text-muted-foreground text-xs">{Math.round(pct)}% · {votes[i]}</span>}
            </div>
          </button>
        );
      })}
      <div className="text-xs text-muted-foreground">{total} vote{total !== 1 ? "s" : ""}</div>
    </div>
  );
}

function CommentsThread({ postId, onChange }: { postId: string; onChange?: () => void }) {
  const { user, profile } = useAuthContext();
  const [items, setItems] = useState<{ id: string; content: string; created_at: string; author_id: string; profiles?: { username: string; avatar_url: string | null } | null }[]>([]);
  const [text, setText] = useState("");

  useEffect(() => { load(); }, [postId]);
  useEffect(() => {
    const ch = supabase.channel(`c-${postId}`).on("postgres_changes", {
      event: "INSERT", schema: "public", table: "comments", filter: `post_id=eq.${postId}`,
    }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  async function load() {
    const { data } = await supabase.from("comments").select("id, content, created_at, author_id, profiles(username, avatar_url)").eq("post_id", postId).order("created_at", { ascending: true }).limit(50);
    setItems((data as never) ?? []);
  }

  async function send() {
    if (!user || !text.trim()) return;
    const { error } = await supabase.from("comments").insert({ post_id: postId, author_id: user.id, content: text.trim() });
    if (error) return toast.error(error.message);
    setText(""); onChange?.();
  }

  return (
    <div className="mt-3 border-t border-border pt-3 space-y-3">
      {items.map((c) => (
        <div key={c.id} className="flex gap-2 text-sm">
          <div className="w-7 h-7 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
            {c.profiles?.avatar_url ? <img src={c.profiles.avatar_url} className="w-full h-full object-cover" /> : c.profiles?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 bg-card rounded-2xl px-3 py-2">
            <div className="text-xs"><span className="font-semibold">@{c.profiles?.username}</span> <span className="text-muted-foreground">· {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span></div>
            <div className="whitespace-pre-wrap break-words">{c.content}</div>
          </div>
        </div>
      ))}
      {user && (
        <div className="flex gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold flex-shrink-0 overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.username?.[0]?.toUpperCase()}
          </div>
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Reply..." className="flex-1 bg-input rounded-2xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          <button onClick={send} className="text-sm font-semibold text-primary hover:underline px-2">Reply</button>
        </div>
      )}
    </div>
  );
}
