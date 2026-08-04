import { describe, expect, it } from "vitest";
import {
  SCHENGEN_MAX_DAYS,
  maxStayFrom,
  nextFullNinetyDate,
  schengenDaysUsed,
  schengenStatus,
  toDayIndex,
  fromDayIndex,
  type Trip,
} from "./schengen";

/**
 * Verified against two opposing timezones (UTC+12 and UTC-7) with identical
 * results. Run the whole suite under both with `bun run test:tz`.
 */
const REF = "2026-08-04";

const trip = (
  countryCode: string,
  entryDate: string,
  exitDate: string | null,
  purpose?: Trip["purpose"],
): Trip => ({ countryCode, entryDate, exitDate, purpose });

/** A single trip that exactly exhausts the 90-day allowance on REF. */
const maxed: Trip[] = [trip("PT", "2026-05-07", "2026-08-04")];

describe("schengen 90/180 engine", () => {
  it("1. counts a maxed-out stay as exactly 90 days", () => {
    expect(schengenDaysUsed(maxed, REF)).toBe(90);
  });

  it("2. reports zero days remaining when maxed out", () => {
    expect(schengenStatus(maxed, REF).remaining).toBe(0);
  });

  it("3. leaving and re-entering does not reset the window", () => {
    expect(maxStayFrom(maxed, "2026-08-05")).toBe(0);
  });

  it("4. counts the tail of an older trip still inside the window", () => {
    const trips = [
      trip("PT", "2026-01-01", "2026-02-14"),
      trip("ES", "2026-05-25", "2026-07-08"),
    ];
    expect(schengenDaysUsed(trips, REF)).toBe(54);
  });

  it("5. counts only the portion of a trip inside the window", () => {
    expect(schengenDaysUsed([trip("PT", "2026-01-20", "2026-02-20")], REF)).toBe(15);
  });

  it("6. a same-day entry and exit burns a full day", () => {
    expect(schengenDaysUsed([trip("PT", "2026-08-04", "2026-08-04")], REF)).toBe(1);
  });

  it("7. an open trip counts through the reference date", () => {
    expect(schengenDaysUsed([trip("PT", "2026-07-26", null)], REF)).toBe(10);
  });

  it("8. is order independent", () => {
    const trips = [
      trip("PT", "2026-01-01", "2026-02-14"),
      trip("ES", "2026-05-25", "2026-07-08"),
      trip("GR", "2026-03-01", "2026-03-10"),
    ];
    const base = schengenDaysUsed(trips, REF);
    const shuffles = [
      [trips[2]!, trips[0]!, trips[1]!],
      [trips[1]!, trips[2]!, trips[0]!],
      [...trips].reverse(),
    ];
    for (const s of shuffles) expect(schengenDaysUsed(s, REF)).toBe(base);
  });

  it("9. non-Schengen time neither adds nor refunds days", () => {
    const trips = [
      trip("PT", "2026-06-01", "2026-06-30"),
      trip("RS", "2026-07-01", "2026-07-31"),
      trip("ES", "2026-08-01", "2026-08-04"),
    ];
    expect(schengenDaysUsed(trips, REF)).toBe(34);
  });

  it("10. finds the earliest date a full 90 days is available again", () => {
    expect(nextFullNinetyDate(maxed, "2026-08-05")).toBe("2026-11-03");
  });

  it("11. a residence-permit trip does not consume the allowance", () => {
    expect(schengenDaysUsed([trip("PT", "2026-05-07", "2026-08-04", "residence")], REF)).toBe(0);
  });

  it("12. Ireland is EU but not Schengen", () => {
    expect(schengenDaysUsed([trip("IE", "2026-05-07", "2026-08-04")], REF)).toBe(0);
  });

  it("13. Switzerland is Schengen but not EU", () => {
    expect(schengenDaysUsed([trip("CH", "2026-08-01", "2026-08-04")], REF)).toBe(4);
  });

  it("14. status thresholds", () => {
    const forDays = (days: number): Trip[] => [
      trip("PT", fromDayIndex(toDayIndex(REF) - (days - 1)), REF),
    ];
    expect(schengenDaysUsed(forDays(8), REF)).toBe(8);
    expect(schengenStatus(forDays(8), REF).status).toBe("ok");
    expect(schengenStatus(forDays(69), REF).status).toBe("warning");
    expect(schengenStatus(forDays(83), REF).status).toBe("critical");
  });

  it("15. never exceeds 90 on any day of a maxStayFrom range", () => {
    const cases: Trip[][] = [
      [],
      maxed,
      [trip("PT", "2026-01-01", "2026-02-14"), trip("ES", "2026-05-25", "2026-07-08")],
      [trip("GR", "2026-06-01", "2026-06-30"), trip("RS", "2026-07-01", "2026-07-31")],
      [trip("PT", "2026-07-26", null)],
    ];
    for (const trips of cases) {
      const entry = "2026-08-10";
      const n = maxStayFrom(trips, entry);
      for (let k = 0; k < n; k++) {
        const day = fromDayIndex(toDayIndex(entry) + k);
        const sim: Trip[] = [...trips, trip("PT", entry, day)];
        expect(schengenDaysUsed(sim, day)).toBeLessThanOrEqual(SCHENGEN_MAX_DAYS);
      }
    }
  });

  it("day indices are timezone-independent", () => {
    expect(toDayIndex("2026-08-04")).toBe(Math.floor(Date.UTC(2026, 7, 4) / 86_400_000));
    expect(fromDayIndex(toDayIndex("2026-01-01"))).toBe("2026-01-01");
  });
});
