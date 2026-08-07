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
/**
 * Prefix-sum index of days already used, so any window can be summed in O(1).
 *
 * PERFORMANCE, and why this exists. The previous implementation rebuilt the
 * whole trip array inside the inner loop:
 *
 *     const sim = [...trips, { ...hypothetical }];   // inside a 90-iteration
 *     schengenDaysUsed(sim, day);                    // loop, called 400 times
 *
 * That is 36,000 array copies and ~3 million date conversions per call. It was
 * imperceptible with one trip and took 173 ms with eighty — so the app got
 * slower exactly as a user became more committed to it, which is the worst
 * possible shape for a performance bug. Measured before and after; see
 * schengen.test.ts, which pins the new results against the old algorithm.
 */
type DayIndex = { base: number; prefix: Int32Array };

function buildDayIndex(trips: Trip[], from: number, to: number): DayIndex {
  // Pad by a window either side so any lookup inside [from, to] is in range.
  const base = from - SCHENGEN_WINDOW_DAYS - 1;
  const size = to - base + 2;
  const used = new Uint8Array(Math.max(1, size));

  for (const trip of trips) {
    if (!consumesAllowance(trip)) continue;
    const entry = toDayIndex(trip.entryDate);
    // An open trip is counted only to the end of the range under examination.
    const exit = trip.exitDate ? toDayIndex(trip.exitDate) : to;
    const lo = Math.max(entry, base);
    const hi = Math.min(exit, to);
    for (let d = lo; d <= hi; d++) used[d - base] = 1;
  }

  const prefix = new Int32Array(used.length + 1);
  for (let i = 0; i < used.length; i++) prefix[i + 1] = prefix[i]! + used[i]!;
  return { base, prefix };
}

/** Days already used in the 180-day window ending on day `d`. O(1). */
function usedAt(idx: DayIndex, d: number): number {
  const hi = d - idx.base + 1;
  const lo = Math.max(0, hi - SCHENGEN_WINDOW_DAYS);
  if (hi <= 0) return 0;
  const top = Math.min(hi, idx.prefix.length - 1);
  return (idx.prefix[top] ?? 0) - (idx.prefix[lo] ?? 0);
}

/**
 * If you enter on `entryDate`, how many consecutive days can you legally stay?
 * Compliance is checked on every day of the hypothetical stay, because the rule
 * is tested daily — not only at the border.
 *
 * On day k of a continuous stay the hypothetical trip contributes exactly k+1
 * days to the window, so the test is simply:
 *     alreadyUsed(day) + (k + 1) <= 90
 * which removes the need to simulate a modified trip list at all.
 */
export function maxStayFrom(trips: Trip[], entryDate: string, cap = SCHENGEN_MAX_DAYS): number {
  const entry = toDayIndex(entryDate);
  const idx = buildDayIndex(trips, entry, entry + cap);
  let n = 0;
  for (let k = 0; k < cap; k++) {
    if (usedAt(idx, entry + k) + k + 1 > SCHENGEN_MAX_DAYS) break;
    n++;
  }
  return n;
}

/** Earliest date from which a full 90-day stay is possible. */
export function nextFullNinetyDate(
  trips: Trip[],
  fromDate: string,
  horizonDays = 400,
): string | null {
  const start = toDayIndex(fromDate);
  // One index covers every candidate, instead of rebuilding it 400 times.
  const idx = buildDayIndex(trips, start, start + horizonDays + SCHENGEN_MAX_DAYS);

  for (let i = 0; i < horizonDays; i++) {
    const entry = start + i;
    let full = true;
    for (let k = 0; k < SCHENGEN_MAX_DAYS; k++) {
      if (usedAt(idx, entry + k) + k + 1 > SCHENGEN_MAX_DAYS) {
        full = false;
        break;
      }
    }
    if (full) return fromDayIndex(entry);
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
