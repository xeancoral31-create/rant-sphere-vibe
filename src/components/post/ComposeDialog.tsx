import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Image as ImageIcon, X, EyeOff, BarChart3, Video, Plus } from "lucide-react";
import { moderateContent } from "@/lib/moderation.functions";

type Mode = "text" | "poll";

export function ComposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, profile } = useAuthContext();
  const moderate = useServerFn(moderateContent);
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [anon, setAnon] = useState(false);
  const [mode, setMode] = useState<Mode>("text");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const isVideo = file?.type.startsWith("video/");

  function reset() {
    setContent(""); setFile(null); setAnon(false); setMode("text"); setOptions(["", ""]);
  }

  async function handleSubmit() {
    if (!user) return;
    if (mode === "poll") {
      const valid = options.map(o => o.trim()).filter(Boolean);
      if (!content.trim() || valid.length < 2) return toast.error("Poll needs a question and 2+ options");
    } else if (!content.trim() && !file) return;

    setLoading(true);
    let media_url: string | null = null;
    let post_type: "text" | "image" | "video" | "poll" = "text";

    if (file) {
      if (file.size > 50 * 1024 * 1024) { setLoading(false); return toast.error("File too large (max 50MB)"); }
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("posts").upload(path, file);
      if (upErr) { setLoading(false); return toast.error(upErr.message); }
      media_url = supabase.storage.from("posts").getPublicUrl(path).data.publicUrl;
      post_type = isVideo ? "video" : "image";
    }
    if (mode === "poll") post_type = "poll";

    const poll_options = mode === "poll"
      ? options.map(o => o.trim()).filter(Boolean).map(text => ({ text }))
      : null;

    const { data: inserted, error } = await supabase.from("posts").insert({
      author_id: user.id,
      content: content.trim() || null,
      media_url,
      post_type: post_type as never,
      is_anonymous: anon,
      poll_options: poll_options as never,
    }).select("id").single();

    if (error) { setLoading(false); return toast.error(error.message); }

    // Fire-and-forget AI moderation
    if (content.trim() && inserted) {
      moderate({ data: { postId: inserted.id, text: content.trim() } })
        .then((r) => { if (r?.hidden) toast.warning("Your post was hidden by AI moderation."); })
        .catch(() => {});
    }

    setLoading(false);
    toast.success("Rant posted!");
    reset();
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
      <div className="w-full max-w-xl glass rounded-3xl p-6 shadow-card max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold">New {mode === "poll" ? "poll" : "rant"}</h2>
          <button onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold flex-shrink-0">
            {anon ? "?" : (profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full rounded-full object-cover" /> : profile?.username?.[0]?.toUpperCase())}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={mode === "poll" ? "Ask a question..." : "What's on your mind?"}
            rows={3}
            maxLength={500}
            className="flex-1 bg-transparent outline-none resize-none text-lg placeholder:text-muted-foreground"
          />
        </div>

        {mode === "poll" && (
          <div className="mt-3 space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2">
                <input value={opt} onChange={(e) => { const c=[...options]; c[i]=e.target.value; setOptions(c); }}
                  placeholder={`Option ${i + 1}`} maxLength={80}
                  className="flex-1 rounded-xl bg-input border border-border px-3 py-2 outline-none focus:ring-2 focus:ring-primary text-sm" />
                {options.length > 2 && (
                  <button onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive p-2"><X className="w-4 h-4" /></button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <button onClick={() => setOptions([...options, ""])} className="text-sm text-primary flex items-center gap-1 hover:underline">
                <Plus className="w-4 h-4" /> Add option
              </button>
            )}
          </div>
        )}

        {file && (
          <div className="mt-3 relative rounded-2xl overflow-hidden">
            {isVideo
              ? <video src={URL.createObjectURL(file)} controls className="w-full max-h-80" />
              : <img src={URL.createObjectURL(file)} className="w-full max-h-80 object-cover" />}
            <button onClick={() => setFile(null)} className="absolute top-2 right-2 bg-background/80 rounded-full p-1.5"><X className="w-4 h-4" /></button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4 flex-wrap gap-3">
          <div className="flex items-center gap-1">
            <label className="cursor-pointer p-2 rounded-full hover:bg-card text-primary" title="Image">
              <ImageIcon className="w-5 h-5" />
              <input type="file" accept="image/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMode("text"); }} />
            </label>
            <label className="cursor-pointer p-2 rounded-full hover:bg-card text-primary" title="Video">
              <Video className="w-5 h-5" />
              <input type="file" accept="video/*" hidden onChange={(e) => { setFile(e.target.files?.[0] ?? null); setMode("text"); }} />
            </label>
            <button onClick={() => { setMode(mode === "poll" ? "text" : "poll"); setFile(null); }}
              className={`p-2 rounded-full hover:bg-card ${mode === "poll" ? "text-primary" : "text-muted-foreground"}`} title="Poll">
              <BarChart3 className="w-5 h-5" />
            </button>
            <button onClick={() => setAnon(!anon)} className={`p-2 rounded-full hover:bg-card flex items-center gap-1 text-sm ${anon ? "text-primary" : "text-muted-foreground"}`}>
              <EyeOff className="w-4 h-4" /> {anon ? "Anon" : ""}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{content.length}/500</span>
            <button onClick={handleSubmit} disabled={loading} className="rounded-full bg-gradient-vivid px-6 py-2 font-semibold text-white shadow-glow disabled:opacity-50">
              {loading ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
