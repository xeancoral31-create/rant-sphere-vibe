import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import fs from "fs";
import path from "path";

export interface FriendRequestRecord {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface FriendshipRecord {
  id: string;
  user_id_1: string;
  user_id_2: string;
  created_at: string;
}

interface FriendshipDB {
  requests: FriendRequestRecord[];
  friendships: FriendshipRecord[];
}

const STORE_PATH = path.resolve(process.cwd(), ".data", "friendships_store.json");

function loadDB(): FriendshipDB {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const initial: FriendshipDB = { requests: [], friendships: [] };
      fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
      return initial;
    }
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw) as FriendshipDB;
  } catch (err) {
    console.error("[friends.functions] Failed to load friendships store:", err);
    return { requests: [], friendships: [] };
  }
}

function saveDB(db: FriendshipDB): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("[friends.functions] Failed to save friendships store:", err);
  }
}

function generateId(): string {
  return (
    "req_" +
    Math.random().toString(36).substring(2, 9) +
    "_" +
    Date.now().toString(36)
  );
}

/**
 * Server function: Get friendship states for target users relative to current user.
 */
export const getFriendshipStateMapFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        currentUserId: z.string(),
        targetUserIds: z.array(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { currentUserId, targetUserIds } = data;
    const db = loadDB();
    const map: Record<string, "friends" | "sent" | "received" | "none"> = {};

    for (const targetId of targetUserIds) {
      if (!targetId || targetId === currentUserId) continue;

      // 1. Check if already friends
      const isFriend = db.friendships.some(
        (f) =>
          (f.user_id_1 === currentUserId && f.user_id_2 === targetId) ||
          (f.user_id_1 === targetId && f.user_id_2 === currentUserId),
      );

      if (isFriend) {
        map[targetId] = "friends";
        continue;
      }

      // 2. Check pending requests
      const pendingRequest = db.requests.find(
        (r) =>
          r.status === "pending" &&
          ((r.sender_id === currentUserId && r.receiver_id === targetId) ||
            (r.sender_id === targetId && r.receiver_id === currentUserId)),
      );

      if (pendingRequest) {
        if (pendingRequest.sender_id === currentUserId) {
          map[targetId] = "sent";
        } else {
          map[targetId] = "received";
        }
      } else {
        map[targetId] = "none";
      }
    }

    return { map };
  });

/**
 * Server function: Calculate mutual friends count between current user and target users.
 */
export const getMutualFriendsCountMapFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        currentUserId: z.string(),
        targetUserIds: z.array(z.string()),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { currentUserId, targetUserIds } = data;
    const db = loadDB();
    const map: Record<string, number> = {};

    // Get all friends of current user
    const myFriends = new Set<string>();
    for (const f of db.friendships) {
      if (f.user_id_1 === currentUserId) myFriends.add(f.user_id_2);
      else if (f.user_id_2 === currentUserId) myFriends.add(f.user_id_1);
    }

    for (const targetId of targetUserIds) {
      if (!targetId || targetId === currentUserId) {
        map[targetId] = 0;
        continue;
      }

      // Get all friends of target user
      const targetFriends = new Set<string>();
      for (const f of db.friendships) {
        if (f.user_id_1 === targetId) targetFriends.add(f.user_id_2);
        else if (f.user_id_2 === targetId) targetFriends.add(f.user_id_1);
      }

      // Intersection of myFriends and targetFriends
      let count = 0;
      for (const fid of myFriends) {
        if (targetFriends.has(fid)) count++;
      }
      map[targetId] = count;
    }

    return { map };
  });

/**
 * Server function: Send a friend request.
 */
export const sendFriendRequestFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        senderId: z.string(),
        receiverId: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { senderId, receiverId } = data;
    if (senderId === receiverId) {
      throw new Error("You cannot send a friend request to yourself.");
    }

    const db = loadDB();

    // Check if already friends
    const isFriend = db.friendships.some(
      (f) =>
        (f.user_id_1 === senderId && f.user_id_2 === receiverId) ||
        (f.user_id_1 === receiverId && f.user_id_2 === senderId),
    );
    if (isFriend) {
      throw new Error("You are already friends with this user.");
    }

    // Check if duplicate pending request exists
    const existing = db.requests.find(
      (r) =>
        r.status === "pending" &&
        ((r.sender_id === senderId && r.receiver_id === receiverId) ||
          (r.sender_id === receiverId && r.receiver_id === senderId)),
    );
    if (existing) {
      if (existing.sender_id === senderId) {
        throw new Error("Friend request is already pending.");
      } else {
        // Automatically accept if other user already requested!
        existing.status = "accepted";
        existing.updated_at = new Date().toISOString();

        const [u1, u2] = [senderId, receiverId].sort();
        db.friendships.push({
          id: generateId(),
          user_id_1: u1,
          user_id_2: u2,
          created_at: new Date().toISOString(),
        });
        saveDB(db);
        return { ok: true, status: "friends", request: existing };
      }
    }

    const newReq: FriendRequestRecord = {
      id: generateId(),
      sender_id: senderId,
      receiver_id: receiverId,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    db.requests.push(newReq);
    saveDB(db);

    return { ok: true, status: "sent", request: newReq };
  });

/**
 * Server function: Cancel an outgoing friend request.
 */
export const cancelFriendRequestFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        senderId: z.string(),
        receiverId: z.string().optional(),
        requestId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { senderId, receiverId, requestId } = data;
    const db = loadDB();

    db.requests = db.requests.filter((r) => {
      if (requestId && r.id === requestId) return false;
      if (
        receiverId &&
        r.sender_id === senderId &&
        r.receiver_id === receiverId &&
        r.status === "pending"
      ) {
        return false;
      }
      return true;
    });

    saveDB(db);
    return { ok: true };
  });

/**
 * Server function: Accept an incoming friend request.
 */
export const acceptFriendRequestFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        senderId: z.string(),
        receiverId: z.string(),
        requestId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { senderId, receiverId, requestId } = data;
    const db = loadDB();

    // Mark request as accepted
    for (const r of db.requests) {
      if (requestId && r.id === requestId) {
        r.status = "accepted";
        r.updated_at = new Date().toISOString();
      } else if (
        ((r.sender_id === senderId && r.receiver_id === receiverId) ||
          (r.sender_id === receiverId && r.receiver_id === senderId)) &&
        r.status === "pending"
      ) {
        r.status = "accepted";
        r.updated_at = new Date().toISOString();
      }
    }

    // Add friendship if not exists
    const [u1, u2] = [senderId, receiverId].sort();
    const exists = db.friendships.some(
      (f) => f.user_id_1 === u1 && f.user_id_2 === u2,
    );

    if (!exists) {
      db.friendships.push({
        id: generateId(),
        user_id_1: u1,
        user_id_2: u2,
        created_at: new Date().toISOString(),
      });
    }

    saveDB(db);
    return { ok: true };
  });

/**
 * Server function: Decline an incoming friend request.
 */
export const declineFriendRequestFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        requestId: z.string().optional(),
        senderId: z.string().optional(),
        receiverId: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { requestId, senderId, receiverId } = data;
    const db = loadDB();

    for (const r of db.requests) {
      if (requestId && r.id === requestId) {
        r.status = "declined";
        r.updated_at = new Date().toISOString();
      } else if (
        senderId &&
        receiverId &&
        r.sender_id === senderId &&
        r.receiver_id === receiverId &&
        r.status === "pending"
      ) {
        r.status = "declined";
        r.updated_at = new Date().toISOString();
      }
    }

    saveDB(db);
    return { ok: true };
  });

/**
 * Server function: Remove a friend.
 */
export const removeFriendFn = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        userId: z.string(),
        friendId: z.string(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { userId, friendId } = data;
    const db = loadDB();

    db.friendships = db.friendships.filter(
      (f) =>
        !(
          (f.user_id_1 === userId && f.user_id_2 === friendId) ||
          (f.user_id_1 === friendId && f.user_id_2 === userId)
        ),
    );

    saveDB(db);
    return { ok: true };
  });

/**
 * Server function: Get raw friends list for a user.
 */
export const getFriendsDataFn = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ userId: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { userId } = data;
    const db = loadDB();

    const friendIds: string[] = [];
    for (const f of db.friendships) {
      if (f.user_id_1 === userId) friendIds.push(f.user_id_2);
      else if (f.user_id_2 === userId) friendIds.push(f.user_id_1);
    }

    const pendingIncoming = db.requests.filter(
      (r) => r.receiver_id === userId && r.status === "pending",
    );
    const pendingSent = db.requests.filter(
      (r) => r.sender_id === userId && r.status === "pending",
    );

    return {
      friendIds,
      pendingIncoming,
      pendingSent,
    };
  });
