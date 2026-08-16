/**
 * The deduplication rule is the whole risk here, so it gets the most tests.
 *
 * Two failure modes, both bad in different ways:
 *   Emailing every night   — people filter the sender, and then the one alert
 *                            that mattered is silently gone.
 *   Emailing once ever     — the second trip that pushes somebody over gets no
 *                            warning at all.
 *
 * The rise-only rule is meant to sit between them. These tests pin that, plus
 * the rolling-window case that motivated it.
 */
import { describe, expect, it } from "vitest";
import { alertSubject, bandFor, pendingAlerts, shouldNotify } from "./thresholds";
import type { RuleResult } from "@/lib/rules";

function result(over: Partial<RuleResult> = {}): RuleResult {
  return {
    id: "schengen",
    label: "Schengen 90/180",
    audience: "",
    value: 0,
    threshold: 90,
    unit: "days used",
    status: "ok",
    headline: "",
    convention: "",
    ...over,
  };
}

describe("bandFor", () => {
  it("is 0 below three quarters", () => {
    expect(bandFor(67, 90)).toBe(0); // 74.4%
  });

  it("enters the 75 band exactly on the boundary", () => {
    expect(bandFor(67.5, 90)).toBe(75);
  });

  it("enters the 90 band exactly on the boundary", () => {
    expect(bandFor(81, 90)).toBe(90);
  });

  it("separates being over the limit from being near it", () => {
    // 100 is its own band: "you are over" must never be sent as "you are close".
    expect(bandFor(90, 90)).toBe(100);
    expect(bandFor(91, 90)).toBe(100);
    expect(bandFor(89, 90)).toBe(90);
  });

  it("returns 0 for a meaningless threshold rather than dividing by zero", () => {
    expect(bandFor(5, 0)).toBe(0);
  });
});

describe("shouldNotify", () => {
  it("notifies on a rise", () => {
    expect(shouldNotify(75, 0)).toBe(true);
    expect(shouldNotify(90, 75)).toBe(true);
    expect(shouldNotify(100, 90)).toBe(true);
  });

  it("stays silent when nothing changed", () => {
    // The nightly-repeat guard.
    expect(shouldNotify(75, 75)).toBe(false);
    expect(shouldNotify(100, 100)).toBe(false);
  });

  it("stays silent on a fall", () => {
    expect(shouldNotify(75, 90)).toBe(false);
    expect(shouldNotify(0, 75)).toBe(false);
  });

  it("skips straight to the right band when a long trip is logged at once", () => {
    // Someone back-filling a trip can go from 0 to over the limit in one step
    // and must still be told.
    expect(shouldNotify(100, 0)).toBe(true);
  });
});

describe("pendingAlerts", () => {
  it("warns a brand new user who is already in the red", () => {
    // A missing entry means band 0, not "already told".
    const due = pendingAlerts([result({ value: 85, threshold: 90 })], {});
    expect(due).toHaveLength(1);
    expect(due[0]!.band).toBe(90);
  });

  it("does not repeat the same band", () => {
    expect(pendingAlerts([result({ value: 85, threshold: 90 })], { schengen: 90 })).toEqual([]);
  });

  it("warns again when the count climbs into the next band", () => {
    const due = pendingAlerts([result({ value: 90, threshold: 90 })], { schengen: 90 });
    expect(due).toHaveLength(1);
    expect(due[0]!.band).toBe(100);
  });

  it("re-warns after days age out of the rolling window and are used again", () => {
    // The case the band design exists for. Down to 60% is silence, but the
    // caller records band 0, so climbing back through 75% warns properly.
    expect(pendingAlerts([result({ value: 54, threshold: 90 })], { schengen: 90 })).toEqual([]);
    const due = pendingAlerts([result({ value: 70, threshold: 90 })], { schengen: 0 });
    expect(due).toHaveLength(1);
    expect(due[0]!.band).toBe(75);
  });

  it("ignores rules that count up toward a good outcome", () => {
    // FEIE at 90% of 330 days is progress, not danger.
    const feie = result({ id: "feie", value: 300, threshold: 330, higherIsBetter: true });
    expect(pendingAlerts([feie], {})).toEqual([]);
  });

  it("says nothing when there is no data to count", () => {
    expect(pendingAlerts([result({ status: "insufficient_data", value: 0 })], {})).toEqual([]);
  });

  it("reports each rule independently", () => {
    const due = pendingAlerts(
      [
        result({ id: "schengen", value: 85, threshold: 90 }),
        result({ id: "tax_183", label: "183-day residency", value: 140, threshold: 183 }),
      ],
      { schengen: 90 },
    );
    expect(due.map((d) => d.ruleId)).toEqual(["tax_183"]);
  });
});

describe("alertSubject", () => {
  it("puts the number in the subject so it can be ignored safely", () => {
    const due = pendingAlerts([result({ value: 70, threshold: 90 })], {});
    expect(alertSubject(due)).toBe("20 days left on Schengen 90/180");
  });

  it("says plainly when the limit is passed", () => {
    const due = pendingAlerts([result({ value: 92, threshold: 90 })], {});
    expect(alertSubject(due)).toBe("You are over the Schengen 90/180 limit");
  });

  it("leads with the worst band when several fire at once", () => {
    const due = pendingAlerts(
      [
        result({ id: "tax_183", label: "183-day residency", value: 140, threshold: 183 }),
        result({ id: "schengen", value: 90, threshold: 90 }),
      ],
      {},
    );
    expect(alertSubject(due)).toBe("You are over the Schengen 90/180 limit");
  });

  it("uses the singular for one day", () => {
    const due = pendingAlerts([result({ value: 89, threshold: 90 })], {});
    expect(alertSubject(due)).toBe("1 day left on Schengen 90/180");
  });
});
