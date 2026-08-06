import { describe, expect, it } from "vitest";
import { EMERGENCY_DAYS, canUse, isEmergency, isPro } from "./entitlements";

/**
 * The emergency unlock is a PUBLIC PROMISE, printed on the pricing page:
 * "If you are over a limit, or within seven days of one, the full ranked
 * border-run list opens regardless of plan."
 *
 * That makes it more than a product decision. A published statement about what
 * a paid service does becomes part of the bargain, and a refactor that quietly
 * re-gates the list would turn the pricing page into a misleading claim rather
 * than merely a bug. These tests pin the promise to the code.
 */
describe("emergency unlock — the promise on the pricing page", () => {
  it("opens for a free user who has already overstayed", () => {
    expect(isEmergency({ daysLeft: -3, overstayed: true })).toBe(true);
  });

  it("opens for a free user inside the seven-day window", () => {
    expect(isEmergency({ daysLeft: EMERGENCY_DAYS, overstayed: false })).toBe(true);
    expect(isEmergency({ daysLeft: 1, overstayed: false })).toBe(true);
    expect(isEmergency({ daysLeft: 0, overstayed: false })).toBe(true);
  });

  it("stays closed outside the window — the gate is real the rest of the time", () => {
    expect(isEmergency({ daysLeft: EMERGENCY_DAYS + 1, overstayed: false })).toBe(false);
    expect(isEmergency({ daysLeft: 60, overstayed: false })).toBe(false);
  });

  it("is seven days, as published", () => {
    // The number appears in user-facing copy as "seven days". If this changes,
    // the pricing page must change in the same commit.
    expect(EMERGENCY_DAYS).toBe(7);
  });

  it("does NOT unlock the other Pro features — copy must not overclaim", () => {
    // The unlock is scoped to the border-run list. Exports, alerts and the
    // vault stay gated even mid-emergency, so the pricing copy has to say
    // exactly that rather than "nothing is ever gated".
    expect(canUse("free", "exports")).toBe(false);
    expect(canUse("free", "threshold_alerts")).toBe(false);
    expect(canUse("free", "vault")).toBe(false);
    expect(isPro("free")).toBe(false);
  });
});
