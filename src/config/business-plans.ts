/**
 * BUSINESS PLANS — the three employer tiers, their prices and what each unlocks.
 *
 * One file, because a plan is three things that must agree: the price on
 * /business, the Stripe lookup key that charges it, and the features the
 * dashboard actually turns on. They drifted apart once already (a hand-typed
 * $8 sat live next to a $59 price), so the display lists, the gates and the
 * personal-plan grant all read from here.
 *
 * Prices are per seat per month, billed monthly. Annual is the app-wide
 * "pay 8 of 12 months" rule in config/pricing.ts and is derived, never typed.
 * This file must not import config/pricing.ts (which imports this one for the
 * Teams entry), so annual maths lives in lib/org/pricing.ts.
 *
 * WHY THESE NUMBERS. Day-count tracking sits between two reference points:
 * generic HR software is cheap (BambooHR-class tools are roughly $6-12 per
 * employee) while enterprise mobility platforms are quote-only and priced for
 * large programmes (one marketplace listing for Topia shows $75k a year;
 * Localyze is listed around EUR 49 a user, unverified). None of the direct
 * competitors researched publishes a per-seat price or sells without a demo.
 * $19 / $39 / $59 undercuts mobility tooling, charges more than HR software
 * because it prevents tax and permanent-establishment cost rather than filing
 * leave, and annual billing lands the effective prices at about $13 / $26 / $39.
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
  monthlyUsd: number;
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
    monthlyUsd: 19,
    audience: "Teams that need to know where people are and when a limit is close.",
    headline: "Day counts and threshold flags for everyone who works abroad.",
    personalPlan: "free",
    features: [
      "Day counts per person and country, rolling 12 months",
      "Visa and tax-residency threshold flags in every country",
      "Team overview: who is clear, approaching or over",
      "Invite by email, remove a seat any time",
      "Employees see exactly what you see",
      "CSV audit export",
    ],
  },
  {
    id: "advanced",
    name: "Advanced",
    monthlyUsd: 39,
    audience: "People and finance teams that set policy and approve travel.",
    headline: "A policy, an approval flow and a daily to-do list, with the working shown.",
    personalPlan: "starter",
    recommended: true,
    features: [
      "Everything in Basic",
      "Needs-attention list, ranked, with the screen that fixes each item",
      "Company limits per country or global, with an approval step",
      "Travel requests with the compliance maths shown before you decide",
      "Show working: every number broken down stay by stay",
      "Permanent-establishment exposure by country",
      "PDF audit pack",
      "Every seat includes Starter for personal use",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyUsd: 59,
    audience: "Companies with people abroad year-round and an auditor to answer to.",
    headline: "Dated warnings before a limit is crossed, and full Pro for every seat.",
    personalPlan: "pro",
    features: [
      "Everything in Advanced",
      "Projected crossing dates for anyone currently abroad",
      "Every seat includes Pro for personal use: tax report, vault, full ranking",
      "Annual invoice billing on request",
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

/** Stripe lookup key, e.g. teams_advanced_yearly. */
export function teamsPriceKey(tier: BusinessTierId, interval: "monthly" | "yearly"): string {
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
