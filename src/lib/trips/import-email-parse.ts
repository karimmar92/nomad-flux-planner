/**
 * Bulk trip import — parse a pasted flight confirmation email into trips.
 *
 * `import-parse.ts` expects `Country, entry date, exit date` — nobody's inbox
 * looks like that. A real confirmation describes FLIGHTS (airport codes, one
 * date each, often an outbound leg and a return leg), not STAYS. This module
 * bridges the gap: find flight legs in free text, then reduce a sequence of
 * legs into the stays they imply (arrive in a country on one leg, leave it on
 * the next leg that departs from there).
 *
 * Confidence here is necessarily lower than the structured importer — airline
 * emails vary wildly in layout. That is fine, because nothing commits without
 * the same preview step `import-parse.ts` already forces: a route the parser
 * cannot resolve becomes a `failure` with the original line, never a guess.
 */
import { getAirport } from "@/lib/hops/airports";
import { countryName, parseDate } from "./import-parse";
import type { ParseFailure, ParsedRow, ParseResult } from "./import-parse";

/**
 * Airports outside Driftly's curated nomad-hub registry (`hops/airports.ts`,
 * which only covers cities in the app's own city dataset). Common European
 * and long-haul hubs a Schengen-focused traveller's confirmation is likely to
 * mention. Extend as needed — an unrecognised code simply fails that line,
 * the same way an unrecognised country name fails a line in the plain-text
 * importer, rather than guessing.
 */
const EXTRA_AIRPORTS: Record<string, string> = {
  LHR: "GB",
  LGW: "GB",
  STN: "GB",
  LTN: "GB",
  MAN: "GB",
  EDI: "GB",
  BHX: "GB",
  CDG: "FR",
  ORY: "FR",
  NCE: "FR",
  LYS: "FR",
  MRS: "FR",
  TLS: "FR",
  BOD: "FR",
  FRA: "DE",
  MUC: "DE",
  BER: "DE",
  DUS: "DE",
  HAM: "DE",
  CGN: "DE",
  STR: "DE",
  AMS: "NL",
  RTM: "NL",
  EIN: "NL",
  MAD: "ES",
  BCN: "ES",
  AGP: "ES",
  PMI: "ES",
  VLC: "ES",
  SVQ: "ES",
  BIO: "ES",
  FCO: "IT",
  MXP: "IT",
  LIN: "IT",
  VCE: "IT",
  NAP: "IT",
  BLQ: "IT",
  CTA: "IT",
  ZRH: "CH",
  GVA: "CH",
  BSL: "CH",
  VIE: "AT",
  SZG: "AT",
  BRU: "BE",
  CRL: "BE",
  CPH: "DK",
  ARN: "SE",
  OSL: "NO",
  HEL: "FI",
  WAW: "PL",
  KRK: "PL",
  GDN: "PL",
  PRG: "CZ",
  BUD: "HU",
  OTP: "RO",
  SOF: "BG",
  ATH: "GR",
  SKG: "GR",
  DUB: "IE",
  ORK: "IE",
  KEF: "IS",
  LUX: "LU",
  MLA: "MT",
  LCA: "CY",
  IST: "TR",
  SAW: "TR",
  JFK: "US",
  EWR: "US",
  LAX: "US",
  SFO: "US",
  ORD: "US",
  MIA: "US",
  YYZ: "CA",
  YVR: "CA",
  DXB: "AE",
  DOH: "QA",
  SIN: "SG",
  HKG: "HK",
  NRT: "JP",
  HND: "JP",
  ICN: "KR",
  SYD: "AU",
  MEL: "AU",
  AKL: "NZ",
  GRU: "BR",
  EZE: "AR",
  SCL: "CL",
  LIM: "PE",
  BOG: "CO",
  MEX: "MX",
  JNB: "ZA",
  CAI: "EG",
  NBO: "KE",
  CMN: "MA",
};

function countryForIata(iata: string): string | null {
  return getAirport(iata)?.countryCode ?? EXTRA_AIRPORTS[iata] ?? null;
}

/** Broad date-shaped substrings, validated against `parseDate` one by one. */
const DATE_CANDIDATE =
  /\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\.?,?\s*\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{2,4}/g;

function findDate(text: string): { iso: string; ambiguous: boolean } | null {
  const matches = text.match(DATE_CANDIDATE);
  if (!matches) return null;
  for (const m of matches) {
    const result = parseDate(m.trim());
    if (result) return result;
  }
  return null;
}

/** Two airport codes joined by an arrow, dash or the word "to". */
const ROUTE = /\b([A-Z]{3})\s*(?:→|->|–|—|-|to)\s*([A-Z]{3})\b/;

type Leg = {
  fromIata: string;
  fromCountry: string | null;
  toIata: string;
  toCountry: string;
  date: string;
  line: number;
};

/** Finds `AAA → BBB` style routes and pairs each with the nearest date. */
function findLegs(
  lines: string[],
  failures: ParseFailure[],
): { legs: Leg[]; ambiguousDates: boolean } {
  const legs: Leg[] = [];
  let ambiguousDates = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw) continue;

    const match = ROUTE.exec(raw);
    if (!match) continue;

    const [, fromCode, toCode] = match as unknown as [string, string, string];
    const toCountry = countryForIata(toCode);
    if (!toCountry) {
      failures.push({ line: i + 1, raw, reason: `Airport code "${toCode}" not recognised.` });
      continue;
    }

    // The date is usually on the same line as the route, or the very next
    // non-blank line — confirmations commonly put the route and the date on
    // separate rows of the same block.
    let date = findDate(raw);
    if (!date) {
      const next = lines[i + 1]?.trim();
      if (next) date = findDate(next);
    }
    if (!date) {
      failures.push({ line: i + 1, raw, reason: "Found a route but no date nearby." });
      continue;
    }
    if (date.ambiguous) ambiguousDates = true;

    legs.push({
      fromIata: fromCode,
      fromCountry: countryForIata(fromCode),
      toIata: toCode,
      toCountry,
      date: date.iso,
      line: i + 1,
    });
  }

  return { legs, ambiguousDates };
}

/**
 * Same-day connections are not a stay — a passenger transiting through a
 * layover airport never "entered" that country in any sense the tracker
 * cares about. Adjacent legs sharing a date collapse into one direct leg.
 * A multi-day layover is a real stop and is deliberately left alone.
 */
function mergeConnections(legs: Leg[]): Leg[] {
  const merged: Leg[] = [];
  for (const leg of legs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.toIata === leg.fromIata && prev.date === leg.date) {
      merged[merged.length - 1] = { ...prev, toIata: leg.toIata, toCountry: leg.toCountry };
      continue;
    }
    merged.push(leg);
  }
  return merged;
}

function makeRow(
  countryCode: string,
  entryDate: string,
  exitDate: string | null,
  line: number,
): ParsedRow {
  return {
    line,
    raw: `${countryName(countryCode)}, from the pasted confirmation`,
    country_code: countryCode,
    country: countryName(countryCode),
    entry_date: entryDate,
    exit_date: exitDate,
    purpose: "tourist",
    warnings: [],
  };
}

/** Reduces an ordered sequence of flight legs into the stays they imply. */
function legsToStays(legs: Leg[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  let stayCountry: string | null = null;
  let stayEntry: string | null = null;
  let stayLine = 0;

  for (const leg of legs) {
    if (stayCountry === null) {
      stayCountry = leg.toCountry;
      stayEntry = leg.date;
      stayLine = leg.line;
      continue;
    }
    if (leg.fromCountry === stayCountry) {
      rows.push(makeRow(stayCountry, stayEntry!, leg.date, stayLine));
      if (leg.toCountry !== leg.fromCountry) {
        stayCountry = leg.toCountry;
        stayEntry = leg.date;
        stayLine = leg.line;
      } else {
        stayCountry = null;
        stayEntry = null;
      }
      continue;
    }
    // A leg that doesn't depart from where the previous leg landed — the
    // chain broke (an unrecognised airport in between, most likely). Start a
    // fresh stay rather than guess how the two connect.
    stayCountry = leg.toCountry;
    stayEntry = leg.date;
    stayLine = leg.line;
  }

  // No return leg found — the trip is still open, same as a manually entered
  // "still here" row.
  if (stayCountry && stayEntry) {
    rows.push(makeRow(stayCountry, stayEntry, null, stayLine));
  }

  return rows;
}

export function parseFlightEmailText(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const failures: ParseFailure[] = [];
  const { legs, ambiguousDates } = findLegs(lines, failures);

  if (legs.length === 0 && failures.length === 0) {
    failures.push({
      line: 1,
      raw: text.trim().slice(0, 80),
      reason: 'No flight routes found (looking for something like "LIS → CDG").',
    });
  }

  const rows = legsToStays(mergeConnections(legs));
  return { rows, failures, ambiguousDates };
}
