/**
 * Platform-fee maths, including the modelling choice that used to be hidden.
 *
 * The calculator applied a fixed 10% to ALL revenue and displayed the rate
 * without letting anyone change it. Two things were wrong with that: the rate
 * varies by platform, and so does what the rate is charged on. The second is
 * worth about $420 a month on the default inputs, which is the difference
 * between a useful projection and a misleading one.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_FREELANCE_INPUTS, computeFreelanceIncome } from "./freelance";
import { PLATFORM_PRESETS, clampFeeRate, presetById } from "@/config/platforms";

const base = DEFAULT_FREELANCE_INPUTS;

describe("clampFeeRate", () => {
  it("keeps ordinary rates untouched", () => {
    expect(clampFeeRate(0.1)).toBe(0.1);
    expect(clampFeeRate(0.15)).toBe(0.15);
    expect(clampFeeRate(0.2)).toBe(0.2);
  });

  it("refuses a negative fee, which would pay more than was billed", () => {
    expect(clampFeeRate(-0.5)).toBe(0);
  });

  it("caps absurd input rather than producing zero or negative income", () => {
    expect(clampFeeRate(5)).toBe(0.9);
    expect(clampFeeRate(1)).toBe(0.9);
  });

  it("survives NaN from an empty input box", () => {
    expect(clampFeeRate(Number.NaN)).toBe(0);
  });
});

describe("computeFreelanceIncome — fee basis", () => {
  // Defaults: 2 clients x 3h x 21 days x $40 = $5,040 hourly.
  //           2 clients x 7 appts x $200     = $2,800 appointment fees.
  const HOURLY = 5040;
  const APPTS = 2800;
  const GROSS = HOURLY + APPTS;

  it("computes the documented default gross", () => {
    const r = computeFreelanceIncome(base);
    expect(r.hourlyBilledUsd).toBe(HOURLY);
    expect(r.appointmentBilledUsd).toBe(APPTS);
    expect(r.grossBilledUsd).toBe(GROSS);
  });

  it("charges an 'all' fee on the full gross", () => {
    const r = computeFreelanceIncome({ ...base, platformFeePct: 0.15, platformFeeBasis: "all" });
    expect(r.feeBaseUsd).toBe(GROSS);
    expect(r.platformCutUsd).toBeCloseTo(GROSS * 0.15, 6);
  });

  it("charges an 'hourly' fee on the hourly portion only", () => {
    const r = computeFreelanceIncome({ ...base, platformFeePct: 0.15, platformFeeBasis: "hourly" });
    expect(r.feeBaseUsd).toBe(HOURLY);
    expect(r.platformCutUsd).toBeCloseTo(HOURLY * 0.15, 6);
  });

  it("quantifies the difference the basis makes, because it is not small", () => {
    const all = computeFreelanceIncome({ ...base, platformFeePct: 0.15, platformFeeBasis: "all" });
    const hourly = computeFreelanceIncome({
      ...base,
      platformFeePct: 0.15,
      platformFeeBasis: "hourly",
    });
    // 15% of the $2,800 appointment revenue.
    expect(all.platformCutUsd - hourly.platformCutUsd).toBeCloseTo(APPTS * 0.15, 6);
    expect(all.platformCutUsd - hourly.platformCutUsd).toBeCloseTo(420, 6);
  });

  it("defaults to 'all' when no basis is given, preserving the old behaviour", () => {
    // Silently switching to the cheaper basis would raise everybody's projected
    // take-home without anyone asking for it.
    const implicit = computeFreelanceIncome({ ...base, platformFeePct: 0.15 });
    const explicit = computeFreelanceIncome({
      ...base,
      platformFeePct: 0.15,
      platformFeeBasis: "all",
    });
    expect(implicit.platformCutUsd).toBe(explicit.platformCutUsd);
  });

  it("takes nothing when there is no platform", () => {
    const r = computeFreelanceIncome({ ...base, platformFeePct: 0 });
    expect(r.platformCutUsd).toBe(0);
    expect(r.afterPlatformUsd).toBe(GROSS);
  });

  it("clamps a nonsense rate instead of reporting negative income", () => {
    const r = computeFreelanceIncome({ ...base, platformFeePct: 3 });
    expect(r.afterPlatformUsd).toBeGreaterThan(0);
  });
});

describe("invariants that keep the money figures honest", () => {
  const rates = [0, 0.05, 0.1, 0.15, 0.2, 0.35, 0.9];
  const bases: ("all" | "hourly")[] = ["all", "hourly"];

  it("never lets the platform take more than was billed", () => {
    for (const platformFeePct of rates) {
      for (const platformFeeBasis of bases) {
        const r = computeFreelanceIncome({ ...base, platformFeePct, platformFeeBasis });
        expect(r.platformCutUsd).toBeLessThanOrEqual(r.grossBilledUsd);
        expect(r.platformCutUsd).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("keeps after-platform between zero and gross", () => {
    for (const platformFeePct of rates) {
      for (const platformFeeBasis of bases) {
        const r = computeFreelanceIncome({ ...base, platformFeePct, platformFeeBasis });
        expect(r.afterPlatformUsd).toBeGreaterThanOrEqual(0);
        expect(r.afterPlatformUsd).toBeLessThanOrEqual(r.grossBilledUsd);
      }
    }
  });

  it("keeps the displayed sum consistent: gross - cut == after", () => {
    // The UI prints all three. If they do not reconcile, a freelancer checking
    // against their own platform statement stops trusting the whole table.
    for (const platformFeePct of rates) {
      for (const platformFeeBasis of bases) {
        const r = computeFreelanceIncome({ ...base, platformFeePct, platformFeeBasis });
        expect(r.grossBilledUsd - r.platformCutUsd).toBeCloseTo(r.afterPlatformUsd, 6);
      }
    }
  });

  it("charges an hourly-basis fee no more than an all-basis fee at the same rate", () => {
    for (const platformFeePct of rates) {
      const all = computeFreelanceIncome({ ...base, platformFeePct, platformFeeBasis: "all" });
      const hourly = computeFreelanceIncome({
        ...base,
        platformFeePct,
        platformFeeBasis: "hourly",
      });
      expect(hourly.platformCutUsd).toBeLessThanOrEqual(all.platformCutUsd);
    }
  });

  it("is monotonic: a higher rate never takes less", () => {
    for (const platformFeeBasis of bases) {
      let previous = -1;
      for (const platformFeePct of rates) {
        const r = computeFreelanceIncome({ ...base, platformFeePct, platformFeeBasis });
        expect(r.platformCutUsd).toBeGreaterThanOrEqual(previous);
        previous = r.platformCutUsd;
      }
    }
  });
});

describe("presets", () => {
  it("every preset resolves and carries a sane rate", () => {
    for (const p of PLATFORM_PRESETS) {
      expect(presetById(p.id)).toBe(p);
      expect(p.rate).toBeGreaterThanOrEqual(0);
      expect(p.rate).toBeLessThan(1);
      expect(clampFeeRate(p.rate)).toBe(p.rate);
    }
  });

  it("has both a 10% and a 15% option, on each basis", () => {
    const combos = PLATFORM_PRESETS.map((p) => `${p.rate}-${p.basis}`);
    expect(combos).toContain("0.1-all");
    expect(combos).toContain("0.15-all");
    expect(combos).toContain("0.1-hourly");
    expect(combos).toContain("0.15-hourly");
  });

  it("offers a zero-fee direct option", () => {
    expect(PLATFORM_PRESETS.some((p) => p.rate === 0)).toBe(true);
  });

  it("has unique ids, so the picker cannot silently collide", () => {
    const ids = PLATFORM_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
