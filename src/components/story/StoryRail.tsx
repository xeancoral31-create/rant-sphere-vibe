import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { Plus, X, Eye, ChevronLeft, ChevronRight, Music, Play, Pause, Sparkles, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";

export interface Story {
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
  "linear-gradient(135deg, #ff6b6b, #574b90)",
  "linear-gradient(135deg, #ee5a70, #c44569)",
  "linear-gradient(135deg, #f7931e, #e84393)",
  "linear-gradient(135deg, #574b90, #6c5ce7)",
  "linear-gradient(135deg, #0d1b2a, #2dd4a8)",
  "linear-gradient(135deg, #1a1a1a, #e85d3a)",
  "linear-gradient(135deg, #0f172a, #38bdf8)",
];

const STICKERS = ["🔥", "✨", "❤️", "💯", "👀", "🚀", "🎉", "👑", "💖", "⚡"];

export function StoryRail() {
  const { user, profile } = useAuthContext();
  const [stories, setStories] = useState<Story[]>([]);
  const [viewingAuthor, setViewingAuthor] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

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
    <>
      <div className="glass rounded-3xl p-4 shadow-card border border-border/40 overflow-hidden">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none items-center">
          {/* Your Story Button */}
          <button
            onClick={() => setCreating(true)}
            className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
          >
            <div className="relative w-16 h-16 rounded-full p-0.5 border-2 border-dashed border-primary/60 group-hover:border-primary transition">
              <div className="w-full h-full rounded-full bg-card overflow-hidden grid place-items-center">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-sm text-muted-foreground">You</span>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gradient-vivid grid place-items-center text-white shadow-glow">
                <Plus className="w-3.5 h-3.5" />
              </div>
            </div>
            <span className="text-[11px] font-semibold text-foreground">Your day</span>
          </button>

          {/* Grouped User Stories */}
          {authorIds.map((authorId) => {
            const top = grouped[authorId][0];
            const p = top.profiles;
            return (
              <button
                key={authorId}
                onClick={() => setViewingAuthor(authorId)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 group"
              >
                <div className="w-16 h-16 rounded-full p-0.5 bg-gradient-vivid group-hover:scale-105 transition shadow-glow">
                  <div className="w-full h-full rounded-full bg-background p-0.5">
                    <div className="w-full h-full rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
                      {p?.avatar_url ? (
                        <img src={p.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        p?.username?.[0]?.toUpperCase() || "U"
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-medium max-w-[64px] truncate text-muted-foreground group-hover:text-foreground">
                  {p?.username || "user"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {viewingAuthor && (
        <StoryViewer
          authorIds={authorIds}
          startAuthor={viewingAuthor}
          grouped={grouped}
          onClose={() => {
            setViewingAuthor(null);
            load();
          }}
        />
      )}

      {creating && (
        <CreateStory
          onClose={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </>
  );
}

function StoryViewer({
  authorIds,
  startAuthor,
  grouped,
  onClose,
}: {
  authorIds: string[];
  startAuthor: string;
  grouped: Record<string, Story[]>;
  onClose: () => void;
}) {
  const { user } = useAuthContext();
  const [authorIdx, setAuthorIdx] = useState(authorIds.indexOf(startAuthor));
  const [segIdx, setSegIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<
    { viewer_id: string; viewed_at: string; profiles?: { username: string; avatar_url: string | null } | null }[]
  >([]);

  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const authorId = authorIds[authorIdx];
  const segments = grouped[authorId] ?? [];
  const story = segments[segIdx];

  // Parse attached metadata (like music, stickers)
  let musicData: MusicTrack | null = null;
  let sticker = "";
  if (story?.media_url?.startsWith("{")) {
    try {
      const parsed = JSON.parse(story.media_url);
      musicData = parsed.music || null;
      sticker = parsed.sticker || "";
    } catch {}
  }

  useEffect(() => {
    if (!story) return;
    setProgress(0);

    // Record view in database
    if (user && user.id !== story.author_id) {
      supabase.from("story_views").insert({ story_id: story.id, viewer_id: user.id } as never).then(() => {});
    }

    if (story.author_id === user?.id) {
      loadViewers(story.id);
    }
  }, [story?.id]);

  useEffect(() => {
    if (musicData?.audioUrl && audioRef.current) {
      audioRef.current.src = musicData.audioUrl;
      audioRef.current.currentTime = 0;
      if (!isMuted) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [story?.id, isMuted]);

  async function loadViewers(storyId: string) {
    const { data } = await supabase
      .from("story_views")
      .select("viewer_id, viewed_at, profiles(username, avatar_url)")
      .eq("story_id", storyId);
    setViewers((data as never) ?? []);
  }

  // Progress Bar timer (5s per story segment)
  useEffect(() => {
    if (isPaused) return;
    const interval = 50;
    const step = (interval / 5000) * 100;

    timerRef.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          nextStory();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, segIdx, authorIdx]);

  function nextStory() {
    if (segIdx + 1 < segments.length) {
      setSegIdx(segIdx + 1);
      setProgress(0);
    } else if (authorIdx + 1 < authorIds.length) {
      setAuthorIdx(authorIdx + 1);
      setSegIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  }

  function prevStory() {
    if (segIdx > 0) {
      setSegIdx(segIdx - 1);
      setProgress(0);
    } else if (authorIdx > 0) {
      setAuthorIdx(authorIdx - 1);
      const prevSegments = grouped[authorIds[authorIdx - 1]] ?? [];
      setSegIdx(prevSegments.length - 1);
      setProgress(0);
    }
  }

  if (!story || typeof document === "undefined") return null;
  const isOwner = user?.id === story.author_id;

  return createPortal(
    <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex items-center justify-center p-4">
      <audio ref={audioRef} muted={isMuted} loop />
      <div
        className="relative w-full max-w-sm h-[85vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between p-4"
        style={{
          background: story.media_url && !story.media_url.startsWith("{")
            ? "#000"
            : story.background || "linear-gradient(135deg, #ff6b6b, #574b90)",
        }}
        onMouseDown={() => setIsPaused(true)}
        onMouseUp={() => setIsPaused(false)}
        onTouchStart={() => setIsPaused(true)}
        onTouchEnd={() => setIsPaused(false)}
      >
        {/* Story Progress Segments */}
        <div className="relative z-20 flex gap-1 pt-1">
          {segments.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-75 ease-linear"
                style={{
                  width: i < segIdx ? "100%" : i === segIdx ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header */}
        <div className="relative z-20 flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow">
              {story.profiles?.avatar_url ? (
                <img src={story.profiles.avatar_url} className="w-full h-full object-cover" />
              ) : (
                story.profiles?.username?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <div>
              <div className="text-white text-xs font-bold shadow-sm">@{story.profiles?.username || "user"}</div>
              <div className="text-white/70 text-[10px]">{formatDistanceToNow(new Date(story.created_at), { addSuffix: true })}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {musicData && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                className="w-8 h-8 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center hover:bg-black/60"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center hover:bg-black/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Story Background / Media Image or Video */}
        {story.media_url && !story.media_url.startsWith("{") && (
          story.media_url.includes(".mp4") || story.media_url.includes(".webm") ? (
            <video src={story.media_url} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0" />
          ) : (
            <img src={story.media_url} className="absolute inset-0 w-full h-full object-cover z-0" />
          )
        )}

        {/* Story Content / Text & Sticker */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 text-center">
          {sticker && (
            <div className="text-5xl mb-3 animate-bounce">{sticker}</div>
          )}
          {story.content && (
            <p className="text-white font-display font-bold text-2xl drop-shadow-md whitespace-pre-wrap leading-snug">
              {story.content}
            </p>
          )}

          {/* Music Sticker Badge */}
          {musicData && (
            <div className="mt-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
              <div className="w-6 h-6 rounded-full bg-gradient-vivid grid place-items-center text-white animate-spin">
                <Music className="w-3.5 h-3.5" />
              </div>
              <div className="text-left text-white text-[11px] leading-tight">
                <div className="font-semibold">{musicData.title}</div>
                <div className="opacity-75 text-[9px]">{musicData.artist}</div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Touch Zones */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); prevStory(); }}
          className="absolute left-0 top-16 bottom-16 w-1/3 z-10 opacity-0"
        />
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); nextStory(); }}
          className="absolute right-0 top-16 bottom-16 w-1/3 z-10 opacity-0"
        />

        {/* Bottom Bar / Viewer stats for Owner */}
        {isOwner && (
          <div className="relative z-20 flex items-center justify-between pt-2">
            <button
              onClick={() => setShowViewers(!showViewers)}
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{viewers.length} views</span>
            </button>
          </div>
        )}

        {/* Viewers Drawer */}
        {showViewers && isOwner && (
          <div className="absolute bottom-14 left-3 right-3 max-h-52 overflow-y-auto bg-card/95 border border-border/60 backdrop-blur-xl rounded-2xl p-3 z-30 space-y-2 shadow-2xl">
            <div className="text-xs font-semibold text-muted-foreground pb-1 border-b border-border/40">
              {viewers.length} viewer{viewers.length !== 1 ? "s" : ""}
            </div>
            {viewers.map((v) => (
              <div key={v.viewer_id} className="flex items-center gap-2 text-xs">
                <div className="w-6 h-6 rounded-full bg-gradient-vivid grid place-items-center text-white text-[10px] overflow-hidden">
                  {v.profiles?.avatar_url ? (
                    <img src={v.profiles.avatar_url} className="w-full h-full object-cover" />
                  ) : (
                    v.profiles?.username?.[0]?.toUpperCase() || "U"
                  )}
                </div>
                <span className="font-semibold text-foreground">@{v.profiles?.username}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function CreateStory({ onClose }: { onClose: () => void }) {
  const { user } = useAuthContext();
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [bg, setBg] = useState(BACKGROUNDS[0]);
  const [selectedSticker, setSelectedSticker] = useState("");
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!user || (!content.trim() && !file && !selectedSticker && !selectedMusic)) return;
    setLoading(true);
    let media_url: string | null = null;

    try {
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("stories").upload(path, file);
        if (upErr) throw upErr;
        media_url = supabase.storage.from("stories").getPublicUrl(path).data.publicUrl;
      } else if (selectedMusic || selectedSticker) {
        media_url = JSON.stringify({ music: selectedMusic, sticker: selectedSticker });
      }

      const { error } = await (supabase.from("stories") as any).insert({
        author_id: user.id,
        content: content.trim() || null,
        media_url,
        background: file ? null : bg,
      });

      if (error) throw error;
      toast.success("My Day story posted!");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to post story");
    } finally {
      setLoading(false);
    }
  }

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border/60 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h3 className="font-display text-lg font-bold">Create Story / My Day</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Story Preview Card */}
        <div
          className="rounded-2xl p-6 relative flex flex-col items-center justify-center text-center text-white font-display font-bold text-xl min-h-[160px] shadow-inner overflow-hidden"
          style={{ background: file ? "#000" : bg }}
        >
          {file ? (
            <span className="text-xs font-normal opacity-75">{file.name}</span>
          ) : (
            <>
              {selectedSticker && <div className="text-4xl mb-2">{selectedSticker}</div>}
              <span>{content || "Type your thoughts or add stickers..."}</span>
              {selectedMusic && (
                <div className="mt-3 flex items-center gap-1.5 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-normal">
                  <Music className="w-3.5 h-3.5 text-primary" />
                  <span>{selectedMusic.title} — {selectedMusic.artist}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Text input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a caption or text..."
          rows={2}
          maxLength={200}
          className="w-full bg-input rounded-xl p-3 outline-none resize-none focus:ring-1 focus:ring-primary text-sm border border-border/40"
        />

        {/* Background Gradients */}
        {!file && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">Background Gradient</div>
            <div className="flex gap-2 overflow-x-auto py-1">
              {BACKGROUNDS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBg(b)}
                  className={`w-7 h-7 rounded-full border-2 transition flex-shrink-0 ${
                    bg === b ? "border-primary scale-110 shadow-glow" : "border-transparent hover:scale-105"
                  }`}
                  style={{ background: b }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stickers Row */}
        {!file && (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground">Add a Sticker</div>
            <div className="flex gap-1.5 overflow-x-auto py-1">
              {STICKERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSticker(selectedSticker === s ? "" : s)}
                  className={`text-2xl p-1 rounded-xl transition ${
                    selectedSticker === s ? "bg-primary/20 scale-125" : "hover:scale-110"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Music Picker Toggle */}
        <div className="border border-border/40 rounded-2xl p-3 space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowMusicPicker(!showMusicPicker)}
              className="flex items-center gap-2 text-xs font-semibold text-foreground hover:text-primary transition"
            >
              <Music className="w-4 h-4 text-primary" />
              <span>{selectedMusic ? `🎵 ${selectedMusic.title}` : "Add Background Music"}</span>
            </button>
            {selectedMusic && (
              <button
                type="button"
                onClick={() => setSelectedMusic(null)}
                className="text-xs text-muted-foreground hover:text-destructive"
              >
                Remove
              </button>
            )}
          </div>

          {showMusicPicker && (
            <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pt-2">
              {MUSIC_LIBRARY.map((track) => (
                <div
                  key={track.id}
                  onClick={() => { setSelectedMusic(track); setShowMusicPicker(false); }}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer ${
                    selectedMusic?.id === track.id
                      ? "bg-primary/20 border-primary"
                      : "bg-muted/40 border-border/40 hover:bg-muted"
                  }`}
                >
                  <img src={track.coverUrl} className="w-8 h-8 rounded-lg object-cover" />
                  <div className="flex-1 truncate font-medium">{track.title} • {track.artist}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Photo/Video file upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="hidden"
        />

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted transition"
          >
            📸 <span>{file ? file.name : "Upload Photo / Video"}</span>
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="rounded-full bg-gradient-vivid px-6 py-2 font-semibold text-xs text-white shadow-glow hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? "Posting..." : "Share to Story"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
