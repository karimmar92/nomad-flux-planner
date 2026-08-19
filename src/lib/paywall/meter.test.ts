import { describe, expect, it } from "vitest";
import {
  FREE_MONTHLY_CHECKS,
  emptyMeter,
  isMetered,
  normalise,
  periodKey,
  remaining,
  spend,
} from "./meter";

const AT = (iso: string) => new Date(iso);

describe("meter", () => {
  it("keys periods in UTC, not local time", () => {
    // 23:30 UTC on the 31st is already the next month in Auckland. The
    // allowance must not roll over for someone who merely flew east.
    expect(periodKey(AT("2026-01-31T23:30:00Z"))).toBe("2026-01");
  });

  it("grants exactly three checks per period", () => {
    let s = emptyMeter(AT("2026-03-02T00:00:00Z"));
    expect(remaining(s)).toBe(FREE_MONTHLY_CHECKS);
    for (const f of ["border_run_full", "forward_planning", "compare"] as const) {
      const r = spend(s, f);
      expect(r.granted).toBe(true);
      s = r.state;
    }
    expect(remaining(s)).toBe(0);
    expect(spend(s, "arbitrage_ranking").granted).toBe(false);
  });

  it("is idempotent — reopening an unlocked feature costs nothing", () => {
    let s = emptyMeter();
    s = spend(s, "compare").state;
    const again = spend(s, "compare");
    expect(again.granted).toBe(true);
    expect(remaining(again.state)).toBe(FREE_MONTHLY_CHECKS - 1);
  });

  it("resets when the period changes", () => {
    const jan = { period: "2026-01", spent: ["compare"] as const };
    const rolled = normalise({ ...jan, spent: [...jan.spent] }, AT("2026-02-01T00:00:00Z"));
    expect(rolled.spent).toEqual([]);
    expect(remaining(rolled)).toBe(FREE_MONTHLY_CHECKS);
  });

  it("never meters the hard-gated evidence layer", () => {
    expect(isMetered("vault")).toBe(false);
    expect(isMetered("tax_report")).toBe(false);
    expect(isMetered("exports")).toBe(false);
  });

  it("drops unknown feature keys from stored state", () => {
    const s = normalise({ period: periodKey(), spent: ["nonsense" as never] });
    expect(s.spent).toEqual([]);
  });
});
