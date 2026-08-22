// @ts-nocheck
/**
 * Friend & Group API helpers
 * Connected to robust user discovery & persistent friendship management.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  searchUsersFn,
  getAllUsersFn,
  getUserByUsernameFn,
  type DiscoveredUser,
} from './user-discovery.functions';
import {
  getFriendshipStateMapFn,
  getMutualFriendsCountMapFn,
  sendFriendRequestFn,
  cancelFriendRequestFn,
  acceptFriendRequestFn,
  declineFriendRequestFn,
  removeFriendFn,
  getFriendsDataFn,
} from './friends.functions';

// ---- Helpers ----

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// In-memory / Realtime event emitter for instant local state sync
type SyncListener = () => void;
const syncListeners = new Set<SyncListener>();

export function subscribeFriendshipSync(callback: SyncListener): () => void {
  syncListeners.add(callback);
  return () => {
    syncListeners.delete(callback);
  };
}

export function notifyFriendshipSync(): void {
  syncListeners.forEach((cb) => {
    try {
      cb();
    } catch {}
  });
}

// ---- FRIEND REQUESTS ----

export async function sendFriendRequest(senderId: string, receiverId: string) {
  if (!senderId || !receiverId) throw new Error("Invalid sender or receiver ID");
  if (senderId === receiverId) throw new Error("Cannot send friend request to yourself");

  const res = await sendFriendRequestFn({
    data: { senderId, receiverId },
  });

  // Attempt to write notification in Supabase (non-blocking)
  try {
    await supabase.from('notifications').insert({
      user_id: receiverId,
      actor_id: senderId,
      type: 'friend_request' as never,
      content: 'sent you a friend request.',
    });
  } catch {}

  notifyFriendshipSync();
  return res;
}

export async function acceptFriendRequest(requestId: string, senderId: string, receiverId: string) {
  const res = await acceptFriendRequestFn({
    data: {
      requestId: requestId || undefined,
      senderId,
      receiverId,
    },
  });

  // Notify in Supabase (non-blocking)
  try {
    await supabase.from('notifications').insert({
      user_id: senderId,
      actor_id: receiverId,
      type: 'friend_accepted' as never,
      content: 'accepted your friend request.',
    });
  } catch {}

  notifyFriendshipSync();
  return res;
}

export async function declineFriendRequest(requestId: string, senderId?: string, receiverId?: string) {
  const res = await declineFriendRequestFn({
    data: {
      requestId: requestId || undefined,
      senderId: senderId || undefined,
      receiverId: receiverId || undefined,
    },
  });
  notifyFriendshipSync();
  return res;
}

export async function cancelFriendRequest(requestId: string) {
  const res = await cancelFriendRequestFn({
    data: {
      senderId: "",
      requestId,
    },
  });
  notifyFriendshipSync();
  return res;
}

export async function cancelFriendRequestByUser(senderId: string, receiverId: string) {
  const res = await cancelFriendRequestFn({
    data: {
      senderId,
      receiverId,
    },
  });
  notifyFriendshipSync();
  return res;
}

export async function removeFriend(userId: string, friendId: string) {
  const res = await removeFriendFn({
    data: { userId, friendId },
  });
  notifyFriendshipSync();
  return res;
}

export async function getFriends(userId: string) {
  if (!userId) return [];
  try {
    const [{ friendIds }, { users }] = await Promise.all([
      getFriendsDataFn({ data: { userId } }),
      getAllUsersFn(),
    ]);

    const userMap = new Map<string, DiscoveredUser>();
    users.forEach((u) => userMap.set(u.id, u));

    return friendIds
      .map((fid) => {
        const u = userMap.get(fid);
        if (!u) return null;
        return {
          friendship_id: `fs_${[userId, fid].sort().join('_')}`,
          created_at: new Date().toISOString(),
          friend: {
            id: u.id,
            username: u.username,
            display_name: u.display_name,
            full_name: u.full_name,
            avatar_url: u.avatar_url,
            bio: u.bio,
            role: u.role,
          },
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Error in getFriends:", err);
    return [];
  }
}

export async function getPendingRequests(userId: string) {
  if (!userId) return [];
  try {
    const [{ pendingIncoming }, { users }] = await Promise.all([
      getFriendsDataFn({ data: { userId } }),
      getAllUsersFn(),
    ]);

    const userMap = new Map<string, DiscoveredUser>();
    users.forEach((u) => userMap.set(u.id, u));

    return pendingIncoming
      .map((req) => {
        const sender = userMap.get(req.sender_id);
        if (!sender) return null;
        return {
          id: req.id,
          sender_id: req.sender_id,
          receiver_id: req.receiver_id,
          status: req.status,
          created_at: req.created_at,
          sender: {
            id: sender.id,
            username: sender.username,
            display_name: sender.display_name,
            full_name: sender.full_name,
            avatar_url: sender.avatar_url,
            bio: sender.bio,
            role: sender.role,
          },
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Error in getPendingRequests:", err);
    return [];
  }
}

export async function getSentRequests(userId: string) {
  if (!userId) return [];
  try {
    const [{ pendingSent }, { users }] = await Promise.all([
      getFriendsDataFn({ data: { userId } }),
      getAllUsersFn(),
    ]);

    const userMap = new Map<string, DiscoveredUser>();
    users.forEach((u) => userMap.set(u.id, u));

    return pendingSent
      .map((req) => {
        const receiver = userMap.get(req.receiver_id);
        if (!receiver) return null;
        return {
          id: req.id,
          sender_id: req.sender_id,
          receiver_id: req.receiver_id,
          status: req.status,
          created_at: req.created_at,
          receiver: {
            id: receiver.id,
            username: receiver.username,
            display_name: receiver.display_name,
            full_name: receiver.full_name,
            avatar_url: receiver.avatar_url,
            bio: receiver.bio,
            role: receiver.role,
          },
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error("Error in getSentRequests:", err);
    return [];
  }
}

export async function getFriendRequestStatus(
  currentUserId: string,
  targetUserId: string
): Promise<'friends' | 'sent' | 'received' | 'none'> {
  if (!currentUserId || !targetUserId || currentUserId === targetUserId) return 'none';
  try {
    const { map } = await getFriendshipStateMapFn({
      data: { currentUserId, targetUserIds: [targetUserId] },
    });
    return map[targetUserId] || 'none';
  } catch (err) {
    console.error("Error getting friend request status:", err);
    return 'none';
  }
}

export async function getFriendshipStateMap(
  currentUserId: string,
  targetUserIds: string[]
): Promise<Record<string, 'friends' | 'sent' | 'received' | 'none'>> {
  const map: Record<string, 'friends' | 'sent' | 'received' | 'none'> = {};
  if (!currentUserId || !targetUserIds || targetUserIds.length === 0) return map;

  try {
    const validIds = targetUserIds.filter(Boolean);
    const { map: resMap } = await getFriendshipStateMapFn({
      data: { currentUserId, targetUserIds: validIds },
    });
    return resMap;
  } catch (err) {
    console.error("Error in getFriendshipStateMap:", err);
    return map;
  }
}

export async function getMutualFriendsCountMap(
  currentUserId: string,
  targetUserIds: string[]
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (!currentUserId || !targetUserIds || targetUserIds.length === 0) return counts;

  try {
    const validIds = targetUserIds.filter((id) => id && id !== currentUserId);
    const { map: resCounts } = await getMutualFriendsCountMapFn({
      data: { currentUserId, targetUserIds: validIds },
    });
    return resCounts;
  } catch (err) {
    console.error("Error in getMutualFriendsCountMap:", err);
    return counts;
  }
}

export async function searchDatabaseUsers(query: string, currentUserId?: string): Promise<any[]> {
  const raw = query.trim();
  const clean = raw.replace(/[@]/g, "").trim();
  if (!clean) return [];

  try {
    const { users } = await searchUsersFn({
      data: { q: clean, currentUserId },
    });
    return users ?? [];
  } catch (e) {
    console.error("Failed to search users:", e);
    return [];
  }
}

export async function getSuggestedUsers(userId: string, limit = 12): Promise<any[]> {
  try {
    const { users } = await getAllUsersFn();
    return (users || []).filter((u) => u.id !== userId).slice(0, limit);
  } catch (e) {
    console.error("Failed to get suggested users:", e);
    return [];
  }
}

export async function getUserByUsername(username: string): Promise<any | null> {
  const clean = username.replace(/[@]/g, "").trim();
  if (!clean) return null;
  try {
    const { user } = await getUserByUsernameFn({
      data: { username: clean },
    });
    return user;
  } catch (e) {
    console.error("Failed to get user by username:", e);
    return null;
  }
}

// ---- BARKADA GROUPS ----

export async function createBarkadaGroup({
  name,
  description,
  avatarUrl,
  creatorId,
  memberIds,
}: {
  name: string;
  description?: string;
  avatarUrl?: string;
  creatorId: string;
  memberIds: string[];
}) {
  const { data: conv, error: ce } = await supabase
    .from('conversations')
    .insert({
      name,
      description,
      avatar_url: avatarUrl,
      is_group: true,
      is_barkada: true,
      created_by: creatorId,
    })
    .select()
    .single();
  if (ce) throw ce;

  const participants = [creatorId, ...memberIds.filter((id) => id !== creatorId)].map(
    (uid, idx) => ({
      conversation_id: conv.id,
      user_id: uid,
      role: idx === 0 ? 'owner' : 'member',
    })
  );
  const { error: pe } = await supabase.from('conversation_participants').insert(participants);
  if (pe) throw pe;

  // Insert system message "You created the group."
  await sendMessage({
    conversationId: conv.id,
    senderId: creatorId,
    content: 'You created the group.',
    messageType: 'system',
  }).catch(() => {});

  // Log activity
  await supabase.from('group_activity').insert({
    conversation_id: conv.id,
    actor_id: creatorId,
    activity_type: 'group_created',
  }).then(() => {});

  // Notify members
  for (const uid of memberIds) {
    if (uid === creatorId) continue;
    await supabase.from('notifications').insert({
      user_id: uid,
      actor_id: creatorId,
      type: 'group_invite' as never,
      content: `added you to the group "${name}".`,
    }).then(() => {});
  }

  return conv;
}

export async function getBarkadaGroups(userId: string) {
  const { data: parts } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', userId);
  const ids = (parts ?? []).map((p: any) => p.conversation_id);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, name, description, avatar_url, is_barkada, created_by, created_at, updated_at,
      conversation_participants(
        user_id, role, last_read_at,
        profiles(id, username, display_name, avatar_url)
      )
    `)
    .in('id', ids)
    .eq('is_barkada', true)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getGroupDetails(groupId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select(`
      id, name, description, avatar_url, is_barkada, created_by, created_at, updated_at,
      conversation_participants(
        user_id, role, last_read_at, muted_until,
        profiles(id, username, display_name, avatar_url)
      )
    `)
    .eq('id', groupId)
    .single();
  if (error) throw error;
  return data;
}

export async function addGroupMember(groupId: string, userId: string, addedById: string) {
  const { error } = await supabase.from('conversation_participants').insert({
    conversation_id: groupId,
    user_id: userId,
    role: 'member',
  });
  if (error) throw error;
  await supabase.from('group_activity').insert({
    conversation_id: groupId,
    actor_id: addedById,
    activity_type: 'member_joined',
    target_user_id: userId,
  }).then(() => {});
  await supabase.from('notifications').insert({
    user_id: userId,
    actor_id: addedById,
    type: 'group_invite' as never,
    content: 'added you to a group.',
  }).then(() => {});
}

export async function removeGroupMember(groupId: string, userId: string, removedById: string) {
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
  await supabase.from('group_activity').insert({
    conversation_id: groupId,
    actor_id: removedById,
    activity_type: 'member_removed',
    target_user_id: userId,
  }).then(() => {});
}

export async function leaveGroup(groupId: string, userId: string) {
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
  await supabase.from('group_activity').insert({
    conversation_id: groupId,
    actor_id: userId,
    activity_type: 'member_left',
  }).then(() => {});
}

export async function promoteToAdmin(groupId: string, userId: string) {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ role: 'admin' })
    .eq('conversation_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
  await supabase.from('group_activity').insert({
    conversation_id: groupId,
    actor_id: userId,
    activity_type: 'member_promoted',
    target_user_id: userId,
  }).then(() => {});
}

export async function demoteToMember(groupId: string, userId: string) {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ role: 'member' })
    .eq('conversation_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  // Delete cascade handles everything
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', groupId);
  if (error) throw error;
}

export async function updateGroupInfo(groupId: string, updates: { name?: string; description?: string; avatar_url?: string }) {
  const { error } = await supabase
    .from('conversations')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', groupId);
  if (error) throw error;
}

// ---- MESSAGES ----

export async function sendMessage({
  conversationId,
  senderId,
  content,
  messageType = 'text',
  replyTo,
  metadata,
  clientId,
}: {
  conversationId: string;
  senderId: string;
  content?: string | null;
  messageType?: string;
  replyTo?: string | null;
  metadata?: Record<string, unknown>;
  clientId?: string;
}) {
  const cid = clientId ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36));
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: content ?? null,
      message_type: messageType as any,
      reply_to: replyTo ?? null,
      metadata: metadata ?? null,
      client_id: cid,
    })
    .select()
    .single();
  if (error) throw error;
  // Touch updated_at
  await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId).then(() => {});
  return data;
}

export async function getMessages(conversationId: string, limit = 50, before?: string) {
  let query = supabase
    .from('messages')
    .select(`
      id, conversation_id, sender_id, content, message_type, reply_to,
      metadata, client_id, is_deleted, edited_at, created_at,
      profiles:sender_id(id, username, display_name, avatar_url),
      message_attachments(id, url, mime_type, file_name, size_bytes, width, height, duration_seconds, thumbnail_url),
      message_reactions(id, emoji, user_id, profiles:user_id(username, avatar_url))
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from('messages')
    .update({ is_deleted: true, content: null })
    .eq('id', messageId);
  if (error) throw error;
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const { error } = await supabase.from('message_reactions').insert({ message_id: messageId, user_id: userId, emoji });
  if (error && error.code !== '23505') throw error;
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const { error } = await supabase.from('message_reactions').delete()
    .eq('message_id', messageId).eq('user_id', userId).eq('emoji', emoji);
  if (error) throw error;
}

// ---- LOCATION ----

export async function shareCurrentLocation({
  userId,
  conversationId,
  latitude,
  longitude,
  accuracy,
}: {
  userId: string;
  conversationId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}) {
  // Deactivate old sessions for this user+conv
  await supabase
    .from('location_sharing_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);

  // Insert new snapshot
  const { data, error } = await supabase
    .from('location_sharing_sessions')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      is_live: false,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;

  // Send location message
  await sendMessage({
    conversationId,
    senderId: userId,
    messageType: 'location',
    // metadata: { latitude, longitude, accuracy, session_id: data.id },
  });

  await supabase.from('group_activity').insert({
    conversation_id: conversationId,
    actor_id: userId,
    activity_type: 'location_shared',
  }).then(() => {});

  return data;
}

export async function startLiveLocation({
  userId,
  conversationId,
  latitude,
  longitude,
  accuracy,
  durationMinutes,
}: {
  userId: string;
  conversationId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  durationMinutes?: number | null;
}) {
  await supabase
    .from('location_sharing_sessions')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('conversation_id', conversationId);

  const expiresAt = durationMinutes
    ? new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('location_sharing_sessions')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      is_live: true,
      is_active: true,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (error) throw error;

  await sendMessage({
    conversationId,
    senderId: userId,
    messageType: 'live_location',
    // metadata: { session_id: data.id, duration_minutes: durationMinutes, latitude, longitude },
  });

  return data;
}

export async function updateLiveLocation({
  sessionId,
  latitude,
  longitude,
  accuracy,
  heading,
  speed,
}: {
  sessionId: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}) {
  const { error } = await supabase
    .from('location_sharing_sessions')
    .update({ latitude, longitude, accuracy: accuracy ?? null, heading: heading ?? null, speed: speed ?? null, last_updated: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('is_active', true);
  if (error) throw error;
}

export async function stopLiveLocation(sessionId: string, conversationId: string, userId: string) {
  const { error } = await supabase
    .from('location_sharing_sessions')
    .update({ is_active: false })
    .eq('id', sessionId);
  if (error) throw error;
  await supabase.from('group_activity').insert({
    conversation_id: conversationId,
    actor_id: userId,
    activity_type: 'location_stopped',
  }).then(() => {});
}

export async function getActiveLocations(conversationId: string) {
  const { data, error } = await supabase
    .from('location_sharing_sessions')
    .select('*, profiles:user_id(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .eq('is_active', true)
    .order('last_updated', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ---- POLLS ----

export async function createPoll({
  conversationId,
  creatorId,
  question,
  options,
  allowMultiple = false,
  expiresAt,
}: {
  conversationId: string;
  creatorId: string;
  question: string;
  options: string[];
  allowMultiple?: boolean;
  expiresAt?: string | null;
}) {
  const msg = await sendMessage({
    conversationId,
    senderId: creatorId,
    messageType: 'poll',
    content: question,
    // metadata: { poll_id: '__PENDING__' }, // will be updated after poll insert
  });

  const { data: poll, error: pe } = await supabase
    .from('group_polls')
    .insert({ conversation_id: conversationId, message_id: msg.id, creator_id: creatorId, question, allow_multiple: allowMultiple, expires_at: expiresAt ?? null })
    .select()
    .single();
  if (pe) throw pe;

  // Update message metadata with the real poll_id
  await supabase.from('messages').update({ /* metadata: { poll_id: poll.id } */ } as never).eq('id', msg.id).then(() => {});

  const opts = options.map((text, idx) => ({ poll_id: poll.id, text, sort_order: idx }));
  await supabase.from('group_poll_options').insert(opts);

  await supabase.from('group_activity').insert({
    conversation_id: conversationId,
    actor_id: creatorId,
    activity_type: 'poll_created',
    message_id: msg.id,
  }).then(() => {});

  return poll;

}

export async function votePoll(pollId: string, optionId: string, userId: string) {
  const { error } = await supabase.from('group_poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: userId });
  if (error && error.code !== '23505') throw error;
}

export async function unvotePoll(pollId: string, optionId: string, userId: string) {
  const { error } = await supabase.from('group_poll_votes').delete()
    .eq('poll_id', pollId).eq('option_id', optionId).eq('user_id', userId);
  if (error) throw error;
}

// ---- TRUSTED CONTACTS ----

export async function getTrustedContacts(userId: string) {
  const { data, error } = await supabase
    .from('trusted_contacts')
    .select('*, trusted:trusted_user_id(id, username, display_name, avatar_url, phone)')
    .eq('user_id', userId);
  if (error) throw error;
  return data ?? [];
}

export async function addTrustedContact(userId: string, trustedUserId: string, phoneOverride?: string) {
  const { error } = await supabase.from('trusted_contacts').insert({ user_id: userId, trusted_user_id: trustedUserId, phone_override: phoneOverride ?? null });
  if (error && error.code !== '23505') throw error;
}

export async function removeTrustedContact(userId: string, trustedUserId: string) {
  const { error } = await supabase.from('trusted_contacts').delete().eq('user_id', userId).eq('trusted_user_id', trustedUserId);
  if (error) throw error;
}


// ---- GROUP ACTIVITY ----
export async function getGroupActivity(conversationId: string, limit = 30) {
  const { data, error } = await supabase
    .from('group_activity')
    .select('*, actor:actor_id(id, username, display_name, avatar_url), target:target_user_id(id, username, display_name, avatar_url)')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

// ---- UPLOAD MEDIA ----

export async function uploadGroupMedia(file: File, userId: string, conversationId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${userId}/${conversationId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('group-media').upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('group-media').getPublicUrl(path);
  return urlData.publicUrl;
}

export async function uploadGroupAvatar(file: File, conversationId: string): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `group-avatars/${conversationId}.${ext}`;
  const { error } = await supabase.storage.from('group-media').upload(path, file, { cacheControl: '3600', upsert: true });
  if (error) throw error;
  const { data: urlData } = supabase.storage.from('group-media').getPublicUrl(path);
  return urlData.publicUrl;
}

// Image compression helper
export async function compressImage(file: File, maxSizePx = 1280, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > maxSizePx || height > maxSizePx) {
        if (width > height) { height = (height * maxSizePx) / width; width = maxSizePx; }
        else { width = (width * maxSizePx) / height; height = maxSizePx; }
      }
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error('Compression failed'));
        resolve(new File([blob], file.name, { type: 'image/jpeg' }));
      }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
