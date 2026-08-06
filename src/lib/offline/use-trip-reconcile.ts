import { useEffect, useRef } from "react";
import { useSession } from "../use-session";
import { useTrips } from "../store";
import { reconcileTrips } from "./trip-sync";

/**
 * Reconciles local trips with the server whenever a user signs in.
 *
 * The important moment this serves: someone logs trips anonymously for a while,
 * then creates an account. Everything they already recorded is uploaded for
 * them without being asked — they should never have to re-enter history, and
 * they should never discover later that the trips predating their signup were
 * left behind on a device.
 *
 * Runs once per signed-in session. Failures are swallowed deliberately: the
 * local copy is untouched and intact, the queued ops remain, and the next flush
 * retries. Nothing here is allowed to interrupt someone using the tracker.
 */
export function useTripReconcile() {
  const { userId } = useSession();
  const { trips, setTrips, hydrated } = useTrips();
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !hydrated) return;
    if (doneFor.current === userId) return;
    doneFor.current = userId;

    let active = true;
    void reconcileTrips(userId, trips)
      .then((merged) => {
        if (!active) return;
        // Only write when the merge actually changed something, so we do not
        // trigger a pointless re-render and re-queue on every sign-in.
        if (merged.length !== trips.length) setTrips(merged);
      })
      .catch(() => {
        // Retry on the next sign-in or flush. Local data is unaffected.
        doneFor.current = null;
      });

    return () => {
      active = false;
    };
    // `trips` is deliberately excluded: this should fire on identity change,
    // not on every edit. Trip writes are carried by the sync queue instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, hydrated]);
}
