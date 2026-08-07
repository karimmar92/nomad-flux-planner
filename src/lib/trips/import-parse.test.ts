import { describe, expect, it } from "vitest";
import { findDuplicates, findOverlaps, parseDate, parseTripText } from "./import-parse";
import type { Trip } from "@/lib/types";

describe("parseDate", () => {
  it("reads the formats people actually paste", () => {
    expect(parseDate("2026-03-14")?.iso).toBe("2026-03-14");
    expect(parseDate("14 March 2026")?.iso).toBe("2026-03-14");
    expect(parseDate("March 14 2026")?.iso).toBe("2026-03-14");
    expect(parseDate("14 Mar 26")?.iso).toBe("2026-03-14");
    expect(parseDate("14.03.2026")?.iso).toBe("2026-03-14");
    expect(parseDate("14/03/2026")?.iso).toBe("2026-03-14");
  });

  it("rejects impossible dates instead of rolling them over", () => {
    // new Date(2026, 1, 31) silently becomes 3 March. In a compliance tool a
    // silently shifted date is worse than a rejected one.
    expect(parseDate("2026-02-31")).toBeNull();
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("not a date")).toBeNull();
    expect(parseDate("")).toBeNull();
  });

  it("flags dates that could be read either way", () => {
    expect(parseDate("03/04/2026")?.ambiguous).toBe(true); // 3 Apr or 4 Mar
    expect(parseDate("14/03/2026")?.ambiguous).toBe(false); // 14 cannot be a month
    expect(parseDate("2026-03-04")?.ambiguous).toBe(false); // ISO is unambiguous
  });
});

describe("parseTripText", () => {
  it("parses separators, purposes and open-ended stays", () => {
    const r = parseTripText(
      [
        "Portugal, 2026-01-10, 2026-03-15",
        "Thailand\t14/01/2026\t02/02/2026\ttourist",
        "Bangkok, 3 Mar 2026 - 20 Mar 2026",
        "Spain, 2026-05-01, still here",
        "France; 01.02.2026; 20.02.2026; residence",
      ].join("\n"),
    );
    expect(r.failures).toHaveLength(0);
    expect(r.rows.map((x) => x.country_code)).toEqual(["PT", "TH", "TH", "ES", "FR"]);
    expect(r.rows[3]!.exit_date).toBeNull();
    expect(r.rows[4]!.purpose).toBe("residence");
  });

  it("handles a comma inside a month-name date", () => {
    // "March 14, 2026" — the comma is both part of the date and the field
    // separator, which split the year into its own column.
    const r = parseTripText("Germany, March 14, 2026, 2026-03-20");
    expect(r.failures).toHaveLength(0);
    expect(r.rows[0]).toMatchObject({
      country_code: "DE",
      entry_date: "2026-03-14",
      exit_date: "2026-03-20",
    });
  });

  it("reports bad rows instead of dropping them", () => {
    const r = parseTripText(
      ["Atlantis, 2026-01-01", "Vietnam, 2026-06-10, 2026-06-01", "Portugal"].join("\n"),
    );
    expect(r.rows).toHaveLength(0);
    expect(r.failures).toHaveLength(3);
    expect(r.failures[0]!.reason).toMatch(/not recognised/);
    expect(r.failures[1]!.reason).toMatch(/before the entry date/);
    expect(r.failures[2]!.reason).toMatch(/at least a country and one date/);
    // The original text comes back so the user can fix it.
    expect(r.failures[0]!.raw).toBe("Atlantis, 2026-01-01");
  });

  it("skips blank lines and a header row", () => {
    const r = parseTripText("Country, Entry, Exit\n\nPortugal, 2026-01-10, 2026-02-01\n");
    expect(r.rows).toHaveLength(1);
    expect(r.failures).toHaveLength(0);
  });

  it("resolves city names to their country", () => {
    const r = parseTripText("Lisbon, 2026-01-10, 2026-02-01");
    expect(r.rows[0]!.country_code).toBe("PT");
  });
});

describe("safety checks before committing", () => {
  const trip = (over: Partial<Trip>): Trip => ({
    id: crypto.randomUUID(),
    country_code: "PT",
    city_id: null,
    entry_date: "2026-01-10",
    exit_date: null,
    purpose: "tourist",
    notes: "",
    ...over,
  });

  it("flags rows already stored, so a re-paste cannot double the day count", () => {
    const r = parseTripText("Portugal, 2026-01-10, 2026-03-15\nSpain, 2026-04-01, 2026-04-10");
    const dupes = findDuplicates(r.rows, [trip({})]);
    expect(dupes.has(1)).toBe(true);
    expect(dupes.has(2)).toBe(false);
  });

  it("flags being in two countries at once", () => {
    const r = parseTripText("Portugal, 2026-01-10, 2026-03-15\nThailand, 2026-01-14, 2026-02-02");
    expect([...findOverlaps(r.rows)].sort()).toEqual([1, 2]);
  });
});
