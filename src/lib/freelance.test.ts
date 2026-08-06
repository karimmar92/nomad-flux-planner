import { describe, expect, it } from "vitest";
import {
  DEFAULT_FREELANCE_INPUTS,
  computeFreelanceIncome,
  computeNet,
  computeScenarios,
  deIncomeTax,
  DE_GRUNDFREIBETRAG_2026,
  hoursPerClientPerDay,
} from "./freelance";

describe("freelance income", () => {
  it("2 clients × 3h × 21d × $40 + 2×7 appts × $200 = $7,840 gross", () => {
    const inc = computeFreelanceIncome(DEFAULT_FREELANCE_INPUTS);
    expect(inc.hourlyBilledUsd).toBe(2 * 3 * 21 * 40); // 5,040
    expect(inc.appointmentBilledUsd).toBe(2 * 7 * 200); // 2,800
    expect(inc.grossBilledUsd).toBe(7_840);
    expect(inc.afterPlatformUsd).toBeCloseTo(7_056, 0);
    expect(inc.profitUsd).toBeCloseTo(6_856, 0);
  });

  it("3 clients drop to 2h blocks — same daily hours, more appointment lines", () => {
    expect(hoursPerClientPerDay(2) * 2).toBe(hoursPerClientPerDay(3) * 3);
    const inc = computeFreelanceIncome({ ...DEFAULT_FREELANCE_INPUTS, clients: 3 });
    expect(inc.hourlyBilledUsd).toBe(3 * 2 * 21 * 40); // same 5,040
    expect(inc.appointmentBilledUsd).toBe(3 * 7 * 200); // 4,200 — the upside
  });
});

describe("German tariff (2026 approximation)", () => {
  it("is zero at and below the Grundfreibetrag", () => {
    expect(deIncomeTax(DE_GRUNDFREIBETRAG_2026)).toBe(0);
    expect(deIncomeTax(5_000)).toBe(0);
  });

  it("is monotonic and in a sane band at €50k", () => {
    const t = deIncomeTax(50_000);
    expect(t).toBeGreaterThan(10_000);
    expect(t).toBeLessThan(12_500);
    expect(deIncomeTax(60_000)).toBeGreaterThan(t);
  });
});

describe("net by regime", () => {
  const income = computeFreelanceIncome(DEFAULT_FREELANCE_INPUTS);

  it("Germany takes roughly a third of profit", () => {
    const de = computeNet(income, "de-resident");
    expect(de.effectiveRate).toBeGreaterThan(30);
    expect(de.effectiveRate).toBeLessThan(42);
  });

  it("Vietnam under 183 days: only insurance comes off", () => {
    const vn = computeNet(income, "vn-under-183");
    expect(vn.taxUsd).toBe(0);
    expect(vn.netUsd).toBeCloseTo(income.profitUsd - 140, 0);
  });

  it("Vietnam resident taxes revenue, not profit", () => {
    const vn = computeNet(income, "vn-resident");
    expect(vn.taxUsd).toBeCloseTo(income.afterPlatformUsd * 0.1, 0);
  });

  it("ordering: VN <183d ≥ VN resident > Germany", () => {
    const [de, vnShort, vnRes] = computeScenarios(DEFAULT_FREELANCE_INPUTS);
    expect(vnShort!.netUsd).toBeGreaterThan(vnRes!.netUsd);
    expect(vnRes!.netUsd).toBeGreaterThan(de!.netUsd);
  });
});
