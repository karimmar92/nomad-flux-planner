/**
 * Record confidence: how far a day count can be leaned on.
 *
 * Every tool in this category shows a count and lets the reader assume it is
 * right. The count is only as good as the records behind it, and those are
 * self-reported. This scores the RECORD, not the person: an open stay left
 * running for months, overlapping entries, trips logged weeks after the fact,
 * nothing logged for a long time. Each deduction has a stated reason so the
 * score can be argued with, and so an admin knows what to ask an employee to fix.
 *
 * Two numbers are kept apart on purpose. Coverage is how many seats have any
 * record at all; quality is how reliable the records that exist are. A company
 * with one pristine record out of twenty is not "95% reliable".
 */
import { toDayIndex } from "@/lib/schengen";
import type { MemberRef, PresenceRow } from "./presence";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export type MemberConfidence = {
  user_id: string;
  display_name: string;
  /** 0-100. Zero for someone with no record. */
  score: number;
  level: ConfidenceLevel;
  /** What cost points, in plain words. Empty when nothing did. */
  reasons: string[];
};

export type OrgConfidence = {
  members: MemberConfidence[];
  /** Share of active seats with at least one recorded stay, 0-100. */
  coverage: number;
  /** Mean score of the people who do have a record, or null if nobody does. */
  quality: number | null;
  level: ConfidenceLevel;
};

export const STALE_OPEN_DAYS = 60;
export const LATE_LOG_DAYS = 30;
export const SILENT_DAYS = 120;

export const HIGH_SCORE = 85;
export const MEDIUM_SCORE = 60;

export function levelOf(score: number): ConfidenceLevel {
  if (score >= HIGH_SCORE) return "high";
  if (score >= MEDIUM_SCORE) return "medium";
  return "low";
}

function overlapPairs(rows: PresenceRow[], todayIso: string): number {
  const spans = rows
    .map((r) => [toDayIndex(r.entry_date), toDayIndex(r.exit_date ?? todayIso)] as const)
    .sort((a, b) => a[0] - b[0]);
  let pairs = 0;
  let furthest = Number.NEGATIVE_INFINITY;
  for (const [from, to] of spans) {
    if (from <= furthest) pairs += 1;
    furthest = Math.max(furthest, to);
  }
  return pairs;
}

export function memberConfidence(
  member: Pick<MemberRef, "user_id" | "display_name" | "invite_email">,
  rows: PresenceRow[],
  todayIso: string,
): MemberConfidence {
  const id = member.user_id as string;
  const name = member.display_name || member.invite_email || "Team member";
  if (rows.length === 0) {
    return {
      user_id: id,
      display_name: name,
      score: 0,
      level: "none",
      reasons: ["No travel logged"],
    };
  }

  const today = toDayIndex(todayIso);
  const reasons: string[] = [];
  let score = 100;

  const stale = rows.filter(
    (r) => r.exit_date === null && today - toDayIndex(r.entry_date) >= STALE_OPEN_DAYS,
  );
  if (stale.length > 0) {
    score -= Math.min(40, stale.length * 25);
    reasons.push(
      `${stale.length} open ${stale.length === 1 ? "stay" : "stays"} with no exit date for ${STALE_OPEN_DAYS}+ days`,
    );
  }

  const overlaps = overlapPairs(rows, todayIso);
  if (overlaps > 0) {
    score -= Math.min(30, overlaps * 15);
    reasons.push(`${overlaps} overlapping ${overlaps === 1 ? "entry" : "entries"}, counted twice`);
  }

  const late = rows.filter(
    (r) =>
      r.logged_at &&
      toDayIndex(r.logged_at.slice(0, 10)) - toDayIndex(r.entry_date) > LATE_LOG_DAYS,
  );
  if (late.length > 0) {
    score -= Math.min(20, late.length * 5);
    reasons.push(
      `${late.length} ${late.length === 1 ? "entry" : "entries"} logged over ${LATE_LOG_DAYS} days after the trip`,
    );
  }

  const lastLogged = rows
    .map((r) => (r.logged_at ? toDayIndex(r.logged_at.slice(0, 10)) : null))
    .filter((d): d is number => d !== null)
    .sort((a, b) => b - a)[0];
  const hasOpen = rows.some((r) => r.exit_date === null);
  if (lastLogged !== undefined && today - lastLogged > SILENT_DAYS && !hasOpen) {
    score -= 10;
    reasons.push(`Nothing logged for ${SILENT_DAYS}+ days`);
  }

  score = Math.max(0, score);
  return { user_id: id, display_name: name, score, level: levelOf(score), reasons };
}

export function recordConfidence(
  rows: PresenceRow[],
  members: MemberRef[],
  todayIso: string,
): OrgConfidence {
  const active = members.filter((m) => m.status === "active" && m.user_id);
  const byUser = new Map<string, PresenceRow[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);

  const scored = active.map((m) =>
    memberConfidence(m, byUser.get(m.user_id as string) ?? [], todayIso),
  );
  const withData = scored.filter((s) => s.level !== "none");

  const coverage = active.length === 0 ? 0 : Math.round((withData.length / active.length) * 100);
  const quality =
    withData.length === 0
      ? null
      : Math.round(withData.reduce((n, s) => n + s.score, 0) / withData.length);

  let level: ConfidenceLevel;
  if (quality === null) level = "none";
  else if (coverage < 50) level = "low";
  else level = levelOf(quality);

  return { members: scored, coverage, quality, level };
}
