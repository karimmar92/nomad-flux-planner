/**
 * German statutory pension, for people leaving Germany.
 *
 * ============================ READ THIS FIRST ============================
 * This module produces ARITHMETIC and PUBLISHED THRESHOLDS, never advice.
 *
 * Rentenberatung is a regulated activity in Germany under the RDG, in the same
 * way tax advice is under the StBerG. So every string here is phrased as a
 * calculation or a statutory condition:
 *
 *   "The refund under §210 requires that X and Y. Your figures show X is not met."
 *
 * and NEVER as a recommendation or a determination:
 *
 *   "You are eligible — apply here."   <-- forbidden, do not "simplify" to this
 *   "You should take the lump sum."    <-- forbidden
 *
 * The user takes the output to the DRV or a Rentenberater. That is the point.
 * =========================================================================
 *
 * The counter-intuitive result this exists to surface: for a GERMAN citizen the
 * refund is essentially never available, and that is good news rather than bad.
 * They keep an indexed pension payable worldwide instead of a one-off payment
 * that extinguishes it. Most people assume the opposite.
 */

/** Bump when any figure or rule below changes. Printed with every result. */
export const PENSION_METHOD_VERSION = 1;

/**
 * Reference values. Renteninformation letters state the pension in the value
 * of the year they were issued, so the year must match the letter.
 */
export type PensionYear = {
  year: number;
  /** Aktueller Rentenwert — monthly € per Entgeltpunkt. */
  rentenwert: number;
  /** Durchschnittsentgelt — annual gross that earns exactly 1 EP. */
  durchschnittsentgelt: number;
  /** Beitragssatz — total contribution rate (employer + employee). */
  beitragssatz: number;
  note?: string;
};

export const PENSION_YEARS: PensionYear[] = [
  {
    year: 2023,
    // West value until 30 June 2023; €37.60 from 1 July when East and West
    // were unified. Letters issued in the first half of 2023 use 36.02.
    rentenwert: 36.02,
    durchschnittsentgelt: 43_142,
    beitragssatz: 0.186,
    note: "Value used in Renteninformation letters issued before 1 July 2023.",
  },
  {
    year: 2024,
    rentenwert: 37.6,
    durchschnittsentgelt: 45_358,
    beitragssatz: 0.186,
    note: "East and West unified at €37.60 from 1 July 2023.",
  },
];

export function pensionYear(year: number): PensionYear {
  return PENSION_YEARS.find((y) => y.year === year) ?? PENSION_YEARS[0]!;
}

/** Cost of one Entgeltpunkt: a full year at average earnings, at the full rate. */
export function costPerEntgeltpunkt(y: PensionYear): number {
  return y.durchschnittsentgelt * y.beitragssatz;
}

/** Entgeltpunkte implied by a monthly pension figure. */
export function entgeltpunkteFrom(monthlyPensionEur: number, y: PensionYear): number {
  return monthlyPensionEur / y.rentenwert;
}

/** Contribution months implied, if all points were earned at average earnings. */
export function impliedContributionMonths(ep: number): number {
  return Math.round(ep * 12);
}

export const ALLGEMEINE_WARTEZEIT_MONTHS = 60;
export const REFUND_WAITING_MONTHS = 24;

export type RefundBar = {
  id: "voluntary_insurance" | "waiting_period_met" | "cooling_off";
  /** True when this condition BLOCKS a refund. */
  blocks: boolean;
  label: string;
  detail: string;
};

export type PensionInputs = {
  monthlyPensionEur: number;
  /** Year of the Renteninformation letter the figure came from. */
  letterYear: number;
  /**
   * Entitled to voluntary DRV contributions. True for German and other
   * EU/EEA/Swiss nationals, who may contribute from anywhere.
   */
  entitledToVoluntaryInsurance: boolean;
  /** Whole months since compulsory contributions ended, if known. */
  monthsSinceLastContribution?: number;
  /** Actual contribution months, if the user has their Versicherungsverlauf. */
  knownContributionMonths?: number;
};

export type PensionResult = {
  methodVersion: number;
  year: PensionYear;
  entgeltpunkte: number;
  contributionMonths: number;
  contributionMonthsAreEstimated: boolean;
  /** Total contributions (both shares) behind those points, in today's money. */
  totalContributionsEur: number;
  /**
   * §210 refunds only the share the insured person BORE — half for employees.
   * An upper bound in today's money: the statute refunds nominal amounts
   * actually paid, without indexation or interest, so historical contributions
   * are worth less than this.
   */
  refundUpperBoundEur: number;
  bars: RefundBar[];
  /** True only when no statutory bar applies. */
  refundPossible: boolean;
  /** Years of pension needed to equal the refund upper bound. */
  breakEvenYears: number;
  annualPensionEur: number;
};

/**
 * Evaluates the §210 SGB VI conditions and the arithmetic behind the figure.
 *
 * The two bars that matter, both from §210:
 *   1. A refund requires that the person is NOT entitled to voluntary
 *      insurance. German and EU/EEA nationals are, so the bar applies.
 *   2. A refund requires that the allgemeine Wartezeit (60 contribution
 *      months) has NOT been completed. Anyone with a meaningful pension
 *      figure has completed it.
 * Plus a 24-month cooling-off period after compulsory contributions end.
 */
export function evaluateGermanPension(input: PensionInputs): PensionResult {
  const year = pensionYear(input.letterYear);
  const ep = entgeltpunkteFrom(input.monthlyPensionEur, year);
  const estimated = input.knownContributionMonths == null;
  const months = input.knownContributionMonths ?? impliedContributionMonths(ep);

  const total = ep * costPerEntgeltpunkt(year);
  const refundUpperBound = total / 2;

  const bars: RefundBar[] = [
    {
      id: "voluntary_insurance",
      blocks: input.entitledToVoluntaryInsurance,
      label: "Right to voluntary insurance",
      detail: input.entitledToVoluntaryInsurance
        ? "§210 requires that no right to voluntary contributions exists. German and other EU/EEA nationals may contribute voluntarily from any country, so this condition is not met. Deregistering in Germany does not change it."
        : "No right to voluntary contributions recorded, so this condition does not block a refund.",
    },
    {
      id: "waiting_period_met",
      blocks: months >= ALLGEMEINE_WARTEZEIT_MONTHS,
      label: `Allgemeine Wartezeit (${ALLGEMEINE_WARTEZEIT_MONTHS} months)`,
      detail:
        months >= ALLGEMEINE_WARTEZEIT_MONTHS
          ? `A refund requires that the ${ALLGEMEINE_WARTEZEIT_MONTHS}-month waiting period has NOT been completed. These figures imply about ${months} contribution months, so it has been — which is what creates the pension entitlement instead.`
          : `About ${months} contribution months, below the ${ALLGEMEINE_WARTEZEIT_MONTHS}-month waiting period, so this condition does not block a refund.`,
    },
    {
      id: "cooling_off",
      blocks:
        input.monthsSinceLastContribution != null &&
        input.monthsSinceLastContribution < REFUND_WAITING_MONTHS,
      label: `${REFUND_WAITING_MONTHS}-month cooling-off period`,
      detail:
        input.monthsSinceLastContribution == null
          ? `A refund can be applied for at the earliest ${REFUND_WAITING_MONTHS} months after compulsory contributions end. Enter that date to check it.`
          : input.monthsSinceLastContribution < REFUND_WAITING_MONTHS
            ? `${input.monthsSinceLastContribution} months since the last compulsory contribution — the statute requires at least ${REFUND_WAITING_MONTHS}.`
            : `${input.monthsSinceLastContribution} months since the last compulsory contribution, which satisfies the ${REFUND_WAITING_MONTHS}-month period.`,
    },
  ];

  const annual = input.monthlyPensionEur * 12;

  return {
    methodVersion: PENSION_METHOD_VERSION,
    year,
    entgeltpunkte: round2(ep),
    contributionMonths: months,
    contributionMonthsAreEstimated: estimated,
    totalContributionsEur: Math.round(total),
    refundUpperBoundEur: Math.round(refundUpperBound),
    bars,
    refundPossible: !bars.some((b) => b.blocks),
    breakEvenYears: annual > 0 ? round2(refundUpperBound / annual) : 0,
    annualPensionEur: Math.round(annual),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
