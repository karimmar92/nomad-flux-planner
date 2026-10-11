import { describe, expect, it } from "vitest";
import { requestImpact, type OrgPolicy, type PresenceRow } from "./presence";

const TODAY = "2026-06-30";

const rows: PresenceRow[] = [
  // 20 recorded days in Germany inside the window.
  { user_id: "u1", country_code: "DE", entry_date: "2026-05-01", exit_date: "2026-05-20" },
];
const policy = (max: number): OrgPolicy[] => [
  { id: "p", country_code: "DE", max_days: max, requires_approval: true, note: "" },
];

function impact(start: string, end: string, policies: OrgPolicy[] = policy(30)) {
  return requestImpact(
    { user_id: "u1", country_code: "DE", start_date: start, end_date: end },
    rows,
    policies,
    "Amina",
    TODAY,
  );
}

describe("requestImpact headroom", () => {
  it("reports days left before and after the request", () => {
    const r = impact("2026-07-10", "2026-07-14"); // 5 days, limit 30, 20 used
    expect(r.currentDays).toBe(20);
    expect(r.headroomBefore).toBe(10);
    expect(r.headroomAfter).toBe(5);
    expect(r.risk).not.toBe("over");
  });

  it("goes negative when the trip would pass the limit", () => {
    const r = impact("2026-07-10", "2026-07-24"); // 15 days
    expect(r.headroomAfter).toBe(-5);
    expect(r.risk).toBe("over");
  });

  it("names the last end date that stays within the limit", () => {
    const r = impact("2026-07-10", "2026-07-24");
    // 10 days of headroom starting 10 July ends on 19 July.
    expect(r.latestCompliantEnd).toBe("2026-07-19");
  });

  it("allows a trip that lands exactly on the limit", () => {
    const r = impact("2026-07-10", "2026-07-19"); // 10 days
    expect(r.headroomAfter).toBe(0);
    expect(r.risk).not.toBe("over");
  });

  it("has no compliant end date when there is no headroom", () => {
    const r = impact("2026-07-10", "2026-07-12", policy(20));
    expect(r.headroomBefore).toBe(0);
    expect(r.latestCompliantEnd).toBeNull();
  });

  it("uses the tax threshold when no policy is set", () => {
    const r = impact("2026-07-10", "2026-07-12", []);
    expect(r.headroomBefore).toBe(r.thresholdDays - 20);
  });
});
