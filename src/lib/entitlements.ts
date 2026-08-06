/**
 * PAYWALL MODEL — free to put data in, paid to get value out.
 *
 * The tracker is the habit loop and the switching cost, so logging is
 * unlimited and free forever: trips, current Schengen status, current country
 * day counts, all cities, the /plan track, the LLC tool, the radar and basic
 * single-city arbitrage. What is paid is the FORWARD-LOOKING and the
 * EXPORTABLE: border-run ranking, planning ahead, alerts, reports, exports,
 * the vault, compare and the full arbitrage ranking.
 *
 * EMERGENCY RULE (non-negotiable): nothing is ever gated mid-emergency. If a
 * user is over a limit or inside 7 days of a deadline they see the full
 * border-run list regardless of plan. Someone about to overstay is not the
 * person to extract $9 from.
 */
import type { Plan } from "./types";

export const PRO_FEATURES = [
  "border_run_full",
  "forward_planning",
  "threshold_alerts",
  "tax_report",
  "exports",
  "vault",
  "compare",
  "arbitrage_ranking",
  "calendar_horizon",
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

/**
 * Tiers are cumulative: every tier includes everything below it. Ranking them
 * once here means a new tier cannot accidentally *remove* access — a bug that
 * would be invisible until a paying customer lost a feature they had.
 */
const PLAN_RANK: Record<Plan, number> = { free: 0, starter: 1, pro: 2, teams: 3 };

/** Lowest tier that unlocks each paid feature. */
const FEATURE_MIN_PLAN: Record<ProFeature, Plan> = {
  border_run_full: "starter",
  forward_planning: "starter",
  threshold_alerts: "starter",
  calendar_horizon: "starter",
  compare: "starter",
  tax_report: "pro",
  exports: "pro",
  vault: "pro",
  arbitrage_ranking: "pro",
};

export function atLeast(plan: Plan, minimum: Plan): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[minimum];
}

/**
 * Kept as the name the codebase already uses. It means "on a paid plan", and
 * gates the Pro-tier feature set specifically — not merely "paying".
 */
export function isPro(plan: Plan): boolean {
  return atLeast(plan, "pro");
}

/** True when the plan is paid at all, whatever the tier. */
export function isPaid(plan: Plan): boolean {
  return atLeast(plan, "starter");
}

export function canUse(plan: Plan, feature: ProFeature): boolean {
  return atLeast(plan, FEATURE_MIN_PLAN[feature]);
}

/** Free users see the compliance calendar this far ahead. */
export const FREE_CALENDAR_HORIZON_DAYS = 30;

/** Inside this many days of a deadline, gates come off. */
export const EMERGENCY_DAYS = 7;

/** True when a move is already forced — never gate anything in this state. */
export function isEmergency(deadline: { daysLeft: number; overstayed: boolean }): boolean {
  return deadline.overstayed || deadline.daysLeft <= EMERGENCY_DAYS;
}
