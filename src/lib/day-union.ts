/**
 * Counting days of presence, once each.
 *
 * ── THE BUG THIS FIXES, AND WHY IT MATTERED ────────────────────────────
 *
 * Both day counters summed each trip independently:
 *
 *     for (const trip of trips) days += to - from + 1;
 *
 * That is correct only while trips never overlap. They overlap constantly in
 * real records: two open trips logged for the same country, a forgotten exit
 * date, an arrival logged before the previous departure. Each overlapping day
 * was then counted once per trip.
 *
 * The exported presence record showed it plainly. A user who entered Portugal
 * on 16 April, logged a second open Portugal trip on 23 June, and generated the
 * report on 17 August got:
 *
 *     Portugal  180 days     (124 + 56, two overlapping open trips)
 *
 * They had been in the country for at most 124 days. The Schengen summary
 * inherited the same error and printed "180 of 90", which is arithmetically
 * impossible and visible to anyone reading it.
 *
 * For a document whose entire purpose is to be handed to a tax adviser or
 * produced in an audit, this is the worst class of defect. It is not a rounding
 * difference: it invents presence in a country, in the direction that creates
 * tax liability, and an auditor who spots one impossible number stops trusting
 * the rest of the document.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────
 *
 * A day of presence is a day. If three overlapping records claim the same
 * Tuesday, that is one Tuesday. Everything here counts the UNION of day
 * indices, never the sum of interval lengths.
 *
 * Note that schengen.ts already had this right in `buildDayIndex`, which marks
 * a byte per day and therefore cannot double count. Two implementations of one
 * idea existed in the same file and only one was correct — which is the actual
 * lesson, and why this now lives in one place that both call.
 */

/** Half-open on neither end: both `from` and `to` are inclusive day indices. */
export type DayRange = { from: number; to: number };

/**
 * Merge overlapping and touching ranges into a minimal disjoint set.
 *
 * Touching ranges are merged too: [1,5] and [6,9] become [1,9]. They describe
 * continuous presence, and keeping them apart would only invite an off-by-one
 * somewhere downstream.
 */
export function mergeRanges(ranges: DayRange[]): DayRange[] {
  const valid = ranges.filter((r) => r.from <= r.to).sort((a, b) => a.from - b.from);
  const out: DayRange[] = [];

  for (const r of valid) {
    const last = out[out.length - 1];
    if (last && r.from <= last.to + 1) {
      // Overlapping or adjacent: extend rather than append.
      if (r.to > last.to) last.to = r.to;
    } else {
      out.push({ from: r.from, to: r.to });
    }
  }

  return out;
}

/** Total distinct days covered by these ranges. */
export function countDistinctDays(ranges: DayRange[]): number {
  return mergeRanges(ranges).reduce((n, r) => n + (r.to - r.from + 1), 0);
}

/**
 * The overlaps that were being double counted, so they can be reported.
 *
 * Silently fixing the number is not enough. If somebody has two open trips to
 * the same country, the record itself is wrong and they need to correct it —
 * the report should say so rather than quietly produce a smaller number than
 * last time with no explanation. Returned as pairs of indices into the input.
 */
export function findOverlaps(ranges: DayRange[]): { a: number; b: number; days: number }[] {
  const out: { a: number; b: number; days: number }[] = [];
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      const a = ranges[i]!;
      const b = ranges[j]!;
      const from = Math.max(a.from, b.from);
      const to = Math.min(a.to, b.to);
      if (from <= to) out.push({ a: i, b: j, days: to - from + 1 });
    }
  }
  return out;
}
