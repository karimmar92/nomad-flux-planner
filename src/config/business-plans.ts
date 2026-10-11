/**
 * BUSINESS PLANS: the three employer tiers, their prices and what each unlocks.
 *
 * One file, because a plan is three things that must agree: the price on
 * /business, the Stripe lookup key that charges it, and the features the
 * dashboard actually turns on. They drifted apart once already (a hand-typed
 * $8 sat live next to a $59 price), so the display lists, the gates and the
 * personal-plan grant all read from here.
 *
 * YEARLY ONLY. A company buys per seat for a year. There is no monthly price,
 * which removes a column from the page, a toggle from checkout and three of
 * the six Stripe prices, and matches how a finance team buys software. The
 * monthly figure shown is only the yearly price divided by twelve, for
 * comparison with tools that quote per month.
 *
 * WHY THESE NUMBERS. Day-count tracking sits between two reference points:
 * generic HR software is cheap (BambooHR-class tools are roughly $6-12 per
 * employee per month) while enterprise mobility platforms are quote-only and
 * priced for large programmes (one marketplace listing for Topia shows $75k a
 * year; Localyze is listed around EUR 49 a user, unverified). None of the
 * direct competitors researched publishes a per-seat price or sells without a
 * demo. $149 / $299 / $449 a seat a year works out to about $12 / $25 / $37 a
 * month: under mobility tooling, above HR software because it prevents tax and
 * permanent-establishment cost rather than filing leave.
 */

export type BusinessTierId = "basic" | "advanced" | "pro";

/** `unpaid` is an organisation that exists but has no subscription. */
export type OrgPlan = BusinessTierId | "unpaid";

/** What each seat holder gets personally, on top of the employer features. */
export type PersonalPlan = "free" | "starter" | "pro";

export type OrgFeature =
  | "presence"
  | "csvExport"
  | "actionCenter"
  | "policies"
  | "approvals"
  | "explain"
  | "peExposure"
  | "pdfExport"
  | "forecast";

export type BusinessTier = {
  id: BusinessTierId;
  name: string;
  /** Per seat, billed once a year. */
  yearlyUsd: number;
  audience: string;
  headline: string;
  /** Plan every active seat holder gets for personal use. */
  personalPlan: PersonalPlan;
  features: string[];
  recommended?: boolean;
};

/** Seats an unpaid organisation may hold while it evaluates. */
export const EVALUATION_SEATS = 3;
/** Minimum seats on any paid contract. */
export const MINIMUM_SEATS = 10;
export const MAXIMUM_SEATS = 500;

export const BUSINESS_TIERS: BusinessTier[] = [
  {
    id: "basic",
    name: "Basic",
    yearlyUsd: 149,
    audience: "Teams that need to know where people are and when a limit is close.",
    headline: "Day counts and threshold flags for everyone who works abroad.",
    personalPlan: "free",
    features: [
      "One verdict on opening: act, watch or clear",
      "Day counts per person and country, rolling 12 months",
      "Visa and tax-residency threshold flags in every country",
      "Record confidence: how far each number can be trusted",
      "Four views of the same data: People, Finance, Mobility, Simple",
      "Sample-data preview before anyone is invited",
      "Invite by email, remove a seat any time",
      "Employees see exactly what you see",
      "CSV audit export",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    yearlyUsd: 299,
    audience: "People and finance teams that set policy and approve travel.",
    headline: "A policy, an approval flow and a daily to-do list, with the working shown.",
    personalPlan: "starter",
    recommended: true,
    features: [
      "Everything in Basic",
      "Needs-attention list, ranked, with the screen that fixes each item",
      "Company limits per country or global, from a template or your own",
      "Travel requests with days of headroom and the latest compliant end date",
      "Show working: every number broken down stay by stay",
      "Permanent-establishment exposure by country",
      "PDF audit pack",
      "Every seat includes Starter for personal use",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    yearlyUsd: 449,
    audience: "Companies with people abroad year-round and an auditor to answer to.",
    headline: "Dated warnings before a limit is crossed, and full Pro for every seat.",
    personalPlan: "pro",
    features: [
      "Everything in Advanced",
      "Projected crossing dates for anyone currently abroad",
      "Every seat includes Pro for personal use: tax report, vault, full ranking",
      "Invoice billing on request",
      "Priority support",
      "Admin onboarding session",
    ],
  },
];

/** Not sold, not promised as shipped. Shown as direction only. */
export const BUSINESS_ROADMAP = ["single sign-on", "HR system import", "API access"];

const RANK: Record<OrgPlan, number> = { unpaid: 0, basic: 1, advanced: 2, pro: 3 };

/** The lowest tier that includes each feature. Everything else follows from it. */
const MIN_TIER: Record<OrgFeature, BusinessTierId> = {
  presence: "basic",
  csvExport: "basic",
  actionCenter: "advanced",
  policies: "advanced",
  approvals: "advanced",
  explain: "advanced",
  peExposure: "advanced",
  pdfExport: "advanced",
  forecast: "pro",
};

export function businessTier(id: BusinessTierId): BusinessTier {
  return BUSINESS_TIERS.find((t) => t.id === id)!;
}

/** The yearly price spread over twelve months, for comparing with per-month quotes. */
export function monthlyEquivalentUsd(tier: BusinessTierId): number {
  return Math.round(businessTier(tier).yearlyUsd / 12);
}

/** Anything unrecognised is treated as unpaid, never as a paid tier. */
export function normaliseOrgPlan(raw: unknown): OrgPlan {
  return raw === "basic" || raw === "advanced" || raw === "pro" ? raw : "unpaid";
}

/**
 * Whether a plan includes a feature. An unpaid organisation evaluates the
 * Basic feature set on a small seat allowance rather than getting everything:
 * otherwise there is nothing left to buy.
 */
export function orgHasFeature(plan: OrgPlan, feature: OrgFeature): boolean {
  const effective: OrgPlan = plan === "unpaid" ? "basic" : plan;
  return RANK[effective] >= RANK[MIN_TIER[feature]];
}

/** The cheapest tier that would unlock a feature, for upgrade prompts. */
export function tierUnlocking(feature: OrgFeature): BusinessTier {
  return businessTier(MIN_TIER[feature]);
}

/** How many non-removed members an organisation may hold. */
export function seatLimit(plan: OrgPlan, seatsPurchased: number): number {
  return plan === "unpaid" ? EVALUATION_SEATS : seatsPurchased;
}

export function personalPlanFor(plan: OrgPlan): PersonalPlan | null {
  return plan === "unpaid" ? null : businessTier(plan).personalPlan;
}

/**
 * Stripe lookup key, e.g. teams_advanced_yearly. Only yearly prices are sold;
 * the monthly interval stays in the type so a subscription created under the
 * earlier model still resolves to its tier.
 */
export function teamsPriceKey(
  tier: BusinessTierId,
  interval: "monthly" | "yearly" = "yearly",
): string {
  return `teams_${tier}_${interval}`;
}

/** Reverse of teamsPriceKey. The legacy single-tier keys map to Pro, the old $59 plan. */
export function tierFromPriceKey(key: string | null | undefined): BusinessTierId | null {
  if (!key) return null;
  if (key === "teams_monthly" || key === "teams_yearly") return "pro";
  const m = /^teams_(basic|advanced|pro)_(monthly|yearly)$/.exec(key);
  return m ? (m[1] as BusinessTierId) : null;
}

const PERSONAL_RANK: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  founding_lifetime: 3,
  teams: 4,
};

/**
 * The plan someone actually has: the higher of what they pay for themselves
 * and what their employer's seat grants. A seat can only ever add access, so a
 * founding member or a Teams buyer who also holds a seat is never downgraded.
 */
export function effectivePlan<P extends string>(
  own: P,
  seatGrant: PersonalPlan | null,
): P | PersonalPlan {
  if (!seatGrant) return own;
  return (PERSONAL_RANK[seatGrant] ?? 0) > (PERSONAL_RANK[own] ?? 0) ? seatGrant : own;
}

/** A seat count safe to charge: whole, and inside the sellable range. */
export function clampSeats(raw: number): number {
  if (!Number.isFinite(raw)) return MINIMUM_SEATS;
  return Math.min(MAXIMUM_SEATS, Math.max(MINIMUM_SEATS, Math.round(raw)));
}
