/**
 * Price wiring.
 *
 * Prices are now created through Lovable's built-in payments, which gives every
 * price a HUMAN-READABLE lookup key ("pro_monthly") that is identical in the
 * test and live environments. That replaces the old env-var indirection: there
 * is no longer a test price id that can leak into production, because the id
 * the app uses is not environment-specific at all.
 *
 * The tiers and amounts here must match src/config/pricing.ts, which is what
 * the site displays. The site showing one figure and the checkout charging
 * another is a misleading price claim, not a cosmetic bug.
 *
 * Annual is eight months charged for twelve — a 33% saving, and the number in
 * the "Save 33%" badge is derived from that same constant, never typed in.
 *
 *   Starter  $14/mo   $112/yr    starter_monthly / starter_yearly
 *   Pro      $29/mo   $232/yr    pro_monthly     / pro_yearly
 *   Teams    $59/seat $472/seat  teams_monthly   / teams_yearly  (not sold yet)
 *
 * TAX — deliberately NOT automated. The provider is a §19 UStG
 * Kleinunternehmer (src/config/legal.ts): there is no entitlement to collect
 * VAT and no registration to remit it against, so neither Stripe Tax nor
 * end-to-end compliance handling is switched on. Prices are gross AND final,
 * which is what PAngV requires. See billing.functions.ts for the thresholds
 * that end this.
 */
import type { PlanId } from "./pricing";

export type BillingInterval = "monthly" | "yearly";

/** Recurring subscription tiers. */
export type RecurringPlanId = "starter" | "pro" | "teams";
/** One-time purchase tiers. */
export type OneTimePlanId = "founding_lifetime";
/** Paid tiers only — "free" has no price. */
export type PaidPlanId = RecurringPlanId | OneTimePlanId;

const RECURRING_KEYS: Record<RecurringPlanId, Record<BillingInterval, string>> = {
  starter: { monthly: "starter_monthly", yearly: "starter_yearly" },
  pro: { monthly: "pro_monthly", yearly: "pro_yearly" },
  teams: { monthly: "teams_monthly", yearly: "teams_yearly" },
};

const ONE_TIME_KEYS: Record<OneTimePlanId, string> = {
  founding_lifetime: "founding_lifetime",
};

/** The lookup key checkout resolves against Stripe. Safe on client or server. */
export function priceIdFor(plan: PaidPlanId, interval: BillingInterval): string {
  if (plan === "founding_lifetime") return ONE_TIME_KEYS[plan];
  return RECURRING_KEYS[plan][interval];
}

/**
 * Reverse lookup used by the webhook: which plan does this price grant?
 *
 * Resolves lookup keys, so it works unchanged across test and live. Stripe's
 * internal price ids (price_xxx) differ between environments and must never be
 * used for entitlement.
 */
export function planForPriceId(priceId: string | null | undefined): PaidPlanId | null {
  if (!priceId) return null;
  if (priceId in ONE_TIME_KEYS) return priceId as OneTimePlanId;
  for (const plan of Object.keys(RECURRING_KEYS) as RecurringPlanId[]) {
    for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
      if (RECURRING_KEYS[plan][interval] === priceId) return plan;
    }
  }
  return null;
}

/** True for one-time purchases (no renewal, no subscription row). */
export function isOneTimePlan(plan: PaidPlanId): boolean {
  return plan in ONE_TIME_KEYS;
}

/** Seat range for the per-seat tier, enforced server-side as well as in Stripe. */
export const TEAMS_SEAT_MIN = 10;
export const TEAMS_SEAT_MAX = 500;
