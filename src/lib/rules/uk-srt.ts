/**
 * UK Statutory Residence Test.
 *
 * HONESTY NOTE, because this rule is the one most easily misrepresented:
 *
 * The SRT is NOT a day count. It is three tests applied in order, and only the
 * first two are decided by days alone:
 *
 *   1. Automatic overseas tests — pure day counts, and definitive. Under 16 UK
 *      days (if UK resident in any of the previous three tax years), or under
 *      46 (if not), and the test is met.
 *   2. Automatic UK test — 183 or more UK days in the tax year, definitive.
 *   3. Sufficient ties test — everything in between. The day threshold moves
 *      according to how many ties you have to the UK (family, accommodation,
 *      work, 90-day, and for leavers a country tie). Ties are facts about your
 *      life that this app does not know, so the user declares them.
 *
 * So this module reports which test your recorded days engage, and — for the
 * middle band — the published threshold for the number of ties declared. It
 * does not state residence status. Ties are self-declared and each has its own
 * statutory definition; a wrong tie count produces a wrong threshold, which is
 * said plainly in the UI rather than hidden.
 *
 * The UK tax year runs 6 April to 5 April, not January to December.
 */
import { countDistinctDays, type DayRange } from "@/lib/day-union";
import { toDayIndex } from "@/lib/schengen";
import type { RuleInputs, RuleResult, RuleStatus } from "./types";

export const SRT_AUTO_OVERSEAS_RECENT_RESIDENT = 16;
export const SRT_AUTO_OVERSEAS_NOT_RECENT = 46;
export const SRT_AUTO_UK = 183;

/** Minimum ties that make someone resident, by day band. */
type Band = { minDays: number; maxDays: number; tiesNeeded: number };

/** Leavers: UK resident in one or more of the previous three tax years. */
export const LEAVER_BANDS: Band[] = [
  { minDays: 16, maxDays: 45, tiesNeeded: 4 },
  { minDays: 46, maxDays: 90, tiesNeeded: 3 },
  { minDays: 91, maxDays: 120, tiesNeeded: 2 },
  { minDays: 121, maxDays: 182, tiesNeeded: 1 },
];

/** Arrivers: not UK resident in any of the previous three tax years. */
export const ARRIVER_BANDS: Band[] = [
  { minDays: 46, maxDays: 90, tiesNeeded: 4 },
  { minDays: 91, maxDays: 120, tiesNeeded: 3 },
  { minDays: 121, maxDays: 182, tiesNeeded: 2 },
];

/** UK tax year containing `iso`: 6 April to 5 April. */
export function ukTaxYearBounds(iso: string): { start: string; end: string; label: string } {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const startYear = m > 4 || (m === 4 && d >= 6) ? y : y - 1;
  return {
    start: `${startYear}-04-06`,
    end: `${startYear + 1}-04-05`,
    label: `${startYear}/${String(startYear + 1).slice(2)}`,
  };
}

/** Days present in the UK during the tax year containing `today`. */
export function ukDaysInTaxYear(inputs: RuleInputs): number {
  const { start, end } = ukTaxYearBounds(inputs.today);
  const lo = toDayIndex(start);
  const hi = Math.min(toDayIndex(end), toDayIndex(inputs.today));

  /**
   * DISTINCT days. Same bug class as the presence report, same fix.
   *
   * Summing each trip's length counts an overlapping day once per trip, and two
   * overlapping UK trips — a forgotten exit date, an arrival logged before the
   * previous departure — inflate the total. That matters more here than almost
   * anywhere else in the app: the SRT bands are step functions, so a handful of
   * invented days can move somebody across a threshold and tell them their
   * recorded presence meets a residence test it does not meet.
   */
  const ranges: DayRange[] = [];
  for (const trip of inputs.trips) {
    if (trip.country_code.toUpperCase() !== "GB") continue;
    ranges.push({
      from: Math.max(toDayIndex(trip.entry_date), lo),
      to: Math.min(trip.exit_date ? toDayIndex(trip.exit_date) : toDayIndex(inputs.today), hi),
    });
  }
  return countDistinctDays(ranges);
}

export function bandFor(days: number, leaver: boolean): Band | null {
  const bands = leaver ? LEAVER_BANDS : ARRIVER_BANDS;
  return bands.find((b) => days >= b.minDays && days <= b.maxDays) ?? null;
}

export function evaluateUkSrt(inputs: RuleInputs): RuleResult {
  const days = ukDaysInTaxYear(inputs);
  const leaver = inputs.ukResidentRecently ?? true;
  const ties = Math.max(0, Math.min(5, inputs.ukTies ?? 0));
  const { label: yearLabel } = ukTaxYearBounds(inputs.today);
  const autoOverseasLimit = leaver
    ? SRT_AUTO_OVERSEAS_RECENT_RESIDENT
    : SRT_AUTO_OVERSEAS_NOT_RECENT;

  let headline: string;
  let status: RuleStatus;

  if (days >= SRT_AUTO_UK) {
    status = "exceeded";
    headline = `${days} UK days in ${yearLabel} — at or above 183, which engages the automatic UK test.`;
  } else if (days < autoOverseasLimit) {
    status = "ok";
    headline = `${days} UK days in ${yearLabel} — below ${autoOverseasLimit}, which engages an automatic overseas test.`;
  } else {
    const band = bandFor(days, leaver);
    if (!band) {
      status = "ok";
      headline = `${days} UK days in ${yearLabel} — below the day bands for the sufficient ties test.`;
    } else {
      const meets = ties >= band.tiesNeeded;
      status = meets ? "exceeded" : ties === band.tiesNeeded - 1 ? "watch" : "ok";
      headline = `${days} UK days in ${yearLabel}. In the ${band.minDays}–${band.maxDays} day band, the sufficient ties test looks for ${band.tiesNeeded} tie${band.tiesNeeded === 1 ? "" : "s"}; you have declared ${ties}.`;
    }
  }

  return {
    id: "uk_srt",
    label: "UK SRT",
    audience: "British taxpayers who have left, or who are arriving",
    value: days,
    threshold: SRT_AUTO_UK,
    unit: "UK days this tax year",
    status,
    headline,
    convention:
      "Days counted at midnight, over the UK tax year (6 April to 5 April). The SRT is three tests, not one number: automatic overseas, automatic UK, then sufficient ties. Ties are declared by you and each has its own statutory definition.",
    detail: `Counted as ${leaver ? "a leaver — UK resident in at least one of the previous three tax years" : "an arriver — not UK resident in any of the previous three tax years"}.`,
  };
}
