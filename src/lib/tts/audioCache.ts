/**
 * Audio-Cache für synthetisierte KI-Sätze.
 *
 * Motivation: jede Kokoro-Inferenz kostet ~100-400 ms (WebGPU) bzw.
 * 0.5-2 s (WASM) pro Satz. Wenn der User zurückspult oder einen Satz
 * nochmal hören will, soll das nicht erneut synthetisiert werden.
 *
 * Strategie:
 *  - Key = `${engine}:${voice}:${speedBucket}:${hash(text)}`
 *    speedBucket = gerundete Speed (0.25-Schritte), damit nicht für jede
 *    Mikro-Änderung ein neuer Cache-Eintrag entsteht.
 *  - Value = WAV-Blob (Kokoro liefert schon WAV).
 *  - Storage = IndexedDB (gleicher Pattern wie `storage.ts`).
 *
 * Cleanup: ein LRU-artiger Mechanismus ist absichtlich NICHT eingebaut —
 * Texte sind klein (~100-200 Bytes), WAVs sind es nicht (typisch 30-100 KB
 * pro Satz). Wir setzen ein grobes Limit: bei > 500 Einträgen werden die
 * ältesten verworfen. Das reicht für realistische Lesemengen.
 */

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'open-reader-tts-cache';
const DB_VERSION = 1;
const STORE = 'audio';
const MAX_ENTRIES = 500;

let dbPromise: Promise<IDBPDatabase> | null = null;
function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          const store = database.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('byAccess', 'accessedAt');
        }
      },
    });
  }
  return dbPromise;
}

export function makeAudioCacheKey(
  engine: string,
  voice: string,
  speed: number,
  text: string
): string {
  const bucket = Math.round(speed * 4) / 4; // 0.25-Schritte
  // FNV-1a 32-bit — klein, ausreichend für Cache-Kollisionsvermeidung.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${engine}:${voice}:${bucket}:${h.toString(16)}`;
}

export async function getCachedAudio(key: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    const entry = (await db.get(STORE, key)) as AudioCacheEntry | undefined;
    if (!entry) return null;
    // Access-Zeit nachziehen (für zukünftiges LRU).
    entry.accessedAt = Date.now();
    void db.put(STORE, entry);
    return entry.blob;
  } catch {
    // IndexedDB nicht verfügbar (z.B. private mode) — Cache ist optional.
    return null;
  }
}

export async function setCachedAudio(key: string, blob: Blob): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE, { key, blob, createdAt: Date.now(), accessedAt: Date.now() } satisfies AudioCacheEntry);
    void enforceLimit(db);
  } catch {
    /* noop */
  }
}

export async function clearAudioCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE);
  } catch {
    /* noop */
  }
}

export async function getAudioCacheSize(): Promise<{ count: number; bytes: number }> {
  try {
    const db = await getDB();
    const all = (await db.getAll(STORE)) as AudioCacheEntry[];
    const bytes = all.reduce((sum, e) => sum + (e.blob?.size || 0), 0);
    return { count: all.length, bytes };
  } catch {
    return { count: 0, bytes: 0 };
  }
}

interface AudioCacheEntry {
  key: string;
  blob: Blob;
  createdAt: number;
  accessedAt: number;
}

async function enforceLimit(db: IDBPDatabase): Promise<void> {
  // Soft-Limit: bei > MAX_ENTRIES die ältesten accessedAt rauswerfen.
  const all = (await db.getAll(STORE)) as AudioCacheEntry[];
  if (all.length <= MAX_ENTRIES) return;
  all.sort((a, b) => a.accessedAt - b.accessedAt);
  const toDelete = all.slice(0, all.length - MAX_ENTRIES);
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(toDelete.map(e => tx.store.delete(e.key)));
  await tx.done;
}
