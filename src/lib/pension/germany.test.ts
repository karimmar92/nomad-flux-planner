import { describe, expect, it } from "vitest";
import {
  ALLGEMEINE_WARTEZEIT_MONTHS,
  PENSION_METHOD_VERSION,
  costPerEntgeltpunkt,
  entgeltpunkteFrom,
  evaluateGermanPension,
  pensionYear,
} from "./germany";

const base = {
  monthlyPensionEur: 320,
  letterYear: 2023,
  entitledToVoluntaryInsurance: true,
  monthsSinceLastContribution: 30,
};

describe("reference values", () => {
  it("uses the 2023 figures a Renteninformation letter would carry", () => {
    const y = pensionYear(2023);
    expect(y.rentenwert).toBe(36.02);
    expect(y.durchschnittsentgelt).toBe(43_142);
    // One Entgeltpunkt = one year at average earnings at the full rate.
    expect(Math.round(costPerEntgeltpunkt(y))).toBe(8024);
  });

  it("converts a monthly pension into Entgeltpunkte", () => {
    expect(entgeltpunkteFrom(320, pensionYear(2023))).toBeCloseTo(8.88, 2);
    // A single point pays exactly the Rentenwert per month.
    expect(entgeltpunkteFrom(36.02, pensionYear(2023))).toBeCloseTo(1, 5);
  });
});

describe("the €320 worked example", () => {
  const r = evaluateGermanPension(base);

  it("derives points, contributions and the refund ceiling", () => {
    expect(r.entgeltpunkte).toBeCloseTo(8.88, 2);
    expect(r.totalContributionsEur).toBe(71_289);
    // §210 refunds only the share the insured person bore — half for employees.
    expect(r.refundUpperBoundEur).toBe(35_644);
    expect(r.refundUpperBoundEur * 2).toBe(r.totalContributionsEur - 1); // rounding
  });

  it("is barred twice over for a German citizen", () => {
    expect(r.refundPossible).toBe(false);
    const blocking = r.bars.filter((b) => b.blocks).map((b) => b.id);
    expect(blocking).toContain("voluntary_insurance");
    expect(blocking).toContain("waiting_period_met");
    // The cooling-off period is satisfied — it is not what blocks this case.
    expect(blocking).not.toContain("cooling_off");
  });

  it("shows the lump sum needs ~9 years of pension to break even", () => {
    expect(r.annualPensionEur).toBe(3_840);
    expect(r.breakEvenYears).toBeGreaterThan(9);
    expect(r.breakEvenYears).toBeLessThan(10);
  });

  it("carries a method version, so a figure can be reproduced later", () => {
    expect(r.methodVersion).toBe(PENSION_METHOD_VERSION);
  });
});

describe("the cases where a refund IS open", () => {
  it("opens only when no bar applies", () => {
    const r = evaluateGermanPension({
      monthlyPensionEur: 40, // ~13 months of contributions
      letterYear: 2023,
      entitledToVoluntaryInsurance: false, // non-EU national
      monthsSinceLastContribution: 30,
    });
    expect(r.contributionMonths).toBeLessThan(ALLGEMEINE_WARTEZEIT_MONTHS);
    expect(r.refundPossible).toBe(true);
    expect(r.refundUpperBoundEur).toBeGreaterThan(0);
  });

  it("stays closed inside the 24-month cooling-off period", () => {
    const r = evaluateGermanPension({
      monthlyPensionEur: 40,
      letterYear: 2023,
      entitledToVoluntaryInsurance: false,
      monthsSinceLastContribution: 6,
    });
    expect(r.refundPossible).toBe(false);
    expect(r.bars.find((b) => b.id === "cooling_off")!.blocks).toBe(true);
  });

  it("closes as soon as the waiting period is complete", () => {
    const justOver = evaluateGermanPension({
      monthlyPensionEur: 40,
      letterYear: 2023,
      entitledToVoluntaryInsurance: false,
      monthsSinceLastContribution: 30,
      knownContributionMonths: ALLGEMEINE_WARTEZEIT_MONTHS,
    });
    expect(justOver.refundPossible).toBe(false);

    const justUnder = evaluateGermanPension({
      monthlyPensionEur: 40,
      letterYear: 2023,
      entitledToVoluntaryInsurance: false,
      monthsSinceLastContribution: 30,
      knownContributionMonths: ALLGEMEINE_WARTEZEIT_MONTHS - 1,
    });
    expect(justUnder.refundPossible).toBe(true);
  });
});

describe("copy discipline — evidence, not advice", () => {
  it("never tells the user what to do", () => {
    const text = evaluateGermanPension(base)
      .bars.map((b) => `${b.label} ${b.detail}`)
      .join(" ")
      .toLowerCase();
    // Rentenberatung is regulated under the RDG. Output states conditions and
    // arithmetic; recommending an action would cross into regulated advice.
    for (const forbidden of ["you should", "we recommend", "apply now", "you are eligible"]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
