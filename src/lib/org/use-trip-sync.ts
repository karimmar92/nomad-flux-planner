/**
 * Keeps the server-side trip rows in step with the employee's local log.
 *
 * Country and dates only — notes, cities and everything else stay on the
 * device. Nothing syncs at all for people who are not in an organisation.
 */
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@/lib/use-session";
import { useTrips } from "@/lib/store";
import { syncMyTrips } from "./org.functions";

export function useOrgTripSync(enabled = true) {
  const { signedIn } = useSession();
  const { trips, hydrated } = useTrips();
  const push = useServerFn(syncMyTrips);
  const last = useRef<string>("");

  useEffect(() => {
    if (!enabled || !signedIn || !hydrated) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const payload = trips.map((t) => ({
      id: t.id,
      country_code: t.country_code,
      entry_date: t.entry_date,
      exit_date: t.exit_date,
      created_at: t.created_at ?? undefined,
    }));
    const fingerprint = JSON.stringify(payload);
    if (fingerprint === last.current) return;
    last.current = fingerprint;
    const timer = window.setTimeout(() => {
      void push({ data: { trips: payload } }).catch(() => {
        last.current = "";
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [enabled, signedIn, hydrated, trips, push]);
}
