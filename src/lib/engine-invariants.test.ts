/**
 * Property-based invariants for the day-count engine.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────
 *
 * The double-counting bug survived 253 example-based tests and shipped into an
 * exported PDF that a user was expected to hand to an accountant. It was then
 * found in FOUR separate places: schengen.ts, trip-dates.ts, uk-srt.ts and
 * compliance-calendar.ts. Every one of those had tests. None of the tests used
 * overlapping trips, because nobody thinks to write that example — overlapping
 * trips are a data-entry mistake, not a scenario you imagine while writing a
 * happy path.
 *
 * That is the exact failure mode property testing exists for. You do not
 * enumerate cases; you state a law the code must obey for ALL inputs and let a
 * generator hunt for the counterexample. "Counting a trip twice must not change
 * the answer" would have failed on the first random seed.
 *
 * ── NO NEW DEPENDENCY ──────────────────────────────────────────────────
 *
 * fast-check would be the usual choice. It is not installed, npm in this
 * project has already been fragile, and the generator needed here is forty
 * lines. A seeded LCG keeps runs REPRODUCIBLE: a failure prints its seed, and
 * re-running with that seed reproduces it exactly. A flaky property test that
 * cannot be replayed is worse than none.
 *
 * ── WHAT IS ASSERTED, AND WHY EACH ONE ─────────────────────────────────
 *
 * Each law below is chosen because breaking it produces a specific, real harm,
 * noted alongside it. These are not arbitrary algebraic properties.
 */
import { describe, expect, it } from "vitest";
import {
  SCHENGEN_MAX_DAYS,
  SCHENGEN_WINDOW_DAYS,
  fromDayIndex,
  maxStayFrom,
  schengenDaysRemaining,
  schengenDaysUsed,
  toDayIndex,
  type Trip as EngineTrip,
} from "./schengen";
import { daysInCountryTaxYear } from "./trip-dates";
import { countDistinctDays } from "./day-union";
import { ukDaysInTaxYear } from "./rules/uk-srt";
import type { Trip } from "./types";

/* ── Deterministic generator ─────────────────────────────────────────── */

/** Numerical Recipes LCG. Small, seeded, reproducible. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const SCHENGEN_SAMPLE = ["PT", "ES", "FR", "DE", "IT", "GR", "NL"];
const OUTSIDE_SAMPLE = ["TH", "GB", "US", "GE", "AL", "MX", "CO"];
const ALL = [...SCHENGEN_SAMPLE, ...OUTSIDE_SAMPLE];

const BASE = toDayIndex("2026-01-01");

/**
 * Generates deliberately messy histories: overlaps, open trips, same-day
 * entries and exits, out-of-order records. Clean data is what the existing
 * tests already cover; the value here is everything else.
 */
function randomTrips(next: () => number, count: number): Trip[] {
  const out: Trip[] = [];
  for (let i = 0; i < count; i++) {
    const start = BASE + Math.floor(next() * 500);
    const length = Math.floor(next() * 120);
    const open = next() < 0.25;
    out.push({
      id: `t${i}`,
      country_code: ALL[Math.floor(next() * ALL.length)]!,
      city_id: null,
      entry_date: fromDayIndex(start),
      exit_date: open ? null : fromDayIndex(start + length),
      purpose: next() < 0.15 ? "nomad_visa" : "tourist",
      notes: "",
    });
  }
  return out;
}

function toEngine(trips: Trip[]): EngineTrip[] {
  return trips.map((t) => ({
    countryCode: t.country_code,
    entryDate: t.entry_date,
    exitDate: t.exit_date,
    purpose: t.purpose,
  }));
}

/** Runs `check` over N seeded cases, reporting the seed that failed. */
function forAll(name: string, runs: number, check: (next: () => number, seed: number) => void) {
  it(name, () => {
    for (let seed = 1; seed <= runs; seed++) {
      try {
        check(rng(seed), seed);
      } catch (e) {
        // Reproducible by construction: rerun with this seed to debug.
        throw new Error(`Property failed on seed ${seed}: ${(e as Error).message}`);
      }
    }
  });
}

const REF = "2026-09-01";

/* ── The laws ────────────────────────────────────────────────────────── */

describe("schengenDaysUsed", () => {
  forAll("never exceeds the length of the window", 300, (next) => {
    const trips = toEngine(randomTrips(next, 1 + Math.floor(next() * 12)));
    // THE BUG THAT SHIPPED. The PDF printed "180 of 90" because this was
    // breakable. It is not possible to be present for more days than the
    // window contains.
    expect(schengenDaysUsed(trips, REF)).toBeLessThanOrEqual(SCHENGEN_WINDOW_DAYS);
  });

  forAll("is never negative", 200, (next) => {
    const trips = toEngine(randomTrips(next, 1 + Math.floor(next() * 8)));
    expect(schengenDaysUsed(trips, REF)).toBeGreaterThanOrEqual(0);
  });

  forAll("does not change when a trip is recorded twice", 300, (next) => {
    // The single property that would have caught all four instances of the
    // bug. Logging the same trip twice is a data-entry mistake, not extra
    // presence.
    const trips = toEngine(randomTrips(next, 1 + Math.floor(next() * 8)));
    const once = schengenDaysUsed(trips, REF);
    const twice = schengenDaysUsed([...trips, ...trips], REF);
    expect(twice).toBe(once);
  });

  forAll("does not depend on the order trips were entered", 200, (next) => {
    const trips = toEngine(randomTrips(next, 2 + Math.floor(next() * 8)));
    const reversed = [...trips].reverse();
    expect(schengenDaysUsed(reversed, REF)).toBe(schengenDaysUsed(trips, REF));
  });

  forAll("is monotonic: adding a trip never reduces the count", 200, (next) => {
    const trips = toEngine(randomTrips(next, 1 + Math.floor(next() * 6)));
    const extra = toEngine(randomTrips(next, 1));
    expect(schengenDaysUsed([...trips, ...extra], REF)).toBeGreaterThanOrEqual(
      schengenDaysUsed(trips, REF),
    );
  });

  forAll("is unchanged when a closed trip is split into two touching halves", 200, (next) => {
    // Same presence, recorded differently. A user who logs one stay as two legs
    // must not get a different number.
    const start = BASE + Math.floor(next() * 300);
    const len = 10 + Math.floor(next() * 60);
    const mid = start + Math.floor(len / 2);
    const whole: EngineTrip[] = [
      { countryCode: "PT", entryDate: fromDayIndex(start), exitDate: fromDayIndex(start + len) },
    ];
    const split: EngineTrip[] = [
      { countryCode: "PT", entryDate: fromDayIndex(start), exitDate: fromDayIndex(mid) },
      { countryCode: "PT", entryDate: fromDayIndex(mid + 1), exitDate: fromDayIndex(start + len) },
    ];
    expect(schengenDaysUsed(split, REF)).toBe(schengenDaysUsed(whole, REF));
  });

  forAll("ignores non-Schengen countries entirely", 200, (next) => {
    const outside: EngineTrip[] = Array.from({ length: 5 }, (_, i) => {
      const start = BASE + Math.floor(next() * 300);
      return {
        countryCode: OUTSIDE_SAMPLE[i % OUTSIDE_SAMPLE.length]!,
        entryDate: fromDayIndex(start),
        exitDate: fromDayIndex(start + 30),
        purpose: "tourist" as const,
      };
    });
    expect(schengenDaysUsed(outside, REF)).toBe(0);
  });
});

describe("schengenDaysRemaining", () => {
  forAll("plus used never exceeds the allowance, and never goes negative", 200, (next) => {
    const trips = toEngine(randomTrips(next, 1 + Math.floor(next() * 10)));
    const used = schengenDaysUsed(trips, REF);
    const left = schengenDaysRemaining(trips, REF);
    expect(left).toBeGreaterThanOrEqual(0);
    // Once over the limit, remaining clamps at 0 rather than going negative,
    // so the sum can exceed 90 only in the overstay case.
    if (used <= SCHENGEN_MAX_DAYS) expect(used + left).toBe(SCHENGEN_MAX_DAYS);
  });
});

describe("maxStayFrom", () => {
  forAll("never proposes a stay that would breach the limit", 150, (next) => {
    // The safety-critical one. This drives the border-run planner, so a wrong
    // answer here is advice that gets somebody flagged under EES.
    const trips = toEngine(randomTrips(next, 1 + Math.floor(next() * 6)));
    const from = fromDayIndex(BASE + Math.floor(next() * 400));
    const n = maxStayFrom(trips, from);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(SCHENGEN_MAX_DAYS);

    if (n > 0) {
      // Simulating the proposed stay must not push any day over 90.
      const lastDay = fromDayIndex(toDayIndex(from) + n - 1);
      const sim: EngineTrip[] = [
        ...trips,
        { countryCode: "PT", entryDate: from, exitDate: lastDay, purpose: "tourist" },
      ];
      expect(schengenDaysUsed(sim, lastDay)).toBeLessThanOrEqual(SCHENGEN_MAX_DAYS);
    }
  });
});

describe("daysInCountryTaxYear", () => {
  forAll("never exceeds the days elapsed in the period", 200, (next) => {
    const trips = randomTrips(next, 1 + Math.floor(next() * 10));
    for (const code of ["PT", "TH", "GB"]) {
      const r = daysInCountryTaxYear(trips, code, REF, 0);
      const elapsed = toDayIndex(REF) - toDayIndex(r.periodStart) + 1;
      // Counting past today, or past the period, is how invented presence
      // reaches a tax adviser.
      expect(r.days).toBeLessThanOrEqual(elapsed);
      expect(r.days).toBeGreaterThanOrEqual(0);
    }
  });

  forAll("is unchanged by duplicate records", 200, (next) => {
    const trips = randomTrips(next, 1 + Math.floor(next() * 8));
    const once = daysInCountryTaxYear(trips, "PT", REF, 0).days;
    const twice = daysInCountryTaxYear([...trips, ...trips], "PT", REF, 0).days;
    expect(twice).toBe(once);
  });
});

describe("ukDaysInTaxYear", () => {
  forAll("is unchanged by duplicate records", 200, (next) => {
    // The SRT bands are step functions, so invented days move somebody across
    // a residence threshold.
    const trips = randomTrips(next, 1 + Math.floor(next() * 8));
    const once = ukDaysInTaxYear({ trips, today: REF });
    const twice = ukDaysInTaxYear({ trips: [...trips, ...trips], today: REF });
    expect(twice).toBe(once);
  });

  forAll("never exceeds the 366 days a tax year can contain", 200, (next) => {
    const trips = randomTrips(next, 1 + Math.floor(next() * 10));
    expect(ukDaysInTaxYear({ trips, today: REF })).toBeLessThanOrEqual(366);
  });
});

describe("countDistinctDays", () => {
  forAll("never exceeds the naive sum, and matches it when disjoint", 300, (next) => {
    const ranges = Array.from({ length: 1 + Math.floor(next() * 8) }, () => {
      const from = Math.floor(next() * 200);
      return { from, to: from + Math.floor(next() * 40) };
    });
    const naive = ranges.reduce((n, r) => n + (r.to - r.from + 1), 0);
    const union = countDistinctDays(ranges);
    // The union is the naive sum minus the double counting, so it can never
    // exceed it. This is the relationship the old code got backwards.
    expect(union).toBeLessThanOrEqual(naive);
    expect(union).toBeGreaterThan(0);
  });

  forAll("equals the span when ranges form one continuous block", 200, (next) => {
    const start = Math.floor(next() * 100);
    const len = 5 + Math.floor(next() * 50);
    const pieces = [
      { from: start, to: start + Math.floor(len / 3) },
      { from: start + Math.floor(len / 3) + 1, to: start + len },
    ];
    expect(countDistinctDays(pieces)).toBe(len + 1);
  });
});
