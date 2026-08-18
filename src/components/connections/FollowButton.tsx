import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, UserCheck, UserPlus, Users, X } from "lucide-react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import {
  cancelOrUnfollow,
  deriveState,
  loadConnection,
  removeConnection,
  respondToRequest,
  sendRequest,
  type ConnectionState,
} from "@/lib/connections";

export function FollowButton({
  targetId,
  username,
  onChange,
}: {
  targetId: string;
  username?: string;
  onChange?: () => void;
}) {
  const { user } = useAuthContext();
  const [state, setState] = useState<ConnectionState>("none");
  const [busy, setBusy] = useState(false);

  const isSelf = user?.id === targetId;

  async function refresh() {
    if (!user) return;
    const c = await loadConnection(user.id, targetId);
    setState(deriveState(c, isSelf));
  }

  useEffect(() => {
    void refresh();
  }, [user?.id, targetId]);

  if (!user || isSelf) return null;

  async function act(fn: () => Promise<void>, msg: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      await refresh();
      onChange?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const base =
    "rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-50 inline-flex items-center gap-2";

  if (state === "incoming") {
    return (
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={() => act(() => respondToRequest(user.id, targetId, true), "Request accepted")}
          className={`${base} bg-gradient-vivid text-white shadow-glow`}
        >
          <Check className="w-4 h-4" /> Accept
        </button>
        <button
          disabled={busy}
          onClick={() => act(() => respondToRequest(user.id, targetId, false), "Request declined")}
          className={`${base} glass`}
        >
          <X className="w-4 h-4" /> Decline
        </button>
      </div>
    );
  }

  const config: Record<string, { label: string; icon: typeof UserPlus; cls: string; run: () => Promise<void>; msg: string }> = {
    none: {
      label: "Follow",
      icon: UserPlus,
      cls: "bg-gradient-vivid text-white shadow-glow",
      run: () => sendRequest(user.id, targetId),
      msg: `Request sent${username ? ` to @${username}` : ""}`,
    },
    follow_back: {
      label: "Follow back",
      icon: UserPlus,
      cls: "bg-gradient-vivid text-white shadow-glow",
      run: () => sendRequest(user.id, targetId),
      msg: "Request sent",
    },
    requested: {
      label: "Requested",
      icon: Clock,
      cls: "glass",
      run: () => cancelOrUnfollow(user.id, targetId),
      msg: "Request cancelled",
    },
    following: {
      label: "Following",
      icon: UserCheck,
      cls: "glass",
      run: () => cancelOrUnfollow(user.id, targetId),
      msg: "Unfollowed",
    },
    mutual: {
      label: "Connected",
      icon: Users,
      cls: "glass border-primary/40",
      run: () => removeConnection(user.id, targetId),
      msg: "Connection removed",
    },
  };

  const c = config[state] ?? config["none"]!;
  const Icon = c.icon;

  return (
    <button disabled={busy} onClick={() => act(c.run, c.msg)} className={`${base} ${c.cls}`}>
      <Icon className="w-4 h-4" /> {c.label}
    </button>
  );
}
