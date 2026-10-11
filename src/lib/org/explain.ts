/**
 * "Show the working" for a recorded day count.
 *
 * Most tools in this category hand an HR team a number and ask them to trust
 * it. A number that cannot be explained cannot be defended to an auditor or an
 * employee who disputes it. This returns, for one person in one country, the
 * exact window, each stay that contributed and how many of its days fell inside
 * the window, so the total on screen can be checked by hand.
 *
 * It uses the same daysInWindow / rollingWindow as buildOrgOverview, so the
 * explanation and the headline figure cannot disagree.
 */
import { toDayIndex } from "@/lib/schengen";
import { basisFor } from "@/lib/reports/tax-report";
import { daysInWindow, rollingWindow, type PresenceRow } from "./presence";

export type CountedStay = {
  entry_date: string;
  exit_date: string | null;
  /** First and last day of this stay that fall inside the window. */
  countedFrom: string;
  countedTo: string;
  days: number;
  /** No exit date recorded, so counted up to today. */
  open: boolean;
  /** Part of the stay falls outside the 12-month window and is not counted. */
  clipped: boolean;
};

export type CountExplanation = {
  country_code: string;
  country: string;
  windowStart: string;
  windowEnd: string;
  stays: CountedStay[];
  total: number;
  thresholdDays: number;
  basisLabel: string;
  /** Days that sit inside two overlapping entries and are therefore counted twice. */
  overlapDays: number;
};

export function explainCount(
  rows: PresenceRow[],
  userId: string,
  countryCode: string,
  todayIso: string,
): CountExplanation {
  const code = countryCode.toUpperCase();
  const basis = basisFor(code);
  const { start, end } = rollingWindow(todayIso);

  const stays: CountedStay[] = [];
  for (const row of rows) {
    if (row.user_id !== userId || row.country_code.toUpperCase() !== code) continue;
    const days = daysInWindow(row, start, end);
    if (days <= 0) continue;
    const from = Math.max(toDayIndex(row.entry_date), toDayIndex(start));
    const to = Math.min(toDayIndex(row.exit_date ?? end), toDayIndex(end));
    stays.push({
      entry_date: row.entry_date,
      exit_date: row.exit_date,
      countedFrom: new Date(from * 86_400_000).toISOString().slice(0, 10),
      countedTo: new Date(to * 86_400_000).toISOString().slice(0, 10),
      days,
      open: row.exit_date === null,
      clipped: toDayIndex(row.entry_date) < toDayIndex(start),
    });
  }
  stays.sort((a, b) => (a.countedFrom < b.countedFrom ? -1 : 1));

  let overlapDays = 0;
  let furthest = Number.NEGATIVE_INFINITY;
  for (const s of stays) {
    const from = toDayIndex(s.countedFrom);
    const to = toDayIndex(s.countedTo);
    if (from <= furthest) overlapDays += Math.min(to, furthest) - from + 1;
    furthest = Math.max(furthest, to);
  }

  return {
    country_code: code,
    country: basis.country,
    windowStart: start,
    windowEnd: end,
    stays,
    total: stays.reduce((n, s) => n + s.days, 0),
    thresholdDays: basis.thresholdDays,
    basisLabel: basis.basisLabel,
    overlapDays,
  };
}
