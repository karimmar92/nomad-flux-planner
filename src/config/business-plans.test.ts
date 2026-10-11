import { describe, expect, it } from "vitest";
import {
  BUSINESS_TIERS,
  EVALUATION_SEATS,
  businessTier,
  monthlyEquivalentUsd,
  clampSeats,
  effectivePlan,
  normaliseOrgPlan,
  orgHasFeature,
  personalPlanFor,
  seatLimit,
  teamsPriceKey,
  tierFromPriceKey,
  tierUnlocking,
  type OrgFeature,
} from "./business-plans";

const ALL: OrgFeature[] = [
  "presence",
  "csvExport",
  "actionCenter",
  "policies",
  "approvals",
  "explain",
  "peExposure",
  "pdfExport",
  "forecast",
];

describe("business tiers", () => {
  it("prices strictly increase, so each step up has to be earned", () => {
    const prices = BUSINESS_TIERS.map((t) => t.yearlyUsd);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
    expect(new Set(prices).size).toBe(prices.length);
  });

  it("exactly one tier is recommended", () => {
    expect(BUSINESS_TIERS.filter((t) => t.recommended)).toHaveLength(1);
  });

  it("every higher tier includes everything a lower one has", () => {
    for (const f of ALL) {
      if (orgHasFeature("basic", f)) expect(orgHasFeature("advanced", f)).toBe(true);
      if (orgHasFeature("advanced", f)) expect(orgHasFeature("pro", f)).toBe(true);
    }
  });

  it("forecast is Pro-only and policies start at Advanced", () => {
    expect(orgHasFeature("advanced", "forecast")).toBe(false);
    expect(orgHasFeature("pro", "forecast")).toBe(true);
    expect(orgHasFeature("basic", "policies")).toBe(false);
    expect(orgHasFeature("advanced", "policies")).toBe(true);
  });

  it("an unpaid organisation evaluates Basic features only", () => {
    expect(orgHasFeature("unpaid", "presence")).toBe(true);
    expect(orgHasFeature("unpaid", "policies")).toBe(false);
    expect(orgHasFeature("unpaid", "forecast")).toBe(false);
  });

  it("names the tier that unlocks a locked feature", () => {
    expect(tierUnlocking("policies").id).toBe("advanced");
    expect(tierUnlocking("forecast").id).toBe("pro");
  });
});

describe("seats and personal plans", () => {
  it("caps an unpaid org at the evaluation allowance regardless of the stored seat count", () => {
    expect(seatLimit("unpaid", 10)).toBe(EVALUATION_SEATS);
    expect(seatLimit("advanced", 25)).toBe(25);
  });

  it("each tier grants a different personal plan, rising with the price", () => {
    expect(personalPlanFor("unpaid")).toBeNull();
    expect(personalPlanFor("basic")).toBe("free");
    expect(personalPlanFor("advanced")).toBe("starter");
    expect(personalPlanFor("pro")).toBe("pro");
  });

  it("treats anything unrecognised as unpaid, never as a paid tier", () => {
    expect(normaliseOrgPlan("enterprise")).toBe("unpaid");
    expect(normaliseOrgPlan(undefined)).toBe("unpaid");
    expect(normaliseOrgPlan("advanced")).toBe("advanced");
  });
});

describe("price keys", () => {
  it("round-trips every tier and interval", () => {
    for (const t of BUSINESS_TIERS) {
      for (const iv of ["monthly", "yearly"] as const) {
        expect(tierFromPriceKey(teamsPriceKey(t.id, iv))).toBe(t.id);
      }
    }
  });

  it("maps the legacy single Teams price to Pro, the closest tier to its old level", () => {
    expect(tierFromPriceKey("teams_monthly")).toBe("pro");
  });

  it("sells yearly only: the default key for a tier is its yearly price", () => {
    expect(teamsPriceKey("advanced")).toBe("teams_advanced_yearly");
  });

  it("ignores consumer price keys", () => {
    expect(tierFromPriceKey("pro_monthly")).toBeNull();
    expect(tierFromPriceKey(null)).toBeNull();
  });
});

describe("effectivePlan", () => {
  it("lets a seat raise a free account to what the tier grants", () => {
    expect(effectivePlan("free", "pro")).toBe("pro");
    expect(effectivePlan("free", "starter")).toBe("starter");
  });

  it("never lowers a plan the person already holds", () => {
    expect(effectivePlan("pro", "starter")).toBe("pro");
    expect(effectivePlan("founding_lifetime", "pro")).toBe("founding_lifetime");
    expect(effectivePlan("teams", "pro")).toBe("teams");
  });

  it("changes nothing without a seat grant", () => {
    expect(effectivePlan("free", null)).toBe("free");
  });
});

describe("clampSeats", () => {
  it("keeps charged seat counts whole and inside the sellable range", () => {
    expect(clampSeats(2)).toBe(10);
    expect(clampSeats(25.6)).toBe(26);
    expect(clampSeats(99999)).toBe(500);
    expect(clampSeats(Number.NaN)).toBe(10);
  });
});

describe("yearly pricing", () => {
  it("publishes the agreed per-seat yearly prices", () => {
    expect(BUSINESS_TIERS.map((t) => t.yearlyUsd)).toEqual([149, 299, 449]);
  });

  it("works out to a monthly figure under mobility tooling and above HR software", () => {
    expect(monthlyEquivalentUsd("basic")).toBe(12);
    expect(monthlyEquivalentUsd("advanced")).toBe(25);
    expect(monthlyEquivalentUsd("pro")).toBe(37);
  });

  it("charges slightly less than the earlier eight-months-of-twelve annual price", () => {
    // Earlier model: $19 / $39 / $59 a month, 8 months charged for the year.
    const earlier = { basic: 19 * 8, advanced: 39 * 8, pro: 59 * 8 };
    for (const t of BUSINESS_TIERS) {
      expect(t.yearlyUsd).toBeLessThan(earlier[t.id]);
      expect(t.yearlyUsd).toBeGreaterThan(earlier[t.id] * 0.9);
    }
  });

  it("each higher plan builds on the one below and adds something", () => {
    expect(BUSINESS_TIERS[1]!.features[0]).toBe("Everything in Basic");
    expect(BUSINESS_TIERS[2]!.features[0]).toBe("Everything in Advanced");
    expect(BUSINESS_TIERS[1]!.features.length).toBeGreaterThan(1);
    expect(BUSINESS_TIERS[2]!.features.length).toBeGreaterThan(1);
  });

  it("the entry plan carries the shared value, not a stripped-down shell", () => {
    expect(BUSINESS_TIERS[0]!.features.length).toBeGreaterThanOrEqual(8);
  });
});
