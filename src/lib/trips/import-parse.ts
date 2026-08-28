/**
 * Bulk trip import — parse a pasted travel history into trips.
 *
 * Why this exists: the record is the product, and a record with one trip in it
 * is worth nothing. Someone who logs a year of travel has something they will
 * not rebuild elsewhere; someone who logs one trip leaves. Entering twenty
 * trips through a form is the reason they never do.
 *
 * Design rules learned from every import feature that ever went wrong:
 *
 *   * NEVER commit silently. Parsing is separated from saving so the user
 *     confirms a preview. A misparsed date in a compliance tool is worse than
 *     no data, because it looks authoritative.
 *   * Ambiguity is surfaced, not guessed. 03/04/2026 is March in the US and
 *     April almost everywhere else; rows like that are flagged for the user to
 *     resolve rather than quietly assumed.
 *   * A row that cannot be parsed is reported with its original text and line
 *     number. Dropping unparseable lines loses travel the user believes is
 *     recorded.
 */
import { CITIES } from "@/lib/cities";
import type { Trip, TripPurpose } from "@/lib/types";

export type ParsedRow = {
  line: number;
  raw: string;
  country_code: string;
  country: string;
  entry_date: string;
  exit_date: string | null;
  purpose: TripPurpose;
  /** Non-fatal issues the user should look at before committing. */
  warnings: string[];
};

export type ParseFailure = { line: number; raw: string; reason: string };

export type ParseResult = {
  rows: ParsedRow[];
  failures: ParseFailure[];
  /** True when at least one date could be read two ways. */
  ambiguousDates: boolean;
};

/** Country name and alias lookup, built from the seed dataset plus common extras. */
const EXTRA_COUNTRIES: Record<string, string> = {
  "united kingdom": "GB", uk: "GB", england: "GB", scotland: "GB",
  "united states": "US", usa: "US", us: "US", america: "US",
  germany: "DE", deutschland: "DE", france: "FR", italy: "IT", italia: "IT",
  netherlands: "NL", holland: "NL", belgium: "BE", austria: "AT", switzerland: "CH",
  ireland: "IE", denmark: "DK", sweden: "SE", norway: "NO", finland: "FI",
  croatia: "HR", slovenia: "SI", slovakia: "SK", romania: "RO", bulgaria: "BG",
  malta: "MT", cyprus: "CY", luxembourg: "LU", iceland: "IS", latvia: "LV",
  lithuania: "LT", canada: "CA", australia: "AU", "new zealand": "NZ",
  japan: "JP", singapore: "SG", india: "IN", brazil: "BR", "south korea": "KR",
  philippines: "PH", cambodia: "KH", laos: "LA", "sri lanka": "LK", nepal: "NP",
  morocco: "MA", egypt: "EG", kenya: "KE", panama: "PA", "costa rica": "CR",
  guatemala: "GT", peru: "PE", chile: "CL", uruguay: "UY", ecuador: "EC",
};

/** Display name for a country code, shared with the email/flight parser. */
export function countryName(code: string): string {
  const upper = code.toUpperCase();
  const fromCities = CITIES.find((c) => c.country_code === upper)?.country;
  if (fromCities) return fromCities;
  const fromExtras = Object.entries(EXTRA_COUNTRIES).find(([, c]) => c === upper);
  return fromExtras ? titleCase(fromExtras[0]) : upper;
}

function countryIndex(): Map<string, { code: string; name: string }> {
  const map = new Map<string, { code: string; name: string }>();
  for (const c of CITIES) {
    map.set(c.country.toLowerCase(), { code: c.country_code, name: c.country });
    map.set(c.country_code.toLowerCase(), { code: c.country_code, name: c.country });
    map.set(c.city.toLowerCase(), { code: c.country_code, name: c.country });
  }
  for (const [name, code] of Object.entries(EXTRA_COUNTRIES)) {
    if (!map.has(name)) map.set(name, { code, name: titleCase(name) });
    if (!map.has(code.toLowerCase())) map.set(code.toLowerCase(), { code, name: titleCase(name) });
  }
  return map;
}

/**
 * Finds a country by name inside free-form text (a spoken sentence, not a
 * single token). Deliberately excludes the 2-3 letter code aliases that
 * `countryIndex()` also stores — "NO" (Norway), "AT" (Austria) and "IN"
 * (India) are common English words, and matching them against natural speech
 * ("in March", "at the airport") would misfire constantly. Names only, and
 * the longest match wins, so "United Kingdom" is not shadowed by a shorter
 * unrelated substring.
 */
export function countryCodeFromName(text: string): string | null {
  const lower = text.toLowerCase();
  const index = countryIndex();
  let best: { code: string; length: number } | null = null;
  for (const [key, value] of index) {
    if (key.length < 4) continue; // skip code-length aliases
    if (!new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) continue;
    if (!best || key.length > best.length) best = { code: value.code, length: key.length };
  }
  return best?.code ?? null;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

type DateParse = { iso: string; ambiguous: boolean } | null;

/**
 * Accepts the formats people actually paste: 2026-03-14, 14/03/2026,
 * 14.03.2026, 14 March 2026, Mar 14 2026, 14 Mar 26.
 *
 * Day-first is assumed for slash and dot formats because the audience is
 * predominantly European — but where both readings are valid the row is
 * marked ambiguous rather than silently trusted.
 */
export function parseDate(input: string): DateParse {
  const s = input.trim();
  if (!s) return null;

  // ISO — unambiguous, preferred.
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) return build(+iso[1]!, +iso[2]!, +iso[3]!, false);

  // 14 March 2026 / 14 Mar 26
  const dmy = /^(\d{1,2})[.\s-]+([A-Za-z]{3,})[.,\s-]+(\d{2,4})$/.exec(s);
  if (dmy) {
    const m = MONTHS[dmy[2]!.slice(0, 4).toLowerCase()] ?? MONTHS[dmy[2]!.slice(0, 3).toLowerCase()];
    if (m) return build(year(+dmy[3]!), m, +dmy[1]!, false);
  }

  // March 14, 2026 / Mar 14 2026
  const mdy = /^([A-Za-z]{3,})[.\s]+(\d{1,2})[,\s]+(\d{2,4})$/.exec(s);
  if (mdy) {
    const m = MONTHS[mdy[1]!.slice(0, 4).toLowerCase()] ?? MONTHS[mdy[1]!.slice(0, 3).toLowerCase()];
    if (m) return build(year(+mdy[3]!), m, +mdy[2]!, false);
  }

  // 14/03/2026 or 14.03.2026 — day-first, flagged when month-first also works.
  const num = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/.exec(s);
  if (num) {
    const a = +num[1]!;
    const b = +num[2]!;
    const y = year(+num[3]!);
    const bothValid = a <= 12 && b <= 12 && a !== b;
    return build(y, b, a, bothValid);
  }

  return null;
}

function year(y: number): number {
  return y < 100 ? (y > 70 ? 1900 + y : 2000 + y) : y;
}

function build(y: number, m: number, d: number, ambiguous: boolean): DateParse {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 31 February rather than rolling it into March.
  if (date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { iso: date.toISOString().slice(0, 10), ambiguous };
}

const PURPOSES: Record<string, TripPurpose> = {
  tourist: "tourist",
  nomad: "nomad_visa",
  nomad_visa: "nomad_visa",
  residence: "residence",
  resident: "residence",
  work: "residence",
};

/**
 * Parses free-form lines. Separators may be comma, tab, semicolon or a dash
 * between the dates:
 *
 *   Portugal, 2026-01-10, 2026-03-15
 *   Thailand  14/01/2026  02/02/2026  tourist
 *   Bangkok, 3 Mar 2026 - 20 Mar 2026
 *   Spain, 2026-05-01,          (still there — no exit date)
 */
export function parseTripText(text: string): ParseResult {
  const index = countryIndex();
  const rows: ParsedRow[] = [];
  const failures: ParseFailure[] = [];
  let ambiguousDates = false;

  const lines = text.split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (!trimmed || /^(country|destination)\b/i.test(trimmed)) return; // blank or header

    // "March 14, 2026" carries a comma INSIDE the date, and comma is also the
    // field separator. Neutralise that comma before splitting, or the field
    // becomes "March 14" and the year lands in its own column.
    const normalised = trimmed.replace(
      /\b([A-Za-z]{3,})\s+(\d{1,2}),\s*(\d{2,4})\b/g,
      "$1 $2 $3",
    );

    const parts = normalised
      .split(/\s*[,;\t]\s*|\s+[–—-]\s+/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length < 2) {
      failures.push({ line, raw: trimmed, reason: "Needs at least a country and one date." });
      return;
    }

    const place = index.get(parts[0]!.toLowerCase());
    if (!place) {
      failures.push({ line, raw: trimmed, reason: `Country "${parts[0]}" not recognised.` });
      return;
    }

    const entry = parseDate(parts[1] ?? "");
    if (!entry) {
      failures.push({ line, raw: trimmed, reason: `Could not read the date "${parts[1]}".` });
      return;
    }

    // Third field may be an exit date, a purpose, or "still here".
    let exit: DateParse = null;
    let purpose: TripPurpose = "tourist";
    const warnings: string[] = [];

    for (const part of parts.slice(2)) {
      const lower = part.toLowerCase();
      if (/^(still here|present|now|ongoing|open)$/.test(lower)) continue;
      const maybePurpose = PURPOSES[lower.replace(/\s+/g, "_")];
      if (maybePurpose) {
        purpose = maybePurpose;
        continue;
      }
      const d = parseDate(part);
      if (d) {
        exit = d;
        continue;
      }
      warnings.push(`Ignored "${part}".`);
    }

    if (exit && exit.iso < entry.iso) {
      failures.push({ line, raw: trimmed, reason: "Exit date is before the entry date." });
      return;
    }
    if (entry.ambiguous || exit?.ambiguous) {
      ambiguousDates = true;
      warnings.push("Date could be read day-first or month-first — read as day-first.");
    }

    rows.push({
      line,
      raw: trimmed,
      country_code: place.code,
      country: place.name,
      entry_date: entry.iso,
      exit_date: exit?.iso ?? null,
      purpose,
      warnings,
    });
  });

  return { rows, failures, ambiguousDates };
}

/**
 * Rows that duplicate a trip already stored. Same country and same entry date
 * is treated as the same trip — re-importing the same paste must not double
 * every day count.
 */
export function findDuplicates(rows: ParsedRow[], existing: Trip[]): Set<number> {
  const seen = new Set(existing.map((t) => `${t.country_code.toUpperCase()}|${t.entry_date}`));
  const dupes = new Set<number>();
  for (const r of rows) {
    const key = `${r.country_code}|${r.entry_date}`;
    if (seen.has(key)) dupes.add(r.line);
    seen.add(key);
  }
  return dupes;
}

/** Overlapping stays in two countries at once — usually a typo, always worth flagging. */
export function findOverlaps(rows: ParsedRow[]): Set<number> {
  const overlapping = new Set<number>();
  const sorted = [...rows].sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (a.exit_date && b.entry_date < a.exit_date && a.country_code !== b.country_code) {
      overlapping.add(a.line);
      overlapping.add(b.line);
    }
  }
  return overlapping;
}
