import { countryForTimezone, currentTimezone, utcOffsetLabel } from "./timezone-countries";
import { idbSet } from "./offline/idb";
import { enqueue } from "./offline/sync-queue";

/**
 * Offline-capable country-change detection.
 *
 * PRIVACY — read before changing the stored shape.
 * We store only { country, date }. The country is derived on-device from the
 * IANA timezone; if IP confirmation ever runs, any coordinates it returns are
 * used for the comparison and discarded in the same function call — never
 * written anywhere.
 *
 * Why this differs from the radar's no-history rule: radar location is SHARED
 * with other users, so history there is a disclosure risk that compounds.
 * Visa location is private, never leaves the device except as the user's own
 * trip rows, and country-plus-date is a tiny fraction of the sensitivity of a
 * coordinate trail — it is also exactly what a visa calculation needs.
 *
 * Do NOT "improve" this by storing lat/lng. A coordinate trail is a different
 * product with a different consent model.
 */

const LAST_SEEN_KEY = "driftly.location.last_seen";

export type LastSeen = {
  /** IANA zone, kept so we can detect a *change* without any network. */
  timeZone: string;
  /** ISO-3166 alpha-2, or null when the zone was ambiguous and unanswered. */
  country: string | null;
  /** YYYY-MM-DD. No time-of-day, no coordinates. Ever. */
  date: string;
};

function read(): LastSeen | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw ? (JSON.parse(raw) as LastSeen) : null;
  } catch {
    return null;
  }
}

export function readLastSeen(): LastSeen | null {
  return read();
}

/** Persist country + date only. Mirrored to IndexedDB and queued for sync. */
export function writeLastSeen(next: LastSeen): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
  void idbSet(LAST_SEEN_KEY, next);
  void enqueue({ entity: "arrival", action: "upsert", payload: next });
}

export type ArrivalPrompt = {
  timeZone: string;
  offsetLabel: string;
  /** Best guess, or null when the zone spans countries / is unmapped. */
  suggestedCountry: string | null;
  candidates: string[];
  previousCountry: string | null;
};

/**
 * Signal 1 of 2, and the only one that works offline: has the device timezone
 * changed since the last time we looked? IP geolocation (signal 2) is only
 * ever used once connectivity returns, to confirm or to disambiguate.
 */
export function detectArrival(todayIsoDate: string): ArrivalPrompt | null {
  const timeZone = currentTimezone();
  if (!timeZone) return null;

  const last = read();
  if (last && last.timeZone === timeZone) return null;

  const resolution = countryForTimezone(timeZone);
  const suggestedCountry = resolution.kind === "single" ? resolution.countryCode : null;
  const candidates = resolution.kind === "ambiguous" ? resolution.candidates : [];

  // First ever run: remember the zone silently, don't interrogate a new user.
  if (!last) {
    writeLastSeen({ timeZone, country: suggestedCountry, date: todayIsoDate });
    return null;
  }

  if (suggestedCountry && suggestedCountry === last.country) {
    writeLastSeen({ timeZone, country: suggestedCountry, date: last.date });
    return null;
  }

  return {
    timeZone,
    offsetLabel: utcOffsetLabel(),
    suggestedCountry,
    candidates,
    previousCountry: last.country,
  };
}

/** User answered "not here" — remember the zone so we stop asking. */
export function dismissArrival(timeZone: string, todayIsoDate: string): void {
  const last = read();
  writeLastSeen({ timeZone, country: last?.country ?? null, date: todayIsoDate });
}
