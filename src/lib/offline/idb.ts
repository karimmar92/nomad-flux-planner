/**
 * Minimal promise-based IndexedDB key/value store.
 *
 * Why IndexedDB and not just localStorage: trip writes must survive an
 * immediate app kill (airplane mode, phone dying in a queue), can hold the
 * whole 25-city seed snapshot without hitting the ~5 MB localStorage ceiling,
 * and are the durable side of the write-then-sync path in sync-queue.ts.
 */

const DB_NAME = "driftly";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });

  return dbPromise;
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, mode);
          const req = fn(tx.objectStore(STORE));
          req.onsuccess = () => resolve(req.result as T);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      }),
  );
}

export function idbGet<T>(key: string): Promise<T | null> {
  return run<T>("readonly", (s) => s.get(key));
}

export function idbSet(key: string, value: unknown): Promise<unknown> {
  return run("readwrite", (s) => s.put(value, key));
}

export function idbDel(key: string): Promise<unknown> {
  return run("readwrite", (s) => s.delete(key));
}

/**
 * Empty the store completely.
 *
 * Used by account deletion. The tracker is offline-first, so a full copy of
 * someone's travel history and the pending sync queue live here — deleting
 * the server copy while leaving this behind is not erasure, and the next flush
 * would re-upload it.
 *
 * Clears everything rather than named keys deliberately: a key added later and
 * forgotten here would be a silent data remnant, which is exactly the failure
 * GDPR Art. 17 is about.
 */
export function idbClear(): Promise<unknown> {
  return run("readwrite", (s) => s.clear());
}
