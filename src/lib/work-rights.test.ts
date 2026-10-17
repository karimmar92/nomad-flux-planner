import { describe, expect, it } from "vitest";
import { WORK_RIGHTS, workRightsFor } from "@/config/work-rights-data";
import { buildActionItems } from "@/lib/org/actions";
import { buildOrgOverview, type MemberRef, type PresenceRow } from "@/lib/org/presence";
import {
  STALE_AFTER_DAYS,
  daysSince,
  isHttpsUrl,
  isStale,
  validateEntry,
  type WorkRightsEntry,
} from "./work-rights";
import { CITIES } from "@/lib/cities";

const base = (over: Partial<WorkRightsEntry> = {}): WorkRightsEntry => ({
  countryCode: "PT",
  country: "Portugal",
  visitorWork: {
    status: "grey_area",
    summary: "Law is silent.",
    sources: [{ label: "AIMA", url: "https://example.gov/x" }],
  },
  remoteRoute: { name: null, conditions: null, sources: [] },
  socialSecurity: {
    euCoordination: true,
    usTotalization: true,
    usTotalizationYear: 1989,
    note: "n",
    sources: [{ label: "SSA", url: "https://www.ssa.gov/x" }],
  },
  confidence: "medium",
  openQuestions: [],
  verifiedOn: "2026-10-16",
  ...over,
});

describe("validateEntry", () => {
  it("passes a complete, sourced entry", () => {
    expect(validateEntry(base())).toEqual([]);
  });

  it("refuses a position with no source, since that would read as fact", () => {
    const e = base({ visitorWork: { status: "not_permitted", summary: "x", sources: [] } });
    expect(validateEntry(e).join()).toMatch(/needs a source/);
  });

  it("allows an honest unclear with no source", () => {
    const e = base({
      visitorWork: { status: "unclear", summary: "Could not establish.", sources: [] },
    });
    expect(validateEntry(e)).toEqual([]);
  });

  it("refuses a named remote route without a source", () => {
    const e = base({ remoteRoute: { name: "D8", conditions: null, sources: [] } });
    expect(validateEntry(e).join()).toMatch(/remote route needs a source/);
  });

  it("refuses non-https sources", () => {
    const e = base({
      visitorWork: {
        status: "conditional",
        summary: "x",
        sources: [{ label: "a", url: "http://insecure.example" }],
      },
    });
    expect(validateEntry(e).join()).toMatch(/https/);
  });

  it("keeps the totalization year consistent with the agreement", () => {
    const yearless = base({
      socialSecurity: { ...base().socialSecurity, usTotalizationYear: null },
    });
    expect(validateEntry(yearless).join()).toMatch(/needs its year/);
    const orphan = base({ socialSecurity: { ...base().socialSecurity, usTotalization: false } });
    expect(validateEntry(orphan).join()).toMatch(/without an agreement/);
  });

  it("makes a low-confidence entry say what is missing", () => {
    expect(validateEntry(base({ confidence: "low" })).join()).toMatch(/open questions/);
    expect(
      validateEntry(base({ confidence: "low", openQuestions: ["Could not confirm X"] })),
    ).toEqual([]);
  });

  it("rejects a malformed date", () => {
    expect(validateEntry(base({ verifiedOn: "16/10/2026" })).join()).toMatch(/ISO date/);
  });
});

describe("staleness", () => {
  it("counts days between ISO dates", () => {
    expect(daysSince("2026-01-01", "2026-01-31")).toBe(30);
  });

  it("flags an entry only after a year", () => {
    expect(isStale({ verifiedOn: "2026-10-16" }, "2027-10-16")).toBe(false);
    expect(isStale({ verifiedOn: "2026-10-16" }, "2027-10-18")).toBe(true);
    expect(STALE_AFTER_DAYS).toBe(365);
  });

  it("recognises https urls only", () => {
    expect(isHttpsUrl("https://a.gov")).toBe(true);
    expect(isHttpsUrl("http://a.gov")).toBe(false);
    expect(isHttpsUrl("not a url")).toBe(false);
  });
});

describe("published data", () => {
  it("every entry passes validation", () => {
    const problems = WORK_RIGHTS.flatMap(validateEntry);
    expect(problems).toEqual([]);
  });

  it("has one entry per country, no duplicates", () => {
    const codes = WORK_RIGHTS.map((e) => e.countryCode);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("only covers countries the app has cities for, so every page can link somewhere real", () => {
    const known = new Set(CITIES.map((c) => c.country_code));
    for (const e of WORK_RIGHTS) expect(known.has(e.countryCode)).toBe(true);
  });

  it("covers every country the app has a city for, so no page is a dead end", () => {
    const have = new Set(WORK_RIGHTS.map((e) => e.countryCode));
    const missing = [...new Set(CITIES.map((c) => c.country_code))].filter((c) => !have.has(c));
    expect(missing).toEqual([]);
  });

  it("looks entries up case-insensitively", () => {
    const first = WORK_RIGHTS[0];
    if (!first) return;
    expect(workRightsFor(first.countryCode.toLowerCase())?.countryCode).toBe(first.countryCode);
    expect(workRightsFor("ZZ")).toBeNull();
  });
});

describe("employer flag", () => {
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
  const open: PresenceRow[] = [
    {
      user_id: "u1",
      country_code: "TH",
      entry_date: "2026-06-10",
      exit_date: null,
      logged_at: "2026-06-10T00:00:00Z",
    },
  ];
  const closed: PresenceRow[] = [
    {
      user_id: "u1",
      country_code: "TH",
      entry_date: "2026-06-01",
      exit_date: "2026-06-05",
      logged_at: "2026-06-06T00:00:00Z",
    },
  ];
  const lookup = (code: string) =>
    code === "TH"
      ? base({
          countryCode: "TH",
          country: "Thailand",
          visitorWork: {
            status: "not_permitted",
            summary: "x",
            sources: [{ label: "a", url: "https://a.gov" }],
          },
        })
      : null;

  const run = (rows: PresenceRow[], withLookup: boolean) => {
    const overview = buildOrgOverview(rows, members, [], TODAY);
    return buildActionItems(overview, rows, [], TODAY, withLookup ? { workRights: lookup } : {});
  };

  it("prompts when someone is currently in a country whose visitor status is not for work", () => {
    const item = run(open, true).find((i) => i.id === "work-TH-u1");
    expect(item?.severity).toBe("soon");
    expect(item?.detail).toMatch(/not whether this person is compliant/);
  });

  it("stays quiet for a trip that has ended", () => {
    expect(run(closed, true).some((i) => i.id.startsWith("work-"))).toBe(false);
  });

  it("stays quiet when no guide data is supplied", () => {
    expect(run(open, false).some((i) => i.id.startsWith("work-"))).toBe(false);
  });
});
