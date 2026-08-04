import { DEFAULT_LOCALE, LOCALE_TAGS, type Locale } from "./locales";

/**
 * DATES ARE NEVER RENDERED NUMERICALLY IN THIS APP. EVER.
 *
 * `03/04/2026` is 3 April to a German and 4 March to an American. Every date in
 * Driftly — entry dates, exit deadlines, the 90/180 window — carries legal
 * consequences, and an off-by-a-month reading of an exit deadline can get
 * someone barred from a country for three years.
 *
 * So the month is always a WORD. The month name is localised; the ordering is
 * never localised into ambiguity. Use this helper everywhere; do not call
 * `toLocaleDateString` with a numeric month, and do not build date strings by
 * hand. Free-text date entry is likewise banned — use a date picker.
 */

type DateInput = Date | string | number;

/** Parses YYYY-MM-DD as a UTC calendar date (never local — see trip-dates.ts). */
function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  }
  return new Date(value);
}

function tag(locale: string | undefined) {
  return LOCALE_TAGS[(locale as Locale) ?? DEFAULT_LOCALE] ?? locale ?? "en";
}

/** "12 Oct 2026" — unambiguous in every locale. Month is always a word. */
export function formatDate(value: DateInput, locale?: string): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** "12 October 2026" — same rule, long month, for headings and reports. */
export function formatDateLong(value: DateInput, locale?: string): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** "Oct 2026" — month + year only. */
export function formatMonthYear(value: DateInput, locale?: string): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(tag(locale), {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** "12 Oct 2026 – 03 Nov 2026" for trip rows. */
export function formatDateRange(from: DateInput, to: DateInput | null, locale?: string): string {
  const start = formatDate(from, locale);
  return to ? `${start} – ${formatDate(to, locale)}` : start;
}

/**
 * Numbers and currency DO follow locale convention (2.350,00 € / $2,350.00) —
 * those are unambiguous. Only dates get special treatment.
 */
export function formatNumber(value: number, locale?: string, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(tag(locale), options).format(value);
}

export function formatCurrency(
  value: number,
  currency = "USD",
  locale?: string,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(tag(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    ...options,
  }).format(value);
}
