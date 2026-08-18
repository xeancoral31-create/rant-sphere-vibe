import { supabase } from "@/integrations/supabase/client";

export type FollowStatus = "pending" | "accepted" | "declined";

export interface Connection {
  outgoing: FollowStatus | null; // me -> them
  incoming: FollowStatus | null; // them -> me
}

export type ConnectionState =
  | "self"
  | "none"
  | "requested" // I asked, waiting for them
  | "incoming" // they asked me, I must accept
  | "following" // they accepted me, but they don't follow me back
  | "follow_back" // they follow me (accepted), I don't follow them
  | "mutual";

export function deriveState(c: Connection, isSelf: boolean): ConnectionState {
  if (isSelf) return "self";
  const out = c.outgoing === "accepted";
  const inc = c.incoming === "accepted";
  if (out && inc) return "mutual";
  if (c.outgoing === "pending") return "requested";
  if (c.incoming === "pending") return "incoming";
  if (out) return "following";
  if (inc) return "follow_back";
  return "none";
}

export async function loadConnection(meId: string, otherId: string): Promise<Connection> {
  const [{ data: out }, { data: inc }] = await Promise.all([
    supabase
      .from("follows")
      .select("status")
      .eq("follower_id", meId)
      .eq("following_id", otherId)
      .maybeSingle(),
    supabase
      .from("follows")
      .select("status")
      .eq("follower_id", otherId)
      .eq("following_id", meId)
      .maybeSingle(),
  ]);
  return {
    outgoing: ((out as { status?: FollowStatus } | null)?.status ?? null) as FollowStatus | null,
    incoming: ((inc as { status?: FollowStatus } | null)?.status ?? null) as FollowStatus | null,
  };
}

export async function sendRequest(meId: string, otherId: string) {
  const { error } = await supabase
    .from("follows")
    .upsert({ follower_id: meId, following_id: otherId, status: "pending" } as never);
  if (error) throw new Error(error.message);
  await supabase.from("notifications").insert({ user_id: otherId, actor_id: meId, type: "follow" } as never);
}

export async function cancelOrUnfollow(meId: string, otherId: string) {
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", meId)
    .eq("following_id", otherId);
  if (error) throw new Error(error.message);
}

export async function respondToRequest(meId: string, otherId: string, accept: boolean) {
  const { error } = await supabase
    .from("follows")
    .update({ status: accept ? "accepted" : "declined" } as never)
    .eq("follower_id", otherId)
    .eq("following_id", meId);
  if (error) throw new Error(error.message);
  if (accept) {
    await supabase
      .from("notifications")
      .insert({ user_id: otherId, actor_id: meId, type: "follow", content: "accepted your follow request" } as never);
  }
}

export async function removeConnection(meId: string, otherId: string) {
  await supabase.from("follows").delete().eq("follower_id", meId).eq("following_id", otherId);
  await supabase.from("follows").delete().eq("follower_id", otherId).eq("following_id", meId);
}
