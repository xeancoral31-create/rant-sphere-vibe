import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Link } from "@tanstack/react-router";
import {
  Heart,
  MessageCircle,
  Repeat2,
  Share2,
  Bookmark,
  MoreHorizontal,
  Play,
  Pause,
  Music,
  Volume2,
  VolumeX,
  Sparkles,
  MapPin,
  Send,
  Trash2,
  CheckCircle2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { type MusicTrack } from "@/lib/music";

const REACTIONS = ["like", "love", "laugh", "wow", "sad", "fire"] as const;
const EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
  fire: "🔥",
};

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
      return (
        <Link key={i} to="/tag/$tag" params={{ tag }} className="text-primary hover:underline font-semibold">
          {part}
        </Link>
      );
    }
    if (/^@[A-Za-z0-9_]{2,40}$/.test(part)) {
      const username = part.slice(1);
      return (
        <Link key={i} to="/profile/$username" params={{ username }} className="text-accent hover:underline font-semibold">
          {part}
        </Link>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function PostCard({ post, onChange }: { post: PostWithMeta; onChange?: () => void }) {
  const { user } = useAuthContext();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showReactions, setShowReactions] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [repostsCount, setRepostsCount] = useState(0);
  const [original, setOriginal] = useState<PostWithMeta | null>(null);
  
  // Double tap heart animation
  const [showHeartPop, setShowHeartPop] = useState(false);
  const lastTapRef = useRef<number>(0);

  // Music state
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Poll state
  const [pollVotes, setPollVotes] = useState<Record<number, number>>({});
  const [myVote, setMyVote] = useState<number | null>(null);

  useEffect(() => {
    loadCounts();
  }, [post.id, user?.id]);

  useEffect(() => {
    if (post.reposted_from) {
      supabase
        .from("posts")
        .select("*, profiles(username, display_name, avatar_url)")
        .eq("id", post.reposted_from)
        .maybeSingle()
        .then(({ data }) => setOriginal(data as PostWithMeta | null));
    }
  }, [post.reposted_from]);

  async function loadCounts() {
    const [r, c, mine, bm, rep, votes, myV] = await Promise.all([
      supabase.from("reactions").select("reaction").eq("post_id", post.id),
      supabase.from("comments").select("*", { count: "exact", head: true }).eq("post_id", post.id),
      user ? supabase.from("reactions").select("reaction").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      user ? supabase.from("bookmarks" as never).select("post_id").eq("user_id", user.id).eq("post_id", post.id).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from("posts").select("id", { head: true, count: "exact" }).eq("reposted_from", post.id),
      post.post_type === "poll" ? supabase.from("poll_votes" as never).select("option_index").eq("post_id", post.id) : Promise.resolve({ data: [] }),
      user && post.post_type === "poll" ? supabase.from("poll_votes" as never).select("option_index").eq("post_id", post.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const map: Record<string, number> = {};
    (r.data ?? []).forEach((row: { reaction: string }) => {
      map[row.reaction] = (map[row.reaction] ?? 0) + 1;
    });
    setCounts(map);
    setCommentsCount(c.count ?? 0);
    setMyReaction((mine as { data: { reaction: string } | null }).data?.reaction ?? null);
    setBookmarked(!!(bm as { data: unknown }).data);
    setRepostsCount(rep.count ?? 0);

    if (post.post_type === "poll" && votes.data) {
      const vMap: Record<number, number> = {};
      (votes.data as any[]).forEach((v) => {
        vMap[v.option_index] = (vMap[v.option_index] ?? 0) + 1;
      });
      setPollVotes(vMap);
      setMyVote((myV as { data: { option_index: number } | null })?.data?.option_index ?? null);
    }
  }

  async function loadComments() {
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, display_name, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setCommentsList(data ?? []);
  }

  async function toggleReaction(emoji: string) {
    if (!user) return toast.error("Please sign in to react");
    setShowReactions(false);
    if (myReaction === emoji) {
      await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      setMyReaction(null);
    } else {
      if (myReaction) {
        await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      }
      await (supabase.from("reactions") as any).insert({ post_id: post.id, user_id: user.id, reaction: emoji });
      setMyReaction(emoji);
    }
    loadCounts();
  }

  function handleDoubleTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      toggleReaction("love");
      setShowHeartPop(true);
      setTimeout(() => setShowHeartPop(false), 900);
    }
    lastTapRef.current = now;
  }

  async function toggleBookmark() {
    if (!user) return;
    if (bookmarked) {
      await supabase.from("bookmarks" as never).delete().eq("user_id", user.id).eq("post_id", post.id);
      setBookmarked(false);
      toast.success("Removed from bookmarks");
    } else {
      await supabase.from("bookmarks" as never).insert({ user_id: user.id, post_id: post.id } as never);
      setBookmarked(true);
      toast.success("Saved to bookmarks");
    }
  }

  async function toggleRepost() {
    if (!user) return;
    if (reposted) {
      await supabase.from("posts").delete().eq("author_id", user.id).eq("reposted_from", post.id);
      toast.success("Un-reposted");
    } else {
      await (supabase.from("posts") as any).insert({
        author_id: user.id,
        reposted_from: post.id,
        post_type: "text",
        content: null,
      });
      toast.success("Reposted to your profile!");
    }
    loadCounts();
    onChange?.();
  }

  async function handleVote(optionIndex: number) {
    if (!user) return toast.error("Sign in to vote");
    if (myVote !== null) return;
    await supabase.from("poll_votes" as never).insert({
      post_id: post.id,
      user_id: user.id,
      option_index: optionIndex,
    } as never);
    setMyVote(optionIndex);
    loadCounts();
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    const { error } = await (supabase.from("comments") as any).insert({
      post_id: post.id,
      author_id: user.id,
      content: newComment.trim(),
    });
    if (error) return toast.error(error.message);
    setNewComment("");
    loadComments();
    loadCounts();
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/home#${post.id}`);
    toast.success("Link copied to clipboard!");
  }

  // Parse attached custom data
  let musicData: MusicTrack | null = null;
  let gradientBg = "";
  let noteData: { emoji: string; bg: string } | null = null;

  if (post.post_type === "music" && post.media_url) {
    try { musicData = JSON.parse(post.media_url); } catch {}
  } else if (post.post_type === "rant_gradient" && post.media_url) {
    try { gradientBg = JSON.parse(post.media_url).bg; } catch {}
  } else if (post.post_type === "note" && post.media_url) {
    try { noteData = JSON.parse(post.media_url); } catch {}
  }

  const totalReactions = Object.values(counts).reduce((a, b) => a + b, 0);
  const targetPost = original || post;
  const author = targetPost.profiles;

  return (
    <article
      id={post.id}
      className="glass rounded-3xl p-5 shadow-card border border-border/40 transition hover:border-border/80 relative overflow-hidden group animate-fade-in"
      onClick={handleDoubleTap}
    >
      {/* Pop Heart Animation */}
      {showHeartPop && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 animate-scale-in">
          <Heart className="w-24 h-24 text-rose-500 fill-rose-500 drop-shadow-2xl animate-bounce" />
        </div>
      )}

      {/* Repost Header */}
      {post.reposted_from && (
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3 pb-2 border-b border-border/30">
          <Repeat2 className="w-4 h-4 text-emerald-400" />
          <span>@{post.profiles?.username} reposted</span>
        </div>
      )}

      {/* Note Badge if Note post */}
      {noteData && (
        <div className="mb-3 flex items-center gap-2 bg-purple-500/15 border border-purple-500/30 px-3 py-1.5 rounded-full text-xs text-purple-300 w-fit">
          <Sparkles className="w-3.5 h-3.5" />
          <span>24h Thought Note</span>
        </div>
      )}

      {/* Post Author Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/profile/$username"
          params={{ username: author?.username || "user" }}
          className="flex items-center gap-3 group/author"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow-glow">
            {author?.avatar_url ? (
              <img src={author.avatar_url} className="w-full h-full object-cover" />
            ) : (
              author?.username?.[0]?.toUpperCase() || "U"
            )}
          </div>
          <div>
            <div className="font-semibold text-sm group-hover/author:text-primary transition flex items-center gap-1">
              <span>{author?.display_name || author?.username || "User"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>@{author?.username || "user"}</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
            </div>
          </div>
        </Link>

        <div className="relative flex items-center gap-1">
          <button
            onClick={handleCopyLink}
            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
            title="Copy link"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {/* 1. Note Style */}
      {noteData && (
        <div
          className="mt-4 rounded-2xl p-6 text-center text-white font-display font-bold text-xl shadow-inner flex flex-col items-center justify-center"
          style={{ background: noteData.bg }}
        >
          <span className="text-4xl mb-2">{noteData.emoji}</span>
          <p className="text-lg">{post.content}</p>
        </div>
      )}

      {/* 2. Gradient Card Style */}
      {gradientBg && !noteData && (
        <div
          className="mt-4 rounded-2xl p-8 text-center text-white font-display font-bold text-2xl shadow-inner min-h-[160px] flex items-center justify-center"
          style={{ background: gradientBg }}
        >
          <p className="drop-shadow-md">{post.content}</p>
        </div>
      )}

      {/* 3. Regular Text Post */}
      {!gradientBg && !noteData && post.content && (
        <div className="mt-3 text-base text-foreground/95 whitespace-pre-wrap leading-relaxed">
          {renderContent(post.content)}
        </div>
      )}

      {/* 4. Photo/Video Media */}
      {post.media_url && !musicData && !gradientBg && !noteData && (
        <div className="mt-3 rounded-2xl overflow-hidden border border-border/40 bg-black/40">
          {post.post_type === "video" || post.media_url.includes(".mp4") || post.media_url.includes(".webm") ? (
            <video src={post.media_url} controls playsInline className="w-full max-h-[500px] object-contain mx-auto" />
          ) : (
            <img src={post.media_url} alt="post media" className="w-full max-h-[550px] object-cover" />
          )}
        </div>
      )}

      {/* 5. Music Card */}
      {musicData && (
        <div className="mt-3 bg-card/80 border border-primary/30 rounded-2xl p-4 shadow-glow backdrop-blur-md flex items-center gap-4">
          <audio
            ref={audioRef}
            src={musicData.audioUrl}
            onEnded={() => setIsPlayingMusic(false)}
            className="hidden"
          />
          <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 shadow-md group/music">
            <img src={musicData.coverUrl} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => {
                if (isPlayingMusic) {
                  audioRef.current?.pause();
                  setIsPlayingMusic(false);
                } else {
                  audioRef.current?.play().catch(() => {});
                  setIsPlayingMusic(true);
                }
              }}
              className="absolute inset-0 bg-black/40 grid place-items-center text-white hover:scale-105 transition"
            >
              {isPlayingMusic ? <Pause className="w-6 h-6 text-primary" /> : <Play className="w-6 h-6 text-white ml-0.5" />}
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-primary font-semibold uppercase tracking-wider">
              <Music className="w-3.5 h-3.5" /> Music Track
            </div>
            <div className="font-display font-bold text-sm text-foreground truncate mt-0.5">{musicData.title}</div>
            <div className="text-xs text-muted-foreground truncate">{musicData.artist} • {musicData.genre}</div>
          </div>

          {/* Sound wave bars */}
          <div className="flex items-end gap-1 h-6 pr-2">
            {[12, 20, 16, 24, 14].map((h, i) => (
              <div
                key={i}
                className={`w-1 rounded-full bg-gradient-vivid ${isPlayingMusic ? "animate-pulse" : "opacity-40"}`}
                style={{ height: isPlayingMusic ? `${h}px` : "6px", animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 6. Poll Options Card */}
      {post.post_type === "poll" && post.poll_options && (
        <div className="mt-3 space-y-2">
          {post.poll_options.map((opt, i) => {
            const votes = pollVotes[i] ?? 0;
            const total = Object.values(pollVotes).reduce((a, b) => a + b, 0);
            const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
            const isMyVote = myVote === i;

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleVote(i)}
                disabled={myVote !== null}
                className={`w-full relative overflow-hidden rounded-xl border p-3 text-left transition flex items-center justify-between text-xs font-semibold ${
                  isMyVote
                    ? "border-primary bg-primary/10 shadow-glow"
                    : "border-border/40 hover:bg-muted/40"
                }`}
              >
                {myVote !== null && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary/20 transition-all duration-500 z-0"
                    style={{ width: `${pct}%` }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  {isMyVote && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  {opt.text}
                </span>
                {myVote !== null && (
                  <span className="relative z-10 font-bold">{pct}%</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Reaction & Action Toolbar */}
      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
        {/* Left Actions (Reaction, Comments, Repost) */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Reaction Picker Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => toggleReaction(myReaction || "like")}
              onMouseEnter={() => setShowReactions(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                myReaction
                  ? "bg-rose-500/15 text-rose-500"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <Heart className={`w-4 h-4 ${myReaction ? "fill-rose-500 text-rose-500" : ""}`} />
              <span>{totalReactions > 0 ? totalReactions : "Like"}</span>
            </button>

            {/* Floating Reactions Bar */}
            {showReactions && (
              <div
                onMouseLeave={() => setShowReactions(false)}
                className="absolute bottom-full left-0 mb-2 flex items-center gap-1.5 bg-card/95 border border-border/60 backdrop-blur-xl p-1.5 rounded-full shadow-2xl z-30 animate-scale-in"
              >
                {REACTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => toggleReaction(r)}
                    className="text-xl hover:scale-150 transition p-1"
                  >
                    {EMOJI[r]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comment Button */}
          <button
            type="button"
            onClick={() => {
              if (!showComments) loadComments();
              setShowComments(!showComments);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{commentsCount > 0 ? commentsCount : "Comment"}</span>
          </button>

          {/* Repost Button */}
          <button
            type="button"
            onClick={toggleRepost}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              reposted ? "text-emerald-400 bg-emerald-500/15" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Repeat2 className="w-4 h-4" />
            <span>{repostsCount > 0 ? repostsCount : ""}</span>
          </button>
        </div>

        {/* Right Actions (Bookmark) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleBookmark}
            className={`p-2 rounded-full transition ${
              bookmarked ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
          </button>
        </div>
      </div>

      {/* Expandable Comments Drawer */}
      {showComments && (
        <div className="mt-4 pt-3 border-t border-border/30 space-y-3 animate-fade-in">
          {/* New Comment Input */}
          <form onSubmit={handleAddComment} className="flex items-center gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 bg-input text-xs rounded-full px-4 py-2 outline-none border border-border/40 focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white shadow-glow disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Comment List */}
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {commentsList.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground">No replies yet. Start the conversation!</div>
            ) : (
              commentsList.map((c) => (
                <div key={c.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full bg-gradient-vivid grid place-items-center text-white text-[10px] font-bold overflow-hidden flex-shrink-0 mt-0.5">
                    {c.profiles?.avatar_url ? (
                      <img src={c.profiles.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                      c.profiles?.username?.[0]?.toUpperCase() || "U"
                    )}
                  </div>
                  <div className="flex-1 bg-muted/30 border border-border/30 rounded-2xl px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">@{c.profiles?.username || "user"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="mt-1 text-foreground/90">{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </article>
  );
}
