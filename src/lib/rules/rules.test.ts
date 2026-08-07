import { describe, expect, it } from "vitest";
import { evaluateAll, evaluateRule, RULE_ORDER } from "./index";
import { FEIE_REQUIRED_DAYS, bestWindow, foreignSpans } from "./feie";
import {
  ARRIVER_BANDS,
  LEAVER_BANDS,
  bandFor,
  evaluateUkSrt,
  ukDaysInTaxYear,
  ukTaxYearBounds,
} from "./uk-srt";
import type { Trip } from "@/lib/types";

const trip = (country: string, entry: string, exit: string | null): Trip => ({
  id: `${country}-${entry}`,
  country_code: country,
  city_id: null,
  entry_date: entry,
  exit_date: exit,
  purpose: "tourist",
  notes: "",
});

describe("FEIE 330-day physical presence test", () => {
  it("merges contiguous foreign trips so hopping between countries costs nothing", () => {
    // Portugal straight into Thailand: one continuous period abroad, so only
    // the two outer travel days are dropped, not four.
    const spans = foreignSpans({
      trips: [trip("PT", "2026-01-01", "2026-03-01"), trip("TH", "2026-03-02", "2026-05-01")],
      today: "2026-08-06",
      homeCountry: "US",
    });
    expect(spans).toHaveLength(1);
    expect(spans[0]!.from).toBeLessThan(spans[0]!.to);
  });

  it("excludes the home country from days abroad", () => {
    const spans = foreignSpans({
      trips: [trip("US", "2026-01-01", "2026-06-01")],
      today: "2026-08-06",
      homeCountry: "US",
    });
    expect(spans).toHaveLength(0);
  });

  it("counts a full year abroad as reaching the 330-day test", () => {
    const r = evaluateRule("feie", {
      trips: [
        trip("PT", "2025-09-01", "2026-01-15"),
        trip("TH", "2026-01-16", "2026-05-30"),
        trip("VN", "2026-06-01", "2026-08-01"),
      ],
      today: "2026-08-06",
      homeCountry: "US",
    });
    expect(r.value).toBeGreaterThanOrEqual(FEIE_REQUIRED_DAYS);
    expect(r.status).toBe("ok");
    expect(r.higherIsBetter).toBe(true);
  });

  it("counts UP toward a target, so being under is the problem", () => {
    const r = evaluateRule("feie", {
      trips: [trip("PT", "2026-01-01", "2026-04-01")],
      today: "2026-08-06",
      homeCountry: "US",
    });
    expect(r.value).toBeLessThan(FEIE_REQUIRED_DAYS);
    // "exceeded" here means "missed the target" — the shortfall case.
    expect(r.status).toBe("exceeded");
    expect(r.headline).toContain("short");
  });

  it("never counts an open trip into the future", () => {
    const r = evaluateRule("feie", {
      trips: [trip("TH", "2026-08-01", null)],
      today: "2026-08-06",
      homeCountry: "US",
    });
    expect(r.value).toBeLessThanOrEqual(6);
  });

  it("returns zero rather than throwing with no trips", () => {
    expect(bestWindow([])).toEqual({ start: 0, days: 0 });
  });
});

describe("UK Statutory Residence Test", () => {
  it("uses the UK tax year, 6 April to 5 April", () => {
    expect(ukTaxYearBounds("2026-08-06").start).toBe("2026-04-06");
    expect(ukTaxYearBounds("2026-03-01").start).toBe("2025-04-06");
    // Boundary: 5 April belongs to the previous year, 6 April starts the new.
    expect(ukTaxYearBounds("2026-04-05").start).toBe("2025-04-06");
    expect(ukTaxYearBounds("2026-04-06").start).toBe("2026-04-06");
  });

  it("counts only UK days, within the tax year", () => {
    const days = ukDaysInTaxYear({
      trips: [trip("GB", "2026-04-10", "2026-04-19"), trip("PT", "2026-05-01", "2026-05-30")],
      today: "2026-08-06",
    });
    expect(days).toBe(10);
  });

  it("engages the automatic UK test at 183 days", () => {
    const r = evaluateUkSrt({
      trips: [trip("GB", "2026-04-06", "2026-11-01")],
      today: "2026-12-01",
      ukTies: 0,
    });
    expect(r.value).toBeGreaterThanOrEqual(183);
    expect(r.headline).toContain("automatic UK test");
  });

  it("engages an automatic overseas test below the leaver threshold", () => {
    const r = evaluateUkSrt({
      trips: [trip("GB", "2026-04-10", "2026-04-18")],
      today: "2026-08-06",
      ukTies: 5,
      ukResidentRecently: true,
    });
    // Ties are irrelevant once an automatic test is met.
    expect(r.headline).toContain("automatic overseas test");
    expect(r.status).toBe("ok");
  });

  it("moves the threshold with the number of ties, and with arriver vs leaver", () => {
    const base = { trips: [trip("GB", "2026-04-10", "2026-06-20")], today: "2026-08-06" };
    // 72 days: leavers need 3 ties, arrivers need 4.
    expect(bandFor(72, true)!.tiesNeeded).toBe(3);
    expect(bandFor(72, false)!.tiesNeeded).toBe(4);

    expect(evaluateUkSrt({ ...base, ukTies: 2, ukResidentRecently: true }).status).not.toBe(
      "exceeded",
    );
    expect(evaluateUkSrt({ ...base, ukTies: 3, ukResidentRecently: true }).status).toBe("exceeded");
    // Same days, same ties, different history → different answer.
    expect(evaluateUkSrt({ ...base, ukTies: 3, ukResidentRecently: false }).status).not.toBe(
      "exceeded",
    );
  });

  it("has bands that are ordered and non-overlapping", () => {
    for (const bands of [LEAVER_BANDS, ARRIVER_BANDS]) {
      for (let i = 0; i < bands.length - 1; i++) {
        expect(bands[i]!.maxDays).toBeLessThan(bands[i + 1]!.minDays);
        // More days must never require MORE ties.
        expect(bands[i]!.tiesNeeded).toBeGreaterThan(bands[i + 1]!.tiesNeeded);
      }
    }
  });

  it("never states a residence conclusion", () => {
    const r = evaluateUkSrt({
      trips: [trip("GB", "2026-04-06", "2026-11-01")],
      today: "2026-12-01",
      ukTies: 4,
    });
    const text = `${r.headline} ${r.convention} ${r.detail ?? ""}`.toLowerCase();
    expect(text).not.toContain("you are uk resident");
    expect(text).not.toContain("you are resident");
    expect(text).not.toContain("you should");
  });
});

describe("the four rules together — the product's argument", () => {
  const inputs = {
    trips: [trip("PT", "2026-04-10", null)],
    today: "2026-08-06",
    homeCountry: "US",
    ukTies: 2,
  };

  it("evaluates every rule without throwing", () => {
    const all = evaluateAll(inputs);
    expect(all).toHaveLength(RULE_ORDER.length);
    for (const r of all) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.convention.length).toBeGreaterThan(0);
      expect(Number.isFinite(r.value)).toBe(true);
    }
  });

  it("produces DIFFERENT numbers from the same trip — the whole point", () => {
    const all = evaluateAll(inputs);
    const values = all.map((r) => r.value);
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it("states each rule's counting convention, since they contradict", () => {
    const all = evaluateAll(inputs);
    const schengen = all.find((r) => r.id === "schengen")!;
    const feie = all.find((r) => r.id === "feie")!;
    expect(schengen.convention).toContain("entry day");
    expect(feie.convention).toContain("arrive does not count");
  });
});
