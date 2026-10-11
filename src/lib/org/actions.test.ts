import { describe, expect, it } from "vitest";
import { buildActionItems, projectedCrossing } from "./actions";
import { buildOrgOverview, type MemberRef, type OrgPolicy, type PresenceRow } from "./presence";

const TODAY = "2026-06-30";

const member = (id: string, name: string, status = "active"): MemberRef => ({
  user_id: id,
  member_id: `m-${id}`,
  display_name: name,
  invite_email: null,
  role: "member",
  status,
  joined_at: "2026-01-01T00:00:00Z",
});

const members = [member("u1", "Amina"), member("u2", "Jonas"), member("u3", "Priya")];
const noPolicies: OrgPolicy[] = [];

function items(
  rows: PresenceRow[],
  requests: { id: string; created_at: string; status: string }[] = [],
  policies = noPolicies,
) {
  const overview = buildOrgOverview(rows, members, policies, TODAY);
  return buildActionItems(overview, rows, requests, TODAY);
}

describe("projectedCrossing", () => {
  it("is null once the limit is already exceeded", () => {
    expect(projectedCrossing(190, 183, TODAY)).toBeNull();
  });

  it("is tomorrow when exactly at the limit", () => {
    expect(projectedCrossing(183, 183, TODAY)).toEqual({ date: "2026-07-01", inDays: 1 });
  });

  it("counts days to the first day past the limit", () => {
    expect(projectedCrossing(181, 183, TODAY)).toEqual({ date: "2026-07-03", inDays: 3 });
  });
});

describe("buildActionItems", () => {
  it("projects a crossing date for someone still abroad, urgent inside a week", () => {
    const rows: PresenceRow[] = [
      { user_id: "u1", country_code: "DE", entry_date: "2026-01-01", exit_date: null },
    ];
    const forecast = items(rows).find((i) => i.id === "forecast-DE-u1");
    expect(forecast).toBeDefined();
    expect(forecast!.severity).toBe("urgent");
    expect(forecast!.title).toContain("2026-07-03");
    // It must say what it assumes, not just assert a date.
    expect(forecast!.detail).toMatch(/assumes they stay/i);
  });

  it("leaves out dated projections when the plan does not include them", () => {
    const rows: PresenceRow[] = [
      { user_id: "u1", country_code: "DE", entry_date: "2026-01-01", exit_date: null },
    ];
    const overview = buildOrgOverview(rows, members, noPolicies, TODAY);
    const list = buildActionItems(overview, rows, [], TODAY, { forecast: false });
    expect(list.some((i) => i.id.startsWith("forecast-"))).toBe(false);
    // They still appear, as someone approaching the limit, just without a date.
    expect(list.some((i) => i.id === "approaching-DE-u1")).toBe(true);
  });

  it("does not forecast a closed trip, since nothing is accruing", () => {
    const rows: PresenceRow[] = [
      { user_id: "u1", country_code: "DE", entry_date: "2026-01-01", exit_date: "2026-06-25" },
    ];
    expect(items(rows).some((i) => i.id.startsWith("forecast-"))).toBe(false);
  });

  it("flags someone already past a policy limit as urgent", () => {
    const rows: PresenceRow[] = [
      { user_id: "u2", country_code: "FR", entry_date: "2026-06-01", exit_date: "2026-06-30" },
    ];
    const policies: OrgPolicy[] = [
      { id: "p1", country_code: "FR", max_days: 20, requires_approval: true, note: "" },
    ];
    const over = items(rows, [], policies).find((i) => i.id === "over-FR-u2");
    expect(over?.severity).toBe("urgent");
    expect(over?.title).toContain("20-day policy limit");
  });

  it("ranks urgent before soon before housekeeping", () => {
    const rows: PresenceRow[] = [
      { user_id: "u1", country_code: "DE", entry_date: "2026-01-01", exit_date: null },
    ];
    const list = items(rows);
    const order = list.map((i) => i.severity);
    const sorted = [...order].sort(
      (a, b) =>
        ["urgent", "soon", "housekeeping"].indexOf(a) -
        ["urgent", "soon", "housekeeping"].indexOf(b),
    );
    expect(order).toEqual(sorted);
  });

  it("escalates a request left waiting three days", () => {
    const fresh = items([], [{ id: "r1", created_at: "2026-06-30T08:00:00Z", status: "pending" }]);
    const stale = items([], [{ id: "r1", created_at: "2026-06-26T08:00:00Z", status: "pending" }]);
    expect(fresh.find((i) => i.id === "requests")?.severity).toBe("soon");
    expect(stale.find((i) => i.id === "requests")?.severity).toBe("urgent");
  });

  it("ignores decided requests", () => {
    const list = items([], [{ id: "r1", created_at: "2026-06-01T08:00:00Z", status: "approved" }]);
    expect(list.some((i) => i.id === "requests")).toBe(false);
  });

  it("raises a stale open stay as housekeeping, with the reason it matters", () => {
    const rows: PresenceRow[] = [
      { user_id: "u3", country_code: "ES", entry_date: "2026-03-01", exit_date: null },
    ];
    const stale = items(rows).find((i) => i.id.startsWith("stale-u3"));
    expect(stale?.severity).toBe("housekeeping");
    expect(stale?.detail).toMatch(/overstated/);
  });

  it("never states a legal conclusion about permanent establishment", () => {
    const rows: PresenceRow[] = [
      { user_id: "u1", country_code: "DE", entry_date: "2025-07-01", exit_date: "2026-06-30" },
    ];
    const pe = items(rows).find((i) => i.id === "pe-DE");
    expect(pe).toBeDefined();
    expect(pe!.detail).toMatch(/not a finding/i);
  });
});
