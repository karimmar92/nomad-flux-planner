/**
 * Business-tier commercials: seat maths for /business, /org and checkout.
 *
 * The prices live in src/config/business-plans.ts, next to the features they
 * buy. This file used to hold its own hand-typed $8 per seat, dated before the
 * central pricing config existed; when Teams later became $59 nothing told it,
 * and it sat live quoting a stale price on the one page a buyer reads. It now
 * only does arithmetic on the real numbers.
 *
 * Plans are billed yearly per seat, so there is one total, not two.
 */
import {
  MINIMUM_SEATS,
  businessTier,
  monthlyEquivalentUsd,
  type BusinessTierId,
} from "@/config/business-plans";

export { MINIMUM_SEATS, monthlyEquivalentUsd };

export function perSeatYearlyUsd(tier: BusinessTierId = "advanced"): number {
  return businessTier(tier).yearlyUsd;
}

/** What one year costs, never fewer than the minimum seat count. */
export function yearlyTotal(seats: number, tier: BusinessTierId = "advanced"): number {
  return Math.max(seats, MINIMUM_SEATS) * perSeatYearlyUsd(tier);
}

export function usd(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
