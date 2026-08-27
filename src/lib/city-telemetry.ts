/**
 * The numbers behind the city page's telemetry hero.
 *
 * ── WHY A CAPACITY BAR, AND WHY THIS ONE ───────────────────────────────
 *
 * The reference for the layout is a VPN client's status screen: a big name, a
 * live status line, a server-load bar, and a strip of labelled metrics. Most of
 * that is decoration when lifted onto a city page — a pulsing map dot means
 * something for a VPN and nothing here — but ONE element transfers exactly.
 *
 * "Server load 89%" and "47 of 90 visa days used" are the same object: a
 * bounded resource, filling, where the colour is the message. That is also the
 * single most important fact this product knows about a city, so it belongs in
 * the largest type on the page rather than four sections down.
 *
 * ── TWO GAUGES, NOT ONE ────────────────────────────────────────────────
 *
 * A nomad in a city is filling two different meters at once, and they run at
 * different speeds toward different consequences:
 *
 *   VISA      — overstaying is a fine, a removal order, and under EES an
 *               automatic five-year flag.
 *   TAX       — crossing the residency threshold is a filing obligation and
 *               possibly a tax bill, and it is invisible until it happens.
 *
 * Showing only one would hide the other, and which one binds first depends
 * entirely on the country. Portugal: visa at 90, tax at 183. Georgia: visa at
 * 365, tax at 183 — the tax meter fills FIRST, which is exactly the trap this
 * audience falls into.
 *
 * ── THE SCHENGEN SUBTLETY THAT MAKES THIS NON-TRIVIAL ──────────────────
 *
 * For a Schengen city the visa gauge must count days across the WHOLE AREA, not
 * days in this city's country. Someone who has spent 80 days in Spain has 10
 * left in Portugal, and a per-country count would tell them they have 90. That
 * is the most expensive mistake this page could make, so `visaGauge` routes
 * Schengen cities through the rolling-window engine and everything else through
 * the per-entry allowance.
 */
import type { City, Trip } from "@/lib/types";
import { schengenDaysUsed, SCHENGEN_MAX_DAYS, SCHENGEN_COUNTRIES } from "@/lib/schengen";
import { daysInCountryTaxYear, toEngineTrips } from "@/lib/trip-dates";
import { touristDaysWithExtension, taxYearStartMonth } from "@/lib/arbitrage";
import { countDistinctDays, type DayRange } from "@/lib/day-union";
import { toDayIndex } from "@/lib/schengen";

export type GaugeStatus = "ok" | "watch" | "at_limit" | "exceeded";

export type Gauge = {
  id: "visa" | "tax";
  label: string;
  used: number;
  limit: number;
  /** 0–100, clamped, for the bar width. */
  pct: number;
  status: GaugeStatus;
  /** One line explaining what the number is counted over. */
  basis: string;
};

/** Shared thresholds, so the bar colour and the alert copy cannot disagree. */
export function gaugeStatus(used: number, limit: number): GaugeStatus {
  if (limit <= 0) return "ok";
  if (used > limit) return "exceeded";
  if (used === limit) return "at_limit";
  const pct = used / limit;
  if (pct >= 0.9) return "watch";
  return "ok";
}

function pctOf(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

/**
 * Days recorded in THIS country, counted as distinct days.
 *
 * Distinct, not summed — overlapping records would otherwise inflate it, which
 * is the bug that put 180 days into an exported PDF for someone who had been
 * somewhere 124. See lib/day-union.ts.
 */
export function daysInCountry(trips: Trip[], countryCode: string, today: string): number {
  const code = countryCode.toUpperCase();
  const ref = toDayIndex(today);
  const ranges: DayRange[] = [];
  for (const t of trips) {
    if (t.country_code.toUpperCase() !== code) continue;
    ranges.push({
      from: toDayIndex(t.entry_date),
      to: Math.min(t.exit_date ? toDayIndex(t.exit_date) : ref, ref),
    });
  }
  return countDistinctDays(ranges);
}

export function visaGauge(city: City, trips: Trip[], today: string): Gauge {
  if (SCHENGEN_COUNTRIES.has(city.country_code.toUpperCase())) {
    // AREA-WIDE, not country-wide. Days in Spain reduce the allowance here.
    const used = schengenDaysUsed(toEngineTrips(trips), today);
    return {
      id: "visa",
      label: "Schengen allowance",
      used,
      limit: SCHENGEN_MAX_DAYS,
      pct: pctOf(used, SCHENGEN_MAX_DAYS),
      status: gaugeStatus(used, SCHENGEN_MAX_DAYS),
      basis: "Rolling 180-day window, shared across all 29 Schengen countries.",
    };
  }

  const limit = touristDaysWithExtension(city);
  const used = daysInCountry(trips, city.country_code, today);
  return {
    id: "visa",
    label: "Visa-free allowance",
    used,
    limit,
    pct: pctOf(used, limit),
    status: gaugeStatus(used, limit),
    basis: `${limit} days per entry in ${city.country}, including any extension.`,
  };
}

export function taxGauge(city: City, trips: Trip[], today: string): Gauge {
  const limit = city.tax.residencyTriggerDays;
  const startMonth = taxYearStartMonth(city);
  const { days } = daysInCountryTaxYear(trips, city.country_code, today, startMonth);
  return {
    id: "tax",
    label: "Tax residency",
    used: days,
    limit,
    pct: pctOf(days, limit),
    status: gaugeStatus(days, limit),
    basis:
      startMonth === 0
        ? `${limit} days in the calendar year triggers a residency test.`
        : `${limit} days in ${city.country}'s tax year, which does not start in January.`,
  };
}

/**
 * Which gauge to lead with: whichever is closer to its limit.
 *
 * Not "visa first" — in Georgia the visa allowance is 365 days and the tax
 * threshold is 183, so the tax meter fills first and leading with visa would
 * bury the thing that actually binds.
 */
export function leadGauge(gauges: Gauge[]): Gauge | null {
  if (gauges.length === 0) return null;
  return gauges.reduce((a, b) => (b.pct > a.pct ? b : a));
}

export type CityTelemetry = {
  gauges: Gauge[];
  /** True when an open trip in this country covers today. */
  currentlyHere: boolean;
  /** Distinct days ever recorded in this country. */
  daysEverHere: number;
};

export function cityTelemetry(city: City, trips: Trip[], today: string): CityTelemetry {
  const code = city.country_code.toUpperCase();
  const currentlyHere = trips.some(
    (t) =>
      t.country_code.toUpperCase() === code &&
      t.entry_date <= today &&
      (t.exit_date === null || t.exit_date >= today),
  );

  return {
    gauges: [visaGauge(city, trips, today), taxGauge(city, trips, today)],
    currentlyHere,
    daysEverHere: daysInCountry(trips, city.country_code, today),
  };
}
