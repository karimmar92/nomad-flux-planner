/**
 * Stripe price wiring.
 *
 * Price IDs live in environment variables, never in the repo: they differ
 * between test and live mode, and a hard-coded test price that reaches
 * production takes real money for nothing.
 *
 * Create in Stripe, one Product per tier with two recurring Prices:
 *
 *   Starter  monthly $14   yearly $140    STRIPE_PRICE_STARTER_MONTHLY / _YEARLY
 *   Pro      monthly $29   yearly $290    STRIPE_PRICE_PRO_MONTHLY     / _YEARLY
 *   Teams    monthly $59   yearly $590    STRIPE_PRICE_TEAMS_MONTHLY   / _YEARLY
 *                          (per seat — set the price to "per unit")
 *
 * The yearly figures are monthly × 10, matching ANNUAL_MONTHS_CHARGED in
 * src/config/pricing.ts. If you change a price in Stripe, change it there too —
 * pricing.ts is what the site displays, Stripe is what actually charges, and
 * the two disagreeing is a misleading price claim rather than a cosmetic bug.
 *
 * TAX SETTINGS — do NOT enable Stripe Tax.
 *
 * An earlier version of this note said to switch it on. That was written
 * before the provider's VAT position was pinned down and it is wrong: the
 * operator is a §19 UStG Kleinunternehmer (see src/config/legal.ts), so there
 * is no entitlement to collect VAT and no registration to remit it against.
 * Stripe Tax would add tax to every invoice that could not lawfully be kept.
 * `automatic_tax` is therefore disabled in billing.functions.ts, and that file
 * carries the full note on when this must be revisited (the €10,000
 * cross-border B2C threshold arrives first).
 *
 * Set prices as TAX INCLUSIVE anyway: with no VAT applied the displayed figure
 * is the total payable, which is what PAngV requires — and if the exemption
 * ever ends, the price the customer was shown stays the price they pay.
 */
import type { PlanId } from "./pricing";

export type BillingInterval = "monthly" | "yearly";

/** Paid tiers only — "free" has no price. */
export type PaidPlanId = Exclude<PlanId, "free">;

const ENV_KEYS: Record<PaidPlanId, Record<BillingInterval, string>> = {
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    yearly: "STRIPE_PRICE_STARTER_YEARLY",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
  teams: {
    monthly: "STRIPE_PRICE_TEAMS_MONTHLY",
    yearly: "STRIPE_PRICE_TEAMS_YEARLY",
  },
};

/** Server-side only: reads process.env. Throws with a usable message. */
export function priceIdFor(plan: PaidPlanId, interval: BillingInterval): string {
  const key = ENV_KEYS[plan]?.[interval];
  const value = key ? process.env[key] : undefined;
  if (!value) {
    throw new Error(
      `Missing ${key}. Create the price in Stripe and set it in the environment before enabling checkout.`,
    );
  }
  return value;
}

/**
 * Reverse lookup used by the webhook: which plan does this price grant?
 *
 * Deliberately derived from the same env vars rather than from Stripe
 * metadata. Metadata can be edited in the dashboard by anyone with access;
 * a mismatch there would silently grant the wrong tier.
 */
export function planForPriceId(priceId: string): PaidPlanId | null {
  for (const plan of Object.keys(ENV_KEYS) as PaidPlanId[]) {
    for (const interval of ["monthly", "yearly"] as BillingInterval[]) {
      const key = ENV_KEYS[plan][interval];
      if (process.env[key] && process.env[key] === priceId) return plan;
    }
  }
  return null;
}

/** True when every price is configured — checkout stays closed otherwise. */
export function billingConfigured(): boolean {
  if (!process.env["STRIPE_SECRET_KEY"]) return false;
  return (Object.keys(ENV_KEYS) as PaidPlanId[]).every((plan) =>
    (["monthly", "yearly"] as BillingInterval[]).every(
      (interval) => !!process.env[ENV_KEYS[plan][interval]],
    ),
  );
}
