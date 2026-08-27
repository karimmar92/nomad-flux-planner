/**
 * City telemetry. The load-bearing case is the Schengen one.
 *
 * A per-country visa gauge on a Schengen city would tell somebody who has
 * spent 80 days in Spain that they have 90 days available in Portugal. They
 * have 10. That is the most expensive thing this page could get wrong, so it
 * is the first test here.
 */
import { describe, expect, it } from "vitest";
import {
  cityTelemetry,
  daysInCountry,
  gaugeStatus,
  leadGauge,
  taxGauge,
  visaGauge,
} from "./city-telemetry";
import type { City, Trip } from "./types";

const TODAY = "2026-08-27";

const trip = (cc: string, entry: string, exit: string | null): Trip => ({
  id: `${cc}${entry}`,
  country_code: cc,
  city_id: null,
  entry_date: entry,
  exit_date: exit,
  purpose: "tourist",
  notes: "",
});

/** Minimal city; only the fields the gauges read are meaningful. */
const makeCity = (over: Partial<City> & { country_code: string }): City =>
  ({
    id: "x",
    city: "X",
    country: "X",
    region: "R",
    lat: 0,
    lng: 0,
    local_currency: "EUR",
    costs: {},
    scores: { internetSpeedMbps: 100 },
    visa: {
      ruleType: "SCHENGEN_90_180",
      touristDays: 90,
      extensionDays: 0,
      windowDays: 180,
      nomadVisa: { exists: false },
    },
    tax: { residencyTriggerDays: 183, taxYear: "January-December" },
    ...over,
  }) as unknown as City;

const PT = makeCity({ country_code: "PT", country: "Portugal" });
const GE = makeCity({
  country_code: "GE",
  country: "Georgia",
  visa: {
    ruleType: "FIXED_PER_ENTRY",
    touristDays: 365,
    extensionDays: 0,
    windowDays: 365,
    nomadVisa: { exists: false },
  },
} as unknown as Partial<City> & { country_code: string });

describe("visaGauge — Schengen is area-wide", () => {
  it("counts days spent in OTHER Schengen countries against this city", () => {
    // 80 days in Spain leaves 10 in Portugal, not 90.
    const g = visaGauge(PT, [trip("ES", "2026-06-01", "2026-08-19")], TODAY);
    expect(g.used).toBe(80);
    expect(g.limit).toBe(90);
  });

  it("says so in the basis line, so the number is checkable", () => {
    expect(visaGauge(PT, [], TODAY).basis).toContain("29 Schengen");
  });

  it("clamps the bar at 100% on an overstay rather than overflowing", () => {
    const g = visaGauge(PT, [trip("PT", "2026-01-01", null)], TODAY);
    expect(g.used).toBeGreaterThan(90);
    expect(g.pct).toBe(100);
    expect(g.status).toBe("exceeded");
  });
});

describe("visaGauge — non-Schengen is per country", () => {
  it("ignores Schengen days entirely", () => {
    const g = visaGauge(
      GE,
      [trip("ES", "2026-06-01", "2026-08-19"), trip("GE", "2026-08-01", "2026-08-27")],
      TODAY,
    );
    expect(g.used).toBe(27);
    expect(g.limit).toBe(365);
  });
});

describe("zero state", () => {
  it("shows 0 of the limit rather than hiding the gauge", () => {
    // The answer a first-time visitor came for, and it teaches the meter.
    const g = visaGauge(PT, [], TODAY);
    expect(g).toMatchObject({ used: 0, limit: 90, pct: 0, status: "ok" });
  });
});

describe("gaugeStatus bands match the alert bands", () => {
  it("ok below 90 percent", () => expect(gaugeStatus(80, 100)).toBe("ok"));
  it("watch from 90 percent", () => expect(gaugeStatus(90, 100)).toBe("watch"));
  it("at_limit on equality", () => expect(gaugeStatus(100, 100)).toBe("at_limit"));
  it("exceeded above", () => expect(gaugeStatus(101, 100)).toBe("exceeded"));
  it("never divides by a zero limit", () => expect(gaugeStatus(5, 0)).toBe("ok"));
});

describe("leadGauge", () => {
  it("leads with tax in Georgia, where 183 fills before 365", () => {
    // Leading with visa by default would bury the limit that actually binds.
    const t = cityTelemetry(GE, [trip("GE", "2026-01-01", null)], TODAY);
    expect(leadGauge(t.gauges)?.id).toBe("tax");
  });

  it("returns null with no gauges", () => {
    expect(leadGauge([])).toBeNull();
  });
});

describe("presence", () => {
  it("treats an open trip covering today as being here", () => {
    expect(cityTelemetry(PT, [trip("PT", "2026-08-01", null)], TODAY).currentlyHere).toBe(true);
  });

  it("does not treat a finished past trip as being here", () => {
    expect(cityTelemetry(PT, [trip("PT", "2026-01-01", "2026-02-01")], TODAY).currentlyHere).toBe(
      false,
    );
  });
});

describe("daysInCountry", () => {
  it("counts an overlapping day once", () => {
    // Same bug class as the exported PDF: summing would give 54, not 27.
    const dup = [trip("GE", "2026-08-01", "2026-08-27"), trip("GE", "2026-08-01", "2026-08-27")];
    expect(daysInCountry(dup, "GE", TODAY)).toBe(27);
  });

  it("never counts past today for an open trip", () => {
    const days = daysInCountry([trip("GE", "2026-08-01", null)], "GE", TODAY);
    expect(days).toBe(27);
  });
});

describe("taxGauge", () => {
  it("uses the country's own threshold", () => {
    expect(taxGauge(PT, [], TODAY).limit).toBe(183);
  });
});
