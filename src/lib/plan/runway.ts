/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. This is the number someone uses to
 * decide whether they can afford to leave at all, and it must depend only on
 * their savings, their income and the seed data — never on commission.
 *
 * Pure functions only. No dates, no storage, no React.
 */
import { monthlyCost, type CostTier } from "../arbitrage";
import type { City } from "../types";

export type RunwayInput = {
  /** Cash available to spend down, USD. */
  savings: number;
  /** Monthly income while abroad. Zero is a legitimate answer. */
  monthlyIncome: number;
  city: City;
  tier: CostTier;
};

export type Runway = {
  monthlyCost: number;
  monthlyIncome: number;
  /** Positive = you add to savings each month. Negative = you burn. */
  surplusMonthly: number;
  /** Monthly burn against savings. 0 when income covers costs. */
  burnMonthly: number;
  /**
   * Months the savings last. `null` means income covers costs, so the runway
   * does not run out — that is not the same as "infinite months", and the UI
   * must say so in words rather than printing a number.
   */
  months: number | null;
  sustainable: boolean;
};

export function computeRunway({ savings, monthlyIncome, city, tier }: RunwayInput): Runway {
  const cost = monthlyCost(city, tier);
  const income = Math.max(0, monthlyIncome);
  const cash = Math.max(0, savings);
  const surplus = income - cost;
  const burn = surplus >= 0 ? 0 : -surplus;
  return {
    monthlyCost: cost,
    monthlyIncome: income,
    surplusMonthly: surplus,
    burnMonthly: burn,
    months: burn > 0 ? cash / burn : null,
    sustainable: burn === 0,
  };
}

/**
 * Months of saving needed to reach a cash buffer, at the surplus this city
 * leaves. `null` when the surplus is zero or negative: you never get there by
 * waiting, and pretending otherwise with a large number would be dishonest.
 */
export function monthsToBuffer(runway: Runway, buffer: number, currentSavings: number): number | null {
  const gap = buffer - Math.max(0, currentSavings);
  if (gap <= 0) return 0;
  if (runway.surplusMonthly <= 0) return null;
  return gap / runway.surplusMonthly;
}

export type RunwayComparison = {
  home: { city: City; months: number };
  target: { city: City; months: number };
};

/**
 * The thesis line: the same cash, spent down in two places, income ignored on
 * both sides so the comparison is like-for-like. Income makes both numbers
 * bigger and hides the point.
 */
export function compareRunway(
  home: City | undefined,
  target: City | undefined,
  savings: number,
  tier: CostTier,
): RunwayComparison | null {
  if (!home || !target || home.id === target.id) return null;
  const cash = Math.max(0, savings);
  if (cash <= 0) return null;
  const homeCost = monthlyCost(home, tier);
  const targetCost = monthlyCost(target, tier);
  if (homeCost <= 0 || targetCost <= 0) return null;
  return {
    home: { city: home, months: cash / homeCost },
    target: { city: target, months: cash / targetCost },
  };
}

export function formatMonths(months: number): string {
  if (months >= 24) return `${(months / 12).toFixed(1)} years`;
  return `${months < 10 ? months.toFixed(1) : Math.round(months)} months`;
}

/* ------------------------------------------------------------------ */
/* One-off setup budget                                                */
/* ------------------------------------------------------------------ */

export type BudgetLine = {
  key: string;
  label: string;
  low: number;
  high: number;
  note: string;
};

export type SetupBudget = {
  lines: BudgetLine[];
  low: number;
  high: number;
  /** Recommended cash on hand: the high estimate plus three months of costs. */
  recommendedTotal: number;
  monthsOfCostsIncluded: number;
};

/** Rough long-haul economy return fares from Western Europe / North America. */
const FLIGHT_BY_REGION: Record<string, [number, number]> = {
  Europe: [120, 400],
  "Latin America": [450, 950],
  Asia: [550, 1100],
  Africa: [500, 1000],
  "Middle East": [400, 850],
};

const BUFFER_MONTHS = 3;

/**
 * What it actually costs to start, before the first month of living costs.
 * Deliberately pessimistic at the top end: underestimating this is the most
 * common reason a first attempt ends early, and an aspirational number would
 * be the least useful thing we could print.
 */
export function setupBudget(city: City, tier: CostTier = "lean"): SetupBudget {
  const flight = FLIGHT_BY_REGION[city.region] ?? [400, 900];
  const rent = city.costs.rent1brCentral;
  const monthly = monthlyCost(city, tier);
  const visaFee: [number, number] = city.visa.nomadVisa.exists ? [0, 350] : [0, 80];

  const lines: BudgetLine[] = [
    {
      key: "flight",
      label: "Flight",
      low: flight[0],
      high: flight[1],
      note: `One way to ${city.nearest_airport_iata}, booked a few weeks out. Peak season sits at the top of this range.`,
    },
    {
      key: "deposit",
      label: "First month plus deposit",
      low: Math.round(rent * 1.2),
      high: Math.round(rent * 2.5),
      note: "Short lets charge a premium and most landlords want a deposit up front. Monthly rates only start after you are on the ground.",
    },
    {
      key: "insurance",
      label: "Insurance — first 3 months",
      low: 120,
      high: 330,
      note: "Nomad visa applications generally require proof of cover before you travel.",
    },
    {
      key: "visa",
      label: "Visa and entry fees",
      low: visaFee[0],
      high: visaFee[1],
      note: city.visa.nomadVisa.exists
        ? `${city.visa.nomadVisa.name} application fees, translations and document legalisation.`
        : "Visa-free entry, but allow for extensions, photos and any e-visa fee.",
    },
    {
      key: "gear",
      label: "Gear and admin",
      low: 200,
      high: 900,
      note: "Laptop repairs before you go, a second bank card, luggage, adapters, vaccinations, document scans.",
    },
    {
      key: "exit",
      label: "Leaving costs at home",
      low: 150,
      high: 800,
      note: "Storage, contract exit fees, mail forwarding, and the last month of overlapping rent nobody plans for.",
    },
  ];

  const low = lines.reduce((s, l) => s + l.low, 0);
  const high = lines.reduce((s, l) => s + l.high, 0);
  return {
    lines,
    low,
    high,
    recommendedTotal: high + monthly * BUFFER_MONTHS,
    monthsOfCostsIncluded: BUFFER_MONTHS,
  };
}
