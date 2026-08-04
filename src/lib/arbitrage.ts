import {
  MONTHLY_COST_KEYS,
  REFERENCE_COST_KEYS,
  COST_LABELS,
  type City,
  type CostLineKey,
} from "./types";

export type CostTier = "lean" | "mid";

export type CostLine = { key: CostLineKey; label: string; amount: number; inTotal: boolean };

/** Headline monthly cost, straight from the dataset totals. Visible, not magic. */
export function monthlyCost(city: City, tier: CostTier = "mid"): number {
  return tier === "lean" ? city.costs.totalMonthlyLean : city.costs.totalMonthlyMidRange;
}

/** Itemised lines behind the headline figure. */
export function costLines(city: City): CostLine[] {
  const line = (key: CostLineKey, inTotal: boolean): CostLine => ({
    key,
    label: COST_LABELS[key],
    amount: city.costs[key],
    inTotal,
  });
  return [
    ...MONTHLY_COST_KEYS.map((k) => line(k, true)),
    ...REFERENCE_COST_KEYS.map((k) => line(k, false)),
  ];
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

/** Visa-free tourist days on entry, before any extension. */
export function touristDaysFor(city: City): number {
  return city.visa.touristDays;
}

/** Total possible tourist stay including a first extension, where one exists. */
export function touristDaysWithExtension(city: City): number {
  return city.visa.touristDays + (city.visa.extensionDays ?? 0);
}

/** True when days spent here burn the shared Schengen 90/180 allowance. */
export function isSchengenCity(city: City): boolean {
  return city.visa.ruleType === "SCHENGEN_90_180";
}

export function hasNomadVisa(city: City): boolean {
  return city.visa.nomadVisa.exists;
}

/** Nomad-visa income requirement normalised to USD per month, or null if none stated. */
export function nomadIncomeMonthly(city: City): number | null {
  const v = city.visa.nomadVisa;
  if (!v.exists) return null;
  if (v.minMonthlyIncomeUSD != null) return v.minMonthlyIncomeUSD;
  if (v.minAnnualIncomeUSD != null) return Math.round(v.minAnnualIncomeUSD / 12);
  return null;
}

const TAX_MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** 0-indexed month the tax year starts in. "calendar" => January. */
export function taxYearStartMonth(city: City): number {
  const raw = city.tax.taxYear.trim().toLowerCase();
  if (raw === "calendar") return 0;
  const first = raw.split(/[-–—]/)[0]?.trim() ?? "";
  return TAX_MONTHS[first] ?? 0;
}

export function isCalendarTaxYear(city: City): boolean {
  return city.tax.taxYear.trim().toLowerCase() === "calendar";
}

/** Human label for the tax year, e.g. "Jan–Dec" or "March–February". */
export function taxYearLabel(city: City): string {
  if (isCalendarTaxYear(city)) return "Jan–Dec";
  return city.tax.taxYear.replace(/-/g, "–");
}

/** Prominent warning copy for non-calendar tax years. */
export function taxYearWarning(city: City): string | null {
  if (isCalendarTaxYear(city)) return null;
  const [start, end] = city.tax.taxYear.split(/[-–—]/).map((s) => s.trim());
  return `Tax year runs ${start} to ${end}, not January to December.`;
}
