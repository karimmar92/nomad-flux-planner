/**
 * Last-touch attribution capture. Runs once on landing.
 *
 * The cookie/localStorage pair is only a carrier. The authoritative record is
 * `profiles.referred_by`, written ONCE at signup and never overwritten — a user
 * who signs up free through a creator and subscribes five months later still
 * credits that creator.
 */

import {
  ATTRIBUTION_WINDOW_DAYS,
  REFERRAL_COOKIE,
  REFERRAL_PARAM,
  REFERRAL_STORAGE_KEY,
} from "./config";

export type StoredReferral = { code: string; at: string };

const WINDOW_MS = ATTRIBUTION_WINDOW_DAYS * 86_400_000;

function writeCookie(code: string) {
  const maxAge = Math.floor(WINDOW_MS / 1000);
  document.cookie = `${REFERRAL_COOKIE}=${encodeURIComponent(code)}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
}

function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Reads ?r=CODE, stores it first-party, and returns the active attribution. */
export function captureReferral(): StoredReferral | null {
  if (typeof window === "undefined") return null;

  const code = new URLSearchParams(window.location.search).get(REFERRAL_PARAM)?.trim();
  if (code) {
    const record: StoredReferral = { code: code.toUpperCase(), at: new Date().toISOString() };
    try {
      window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(record));
    } catch {
      /* storage may be blocked; the cookie is the fallback */
    }
    writeCookie(record.code);
    return record;
  }

  return readReferral();
}

/** The active referral, or null once the 30-day last-touch window has lapsed. */
export function readReferral(): StoredReferral | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredReferral;
      if (Date.now() - Date.parse(parsed.at) < WINDOW_MS) return parsed;
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }

  const cookie = readCookie();
  return cookie ? { code: cookie, at: new Date().toISOString() } : null;
}

export function clearReferral() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  document.cookie = `${REFERRAL_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
}
