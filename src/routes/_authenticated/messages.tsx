import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCallContext } from "@/components/call/CallProvider";
import { Send, Phone, Video, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/messages")({ component: MessagesPage });

interface Conv { id: string; name: string | null; participants?: { user_id: string; profiles: any }[]; last?: string }
interface Msg { id: string; sender_id: string; content: string | null; created_at: string }

function MessagesPage() {
  const { user, profile } = useAuthContext();
  const { initiateCall } = useCallContext();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) loadConvs(); }, [user?.id]);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase.channel(`msg-${activeId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
      setMsgs((m) => [...m, payload.new as Msg]);
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function loadConvs() {
    if (!user) return;
    const { data: parts } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
    const ids = (parts ?? []).map((p) => p.conversation_id);
    if (!ids.length) return setConvs([]);
    const { data } = await supabase.from("conversations").select("*, conversation_participants(user_id, profiles(username, display_name, avatar_url))").in("id", ids).order("updated_at", { ascending: false });
    setConvs((data ?? []).map((c: any) => ({ id: c.id, name: c.name, participants: c.conversation_participants })));
  }

  async function loadMessages(cid: string) {
    const { data } = await supabase.from("messages").select("*").eq("conversation_id", cid).order("created_at", { ascending: true }).limit(100);
    setMsgs((data ?? []) as Msg[]);
  }

  async function sendMsg() {
    if (!user || !activeId || !text.trim()) return;
    const content = text.trim(); setText("");
    await supabase.from("messages").insert({ conversation_id: activeId, sender_id: user.id, content });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeId);
  }

  async function searchUsers(q: string) {
    setSearchUser(q);
    if (q.length < 2) return setResults([]);
    const { data } = await supabase.from("profiles").select("*").ilike("username", `%${q}%`).neq("id", user?.id ?? "").limit(8);
    setResults(data ?? []);
  }

  async function startConv(otherId: string) {
    if (!user) return;
    // Find existing 1-on-1
    const { data: mine } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", user.id);
    const myIds = (mine ?? []).map((m) => m.conversation_id);
    if (myIds.length) {
      const { data: shared } = await supabase.from("conversation_participants").select("conversation_id").eq("user_id", otherId).in("conversation_id", myIds);
      if (shared && shared.length) { setActiveId(shared[0].conversation_id); setSearchUser(""); setResults([]); return; }
    }
    const { data: c } = await supabase.from("conversations").insert({ is_group: false }).select().single();
    if (!c) return;
    await supabase.from("conversation_participants").insert([{ conversation_id: c.id, user_id: user.id }, { conversation_id: c.id, user_id: otherId }]);
    await loadConvs(); setActiveId(c.id); setSearchUser(""); setResults([]);
  }

  function otherUser(c: Conv) {
    return c.participants?.find((p) => p.user_id !== user?.id)?.profiles;
  }

  return (
    <div className="h-screen flex">
      <div className="w-80 border-r border-border/40 flex flex-col">
        <div className="p-4 border-b border-border/40">
          <h1 className="font-display text-2xl font-bold mb-3">Messages</h1>
          <input value={searchUser} onChange={(e) => searchUsers(e.target.value)} placeholder="Find someone..." className="w-full rounded-xl bg-input border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          {results.length > 0 && (
            <div className="mt-2 space-y-1">
              {results.map((r) => (
                <button key={r.id} onClick={() => startConv(r.id)} className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-card text-left">
                  <div className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold">{r.username[0]?.toUpperCase()}</div>
                  <span className="text-sm">@{r.username}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.map((c) => {
            const o = otherUser(c);
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)} className={`w-full flex items-center gap-3 p-4 hover:bg-card text-left ${activeId === c.id ? "bg-card" : ""}`}>
                <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
                  {o?.avatar_url ? <img src={o.avatar_url} className="w-full h-full object-cover" /> : o?.username?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{o?.display_name || o?.username || "Chat"}</div>
                  <div className="text-xs text-muted-foreground truncate">@{o?.username}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {activeId ? (
          <>
            {/* Header */}
            {(() => {
              const activeConv = convs.find((c) => c.id === activeId);
              const o = activeConv ? otherUser(activeConv) : null;
              return (
                <div className="p-4 border-b border-border/40 flex items-center justify-between glass sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
                      {o?.avatar_url ? <img src={o.avatar_url} className="w-full h-full object-cover" /> : o?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <div className="font-semibold">{o?.display_name || o?.username || "Chat"}</div>
                      <div className="text-xs text-muted-foreground">@{o?.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => o && initiateCall(o.id, 'voice')} 
                      title="Voice Call"
                      className="w-10 h-10 rounded-full grid place-items-center text-[#9333ea] hover:bg-secondary transition-colors"
                    >
                      <Phone className="w-5 h-5 fill-current" />
                    </button>
                    <button 
                      onClick={() => o && initiateCall(o.id, 'video')} 
                      title="Video Call"
                      className="w-10 h-10 rounded-full grid place-items-center text-[#9333ea] hover:bg-secondary transition-colors"
                    >
                      <Video className="w-5 h-5 fill-current" />
                    </button>
                    <button 
                      title="Conversation Info"
                      className="w-10 h-10 rounded-full grid place-items-center text-[#9333ea] hover:bg-secondary transition-colors"
                    >
                      <Info className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="flex-1 overflow-y-auto p-6 space-y-3 relative z-0">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-2 ${m.sender_id === user?.id ? "bg-gradient-vivid text-white" : "glass"}`}>
                    <div className="text-sm">{m.content}</div>
                    <div className="text-[10px] opacity-70 mt-1">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); sendMsg(); }} className="p-4 border-t border-border/40 flex gap-2">
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1 rounded-full bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary" />
              <button type="submit" className="rounded-full bg-gradient-vivid px-5 grid place-items-center text-white shadow-glow"><Send className="w-4 h-4" /></button>
            </form>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground">Select or start a conversation</div>
        )}
      </div>
    </div>
  );
}
