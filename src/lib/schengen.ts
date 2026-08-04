/**
 * Schengen 90/180 engine.
 *
 * The rule: you may be present in the Schengen Area for at most 90 days
 * within any rolling 180-day period. The window is rolling, not fixed —
 * there is no annual reset and no reset on exit. Both the entry day and
 * the exit day count as full days. Time in non-Schengen countries stops
 * you accumulating days but does not give days back.
 *
 * All dates are plain YYYY-MM-DD strings converted to a day-index integer.
 * Never use local Date objects for arithmetic here — a user in UTC+13 and a
 * user in UTC-8 must get identical counts for the same calendar dates.
 */

// Schengen member states as of 2026. Bulgaria and Romania completed full
// accession in 2025. Ireland is EU but NOT Schengen. Switzerland, Norway,
// Iceland and Liechtenstein are Schengen but NOT EU.
// REVIEW ANNUALLY — membership changes.
export const SCHENGEN_COUNTRIES = new Set([
  "AT","BE","BG","HR","CZ","DK","EE","FI","FR","DE","GR","HU","IS","IT",
  "LV","LI","LT","LU","MT","NL","NO","PL","PT","RO","SK","SI","ES","SE","CH",
]);

export const SCHENGEN_MAX_DAYS = 90;
export const SCHENGEN_WINDOW_DAYS = 180;

export interface Trip {
  countryCode: string;
  entryDate: string;          // YYYY-MM-DD
  exitDate: string | null;    // null = still there
  purpose?: "tourist" | "nomad_visa" | "residence";
}

/** Days since epoch for a YYYY-MM-DD string. Timezone-independent. */
export function toDayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

export function fromDayIndex(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** Trips on a national long-stay visa or residence permit do not consume
 *  the 90-day short-stay allowance. */
function consumesAllowance(trip: Trip): boolean {
  return SCHENGEN_COUNTRIES.has(trip.countryCode) && trip.purpose !== "residence";
}

/** Days used in the 180-day window ending on (and including) refDate. */
export function schengenDaysUsed(trips: Trip[], refDate: string): number {
  const ref = toDayIndex(refDate);
  const windowStart = ref - (SCHENGEN_WINDOW_DAYS - 1);
  let total = 0;
  for (const trip of trips) {
    if (!consumesAllowance(trip)) continue;
    const entry = toDayIndex(trip.entryDate);
    const exit = trip.exitDate ? toDayIndex(trip.exitDate) : ref;
    const lo = Math.max(entry, windowStart);
    const hi = Math.min(exit, ref);
    if (lo <= hi) total += hi - lo + 1;   // inclusive of both endpoints
  }
  return total;
}

export function schengenDaysRemaining(trips: Trip[], refDate: string): number {
  return Math.max(0, SCHENGEN_MAX_DAYS - schengenDaysUsed(trips, refDate));
}

/**
 * If you enter on `entryDate`, how many consecutive days can you legally stay?
 * Checks compliance on every single day of the hypothetical stay, because the
 * rule is tested daily — not only at the border.
 */
export function maxStayFrom(trips: Trip[], entryDate: string, cap = SCHENGEN_MAX_DAYS): number {
  const entry = toDayIndex(entryDate);
  let n = 0;
  for (let k = 0; k < cap; k++) {
    const day = fromDayIndex(entry + k);
    const sim: Trip[] = [...trips, { countryCode: "PT", entryDate, exitDate: day }];
    if (schengenDaysUsed(sim, day) > SCHENGEN_MAX_DAYS) break;
    n++;
  }
  return n;
}

/** Earliest date from which a full 90-day stay is possible. */
export function nextFullNinetyDate(trips: Trip[], fromDate: string, horizonDays = 400): string | null {
  const start = toDayIndex(fromDate);
  for (let i = 0; i < horizonDays; i++) {
    const candidate = fromDayIndex(start + i);
    if (maxStayFrom(trips, candidate) === SCHENGEN_MAX_DAYS) return candidate;
  }
  return null;
}

export type SchengenStatus = "ok" | "warning" | "critical" | "violation";

export function schengenStatus(trips: Trip[], refDate: string): {
  used: number; remaining: number; status: SchengenStatus; nextFullNinety: string | null;
} {
  const used = schengenDaysUsed(trips, refDate);
  const remaining = Math.max(0, SCHENGEN_MAX_DAYS - used);
  const pct = used / SCHENGEN_MAX_DAYS;
  const status: SchengenStatus =
    used > SCHENGEN_MAX_DAYS ? "violation" : pct >= 0.9 ? "critical" : pct >= 0.75 ? "warning" : "ok";
  return { used, remaining, status, nextFullNinety: nextFullNinetyDate(trips, refDate) };
}
