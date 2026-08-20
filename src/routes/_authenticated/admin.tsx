// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  Users, FileText, Flag, Activity, AlertTriangle,
  Music, Upload, Trash2, Play, Pause, CheckCircle, X,
  Image as ImageIcon, Mic
} from "lucide-react";
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

interface Soundtrack {
  id: string;
  title: string;
  artist: string;
  genre: string;
  category: string;
  cover_url: string | null;
  audio_url: string;
  duration: string;
  created_at: string;
}

function AdminPage() {
  const { user } = useAuthContext();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ users: 0, posts: 0, reports: 0, stories: 0 });
  const [reports, setReports] = useState<{ id: string; target_type: string; reason: string; status: string; created_at: string }[]>([]);
  const [flagged, setFlagged] = useState<FlaggedPost[]>([]);

  // Soundtrack upload state
  const [soundtracks, setSoundtracks] = useState<Soundtrack[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeSection, setActiveSection] = useState<"dashboard" | "music">("dashboard");
  const [form, setForm] = useState({ title: "", artist: "", genre: "", category: "Admin Uploads", duration: "" });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!user) return;
    const email = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress;
    if (email === "xeancoral31@gmail.com") {
      setIsAdmin(true);
      loadAll();
      return;
    }
    supabase.from("user_roles").select("*").eq("user_id", user.id).eq("role", "admin").maybeSingle().then(({ data }) => {
      setIsAdmin(!!data);
      if (data) loadAll();
    });
  }, [user]);

  async function loadAll() {
    await Promise.all([loadStats(), loadSoundtracks()]);
  }

  async function loadStats() {
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

  async function loadSoundtracks() {
    const { data } = await supabase.from("soundtracks" as never).select("*").order("created_at", { ascending: false });
    if (data) setSoundtracks(data as Soundtrack[]);
  }

  async function resolveReport(id: string) {
    await supabase.from("reports").update({ status: "resolved" as never }).eq("id", id);
    toast.success("Report resolved"); loadStats();
  }
  async function removePost(id: string) {
    if (!confirm("Permanently delete this post?")) return;
    await supabase.from("posts").delete().eq("id", id);
    toast.success("Removed"); loadStats();
  }
  async function approvePost(id: string) {
    await supabase.from("posts").update({ is_hidden: false, ai_score: null } as never).eq("id", id);
    toast.success("Approved"); loadStats();
  }

  function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setPreviewAudio(URL.createObjectURL(file));
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setPreviewCover(URL.createObjectURL(file));
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile) return toast.error("Please select an audio file.");
    if (!form.title || !form.artist) return toast.error("Title and artist are required.");
    setUploading(true);

    try {
      // 1. Upload audio file
      const audioPath = `audio/${Date.now()}_${audioFile.name.replace(/\s/g, "_")}`;
      const { error: audioErr } = await supabase.storage.from("soundtracks").upload(audioPath, audioFile, { contentType: audioFile.type });
      if (audioErr) throw audioErr;
      const { data: audioData } = supabase.storage.from("soundtracks").getPublicUrl(audioPath);

      // 2. Upload cover if provided
      let coverPublicUrl: string | null = null;
      if (coverFile) {
        const coverPath = `covers/${Date.now()}_${coverFile.name.replace(/\s/g, "_")}`;
        const { error: coverErr } = await supabase.storage.from("soundtracks").upload(coverPath, coverFile, { contentType: coverFile.type });
        if (!coverErr) {
          const { data: coverData } = supabase.storage.from("soundtracks").getPublicUrl(coverPath);
          coverPublicUrl = coverData.publicUrl;
        }
      }

      // 3. Insert into DB
      const { error: dbErr } = await supabase.from("soundtracks" as never).insert({
        title: form.title,
        artist: form.artist,
        genre: form.genre || "General",
        category: form.category || "Admin Uploads",
        duration: form.duration || "—",
        audio_url: audioData.publicUrl,
        cover_url: coverPublicUrl,
        uploader_id: user?.id,
      });
      if (dbErr) throw dbErr;

      toast.success("🎵 Soundtrack uploaded! Users can now play it.");
      setForm({ title: "", artist: "", genre: "", category: "Admin Uploads", duration: "" });
      setAudioFile(null);
      setCoverFile(null);
      setPreviewAudio(null);
      setPreviewCover(null);
      loadSoundtracks();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteSoundtrack(track: Soundtrack) {
    if (!confirm(`Delete "${track.title}" by ${track.artist}?`)) return;
    await supabase.from("soundtracks" as never).delete().eq("id", track.id);
    toast.success("Soundtrack deleted.");
    loadSoundtracks();
  }

  function togglePlay(track: Soundtrack) {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = track.audio_url;
        audioRef.current.play();
      }
      setPlayingId(track.id);
    }
  }

  if (isAdmin === null) return <div className="p-12 text-center">Checking access...</div>;
  if (!isAdmin) return (
    <div className="p-12 text-center max-w-md mx-auto">
      <h1 className="font-display text-2xl font-bold">Admin only</h1>
      <p className="mt-2 text-muted-foreground text-sm">Ask an admin to grant you the role.</p>
    </div>
  );

  const statCards = [
    { icon: Users, label: "Users", value: stats.users, color: "bg-primary/20 text-primary" },
    { icon: FileText, label: "Posts", value: stats.posts, color: "bg-accent/20 text-accent" },
    { icon: Activity, label: "Active stories", value: stats.stories, color: "bg-violet-500/20 text-violet-400" },
    { icon: Flag, label: "Pending reports", value: stats.reports, color: "bg-destructive/20 text-destructive" },
  ];

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveSection("dashboard")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeSection === "dashboard" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-card/60"}`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveSection("music")}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${activeSection === "music" ? "bg-gradient-vivid text-white shadow-glow" : "glass hover:bg-card/60"}`}
          >
            <Music className="w-4 h-4" /> Music Manager
          </button>
        </div>
      </div>

      {/* Hidden audio element for preview */}
      <audio ref={audioRef} onEnded={() => setPlayingId(null)} />

      {activeSection === "dashboard" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {statCards.map((c) => (
              <div key={c.label} className="glass rounded-3xl p-5 hover:scale-[1.02] transition-transform">
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
        </>
      )}

      {activeSection === "music" && (
        <div className="space-y-8">
          {/* Upload Form */}
          <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden bg-card/50">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

            <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-vivid grid place-items-center shadow-glow">
                <Upload className="w-5 h-5 text-white" />
              </div>
              Upload New Soundtrack
            </h2>

            <form onSubmit={handleUpload} className="space-y-5 relative z-10">
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Track Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Dynamite"
                    required
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Artist Name *</label>
                  <input
                    value={form.artist}
                    onChange={e => setForm(f => ({ ...f, artist: e.target.value }))}
                    placeholder="e.g. BTS"
                    required
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Genre</label>
                  <input
                    value={form.genre}
                    onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                    placeholder="e.g. K-Pop"
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all cursor-pointer"
                  >
                    <option>Admin Uploads</option>
                    <option>Trending</option>
                    <option>Lo-fi</option>
                    <option>Electronic</option>
                    <option>Hip-Hop</option>
                    <option>Acoustic</option>
                    <option>Ambient</option>
                    <option>K-Pop</option>
                    <option>Pop</option>
                    <option>Hollywood</option>
                  </select>
                </div>
              </div>

              {/* File Uploads */}
              <div className="grid md:grid-cols-2 gap-5">
                {/* Audio File */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Audio File * (MP3/WAV/OGG, max 50MB)</label>
                  <label className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${audioFile ? "border-primary/60 bg-primary/5" : "border-white/10 hover:border-white/30 hover:bg-white/5"}`}>
                    <input type="file" accept="audio/*" onChange={handleAudioChange} className="hidden" />
                    {audioFile ? (
                      <>
                        <CheckCircle className="w-8 h-8 text-primary" />
                        <span className="text-xs text-center text-foreground font-medium px-2 truncate max-w-full">{audioFile.name}</span>
                        <span className="text-[10px] text-muted-foreground">{(audioFile.size / 1024 / 1024).toFixed(1)} MB</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-8 h-8 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground text-center">Click to upload audio file</span>
                      </>
                    )}
                  </label>
                  {previewAudio && (
                    <audio controls src={previewAudio} className="w-full mt-2 h-10 rounded-xl" />
                  )}
                </div>

                {/* Cover Image */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Cover Art (optional)</label>
                  <label className={`flex flex-col items-center justify-center gap-3 h-36 rounded-2xl border-2 border-dashed cursor-pointer transition-all overflow-hidden relative ${coverFile ? "border-primary/60" : "border-white/10 hover:border-white/30 hover:bg-white/5"}`}>
                    <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                    {previewCover ? (
                      <img src={previewCover} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground text-center">Click to upload cover art</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setForm({ title: "", artist: "", genre: "", category: "Admin Uploads", duration: "" }); setAudioFile(null); setCoverFile(null); setPreviewAudio(null); setPreviewCover(null); }}
                  className="px-5 py-2.5 rounded-full text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={uploading || !audioFile}
                  className="px-8 py-2.5 rounded-full bg-gradient-vivid text-white text-sm font-bold shadow-glow hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
                >
                  {uploading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> Upload Soundtrack</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Uploaded Soundtracks List */}
          <div>
            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              Uploaded Soundtracks ({soundtracks.length})
            </h2>
            {soundtracks.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center text-muted-foreground border border-white/5">
                No soundtracks uploaded yet. Upload your first track above!
              </div>
            ) : (
              <div className="space-y-3">
                {soundtracks.map(track => (
                  <div key={track.id} className="glass rounded-2xl p-4 flex items-center gap-4 border border-white/5 hover:border-white/10 hover:bg-card/60 transition-all group">
                    {/* Cover */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gradient-vivid grid place-items-center shadow-lg">
                      {track.cover_url ? (
                        <img src={track.cover_url} className="w-full h-full object-cover" />
                      ) : (
                        <Music className="w-6 h-6 text-white/70" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{track.title}</div>
                      <div className="text-xs text-muted-foreground truncate">{track.artist} · {track.genre}</div>
                      <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider">{track.category}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => togglePlay(track)}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-primary/30 grid place-items-center transition-all"
                        title="Preview"
                      >
                        {playingId === track.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDeleteSoundtrack(track)}
                        className="w-9 h-9 rounded-full bg-white/5 hover:bg-destructive/20 hover:text-destructive grid place-items-center transition-all text-muted-foreground"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
