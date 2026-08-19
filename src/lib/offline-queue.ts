/**
 * Offline Queue using IndexedDB (via idb library)
 * Stores outgoing messages, location updates, and media uploads
 * when navigator.onLine is false, then flushes them on reconnect.
 */
import { openDB, type IDBPDatabase } from 'idb';

export type QueuedMessage = {
  client_id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  reply_to?: string | null;
  metadata?: Record<string, unknown>;
  attachments?: { file: File; mime_type: string }[];
  queued_at: number;
  status: 'queued' | 'sending' | 'failed';
};

export type QueuedLocation = {
  id: string;
  session_id: string;
  conversation_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  is_live: boolean;
  queued_at: number;
};

const DB_NAME = 'rantsphere-offline-v1';
const DB_VERSION = 1;

let _db: IDBPDatabase | null = null;

export async function getDB(): Promise<IDBPDatabase> {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('message_queue')) {
        const store = db.createObjectStore('message_queue', { keyPath: 'client_id' });
        store.createIndex('by_conv', 'conversation_id');
        store.createIndex('by_status', 'status');
      }
      if (!db.objectStoreNames.contains('location_queue')) {
        const store = db.createObjectStore('location_queue', { keyPath: 'id' });
        store.createIndex('by_conv', 'conversation_id');
      }
      if (!db.objectStoreNames.contains('cached_groups')) {
        db.createObjectStore('cached_groups', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cached_messages')) {
        const store = db.createObjectStore('cached_messages', { keyPath: 'id' });
        store.createIndex('by_conv', 'conversation_id');
      }
    },
  });
  return _db;
}

// ---- MESSAGE QUEUE ----

export async function enqueueMessage(msg: QueuedMessage) {
  const db = await getDB();
  await db.put('message_queue', msg);
}

export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  const db = await getDB();
  return db.getAll('message_queue');
}

export async function deleteQueuedMessage(client_id: string) {
  const db = await getDB();
  await db.delete('message_queue', client_id);
}

export async function updateQueuedMessageStatus(client_id: string, status: QueuedMessage['status']) {
  const db = await getDB();
  const msg = await db.get('message_queue', client_id);
  if (msg) {
    msg.status = status;
    await db.put('message_queue', msg);
  }
}

// ---- LOCATION QUEUE ----

export async function enqueueLocation(loc: QueuedLocation) {
  const db = await getDB();
  await db.put('location_queue', loc);
}

export async function getQueuedLocations(): Promise<QueuedLocation[]> {
  const db = await getDB();
  return db.getAll('location_queue');
}

export async function deleteQueuedLocation(id: string) {
  const db = await getDB();
  await db.delete('location_queue', id);
}

// ---- GROUP CACHE ----

export async function cacheGroups(groups: unknown[]) {
  const db = await getDB();
  const tx = db.transaction('cached_groups', 'readwrite');
  for (const g of groups) {
    await tx.store.put(g);
  }
  await tx.done;
}

export async function getCachedGroups(): Promise<unknown[]> {
  const db = await getDB();
  return db.getAll('cached_groups');
}

// ---- MESSAGE CACHE ----

export async function cacheMessages(messages: unknown[]) {
  const db = await getDB();
  const tx = db.transaction('cached_messages', 'readwrite');
  for (const m of messages) {
    await tx.store.put(m);
  }
  await tx.done;
}

export async function getCachedMessages(conversation_id: string): Promise<unknown[]> {
  const db = await getDB();
  return db.getAllFromIndex('cached_messages', 'by_conv', conversation_id);
}
