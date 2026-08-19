/**
 * THE SOFT GATE — a metered allowance on forward-looking answers.
 *
 * The paywall model is unchanged: free to put data in, paid to get value out.
 * What changes here is the shape of the wall on the *forward-looking* half.
 *
 * A hard wall on planning asks people to pay for something they have never
 * seen work. So free accounts get THREE forward-looking checks per calendar
 * month — a full border-run ranking, a plan-ahead simulation, a compare run,
 * a city ranking. Spending one unlocks that feature for the rest of the
 * month. When the allowance runs out the wall appears, and by then the person
 * has watched the thing produce a real answer with their own trips in it.
 *
 * What is NOT metered, in either direction:
 *
 *   HARD GATED (never metered, blurred preview only): the document vault, the
 *   tax presence report, and exports. These are the evidence layer. They are
 *   what an accountant or a border officer sees, they carry real storage and
 *   liability, and a "free taste" of a compliance record is worse than none —
 *   a half-exported year is a document someone might actually file.
 *
 *   NEVER GATED: everything in the emergency rule. isEmergency() wins over
 *   this file, always. Nobody is metered while they are about to overstay.
 *
 * Storage is per-device localStorage, deliberately. Server-enforced metering
 * would need a write on every render of a planning screen, and the downside
 * of a determined person clearing storage is that they see a border-run list
 * — which we already give away free inside seven days of a deadline.
 */
import type { ProFeature } from "@/lib/entitlements";

/** Forward-looking checks. Everything here is soft-gated, not hard-gated. */
export const METERED_FEATURES = [
  "border_run_full",
  "forward_planning",
  "compare",
  "arbitrage_ranking",
] as const satisfies readonly ProFeature[];

export type MeteredFeature = (typeof METERED_FEATURES)[number];

export function isMetered(feature: ProFeature): feature is MeteredFeature {
  return (METERED_FEATURES as readonly string[]).includes(feature);
}

/** Forward-looking checks a free account gets each calendar month. */
export const FREE_MONTHLY_CHECKS = 3;

export const METER_STORAGE_KEY = "driftly.meter.v1";

export type MeterState = {
  /** Calendar month the allowance belongs to, as YYYY-MM in UTC. */
  period: string;
  /** Features unlocked this period. One entry = one spent check. */
  spent: MeteredFeature[];
};

/**
 * UTC, like every other date in this codebase. A local-time period boundary
 * would hand someone an extra allowance simply for flying east.
 */
export function periodKey(now: Date = new Date()): string {
  const month = `${now.getUTCMonth() + 1}`.padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function emptyMeter(now: Date = new Date()): MeterState {
  return { period: periodKey(now), spent: [] };
}

/** Rolls the state into the current period. Pure — the caller persists it. */
export function normalise(state: MeterState | null, now: Date = new Date()): MeterState {
  const period = periodKey(now);
  if (!state || state.period !== period) return { period, spent: [] };
  const spent = state.spent.filter(isMetered);
  return { period, spent: [...new Set(spent)] as MeteredFeature[] };
}

export function isUnlocked(state: MeterState, feature: MeteredFeature): boolean {
  return state.spent.includes(feature);
}

export function remaining(state: MeterState): number {
  return Math.max(0, FREE_MONTHLY_CHECKS - state.spent.length);
}

/**
 * Spends one check on a feature.
 *
 * Idempotent: re-opening a feature already unlocked this month costs nothing.
 * Returns the unchanged state when the allowance is gone, so the caller shows
 * the wall rather than silently doing nothing.
 */
export function spend(
  state: MeterState,
  feature: MeteredFeature,
): { state: MeterState; granted: boolean } {
  if (isUnlocked(state, feature)) return { state, granted: true };
  if (remaining(state) <= 0) return { state, granted: false };
  return { state: { ...state, spent: [...state.spent, feature] }, granted: true };
}

export function readMeter(now: Date = new Date()): MeterState {
  if (typeof window === "undefined") return emptyMeter(now);
  try {
    const raw = window.localStorage.getItem(METER_STORAGE_KEY);
    return normalise(raw ? (JSON.parse(raw) as MeterState) : null, now);
  } catch {
    return emptyMeter(now);
  }
}

export function writeMeter(state: MeterState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(METER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode, quota — metering is not worth breaking a page over */
  }
}
