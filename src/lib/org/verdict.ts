/**
 * The verdict: one answer to "am I exposed anywhere?" before any table.
 *
 * Built backwards from the moment a buyer opens the dashboard. They will not
 * read a grid first; they want to know whether to worry and what to do about
 * it. So the answer is one of four states and one sentence naming the most
 * urgent thing.
 *
 * Two rules keep it honest:
 *  - The level comes from the overview itself, never from the action list,
 *    because the action list is a paid feature. A Basic plan with someone past
 *    a limit must still say "act", not "clear".
 *  - "Clear" is withheld when the evidence is thin. A company where three of
 *    twenty people have logged anything is not clear, it is unknown, and
 *    saying so is the difference between a dashboard and a green light that
 *    means nothing.
 */
import type { ActionItem } from "./actions";
import type { OrgConfidence } from "./confidence";
import type { OrgOverview } from "./presence";

export type VerdictLevel = "act" | "watch" | "clear" | "empty";

export type Verdict = {
  level: VerdictLevel;
  headline: string;
  detail: string;
  /** The single most urgent item, when there is one. */
  topAction: ActionItem | null;
};

export function buildVerdict(
  overview: OrgOverview,
  actions: ActionItem[],
  confidence: OrgConfidence,
  /** Whether the plan projects crossing dates; decides what "clear" may claim. */
  forecasts: boolean,
): Verdict {
  const hasRecords = overview.countries.length > 0;
  const activePeople = confidence.members.length;

  if (!hasRecords) {
    return {
      level: "empty",
      headline: "Nothing recorded yet",
      detail:
        activePeople === 0
          ? "Invite your team to start. Anyone who already tracks trips shares them the moment they accept."
          : "No one has logged travel yet. Their numbers appear as they do.",
      topAction: null,
    };
  }

  const peExceeded = overview.countries.filter((c) => c.peExceeded);
  const peApproaching = overview.countries.filter((c) => c.peApproaching);
  const urgentActions = actions.filter((a) => a.severity === "urgent");
  const urgent = Math.max(urgentActions.length, overview.counts.over + peExceeded.length);

  if (urgent > 0) {
    const overPerson = overview.members.find((m) => m.risk === "over");
    const overCountry = overPerson?.countries.find((c) => c.risk === "over");
    const fallback =
      overPerson && overCountry
        ? `${overPerson.display_name} is past a limit in ${overCountry.country}.`
        : peExceeded[0]
          ? `Recorded presence in ${peExceeded[0].country} has reached the permanent-establishment benchmark.`
          : "Open the list to see what needs a decision.";
    return {
      level: "act",
      headline: `${urgent} ${urgent === 1 ? "thing needs" : "things need"} action now`,
      detail: urgentActions[0]?.title ?? fallback,
      topAction: urgentActions[0] ?? null,
    };
  }

  const soon = actions.filter((a) => a.severity === "soon");
  const watching = Math.max(soon.length, overview.counts.approaching + peApproaching.length);
  if (watching > 0) {
    return {
      level: "watch",
      headline: `Nothing urgent. ${watching} to keep an eye on`,
      detail: soon[0]?.title ?? "Someone is within 20% of a limit.",
      topAction: soon[0] ?? null,
    };
  }

  if (confidence.level === "low" || confidence.level === "none") {
    return {
      level: "watch",
      headline: "No limits crossed, but the records are thin",
      detail:
        confidence.coverage < 50
          ? `Only ${confidence.coverage}% of seats have logged any travel, so this cannot yet be called clear.`
          : "Several records have gaps or old open stays, so the counts may be understated.",
      topAction: null,
    };
  }

  return {
    level: "clear",
    headline: "You are clear",
    detail: forecasts
      ? "No one is past a limit or projected to pass one in the next 30 days."
      : "No one is past a limit and no one is within 20% of one.",
    topAction: null,
  };
}
