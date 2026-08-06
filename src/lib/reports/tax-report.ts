/**
 * Year-end presence record.
 *
 * ============================ READ THIS FIRST ============================
 * This module produces EVIDENCE, never CONCLUSIONS.
 *
 * The app knows day-count thresholds. It does NOT know whether anyone is tax
 * resident anywhere: residency also turns on permanent home, centre of vital
 * interests, family ties and country-specific tests (the UK's Statutory
 * Residence Test alone has 16 factors). Stating a conclusion would be tax
 * advice, a regulated activity in most of these jurisdictions.
 *
 * So every string this module emits is phrased as a record of travel:
 *   "Your recorded presence exceeds the day-count threshold."
 * and NEVER as a determination:
 *   "You are tax resident in Portugal."   <-- forbidden, do not "simplify" to this
 *
 * Accountants want defensible day counts they can rely on, not our verdict.
 * =========================================================================
 */
import { CITIES } from "@/lib/cities";
import {
  fromDayIndex,
  schengenDaysUsed,
  toDayIndex,
  SCHENGEN_COUNTRIES,
  SCHENGEN_MAX_DAYS,
} from "@/lib/schengen";
import { toEngineTrips } from "@/lib/trip-dates";
import type { Trip } from "@/lib/types";

/* -------------------------------------------------------------------- */
/* Country reference data                                               */
/* -------------------------------------------------------------------- */

export type CountryTaxBasis = {
  country_code: string;
  country: string;
  thresholdDays: number;
  /** 0-indexed month the tax year opens. 0 = January, 2 = March, 6 = July. */
  taxYearStartMonth: number;
  /** Human label for the basis, e.g. "calendar year" or "March–February". */
  basisLabel: string;
  /** Factual note on what else that country weighs beyond the day count. */
  otherTests: string;
  specialRegime?: { name: string; rate: string };
};

/** Parses the seed's `tax.taxYear` string into a start month. */
function startMonthFor(taxYear: string): number {
  const first = taxYear.split("-")[0]?.trim().toLowerCase();
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const i = months.indexOf(first ?? "");
  return i === -1 ? 0 : i;
}

/**
 * Secondary tests each country weighs alongside the day count. Purely factual
 * — these exist so the report can say "day count is one test among several"
 * with a concrete example rather than a vague hedge.
 */
const OTHER_TESTS: Record<string, string> = {
  PT: "Portugal also considers whether you maintain a habitual residence there on 31 December.",
  ES: "Spain also considers where your main economic interests sit, and presumes residence if your spouse and minor children live there.",
  GR: "Greece also considers permanent home, centre of vital interests and habitual abode.",
  TH: "Thailand assesses the day count per calendar year and separately considers how foreign income is remitted.",
  MX: "Mexico's primary test is your permanent home, and where you keep homes in two countries, your centre of vital interests.",
  CO: "Colombia also considers family ties and where the majority of your assets and income sit.",
  AR: "Argentina also considers permanent residence status and long-term immigration standing.",
  ID: "Indonesia also considers intent to reside and whether you keep a permanent home there.",
  GE: "Georgia also considers centre of vital interests, and residency can be sought separately by status.",
  HU: "Hungary also considers permanent home, centre of vital interests and habitual abode.",
  RS: "Serbia also considers whether you keep a permanent home or centre of business there.",
  TR: "Türkiye also considers whether you have a legal domicile there, independent of the day count.",
  PL: "Poland also considers whether your centre of personal or economic interests sits there.",
  CZ: "Czechia also considers whether you maintain a permanent home available to you.",
  EE: "Estonia also considers whether you have a permanent place of residence there.",
  AE: "The UAE also considers permanent place of residence and where employment or business sits.",
  MY: "Malaysia counts qualifying days under specific linking rules that can differ from a plain day count.",
  VN: "Vietnam also considers a permanent residence card or a leased dwelling of 183 days or more.",
  TW: "Taiwan also considers domicile registration alongside the day count.",
  KR: "South Korea also considers occupation and family circumstances pointing to a 183-day stay.",
  ZA: "South Africa applies an ordinarily-resident test first, and its physical-presence test spans multiple years.",
  MU: "Mauritius also applies a domicile test and an aggregate three-year presence test.",
  AL: "Albania also considers permanent home and centre of vital interests.",
};

const GENERIC_OTHER_TEST =
  "Day count is one test among several. This country also weighs factors such as permanent home, family ties and centre of vital interests.";

export const COUNTRY_TAX_BASIS: Record<string, CountryTaxBasis> = (() => {
  const out: Record<string, CountryTaxBasis> = {};
  for (const city of CITIES) {
    const code = city.country_code.toUpperCase();
    if (out[code]) continue;
    const startMonth = startMonthFor(city.tax.taxYear);
    out[code] = {
      country_code: code,
      country: city.country,
      thresholdDays: city.tax.residencyTriggerDays,
      taxYearStartMonth: startMonth,
      basisLabel: startMonth === 0 ? "calendar year" : city.tax.taxYear.replace("-", "–"),
      otherTests: OTHER_TESTS[code] ?? GENERIC_OTHER_TEST,
      ...(city.tax.specialRegime
        ? { specialRegime: { name: city.tax.specialRegime.name, rate: city.tax.specialRegime.rate } }
        : {}),
    };
  }
  return out;
})();

export function basisFor(countryCode: string): CountryTaxBasis {
  const code = countryCode.toUpperCase();
  return (
    COUNTRY_TAX_BASIS[code] ?? {
      country_code: code,
      country: code,
      thresholdDays: 183,
      taxYearStartMonth: 0,
      basisLabel: "calendar year",
      otherTests: GENERIC_OTHER_TEST,
    }
  );
}

/* -------------------------------------------------------------------- */
/* Period arithmetic — day indices only, never local Date construction  */
/* -------------------------------------------------------------------- */

function isoFromParts(year: number, monthIndex: number, day: number): string {
  return fromDayIndex(Math.floor(Date.UTC(year, monthIndex, day) / 86_400_000));
}

/**
 * The reporting period for `year` on a country's own basis.
 *
 * Convention: a tax year is labelled by the year in which it ENDS. So South
 * Africa's 2026 year runs 2025-03-01 → 2026-02-28 and Mauritius' 2026 year
 * runs 2025-07-01 → 2026-06-30. Non-calendar countries are counted on their
 * own basis and labelled as such — never forced into a calendar year.
 */
export function periodFor(year: number, startMonth: number): { start: string; end: string } {
  if (startMonth === 0) {
    return { start: isoFromParts(year, 0, 1), end: isoFromParts(year, 11, 31) };
  }
  return {
    start: isoFromParts(year - 1, startMonth, 1),
    end: fromDayIndex(toDayIndex(isoFromParts(year, startMonth, 1)) - 1),
  };
}

/* -------------------------------------------------------------------- */
/* Report shape                                                         */
/* -------------------------------------------------------------------- */

export type TripSegment = {
  tripId: string;
  entry_date: string;
  exit_date: string | null;
  /** Days of this trip that fall inside the reporting period. */
  daysInPeriod: number;
  countedFrom: string;
  countedTo: string;
  purpose: Trip["purpose"];
  openEnded: boolean;
};

export type CountryBlock = {
  basis: CountryTaxBasis;
  periodStart: string;
  periodEnd: string;
  days: number;
  /** Recorded presence exceeds the country's day-count threshold. */
  exceedsThreshold: boolean;
  segments: TripSegment[];
};

export type SchengenYearSummary = {
  /** Highest number of days used in any rolling 180-day window in the year. */
  maxWindowDays: number;
  maxWindowDate: string | null;
  /** Every date in the year where the recorded 90-day limit was exceeded. */
  exceededDates: string[];
  daysInSchengen: number;
};

export type DataQualityFlag = {
  kind: "gap" | "open_trip" | "retrospective";
  severity: "info" | "warning";
  label: string;
  detail: string;
};

export type RegimePointer = {
  country_code: string;
  country: string;
  name: string;
  rate: string;
  note: string;
};

/**
 * Counting-method version. BUMP THIS whenever the arithmetic changes — day
 * counting, the open-trip cap, period boundaries or threshold data.
 *
 * Why it matters: someone may hand a report to a tax authority and be asked
 * about a number months later. Without knowing which method produced it, you
 * cannot reproduce or defend that figure, and a silent engine change makes two
 * reports for the same year disagree with no visible reason. This is also the
 * accuracy limb of GDPR Art. 5(1)(d) in practice.
 *
 * History:
 *   1  Initial: inclusive day counting, open trips capped at today or period
 *      end (whichever is earlier), thresholds from the seed dataset.
 */
export const COUNTING_METHOD_VERSION = 1;

/** Plain-language statement of the rules behind every figure. Printed on exports. */
export const COUNTING_METHOD_NOTES = [
  "Both the arrival day and the departure day count as days of presence.",
  "A trip with no exit date is counted only up to today, or the end of the period if that is earlier — never beyond.",
  "Each country is counted over its own tax-year period, which is not always January to December.",
  "Day-count thresholds come from this app's country dataset; see the report header for the dataset date.",
] as const;

export type TaxReport = {
  year: number;
  generatedAt: string;
  /** Method that produced these figures. See COUNTING_METHOD_VERSION. */
  methodVersion: number;
  /** The rules applied, printed alongside the numbers. */
  methodNotes: readonly string[];
  countries: CountryBlock[];
  schengen: SchengenYearSummary;
  dataQuality: DataQualityFlag[];
  regimes: RegimePointer[];
  /** Calendar-year bounds, used for gap analysis and the Schengen summary. */
  calendarStart: string;
  calendarEnd: string;
};

/* -------------------------------------------------------------------- */
/* Builder                                                              */
/* -------------------------------------------------------------------- */

function overlapDays(trip: Trip, lo: number, hi: number, openEndCap: number) {
  const entry = toDayIndex(trip.entry_date);
  const exit = trip.exit_date ? toDayIndex(trip.exit_date) : openEndCap;
  const from = Math.max(entry, lo);
  const to = Math.min(exit, hi);
  return { from, to, days: from <= to ? to - from + 1 : 0 };
}

/**
 * Special regimes a traveller MAY be eligible for. Factual pointers only:
 * every one is phrased "may be relevant — ask your adviser", never as a
 * recommendation and never as a statement that the user qualifies.
 */
const REGIME_NOTES: Record<string, string> = {
  GE: "Available to registered individual entrepreneurs under a turnover cap. Eligibility depends on your activity type and registration.",
  ES: "Applies to certain inbound workers who were not Spanish tax resident in recent years, and must be elected within a deadline.",
  GR: "Applies to certain new tax residents relocating employment or business activity, subject to a minimum stay commitment.",
  TW: "Attached to the Employment Gold Card and subject to income and prior-residence conditions.",
};

export function buildTaxReport(trips: Trip[], year: number, todayIso: string): TaxReport {
  const calendarStart = isoFromParts(year, 0, 1);
  const calendarEnd = isoFromParts(year, 11, 31);
  const today = toDayIndex(todayIso);

  const codes = Array.from(new Set(trips.map((t) => t.country_code.toUpperCase())));

  const countries: CountryBlock[] = [];
  for (const code of codes) {
    const basis = basisFor(code);
    const { start, end } = periodFor(year, basis.taxYearStartMonth);
    const lo = toDayIndex(start);
    const hi = toDayIndex(end);

    const segments: TripSegment[] = [];
    let days = 0;
    for (const trip of trips) {
      if (trip.country_code.toUpperCase() !== code) continue;
      const { from, to, days: d } = overlapDays(trip, lo, hi, Math.min(today, hi));
      if (d === 0) continue;
      days += d;
      segments.push({
        tripId: trip.id,
        entry_date: trip.entry_date,
        exit_date: trip.exit_date,
        daysInPeriod: d,
        countedFrom: fromDayIndex(from),
        countedTo: fromDayIndex(to),
        purpose: trip.purpose,
        openEnded: trip.exit_date === null,
      });
    }
    if (days === 0) continue;

    segments.sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
    countries.push({
      basis,
      periodStart: start,
      periodEnd: end,
      days,
      exceedsThreshold: days >= basis.thresholdDays,
      segments,
    });
  }
  countries.sort((a, b) => b.days - a.days);

  return {
    year,
    generatedAt: new Date().toISOString(),
    methodVersion: COUNTING_METHOD_VERSION,
    methodNotes: COUNTING_METHOD_NOTES,
    countries,
    schengen: schengenYearSummary(trips, year, todayIso),
    dataQuality: dataQualityFlags(trips, year, todayIso),
    regimes: countries
      .filter((c) => c.basis.specialRegime)
      .map((c) => ({
        country_code: c.basis.country_code,
        country: c.basis.country,
        name: c.basis.specialRegime!.name,
        rate: c.basis.specialRegime!.rate,
        note: REGIME_NOTES[c.basis.country_code] ?? "Eligibility conditions apply.",
      })),
    calendarStart,
    calendarEnd,
  };
}

export function schengenYearSummary(
  trips: Trip[],
  year: number,
  todayIso: string,
): SchengenYearSummary {
  const start = toDayIndex(isoFromParts(year, 0, 1));
  const end = Math.min(toDayIndex(isoFromParts(year, 11, 31)), toDayIndex(todayIso));

  const engineTrips = toEngineTrips(trips);
  let maxWindowDays = 0;
  let maxWindowDate: string | null = null;
  const exceededDates: string[] = [];
  const inSchengen = new Set<number>();

  for (let d = start; d <= end; d++) {
    const iso = fromDayIndex(d);
    const used = schengenDaysUsed(engineTrips, iso);
    if (used > maxWindowDays) {
      maxWindowDays = used;
      maxWindowDate = iso;
    }
    if (used > SCHENGEN_MAX_DAYS) exceededDates.push(iso);
  }

  // Membership comes from the engine's own list, never a local copy of it.
  for (const trip of trips) {
    if (trip.purpose === "residence") continue;
    if (!SCHENGEN_COUNTRIES.has(trip.country_code.toUpperCase())) continue;
    const entry = toDayIndex(trip.entry_date);
    const exit = trip.exit_date ? toDayIndex(trip.exit_date) : end;
    for (let d = Math.max(entry, start); d <= Math.min(exit, end); d++) inSchengen.add(d);
  }

  return {
    maxWindowDays,
    maxWindowDate,
    exceededDates,
    daysInSchengen: inSchengen.size,
  };
}

/**
 * What makes the report credible. An accountant needs to know which numbers
 * are solid — a report that hides its own weaknesses is worse than useless.
 */
export function dataQualityFlags(
  trips: Trip[],
  year: number,
  todayIso: string,
): DataQualityFlag[] {
  const flags: DataQualityFlag[] = [];
  const start = toDayIndex(isoFromParts(year, 0, 1));
  const end = Math.min(toDayIndex(isoFromParts(year, 11, 31)), toDayIndex(todayIso));
  if (end < start) return flags;

  // 1. Periods with no recorded location at all.
  const covered = new Uint8Array(end - start + 1);
  for (const trip of trips) {
    const entry = toDayIndex(trip.entry_date);
    const exit = trip.exit_date ? toDayIndex(trip.exit_date) : end;
    for (let d = Math.max(entry, start); d <= Math.min(exit, end); d++) covered[d - start] = 1;
  }
  let runStart: number | null = null;
  for (let i = 0; i <= covered.length; i++) {
    const isGap = i < covered.length && covered[i] === 0;
    if (isGap && runStart === null) runStart = i;
    if (!isGap && runStart !== null) {
      const from = fromDayIndex(start + runStart);
      const to = fromDayIndex(start + i - 1);
      const length = i - runStart;
      flags.push({
        kind: "gap",
        severity: length >= 7 ? "warning" : "info",
        label: `No recorded location — ${length} day${length === 1 ? "" : "s"}`,
        detail: `${from} to ${to}. These days are not attributed to any country, so no day count includes them.`,
      });
      runStart = null;
    }
  }

  // 2. Trips with no exit date — counted to today, not to a recorded departure.
  for (const trip of trips) {
    if (trip.exit_date) continue;
    if (toDayIndex(trip.entry_date) > end) continue;
    flags.push({
      kind: "open_trip",
      severity: "warning",
      label: `Open trip — ${trip.country_code}`,
      detail: `Entered ${trip.entry_date} with no exit date recorded. Days are counted to ${todayIso}, which is an assumption, not a record.`,
    });
  }

  // 3. Entries added retrospectively, more than 30 days after the fact.
  for (const trip of trips) {
    if (!trip.created_at) continue;
    const loggedOn = trip.created_at.slice(0, 10);
    const lag = toDayIndex(loggedOn) - toDayIndex(trip.entry_date);
    if (lag <= 30) continue;
    if (toDayIndex(trip.entry_date) > end || toDayIndex(trip.entry_date) < start - 365) continue;
    flags.push({
      kind: "retrospective",
      severity: "info",
      label: `Added retrospectively — ${trip.country_code}`,
      detail: `Entry dated ${trip.entry_date} was recorded on ${loggedOn}, ${lag} days later. Supporting evidence such as boarding passes or stamps may be worth keeping.`,
    });
  }

  return flags;
}

/** Years that have any recorded presence, newest first. */
export function yearsWithData(trips: Trip[], todayIso: string): number[] {
  const years = new Set<number>();
  const todayYear = Number(todayIso.slice(0, 4));
  for (const trip of trips) {
    const from = Number(trip.entry_date.slice(0, 4));
    const to = trip.exit_date ? Number(trip.exit_date.slice(0, 4)) : todayYear;
    for (let y = from; y <= to; y++) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}
