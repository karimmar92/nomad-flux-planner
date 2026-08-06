import { describe, expect, it } from "vitest";
import { CITIES } from "./cities";
import { luxuryMonthlyCost, monthlyCost } from "./arbitrage";
import { formatLocal, toLocal, USD_TO_LOCAL } from "./fx";

describe("luxury tier", () => {
  it("is above mid-range in every city", () => {
    for (const city of CITIES) {
      expect(luxuryMonthlyCost(city)).toBeGreaterThan(city.costs.totalMonthlyMidRange);
    }
  });

  it("stays in a plausible band (2–3.5× mid) — a breakout means bad seed data", () => {
    for (const city of CITIES) {
      const ratio = luxuryMonthlyCost(city) / city.costs.totalMonthlyMidRange;
      expect(ratio, city.id).toBeGreaterThan(2);
      expect(ratio, city.id).toBeLessThan(3.5);
    }
  });

  it("monthlyCost routes the luxury tier", () => {
    const city = CITIES[0]!;
    expect(monthlyCost(city, "luxury")).toBe(luxuryMonthlyCost(city));
  });
});

describe("fx", () => {
  it("has a rate for every seed-city currency", () => {
    for (const city of CITIES) {
      expect(USD_TO_LOCAL[city.local_currency], city.local_currency).toBeDefined();
    }
  });

  it("converts and formats VND compactly", () => {
    expect(toLocal(1000, "VND")).toBe(26_250_000);
    expect(formatLocal(3000, "VND")).toMatch(/M/); // ₫78.8M-style compact
  });

  it("returns null for USD (no duplicate display)", () => {
    expect(formatLocal(1000, "USD")).toBeNull();
  });
});
