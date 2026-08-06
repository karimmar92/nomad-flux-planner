/**
 * Trip sync — the durable half of the record.
 *
 * Until this existed, every trip lived only in localStorage and IndexedDB on a
 * single device. For a product whose promise is "the permanent record of your
 * life abroad", a browser cache is not a record: clearing site data destroyed
 * years of history, and nothing was visible on a second device.
 *
 * DESIGN RULES — these exist to make data loss structurally impossible:
 *
 * 1. UPSERT ONLY. This module never bulk-deletes. `syncTrips` in org.functions
 *    does `delete().eq("user_id", …)` then re-inserts, which is safe there
 *    because it runs from a single authoritative payload — but on the consumer
 *    path a stale device running that would erase trips logged elsewhere.
 *    Deletions here are explicit, one row at a time, triggered by the user.
 *
 * 2. LOCAL WINS. The local write already happened and the user saw it succeed.
 *    A remote row never overwrites a local one with the same id.
 *
 * 3. MERGE IS A UNION. Pulling from the server adds trips this device has not
 *    seen; it never removes local ones. Worst case is a duplicate the user can
 *    delete — never a silent disappearance.
 *
 * 4. SIGNED OUT IS VALID. Everything works with no account. Sync is an upgrade,
 *    not a requirement, and the UI tells people plainly when they are
 *    device-only rather than letting them assume otherwise.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Trip } from "../types";

/** A trip row as stored remotely, narrowed to the fields we own. */
type RemoteTrip = {
  id: string;
  country_code: string;
  city_id: string | null;
  entry_date: string;
  exit_date: string | null;
  purpose: string;
  notes: string;
};

function toRow(trip: Trip, userId: string) {
  return {
    id: trip.id,
    user_id: userId,
    country_code: trip.country_code.toUpperCase().slice(0, 2),
    city_id: trip.city_id ?? null,
    entry_date: trip.entry_date,
    exit_date: trip.exit_date,
    purpose: trip.purpose,
    notes: trip.notes ?? "",
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: RemoteTrip): Trip {
  return {
    id: row.id,
    country_code: row.country_code,
    city_id: row.city_id,
    entry_date: row.entry_date,
    exit_date: row.exit_date,
    purpose: row.purpose as Trip["purpose"],
    notes: row.notes ?? "",
  };
}

/**
 * Push local trips to the server. Upsert on primary key, so re-running is
 * harmless and a trip edited offline overwrites its own remote row.
 */
export async function pushTrips(userId: string, trips: Trip[]): Promise<number> {
  if (trips.length === 0) return 0;
  const rows = trips.map((t) => toRow(t, userId));
  const { error } = await supabase.from("trips").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return rows.length;
}

/** Fetch every trip the server holds for this user. */
export async function pullTrips(userId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from("trips")
    .select("id, country_code, city_id, entry_date, exit_date, purpose, notes")
    .eq("user_id", userId)
    .order("entry_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => fromRow(r as RemoteTrip));
}

/**
 * Union by id, local winning on conflict.
 *
 * Deliberately additive: a trip present remotely but not locally is adopted,
 * and a trip present locally but not remotely is kept and will be pushed. The
 * only failure mode is a duplicate, which the user can delete. The alternative
 * — treating either side as authoritative — can silently destroy history.
 */
export function mergeTrips(local: Trip[], remote: Trip[]): Trip[] {
  const byId = new Map<string, Trip>();
  for (const t of remote) byId.set(t.id, t);
  for (const t of local) byId.set(t.id, t); // local overwrites remote
  return [...byId.values()].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
}

/** Remove one trip remotely. Explicit and singular — never a bulk delete. */
export async function deleteTripRemote(userId: string, tripId: string): Promise<void> {
  const { error } = await supabase
    .from("trips")
    .delete()
    .eq("user_id", userId)
    .eq("id", tripId);
  if (error) throw new Error(error.message);
}

/**
 * Full reconcile: pull, merge, push anything the server was missing.
 * Returns the merged set so the caller can write it locally.
 *
 * Called on sign-in — which is the moment a user who has been logging trips
 * anonymously gets everything they already recorded uploaded for them.
 */
export async function reconcileTrips(userId: string, local: Trip[]): Promise<Trip[]> {
  const remote = await pullTrips(userId);
  const merged = mergeTrips(local, remote);

  const remoteIds = new Set(remote.map((t) => t.id));
  const missingRemotely = merged.filter((t) => !remoteIds.has(t.id));
  if (missingRemotely.length > 0) await pushTrips(userId, missingRemotely);

  return merged;
}
