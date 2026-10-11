import { describe, expect, it } from "vitest";
import { explainCount } from "./explain";
import { buildOrgOverview, type MemberRef, type PresenceRow } from "./presence";

const TODAY = "2026-06-30";
const members: MemberRef[] = [
  {
    user_id: "u1",
    member_id: "m1",
    display_name: "Amina",
    invite_email: null,
    role: "member",
    status: "active",
    joined_at: null,
  },
];

describe("explainCount", () => {
  const rows: PresenceRow[] = [
    { user_id: "u1", country_code: "PT", entry_date: "2026-01-10", exit_date: "2026-01-19" },
    { user_id: "u1", country_code: "PT", entry_date: "2026-06-01", exit_date: null },
    { user_id: "u1", country_code: "ES", entry_date: "2026-03-01", exit_date: "2026-03-05" },
  ];

  it("lists only the requested person and country", () => {
    const e = explainCount(rows, "u1", "pt", TODAY);
    expect(e.stays).toHaveLength(2);
    expect(e.stays.every((s) => s.countedFrom >= e.windowStart)).toBe(true);
  });

  it("agrees with the headline figure the dashboard shows", () => {
    const overview = buildOrgOverview(rows, members, [], TODAY);
    const headline = overview.countries.find((c) => c.country_code === "PT")!.members[0]!.days;
    expect(explainCount(rows, "u1", "PT", TODAY).total).toBe(headline);
  });

  it("counts both ends of a stay and marks an open one", () => {
    const e = explainCount(rows, "u1", "PT", TODAY);
    expect(e.stays[0]!.days).toBe(10);
    expect(e.stays[1]!.open).toBe(true);
    expect(e.stays[1]!.countedTo).toBe(TODAY);
    expect(e.stays[1]!.days).toBe(30);
  });

  it("clips a stay that began before the 12-month window", () => {
    const e = explainCount(
      [{ user_id: "u1", country_code: "PT", entry_date: "2025-05-01", exit_date: "2025-07-10" }],
      "u1",
      "PT",
      TODAY,
    );
    expect(e.stays[0]!.clipped).toBe(true);
    expect(e.stays[0]!.countedFrom).toBe(e.windowStart);
    expect(e.stays[0]!.days).toBeLessThan(71);
  });

  it("reports overlapping entries, which the headline counts twice", () => {
    const overlapping: PresenceRow[] = [
      { user_id: "u1", country_code: "PT", entry_date: "2026-02-01", exit_date: "2026-02-10" },
      { user_id: "u1", country_code: "PT", entry_date: "2026-02-08", exit_date: "2026-02-12" },
    ];
    expect(explainCount(overlapping, "u1", "PT", TODAY).overlapDays).toBe(3);
  });

  it("states which rule basis the threshold comes from", () => {
    const e = explainCount(rows, "u1", "PT", TODAY);
    expect(e.thresholdDays).toBeGreaterThan(0);
    expect(e.basisLabel.length).toBeGreaterThan(0);
  });
});
