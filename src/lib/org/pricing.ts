/**
 * Business-tier commercials: seat maths for /business, /org and checkout.
 *
 * The prices live in src/config/business-plans.ts, next to the features they
 * buy. This file used to hold its own hand-typed $8 per seat, dated before the
 * central pricing config existed; when Teams later became $59 nothing told it,
 * and it sat live quoting a stale price on the one page a buyer reads. It now
 * only does arithmetic on the real numbers.
 */
import { ANNUAL_MONTHS_CHARGED, annualSavingPercent } from "@/config/pricing";
import { MINIMUM_SEATS, businessTier, type BusinessTierId } from "@/config/business-plans";

export { MINIMUM_SEATS };

export function perSeatMonthlyUsd(tier: BusinessTierId = "advanced"): number {
  return businessTier(tier).monthlyUsd;
}

export function monthlyTotal(seats: number, tier: BusinessTierId = "advanced"): number {
  return Math.max(seats, MINIMUM_SEATS) * perSeatMonthlyUsd(tier);
}

/** Annual billing: pay ANNUAL_MONTHS_CHARGED months, the same rule every other tier uses. */
export function annualTotal(seats: number, tier: BusinessTierId = "advanced"): number {
  return Math.max(seats, MINIMUM_SEATS) * perSeatMonthlyUsd(tier) * ANNUAL_MONTHS_CHARGED;
}

export function annualPerSeatMonthly(tier: BusinessTierId = "advanced"): number {
  return Math.round((perSeatMonthlyUsd(tier) * ANNUAL_MONTHS_CHARGED) / 12);
}

/** Derived, never hand-typed. See annualSavingPercent() in the central config. */
export const ANNUAL_DISCOUNT_PERCENT = annualSavingPercent();

export function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
