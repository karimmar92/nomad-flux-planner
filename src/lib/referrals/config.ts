/**
 * Two referral programs. They are deliberately kept apart — separate tables,
 * separate UI, separate vocabulary. Conflating cash commission with free
 * months is how a referral system becomes unauditable.
 *
 *   Program A — Creator program: application-gated, cash, 30% recurring.
 *   Program B — User referrals: open to everyone, free months only, never cash.
 *
 * Affiliate revenue (eSIM / insurance) is explicitly OUT OF SCOPE for both
 * programs. Third-party sub-ID plumbing is fragile and it would add roughly
 * $8/month to a creator payout for a large amount of reconciliation risk.
 */

export const CREATOR_PROGRAM = {
  /** Share of collected subscription revenue paid to the creator. */
  revenueShare: 0.3,
  /** Recurring, but capped per referred user. */
  capMonthsPerReferredUser: 12,
  /** Accruals clear after the refund + dispute window. */
  holdDays: 45,
  /** Don't pay wire fees on $4. */
  minPayoutCents: 5000,
  currency: "usd",
  payoutRail: "Stripe Connect Express",
  termsVersion: "2026-08-04",
  /** Subscriptions only. Never affiliate revenue. */
  eligibleRevenue: ["subscription"] as const,
} as const;

export const USER_PROGRAM = {
  /** Both sides get exactly one free month of Pro. No cash, ever. */
  freeMonthsPerSide: 1,
  /** Bounds the giveaway. */
  maxEarnedMonthsPerRollingYear: 12,
  /**
   * The referred user's month applies at signup; the referrer's only once the
   * referred user has been active this long. Rewarding the referrer at signup
   * makes fake-account farming trivially profitable.
   */
  referrerQualifyingDays: 14,
} as const;

/** Referral links are driftly.app/?r=CODE */
export const REFERRAL_PARAM = "r";
export const REFERRAL_COOKIE = "driftly_ref";
export const REFERRAL_STORAGE_KEY = "driftly.referral";
/** Last-touch window. */
export const ATTRIBUTION_WINDOW_DAYS = 30;

export const PUBLIC_ORIGIN = "https://driftly.app";

export function referralUrl(code: string) {
  return `${PUBLIC_ORIGIN}/?${REFERRAL_PARAM}=${code}`;
}

export function formatUsd(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
