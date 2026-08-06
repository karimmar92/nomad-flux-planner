/**
 * Last-touch attribution capture. Runs once on landing.
 *
 * The authoritative record is `profiles.referred_by`, written ONCE at signup
 * and never overwritten — a user who signs up free through a creator and
 * subscribes five months later still credits that creator. What follows is
 * only the carrier that gets a code from the landing URL to the signup form.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS SESSION-SCOPED AND NOT A 30-DAY COOKIE
 *
 * This previously wrote a first-party cookie with a 30-day Max-Age plus a
 * matching localStorage record. Both are "storage of information in the
 * user's terminal equipment" under the ePrivacy Directive and, for us, German
 * TTDSG §25 — which is enforced more actively than most of the EU.
 *
 * The strictly-necessary exemption did not cover it. A 30-day marketing
 * attribution window is not required to deliver the service the user asked
 * for; it exists so we can pay commission. That means it needed prior
 * consent, and it had none.
 *
 * Rather than add a consent prompt at the exact moment we want zero friction,
 * attribution is now scoped to the browsing session: sessionStorage only, no
 * cookie, cleared when the tab closes. That is a far stronger position — it is
 * first-party, it does not track across sites or sessions, and it exists only
 * to complete a flow the user themselves initiated by clicking a referral
 * link.
 *
 * THE TRADE: cross-session attribution is gone. Someone who clicks a creator
 * link today and signs up next week will not be credited automatically. That
 * is covered by the self-reported "How did you hear about us?" field, which is
 * increasingly more accurate than cookies anyway now that tracking prevention
 * is default-on in most browsers.
 *
 * The cost today is zero, because there are no creators yet. If that changes
 * and creators lose credit, the correct fix is consented persistent storage —
 * an explicit opt-in when arriving via a referral link — not silently
 * reinstating the cookie.
 *
 * This is a defensible reading, not legal advice. Have counsel confirm it
 * alongside the privacy policy.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { REFERRAL_PARAM, REFERRAL_STORAGE_KEY } from "./config";

export type StoredReferral = { code: string; at: string };

/** sessionStorage, wrapped: Safari private mode throws on access. */
function sessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function sessionSet(key: string, value: string) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* storage blocked — attribution is best-effort, never load-bearing */
  }
}

function sessionRemove(key: string) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * Reads ?r=CODE and holds it for this browsing session only.
 * No cookie is written. Nothing survives the tab closing.
 */
export function captureReferral(): StoredReferral | null {
  if (typeof window === "undefined") return null;

  const code = new URLSearchParams(window.location.search).get(REFERRAL_PARAM)?.trim();
  if (code) {
    const record: StoredReferral = { code: code.toUpperCase(), at: new Date().toISOString() };
    sessionSet(REFERRAL_STORAGE_KEY, JSON.stringify(record));
    return record;
  }

  return readReferral();
}

/** The referral active in this session, if any. */
export function readReferral(): StoredReferral | null {
  if (typeof window === "undefined") return null;

  const raw = sessionGet(REFERRAL_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredReferral;
  } catch {
    sessionRemove(REFERRAL_STORAGE_KEY);
    return null;
  }
}

export function clearReferral() {
  if (typeof window === "undefined") return;
  sessionRemove(REFERRAL_STORAGE_KEY);

  // Clear any cookie left over from the previous implementation. Users who
  // visited before this change still carry it, and we no longer have a basis
  // for holding it.
  try {
    document.cookie = "driftly_ref=; Max-Age=0; Path=/; SameSite=Lax";
  } catch {
    /* ignore */
  }
}

/**
 * Removes the legacy 30-day cookie and localStorage record on first load.
 * Called from the referral capture component so existing visitors stop
 * carrying data we no longer have a lawful basis to store.
 */
export function purgeLegacyAttribution() {
  if (typeof window === "undefined") return;
  try {
    document.cookie = "driftly_ref=; Max-Age=0; Path=/; SameSite=Lax";
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
