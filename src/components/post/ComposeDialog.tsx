import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  X,
  Video,
  Music,
  Smile,
  MapPin,
  Globe,
  Users,
  Lock,
  Sparkles,
  BarChart2,
  Trash2,
  Play,
  Pause,
  Plus
} from "lucide-react";
import { MUSIC_LIBRARY, type MusicTrack } from "@/lib/music";

export type ComposerMode = "post" | "photo" | "video" | "note" | "music" | "poll";

const THEME_BACKGROUNDS = [
  "",
  "linear-gradient(135deg, #ff6b6b, #574b90)",
  "linear-gradient(135deg, #ee5a70, #c44569)",
  "linear-gradient(135deg, #f7931e, #e84393)",
  "linear-gradient(135deg, #574b90, #6c5ce7)",
  "linear-gradient(135deg, #0d1b2a, #2dd4a8)",
  "linear-gradient(135deg, #1e293b, #0f172a)",
];

const EMOJI_LIST = ["🔥", "😂", "❤️", "🙌", "💀", "✨", "👀", "💯", "😭", "🤯", "🚀", "💡"];

export function ComposeDialog({
  open,
  onOpenChange,
  initialMode = "post",
  onPostCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialMode?: ComposerMode;
  onPostCreated?: () => void;
}) {
  const { user, profile } = useAuthContext();
  const [mode, setMode] = useState<ComposerMode>(initialMode);
  const [content, setContent] = useState("");
  const [selectedBg, setSelectedBg] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "followers" | "private">("public");
  const [location, setLocation] = useState("");
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // Media files
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  
  // Poll
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  
  // Note specific
  const [noteEmoji, setNoteEmoji] = useState("💭");
  
  // Music specific
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [previewingAudio, setPreviewingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open || typeof document === "undefined") return null;

  function reset() {
    setContent("");
    setSelectedBg("");
    setFiles([]);
    setFilePreviews([]);
    setPollOptions(["", ""]);
    setSelectedMusic(null);
    setLocation("");
    setShowLocationInput(false);
    setShowEmojiPicker(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;

    if (mode === "video") {
      const v = selected[0];
      if (!v.type.startsWith("video/")) {
        return toast.error("Please select a video file");
      }
      setFiles([v]);
      setFilePreviews([URL.createObjectURL(v)]);
    } else {
      const valid = selected.filter(f => f.type.startsWith("image/"));
      if (!valid.length) return toast.error("Please select image files");
      setFiles(prev => [...prev, ...valid]);
      const newPreviews = valid.map(f => URL.createObjectURL(f));
      setFilePreviews(prev => [...prev, ...newPreviews]);
    }
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  }

  function toggleAudioPreview(track: MusicTrack) {
    if (selectedMusic?.id === track.id && previewingAudio) {
      audioRef.current?.pause();
      setPreviewingAudio(false);
    } else {
      setSelectedMusic(track);
      if (audioRef.current) {
        audioRef.current.src = track.audioUrl;
        audioRef.current.play().catch(() => {});
        setPreviewingAudio(true);
      }
    }
  }

  async function handleSubmit() {
    if (!user) return;

    if (mode === "note") {
      if (!content.trim()) return toast.error("Please enter a note");
      if (content.trim().length > 100) return toast.error("Notes must be under 100 characters");
    } else if (mode === "poll") {
      const validOpts = pollOptions.map(o => o.trim()).filter(Boolean);
      if (!content.trim() || validOpts.length < 2) {
        return toast.error("Poll needs a question and at least 2 options");
      }
    } else if (mode === "music") {
      if (!selectedMusic) return toast.error("Please select a song from the library");
    } else if (!content.trim() && !files.length && !selectedBg) {
      return toast.error("Please write something or attach media");
    }

    setLoading(true);
    let uploadedMediaUrl: string | null = null;
    let postType = "text";

    try {
      if (files.length > 0) {
        const fileToUpload = files[0];
        const ext = fileToUpload.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("posts").upload(path, fileToUpload);
        if (upErr) throw upErr;
        uploadedMediaUrl = supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
        postType = fileToUpload.type.startsWith("video/") ? "video" : "image";
      } else if (mode === "music" && selectedMusic) {
        postType = "music";
        uploadedMediaUrl = JSON.stringify(selectedMusic);
      } else if (mode === "note") {
        postType = "note";
        uploadedMediaUrl = JSON.stringify({ emoji: noteEmoji, bg: selectedBg || THEME_BACKGROUNDS[1] });
      } else if (mode === "poll") {
        postType = "poll";
      } else if (selectedBg) {
        postType = "rant_gradient";
        uploadedMediaUrl = JSON.stringify({ bg: selectedBg });
      }

      const poll_data = mode === "poll"
        ? pollOptions.map(o => o.trim()).filter(Boolean).map(text => ({ text }))
        : null;

      const fullContent = location.trim() ? `${content.trim()}\n📍 ${location.trim()}` : content.trim();

      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: fullContent || null,
        media_url: uploadedMediaUrl,
        post_type: postType as never,
        poll_options: poll_data as never,
      });

      if (error) throw error;

      toast.success(
        mode === "note" ? "Note shared for 24h!" :
        mode === "music" ? "Music post published!" :
        "Rant posted to the sphere!"
      );
      reset();
      onOpenChange(false);
      onPostCreated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish post");
    } finally {
      setLoading(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={() => onOpenChange(false)}
    >
      <audio ref={audioRef} onEnded={() => setPreviewingAudio(false)} className="hidden" />
      <div
        className="w-full max-w-xl bg-card border border-border/60 rounded-3xl p-6 shadow-2xl max-h-[92vh] flex flex-col gap-4 overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Mode Tabs */}
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            <button
              onClick={() => { setMode("post"); setSelectedMusic(null); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                mode === "post" ? "bg-gradient-vivid text-white shadow-glow" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              💬 Post
            </button>
            <button
              onClick={() => { setMode("photo"); fileInputRef.current?.click(); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                mode === "photo" ? "bg-gradient-vivid text-white shadow-glow" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" /> Photo
            </button>
            <button
              onClick={() => { setMode("video"); fileInputRef.current?.click(); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                mode === "video" ? "bg-gradient-vivid text-white shadow-glow" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              <Video className="w-3.5 h-3.5" /> Video
            </button>
            <button
              onClick={() => { setMode("music"); setFiles([]); setFilePreviews([]); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                mode === "music" ? "bg-gradient-vivid text-white shadow-glow" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              <Music className="w-3.5 h-3.5" /> Music
            </button>
            <button
              onClick={() => { setMode("note"); setFiles([]); setFilePreviews([]); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                mode === "note" ? "bg-gradient-vivid text-white shadow-glow" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" /> Note
            </button>
            <button
              onClick={() => { setMode("poll"); setFiles([]); setFilePreviews([]); }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                mode === "poll" ? "bg-gradient-vivid text-white shadow-glow" : "bg-muted hover:bg-muted/80 text-foreground"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> Poll
            </button>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info & Privacy selector */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow-glow">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} className="w-full h-full object-cover" />
              ) : (
                profile?.username?.[0]?.toUpperCase() || "U"
              )}
            </div>
            <div>
              <div className="font-semibold text-sm">{profile?.display_name || profile?.username || "You"}</div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <select
                  value={privacy}
                  onChange={(e) => setPrivacy(e.target.value as any)}
                  className="bg-muted/60 border border-border/40 rounded-lg px-2 py-0.5 text-xs outline-none cursor-pointer"
                >
                  <option value="public">🌍 Public</option>
                  <option value="followers">👥 Followers only</option>
                  <option value="private">🔒 Only me</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Note Mode Banner UI */}
        {mode === "note" && (
          <div
            className="rounded-2xl p-6 text-center text-white font-bold transition shadow-inner relative flex flex-col items-center justify-center min-h-[140px]"
            style={{ background: selectedBg || THEME_BACKGROUNDS[1] }}
          >
            <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-2xl mb-2 shadow-lg">
              {noteEmoji}
            </div>
            <p className="text-lg font-display">{content || "Share a quick thought..."}</p>
            <span className="text-[11px] font-normal opacity-75 mt-1">Visible on profile & feed for 24h</span>
          </div>
        )}

        {/* Music Mode Selector UI */}
        {mode === "music" && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose a Song</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {MUSIC_LIBRARY.map((track) => {
                const isSelected = selectedMusic?.id === track.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => setSelectedMusic(track)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? "bg-primary/15 border-primary shadow-glow"
                        : "bg-muted/40 border-border/40 hover:bg-muted"
                    }`}
                  >
                    <img src={track.coverUrl} className="w-11 h-11 rounded-lg object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-xs truncate">{track.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{track.artist} • {track.genre}</div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleAudioPreview(track); }}
                      className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white hover:scale-105 transition flex-shrink-0"
                    >
                      {isSelected && previewingAudio ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Textarea Input */}
        <div
          className={`rounded-2xl transition p-3 ${
            selectedBg && mode === "post" ? "min-h-[150px] flex items-center justify-center text-center font-display font-bold text-xl text-white p-6 shadow-inner" : ""
          }`}
          style={{ background: selectedBg && mode === "post" ? selectedBg : "transparent" }}
        >
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              mode === "note" ? "What's your 24h thought?" :
              mode === "music" ? "Say something about this track..." :
              mode === "poll" ? "Ask a question..." :
              "What's on your mind? Shout into the sphere..."
            }
            rows={selectedBg && mode === "post" ? 3 : 4}
            maxLength={mode === "note" ? 100 : 1000}
            className={`w-full bg-transparent outline-none resize-none placeholder:text-muted-foreground ${
              selectedBg && mode === "post" ? "text-center text-white font-bold text-xl placeholder:text-white/60" : "text-base text-foreground"
            }`}
          />
        </div>

        {/* Poll Options */}
        {mode === "poll" && (
          <div className="space-y-2 bg-muted/30 p-3 rounded-2xl border border-border/40">
            <div className="text-xs font-semibold text-muted-foreground">Poll Options</div>
            {pollOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...pollOptions];
                    next[idx] = e.target.value;
                    setPollOptions(next);
                  }}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 bg-input rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary border border-border/40"
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {pollOptions.length < 5 && (
              <button
                type="button"
                onClick={() => setPollOptions(prev => [...prev, ""])}
                className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 pt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Option
              </button>
            )}
          </div>
        )}

        {/* Media Preview Grid */}
        {filePreviews.length > 0 && (
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-muted/20 rounded-2xl border border-border/40">
            {filePreviews.map((preview, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden aspect-video bg-black group">
                {files[i]?.type.startsWith("video/") ? (
                  <video src={preview} controls className="w-full h-full object-cover" />
                ) : (
                  <img src={preview} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white grid place-items-center hover:bg-destructive transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Background Palette Selector */}
        {(mode === "post" || mode === "note") && !files.length && (
          <div className="flex items-center gap-2 pt-1 overflow-x-auto">
            <span className="text-xs text-muted-foreground flex-shrink-0">Theme:</span>
            {THEME_BACKGROUNDS.map((bg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedBg(bg)}
                className={`w-7 h-7 rounded-full border-2 transition flex-shrink-0 ${
                  selectedBg === bg ? "border-primary scale-110 shadow-glow" : "border-transparent hover:scale-105"
                } ${!bg ? "bg-muted border-border" : ""}`}
                style={{ background: bg || "transparent" }}
              />
            ))}
          </div>
        )}

        {/* Location input row */}
        {showLocationInput && (
          <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-xl border border-border/40">
            <MapPin className="w-4 h-4 text-primary" />
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location (e.g. Tokyo, Shibuya)"
              className="bg-transparent text-xs outline-none flex-1"
            />
            <button onClick={() => { setShowLocationInput(false); setLocation(""); }} className="text-muted-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div className="flex items-center gap-1.5 bg-muted/40 p-2 rounded-xl border border-border/40 overflow-x-auto">
            {EMOJI_LIST.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  if (mode === "note") setNoteEmoji(emoji);
                  else setContent(prev => prev + emoji);
                }}
                className="text-lg hover:scale-125 transition p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple={mode !== "video"}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Bottom Toolbar & Action buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Add photos or video"
            >
              <ImageIcon className="w-5 h-5 text-primary" />
            </button>
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Add emojis"
            >
              <Smile className="w-5 h-5 text-yellow-500" />
            </button>
            <button
              type="button"
              onClick={() => setShowLocationInput(!showLocationInput)}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title="Add location"
            >
              <MapPin className="w-5 h-5 text-rose-500" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="rounded-full bg-gradient-vivid px-6 py-2.5 font-semibold text-sm text-white shadow-glow hover:scale-105 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? "Posting..." : "Post Rant"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Inline Composer component for the top of the Home Feed
export function InlineComposer({ onPostCreated }: { onPostCreated?: () => void }) {
  const [openModal, setOpenModal] = useState(false);
  const [initialMode, setInitialMode] = useState<ComposerMode>("post");
  const { profile } = useAuthContext();

  function trigger(mode: ComposerMode) {
    setInitialMode(mode);
    setOpenModal(true);
  }

  return (
    <>
      <div className="glass rounded-3xl p-4 shadow-card border border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shadow-glow flex-shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              profile?.username?.[0]?.toUpperCase() || "U"
            )}
          </div>
          <button
            onClick={() => trigger("post")}
            className="flex-1 bg-input/80 hover:bg-input text-left text-sm text-muted-foreground px-4 py-2.5 rounded-full border border-border/40 transition hover:border-primary/50"
          >
            What's on your mind? Shout into the sphere...
          </button>
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30 px-2">
          <button
            onClick={() => trigger("photo")}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition p-1.5 rounded-xl hover:bg-muted/50"
          >
            <ImageIcon className="w-4 h-4 text-emerald-400" />
            <span>Photo</span>
          </button>
          <button
            onClick={() => trigger("video")}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition p-1.5 rounded-xl hover:bg-muted/50"
          >
            <Video className="w-4 h-4 text-sky-400" />
            <span>Video</span>
          </button>
          <button
            onClick={() => trigger("music")}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition p-1.5 rounded-xl hover:bg-muted/50"
          >
            <Music className="w-4 h-4 text-amber-400" />
            <span>Music</span>
          </button>
          <button
            onClick={() => trigger("note")}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition p-1.5 rounded-xl hover:bg-muted/50"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Note</span>
          </button>
        </div>
      </div>

      <ComposeDialog
        open={openModal}
        onOpenChange={setOpenModal}
        initialMode={initialMode}
        onPostCreated={onPostCreated}
      />
    </>
  );
}
