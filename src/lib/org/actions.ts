/**
 * "Needs attention" — the short list an HR or finance admin acts on today.
 *
 * Most compliance dashboards are archives: they show where everyone has been.
 * An admin opening one wants the opposite question answered: what do I have to
 * do, and by when? This turns the existing overview into that ranked list,
 * including a forward-looking date for anyone currently abroad.
 *
 * Same discipline as presence.ts: this states RECORDED presence and a
 * PROJECTION from it. It never says a threshold "was crossed" as a legal
 * conclusion, only that recorded days reach a number, and the forecast says
 * what it ignores.
 */
import { fromDayIndex, toDayIndex } from "@/lib/schengen";
import type { OrgOverview, PresenceRow } from "./presence";

export type ActionSeverity = "urgent" | "soon" | "housekeeping";
export type ActionTab = "Risk" | "Countries" | "Employees" | "Requests" | "Seats";

export type ActionItem = {
  id: string;
  severity: ActionSeverity;
  title: string;
  detail: string;
  tab: ActionTab;
  /** Days until a projected limit, for ordering urgent items. Lower is sooner. */
  sortKey: number;
};

export type PendingRequest = { id: string; created_at: string; status: string };

/** An open stay this old with no exit date is more likely forgotten than real. */
export const STALE_OPEN_STAY_DAYS = 60;
/** How far ahead a projected crossing is worth interrupting someone for. */
export const FORECAST_HORIZON_DAYS = 30;
/** Inside this many days a projected crossing is urgent rather than "soon". */
export const FORECAST_URGENT_DAYS = 7;

const RANK: Record<ActionSeverity, number> = { urgent: 0, soon: 1, housekeeping: 2 };

function limitOf(thresholdDays: number, policyMaxDays: number | null): number {
  return Math.min(thresholdDays, policyMaxDays ?? Number.POSITIVE_INFINITY);
}

/**
 * Date a stay that is still open will reach `limit` recorded days, if it
 * simply continues. Conservative on purpose: it ignores days that roll out of
 * the 12-month window in the meantime, which can only push the real date
 * later, so the warning never fires late because of this simplification.
 */
export function projectedCrossing(
  recordedDays: number,
  limit: number,
  todayIso: string,
): { date: string; inDays: number } | null {
  if (recordedDays > limit) return null;
  const inDays = limit - recordedDays + 1;
  return { date: fromDayIndex(toDayIndex(todayIso) + inDays), inDays };
}

export function buildActionItems(
  overview: OrgOverview,
  rows: PresenceRow[],
  requests: PendingRequest[],
  todayIso: string,
  /** Dated projections are a Pro feature; without them the person still shows as approaching. */
  opts: { forecast?: boolean } = {},
): ActionItem[] {
  const forecast = opts.forecast ?? true;
  const items: ActionItem[] = [];
  const today = toDayIndex(todayIso);

  // 1. Requests waiting on a decision.
  const pending = requests.filter((r) => r.status === "pending");
  if (pending.length > 0) {
    const oldest = Math.max(...pending.map((r) => today - toDayIndex(r.created_at.slice(0, 10))));
    items.push({
      id: "requests",
      severity: oldest >= 3 ? "urgent" : "soon",
      title: `${pending.length} travel ${pending.length === 1 ? "request" : "requests"} waiting for a decision`,
      detail:
        oldest <= 0
          ? "The oldest arrived today. The compliance impact is shown before you approve."
          : `The oldest has been waiting ${oldest} ${oldest === 1 ? "day" : "days"}.`,
      tab: "Requests",
      sortKey: -oldest,
    });
  }

  // 2. Per person, per country.
  for (const c of overview.countries) {
    for (const m of c.members) {
      const limit = limitOf(m.thresholdDays, m.policyMaxDays);
      const policyBound = m.policyMaxDays !== null && m.policyMaxDays <= m.thresholdDays;
      const limitLabel = policyBound ? `${limit}-day policy limit` : `${limit}-day threshold`;

      if (m.days > limit) {
        items.push({
          id: `over-${c.country_code}-${m.user_id}`,
          severity: "urgent",
          title: `${m.display_name} is past the ${limitLabel} in ${c.country}`,
          detail: `${m.days} recorded days in the last 12 months.${m.openStay ? " The stay is still open." : ""}`,
          tab: "Countries",
          sortKey: limit - m.days,
        });
        continue;
      }

      const crossing = forecast && m.openStay ? projectedCrossing(m.days, limit, todayIso) : null;
      if (crossing && crossing.inDays <= FORECAST_HORIZON_DAYS) {
        items.push({
          id: `forecast-${c.country_code}-${m.user_id}`,
          severity: crossing.inDays <= FORECAST_URGENT_DAYS ? "urgent" : "soon",
          title: `${m.display_name} is projected to pass the ${limitLabel} in ${c.country} on ${crossing.date}`,
          detail: `${m.days} of ${limit} days recorded, and the stay is still open. Assumes they stay; days rolling out of the 12-month window can only make the real date later.`,
          tab: "Countries",
          sortKey: crossing.inDays,
        });
        continue;
      }

      if (m.risk === "approaching") {
        items.push({
          id: `approaching-${c.country_code}-${m.user_id}`,
          severity: "soon",
          title: `${m.display_name} is at ${m.days} of ${limit} days in ${c.country}`,
          detail: `Within 20% of the ${limitLabel}. Worth raising before the next trip is planned.`,
          tab: "Countries",
          sortKey: limit - m.days,
        });
      }
    }

    // 3. Permanent-establishment benchmark, reported per country.
    if (c.peExceeded || c.peApproaching) {
      items.push({
        id: `pe-${c.country_code}`,
        severity: c.peExceeded ? "urgent" : "soon",
        title: c.peExceeded
          ? `Recorded presence in ${c.country} has reached the permanent-establishment benchmark`
          : `Recorded presence in ${c.country} is approaching the permanent-establishment benchmark`,
        detail:
          "Based on one person's recorded days. This is a prompt to take advice, not a finding that an establishment exists.",
        tab: "Risk",
        sortKey: c.peExceeded ? -1 : 1000,
      });
    }
  }

  // 4. Stale open stays: likely a forgotten exit date, and it inflates the count.
  const nameOf = (id: string) => overview.members.find((m) => m.user_id === id)?.display_name;
  for (const r of rows) {
    if (r.exit_date !== null) continue;
    const age = today - toDayIndex(r.entry_date);
    if (age < STALE_OPEN_STAY_DAYS) continue;
    items.push({
      id: `stale-${r.user_id}-${r.country_code}-${r.entry_date}`,
      severity: "housekeeping",
      title: `${nameOf(r.user_id) ?? "A team member"} has an open stay in ${r.country_code} since ${r.entry_date}`,
      detail: `${age} days with no exit date. If they have left, the count is overstated until it is closed.`,
      tab: "Employees",
      sortKey: -age,
    });
  }

  // 5. Seats that have never logged anything.
  if (overview.counts.noData > 0) {
    const n = overview.counts.noData;
    items.push({
      id: "no-data",
      severity: "housekeeping",
      title: `${n} ${n === 1 ? "seat has" : "seats have"} logged no travel`,
      detail: "Absence of entries is not evidence of absence of travel.",
      tab: "Employees",
      sortKey: 0,
    });
  }

  return items.sort((a, b) => RANK[a.severity] - RANK[b.severity] || a.sortKey - b.sortKey);
}
