/**
 * The rule set, evaluated together.
 *
 * One trip history, four thresholds, four different numbers — all correct.
 * This is the product argument made executable, and it is what the landing page
 * demonstrates rather than asserts.
 */
import { SCHENGEN_MAX_DAYS, schengenStatus } from "@/lib/schengen";
import { toEngineTrips } from "@/lib/trip-dates";
import { CITIES } from "@/lib/cities";
import { daysInCountryTaxYear } from "@/lib/trip-dates";
import { taxYearStartMonth } from "@/lib/arbitrage";
import { evaluateFeie } from "./feie";
import { evaluateUkSrt } from "./uk-srt";
import { statusFor, type RuleId, type RuleInputs, type RuleResult } from "./types";

export * from "./types";
export { evaluateFeie, FEIE_REQUIRED_DAYS } from "./feie";
export { evaluateUkSrt, ukTaxYearBounds } from "./uk-srt";

export function evaluateSchengen(inputs: RuleInputs): RuleResult {
  const status = schengenStatus(toEngineTrips(inputs.trips), inputs.today);
  return {
    id: "schengen",
    label: "Schengen 90/180",
    audience: "Anyone visiting Europe without a long-stay visa",
    value: status.used,
    threshold: SCHENGEN_MAX_DAYS,
    unit: "days used",
    status: statusFor(status.used, SCHENGEN_MAX_DAYS),
    headline:
      status.used === 0
        ? "No Schengen days recorded in the current rolling window."
        : `${status.used} of ${SCHENGEN_MAX_DAYS} days used in the current 180-day window, ${status.remaining} remaining today.`,
    convention:
      "A rolling 180-day window, not an annual reset — leaving does not clear the clock. Both the entry day and the exit day count as full days.",
    detail: status.nextFullNinety
      ? `Your allowance next returns to a full 90 days on ${status.nextFullNinety}.`
      : undefined,
  };
}

/**
 * The 183-day residency threshold for the country where the user has spent the
 * most days this tax year — the one most likely to matter to them.
 *
 * Uses each country's own tax year, which is the part people get wrong: South
 * Africa runs March to February, Mauritius July to June.
 */
export function evaluateTaxResidency(inputs: RuleInputs): RuleResult {
  const home = (inputs.homeCountry ?? "").toUpperCase();
  const codes = Array.from(
    new Set(inputs.trips.map((t) => t.country_code.toUpperCase()).filter((c) => c !== home)),
  );

  let top: { code: string; days: number; trigger: number; label: string } | null = null;
  for (const code of codes) {
    const city = CITIES.find((c) => c.country_code === code);
    const trigger = city?.tax.residencyTriggerDays ?? 183;
    const startMonth = city ? taxYearStartMonth(city) : 0;
    const { days } = daysInCountryTaxYear(inputs.trips, code, inputs.today, startMonth);
    if (!top || days > top.days) {
      top = { code, days, trigger, label: city?.country ?? code };
    }
  }

  if (!top) {
    return {
      id: "tax_183",
      label: "183-day residency",
      audience: "Anyone spending long stretches in one country",
      value: 0,
      threshold: 183,
      unit: "days",
      status: "insufficient_data",
      headline: "No trips recorded yet, so there is nothing to count against a residency threshold.",
      convention:
        "Most countries treat 183 days in their tax year as the point where residency is presumed — but the tax year is not always January to December.",
    };
  }

  return {
    id: "tax_183",
    label: "183-day residency",
    audience: "Anyone spending long stretches in one country",
    value: top.days,
    threshold: top.trigger,
    unit: `days in ${top.label}`,
    status: statusFor(top.days, top.trigger),
    headline: `${top.days} of ${top.trigger} days in ${top.label} in its current tax year.`,
    convention:
      "Counted over each country's own tax year, which is not always January to December. Day count is one test among several — permanent home and centre of vital interests also matter.",
  };
}

export function evaluateRule(id: RuleId, inputs: RuleInputs): RuleResult {
  switch (id) {
    case "schengen":
      return evaluateSchengen(inputs);
    case "feie":
      return evaluateFeie(inputs);
    case "tax_183":
      return evaluateTaxResidency(inputs);
    case "uk_srt":
      return evaluateUkSrt(inputs);
  }
}

export const RULE_ORDER: RuleId[] = ["schengen", "tax_183", "feie", "uk_srt"];

export function evaluateAll(inputs: RuleInputs): RuleResult[] {
  return RULE_ORDER.map((id) => evaluateRule(id, inputs));
}
