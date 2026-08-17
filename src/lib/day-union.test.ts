/**
 * Day counting, including the exact case that produced a wrong exported PDF.
 *
 * The report for 2026 showed Portugal at 180 days from two overlapping open
 * trips (16 April and 23 June, neither with an exit, generated 17 August).
 * Real presence was at most 124 days. The Schengen section inherited it and
 * printed "180 of 90".
 *
 * These figures are reproduced literally below, because a regression here is
 * not a cosmetic bug: it invents presence in the direction that creates tax
 * liability, inside a document handed to advisers and auditors.
 */
import { describe, expect, it } from "vitest";
import { countDistinctDays, findOverlaps, mergeRanges } from "./day-union";
import { schengenDaysUsed, toDayIndex, type Trip as EngineTrip } from "./schengen";
import { daysInCountryTaxYear } from "./trip-dates";
import type { Trip } from "./types";

describe("mergeRanges", () => {
  it("leaves disjoint ranges alone", () => {
    expect(
      mergeRanges([
        { from: 1, to: 3 },
        { from: 10, to: 12 },
      ]),
    ).toEqual([
      { from: 1, to: 3 },
      { from: 10, to: 12 },
    ]);
  });

  it("merges overlapping ranges", () => {
    expect(
      mergeRanges([
        { from: 1, to: 10 },
        { from: 5, to: 20 },
      ]),
    ).toEqual([{ from: 1, to: 20 }]);
  });

  it("merges adjacent ranges, because they describe continuous presence", () => {
    expect(
      mergeRanges([
        { from: 1, to: 5 },
        { from: 6, to: 9 },
      ]),
    ).toEqual([{ from: 1, to: 9 }]);
  });

  it("absorbs a range fully inside another", () => {
    expect(
      mergeRanges([
        { from: 1, to: 100 },
        { from: 40, to: 50 },
      ]),
    ).toEqual([{ from: 1, to: 100 }]);
  });

  it("does not care about input order", () => {
    expect(
      mergeRanges([
        { from: 50, to: 60 },
        { from: 1, to: 55 },
      ]),
    ).toEqual([{ from: 1, to: 60 }]);
  });

  it("drops inverted ranges rather than producing negative days", () => {
    expect(mergeRanges([{ from: 10, to: 5 }])).toEqual([]);
  });
});

describe("countDistinctDays", () => {
  it("counts both endpoints", () => {
    expect(countDistinctDays([{ from: 0, to: 0 }])).toBe(1);
    expect(countDistinctDays([{ from: 0, to: 9 }])).toBe(10);
  });

  it("counts an overlapping day once", () => {
    // The whole point. Naive summing gives 10 + 16 = 26; the union is 20.
    expect(
      countDistinctDays([
        { from: 1, to: 10 },
        { from: 5, to: 20 },
      ]),
    ).toBe(20);
  });

  it("handles three-way overlap", () => {
    expect(
      countDistinctDays([
        { from: 1, to: 10 },
        { from: 1, to: 10 },
        { from: 1, to: 10 },
      ]),
    ).toBe(10);
  });

  it("is zero for no ranges", () => {
    expect(countDistinctDays([])).toBe(0);
  });
});

describe("findOverlaps", () => {
  it("reports the overlapping pair and how many days they share", () => {
    const found = findOverlaps([
      { from: 1, to: 10 },
      { from: 5, to: 20 },
    ]);
    expect(found).toEqual([{ a: 0, b: 1, days: 6 }]);
  });

  it("reports nothing for clean records", () => {
    expect(
      findOverlaps([
        { from: 1, to: 4 },
        { from: 5, to: 9 },
      ]),
    ).toEqual([]);
  });
});

describe("the exported presence record for 2026", () => {
  // Reproduced verbatim from the PDF that surfaced this.
  const TODAY = "2026-08-17";
  const trip = (country: string, entry: string): Trip => ({
    id: `${country}-${entry}`,
    country_code: country,
    city_id: null,
    entry_date: entry,
    exit_date: null,
    purpose: "tourist",
    notes: "",
  });

  const trips: Trip[] = [
    trip("PT", "2026-04-16"),
    trip("PT", "2026-06-23"),
    trip("TH", "2026-04-09"),
  ];

  it("counts Portugal as the real elapsed days, not the sum of two open trips", () => {
    // 16 April to 17 August inclusive. The PDF said 180.
    const expected = toDayIndex(TODAY) - toDayIndex("2026-04-16") + 1;
    expect(expected).toBe(124);
    expect(daysInCountryTaxYear(trips, "PT", TODAY, 0).days).toBe(124);
  });

  it("no longer reports more Schengen days than the window allows", () => {
    const engine: EngineTrip[] = trips.map((t) => ({
      countryCode: t.country_code,
      entryDate: t.entry_date,
      exitDate: t.exit_date,
      purpose: t.purpose,
    }));
    const used = schengenDaysUsed(engine, TODAY);
    // The PDF printed "180 of 90". Thailand is not Schengen, so only the
    // Portugal union counts.
    expect(used).toBe(124);
    // The invariant that should never have been breakable: you cannot use more
    // days than the window contains.
    expect(used).toBeLessThanOrEqual(180);
  });

  it("still reports the overstay, because 124 genuinely exceeds 90", () => {
    // Fixing the double count must not hide a real breach. This user IS over.
    const engine: EngineTrip[] = trips.map((t) => ({
      countryCode: t.country_code,
      entryDate: t.entry_date,
      exitDate: t.exit_date,
      purpose: t.purpose,
    }));
    expect(schengenDaysUsed(engine, TODAY)).toBeGreaterThan(90);
  });

  it("counts Thailand unchanged, since it had no overlap", () => {
    expect(daysInCountryTaxYear(trips, "TH", TODAY, 0).days).toBe(131);
  });
});
