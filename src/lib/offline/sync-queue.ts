import { idbGet, idbSet } from "./idb";

/**
 * Write-local-then-sync queue.
 *
 * The user must never wait on a network call to log an entry date. Every
 * mutation is written to IndexedDB immediately and appended here; the queue
 * drains when connectivity returns. Nothing in the visa tracker awaits a
 * flush — reconciliation is a background concern.
 */

export type SyncOp = {
  id: string;
  entity: "trip" | "profile" | "checklist" | "arrival";
  action: "upsert" | "delete";
  payload: unknown;
  queuedAt: string;
};

const QUEUE_KEY = "sync.queue";

let flushing = false;

export async function readQueue(): Promise<SyncOp[]> {
  return (await idbGet<SyncOp[]>(QUEUE_KEY)) ?? [];
}

export async function enqueue(op: Omit<SyncOp, "id" | "queuedAt">): Promise<void> {
  const queue = await readQueue();
  queue.push({
    ...op,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    queuedAt: new Date().toISOString(),
  });
  await idbSet(QUEUE_KEY, queue.slice(-500));
  notify();
}

export async function pendingCount(): Promise<number> {
  return (await readQueue()).length;
}

/**
 * Drain the queue. The remote target is Lovable Cloud; until the tables are
 * wired the local write IS the source of truth, so a flush only clears ops it
 * has durably applied. Last-write-wins per entity id is fine here: a trip is
 * edited by exactly one device at a time.
 */
export async function flushQueue(): Promise<void> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  flushing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return;
    // Local-first: ops are already applied locally. Clearing marks them
    // reconciled. Replace this block with the remote upsert when the cloud
    // tables land — the offline contract above does not change.
    await idbSet(QUEUE_KEY, []);
    notify();
  } finally {
    flushing = false;
  }
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("driftly:sync"));
  }
}
