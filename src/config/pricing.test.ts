import { describe, expect, it } from "vitest";
import {
  ANNUAL_MONTHS_CHARGED,
  ANNUAL_MONTHS_FREE,
  PAID_TIERS,
  TRIAL_DAYS,
  annualSavingPercent,
  TIERS,
  annualMonthlyEquivalentUsd,
  annualSavingUsd,
  annualUsd,
  tier,
} from "./pricing";
import { PRO_FEATURES, atLeast, canUse, isPaid, isPro } from "@/lib/entitlements";
import type { Plan } from "@/lib/types";

describe("annual pricing — the claim must match the arithmetic", () => {
  it("charges eight months, so four really are free", () => {
    expect(ANNUAL_MONTHS_CHARGED).toBe(8);
    expect(ANNUAL_MONTHS_FREE).toBe(4);
    for (const t of PAID_TIERS) {
      expect(annualUsd(t)).toBe(t.monthlyUsd * 8);
      expect(annualSavingUsd(t)).toBe(t.monthlyUsd * 4);
    }
  });

  it("the badge percentage is the discount actually charged, not a claim", () => {
    // Guards the one number a customer could check with a calculator.
    expect(annualSavingPercent()).toBe(33);
    for (const t of PAID_TIERS) {
      const claimed = t.monthlyUsd * 12 * (1 - annualSavingPercent() / 100);
      expect(Math.abs(annualUsd(t) - claimed)).toBeLessThan(t.monthlyUsd * 0.5);
    }
  });

  it("the trial is three days, and the checkout must not diverge from it", () => {
    expect(TRIAL_DAYS).toBe(3);
  });

  it("the effective monthly figure is genuinely cheaper than paying monthly", () => {
    for (const t of PAID_TIERS) {
      expect(annualMonthlyEquivalentUsd(t)).toBeLessThan(t.monthlyUsd);
    }
  });

  it("tiers increase in price and Free is free", () => {
    expect(tier("free").monthlyUsd).toBe(0);
    expect(tier("starter").monthlyUsd).toBeLessThan(tier("pro").monthlyUsd);
    expect(tier("pro").monthlyUsd).toBeLessThan(tier("teams").monthlyUsd);
  });

  it("exactly one tier is highlighted", () => {
    expect(TIERS.filter((t) => t.recommended)).toHaveLength(1);
  });
});

describe("entitlements — a higher tier can never lose a feature", () => {
  const order: Plan[] = ["free", "starter", "pro", "teams"];

  it("access is monotonic across tiers", () => {
    for (const feature of PRO_FEATURES) {
      let seenUnlocked = false;
      for (const plan of order) {
        const allowed = canUse(plan, feature);
        if (allowed) seenUnlocked = true;
        // Once a tier unlocks a feature, no higher tier may re-lock it.
        if (seenUnlocked) expect(canUse(plan, feature), `${plan}/${feature}`).toBe(true);
      }
    }
  });

  it("free unlocks nothing paid", () => {
    for (const feature of PRO_FEATURES) expect(canUse("free", feature)).toBe(false);
  });

  it("Teams includes everything Pro has", () => {
    for (const feature of PRO_FEATURES) {
      if (canUse("pro", feature)) expect(canUse("teams", feature)).toBe(true);
    }
  });

  it("isPro means Pro-or-above, isPaid means any paid tier", () => {
    expect(isPaid("starter")).toBe(true);
    expect(isPro("starter")).toBe(false); // Starter is paid, but not Pro-tier
    expect(isPro("pro")).toBe(true);
    expect(isPro("teams")).toBe(true);
    expect(isPaid("free")).toBe(false);
  });

  it("the vault and exports stay above Starter", () => {
    expect(canUse("starter", "vault")).toBe(false);
    expect(canUse("starter", "exports")).toBe(false);
    expect(canUse("starter", "tax_report")).toBe(false);
    expect(canUse("pro", "vault")).toBe(true);
  });

  it("the border-run list unlocks at Starter, as the pricing page says", () => {
    expect(canUse("starter", "border_run_full")).toBe(true);
    expect(atLeast("teams", "starter")).toBe(true);
  });
});
