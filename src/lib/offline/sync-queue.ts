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
  entity: "trip" | "profile" | "checklist" | "arrival" | "departure_plan" | "waitlist";
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
 * Drain the queue.
 *
 * Trip ops carry the FULL local trips array as their payload (see `write` in
 * store.ts), so only the most recent one matters — it already supersedes every
 * op before it. We push that, upsert-only.
 *
 * The queue is cleared ONLY on a successful push. Clearing unconditionally is
 * what the previous implementation did, and it meant every op was silently
 * discarded and nothing ever reached the server while the code looked like it
 * was syncing. A queue that empties without delivering is worse than no queue.
 *
 * Signed out is a valid state: there is nowhere to push, so ops stay queued and
 * are delivered the moment the user signs in.
 */
export async function flushQueue(): Promise<void> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return;
  flushing = true;
  try {
    const queue = await readQueue();
    if (queue.length === 0) return;

    // Waitlist signups are public inserts: they do NOT need an account, so
    // they drain before the auth check. Anything that fails stays queued.
    const waitlistOps = queue.filter((op) => op.entity === "waitlist");
    const failedWaitlist: SyncOp[] = [];
    if (waitlistOps.length > 0) {
      const { joinWaitlist } = await import("@/lib/waitlist.functions");
      for (const op of waitlistOps) {
        try {
          await joinWaitlist({
            data: op.payload as Parameters<typeof joinWaitlist>[0]["data"],
          });
        } catch {
          failedWaitlist.push(op);
        }
      }
    }

    const rest = queue.filter((op) => op.entity !== "waitlist");

    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    // No account yet — keep everything else queued rather than dropping it.
    if (!userId) {
      await idbSet(QUEUE_KEY, [...failedWaitlist, ...rest]);
      notify();
      return;
    }

    const lastTripOp = [...rest].reverse().find((op) => op.entity === "trip");
    if (lastTripOp && Array.isArray(lastTripOp.payload)) {
      const { pushTrips } = await import("./trip-sync");
      await pushTrips(userId, lastTripOp.payload as Parameters<typeof pushTrips>[1]);
    }

    await idbSet(QUEUE_KEY, failedWaitlist);
    notify();
  } catch {
    // Leave the queue intact so the next flush retries. Never clear on failure.
  } finally {
    flushing = false;
  }
}

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("driftly:sync"));
  }
}
