/**
 * The entitlement rule, pinned.
 *
 * This function decides who gets paid features. Two failure directions and
 * they are not symmetric:
 *
 *   Too generous is revenue quietly lost and nobody ever reports it, because
 *   nobody complains about getting something free.
 *
 *   Too strict takes access away from somebody who paid, which they notice
 *   immediately, usually at a border.
 *
 * The founding cases matter most: those people paid once, permanently, and a
 * subscription-shaped code path must never be able to downgrade them.
 */
import { describe, expect, it } from "vitest";
import { expectedPlanFor } from "./admin-billing.functions";

describe("expectedPlanFor", () => {
  it("keeps a founding member on pro with no subscription at all", () => {
    expect(
      expectedPlanFor({ foundingNumber: 7, subscriptionStatus: null, planFromPrice: null }),
    ).toBe("founding_lifetime");
  });

  it("keeps a founding member on pro even when a subscription was cancelled", () => {
    // The exact case the trigger in the migration also guards. Two layers,
    // because taking away something bought permanently is unrecoverable trust.
    expect(
      expectedPlanFor({ foundingNumber: 1, subscriptionStatus: "canceled", planFromPrice: null }),
    ).toBe("founding_lifetime");
  });

  it("does not downgrade a founding member who also has a lapsed Teams sub", () => {
    expect(
      expectedPlanFor({ foundingNumber: 42, subscriptionStatus: "unpaid", planFromPrice: "teams" }),
    ).toBe("founding_lifetime");
  });

  it("gives free when there is no subscription and no founding spot", () => {
    expect(
      expectedPlanFor({ foundingNumber: null, subscriptionStatus: null, planFromPrice: null }),
    ).toBe("free");
  });

  it("entitles on active, trialing and past_due", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(
        expectedPlanFor({ foundingNumber: null, subscriptionStatus: status, planFromPrice: "pro" }),
        status,
      ).toBe("pro");
    }
  });

  it("keeps past_due entitled, on purpose", () => {
    // A failed card retry must not lock somebody out of their passport vault
    // mid-trip. Stripe cancels after its own retry schedule, and the deletion
    // event is what actually downgrades.
    expect(
      expectedPlanFor({
        foundingNumber: null,
        subscriptionStatus: "past_due",
        planFromPrice: "starter",
      }),
    ).toBe("starter");
  });

  it("does not entitle on cancelled, unpaid or incomplete", () => {
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) {
      expect(
        expectedPlanFor({ foundingNumber: null, subscriptionStatus: status, planFromPrice: "pro" }),
        status,
      ).toBe("free");
    }
  });

  it("falls back to free when the price maps to nothing", () => {
    // An unmapped price means somebody created a price in Stripe and did not
    // add it to the config. Granting the top tier on an unknown price would be
    // the wrong direction to guess in.
    expect(
      expectedPlanFor({ foundingNumber: null, subscriptionStatus: "active", planFromPrice: null }),
    ).toBe("free");
  });

  it("returns the tier the price maps to, not a fixed one", () => {
    expect(
      expectedPlanFor({
        foundingNumber: null,
        subscriptionStatus: "active",
        planFromPrice: "starter",
      }),
    ).toBe("starter");
    expect(
      expectedPlanFor({
        foundingNumber: null,
        subscriptionStatus: "active",
        planFromPrice: "teams",
      }),
    ).toBe("teams");
  });
});
