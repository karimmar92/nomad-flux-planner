import { describe, expect, it } from "vitest";
import {
  BORDER_RUN_TRIGGER_DAYS,
  buildBorderRunPlan,
  distanceKm,
  exitDeadline,
  rankExitOptions,
} from "./border-run";
import { getCity } from "./cities";
import { SCHENGEN_COUNTRIES } from "./schengen";
import type { Trip } from "./types";

const trip = (over: Partial<Trip>): Trip => ({
  id: crypto.randomUUID(),
  country_code: "PT",
  city_id: "lisbon-pt",
  entry_date: "2026-06-01",
  exit_date: null,
  purpose: "tourist",
  notes: "",
  ...over,
});

const lisbon = getCity("lisbon-pt")!;
const bangkok = getCity("bangkok-th")!;

describe("exitDeadline", () => {
  it("returns a Schengen deadline 90 days after a clean entry", () => {
    const d = exitDeadline([trip({ entry_date: "2026-06-01" })], "2026-08-04");
    expect(d?.reason).toBe("schengen");
    // Entry day counts, so day 90 is 2026-08-29.
    expect(d?.lastLegalDay).toBe("2026-08-29");
    expect(d?.daysLeft).toBe(25);
    expect(d?.overstayed).toBe(false);
  });

  it("shortens the deadline when earlier Schengen days are still in the window", () => {
    const clean = exitDeadline([trip({ entry_date: "2026-07-15" })], "2026-08-04");
    const loaded = exitDeadline(
      [
        trip({ entry_date: "2026-07-15" }),
        trip({ country_code: "ES", city_id: null, entry_date: "2026-04-01", exit_date: "2026-04-30" }),
      ],
      "2026-08-04",
    );
    expect(loaded!.daysLeft).toBeLessThan(clean!.daysLeft);
  });

  it("uses the per-entry allowance outside Schengen", () => {
    const d = exitDeadline(
      [trip({ country_code: "TH", city_id: "bangkok-th", entry_date: "2026-08-01" })],
      "2026-08-04",
    );
    expect(d?.reason).toBe("country_limit");
    // 60 tourist days + 30 extension, entry day inclusive.
    expect(d?.lastLegalDay).toBe("2026-10-29");
  });

  it("ignores residence trips and returns null with no open trip", () => {
    expect(exitDeadline([trip({ purpose: "residence" })], "2026-08-04")).toBeNull();
    expect(
      exitDeadline([trip({ entry_date: "2026-01-01", exit_date: "2026-01-10" })], "2026-08-04"),
    ).toBeNull();
  });

  it("flags an overstay", () => {
    const d = exitDeadline([trip({ entry_date: "2026-01-01" })], "2026-08-04");
    expect(d?.overstayed).toBe(true);
    expect(d?.daysLeft).toBe(0);
  });
});

describe("rankExitOptions", () => {
  const options = rankExitOptions({
    origin: lisbon,
    trips: [trip({ entry_date: "2026-06-01" })],
    today: "2026-08-04",
    departOn: "2026-08-29",
    avoidSchengen: true,
    monthlyIncomeUsd: 5000,
  });

  it("puts non-Schengen destinations ahead of Schengen ones", () => {
    const firstSchengen = options.findIndex((o) => SCHENGEN_COUNTRIES.has(o.city.country_code));
    const lastNonSchengen = options.map((o) => o.nonSchengen).lastIndexOf(true);
    expect(firstSchengen).toBeGreaterThan(lastNonSchengen);
  });

  it("surfaces Belgrade and Tirana strongly for a Schengen exit", () => {
    const top = options.slice(0, 6).map((o) => o.city.id);
    expect(top).toContain("belgrade-rs");
    expect(top).toContain("tirana-al");
  });

  it("never ranks the origin against itself", () => {
    expect(options.some((o) => o.city.id === lisbon.id)).toBe(false);
  });

  it("scores each option out of 100 with a matching breakdown", () => {
    for (const o of options) {
      const sum = o.breakdown.reduce((n, b) => n + b.points, 0);
      expect(sum).toBe(o.score);
      expect(o.score).toBeLessThanOrEqual(100);
    }
  });

  it("marks overland neighbours as overland and everything else as air", () => {
    const fromBelgrade = rankExitOptions({
      origin: getCity("belgrade-rs")!,
      trips: [],
      today: "2026-08-04",
      departOn: "2026-08-04",
      avoidSchengen: false,
      monthlyIncomeUsd: null,
    });
    expect(fromBelgrade.find((o) => o.city.id === "budapest-hu")?.mode).toBe("overland");
    expect(fromBelgrade.find((o) => o.city.id === "bangkok-th")?.mode).toBe("air");
  });

  it("resolves nomad-visa eligibility against stated income", () => {
    const poor = rankExitOptions({
      origin: bangkok,
      trips: [],
      today: "2026-08-04",
      departOn: "2026-08-04",
      avoidSchengen: false,
      monthlyIncomeUsd: 500,
    });
    const lis = poor.find((o) => o.city.id === "lisbon-pt")!;
    expect(lis.nomadVisaQualified).toBe(false);
  });
});

describe("buildBorderRunPlan", () => {
  const profile = { monthly_income_usd: 5000, home_city_id: "lisbon-pt" };

  it("stays silent when the deadline is far away", () => {
    expect(
      buildBorderRunPlan({ trips: [trip({ entry_date: "2026-08-01" })], today: "2026-08-04", profile }),
    ).toBeNull();
  });

  it("fires inside the trigger window", () => {
    const plan = buildBorderRunPlan({
      trips: [trip({ entry_date: "2026-06-01" })],
      today: "2026-08-04",
      profile,
    });
    expect(plan).not.toBeNull();
    expect(plan!.deadline.daysLeft).toBeLessThanOrEqual(BORDER_RUN_TRIGGER_DAYS);
    expect(plan!.origin.id).toBe("lisbon-pt");
    expect(plan!.options.length).toBeGreaterThan(5);
  });

  it("never fires without a trip", () => {
    expect(buildBorderRunPlan({ trips: [], today: "2026-08-04", profile })).toBeNull();
  });
});

describe("distanceKm", () => {
  it("is symmetric and roughly right", () => {
    const a = distanceKm(lisbon, getCity("athens-gr")!);
    expect(a).toBe(distanceKm(getCity("athens-gr")!, lisbon));
    expect(a).toBeGreaterThan(2600);
    expect(a).toBeLessThan(3200);
  });
});
