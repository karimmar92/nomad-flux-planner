/**
 * Business-tier commercials — seat packaging for /business and /org.
 *
 * The PRICE ITSELF lives in src/config/pricing.ts (`tier("teams")`), the
 * app's single declared source of truth for every price shown anywhere.
 * This file used to duplicate it as a hand-typed $8/seat, dated 2026-08-04 —
 * before the central pricing config existed. When Teams later became $59/
 * seat there, nothing told this file, and it sat here live and unnoticed,
 * quoting a stale price on the one page (/business) an actual buyer reads.
 * Fixed by deleting the duplicate number and reading the real one instead,
 * so the two can never drift apart again.
 */
import { ANNUAL_MONTHS_CHARGED, annualSavingPercent, tier } from "@/config/pricing";

/** Minimum seats sold on a Teams contract — a packaging policy, not a price. */
export const MINIMUM_SEATS = 10;

export function perSeatMonthlyUsd(): number {
  return tier("teams").monthlyUsd;
}

export function monthlyTotal(seats: number): number {
  return Math.max(seats, MINIMUM_SEATS) * perSeatMonthlyUsd();
}

/** Annual billing: pay ANNUAL_MONTHS_CHARGED months, the same rule every other tier uses. */
export function annualTotal(seats: number): number {
  return Math.max(seats, MINIMUM_SEATS) * perSeatMonthlyUsd() * ANNUAL_MONTHS_CHARGED;
}

export function annualPerSeatMonthly(): number {
  return Math.round((perSeatMonthlyUsd() * ANNUAL_MONTHS_CHARGED) / 12);
}

/** Derived, never hand-typed — see annualSavingPercent() in the central config. */
export const ANNUAL_DISCOUNT_PERCENT = annualSavingPercent();

export function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
