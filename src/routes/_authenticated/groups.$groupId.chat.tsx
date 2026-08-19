import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  getMessages, getGroupDetails, sendMessage, deleteMessage,
  addReaction, removeReaction, uploadGroupMedia, compressImage,
  shareCurrentLocation, startLiveLocation, stopLiveLocation,
  createPoll, votePoll,
} from "@/lib/barkada-api";
import {
  enqueueMessage, getQueuedMessages, deleteQueuedMessage, cacheMessages, getCachedMessages,
} from "@/lib/offline-queue";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useLiveLocation } from "@/hooks/useLiveLocation";
import {
  Send, Paperclip, Image, Smile, MapPin, Navigation, Phone, Video, Info,
  MoreVertical, Reply, Trash2, Copy, Pin, Loader2, ChevronLeft, Play,
  BarChart2, AlertTriangle, X, CheckCheck, Check as CheckIcon,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups/$groupId/chat")({ component: GroupChatPage });

const EMOJIS = ["❤️", "😂", "😮", "😢", "😠", "👍", "🔥", "🎉"];

function GroupChatPage() {
  const { groupId } = Route.useParams();
  const { user, profile } = useAuthContext();
  const navigate = useNavigate();
  const { status: connStatus, isOnline } = useConnectionStatus();
  const { getCurrentPosition, startWatching, stopWatching, session: liveSession } = useLiveLocation();

  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const [showLocationMenu, setShowLocationMenu] = useState(false);
  const [showLiveDuration, setShowLiveDuration] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState<number | null>(null);
  const [queuedMsgIds, setQueuedMsgIds] = useState<Set<string>>(new Set());
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<number | null>(null);
  const presenceChannel = useRef<any>(null);

  // ---- Load group and messages ----
  useEffect(() => {
    if (user && groupId) {
      loadGroup();
      loadMessages();
    }
    return () => {
      presenceChannel.current?.unsubscribe();
    };
  }, [groupId, user?.id]);

  // ---- Realtime subscription ----
  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`group-chat-${groupId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${groupId}` },
        async (payload) => {
          const newMsg = payload.new as any;
          // Fetch full message with profile join
          const { data } = await supabase
            .from("messages")
            .select("*, profiles:sender_id(id, username, display_name, avatar_url), message_attachments(*), message_reactions(*, profiles:user_id(username, avatar_url))")
            .eq("id", newMsg.id)
            .single();
          if (data) {
            setMessages((prev) => {
              // Avoid duplicates (client-sent messages)
              if (prev.find((m) => m.id === data.id || (data.client_id && prev.find((m) => m.client_id === data.client_id)))) return prev;
              return [...prev, data];
            });
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${groupId}` },
        (payload) => {
          setMessages((prev) => prev.map((m) => m.id === payload.new.id ? { ...m, ...payload.new } : m));
        })
      .subscribe();

    // Presence for typing
    presenceChannel.current = supabase.channel(`presence-${groupId}`)
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.current.presenceState();
        const typingNow = Object.values(state)
          .flat()
          .filter((p: any) => p.typing && p.user_id !== user?.id)
          .map((p: any) => p.username);
        setTypingUsers(typingNow as string[]);
      })
      .subscribe(async () => {
        await presenceChannel.current.track({ user_id: user?.id, username: profile?.username, typing: false });
      });

    return () => {
      supabase.removeChannel(ch);
      presenceChannel.current?.unsubscribe();
    };
  }, [groupId, user?.id]);

  // ---- Flush queued messages on reconnect ----
  useEffect(() => {
    if (isOnline) {
      flushQueue();
    }
  }, [isOnline]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function loadGroup() {
    try {
      const g = await getGroupDetails(groupId);
      setGroup(g);
    } catch { toast.error("Failed to load group"); }
  }

  async function loadMessages() {
    setLoading(true);
    try {
      if (isOnline) {
        const msgs = await getMessages(groupId, 50);
        setMessages(msgs);
        await cacheMessages(msgs);
      } else {
        const cached = await getCachedMessages(groupId);
        setMessages(cached as any[]);
      }
    } catch {
      const cached = await getCachedMessages(groupId);
      setMessages(cached as any[]);
    } finally {
      setLoading(false);
    }
  }

  async function flushQueue() {
    const queued = await getQueuedMessages();
    const mine = queued.filter((q) => q.conversation_id === groupId);
    for (const q of mine) {
      try {
        await sendMessage({
          conversationId: q.conversation_id,
          senderId: q.sender_id,
          content: q.content,
          messageType: q.message_type,
          replyTo: q.reply_to,
          clientId: q.client_id,
        });
        await deleteQueuedMessage(q.client_id);
        setQueuedMsgIds((prev) => { const n = new Set(prev); n.delete(q.client_id); return n; });
      } catch { /* Will retry next online event */ }
    }
  }

  function handleTyping(val: string) {
    setText(val);
    if (!presenceChannel.current) return;
    presenceChannel.current.track({ user_id: user?.id, username: profile?.username, typing: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = window.setTimeout(() => {
      presenceChannel.current?.track({ user_id: user?.id, username: profile?.username, typing: false });
    }, 2000);
  }

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user || !text.trim()) return;
    const content = text.trim();
    setText("");
    setReplyTo(null);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    presenceChannel.current?.track({ user_id: user.id, username: profile?.username, typing: false });

    const clientId = crypto.randomUUID?.() ?? Math.random().toString(36);

    if (!isOnline) {
      await enqueueMessage({
        client_id: clientId,
        conversation_id: groupId,
        sender_id: user.id,
        content,
        message_type: "text",
        reply_to: replyTo?.id ?? null,
        queued_at: Date.now(),
        status: "queued",
      });
      const optimistic = {
        id: clientId, client_id: clientId, conversation_id: groupId,
        sender_id: user.id, content, message_type: "text",
        created_at: new Date().toISOString(), is_deleted: false,
        profiles: profile, _queued: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setQueuedMsgIds((prev) => new Set([...prev, clientId]));
      toast.info("Message queued — will send when online");
      return;
    }

    setSending(true);
    try {
      await sendMessage({ conversationId: groupId, senderId: user.id, content, messageType: "text", replyTo: replyTo?.id, clientId });
    } catch { toast.error("Failed to send message"); setText(content); }
    finally { setSending(false); }
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !user) return;
    if (!isOnline) { toast.error("Cannot upload files while offline"); return; }
    for (const rawFile of files) {
      const isImage = rawFile.type.startsWith("image/");
      setMediaUploadProgress(0);
      try {
        const file = isImage ? await compressImage(rawFile) : rawFile;
        const url = await uploadGroupMedia(file, user.id, groupId);
        setMediaUploadProgress(80);
        const msg = await sendMessage({ conversationId: groupId, senderId: user.id, messageType: isImage ? "image" : "video" });
        // Attach the url
        await supabase.from("message_attachments").insert({
          message_id: msg.id, url,
          mime_type: file.type,
          file_name: file.name,
          size_bytes: file.size,
        });
        setMediaUploadProgress(100);
        setTimeout(() => setMediaUploadProgress(null), 1000);
      } catch (err: any) {
        toast.error("Upload failed: " + err.message);
        setMediaUploadProgress(null);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCurrentLocation() {
    setShowLocationMenu(false);
    try {
      toast.info("Getting your location...");
      const loc = await getCurrentPosition();
      await shareCurrentLocation({ userId: user!.id, conversationId: groupId, latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy });
      toast.success("Location shared!");
    } catch (e: any) {
      if (e.code === 1) toast.error("Location permission denied");
      else toast.error("Could not get location: " + e.message);
    }
  }

  async function handleStartLiveLocation(durationMinutes: number | null) {
    setShowLiveDuration(false);
    setShowLocationMenu(false);
    try {
      const loc = await getCurrentPosition();
      const sess = await startLiveLocation({ userId: user!.id, conversationId: groupId, latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, durationMinutes });
      startWatching({ sessionId: sess.id, conversationId: groupId, expiresAt: sess.expires_at ? new Date(sess.expires_at) : null, startedAt: new Date() });
      toast.success("Live location started 📍");
    } catch (e: any) {
      toast.error("Could not start live location: " + e.message);
    }
  }

  async function handleStopLiveLocation() {
    if (liveSession) {
      await stopWatching();
      await stopLiveLocation(liveSession.sessionId, liveSession.conversationId, user!.id);
      toast.info("Stopped sharing live location");
    }
  }

  async function handleCreatePoll() {
    if (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      toast.error("Add a question and at least 2 options");
      return;
    }
    try {
      await createPoll({ conversationId: groupId, creatorId: user!.id, question: pollQuestion, options: pollOptions.filter(o => o.trim()) });
      setShowPollForm(false);
      setPollQuestion(""); setPollOptions(["", ""]);
      toast.success("Poll created!");
    } catch { toast.error("Failed to create poll"); }
  }

  async function handleDeleteMessage(msgId: string) {
    setContextMenu(null);
    try {
      await deleteMessage(msgId);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, is_deleted: true, content: null } : m));
    } catch { toast.error("Failed to delete message"); }
  }

  async function handleReaction(msgId: string, emoji: string) {
    setShowEmojiFor(null);
    const msg = messages.find(m => m.id === msgId);
    const existing = msg?.message_reactions?.find((r: any) => r.user_id === user?.id && r.emoji === emoji);
    try {
      if (existing) await removeReaction(msgId, user!.id, emoji);
      else await addReaction(msgId, user!.id, emoji);
    } catch { toast.error("Failed to react"); }
  }

  const members = group?.conversation_participants ?? [];
  const myRole = members.find((m: any) => m.user_id === user?.id)?.role;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* ---- Header ---- */}
      <div className="glass border-b border-border/40 px-4 py-3 flex items-center gap-3 sticky top-0 z-20">
        <Link to="/friends" className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition md:hidden">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        {group && (
          <>
            <div className="w-10 h-10 rounded-xl bg-gradient-vivid grid place-items-center text-white font-bold overflow-hidden flex-shrink-0">
              {group.avatar_url
                ? <img src={group.avatar_url} className="w-full h-full object-cover" alt="" />
                : group.name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{group.name}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{members.length} members</span>
                {typingUsers.length > 0 && <span className="text-primary animate-pulse">· {typingUsers[0]} is typing...</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link to="/groups/$groupId/map" params={{ groupId }} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition text-primary" title="Group Map">
                <MapPin className="w-5 h-5" />
              </Link>
              <Link to="/groups/$groupId/settings" params={{ groupId }} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center transition" title="Settings">
                <Info className="w-5 h-5" />
              </Link>
            </div>
          </>
        )}
      </div>

      {/* ---- Live location banner ---- */}
      {liveSession && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-2 flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-primary font-medium">
            <Navigation className="w-4 h-4 animate-pulse" /> Sharing your live location
          </span>
          <button onClick={handleStopLiveLocation} className="text-red-400 hover:text-red-300 font-medium transition">Stop</button>
        </div>
      )}

      {/* ---- Offline banner ---- */}
      {!isOnline && (
        <div className="bg-orange-500/10 border-b border-orange-500/20 px-4 py-2 text-sm text-orange-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Offline — Messages will send when you're back online.
        </div>
      )}

      {/* ---- Upload progress ---- */}
      {mediaUploadProgress !== null && (
        <div className="px-4 py-1">
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${mediaUploadProgress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1">{mediaUploadProgress < 100 ? "Uploading..." : "Done ✓"}</p>
        </div>
      )}

      {/* ---- Messages ---- */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" onClick={() => { setContextMenu(null); setShowEmojiFor(null); setShowLocationMenu(false); }}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3 text-muted-foreground">
            <div className="w-16 h-16 rounded-full bg-card grid place-items-center">
              <MessageBubbleIcon />
            </div>
            <div>
              <div className="font-semibold">No messages yet</div>
              <div className="text-sm">Start the conversation!</div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id || idx}
              msg={msg}
              isMine={msg.sender_id === user?.id}
              isQueued={queuedMsgIds.has(msg.client_id ?? msg.id)}
              showAvatar={idx === 0 || messages[idx - 1]?.sender_id !== msg.sender_id}
              onReply={() => setReplyTo(msg)}
              onDelete={() => handleDeleteMessage(msg.id)}
              onShowEmoji={() => setShowEmojiFor(prev => prev === msg.id ? null : msg.id)}
              onContextMenu={(x: number, y: number) => setContextMenu({ msgId: msg.id, x, y })}
              onVotePoll={(pollId: string, optId: string) => votePoll(pollId, optId, user!.id)}
              showEmojiPicker={showEmojiFor === msg.id}
              emojis={EMOJIS}
              onReact={(e: string) => handleReaction(msg.id, e)}
              currentUserId={user?.id ?? ""}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      {/* ---- Context menu ---- */}
      {contextMenu && (
        <div
          className="fixed z-50 glass border border-border rounded-xl shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {[
            { icon: Reply, label: "Reply", action: () => { const m = messages.find(m => m.id === contextMenu.msgId); setReplyTo(m); setContextMenu(null); } },
            { icon: Copy, label: "Copy", action: () => { const m = messages.find(m => m.id === contextMenu.msgId); navigator.clipboard.writeText(m?.content ?? ""); setContextMenu(null); toast.success("Copied!"); } },
            { icon: Trash2, label: "Delete", action: () => handleDeleteMessage(contextMenu.msgId), danger: true, visible: messages.find(m => m.id === contextMenu.msgId)?.sender_id === user?.id },
          ].filter(item => item.visible !== false).map((item) => (
            <button key={item.label} onClick={item.action} className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition hover:bg-card ${item.danger ? "text-red-400" : ""}`}>
              <item.icon className="w-4 h-4" />{item.label}
            </button>
          ))}
        </div>
      )}

      {/* ---- Poll form ---- */}
      {showPollForm && (
        <div className="border-t border-border/40 p-4 glass space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Create Poll</span>
            <button onClick={() => setShowPollForm(false)}><X className="w-4 h-4" /></button>
          </div>
          <input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Your question..." className="w-full rounded-xl bg-card border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          {pollOptions.map((opt, i) => (
            <input key={i} value={opt} onChange={e => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }}
              placeholder={`Option ${i + 1}`} className="w-full rounded-xl bg-card border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" />
          ))}
          {pollOptions.length < 6 && (
            <button onClick={() => setPollOptions([...pollOptions, ""])} className="text-sm text-primary">+ Add option</button>
          )}
          <button onClick={handleCreatePoll} className="w-full py-2 rounded-full bg-gradient-to-r from-primary to-pink-500 text-white font-semibold">Create Poll</button>
        </div>
      )}

      {/* ---- Reply preview ---- */}
      {replyTo && (
        <div className="border-t border-border/40 px-4 py-2 flex items-center gap-2 glass">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-primary font-medium">Reply to {replyTo.profiles?.username}</div>
            <div className="text-sm text-muted-foreground truncate">{replyTo.content || "[Media]"}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ---- Input bar ---- */}
      <div className="border-t border-border/40 px-3 py-3 glass">
        {/* Location/Poll menu */}
        {showLocationMenu && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button onClick={handleCurrentLocation} className="flex items-center gap-2 p-3 rounded-xl bg-card hover:bg-card/80 text-sm">
              <MapPin className="w-4 h-4 text-primary" /> Share Current Location
            </button>
            <button onClick={() => setShowLiveDuration(true)} className="flex items-center gap-2 p-3 rounded-xl bg-card hover:bg-card/80 text-sm">
              <Navigation className="w-4 h-4 text-green-400" /> Live Location
            </button>
          </div>
        )}
        {showLiveDuration && (
          <div className="mb-2 grid grid-cols-2 gap-2">
            {[{ label: "15 min", minutes: 15 }, { label: "1 hour", minutes: 60 }, { label: "8 hours", minutes: 480 }, { label: "Until I stop", minutes: null }].map((opt) => (
              <button key={opt.label} onClick={() => handleStartLiveLocation(opt.minutes)} className="p-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-sm font-medium text-primary border border-primary/20">
                {opt.label}
              </button>
            ))}
            <button onClick={() => setShowLiveDuration(false)} className="col-span-2 text-sm text-muted-foreground py-1">Cancel</button>
          </div>
        )}

        <form onSubmit={handleSend} className="flex items-end gap-2">
          {/* Attachment actions */}
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center text-muted-foreground hover:text-primary transition">
              <Image className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => { setShowLocationMenu(p => !p); setShowLiveDuration(false); }} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center text-muted-foreground hover:text-primary transition">
              <MapPin className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => setShowPollForm(p => !p)} className="w-9 h-9 rounded-full hover:bg-card grid place-items-center text-muted-foreground hover:text-primary transition">
              <BarChart2 className="w-5 h-5" />
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />

          <div className="flex-1 relative">
            <textarea
              value={text}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              rows={1}
              className="w-full rounded-2xl bg-input border border-border px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary resize-none max-h-32 text-sm"
              style={{ overflowY: "auto" }}
            />
          </div>

          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-pink-500 grid place-items-center text-white shadow-glow hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---- MessageBubble ----
function MessageBubble({ msg, isMine, isQueued, showAvatar, onReply, onDelete, onShowEmoji, onContextMenu, onVotePoll, showEmojiPicker, emojis, onReact, currentUserId }: any) {
  if (msg.is_deleted) {
    return (
      <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
        <div className="text-xs text-muted-foreground italic px-4 py-1">This message was deleted</div>
      </div>
    );
  }

  const sender = msg.profiles;
  const attachments = msg.message_attachments ?? [];
  const reactions = msg.message_reactions ?? [];

  // Group reactions
  const reactionGroups: Record<string, { count: number; mine: boolean }> = {};
  for (const r of reactions) {
    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = { count: 0, mine: false };
    reactionGroups[r.emoji].count++;
    if (r.user_id === currentUserId) reactionGroups[r.emoji].mine = true;
  }

  return (
    <div className={`flex gap-2 group ${isMine ? "flex-row-reverse" : "flex-row"} items-end`}>
      {/* Avatar */}
      {!isMine && showAvatar ? (
        <div className="w-7 h-7 rounded-full bg-gradient-vivid grid place-items-center text-white text-xs font-bold overflow-hidden flex-shrink-0 mb-1">
          {sender?.avatar_url ? <img src={sender.avatar_url} className="w-full h-full object-cover" alt="" /> : sender?.username?.[0]?.toUpperCase()}
        </div>
      ) : !isMine ? <div className="w-7" /> : null}

      <div className={`max-w-[70%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
        {/* Sender name for group chats */}
        {!isMine && showAvatar && (
          <span className="text-xs text-muted-foreground ml-1">{sender?.display_name || sender?.username}</span>
        )}

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-2.5 ${
            isMine ? "bg-gradient-to-br from-primary to-pink-600 text-white rounded-br-sm" : "glass rounded-bl-sm"
          } ${isQueued ? "opacity-70" : ""}`}
          onContextMenu={(e) => { e.preventDefault(); onContextMenu(e.clientX, e.clientY); }}
        >
          {/* Poll message */}
          {msg.message_type === "poll" && msg.metadata && (
            <PollView pollId={msg.metadata.poll_id} question={msg.content} onVote={onVotePoll} currentUserId={currentUserId} />
          )}

          {/* Location message */}
          {(msg.message_type === "location" || msg.message_type === "live_location") && msg.metadata && (
            <LocationCard
              lat={msg.metadata.latitude}
              lng={msg.metadata.longitude}
              isLive={msg.message_type === "live_location"}
              accuracy={msg.metadata.accuracy}
              sentAt={msg.created_at}
              groupId={msg.conversation_id}
            />
          )}

          {/* Text */}
          {msg.content && msg.message_type === "text" && (
            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
          )}

          {/* Media attachments */}
          {attachments.length > 0 && (
            <div className={`grid gap-1 ${attachments.length > 1 ? "grid-cols-2" : "grid-cols-1"} mt-1`}>
              {attachments.map((att: any) => (
                att.mime_type?.startsWith("video/") ? (
                  <video key={att.id} src={att.url} controls className="rounded-lg max-w-full max-h-48 object-cover" />
                ) : (
                  <img key={att.id} src={att.url} className="rounded-lg object-cover max-h-48 w-full cursor-pointer" alt={att.file_name} onClick={() => window.open(att.url, "_blank")} />
                )
              ))}
            </div>
          )}

          {/* Timestamp + status */}
          <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
            <span className="text-[10px] opacity-60">{format(new Date(msg.created_at), "h:mm a")}</span>
            {isMine && (
              isQueued
                ? <span className="text-[10px] opacity-60">⏳</span>
                : <CheckCheck className="w-3 h-3 opacity-60" />
            )}
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {Object.entries(reactionGroups).map(([emoji, { count, mine }]) => (
              <button key={emoji} onClick={() => onReact(emoji)} className={`text-xs px-2 py-0.5 rounded-full border ${mine ? "border-primary bg-primary/20" : "border-border bg-card"} transition hover:scale-110`}>
                {emoji} {count > 1 && count}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons (visible on hover) */}
        <div className={`flex gap-1 opacity-0 group-hover:opacity-100 transition px-1 ${isMine ? "flex-row-reverse" : ""}`}>
          <button onClick={onShowEmoji} className="w-6 h-6 rounded-full hover:bg-card grid place-items-center text-muted-foreground hover:text-primary transition text-xs">
            😊
          </button>
          <button onClick={onReply} className="w-6 h-6 rounded-full hover:bg-card grid place-items-center text-muted-foreground hover:text-primary transition">
            <Reply className="w-3.5 h-3.5" />
          </button>
          {isMine && (
            <button onClick={onDelete} className="w-6 h-6 rounded-full hover:bg-card grid place-items-center text-muted-foreground hover:text-red-400 transition">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className={`flex gap-1 p-2 glass rounded-full border border-border shadow-lg ${isMine ? "flex-row-reverse" : ""}`}>
            {emojis.map((e: string) => (
              <button key={e} onClick={() => onReact(e)} className="text-lg hover:scale-125 transition">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LocationCard({ lat, lng, isLive, accuracy, sentAt, groupId }: any) {
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <div className="rounded-lg overflow-hidden border border-white/20 min-w-[200px]">
      <div className="bg-gradient-to-br from-primary/30 to-pink-500/20 p-3">
        <div className="flex items-center gap-2">
          {isLive ? <Navigation className="w-4 h-4 text-green-400 animate-pulse" /> : <MapPin className="w-4 h-4 text-primary" />}
          <span className="font-medium text-sm">{isLive ? "🟢 Live Location" : "📍 Location"}</span>
        </div>
        <div className="text-xs mt-1 opacity-80">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
        {accuracy && <div className="text-xs opacity-60">±{Math.round(accuracy)}m accuracy</div>}
        <div className="text-xs opacity-60">{formatDistanceToNow(new Date(sentAt), { addSuffix: true })}</div>
      </div>
      <div className="flex gap-2 p-2 bg-black/20">
        <a href={mapUrl} target="_blank" rel="noreferrer" className="flex-1 text-center text-xs py-1.5 rounded-lg bg-primary/30 hover:bg-primary/50 text-white transition">
          Open Map
        </a>
        <Link to="/groups/$groupId/map" params={{ groupId }} className="flex-1 text-center text-xs py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition">
          Group Map
        </Link>
      </div>
    </div>
  );
}

function PollView({ pollId, question, onVote, currentUserId }: any) {
  const [poll, setPoll] = useState<any>(null);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!pollId) return;
    // Fetch poll options and votes
    supabase
      .from('group_polls')
      .select('id, question, allow_multiple, group_poll_options(id, text, sort_order), group_poll_votes(id, option_id, user_id)')
      .eq('id', pollId)
      .single()
      .then(({ data }) => {
        if (data) {
          setPoll(data);
          const voted = new Set(
            (data.group_poll_votes ?? [])
              .filter((v: any) => v.user_id === currentUserId)
              .map((v: any) => v.option_id)
          );
          setMyVotes(voted);
        }
      });
  }, [pollId, currentUserId]);

  async function handleVote(optionId: string) {
    if (!poll || voting) return;
    setVoting(true);
    const alreadyVoted = myVotes.has(optionId);
    const updatedVotes = new Set(myVotes);
    if (alreadyVoted) {
      updatedVotes.delete(optionId);
      setMyVotes(updatedVotes);
      // Optimistically remove vote from UI
      setPoll((p: any) => ({
        ...p,
        group_poll_votes: p.group_poll_votes.filter((v: any) => !(v.option_id === optionId && v.user_id === currentUserId)),
      }));
      await supabase.from('group_poll_votes').delete()
        .eq('poll_id', poll.id).eq('option_id', optionId).eq('user_id', currentUserId);
    } else {
      if (!poll.allow_multiple) {
        // Single-choice: remove existing votes first
        const toRemove = [...myVotes];
        updatedVotes.clear();
        setPoll((p: any) => ({
          ...p,
          group_poll_votes: p.group_poll_votes.filter((v: any) => v.user_id !== currentUserId),
        }));
        for (const oid of toRemove) {
          await supabase.from('group_poll_votes').delete()
            .eq('poll_id', poll.id).eq('option_id', oid).eq('user_id', currentUserId);
        }
      }
      updatedVotes.add(optionId);
      setMyVotes(updatedVotes);
      setPoll((p: any) => ({
        ...p,
        group_poll_votes: [...(p.group_poll_votes ?? []), { option_id: optionId, user_id: currentUserId, id: Math.random().toString() }],
      }));
      await onVote(poll.id, optionId);
    }
    setVoting(false);
  }

  if (!pollId) {
    return (
      <div className="min-w-[200px]">
        <div className="font-medium text-sm mb-1">📊 {question}</div>
        <div className="text-xs opacity-60">Loading poll...</div>
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="min-w-[200px]">
        <div className="font-medium text-sm mb-1">📊 {question}</div>
        <div className="flex items-center gap-1.5 text-xs opacity-60 mt-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading poll...
        </div>
      </div>
    );
  }

  const options = [...(poll.group_poll_options ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
  const allVotes = poll.group_poll_votes ?? [];
  const totalVotes = allVotes.length;

  return (
    <div className="min-w-[220px] space-y-2">
      <div className="font-semibold text-sm">📊 {poll.question}</div>
      {options.map((opt: any) => {
        const voteCount = allVotes.filter((v: any) => v.option_id === opt.id).length;
        const pct = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
        const voted = myVotes.has(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => handleVote(opt.id)}
            disabled={voting}
            className={`w-full rounded-xl overflow-hidden text-left transition hover:opacity-90 ${
              voted ? 'ring-2 ring-white/40' : ''
            }`}
          >
            <div className="relative bg-white/10 rounded-xl px-3 py-2">
              <div
                className={`absolute inset-0 rounded-xl transition-all duration-500 ${
                  voted ? 'bg-white/30' : 'bg-white/10'
                }`}
                style={{ width: `${pct}%` }}
              />
              <div className="relative flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{opt.text}</span>
                <span className="text-xs opacity-70 whitespace-nowrap">{pct}% ({voteCount})</span>
              </div>
            </div>
          </button>
        );
      })}
      <div className="text-[10px] opacity-50 text-right">
        {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {poll.allow_multiple ? 'Multi-choice' : 'Single choice'}
      </div>
    </div>
  );
}

function MessageBubbleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
