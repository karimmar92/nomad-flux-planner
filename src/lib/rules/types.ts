/**
 * Day-count rules — the thesis of the product in one file.
 *
 * Every rule that governs a mobile life is the same computation against a
 * different threshold, with different counting conventions. The conventions are
 * where people lose money, and they genuinely contradict each other:
 *
 *   Schengen 90/180  — entry day AND exit day both count as full days.
 *   FEIE 330         — arrival days do NOT count; only midnight-to-midnight
 *                      days fully in a foreign country qualify.
 *   183-day tax      — usually any part of a day, but the tax YEAR varies
 *                      (South Africa runs March–February, Mauritius July–June).
 *   UK SRT           — days at midnight, with a threshold that moves according
 *                      to how many ties you have.
 *
 * The same trip therefore produces four different numbers, all correct. That is
 * why a single "days abroad" counter is useless and why this app exists.
 *
 * DISCIPLINE, inherited from the tax report: a rule returns a COUNT and the
 * PUBLISHED THRESHOLD. It never returns a determination of status. "Your
 * recorded days exceed the threshold" is a fact; "you are UK resident" is
 * regulated advice.
 */
import type { Trip } from "@/lib/types";

export type RuleId = "schengen" | "feie" | "tax_183" | "uk_srt";

export type RuleStatus = "ok" | "watch" | "at_limit" | "exceeded" | "insufficient_data";

export type RuleResult = {
  id: RuleId;
  /** Short label for the picker. */
  label: string;
  /** Who this rule is for, one line. */
  audience: string;
  /** The number that matters. */
  value: number;
  /** The published threshold it is measured against. */
  threshold: number;
  unit: string;
  status: RuleStatus;
  /** Plain-language headline of the count — never a status determination. */
  headline: string;
  /** The counting convention, stated so the figure can be checked. */
  convention: string;
  /**
   * Extra facts worth surfacing (dates, sub-counts).
   *
   * `| undefined` is deliberate, not redundant. The project runs
   * `exactOptionalPropertyTypes`, under which `detail?: string` means "may be
   * absent" but NOT "may be present and undefined" — so every evaluator that
   * builds this object literally with a possibly-undefined detail fails to
   * compile. Writing it this way keeps the field optional at call sites and
   * assignable from `string | undefined` expressions.
   */
  detail?: string | undefined;
  /** True when this rule counts UP toward a good outcome rather than a limit. */
  higherIsBetter?: boolean;
};

export type RuleInputs = {
  trips: Trip[];
  today: string;
  /** ISO country code of the user's home/citizenship country, where relevant. */
  homeCountry?: string;
  /** UK SRT: number of ties declared by the user (0–5). */
  ukTies?: number;
  /** UK SRT: resident in the UK in any of the previous three tax years. */
  ukResidentRecently?: boolean;
};

export function statusFor(value: number, threshold: number): RuleStatus {
  if (value > threshold) return "exceeded";
  if (value === threshold) return "at_limit";
  const pct = threshold > 0 ? value / threshold : 0;
  if (pct >= 0.9) return "watch";
  return "ok";
}
