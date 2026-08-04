/**
 * Date helpers shared by trip/tax UI. Everything routes through the
 * day-index arithmetic in `schengen.ts` — no local-timezone Date maths.
 */
import { fromDayIndex, toDayIndex, type Trip as EngineTrip } from "./schengen";
import type { Trip } from "./types";

/** Today as YYYY-MM-DD in UTC (same calendar day for every user of the engine). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  return fromDayIndex(toDayIndex(iso) + days);
}

/** Inclusive day count between two ISO dates. */
export function inclusiveDays(startIso: string, endIso: string): number {
  return toDayIndex(endIso) - toDayIndex(startIso) + 1;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Aug 2026" for an ISO date, without touching local time. */
export function monthYearLabel(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Adapt a stored (snake_case) trip to the engine's trip shape. */
export function toEngineTrip(trip: Trip): EngineTrip {
  return {
    countryCode: trip.country_code,
    entryDate: trip.entry_date,
    exitDate: trip.exit_date,
    purpose: trip.purpose,
  };
}

export function toEngineTrips(trips: Trip[]): EngineTrip[] {
  return trips.map(toEngineTrip);
}

export type CountryDayCount = {
  country_code: string;
  days: number;
  periodStart: string;
  periodEnd: string;
};

function isoFromParts(year: number, monthIndex: number, day: number): string {
  return fromDayIndex(Math.floor(Date.UTC(year, monthIndex, day) / 86_400_000));
}

/**
 * Cumulative days spent in one country inside that country's tax year.
 * `taxYearStartMonth` is 0-indexed (0 = January, 2 = March, 6 = July).
 */
export function daysInCountryTaxYear(
  trips: Trip[],
  countryCode: string,
  referenceIso: string,
  taxYearStartMonth = 0,
): CountryDayCount {
  const refMonth = Number(referenceIso.split("-")[1]) - 1;
  let startYear = Number(referenceIso.split("-")[0]);
  if (refMonth < taxYearStartMonth) startYear -= 1;

  const periodStart = isoFromParts(startYear, taxYearStartMonth, 1);
  const periodEnd = addDaysIso(isoFromParts(startYear + 1, taxYearStartMonth, 1), -1);

  const ref = toDayIndex(referenceIso);
  const lo = toDayIndex(periodStart);
  const hi = Math.min(toDayIndex(periodEnd), ref);

  let days = 0;
  for (const trip of trips) {
    if (trip.country_code.toUpperCase() !== countryCode.toUpperCase()) continue;
    const entry = toDayIndex(trip.entry_date);
    const exit = trip.exit_date ? toDayIndex(trip.exit_date) : ref;
    const from = Math.max(entry, lo);
    const to = Math.min(exit, hi);
    if (from <= to) days += to - from + 1;
  }

  return { country_code: countryCode.toUpperCase(), days, periodStart, periodEnd };
}

/** Set of ISO days inside the current rolling Schengen window that count. */
export function schengenWindowDays(trips: Trip[], referenceIso: string): Set<string> {
  const ref = toDayIndex(referenceIso);
  const windowStart = ref - 179;
  const days = new Set<string>();
  for (const trip of trips) {
    if (trip.purpose === "residence") continue;
    const entry = toDayIndex(trip.entry_date);
    const exit = trip.exit_date ? toDayIndex(trip.exit_date) : ref;
    for (let d = Math.max(entry, windowStart); d <= Math.min(exit, ref); d++) {
      days.add(fromDayIndex(d));
    }
  }
  return days;
}
