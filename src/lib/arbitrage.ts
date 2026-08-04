import { CORE_COST_KEYS, type City, type Costs } from "./types";

export type CostTier = "lean" | "mid";

export type CostLine = { key: keyof Costs; label: string; amount: number };

/** Sum of the core monthly cost basket. Visible, not magic. */
export function monthlyCost(city: City, tier: CostTier = "mid"): number {
  return CORE_COST_KEYS.reduce((sum, key) => sum + city.costs[key][tier], 0);
}

export type Arbitrage = {
  income: number;
  cost: number;
  surplusMonthly: number;
  surplusAnnual: number;
  savingsRate: number; // 0-100
  runwayMonths: number | null;
};

export function computeArbitrage(
  city: City,
  income: number | null,
  tier: CostTier = "mid",
  savings: number | null = null,
): Arbitrage {
  const cost = monthlyCost(city, tier);
  const inc = income ?? 0;
  const surplusMonthly = inc - cost;
  return {
    income: inc,
    cost,
    surplusMonthly,
    surplusAnnual: surplusMonthly * 12,
    savingsRate: inc > 0 ? (surplusMonthly / inc) * 100 : 0,
    runwayMonths: savings && cost > 0 ? savings / cost : null,
  };
}

/** Months to reach a savings target in this city (null if never). */
export function monthsToTarget(surplusMonthly: number, target: number): number | null {
  if (surplusMonthly <= 0) return null;
  return target / surplusMonthly;
}

export function formatUsd(value: number, decimals = 0): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function touristDaysFor(city: City, nationality: string): number {
  return city.visa.tourist_days[nationality.toUpperCase()] ?? city.visa.tourist_days.default;
}
