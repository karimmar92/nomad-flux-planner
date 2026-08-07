/**
 * FEIE physical presence test — 330 full days abroad in any rolling 12 months.
 *
 * The highest-stakes day count there is: missing it by a single day can cost a
 * US taxpayer the whole Foreign Earned Income Exclusion, worth more than
 * $120,000 of excluded income. It is also the rule most often counted wrong,
 * because its convention is the OPPOSITE of Schengen's:
 *
 *   * A qualifying day is a FULL day — midnight to midnight — spent in a
 *     foreign country. Land in Lisbon at 14:00 and that day does not count.
 *   * The 12-month window is ROLLING. It need not align to a calendar or tax
 *     year, and you may pick the window that suits you.
 *   * Time in international waters or airspace is neither in the US nor in a
 *     foreign country, so it counts toward nothing. A seven-day Atlantic
 *     crossing costs seven days.
 *
 * HOW THIS COUNTS, and why it is deliberately conservative:
 *
 * Contiguous foreign trips are merged into a single span abroad, then the first
 * and last day of each SPAN are dropped as travel days. Merging first means
 * hopping Portugal → Thailand mid-span does not cost you days, which matches
 * the rule (travel between foreign countries under 24 hours does not break
 * presence). Dropping the span edges is conservative: those are the days you
 * were arriving from or departing to somewhere else, and understating your
 * qualifying days is the safe direction of error for a test worth six figures.
 *
 * It is an indicator, not a filing position. The authoritative count is built
 * from actual arrival and departure times, which this app does not hold.
 */
import { toDayIndex, fromDayIndex } from "@/lib/schengen";
import { statusFor, type RuleInputs, type RuleResult } from "./types";

export const FEIE_REQUIRED_DAYS = 330;
export const FEIE_WINDOW_DAYS = 365;

type Span = { from: number; to: number };

/** Merges trips into continuous spans abroad, ignoring the home country. */
export function foreignSpans(inputs: RuleInputs): Span[] {
  const home = (inputs.homeCountry ?? "US").toUpperCase();
  const todayIdx = toDayIndex(inputs.today);

  const ranges = inputs.trips
    .filter((t) => t.country_code.toUpperCase() !== home)
    .map((t) => ({
      from: toDayIndex(t.entry_date),
      // An open trip is counted only up to today, never into the future.
      to: Math.min(t.exit_date ? toDayIndex(t.exit_date) : todayIdx, todayIdx),
    }))
    .filter((r) => r.to >= r.from)
    .sort((a, b) => a.from - b.from);

  const spans: Span[] = [];
  for (const r of ranges) {
    const last = spans[spans.length - 1];
    // Touching or overlapping spans merge: leaving Portugal for Thailand on the
    // same or next day is one continuous period abroad.
    if (last && r.from <= last.to + 1) {
      last.to = Math.max(last.to, r.to);
    } else {
      spans.push({ ...r });
    }
  }
  return spans;
}

/** Full days abroad per span: length minus the two travel days at the edges. */
export function qualifyingDays(spans: Span[]): number[] {
  return spans.map((s) => Math.max(0, s.to - s.from + 1 - 2));
}

/**
 * The best rolling 12-month window, and how many qualifying days it holds.
 *
 * Windows are only ever anchored at a span edge: the maximum count in any
 * sliding window always occurs with the window starting at the beginning of
 * some qualifying stretch, so there is no need to test all 365 offsets.
 */
export function bestWindow(spans: Span[]): { start: number; days: number } {
  if (spans.length === 0) return { start: 0, days: 0 };
  let best = { start: spans[0]!.from, days: 0 };

  for (const anchor of spans) {
    const start = anchor.from;
    const end = start + FEIE_WINDOW_DAYS - 1;
    let days = 0;
    for (const s of spans) {
      const from = Math.max(s.from, start);
      const to = Math.min(s.to, end);
      if (to < from) continue;
      // Travel days are only dropped where the span edge falls inside the
      // window; a span clipped by the window boundary keeps that edge.
      const dropStart = s.from >= start ? 1 : 0;
      const dropEnd = s.to <= end ? 1 : 0;
      days += Math.max(0, to - from + 1 - dropStart - dropEnd);
    }
    if (days > best.days) best = { start, days };
  }
  return best;
}

export function evaluateFeie(inputs: RuleInputs): RuleResult {
  const spans = foreignSpans(inputs);
  const best = bestWindow(spans);
  const shortfall = FEIE_REQUIRED_DAYS - best.days;

  // Counting UP toward a target, so the status logic inverts: being under the
  // threshold is the problem here, not being over it.
  const status =
    spans.length === 0
      ? "insufficient_data"
      : best.days >= FEIE_REQUIRED_DAYS
        ? "ok"
        : shortfall <= 15
          ? "watch"
          : "exceeded";

  return {
    id: "feie",
    label: "US FEIE 330",
    audience: "US taxpayers claiming the Foreign Earned Income Exclusion",
    value: best.days,
    threshold: FEIE_REQUIRED_DAYS,
    unit: "full days abroad",
    status,
    higherIsBetter: true,
    headline:
      spans.length === 0
        ? "No trips recorded outside your home country yet."
        : best.days >= FEIE_REQUIRED_DAYS
          ? `${best.days} full days abroad in your best 12-month window — at or above the 330-day test.`
          : `${best.days} full days abroad in your best 12-month window. The test looks for 330; you are ${shortfall} short.`,
    convention:
      "Full days only: the day you arrive does not count, and days in international waters or airspace count toward nothing. The 12-month window rolls — it need not match a calendar or tax year.",
    detail:
      spans.length > 0
        ? `Best window starts ${fromDayIndex(best.start)}. Counted conservatively — travel days at the edges of each period abroad are excluded.`
        : undefined,
  };
}
