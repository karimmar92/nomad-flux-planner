import { SCHENGEN_COUNTRIES, schengenStatus } from "./schengen";
import { toEngineTrips } from "./trip-dates";
import { toDayIndex } from "./schengen";
import type { Trip } from "./types";

/**
 * Pre-departure triggers.
 *
 * Arrival is the WRONG moment to sell an eSIM: the user has no roaming, no
 * WiFi they can pass an SMS check on, and is standing in an immigration queue.
 * Nothing is purchasable there. The honest — and better converting — moment is
 * 1–7 days before departure, when a purchase is actually possible.
 */

export const PRE_DEPARTURE_MIN_DAYS = 1;
export const PRE_DEPARTURE_MAX_DAYS = 7;

export type PreDeparture =
  | {
      kind: "trip";
      trip: Trip;
      countryCode: string;
      daysUntil: number;
      /** ISO date the user must act by. */
      date: string;
    }
  | {
      kind: "schengen_exit";
      trip: null;
      countryCode: string;
      daysUntil: number;
      date: string;
    };

/**
 * The soonest thing worth a pre-departure prompt: an upcoming entry 1–7 days
 * out, or a Schengen exit deadline inside 7 days (which forces a departure
 * just as surely as a booked trip does).
 */
export function detectPreDeparture(trips: Trip[], todayIso: string): PreDeparture | null {
  const today = toDayIndex(todayIso);

  const upcoming = trips
    .filter((t) => {
      const d = toDayIndex(t.entry_date) - today;
      return d >= PRE_DEPARTURE_MIN_DAYS && d <= PRE_DEPARTURE_MAX_DAYS;
    })
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));

  if (upcoming.length > 0) {
    const trip = upcoming[0]!;
    return {
      kind: "trip",
      trip,
      countryCode: trip.country_code,
      daysUntil: toDayIndex(trip.entry_date) - today,
      date: trip.entry_date,
    };
  }

  const status = schengenStatus(toEngineTrips(trips), todayIso);
  const openSchengen = trips.find(
    (t) =>
      SCHENGEN_COUNTRIES.has(t.country_code) &&
      t.purpose !== "residence" &&
      t.entry_date <= todayIso &&
      (t.exit_date === null || t.exit_date >= todayIso),
  );

  if (openSchengen && status.remaining >= 0 && status.remaining <= PRE_DEPARTURE_MAX_DAYS) {
    return {
      kind: "schengen_exit",
      trip: null,
      countryCode: openSchengen.country_code,
      daysUntil: status.remaining,
      date: todayIso,
    };
  }

  return null;
}
