/**
 * A/B ASSIGNMENT — sticky, anonymous, and honest about what it can prove.
 *
 * One experiment runs at a time: the wording of the value-first block in the
 * soft and hard gates. Assignment is per device, drawn once and kept, because
 * a user who sees variant A on Monday and variant B on Tuesday tells you
 * nothing about either.
 *
 * The variant rides on every funnel event automatically (see funnel.ts), so
 * conversion is comparable by variant without instrumenting each call site.
 * No server round trip, no third party, no identity — the same anonymous
 * device id the funnel already uses decides the coin flip.
 */

export const GATE_COPY_EXPERIMENT = "gate_copy_v1";

/**
 * a = RECEIPT framing: what the free allowance already gave you, then what
 *     upgrading adds. Concrete, backward-looking, low pressure.
 * b = COST-OF-WAITING framing: what stays manual until you upgrade. Same
 *     facts, forward-looking.
 *
 * Both must be true statements. A variant that overstates would win the test
 * and lose the customer, so the experiment is over wording, never over claims.
 */
export type GateCopyVariant = "a" | "b";

const KEY = "driftly.exp.gate_copy_v1";

let cached: GateCopyVariant | null = null;

export function gateCopyVariant(): GateCopyVariant {
  if (cached) return cached;
  if (typeof window === "undefined") return "a"; // SSR renders the control
  let v: GateCopyVariant | null = null;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored === "a" || stored === "b") v = stored;
    if (!v) {
      v = Math.random() < 0.5 ? "a" : "b";
      window.localStorage.setItem(KEY, v);
    }
  } catch {
    v = "a";
  }
  cached = v;
  return v;
}

/** Test-only escape hatch, also used by the admin debug view to preview copy. */
export function forceGateCopyVariant(v: GateCopyVariant): void {
  cached = v;
  try {
    window.localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
}
