/**
 * Which alerts fire, and when they fire again.
 *
 * Pure on purpose. Everything here is decided from numbers the rules engine
 * already produces, with no database, no clock and no network, because the
 * rule that matters most is "do not email the same person the same warning
 * every night" and that is exactly the kind of logic that is impossible to
 * verify once it is tangled up with IO.
 *
 * ── THE DEDUPLICATION PROBLEM ──────────────────────────────────────────
 *
 * A naive "email when over 75%" sends every night for weeks. A naive "email
 * once ever" misses the second trip that matters more than the first.
 *
 * Schengen makes this sharper than it looks, because the window is rolling:
 * days age out. Somebody can cross 75%, sit still for a month, drop back to
 * 60% as old days expire, then climb through 75% again on a new trip. The
 * second crossing is a real event and deserves a real warning.
 *
 * So the state we keep per person per rule is a single BAND, and the rule is:
 *
 *   Notify only when the band goes UP. Record the band every time, including
 *   when it goes down.
 *
 * Rising through 75 emails once. Sitting at 80% emails nothing. Climbing to
 * 90 emails again, because that is new information. Falling back to 60 emails
 * nothing but resets the state, so the next climb through 75 warns properly.
 *
 * ── WHY FEIE IS EXCLUDED ───────────────────────────────────────────────
 *
 * The FEIE 330-day test counts UP toward a good outcome — the rules engine
 * flags it with `higherIsBetter`. "You are at 90% of 330 days" is progress,
 * not danger, and sending it as a warning would train people to ignore the
 * ones that are. Falling short of FEIE deserves its own alert with inverted
 * logic and different copy; it is not this one.
 */
import type { RuleResult } from "@/lib/rules";

/**
 * The bands, as percentages of the published threshold.
 *
 * 100 is its own band and not merged with 90: "you have used 90% of your
 * allowance" and "you are over the limit" are different messages and the
 * second must never be delivered as though it were the first.
 */
export type AlertBand = 0 | 75 | 90 | 100;

export const ALERT_BANDS = [75, 90, 100] as const;

export function bandFor(value: number, threshold: number): AlertBand {
  if (threshold <= 0) return 0;
  const pct = (value / threshold) * 100;
  if (pct >= 100) return 100;
  if (pct >= 90) return 90;
  if (pct >= 75) return 75;
  return 0;
}

/**
 * Notify only on a rise. Equality is silence, which is what stops the nightly
 * repeat, and a fall is silence too but still gets recorded by the caller.
 */
export function shouldNotify(current: AlertBand, last: AlertBand): boolean {
  return current > last;
}

export type PendingAlert = {
  ruleId: RuleResult["id"];
  label: string;
  band: AlertBand;
  value: number;
  threshold: number;
  /** One line, already written for a human. */
  headline: string;
};

/**
 * The alerts to send for one person, given this evaluation and what they were
 * last told.
 *
 * `lastBands` is keyed by rule id. A missing entry means never notified, which
 * is band 0 — a new user deep in the red gets warned on the first run rather
 * than being treated as already informed.
 */
export function pendingAlerts(
  results: RuleResult[],
  lastBands: Partial<Record<RuleResult["id"], AlertBand>>,
): PendingAlert[] {
  const out: PendingAlert[] = [];

  for (const r of results) {
    // Rules that count up toward a good outcome are not limit warnings.
    if (r.higherIsBetter) continue;
    // Nothing to measure against, so nothing honest to say.
    if (r.status === "insufficient_data") continue;

    const current = bandFor(r.value, r.threshold);
    const last = lastBands[r.id] ?? 0;
    if (!shouldNotify(current, last)) continue;

    out.push({
      ruleId: r.id,
      label: r.label,
      band: current,
      value: r.value,
      threshold: r.threshold,
      headline: r.headline,
    });
  }

  return out;
}

/**
 * Subject line for a batch.
 *
 * Deliberately states the number rather than teasing it. This email exists to
 * be acted on, and a subject like "An update on your travel days" makes the
 * reader open it to find out whether it matters. Put the fact in the subject
 * so somebody who is fine can ignore it and somebody who is not cannot.
 */
export function alertSubject(alerts: PendingAlert[]): string {
  if (alerts.length === 0) return "";
  const worst = alerts.reduce((a, b) => (b.band > a.band ? b : a));
  if (worst.band === 100) {
    return `You are over the ${worst.label} limit`;
  }
  const left = Math.max(0, worst.threshold - worst.value);
  return `${left} ${left === 1 ? "day" : "days"} left on ${worst.label}`;
}
