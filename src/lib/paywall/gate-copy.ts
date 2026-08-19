/**
 * THE TWO LINES EVERY GATE SHOWS, IN TWO WORDINGS.
 *
 * Line one is the situation ("what you have already used"), line two is the
 * change ("what you get next"). Both are generated from the same facts — the
 * meter position, the feature name, whether the gate is metered — so no
 * variant can claim something the other cannot.
 *
 * variant "a" — RECEIPT: leads with the free value already delivered.
 * variant "b" — COST OF WAITING: leads with what stays manual until upgrade.
 *
 * Same numbers, different emphasis. That is the entire experiment.
 */
import type { ProFeature } from "@/lib/entitlements";
import { FREE_MONTHLY_CHECKS } from "@/lib/paywall/meter";
import { featureLabel } from "@/lib/paywall/value";
import type { GateCopyVariant } from "@/lib/analytics/experiment";

export type GateLines = { used: string; next: string };

export function gateLines(args: {
  variant: GateCopyVariant;
  metered: boolean;
  used: number;
  feature: ProFeature | null;
  /** Feature names already spent this month, when known. */
  spent?: ProFeature[];
}): GateLines {
  const label = args.feature ? featureLabel(args.feature) : "this answer";
  const spentList = (args.spent ?? []).map((f) => featureLabel(f)).join(", ");

  if (args.variant === "b") {
    return {
      used: args.metered
        ? `${FREE_MONTHLY_CHECKS - args.used} of ${FREE_MONTHLY_CHECKS} free checks left this month. After that, ${label} waits until the 1st.`
        : `${label} is not on the free monthly checks, so today it stays a manual job.`,
      next: args.metered
        ? `Pro drops the counter: ${label} whenever a date changes, not three times a month.`
        : `Pro turns it on now, together with the tax presence report, exports and the 12-month calendar.`,
    };
  }

  return {
    used: args.metered
      ? args.used > 0
        ? `You have used ${args.used} of ${FREE_MONTHLY_CHECKS} free checks this month${spentList ? ` — ${spentList}` : ""}.`
        : `Free accounts get ${FREE_MONTHLY_CHECKS} checks a month, and this is one of them.`
      : `Not part of the free monthly checks — ${label} sits outside them.`,
    next: args.metered
      ? `Next: unlimited ${label}, with no monthly check counter.`
      : `Next: ${label} unlocked outright, plus the tax presence report, exports and the 12-month calendar.`,
  };
}
