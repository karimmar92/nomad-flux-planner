/**
 * Turns one spoken sentence ("this is my passport, expires December 2027")
 * into the Vault upload form's fields. Deliberately lower confidence than the
 * trip parser — vault dictation is looser free-form speech — so the full raw
 * transcript always lands in `notes` untouched, even when the structured
 * guesses below are wrong. Nothing here submits the form; the person reviews
 * every field before clicking Upload, same as today.
 */
import { parseDate } from "../trips/import-parse";
import type { DocumentType } from "./vault";

function stripOrdinals(text: string): string {
  return text.replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1");
}

const MONTH_NAMES =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function monthIndexFrom(word: string): number | null {
  const idx = MONTH_INDEX[word.slice(0, 3).toLowerCase()];
  return idx === undefined ? null : idx;
}

function lastDayOfMonth(monthIdx: number, year: number): string {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, monthIdx + 1, 0)).toISOString().slice(0, 10);
}

function findExpiryDate(text: string): string | null {
  const monthDayYear = new RegExp(
    `\\b(${MONTH_NAMES})\\s+(\\d{1,2})\\D{0,3}(20\\d{2})\\b`,
    "i",
  ).exec(text);
  if (monthDayYear) {
    const result = parseDate(`${monthDayYear[1]} ${monthDayYear[2]} ${monthDayYear[3]}`);
    if (result) return result.iso;
  }

  // No day was spoken ("expires December 2027") — the last legal day of that
  // month is the honest reading, not a guessed day.
  const monthYear = new RegExp(`\\b(${MONTH_NAMES})\\s+(20\\d{2})\\b`, "i").exec(text);
  if (monthYear) {
    const idx = monthIndexFrom(monthYear[1]!);
    if (idx !== null) return lastDayOfMonth(idx, Number(monthYear[2]));
  }

  return null;
}

const TYPE_KEYWORDS: { pattern: RegExp; type: DocumentType }[] = [
  { pattern: /\bpassport\b/i, type: "passport" },
  { pattern: /\bvisa\b/i, type: "visa_approval" },
  { pattern: /\binsuranc/i, type: "insurance" },
  { pattern: /\b(proof of address|utility bill|bank statement)\b/i, type: "proof_of_address" },
  { pattern: /\b(onward|return)\s+(ticket|flight)\b/i, type: "onward_ticket" },
  { pattern: /\b(vaccin\w*|immuni[sz]ation)\b/i, type: "vaccination" },
];

function findDocumentType(text: string): DocumentType | null {
  for (const { pattern, type } of TYPE_KEYWORDS) {
    if (pattern.test(text)) return type;
  }
  return null;
}

/** Strips a spoken lead-in ("this is my", "here's my") and cuts before any expiry clause. */
function extractTitle(text: string): string {
  let s = text.replace(/^(this is|it'?s|here'?s)\s+(my|a|the)\s+/i, "").trim();
  const cutIdx = s.search(/[,.]|\bexpir\w*\b/i);
  if (cutIdx > 0) s = s.slice(0, cutIdx).trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export type SpokenDocument = {
  type: DocumentType | null;
  expires_on: string | null;
  title: string;
  /** The full, unedited transcript — always kept, never lost to a bad guess. */
  notes: string;
};

export function parseSpokenDocument(text: string): SpokenDocument {
  const cleaned = stripOrdinals(text);
  return {
    type: findDocumentType(cleaned),
    expires_on: findExpiryDate(cleaned),
    title: extractTitle(cleaned),
    notes: text,
  };
}
