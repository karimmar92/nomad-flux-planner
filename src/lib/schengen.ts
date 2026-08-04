import {
  addDays,
  differenceInCalendarDays,
  format,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import type { Trip } from "./types";

/**
 * Countries in the Schengen area (ISO-2). Used by the rolling 90/180 engine.
 */
export const SCHENGEN_COUNTRIES = [
  "AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS",
  "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI",
  "ES", "SE", "CH",
];

export const SCHENGEN_LIMIT_DAYS = 90;
export const SCHENGEN_WINDOW_DAYS = 180;

export function isSchengen(countryCode: string): boolean {
  return SCHENGEN_COUNTRIES.includes(countryCode.toUpperCase());
}

/** Parse a yyyy-MM-dd string into a date-only value. Never compare timestamps. */
export function toDay(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const parsed = parseISO(value);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

export function dayKey(value: string | Date): string {
  return format(toDay(value), "yyyy-MM-dd");
}

export type SchengenResult = {
  referenceDate: string;
  windowStart: string;
  /** Days of Schengen presence inside the trailing 180-day window (inclusive both ends). */
  daysUsed: number;
  daysRemaining: number;
  /** Individual occupied days inside the window, sorted ascending. */
  occupiedDays: string[];
  /** Earliest date from which a fresh full 90-day stay is possible. */
  nextFullResetDate: string;
  overstayed: boolean;
};

/**
 * Expand trips into the set of date keys on which the traveller was physically
 * inside the Schengen area. Entry day and exit day both count as full days.
 * Open trips (no exit date) run through `until`.
 */
export function schengenOccupiedDays(trips: Trip[], until: Date): Set<string> {
  const days = new Set<string>();
  const end = toDay(until);
  for (const trip of trips) {
    if (!isSchengen(trip.country_code)) continue;
    let cursor = toDay(trip.entry_date);
    const tripEnd = trip.exit_date ? toDay(trip.exit_date) : end;
    const stop = isAfter(tripEnd, end) ? end : tripEnd;
    if (isAfter(cursor, stop)) continue;
    while (!isAfter(cursor, stop)) {
      days.add(dayKey(cursor));
      cursor = addDays(cursor, 1);
    }
  }
  return days;
}

function countInWindow(days: Set<string>, reference: Date): string[] {
  const windowStart = addDays(toDay(reference), -(SCHENGEN_WINDOW_DAYS - 1));
  const inWindow: string[] = [];
  for (const day of days) {
    const d = toDay(day);
    if (!isBefore(d, windowStart) && !isAfter(d, toDay(reference))) inWindow.push(day);
  }
  return inWindow.sort();
}

/**
 * Core Schengen 90/180 engine. Pure: same trips + reference date => same answer.
 * The window is rolling — time outside Schengen never pauses or resets it.
 */
export function calculateSchengenStatus(trips: Trip[], referenceDate: Date): SchengenResult {
  const reference = toDay(referenceDate);
  const occupied = schengenOccupiedDays(trips, reference);
  const inWindow = countInWindow(occupied, reference);
  const daysUsed = inWindow.length;

  // Earliest future date where the trailing 180-day window is empty enough for 90 fresh days.
  let candidate = reference;
  let nextFullReset = reference;
  for (let i = 0; i <= SCHENGEN_WINDOW_DAYS + 1; i++) {
    candidate = addDays(reference, i);
    if (countInWindow(occupied, candidate).length === 0) {
      nextFullReset = candidate;
      break;
    }
    nextFullReset = candidate;
  }

  return {
    referenceDate: dayKey(reference),
    windowStart: dayKey(addDays(reference, -(SCHENGEN_WINDOW_DAYS - 1))),
    daysUsed,
    daysRemaining: Math.max(0, SCHENGEN_LIMIT_DAYS - daysUsed),
    occupiedDays: inWindow,
    nextFullResetDate: dayKey(nextFullReset),
    overstayed: daysUsed > SCHENGEN_LIMIT_DAYS,
  };
}

/**
 * Forward planner: if the traveller enters Schengen on `entryDate`, how many
 * consecutive days can they legally stay?
 */
export function maxStayFromEntry(
  trips: Trip[],
  entryDate: Date,
): { entryDate: string; maxDays: number; lastLegalDay: string | null } {
  const entry = toDay(entryDate);
  const historic = schengenOccupiedDays(trips, addDays(entry, -1));
  const planned = new Set(historic);
  let maxDays = 0;
  for (let i = 0; i < SCHENGEN_LIMIT_DAYS + 1; i++) {
    const day = addDays(entry, i);
    planned.add(dayKey(day));
    if (countInWindow(planned, day).length > SCHENGEN_LIMIT_DAYS) break;
    maxDays = i + 1;
  }
  return {
    entryDate: dayKey(entry),
    maxDays,
    lastLegalDay: maxDays > 0 ? dayKey(addDays(entry, maxDays - 1)) : null,
  };
}

export type CountryDayCount = {
  country_code: string;
  days: number;
  periodStart: string;
  periodEnd: string;
};

/**
 * Cumulative days per country inside that country's tax year window.
 * `taxYearStartMonth` is a 0-indexed month (0 = January, 2 = March, 6 = July).
 */
export function daysInCountryTaxYear(
  trips: Trip[],
  countryCode: string,
  referenceDate: Date,
  taxYearStartMonth = 0,
): CountryDayCount {
  const reference = toDay(referenceDate);
  let startYear = reference.getFullYear();
  if (reference.getMonth() < taxYearStartMonth) startYear -= 1;
  const periodStart = new Date(startYear, taxYearStartMonth, 1);
  const periodEnd = addDays(new Date(startYear + 1, taxYearStartMonth, 1), -1);

  let days = 0;
  for (const trip of trips) {
    if (trip.country_code.toUpperCase() !== countryCode.toUpperCase()) continue;
    let cursor = toDay(trip.entry_date);
    const rawEnd = trip.exit_date ? toDay(trip.exit_date) : reference;
    const end = isAfter(rawEnd, periodEnd) ? periodEnd : rawEnd;
    if (isBefore(cursor, periodStart)) cursor = periodStart;
    if (isAfter(cursor, end)) continue;
    days += differenceInCalendarDays(end, cursor) + 1;
  }

  return {
    country_code: countryCode.toUpperCase(),
    days,
    periodStart: dayKey(periodStart),
    periodEnd: dayKey(periodEnd),
  };
}
