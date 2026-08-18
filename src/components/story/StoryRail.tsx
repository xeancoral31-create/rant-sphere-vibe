import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Plus, X, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface Story {
  id: string;
  author_id: string;
  content: string | null;
  media_url: string | null;
  background: string | null;
  created_at: string;
  expires_at: string;
  profiles?: { username: string; display_name: string | null; avatar_url: string | null } | null;
}

const BACKGROUNDS = [
  "linear-gradient(135deg,#ff6b6b,#574b90)",
  "linear-gradient(135deg,#ee5a70,#c44569)",
  "linear-gradient(135deg,#f7931e,#e84393)",
  "linear-gradient(135deg,#574b90,#6c5ce7)",
  "linear-gradient(135deg,#0d1b2a,#2dd4a8)",
  "linear-gradient(135deg,#1a1a1a,#e85d3a)",
];

export function StoryRail() {
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingAuthor, setViewingAuthor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase
      .from("stories")
      .select("*, profiles(username, display_name, avatar_url)")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true });
    setStories((data ?? []) as Story[]);
  }

  const grouped = stories.reduce<Record<string, Story[]>>((acc, s) => {
    (acc[s.author_id] ||= []).push(s);
    return acc;
  }, {});
  const authorIds = Object.keys(grouped);

  return (
    <div className="glass rounded-3xl p-4 shadow-card">
      <div className="flex gap-4 overflow-x-auto pb-2">
        <button onClick={() => setCreating(true)} className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div className="w-16 h-16 rounded-full border-2 border-dashed border-primary grid place-items-center bg-card hover:bg-primary/10 transition">
            <Plus className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xs font-medium">Your day</span>
        </button>
        {authorIds.map((authorId) => {
          const top = grouped[authorId][0];
          const p = top.profiles;
          return (
            <button key={authorId} onClick={() => setViewingAuthor(authorId)} className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-vivid">
                <div className="w-full h-full rounded-full bg-background p-0.5">
                  <div className="w-full h-full rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
                    {p?.avatar_url ? <img src={p.avatar_url} className="w-full h-full object-cover" /> : p?.username?.[0]?.toUpperCase()}
                  </div>
                </div>
              </div>
              <span className="text-xs max-w-[64px] truncate">{p?.username}</span>
            </button>
          );
        })}
      </div>
      {viewingAuthor && (
        <StoryViewer
          authorIds={authorIds}
          startAuthor={viewingAuthor}
          grouped={grouped}
          onClose={() => { setViewingAuthor(null); load(); }}
        />
      )}
      {creating && <CreateStory onClose={() => { setCreating(false); load(); }} />}
    </div>
  );
}

function StoryViewer({ authorIds, startAuthor, grouped, onClose }:
  { authorIds: string[]; startAuthor: string; grouped: Record<string, Story[]>; onClose: () => void }) {
  const { user } = useAuthContext();
  const [authorIdx, setAuthorIdx] = useState(authorIds.indexOf(startAuthor));
  const [segIdx, setSegIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<{ viewer_id: string; viewed_at: string; profiles?: { username: string; avatar_url: string | null } | null }[]>([]);
  const timerRef = useRef<number | null>(null);

  const authorId = authorIds[authorIdx];
  const segments = grouped[authorId] ?? [];
  const story = segments[segIdx];

  useEffect(() => {
    if (!story) return;
    if (user && story.author_id !== user.id) {
      supabase.from("story_views").upsert({ story_id: story.id, viewer_id: user.id } as never).then(() => {});
    }
    setProgress(0);
    const start = Date.now();
    const dur = 5000;
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / dur);
      setProgress(p);
      if (p >= 1) advance();
    }, 50);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [story?.id]);

  useEffect(() => {
    if (!showViewers || !story || story.author_id !== user?.id) return;
    supabase.from("story_views").select("viewer_id, viewed_at, profiles(username, avatar_url)").eq("story_id", story.id)
      .then(({ data }) => setViewers((data as never) ?? []));
  }, [showViewers, story?.id, user?.id]);

  function advance() {
    if (segIdx + 1 < segments.length) { setSegIdx(segIdx + 1); return; }
    if (authorIdx + 1 < authorIds.length) { setAuthorIdx(authorIdx + 1); setSegIdx(0); return; }
    onClose();
  }
  function back() {
    if (segIdx > 0) { setSegIdx(segIdx - 1); return; }
    if (authorIdx > 0) {
      const prev = authorIds[authorIdx - 1];
      setAuthorIdx(authorIdx - 1);
      setSegIdx((grouped[prev]?.length ?? 1) - 1);
    }
  }

  async function deleteStory() {
    if (!story || !confirm("Delete this story?")) return;
    await supabase.from("stories").delete().eq("id", story.id);
    toast.success("Deleted"); onClose();
  }

  if (!story) return null;
  const bg = story.background ?? "linear-gradient(135deg,#ff6b6b,#574b90)";
  const isOwner = user?.id === story.author_id;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 grid place-items-center" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white p-2 z-10"><X className="w-6 h-6" /></button>
      <button onClick={(e) => { e.stopPropagation(); back(); }} className="absolute left-2 md:left-8 text-white p-2 z-10"><ChevronLeft className="w-7 h-7" /></button>
      <button onClick={(e) => { e.stopPropagation(); advance(); }} className="absolute right-2 md:right-8 text-white p-2 z-10"><ChevronRight className="w-7 h-7" /></button>
      <div className="w-full max-w-md aspect-[9/16] rounded-3xl overflow-hidden relative" style={{ background: bg }} onClick={(e) => e.stopPropagation()}>
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
          {segments.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white" style={{ width: i < segIdx ? "100%" : i === segIdx ? `${progress * 100}%` : "0%" }} />
            </div>
          ))}
        </div>
        <div className="absolute top-6 left-3 right-3 flex items-center gap-2 text-white text-sm font-semibold z-10">
          <div className="w-8 h-8 rounded-full bg-white/30 grid place-items-center text-xs overflow-hidden">
            {story.profiles?.avatar_url ? <img src={story.profiles.avatar_url} className="w-full h-full object-cover" /> : story.profiles?.username?.[0]?.toUpperCase()}
          </div>
          @{story.profiles?.username}
          <span className="text-white/70 text-xs font-normal">{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</span>
        </div>
        {story.media_url ? (
          <img src={story.media_url} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center p-12 text-center text-white text-2xl font-display font-bold">
            {story.content}
          </div>
        )}
        {isOwner && (
          <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 z-10">
            <button onClick={() => setShowViewers(!showViewers)} className="text-white text-sm flex items-center gap-1.5 bg-black/40 rounded-full px-3 py-1.5">
              <Eye className="w-4 h-4" /> Viewers
            </button>
            <button onClick={deleteStory} className="ml-auto text-white text-xs bg-destructive/80 rounded-full px-3 py-1.5">Delete</button>
          </div>
        )}
        {showViewers && isOwner && (
          <div className="absolute bottom-16 left-3 right-3 max-h-60 overflow-y-auto bg-background/90 backdrop-blur rounded-2xl p-3 z-10 space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">{viewers.length} viewer{viewers.length !== 1 ? "s" : ""}</div>
            {viewers.map((v) => (
              <div key={v.viewer_id} className="flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs overflow-hidden">
                  {v.profiles?.avatar_url ? <img src={v.profiles.avatar_url} className="w-full h-full object-cover" /> : v.profiles?.username?.[0]?.toUpperCase()}
                </div>
                <span>@{v.profiles?.username}</span>
                <span className="ml-auto text-xs text-muted-foreground">{formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateStory({ onClose }: { onClose: () => void }) {
  const { user } = useAuthContext();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!user || (!content.trim() && !file)) return;
    setLoading(true);
    let media_url: string | null = null;
    if (file) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, file);
      if (upErr) { setLoading(false); return toast.error(upErr.message); }
      media_url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
    }
    const { error } = await supabase.from("stories").insert({
      author_id: user.id, content: content.trim() || null, media_url, background: file ? null : bg,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Story posted!");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md glass rounded-3xl p-6 shadow-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-xl font-bold mb-4">Share your day</h3>
        <div className="rounded-2xl p-6 mb-3 grid place-items-center text-center text-white font-display font-bold text-xl min-h-[140px]" style={{ background: file ? "#000" : bg }}>
          {file ? <span className="text-sm font-normal opacity-70">{file.name}</span> : (content || "Type or upload...")}
        </div>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="What's happening?" rows={2} maxLength={200}
          className="w-full bg-input rounded-xl p-3 outline-none resize-none focus:ring-2 focus:ring-primary text-sm" />
        {!file && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {BACKGROUNDS.map((b) => (
              <button key={b} onClick={() => setBg(b)}
                className={`w-8 h-8 rounded-full border-2 ${bg === b ? "border-primary" : "border-transparent"}`} style={{ background: b }} />
            ))}
          </div>
        )}
        <input type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-3 text-sm w-full" />
        <div className="mt-4 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-full hover:bg-card">Cancel</button>
          <button onClick={submit} disabled={loading} className="rounded-full bg-gradient-vivid px-6 py-2 font-semibold text-white shadow-glow disabled:opacity-50">
            {loading ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
