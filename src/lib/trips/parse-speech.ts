/**
 * Turns one spoken sentence ("Portugal, January 10th to March 15th 2026")
 * into the fields the Quick Entry form already has. Never guesses a field it
 * cannot find — the form stays exactly as empty for fields the parser missed,
 * and nothing here submits anything. The person still reviews and clicks
 * "Add trip" themselves.
 */
import { countryCodeFromName, parseDate } from "./import-parse";
import type { TripPurpose } from "@/lib/types";

/** "10th" -> "10", "21st" -> "21". Speech-to-text output always has these. */
function stripOrdinals(text: string): string {
  return text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");
}

const MONTH_NAMES =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const MONTH_DAY = new RegExp(`\\b(${MONTH_NAMES})\\s+(\\d{1,2})\\b`, "gi");
const BARE_YEAR = /\b(20\d{2})\b/;

/**
 * A spoken range usually names the year once for the whole sentence
 * ("January 10th to March 15th 2026"), not once per date the way a pasted
 * list or email does. Every "Month Day" found borrows that one year.
 */
function findSpokenDates(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const fallbackYear = text.match(BARE_YEAR)?.[1] ?? null;
  if (fallbackYear) {
    for (const match of text.matchAll(MONTH_DAY)) {
      const result = parseDate(`${match[1]} ${match[2]} ${fallbackYear}`);
      if (result && !seen.has(result.iso)) {
        seen.add(result.iso);
        found.push(result.iso);
      }
    }
  }

  // Defensive fallback in case the recognised text ever comes back as digits.
  for (const match of text.match(/\d{4}-\d{1,2}-\d{1,2}/g) ?? []) {
    const result = parseDate(match);
    if (result && !seen.has(result.iso)) {
      seen.add(result.iso);
      found.push(result.iso);
    }
  }

  return found.sort();
}

const PURPOSE_KEYWORDS: { pattern: RegExp; purpose: TripPurpose }[] = [
  { pattern: /\bnomad visa\b/i, purpose: "nomad_visa" },
  { pattern: /\b(work(?:ing)?|resid(?:ence|ent|ing)|living|moved?)\b/i, purpose: "residence" },
];

export type SpokenTrip = {
  country_code: string | null;
  entry_date: string | null;
  exit_date: string | null;
  purpose: TripPurpose;
};

export function parseSpokenTrip(text: string): SpokenTrip | null {
  const cleaned = stripOrdinals(text);
  const country_code = countryCodeFromName(cleaned);
  const dates = findSpokenDates(cleaned);

  if (!country_code && dates.length === 0) return null;

  let purpose: TripPurpose = "tourist";
  for (const { pattern, purpose: p } of PURPOSE_KEYWORDS) {
    if (pattern.test(cleaned)) {
      purpose = p;
      break;
    }
  }

  return {
    country_code,
    entry_date: dates[0] ?? null,
    exit_date: dates.length > 1 ? dates[dates.length - 1]! : null,
    purpose,
  };
}
