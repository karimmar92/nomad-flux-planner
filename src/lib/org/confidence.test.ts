import { describe, expect, it } from "vitest";
import { memberConfidence, recordConfidence } from "./confidence";
import type { MemberRef, PresenceRow } from "./presence";

const TODAY = "2026-06-30";

const m = (id: string, name: string): MemberRef => ({
  user_id: id,
  member_id: `m-${id}`,
  display_name: name,
  invite_email: null,
  role: "member",
  status: "active",
  joined_at: null,
});

const clean = (user: string): PresenceRow => ({
  user_id: user,
  country_code: "PT",
  entry_date: "2026-06-01",
  exit_date: "2026-06-10",
  logged_at: "2026-06-11T00:00:00Z",
});

describe("memberConfidence", () => {
  it("scores a tidy, recent record as high with nothing to fix", () => {
    const c = memberConfidence(m("u1", "Amina"), [clean("u1")], TODAY);
    expect(c.score).toBe(100);
    expect(c.level).toBe("high");
    expect(c.reasons).toEqual([]);
  });

  it("scores no record as none, not as a perfect or a failing record", () => {
    const c = memberConfidence(m("u1", "Amina"), [], TODAY);
    expect(c.level).toBe("none");
    expect(c.reasons).toEqual(["No travel logged"]);
  });

  it("marks down an open stay left running for months, and says why", () => {
    const rows: PresenceRow[] = [
      {
        ...clean("u1"),
        entry_date: "2026-03-01",
        exit_date: null,
        logged_at: "2026-03-02T00:00:00Z",
      },
    ];
    const c = memberConfidence(m("u1", "Amina"), rows, TODAY);
    expect(c.score).toBe(75);
    expect(c.reasons[0]).toMatch(/open stay.*no exit date/);
  });

  it("does not penalise a recent open stay, which is just someone abroad", () => {
    const rows: PresenceRow[] = [
      {
        ...clean("u1"),
        entry_date: "2026-06-20",
        exit_date: null,
        logged_at: "2026-06-20T00:00:00Z",
      },
    ];
    expect(memberConfidence(m("u1", "Amina"), rows, TODAY).score).toBe(100);
  });

  it("marks down overlapping entries", () => {
    const rows: PresenceRow[] = [
      { ...clean("u1"), entry_date: "2026-06-01", exit_date: "2026-06-12" },
      { ...clean("u1"), entry_date: "2026-06-10", exit_date: "2026-06-20" },
    ];
    const c = memberConfidence(m("u1", "Amina"), rows, TODAY);
    expect(c.score).toBe(85);
    expect(c.reasons.join()).toMatch(/overlapping/);
  });

  it("marks down entries logged long after the trip", () => {
    const rows: PresenceRow[] = [
      {
        ...clean("u1"),
        entry_date: "2026-04-01",
        exit_date: "2026-04-05",
        logged_at: "2026-06-01T00:00:00Z",
      },
    ];
    expect(memberConfidence(m("u1", "Amina"), rows, TODAY).score).toBe(95);
  });

  it("never goes below zero", () => {
    const rows: PresenceRow[] = [1, 2, 3, 4].map((i) => ({
      ...clean("u1"),
      entry_date: `2026-01-0${i}`,
      exit_date: null,
      logged_at: "2026-06-01T00:00:00Z",
    }));
    expect(memberConfidence(m("u1", "Amina"), rows, TODAY).score).toBeGreaterThanOrEqual(0);
  });
});

describe("recordConfidence", () => {
  it("keeps coverage and quality apart", () => {
    const members = [m("u1", "A"), m("u2", "B"), m("u3", "C"), m("u4", "D")];
    const c = recordConfidence([clean("u1")], members, TODAY);
    expect(c.coverage).toBe(25);
    expect(c.quality).toBe(100);
  });

  it("will not call an organisation reliable when most seats have no record", () => {
    const members = [m("u1", "A"), m("u2", "B"), m("u3", "C"), m("u4", "D")];
    const c = recordConfidence([clean("u1")], members, TODAY);
    expect(c.level).toBe("low");
  });

  it("is high when everyone has a clean record", () => {
    const members = [m("u1", "A"), m("u2", "B")];
    const c = recordConfidence([clean("u1"), clean("u2")], members, TODAY);
    expect(c.level).toBe("high");
    expect(c.coverage).toBe(100);
  });

  it("has no quality figure when nobody has logged anything", () => {
    const c = recordConfidence([], [m("u1", "A")], TODAY);
    expect(c.quality).toBeNull();
    expect(c.level).toBe("none");
  });

  it("ignores invited seats that have not joined", () => {
    const invited: MemberRef = { ...m("u2", "B"), status: "invited" };
    const c = recordConfidence([clean("u1")], [m("u1", "A"), invited], TODAY);
    expect(c.coverage).toBe(100);
  });
});
