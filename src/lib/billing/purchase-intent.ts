/**
 * The purchase intent handoff.
 *
 * Two separate signals, because they answer different questions.
 *
 * THE URL carries the DURABLE intent: `/pricing?plan=pro&interval=annual&checkout=1`
 * (or `?founding=1`). It survives a new tab, a different device, an hour's
 * delay — anything. It says WHAT was chosen.
 *
 * SESSION STORAGE carries the FRESHNESS. Written at the moment a signed-out
 * user clicks a plan, read once on arrival at /pricing. It says "this is the
 * same continuous action, moments ago, in this tab".
 *
 * Why both: an OAuth sign-in is a full-page redirect in the same tab, so the
 * record survives and checkout opens immediately — one uninterrupted action.
 * An email confirmation link opens a new tab, often on another device, so the
 * record is absent and the user gets a confirm step instead. A payment sheet
 * that materialises out of an email an hour later reads as a trap; these are
 * deliberately not treated the same. The distinction is structural rather than
 * a referrer sniff, so it cannot be spoofed or accidentally fall through.
 */
import type { BillingInterval, PaidPlanId } from "@/config/stripe-prices";

const KEY = "driftly.purchase-intent";

/** Anything older than this is a different session in spirit, not a click. */
export const INTENT_FRESH_MS = 15 * 60 * 1000;

export type PurchaseIntent = {
  plan?: PaidPlanId;
  interval?: BillingInterval;
  founding?: boolean;
  ts: number;
};

export function writePurchaseIntent(intent: Omit<PurchaseIntent, "ts">): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...intent, ts: Date.now() }));
  } catch {
    // Private mode / storage disabled: the confirm step is the fallback, and
    // it is a perfectly good outcome. Never let this break the navigation.
  }
}

/** Reads and CLEARS. A handoff is consumed exactly once, by design. */
export function takePurchaseIntent(): PurchaseIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PurchaseIntent;
    if (typeof parsed?.ts !== "number") return null;
    if (Date.now() - parsed.ts > INTENT_FRESH_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True when the stored record is the same purchase the URL is asking for. */
export function intentMatches(
  intent: PurchaseIntent | null,
  want: { plan?: PaidPlanId; interval?: BillingInterval; founding?: boolean },
): boolean {
  if (!intent) return false;
  if (want.founding) return intent.founding === true;
  if (!want.plan) return false;
  return intent.plan === want.plan && intent.interval === want.interval;
}

/** The `next` value handed to /auth — the durable half of the handoff. */
export function pricingNextUrl(want: {
  plan?: PaidPlanId;
  interval?: BillingInterval;
  founding?: boolean;
}): string {
  if (want.founding) return "/pricing?founding=1";
  const params = new URLSearchParams();
  if (want.plan) params.set("plan", want.plan);
  if (want.interval) params.set("interval", want.interval === "yearly" ? "annual" : "monthly");
  params.set("checkout", "1");
  return `/pricing?${params.toString()}`;
}
