import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useCallContext } from "@/components/call/CallProvider";
import { Send, Phone, Video, Info, Users2, Search, MessageSquare, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/messages")({ component: MessagesPage });

interface Conv {
  id: string;
  name: string | null;
  is_group: boolean;
  is_barkada: boolean;
  avatar_url: string | null;
  updated_at: string;
  participants?: { user_id: string; profiles: any }[];
  last_message?: { content: string | null; created_at: string; message_type: string } | null;
}
interface Msg { id: string; sender_id: string; content: string | null; created_at: string }

function MessagesPage() {
  const { user } = useAuthContext();
  const { initiateCall } = useCallContext();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [searchUser, setSearchUser] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadConvs();
  }, [user?.id]);

  useEffect(() => {
    if (activeId) loadMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`msg-${activeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeId}` }, (payload) => {
        setMsgs((m) => [...m, payload.new as Msg]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function loadConvs() {
    if (!user) return;
    const { data: parts } = await (supabase.from("conversation_participants") as any)
      .select("conversation_id")
      .eq("user_id", user.id);
    const ids = (parts ?? []).map((p: any) => p.conversation_id);
    if (!ids.length) return setConvs([]);

    const { data } = await (supabase.from("conversations") as any)
      .select("*, conversation_participants(user_id, profiles(username, display_name, avatar_url))")
      .in("id", ids)
      .order("updated_at", { ascending: false });

    // Load last message for each conversation
    const formatted = await Promise.all(
      (data ?? []).map(async (c: any) => {
        const { data: lastMsg } = await (supabase.from("messages") as any)
          .select("content, created_at, message_type")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          id: c.id,
          name: c.name,
          is_group: c.is_group ?? false,
          is_barkada: c.is_barkada ?? false,
          avatar_url: c.avatar_url ?? null,
          updated_at: c.updated_at,
          participants: c.conversation_participants,
          last_message: lastMsg,
        };
      })
    );

    setConvs(formatted);
    if (formatted.length > 0 && !activeId) {
      setActiveId(formatted[0].id);
    }
  }

  async function loadMessages(cid: string) {
    const { data } = await (supabase.from("messages") as any)
      .select("*")
      .eq("conversation_id", cid)
      .order("created_at", { ascending: true })
      .limit(100);
    setMsgs((data ?? []) as Msg[]);
  }

  async function sendMsg() {
    if (!user || !activeId || !text.trim()) return;
    const content = text.trim();
    setText("");
    await (supabase.from("messages") as any).insert({ conversation_id: activeId, sender_id: user.id, content });
    await (supabase.from("conversations") as any).update({ updated_at: new Date().toISOString() }).eq("id", activeId);
    loadConvs();
  }

  async function searchUsers(q: string) {
    setSearchUser(q);
    if (q.length < 2) return setResults([]);
    const { data } = await supabase.from("profiles").select("*").ilike("username", `%${q}%`).neq("id", user?.id ?? "").limit(8);
    setResults(data ?? []);
  }

  async function startConv(otherId: string) {
    if (!user) return;
    const { data: mine } = await (supabase.from("conversation_participants") as any).select("conversation_id").eq("user_id", user.id);
    const myIds = (mine ?? []).map((m: any) => m.conversation_id);
    if (myIds.length) {
      const { data: shared } = await (supabase.from("conversation_participants") as any).select("conversation_id").eq("user_id", otherId).in("conversation_id", myIds);
      if (shared && shared.length) {
        setActiveId(shared[0].conversation_id);
        setSearchUser("");
        setResults([]);
        return;
      }
    }
    const { data: c } = await (supabase.from("conversations") as any).insert({ is_group: false }).select().single();
    if (!c) return;
    await (supabase.from("conversation_participants") as any).insert([{ conversation_id: c.id, user_id: user.id }, { conversation_id: c.id, user_id: otherId }]);
    await loadConvs();
    setActiveId(c.id);
    setSearchUser("");
    setResults([]);
  }

  function getOtherUser(c: Conv) {
    return c.participants?.find((p) => p.user_id !== user?.id)?.profiles;
  }

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar - Conversations list */}
      <div className="w-80 md:w-88 border-r border-border/40 flex flex-col glass">
        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-primary to-pink-400 bg-clip-text text-transparent">
              Messages
            </h1>
            <Link
              to="/friends/create-group"
              className="p-2 rounded-full glass hover:bg-card text-xs font-semibold text-primary flex items-center gap-1 transition"
              title="Create Barkada Group"
            >
              <Users2 className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchUser}
              onChange={(e) => searchUsers(e.target.value)}
              placeholder="Search or start chat..."
              className="w-full rounded-xl bg-card border border-border/40 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>

          {results.length > 0 && (
            <div className="mt-2 space-y-1 max-h-48 overflow-y-auto rounded-xl border border-border/40 bg-card p-1">
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => startConv(r.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-primary/10 text-left transition"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold shrink-0">
                    {r.avatar_url ? <img src={r.avatar_url} className="w-full h-full object-cover rounded-full" alt="" /> : r.username[0]?.toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">{r.display_name || r.username}</div>
                    <div className="text-[11px] text-muted-foreground">@{r.username}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversations scroll area */}
        <div className="flex-1 overflow-y-auto space-y-0.5 p-2">
          {convs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
              <div>No conversations yet</div>
              <div>Start a chat or create a group to begin!</div>
            </div>
          ) : (
            convs.map((c) => {
              const other = getOtherUser(c);
              const isGroup = c.is_group || c.is_barkada;
              const title = isGroup ? c.name || "Barkada Group" : other?.display_name || other?.username || "Chat";
              const subtitle = isGroup ? `${c.participants?.length ?? 0} members` : `@${other?.username || "user"}`;
              const lastText = c.last_message?.content || (c.last_message?.message_type ? `[${c.last_message.message_type}]` : "No messages yet");

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    if (isGroup) {
                      navigate({ to: "/groups/$groupId/chat", params: { groupId: c.id } });
                    } else {
                      setActiveId(c.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl cursor-pointer transition text-left ${
                    activeId === c.id ? "bg-primary/15 border border-primary/30" : "hover:bg-card/60"
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden shrink-0 relative">
                    {isGroup ? (
                      c.avatar_url ? (
                        <img src={c.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <Users2 className="w-5 h-5 text-white" />
                      )
                    ) : other?.avatar_url ? (
                      <img src={other.avatar_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      title[0]?.toUpperCase()
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm truncate flex items-center gap-1">
                        <span>{title}</span>
                        {isGroup && <span className="text-[10px] bg-primary/20 text-primary font-bold px-1.5 py-0.5 rounded-full">Group</span>}
                      </div>
                      {c.updated_at && (
                        <span className="text-[10px] text-muted-foreground/80 shrink-0">
                          {formatDistanceToNow(new Date(c.updated_at), { addSuffix: false })}
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground truncate mt-0.5">{lastText}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col bg-background">
        {activeId ? (
          <>
            {/* Header */}
            {(() => {
              const activeConv = convs.find((c) => c.id === activeId);
              const o = activeConv ? getOtherUser(activeConv) : null;
              const isGroup = activeConv?.is_group || activeConv?.is_barkada;
              const title = isGroup ? activeConv.name || "Barkada Group" : o?.display_name || o?.username || "Chat";

              return (
                <div className="p-4 border-b border-border/40 flex items-center justify-between glass sticky top-0 z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden">
                      {isGroup ? (
                        activeConv?.avatar_url ? <img src={activeConv.avatar_url} className="w-full h-full object-cover" alt="" /> : <Users2 className="w-5 h-5 text-white" />
                      ) : o?.avatar_url ? (
                        <img src={o.avatar_url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        title[0]?.toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-semibold">{title}</div>
                      <div className="text-xs text-muted-foreground">
                        {isGroup ? `${activeConv?.participants?.length ?? 0} members` : `@${o?.username || "user"}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isGroup && (
                      <>
                        <button
                          onClick={() => o && initiateCall(o.id, "voice")}
                          title="Voice Call"
                          className="w-9 h-9 rounded-full grid place-items-center text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition"
                        >
                          <Phone className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => o && initiateCall(o.id, "video")}
                          title="Video Call"
                          className="w-9 h-9 rounded-full grid place-items-center text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition"
                        >
                          <Video className="w-4.5 h-4.5" />
                        </button>
                      </>
                    )}
                    {isGroup && (
                      <Link
                        to="/groups/$groupId/chat"
                        params={{ groupId: activeConv!.id }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/30 transition"
                      >
                        Open Group Chat <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Messages body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3 relative z-0">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-md rounded-2xl px-4 py-2.5 ${m.sender_id === user?.id ? "bg-gradient-to-r from-primary to-pink-500 text-white shadow-glow" : "glass"}`}>
                    <div className="text-sm">{m.content}</div>
                    <div className="text-[10px] opacity-70 mt-1 text-right">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</div>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={(e) => { e.preventDefault(); sendMsg(); }} className="p-4 border-t border-border/40 flex gap-2 glass">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-full bg-card border border-border px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary font-medium"
              />
              <button type="submit" className="rounded-full bg-gradient-to-r from-primary to-pink-500 px-5 grid place-items-center text-white shadow-glow hover:scale-105 transition">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 grid place-items-center text-muted-foreground text-sm">
            <div className="text-center space-y-2">
              <MessageSquare className="w-12 h-12 mx-auto opacity-30 text-primary" />
              <div>Select a conversation or start a new chat</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
