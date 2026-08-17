/**
 * Every branch of the cancel-button decision, including the ones that were
 * wrong in production.
 *
 * Two regressions are pinned explicitly:
 *   - a paying customer whose cached plan said "free" lost the cancel button
 *   - a founding member was offered "cancel subscription" and told none existed
 */
import { describe, expect, it } from "vitest";
import { billingView } from "./billing-view";

const sub = (over: Partial<NonNullable<Parameters<typeof billingView>[0]["state"]>> = {}) => ({
  cancellable: true,
  status: "active" as string | null,
  periodEnd: "2026-09-17",
  cancelAtPeriodEnd: false,
  lifetime: false,
  hasCustomer: true,
  ...over,
});

describe("billingView", () => {
  it("offers cancellation to an active subscriber", () => {
    const v = billingView({ state: sub(), plan: "pro" });
    expect(v).toMatchObject({
      variant: "active",
      showPortal: true,
      canCancel: true,
      buttonLabel: "Manage or cancel subscription",
    });
  });

  it("never offers cancellation to a founding member", () => {
    // The regression: plan is not free, so the old code showed "cancel
    // subscription", and the portal then reported no subscription found.
    const v = billingView({
      state: sub({ lifetime: true, status: null }),
      plan: "founding_lifetime",
    });
    expect(v.variant).toBe("lifetime");
    expect(v.canCancel).toBe(false);
    expect(v.buttonLabel).toBe("Invoices and payment details");
    // Still reachable: invoices matter for their own bookkeeping.
    expect(v.showPortal).toBe(true);
  });

  it("treats lifetime as lifetime even when a stale subscription row exists", () => {
    const v = billingView({ state: sub({ lifetime: true, status: "canceled" }), plan: "pro" });
    expect(v.variant).toBe("lifetime");
    expect(v.canCancel).toBe(false);
  });

  it("says already cancelled rather than offering to cancel again", () => {
    const v = billingView({ state: sub({ cancelAtPeriodEnd: true }), plan: "pro" });
    expect(v.variant).toBe("cancelled");
    expect(v.canCancel).toBe(false);
    expect(v.showPortal).toBe(true);
  });

  it("shows the free state when Stripe knows the customer but has no subscription", () => {
    const v = billingView({ state: sub({ status: null }), plan: "free" });
    expect(v.variant).toBe("free");
    expect(v.canCancel).toBe(false);
    // Portal still offered: a customer record exists, so there may be invoices.
    expect(v.showPortal).toBe(true);
  });

  it("hides the portal for a genuine free user with no Stripe customer", () => {
    const v = billingView({ state: sub({ status: null, hasCustomer: false }), plan: "free" });
    expect(v.showPortal).toBe(false);
    expect(v.variant).toBe("free");
  });

  describe("when the Stripe read fails", () => {
    it("still offers the portal to anyone whose cached plan is paid", () => {
      // THE REGRESSION THIS FILE EXISTS FOR. Any break in the entitlement chain
      // used to hide the cancel button from a paying customer. Failing toward
      // reachable is the § 312k-safe direction.
      for (const plan of ["pro", "starter", "teams", "founding_lifetime"]) {
        expect(billingView({ state: null, plan }).showPortal).toBe(true);
      }
    });

    it("does not offer the portal to a free user", () => {
      expect(billingView({ state: null, plan: "free" }).showPortal).toBe(false);
    });

    it("falls back to the cached plan to detect a founding member", () => {
      const v = billingView({ state: null, plan: "founding_lifetime" });
      expect(v.variant).toBe("lifetime");
      expect(v.canCancel).toBe(false);
    });

    it("does not claim a subscription exists when it cannot tell", () => {
      const v = billingView({ state: null, plan: "pro" });
      expect(v.canCancel).toBe(false);
      expect(v.buttonLabel).toBe("Billing portal and invoices");
    });
  });

  it("never labels a button cancel unless cancellation is possible", () => {
    // The invariant that keeps the button honest: the label must never promise
    // something the portal will refuse to do.
    const cases: Parameters<typeof billingView>[0][] = [
      { state: sub(), plan: "pro" },
      { state: sub({ lifetime: true }), plan: "founding_lifetime" },
      { state: sub({ cancelAtPeriodEnd: true }), plan: "pro" },
      { state: sub({ status: null }), plan: "free" },
      { state: null, plan: "pro" },
      { state: null, plan: "free" },
    ];
    for (const input of cases) {
      const v = billingView(input);
      if (v.buttonLabel === "Manage or cancel subscription") {
        expect(v.canCancel).toBe(true);
      }
    }
  });
});
