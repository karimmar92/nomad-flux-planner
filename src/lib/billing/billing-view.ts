/**
 * What the billing card should show. Pure, so it can be tested exhaustively.
 *
 * ── WHY THIS IS NOT LEFT INSIDE THE COMPONENT ──────────────────────────
 *
 * The decision depends on five inputs — lifetime purchase, whether a
 * subscription exists, whether it is already cancelled, whether Stripe knows
 * the customer at all, and the cached plan — and the two ways it can be wrong
 * are both expensive:
 *
 *   HIDING THE CANCEL PATH from someone who is paying. § 312k BGB requires it
 *   to be permanently available and easily reachable. Someone who cannot find
 *   it disputes the charge instead, which costs more than the subscription.
 *
 *   OFFERING CANCELLATION to someone with nothing to cancel. A founding member
 *   clicking "cancel subscription" and being told no subscription exists reads
 *   as though their one-time payment has been lost.
 *
 * As a chain of ternaries in JSX that matrix is unreviewable and untestable.
 * Here it is sixteen lines and every branch is pinned by a test.
 *
 * ── THE BIAS, STATED DELIBERATELY ──────────────────────────────────────
 *
 * When the Stripe read FAILS (state === null) the portal is still offered to
 * anyone whose cached plan is not free. That is deliberate and it is the
 * asymmetry that matters: wrongly showing a portal link costs one confusing
 * click, wrongly hiding it costs a chargeback and arguably breaches § 312k.
 * Fail toward the exit being reachable.
 */

export type BillingViewInput = {
  /** From Stripe. Null when the read failed or has not completed. */
  state: {
    cancellable: boolean;
    status: string | null;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    lifetime: boolean;
    hasCustomer: boolean;
  } | null;
  /** The locally cached plan. Only a fallback; never the primary source. */
  plan: string;
};

export type BillingView = {
  /** Which explanatory paragraph to render. */
  variant: "lifetime" | "cancelled" | "active" | "free";
  /** Whether to show the portal button at all. */
  showPortal: boolean;
  /** The button label, which must match what the portal will actually offer. */
  buttonLabel:
    | "Manage or cancel subscription"
    | "Invoices and payment details"
    | "Billing portal and invoices";
  /** Whether this user can actually cancel something right now. */
  canCancel: boolean;
};

export function billingView({ state, plan }: BillingViewInput): BillingView {
  const lifetime = state?.lifetime ?? plan === "founding_lifetime";
  const hasSubscription = state?.status != null;
  const alreadyCancelled = state?.cancelAtPeriodEnd === true;

  // Fail toward reachable. See the header note on the asymmetry.
  const showPortal = state?.hasCustomer === true || (state == null && plan !== "free");

  const variant: BillingView["variant"] = lifetime
    ? "lifetime"
    : alreadyCancelled
      ? "cancelled"
      : hasSubscription
        ? "active"
        : "free";

  // A lifetime buyer is never offered cancellation, because there is nothing to
  // cancel and saying otherwise implies their purchase is a subscription.
  const canCancel = !lifetime && hasSubscription && !alreadyCancelled;

  const buttonLabel: BillingView["buttonLabel"] = lifetime
    ? "Invoices and payment details"
    : canCancel
      ? "Manage or cancel subscription"
      : "Billing portal and invoices";

  return { variant, showPortal, buttonLabel, canCancel };
}
