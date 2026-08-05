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

export function isPro(plan: Plan): boolean {
  return plan === "pro";
}

export function canUse(plan: Plan, _feature: ProFeature): boolean {
  return isPro(plan);
}

/** Free users see the compliance calendar this far ahead. */
export const FREE_CALENDAR_HORIZON_DAYS = 30;

/** Inside this many days of a deadline, gates come off. */
export const EMERGENCY_DAYS = 7;

/** True when a move is already forced — never gate anything in this state. */
export function isEmergency(deadline: { daysLeft: number; overstayed: boolean }): boolean {
  return deadline.overstayed || deadline.daysLeft <= EMERGENCY_DAYS;
}
