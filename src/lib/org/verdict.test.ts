import { describe, expect, it } from "vitest";
import { buildActionItems } from "./actions";
import { recordConfidence } from "./confidence";
import { DEFAULT_LENS, LENSES, isLens, lensLayout } from "./lens";
import { buildOrgOverview, type MemberRef, type PresenceRow } from "./presence";
import { sampleDashboard } from "./sample";
import { buildVerdict } from "./verdict";

const TODAY = "2026-06-30";

function run(
  rows: PresenceRow[],
  members: MemberRef[],
  policies = [] as ReturnType<typeof sampleDashboard>["policies"],
  forecasts = true,
) {
  const overview = buildOrgOverview(rows, members, policies, TODAY);
  const actions = buildActionItems(overview, rows, [], TODAY, { forecast: forecasts });
  const confidence = recordConfidence(rows, members, TODAY);
  return {
    overview,
    actions,
    confidence,
    verdict: buildVerdict(overview, actions, confidence, forecasts),
  };
}

const active = (id: string, name: string): MemberRef => ({
  user_id: id,
  member_id: `m-${id}`,
  display_name: name,
  invite_email: null,
  role: "member",
  status: "active",
  joined_at: null,
});

const tidy = (user: string, code = "PT"): PresenceRow => ({
  user_id: user,
  country_code: code,
  entry_date: "2026-06-01",
  exit_date: "2026-06-10",
  logged_at: "2026-06-11T00:00:00Z",
});

describe("buildVerdict", () => {
  it("says nothing is recorded rather than clear when there is no data", () => {
    const { verdict } = run([], [active("u1", "A")]);
    expect(verdict.level).toBe("empty");
  });

  it("says act when someone is past a limit, even on a plan with no action list", () => {
    const rows: PresenceRow[] = [
      {
        user_id: "u1",
        country_code: "DE",
        entry_date: "2025-08-01",
        exit_date: "2026-06-30",
        logged_at: "2025-08-02T00:00:00Z",
      },
    ];
    const overview = buildOrgOverview(rows, [active("u1", "Amina")], [], TODAY);
    const verdict = buildVerdict(
      overview,
      [],
      recordConfidence(rows, [active("u1", "Amina")], TODAY),
      false,
    );
    expect(verdict.level).toBe("act");
    expect(verdict.detail).toMatch(/Amina is past a limit/);
  });

  it("says clear only when the evidence is good", () => {
    const { verdict } = run([tidy("u1")], [active("u1", "A")]);
    expect(verdict.level).toBe("clear");
  });

  it("will not say clear when most seats have logged nothing", () => {
    const members = ["a", "b", "c", "d"].map((i) => active(i, i));
    const { verdict } = run([tidy("a")], members);
    expect(verdict.level).toBe("watch");
    expect(verdict.headline).toMatch(/records are thin/);
  });

  it("does not claim projections the plan does not include", () => {
    const withForecast = run([tidy("u1")], [active("u1", "A")], [], true).verdict.detail;
    const without = run([tidy("u1")], [active("u1", "A")], [], false).verdict.detail;
    expect(withForecast).toMatch(/next 30 days/);
    expect(without).not.toMatch(/projected/);
  });
});

describe("sample dashboard", () => {
  const s = sampleDashboard(TODAY);
  const { overview, verdict, confidence } = run(s.rows, s.members, s.policies);

  it("shows each state once so the product can be understood at a glance", () => {
    expect(overview.counts.over).toBeGreaterThanOrEqual(1);
    expect(overview.counts.approaching).toBeGreaterThanOrEqual(1);
    expect(overview.counts.clear).toBeGreaterThanOrEqual(1);
    expect(overview.counts.noData).toBeGreaterThanOrEqual(1);
  });

  it("leads with an urgent verdict, the strongest first impression", () => {
    expect(verdict.level).toBe("act");
  });

  it("includes a record that has gone stale, so confidence is not a flat 100", () => {
    expect(confidence.quality).toBeLessThan(100);
    expect(confidence.members.some((m) => m.reasons.length > 0)).toBe(true);
  });

  it("is never presented as real: it has no seat that could be the viewer", () => {
    expect(s.members.every((m) => m.member_id.startsWith("sample-"))).toBe(true);
  });
});

describe("lenses", () => {
  it("covers four distinct roles and defaults to a valid one", () => {
    expect(LENSES).toHaveLength(4);
    expect(isLens(DEFAULT_LENS)).toBe(true);
    expect(isLens("ceo")).toBe(false);
  });

  it("leads each role with what it cares about", () => {
    expect(lensLayout("hr").sections[0]).toBe("actions");
    expect(lensLayout("finance").sections[0]).toBe("exposure");
    expect(lensLayout("mobility").sections[0]).toBe("people");
  });

  it("cuts the simple lens down to the next three things", () => {
    const l = lensLayout("founder");
    expect(l.sections).toEqual(["actions"]);
    expect(l.actionLimit).toBe(3);
  });

  it("never drops a section outright except in the simple lens", () => {
    for (const lens of ["hr", "finance", "mobility"] as const) {
      const s = lensLayout(lens).sections;
      for (const need of ["actions", "exposure", "quality", "exports"] as const) {
        expect(s).toContain(need);
      }
    }
  });
});
