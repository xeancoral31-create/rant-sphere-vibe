import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { getGroupDetails } from "@/lib/barkada-api";
import { ChevronLeft, Image, Film, FileText, MapPin, Loader2, X, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/groups/$groupId/media")({ component: GroupMediaPage });

type MediaTab = "photos" | "videos" | "files" | "locations";

function GroupMediaPage() {
  const { groupId } = Route.useParams();
  const { user } = useAuthContext();
  const [tab, setTab] = useState<MediaTab>("photos");
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    loadMedia();
  }, [groupId, tab]);

  async function loadMedia() {
    setLoading(true);
    try {
      // Query message_attachments for this conversation
      const mimeFilter =
        tab === "photos" ? { filter: "mime_type.ilike.image/%" } :
        tab === "videos" ? { filter: "mime_type.ilike.video/%" } :
        tab === "files" ? { filter: "not.mime_type.ilike.image/%, not.mime_type.ilike.video/%" } :
        null;

      if (tab === "locations") {
        // Get location messages
        const { data } = await supabase
          .from("messages")
          .select("*, profiles:sender_id(id, username, display_name, avatar_url)")
          .eq("conversation_id", groupId)
          .in("message_type", ["location", "live_location"])
          .eq("is_deleted", false)
          .order("created_at", { ascending: false });
        setMedia(data ?? []);
      } else {
        const { data: msgs } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", groupId);
        const msgIds = (msgs ?? []).map((m: any) => m.id);
        if (!msgIds.length) { setMedia([]); setLoading(false); return; }

        let query = supabase
          .from("message_attachments")
          .select("*, message:message_id(id, created_at, sender_id, profiles:sender_id(id, username, avatar_url))")
          .in("message_id", msgIds)
          .order("created_at", { ascending: false });

        if (tab === "photos") query = query.ilike("mime_type", "image/%");
        else if (tab === "videos") query = query.ilike("mime_type", "video/%");
        else if (tab === "files") {
          // Files that aren't images or videos
          query = supabase
            .from("message_attachments")
            .select("*, message:message_id(id, created_at, sender_id, profiles:sender_id(id, username, avatar_url))")
            .in("message_id", msgIds)
            .not("mime_type", "ilike", "image/%")
            .not("mime_type", "ilike", "video/%")
            .order("created_at", { ascending: false });
        }

        const { data } = await query;
        setMedia(data ?? []);
      }
    } catch { setMedia([]); }
    finally { setLoading(false); }
  }

  const tabs = [
    { key: "photos", label: "Photos", icon: Image },
    { key: "videos", label: "Videos", icon: Film },
    { key: "files", label: "Files", icon: FileText },
    { key: "locations", label: "Locations", icon: MapPin },
  ] as const;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 glass border-b border-border/40 px-4 py-3 flex items-center gap-3">
        <Link to="/groups/$groupId/settings" params={{ groupId }} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="font-semibold">Group Media</h1>
      </div>

      <div className="flex border-b border-border/40">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key as MediaTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium border-b-2 transition ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : media.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="opacity-40 mb-3">
              {tab === "photos" && <Image className="w-12 h-12 mx-auto" />}
              {tab === "videos" && <Film className="w-12 h-12 mx-auto" />}
              {tab === "files" && <FileText className="w-12 h-12 mx-auto" />}
              {tab === "locations" && <MapPin className="w-12 h-12 mx-auto" />}
            </div>
            <div className="font-semibold">No {tab} yet</div>
            <div className="text-sm">Shared {tab} will appear here.</div>
          </div>
        ) : tab === "photos" ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            {media.map((att: any) => (
              <button key={att.id} onClick={() => setSelected(att)}
                className="aspect-square rounded-xl overflow-hidden hover:opacity-90 transition hover:scale-95">
                <img src={att.url} className="w-full h-full object-cover" alt="" />
              </button>
            ))}
          </div>
        ) : tab === "videos" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {media.map((att: any) => (
              <div key={att.id} className="aspect-video rounded-xl overflow-hidden">
                <video src={att.url} controls className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : tab === "files" ? (
          <div className="space-y-2">
            {media.map((att: any) => (
              <a key={att.id} href={att.url} download={att.file_name} target="_blank" rel="noreferrer"
                className="glass rounded-xl p-4 flex items-center gap-3 border border-border hover:border-primary/40 transition">
                <div className="w-10 h-10 rounded-xl bg-card grid place-items-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{att.file_name || "File"}</div>
                  {att.size_bytes && <div className="text-xs text-muted-foreground">{(att.size_bytes / 1024).toFixed(1)} KB</div>}
                </div>
                <Download className="w-4 h-4 text-muted-foreground" />
              </a>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {media.map((msg: any) => {
              const lat = msg.metadata?.latitude;
              const lng = msg.metadata?.longitude;
              if (!lat || !lng) return null;
              return (
                <a key={msg.id} href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer"
                  className="glass rounded-xl p-4 flex items-center gap-3 border border-border hover:border-primary/40 transition">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 grid place-items-center">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{msg.message_type === "live_location" ? "🟢 Live Location" : "📍 Location"}</div>
                    <div className="text-xs text-muted-foreground">{lat.toFixed(5)}, {lng.toFixed(5)}</div>
                    <div className="text-xs text-muted-foreground">{msg.profiles?.username}</div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* Photo lightbox */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setSelected(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 grid place-items-center text-white" onClick={() => setSelected(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={selected.url} className="max-w-full max-h-full object-contain rounded-lg" alt="" onClick={(e) => e.stopPropagation()} />
          <a href={selected.url} download className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-black/50 grid place-items-center text-white hover:bg-black/70 transition">
            <Download className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}
