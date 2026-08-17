/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * Freelance income + tax-regime modelling for the arbitrage calculator.
 *
 * Scope, stated plainly: these are planning estimates, not tax advice.
 * The German tariff is the §32a formula with 2026 parameters approximated;
 * the Vietnam figures model the published PIT treatment of service income.
 * Both are labelled as estimates in the UI.
 */
import { clampFeeRate, type FeeBasis } from "@/config/platforms";

/** Working assumption for USD→EUR conversion. Update alongside seed data. */
export const EUR_PER_USD = 0.86;

/** Upwork-style flat platform fee. */
export const DEFAULT_PLATFORM_FEE = 0.1;

export type FreelanceInputs = {
  /** Concurrent client slots. Capacity model: prime calling window 8–18 DE
   *  time is ~6 sellable hours/day, so 2 clients × 3h or 3 clients × 2h. */
  clients: 2 | 3;
  hourlyRateUsd: number;
  /** Performance fee per qualified appointment booked. */
  appointmentFeeUsd: number;
  /** Appointments booked per client per month. */
  appointmentsPerClient: number;
  workdaysPerMonth: number;
  /** Platform cut as a fraction (0.1 = 10%). */
  platformFeePct: number;
  /**
   * What the cut is charged on. See config/platforms.ts.
   *
   * Optional so existing callers and stored inputs keep working; absent means
   * "all", which is what the model did before this existed. Defaulting to the
   * old behaviour rather than the more generous one matters: a silent switch to
   * "hourly" would quietly raise everybody's projected take-home.
   */
  platformFeeBasis?: FeeBasis;
  /** Dialer, phone, tools — monthly, USD. */
  businessExpensesUsd: number;
};

export const DEFAULT_FREELANCE_INPUTS: FreelanceInputs = {
  clients: 2,
  hourlyRateUsd: 40,
  appointmentFeeUsd: 200,
  appointmentsPerClient: 7,
  workdaysPerMonth: 21,
  platformFeePct: DEFAULT_PLATFORM_FEE,
  businessExpensesUsd: 200,
};

/** Hours sold per client per day given the 6-prime-hour ceiling. */
export function hoursPerClientPerDay(clients: 2 | 3): number {
  return clients === 2 ? 3 : 2;
}

export type FreelanceIncome = {
  hourlyBilledUsd: number;
  appointmentBilledUsd: number;
  grossBilledUsd: number;
  /** What the platform took, in USD. Shown so the number is checkable. */
  platformCutUsd: number;
  /** The revenue the cut was charged on. Differs from gross on "hourly". */
  feeBaseUsd: number;
  afterPlatformUsd: number;
  /** Monthly profit before tax and insurance, USD. */
  profitUsd: number;
};

export function computeFreelanceIncome(i: FreelanceInputs): FreelanceIncome {
  const hours = i.clients * hoursPerClientPerDay(i.clients) * i.workdaysPerMonth;
  const hourlyBilledUsd = hours * i.hourlyRateUsd;
  const appointmentBilledUsd = i.clients * i.appointmentsPerClient * i.appointmentFeeUsd;
  const grossBilledUsd = hourlyBilledUsd + appointmentBilledUsd;

  /**
   * The cut is charged on a BASE, which is not always the gross.
   *
   * This used to be `grossBilledUsd * (1 - platformFeePct)`, which assumes
   * every platform takes a cut of performance fees as well as hourly work.
   * Many do; some only intermediate the hourly engagement. On the default
   * inputs that assumption is worth about $420 a month at a 15% rate, and it
   * was invisible and unchangeable.
   *
   * `platformCutUsd` and `feeBaseUsd` are returned rather than folded away so
   * the UI can show what was taken and what it was taken from. A fee the user
   * cannot reconcile against their own statement is a fee they will not trust.
   */
  const rate = clampFeeRate(i.platformFeePct);
  const feeBaseUsd = i.platformFeeBasis === "hourly" ? hourlyBilledUsd : grossBilledUsd;
  const platformCutUsd = feeBaseUsd * rate;
  const afterPlatformUsd = grossBilledUsd - platformCutUsd;

  return {
    hourlyBilledUsd,
    appointmentBilledUsd,
    grossBilledUsd,
    platformCutUsd,
    feeBaseUsd,
    afterPlatformUsd,
    profitUsd: afterPlatformUsd - i.businessExpensesUsd,
  };
}

// ---------------------------------------------------------------------------
// Tax regimes
// ---------------------------------------------------------------------------

export type TaxRegimeId = "de-resident" | "vn-under-183" | "vn-resident";

export type TaxRegime = {
  id: TaxRegimeId;
  label: string;
  caveat: string;
};

export const TAX_REGIMES: TaxRegime[] = [
  {
    id: "de-resident",
    label: "Germany — tax resident",
    caveat:
      "Freelancer with voluntary public health insurance (GKV), single, no church tax. Income tax is the §32a tariff (2026 approximation).",
  },
  {
    id: "vn-under-183",
    label: "Vietnam — under 183 days",
    caveat:
      "Non-resident with only foreign-paid income: no Vietnamese-source income to tax. Only valid if German unlimited tax liability has genuinely ended (Abmeldung, no Wohnsitz kept). Nomad health insurance replaces GKV.",
  },
  {
    id: "vn-resident",
    label: "Vietnam — 183+ days (tax resident)",
    caveat:
      "Resident taxed on worldwide income. Service/business income modelled at a conservative 10% of revenue (presumptive regimes can be ~7%). Requires German exit as above.",
  },
];

// --- Germany -----------------------------------------------------------------

/** 2026 basic allowance (Grundfreibetrag), EUR/year. */
export const DE_GRUNDFREIBETRAG_2026 = 12_348;
/** Health + long-term-care contribution rate for voluntary GKV members:
 *  14.6% KV + ~2.9% Zusatzbeitrag + 4.2% PV (childless), paid in full. */
export const DE_GKV_RATE = 0.217;
/** 2026 contribution assessment ceiling for KV/PV, EUR/year. */
export const DE_GKV_CAP_2026 = 69_750;
/** 2026 minimum assessment base for voluntary self-employed, EUR/year. */
export const DE_GKV_FLOOR_2026 = 1_318.33 * 12;

/**
 * German income tax per §32a EStG, 2026 parameters approximated from the
 * 2025 tariff shifted by the 2026 Grundfreibetrag. Good to ±1–2% for
 * planning; not a filing calculation.
 */
export function deIncomeTax(zvE: number): number {
  const gfb = DE_GRUNDFREIBETRAG_2026;
  if (zvE <= gfb) return 0;
  if (zvE <= 17_800) {
    const y = (zvE - gfb) / 10_000;
    return Math.floor((932.3 * y + 1400) * y);
  }
  if (zvE <= 68_800) {
    const z = (zvE - 17_800) / 10_000;
    return Math.floor((176.64 * z + 2397) * z + 1034);
  }
  if (zvE <= 277_800) return Math.floor(0.42 * zvE - 10_911);
  return Math.floor(0.45 * zvE - 19_246);
}

// --- Vietnam -----------------------------------------------------------------

/** Conservative flat rate on service revenue for resident individuals. */
export const VN_RESIDENT_SERVICE_RATE = 0.1;
/** Monthly nomad health insurance replacing GKV (Genki/SafetyWing class), USD. */
export const NOMAD_INSURANCE_USD = 140;

// --- Net result --------------------------------------------------------------

export type NetResult = {
  regime: TaxRegimeId;
  /** Monthly profit before tax/insurance, USD. */
  profitUsd: number;
  /** Monthly tax, USD. */
  taxUsd: number;
  /** Monthly health/social insurance, USD. */
  insuranceUsd: number;
  /** Monthly net income, USD — feed this into the arbitrage ranking. */
  netUsd: number;
  effectiveRate: number; // 0-100, of profit
};

export function computeNet(income: FreelanceIncome, regime: TaxRegimeId): NetResult {
  const { profitUsd } = income;

  if (regime === "de-resident") {
    const profitEurYr = profitUsd * EUR_PER_USD * 12;
    const gkvBase = Math.min(Math.max(profitEurYr, DE_GKV_FLOOR_2026), DE_GKV_CAP_2026);
    const gkvEurYr = gkvBase * DE_GKV_RATE;
    // Contributions are (almost fully) deductible; 96% approximates the
    // Krankengeld carve-out.
    const zvE = Math.max(0, profitEurYr - gkvEurYr * 0.96);
    const taxEurYr = deIncomeTax(zvE);
    const taxUsd = taxEurYr / 12 / EUR_PER_USD;
    const insuranceUsd = gkvEurYr / 12 / EUR_PER_USD;
    const netUsd = profitUsd - taxUsd - insuranceUsd;
    return result(regime, profitUsd, taxUsd, insuranceUsd, netUsd);
  }

  if (regime === "vn-under-183") {
    return result(regime, profitUsd, 0, NOMAD_INSURANCE_USD, profitUsd - NOMAD_INSURANCE_USD);
  }

  // vn-resident: flat rate applies to service revenue (after platform fee),
  // not to profit — presumptive regimes tax turnover.
  const taxUsd = income.afterPlatformUsd * VN_RESIDENT_SERVICE_RATE;
  const netUsd = profitUsd - taxUsd - NOMAD_INSURANCE_USD;
  return result(regime, profitUsd, taxUsd, NOMAD_INSURANCE_USD, netUsd);
}

function result(
  regime: TaxRegimeId,
  profitUsd: number,
  taxUsd: number,
  insuranceUsd: number,
  netUsd: number,
): NetResult {
  return {
    regime,
    profitUsd,
    taxUsd,
    insuranceUsd,
    netUsd,
    effectiveRate: profitUsd > 0 ? ((taxUsd + insuranceUsd) / profitUsd) * 100 : 0,
  };
}

/** All regimes side by side for the scenario table. */
export function computeScenarios(inputs: FreelanceInputs): NetResult[] {
  const income = computeFreelanceIncome(inputs);
  return TAX_REGIMES.map((r) => computeNet(income, r.id));
}
