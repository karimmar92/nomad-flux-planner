/**
 * What happens to your state pension contributions when you leave a country.
 *
 * The pattern, which almost nobody states plainly: refunds exist for people who
 * left BEFORE qualifying. Anyone who stayed long enough keeps a pension
 * instead, and claiming a refund destroys it. So "can I get my money back?"
 * usually has the answer "no, because you have something better".
 *
 * SOURCING RULE: every row names the mechanism and the qualifying period, and
 * carries a verified date. Where a rule is uncertain it says so rather than
 * guessing — a wrong refund deadline costs someone real money.
 */

export const PENSION_DATA_VERIFIED = "2026-08";

export type RefundAvailability =
  /** Contributions can be refunded on permanent departure, under conditions. */
  | "refund_possible"
  /** No refund; the entitlement is preserved or aggregated instead. */
  | "no_refund"
  /** Refund exists but only for some nationalities or residence statuses. */
  | "conditional";

export type PensionCountry = {
  code: string;
  country: string;
  system: string;
  availability: RefundAvailability;
  /** Contribution period after which a refund is barred and a pension accrues. */
  qualifyingPeriod: string;
  /** Deadline to claim after leaving, if one exists. */
  claimDeadline: string | null;
  /** One factual sentence. No recommendation. */
  note: string;
};

export const PENSION_COUNTRIES: PensionCountry[] = [
  {
    code: "DE",
    country: "Germany",
    system: "Deutsche Rentenversicherung (§210 SGB VI)",
    availability: "conditional",
    qualifyingPeriod: "60 contribution months",
    claimDeadline: null,
    note: "A refund requires both that no right to voluntary contributions exists and that the 60-month waiting period is NOT complete. German and EU/EEA nationals keep the right to contribute voluntarily, so in practice the refund is closed to them and the pension is paid abroad instead.",
  },
  {
    code: "JP",
    country: "Japan",
    system: "Lump-sum Withdrawal Payment (dattai ichijikin)",
    availability: "refund_possible",
    qualifyingPeriod: "120 months (10 years) — a refund is barred once reached",
    claimDeadline: "2 years after leaving Japan",
    note: "Available to foreign nationals with at least six months of contributions who no longer have an address in Japan. Capped at a limited number of contribution months, and claiming it erases the enrolment periods permanently. Employees' Pension refunds have tax withheld that can usually be reclaimed.",
  },
  {
    code: "CH",
    country: "Switzerland",
    system: "AHV/AVS",
    availability: "conditional",
    qualifyingPeriod: "1 year of contributions creates an entitlement",
    claimDeadline: null,
    note: "Refunds are generally limited to nationals of countries without a social security agreement with Switzerland, on permanent departure. EU/EFTA nationals keep the entitlement instead of receiving a refund.",
  },
  {
    code: "KR",
    country: "South Korea",
    system: "National Pension Service lump-sum refund",
    availability: "conditional",
    qualifyingPeriod: "120 months",
    claimDeadline: null,
    note: "Lump-sum refunds on departure are granted on a reciprocity basis, so availability depends on the claimant's nationality.",
  },
  {
    code: "MY",
    country: "Malaysia",
    system: "Employees Provident Fund (EPF)",
    availability: "refund_possible",
    qualifyingPeriod: "n/a — a funded savings account, not a pension promise",
    claimDeadline: null,
    note: "A defined-contribution account rather than a state pension. Full withdrawal is possible on permanent emigration, as well as at the statutory age.",
  },
  {
    code: "SG",
    country: "Singapore",
    system: "Central Provident Fund (CPF)",
    availability: "conditional",
    qualifyingPeriod: "n/a — a funded savings account",
    claimDeadline: null,
    note: "Balances can generally be withdrawn on leaving Singapore and West Malaysia permanently, which for foreigners normally means giving up permanent residence.",
  },
  {
    code: "US",
    country: "United States",
    system: "Social Security",
    availability: "no_refund",
    qualifyingPeriod: "40 credits (about 10 years)",
    claimDeadline: null,
    note: "Contributions are never refunded. Totalization agreements with a number of countries allow foreign coverage periods to count toward the 40 credits.",
  },
  {
    code: "GB",
    country: "United Kingdom",
    system: "State Pension (National Insurance)",
    availability: "no_refund",
    qualifyingPeriod: "10 qualifying years minimum, 35 for the full amount",
    claimDeadline: null,
    note: "National Insurance is not refundable. Voluntary Class 2 or Class 3 contributions can be paid from abroad to protect or extend qualifying years.",
  },
  {
    code: "NL",
    country: "Netherlands",
    system: "AOW",
    availability: "no_refund",
    qualifyingPeriod: "Accrues at 2% per year of residence",
    claimDeadline: null,
    note: "No refund. Entitlement accrues by residence rather than contribution, and voluntary insurance can be arranged within a limited window after leaving.",
  },
  {
    code: "VN",
    country: "Vietnam",
    system: "Vietnam Social Insurance",
    availability: "conditional",
    qualifyingPeriod: "Varies by scheme",
    claimDeadline: null,
    note: "Compulsory social insurance for foreign employees includes a one-off benefit on leaving Vietnam under conditions. Freelancers paid by foreign clients are usually outside the compulsory scheme entirely, so no entitlement builds.",
  },
];

export function pensionCountry(code: string): PensionCountry | undefined {
  return PENSION_COUNTRIES.find((c) => c.code === code.toUpperCase());
}
