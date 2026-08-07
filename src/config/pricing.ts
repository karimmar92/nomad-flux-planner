/**
 * PRICING — single source of truth.
 *
 * Prices appear on the homepage, the pricing page, meta descriptions and (soon)
 * Stripe. They lived in five places before and drifted; everything now reads
 * from here.
 *
 * Two rules that are not style choices:
 *
 * 1. ANNUAL = PAY 10, GET 12. The annual figure is always monthly × 10, never
 *    a hand-typed number, so "two months free" stays literally true. Claiming a
 *    saving that the arithmetic doesn't support is a misleading price claim.
 *
 * 2. VAT. These are net prices. German PAngV requires CONSUMER-facing prices to
 *    show the total payable including VAT, and VAT on digital services is due
 *    at the customer's rate (OSS). "+ VAT" is fine while checkout is closed;
 *    before the first charge this must become a gross price. See PRICE_VAT_NOTE.
 */

export type PlanId = "free" | "starter" | "pro" | "teams";

export type Tier = {
  id: PlanId;
  name: string;
  /** Net price per month in USD when billed monthly. 0 = free. */
  monthlyUsd: number;
  /** Who it is for — one line, concrete, no adjectives. */
  audience: string;
  /** The single reason to choose this tier over the one below it. */
  headline: string;
  features: string[];
  /** Teams is priced per seat; the others are per person. */
  perSeat?: boolean;
  /** Draws the emphasised border. Exactly one tier should set this. */
  recommended?: boolean;
};

/** Months charged on the annual plan. 10 of 12 = two months free. */
export const ANNUAL_MONTHS_CHARGED = 10;

export const PRICE_VAT_NOTE = "+ VAT";

/** Annual price, derived. Never hard-code an annual figure. */
export function annualUsd(tier: Tier): number {
  return tier.monthlyUsd * ANNUAL_MONTHS_CHARGED;
}

/** Effective monthly cost on the annual plan, for the "as low as" line. */
export function annualMonthlyEquivalentUsd(tier: Tier): number {
  return Math.round((annualUsd(tier) / 12) * 100) / 100;
}

/** What the annual plan saves against paying monthly for a year. */
export function annualSavingUsd(tier: Tier): number {
  return tier.monthlyUsd * 12 - annualUsd(tier);
}

export const TIERS: Tier[] = [
  {
    id: "free",
    name: "Free",
    monthlyUsd: 0,
    audience: "Anyone who has crossed a border this year.",
    headline: "Know where you stand today — permanently free, no trip cap.",
    features: [
      "Unlimited trip tracking, free forever — no cap, ever",
      "Your Schengen 90/180 status today: days used, days remaining",
      "Day counts for every country you have visited, against each threshold",
      "Every city, with the full cost breakdown",
      "The whole “Before you go” planning track",
      "The LLC eligibility tool",
      "Arbitrage against one city you choose",
      "The full border-run list whenever you are within seven days of a limit",
      "Situation phrasebook — offline, spoken, for immigration and emergencies",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyUsd: 14,
    audience: "One passport, a few countries a year.",
    headline: "Stop guessing before you book — plan forward instead of counting backward.",
    features: [
      "Everything in Free",
      "Border-run planner — every exit ranked, not just the top one",
      "Forward planning — “if I enter on 3 October, how long can I stay?”",
      "Threshold alerts at 75% and 90%, by email and in-app",
      "Compliance calendar for the full year ahead",
      "Compare across cities, 2–4 at a time",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 29,
    recommended: true,
    audience: "Multiple countries, real tax exposure, documents that matter.",
    headline: "The year-end record your accountant asks for, and the vault you open at the border.",
    features: [
      "Everything in Starter",
      "Tax presence report, and all exports (PDF, CSV)",
      "Document vault, protected by a second factor and cached for offline access",
      "Full arbitrage ranking across every city, plus the savings-target calculator",
      "Multi-year history and retrospective reports",
      "Pension exit calculator — refund rules for every country you have worked in",
      "Priority support",
    ],
  },
  {
    id: "teams",
    name: "Teams",
    monthlyUsd: 59,
    perSeat: true,
    audience: "Employers whose staff work across borders.",
    headline: "See the whole team's exposure before it becomes a permanent-establishment problem.",
    features: [
      "Everything in Pro, for every seat",
      "Employer dashboard — presence and risk per member",
      "Travel request approvals with an audit trail",
      "Company travel policy, enforced at request time",
      "Org-wide audit export (PDF, CSV)",
      "Shared presence with per-field consent — staff choose what is visible",
    ],
  },
];

export function tier(id: PlanId): Tier {
  const found = TIERS.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown plan: ${id}`);
  return found;
}

export const PAID_TIERS = TIERS.filter((t) => t.monthlyUsd > 0);
