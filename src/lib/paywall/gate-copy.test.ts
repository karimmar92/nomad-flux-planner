import { describe, expect, it } from "vitest";
import { gateLines } from "./gate-copy";
import { FREE_MONTHLY_CHECKS } from "./meter";

describe("gate copy variants", () => {
  it("variant a states the checks already used", () => {
    const l = gateLines({ variant: "a", metered: true, used: 2, feature: "compare" });
    expect(l.used).toContain(`2 of ${FREE_MONTHLY_CHECKS}`);
    expect(l.next).toContain("unlimited");
  });

  it("variant b states the checks remaining, from the same numbers", () => {
    const l = gateLines({ variant: "b", metered: true, used: 2, feature: "compare" });
    expect(l.used).toContain(`${FREE_MONTHLY_CHECKS - 2} of ${FREE_MONTHLY_CHECKS}`);
  });

  it("hard gates never imply the feature is metered", () => {
    for (const variant of ["a", "b"] as const) {
      const l = gateLines({ variant, metered: false, used: 0, feature: "vault" });
      expect(l.used.toLowerCase()).not.toContain("checks left");
    }
  });

  it("survives a generic upgrade prompt with no feature", () => {
    const l = gateLines({ variant: "a", metered: false, used: 0, feature: null });
    expect(l.next.length).toBeGreaterThan(0);
  });
});
