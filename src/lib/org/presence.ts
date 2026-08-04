/**
 * Employer-side presence maths.
 *
 * ============================ READ THIS FIRST ============================
 * Same discipline as the personal tax report: this module produces EVIDENCE,
 * never CONCLUSIONS. It says "recorded presence exceeds the policy limit" and
 * "recorded presence approaches the permanent-establishment benchmark". It
 * must never say a company HAS a permanent establishment or that an employee
 * IS tax resident — both turn on facts this app cannot see (contracts,
 * authority to conclude business, habitual abode, treaty tie-breakers).
 *
 * It also only ever consumes rows from the `org_member_presence` view:
 * country code, entry date, exit date, logged-at. If you find yourself
 * needing a city, a note or an income figure here, the answer is no.
 * =========================================================================
 */
import { toDayIndex, fromDayIndex, SCHENGEN_COUNTRIES } from "@/lib/schengen";
import { basisFor } from "@/lib/reports/tax-report";

export type PresenceRow = {
  user_id: string;
  trip_id?: string;
  country_code: string;
  entry_date: string;
  exit_date: string | null;
  logged_at?: string | null;
};

export type OrgPolicy = {
  id: string;
  country_code: string | null;
  max_days: number;
  requires_approval: boolean;
  note: string;
};

export type MemberRef = {
  user_id: string | null;
  member_id: string;
  display_name: string;
  invite_email: string | null;
  role: string;
  status: string;
  joined_at: string | null;
};

/**
 * OECD 2025 commentary introduced a 50%-of-working-time benchmark measured
 * over a rolling 12 months when weighing permanent-establishment exposure.
 * 50% of a 365-day year is 182.5 days; we round down so the flag fires early.
 */
export const PE_BENCHMARK_DAYS = 182;
export const PE_BENCHMARK_LABEL =
  "OECD 2025 commentary: 50% of working time over a rolling 12 months";
export const ROLLING_WINDOW_DAYS = 365;

export type RiskLevel = "clear" | "approaching" | "over";

/** Inclusive-of-both-ends day count, clamped to [windowStart, windowEnd]. */
export function daysInWindow(
  row: PresenceRow,
  windowStart: string,
  windowEnd: string,
): number {
  const start = Math.max(toDayIndex(row.entry_date), toDayIndex(windowStart));
  const end = Math.min(
    toDayIndex(row.exit_date ?? windowEnd),
    toDayIndex(windowEnd),
  );
  return end < start ? 0 : end - start + 1;
}

export function rollingWindow(todayIso: string): { start: string; end: string } {
  const end = toDayIndex(todayIso);
  return { start: fromDayIndex(end - (ROLLING_WINDOW_DAYS - 1)), end: todayIso };
}

export type CountryMemberStat = {
  user_id: string;
  display_name: string;
  days: number;
  longestStay: number;
  openStay: boolean;
  thresholdDays: number;
  policyMaxDays: number | null;
  requiresApproval: boolean;
  risk: RiskLevel;
};

export type CountryExposure = {
  country_code: string;
  country: string;
  isSchengen: boolean;
  employeeCount: number;
  totalDays: number;
  longestSingleStay: number;
  thresholdDays: number;
  policyMaxDays: number | null;
  requiresApproval: boolean;
  peApproaching: boolean;
  peExceeded: boolean;
  risk: RiskLevel;
  members: CountryMemberStat[];
};

export type MemberRisk = {
  user_id: string;
  display_name: string;
  risk: RiskLevel;
  countries: {
    country_code: string;
    country: string;
    days: number;
    thresholdDays: number;
    policyMaxDays: number | null;
    risk: RiskLevel;
  }[];
  peDaysMax: number;
  peCountry: string | null;
};

export type PresenceQualityFlag = {
  kind: "open_trip" | "gap" | "retrospective" | "no_data";
  label: string;
  detail: string;
  user_id: string | null;
};

export type OrgOverview = {
  windowStart: string;
  windowEnd: string;
  countries: CountryExposure[];
  members: MemberRisk[];
  counts: { over: number; approaching: number; clear: number; noData: number };
  flags: PresenceQualityFlag[];
};

function policyFor(policies: OrgPolicy[], code: string): OrgPolicy | null {
  return (
    policies.find((p) => p.country_code?.toUpperCase() === code.toUpperCase()) ??
    policies.find((p) => !p.country_code) ??
    null
  );
}

function riskFrom(days: number, threshold: number, policyMax: number | null): RiskLevel {
  const limits = [threshold, policyMax ?? Number.POSITIVE_INFINITY];
  const limit = Math.min(...limits);
  if (days > limit) return "over";
  if (days >= limit * 0.8) return "approaching";
  return "clear";
}

const RANK: Record<RiskLevel, number> = { clear: 0, approaching: 1, over: 2 };
const worst = (a: RiskLevel, b: RiskLevel): RiskLevel => (RANK[a] >= RANK[b] ? a : b);

export function buildOrgOverview(
  rows: PresenceRow[],
  members: MemberRef[],
  policies: OrgPolicy[],
  todayIso: string,
): OrgOverview {
  const { start, end } = rollingWindow(todayIso);
  const active = members.filter((m) => m.status === "active" && m.user_id);
  const nameOf = (id: string) =>
    active.find((m) => m.user_id === id)?.display_name ||
    active.find((m) => m.user_id === id)?.invite_email ||
    "Team member";

  // country -> user -> stats
  const byCountry = new Map<string, Map<string, CountryMemberStat>>();

  for (const row of rows) {
    const days = daysInWindow(row, start, end);
    if (days <= 0) continue;
    const code = row.country_code.toUpperCase();
    const basis = basisFor(code);
    const policy = policyFor(policies, code);
    const bucket = byCountry.get(code) ?? new Map<string, CountryMemberStat>();
    const existing = bucket.get(row.user_id);
    const stat: CountryMemberStat = existing ?? {
      user_id: row.user_id,
      display_name: nameOf(row.user_id),
      days: 0,
      longestStay: 0,
      openStay: false,
      thresholdDays: basis.thresholdDays,
      policyMaxDays: policy?.max_days ?? null,
      requiresApproval: policy?.requires_approval ?? false,
      risk: "clear",
    };
    stat.days += days;
    stat.longestStay = Math.max(stat.longestStay, days);
    stat.openStay = stat.openStay || row.exit_date === null;
    bucket.set(row.user_id, stat);
    byCountry.set(code, bucket);
  }

  const countries: CountryExposure[] = [];
  for (const [code, bucket] of byCountry) {
    const basis = basisFor(code);
    const policy = policyFor(policies, code);
    const memberStats = [...bucket.values()].map((s) => ({
      ...s,
      risk: riskFrom(s.days, s.thresholdDays, s.policyMaxDays),
    }));
    memberStats.sort((a, b) => b.days - a.days);
    const totalDays = memberStats.reduce((n, s) => n + s.days, 0);
    const longestSingleStay = memberStats.reduce((n, s) => Math.max(n, s.longestStay), 0);
    const peMax = memberStats.reduce((n, s) => Math.max(n, s.days), 0);
    countries.push({
      country_code: code,
      country: basis.country,
      isSchengen: SCHENGEN_COUNTRIES.has(code),
      employeeCount: memberStats.length,
      totalDays,
      longestSingleStay,
      thresholdDays: basis.thresholdDays,
      policyMaxDays: policy?.max_days ?? null,
      requiresApproval: policy?.requires_approval ?? false,
      peApproaching: peMax >= PE_BENCHMARK_DAYS * 0.8 && peMax < PE_BENCHMARK_DAYS,
      peExceeded: peMax >= PE_BENCHMARK_DAYS,
      risk: memberStats.reduce<RiskLevel>((r, s) => worst(r, s.risk), "clear"),
      members: memberStats,
    });
  }
  countries.sort((a, b) => RANK[b.risk] - RANK[a.risk] || b.totalDays - a.totalDays);

  const memberRisks: MemberRisk[] = active.map((m) => {
    const id = m.user_id as string;
    const entries = countries
      .map((c) => {
        const s = c.members.find((x) => x.user_id === id);
        return s
          ? {
              country_code: c.country_code,
              country: c.country,
              days: s.days,
              thresholdDays: s.thresholdDays,
              policyMaxDays: s.policyMaxDays,
              risk: s.risk,
            }
          : null;
      })
      .filter(Boolean) as MemberRisk["countries"];
    entries.sort((a, b) => b.days - a.days);
    const peTop = entries[0];
    return {
      user_id: id,
      display_name: m.display_name || m.invite_email || "Team member",
      risk: entries.reduce<RiskLevel>((r, e) => worst(r, e.risk), "clear"),
      countries: entries,
      peDaysMax: peTop?.days ?? 0,
      peCountry: peTop?.country ?? null,
    };
  });
  memberRisks.sort((a, b) => RANK[b.risk] - RANK[a.risk] || b.peDaysMax - a.peDaysMax);

  const withData = new Set(rows.map((r) => r.user_id));
  const counts = {
    over: memberRisks.filter((m) => m.risk === "over").length,
    approaching: memberRisks.filter((m) => m.risk === "approaching").length,
    clear: memberRisks.filter((m) => m.risk === "clear" && withData.has(m.user_id)).length,
    noData: memberRisks.filter((m) => !withData.has(m.user_id)).length,
  };

  return {
    windowStart: start,
    windowEnd: end,
    countries,
    members: memberRisks,
    counts,
    flags: presenceQualityFlags(rows, active, todayIso),
  };
}

/**
 * Honesty layer. An audit trail that overstates its own reliability is a
 * liability, so every export carries these caveats alongside the numbers.
 * The data is self-reported by employees; nothing here detects presence.
 */
export function presenceQualityFlags(
  rows: PresenceRow[],
  members: MemberRef[],
  todayIso: string,
): PresenceQualityFlag[] {
  const flags: PresenceQualityFlag[] = [];
  const byUser = new Map<string, PresenceRow[]>();
  for (const r of rows) {
    const list = byUser.get(r.user_id) ?? [];
    list.push(r);
    byUser.set(r.user_id, list);
  }

  for (const m of members) {
    if (!m.user_id) continue;
    const name = m.display_name || m.invite_email || "Team member";
    const list = byUser.get(m.user_id);
    if (!list || list.length === 0) {
      flags.push({
        kind: "no_data",
        label: `${name} has logged no travel`,
        detail:
          "No entries recorded. Absence of entries is not evidence of absence of travel.",
        user_id: m.user_id,
      });
      continue;
    }
    const sorted = [...list].sort(
      (a, b) => toDayIndex(a.entry_date) - toDayIndex(b.entry_date),
    );
    for (const r of sorted) {
      if (!r.exit_date) {
        flags.push({
          kind: "open_trip",
          label: `${name}: open stay in ${r.country_code}`,
          detail: `Entered ${r.entry_date}, no exit date recorded. Counted to ${todayIso}.`,
          user_id: m.user_id,
        });
      }
      if (r.logged_at) {
        const loggedDay = toDayIndex(r.logged_at.slice(0, 10));
        if (loggedDay - toDayIndex(r.entry_date) > 30) {
          flags.push({
            kind: "retrospective",
            label: `${name}: retrospective entry for ${r.country_code}`,
            detail: `Entry dated ${r.entry_date} was logged on ${r.logged_at.slice(0, 10)}.`,
            user_id: m.user_id,
          });
        }
      }
    }
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      if (!prev.exit_date) continue;
      const gap = toDayIndex(next.entry_date) - toDayIndex(prev.exit_date) - 1;
      if (gap >= 3) {
        flags.push({
          kind: "gap",
          label: `${name}: ${gap}-day gap in the record`,
          detail: `No country recorded between ${prev.exit_date} and ${next.entry_date}.`,
          user_id: m.user_id,
        });
      }
    }
  }
  return flags;
}

/* -------------------------------------------------------------------- */
/* Travel-request impact preview                                        */
/* -------------------------------------------------------------------- */

export type RequestImpact = {
  country_code: string;
  country: string;
  requestedDays: number;
  currentDays: number;
  projectedDays: number;
  thresholdDays: number;
  policyMaxDays: number | null;
  requiresApproval: boolean;
  risk: RiskLevel;
  /** Evidence sentence shown before any approval decision is taken. */
  sentence: string;
};

export function requestImpact(
  input: { user_id: string; country_code: string; start_date: string; end_date: string },
  rows: PresenceRow[],
  policies: OrgPolicy[],
  displayName: string,
  todayIso: string,
): RequestImpact {
  const code = input.country_code.toUpperCase();
  const basis = basisFor(code);
  const policy = policyFor(policies, code);
  const { start, end } = rollingWindow(todayIso);

  const currentDays = rows
    .filter((r) => r.user_id === input.user_id && r.country_code.toUpperCase() === code)
    .reduce((n, r) => n + daysInWindow(r, start, end), 0);

  const requestedDays =
    toDayIndex(input.end_date) - toDayIndex(input.start_date) + 1;
  const projectedDays = currentDays + Math.max(requestedDays, 0);
  const policyMax = policy?.max_days ?? null;
  const risk = riskFrom(projectedDays, basis.thresholdDays, policyMax);

  const limitClause =
    policyMax !== null && projectedDays > policyMax
      ? `past the ${policyMax}-day policy limit`
      : projectedDays > basis.thresholdDays
        ? `past the ${basis.thresholdDays}-day tax-residency threshold`
        : `within the ${Math.min(basis.thresholdDays, policyMax ?? Number.POSITIVE_INFINITY)}-day limit`;

  return {
    country_code: code,
    country: basis.country,
    requestedDays: Math.max(requestedDays, 0),
    currentDays,
    projectedDays,
    thresholdDays: basis.thresholdDays,
    policyMaxDays: policyMax,
    requiresApproval: policy?.requires_approval ?? false,
    risk,
    sentence: `${requestedDays} days in ${basis.country} would put ${displayName} at ${projectedDays} days for the rolling year, ${limitClause}.`,
  };
}
