/**
 * Input validation at the trust boundary.
 *
 * Context, so the next person doesn't over-engineer this: the app talks to
 * Postgres through PostgREST (supabase-js), which sends values as JSON
 * parameters, never as concatenated SQL. `.eq()`, `.insert()`, `.update()`
 * and friends are parameterised by construction — a value of
 * `'; DROP TABLE trips; --` is stored as that literal string. There is no
 * string-built SQL anywhere in this codebase, and no `.or()` / `.filter()` /
 * `.textSearch()` raw-filter calls, which are the only supabase-js surfaces
 * where interpolation would matter.
 *
 * So SQL injection is not the live risk. What IS live:
 *
 *   1. `javascript:` and `data:` URLs in user-supplied links, which React
 *      happily renders into href — input executing as code.
 *   2. Server functions whose `inputValidator` only declares a TypeScript
 *      type. Types are erased at runtime; the wire payload is whatever the
 *      caller sent, so `seats: "abc"` reaches the handler as a string.
 *
 * These helpers close both. Validate at the boundary, then trust inward.
 */

/** Fields that must never be empty and must not grow unbounded. */
export function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") throw new Error(`${field} is required.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new Error(`${field} is required.`);
  if (trimmed.length > max) throw new Error(`${field} must be under ${max} characters.`);
  return trimmed;
}

export function optionalText(value: unknown, field: string, max: number): string {
  if (value == null) return "";
  if (typeof value !== "string") throw new Error(`${field} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error(`${field} must be under ${max} characters.`);
  return trimmed;
}

/** Deliberately permissive shape check — not an RFC 5322 parser. */
export function email(value: unknown, field = "Email"): string {
  const text = requiredText(value, field, 200);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) throw new Error(`Enter a valid ${field.toLowerCase()}.`);
  return text.toLowerCase();
}

export function integer(value: unknown, field: string, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number.`);
  const rounded = Math.round(n);
  if (rounded < min || rounded > max) {
    throw new Error(`${field} must be between ${min} and ${max}.`);
  }
  return rounded;
}

/** Value must be one of a fixed set — the antidote to trusting a union type. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`${field} is not valid.`);
  }
  return value as T;
}

const SAFE_URL_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Returns the URL only if it is a real http(s) link, otherwise null.
 *
 * `javascript:alert(1)`, `data:text/html,...` and `vbscript:` all execute when
 * placed in an href and clicked. React escapes text content but does NOT
 * sanitise URL attributes, so anywhere user text reaches `href` or `src` it
 * must pass through here. Callers render nothing (or plain text) on null.
 */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  try {
    // A bare "example.com" has no protocol; treat it as https rather than
    // rejecting it, since that is what people type.
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return SAFE_URL_PROTOCOLS.has(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** ISO date (YYYY-MM-DD) as the tracker stores them. */
export function isoDate(value: unknown, field: string): string {
  const text = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new Error(`${field} must be a valid date.`);
  }
  return text;
}

/** Two-letter ISO country code, normalised to uppercase. */
export function countryCode(value: unknown, field = "Country"): string {
  const text = requiredText(value, field, 2);
  if (!/^[A-Za-z]{2}$/.test(text)) throw new Error(`${field} must be a two-letter code.`);
  return text.toUpperCase();
}
