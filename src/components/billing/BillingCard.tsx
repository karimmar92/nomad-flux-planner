/**
 * Billing section — and specifically, the CANCEL BUTTON.
 *
 * § 312k BGB requires that a consumer who signed up online can end the
 * contract online, through a button that is "ständig verfügbar sowie
 * unmittelbar und leicht zugänglich": permanently available, directly and
 * easily reachable. Not an email to support, not a chat request.
 *
 * ── WHY THIS ASKS STRIPE INSTEAD OF READING profile.plan ───────────────
 *
 * It used to decide with `paid = profile.plan !== "free"`, reading a plan
 * string held in localStorage and refreshed by usePlanSync. That produced both
 * failures, in both directions:
 *
 *   BUTTON MISSING FOR A PAYING CUSTOMER. Any break in the entitlement chain
 *   leaves the cached plan at "free" and the cancel button simply does not
 *   render. "Hidden because our own cache was stale" is not a § 312k defence,
 *   and someone who cannot find how to cancel disputes the charge instead —
 *   which costs more than the subscription was worth.
 *
 *   BUTTON OFFERED WITH NOTHING TO CANCEL. A founding member has
 *   `plan = founding_lifetime` and no subscription by design. They were shown
 *   "Manage or cancel subscription" and clicking it answered "No subscription
 *   found for this account", which reads as though their purchase had vanished.
 *
 * So the state comes from `getSubscriptionState`, which reads Stripe. Stripe is
 * where the money is and the only place that knows whether something
 * cancellable exists.
 *
 * ── WHAT WAS REMOVED ──────────────────────────────────────────────────
 *
 * This component used to read `?checkout=success` off window.location and then
 * strip `session_id` from the URL with replaceState. That directly fought
 * CheckoutReturn, which needs `session_id` to verify the payment: whichever
 * effect ran first decided whether a subscription purchase got verified at all.
 * The post-checkout confirmation now belongs to CheckoutReturn alone. One owner
 * per piece of state.
 *
 * PORTAL CONFIGURATION: cancellation must be enabled in the Stripe Dashboard
 * (Settings → Billing → Customer portal → "Customers can cancel
 * subscriptions"). It is OFF by default, and with it off this button opens a
 * portal with no way out — the exact defect § 312k targets.
 */
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Infinity as InfinityIcon, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  createPortalSession,
  getSubscriptionState,
  type SubscriptionState,
} from "@/lib/billing/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useProfile } from "@/lib/store";
import { useSession } from "@/lib/use-session";
import { tierName } from "@/config/pricing";
import { FOUNDING_PRICE_USD } from "@/config/founding";
import { PROVIDER } from "@/config/legal";
import { billingView } from "@/lib/billing/billing-view";

export function BillingCard() {
  const { signedIn } = useSession();
  const { profile } = useProfile();
  const loadState = useServerFn(getSubscriptionState);
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Founding members have no portal; this holds the friendly explanation.
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loadState({ data: { environment: getStripeEnvironment() } });
      // A failed read must not hide the button. See openPortal: the portal is
      // offered anyway whenever a Stripe customer might exist, because the
      // consequence of wrongly hiding it is a chargeback.
      setState("error" in result ? null : result);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [loadState]);

  useEffect(() => {
    if (!signedIn) return;
    void refresh();
  }, [signedIn, refresh]);

  if (!signedIn) return null;

  async function openPortal() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createPortalSession({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/profile`,
        },
      });
      if ("error" in result) throw new Error(result.error);
      if ("lifetime" in result) {
        // Not an error: a founding member has nothing to manage. Say so where
        // the error used to appear, and stop.
        setNotice(result.message);
        setBusy(false);
        return;
      }
      // Same tab: the portal is the cancellation route (§312k BGB) and must not
      // depend on a popup surviving a blocker.
      window.location.href = result.url;

    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not open the billing portal. Please try again.",
      );
      setBusy(false);
    }
  }

  // Every branch of this decision lives in billing-view.ts and is covered by
  // billing-view.test.ts. Keeping it out of the JSX is what made the founding
  // member and stale-cache cases reviewable at all.
  const view = billingView({ state, plan: profile.plan });

  return (
    <section className="panel p-4">
      <h2 className="text-sm font-semibold">Billing</h2>

      {loading ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Checking your subscription with Stripe.
        </p>
      ) : view.variant === "lifetime" ? (
        <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <InfinityIcon className="mt-px h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <span>
            You are a founding member. You paid ${FOUNDING_PRICE_USD} once, so there is no
            subscription and nothing to cancel. Nothing will ever be charged again.
          </span>
        </p>
      ) : view.variant === "cancelled" ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Your subscription is{" "}
          <span className="font-medium text-foreground">already cancelled</span> and will not renew.
          {state?.periodEnd ? ` You keep access until ${state.periodEnd}.` : ""} You can restart it
          at any time from the portal.
        </p>
      ) : view.variant === "active" ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          You are on <span className="font-medium text-foreground">{tierName(profile.plan)}</span>.
          Manage your payment method, download invoices, or cancel — cancelling stops the next
          renewal and you keep access until the end of the period you have paid for
          {state?.periodEnd ? `, which is ${state.periodEnd}` : ""}.
        </p>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          You are on the free plan. Logging trips and seeing your current status stays free; paid
          plans add planning ahead, exports and the vault.
        </p>
      )}

      {view.showPortal ? (
        <>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-surface-2 disabled:opacity-40"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            {busy ? "Opening…" : view.buttonLabel}
          </button>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-negative">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {notice}{" "}
              <Link to="/profile" className="underline">
                Export your data
              </Link>{" "}
              at any time, or email {PROVIDER.email}.
            </p>
          ) : null}
        </>

      ) : (
        <Link
          to="/pricing"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-surface-2"
        >
          See plans
        </Link>
      )}
    </section>
  );
}
