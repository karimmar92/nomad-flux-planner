/**
 * Billing section — and specifically, the CANCEL BUTTON.
 *
 * § 312k BGB requires that a consumer who signed up online can end the
 * contract online, through a button that is "ständig verfügbar sowie
 * unmittelbar und leicht zugänglich": permanently available, directly and
 * easily reachable. Not an email to support, not a chat request.
 *
 * This existed as a server function (`createPortalSession`, documented as
 * "this IS the Kündigungsbutton") that NOTHING in the app ever called. So the
 * legal obligation was met in a comment and nowhere else, while the pricing
 * page, the Terms and the refund policy all told people they could cancel from
 * their account. That combination — a promise in writing and no button — is
 * worse than having neither.
 *
 * The Stripe billing portal handles cancellation, payment method, invoices and
 * the invoice history a customer needs for their own bookkeeping, so one
 * button covers all of it.
 *
 * PORTAL CONFIGURATION: cancellation must be enabled in the Stripe Dashboard
 * (Settings → Billing → Customer portal → "Customers can cancel
 * subscriptions"). It is OFF by default, and with it off this button opens a
 * portal with no way out — which is the exact defect § 312k targets.
 */
import { useEffect, useState } from "react";
import { CreditCard, Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { createPortalSession } from "@/lib/billing/billing.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { useProfile } from "@/lib/store";
import { useSession } from "@/lib/use-session";
import { tierName } from "@/config/pricing";

export function BillingCard() {
  const { signedIn } = useSession();
  const { profile } = useProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);

  /**
   * Stripe returns to /profile?checkout=success. Read it from the URL rather
   * than through the router's search validation: this is a one-off external
   * redirect, and adding a validateSearch to the profile route would make
   * every internal link to it carry the param in its types.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    setJustPaid(true);
    // Clear it so a refresh or a shared link does not re-announce a payment.
    params.delete("checkout");
    params.delete("session_id");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  if (!signedIn) return null;

  const paid = profile.plan !== "free";

  async function openPortal() {
    setBusy(true);
    setError(null);
    try {
      const result = await createPortalSession({
        data: {
          environment: getStripeEnvironment(),
          returnUrl: `${window.location.origin}/profile`,
        },
      });
      if ("error" in result) throw new Error(result.error);
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

  return (
    <section className="panel p-4">
      {justPaid ? (
        <p className="mb-3 flex items-start gap-2 rounded-md bg-accent-positive-muted p-3 text-xs leading-relaxed">
          <Check className="mt-px h-3.5 w-3.5 shrink-0 text-accent-positive" aria-hidden />
          <span>
            Payment received — your subscription is active. The invoice is on its way by email. It
            can take a few seconds for the new plan to show below.
          </span>
        </p>
      ) : null}

      <h2 className="text-sm font-semibold">Billing</h2>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {paid ? (
          <>
            You are on <span className="font-medium text-foreground">{tierName(profile.plan)}</span>
            . Manage your payment method, download invoices, or cancel — cancelling stops the next
            renewal and you keep access until the end of the period you have paid for.
          </>
        ) : (
          <>
            You are on the free plan. Logging trips and seeing your current status stays free; paid
            plans add planning ahead, exports and the vault.
          </>
        )}
      </p>

      {paid ? (
        <>
          <button
            type="button"
            onClick={openPortal}
            disabled={busy}
            className="mt-3 flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-surface-2 disabled:opacity-40"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            {busy ? "Opening…" : "Manage or cancel subscription"}
          </button>
          {error ? (
            <p role="alert" className="mt-2 text-xs text-negative">
              {error}
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
