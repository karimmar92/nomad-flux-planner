/**
 * VALUE BEFORE PRICE.
 *
 * Every paywall in this app has to answer "what do I get" before it shows a
 * number. Not a feature list — the *outcome*, phrased as the thing that stops
 * being the user's problem. The price is one line under it, and there is
 * exactly one button.
 *
 * Keeping the copy here rather than at the call sites means the wall says the
 * same thing wherever it opens, and a claim can be corrected in one place.
 */
import type { ProFeature } from "@/lib/entitlements";

export type PaywallCopy = {
  /** The outcome, in the user's words. Shown as the headline. */
  outcome: string;
  /** Three concrete things they get. No adjectives, no "powerful". */
  gets: string[];
  /** Honest limit, always shown. The wall is not a sales page. */
  limit: string;
};

const DEFAULT: PaywallCopy = {
  outcome: "Stop counting days by hand.",
  gets: [
    "Your leave-by date, recalculated on every trip you log",
    "The next move planned before it becomes urgent",
    "One record you can hand to an accountant",
  ],
  limit: "It counts what you enter. It is not legal or tax advice.",
};

export const PAYWALL_COPY: Record<ProFeature, PaywallCopy> = {
  border_run_full: {
    outcome: "Know where to go next — not just that you have to leave.",
    gets: [
      "Every exit ranked on your visa maths and your income",
      "Cost delta and days available for each destination",
      "Nomad-visa eligibility checked against what you earn",
    ],
    limit: "Costs are estimates from public data, not quotes.",
  },
  forward_planning: {
    outcome: "Answer “can I book this?” before you book it.",
    gets: [
      "Any future entry date tested against your rolling window",
      "A whole year of planned trips checked at once",
      "The exact day a plan starts to break",
    ],
    limit: "Based on the trips you have entered. Wrong dates in, wrong dates out.",
  },
  compare: {
    outcome: "Pick between cities on numbers, not on feel.",
    gets: [
      "Two to four cities side by side on cost, visa and days",
      "The same figures the city pages use, no partner weighting",
      "Your income applied to each one",
    ],
    limit: "Cost of living is an estimate; your rent will differ.",
  },
  arbitrage_ranking: {
    outcome: "See what a move is actually worth, everywhere.",
    gets: [
      "Every city ranked on what you would save or spend",
      "A savings target you can work backwards from",
      "Visa and tax constraints folded into the ranking",
    ],
    limit: "Estimates. They do not know your lease or your clients.",
  },
  threshold_alerts: {
    outcome: "Be told at 75%, not at 100%.",
    gets: [
      "Alerts at 75% and 90% of any limit you are approaching",
      "Email and in-app, on every threshold you track",
      "Enough notice to change a flight cheaply",
    ],
    limit: "Alerts follow the trips you log. Nothing is filed for you.",
  },
  calendar_horizon: {
    outcome: "See the whole year, not the next 30 days.",
    gets: [
      "Every deadline, renewal and threshold for 12 months ahead",
      "Overlaps visible before two of them collide",
      "Exportable to your own calendar",
    ],
    limit: "Dates come from your trips and public rules, not from any authority.",
  },
  tax_report: {
    outcome: "Have the evidence before anyone asks for it.",
    gets: [
      "Days present per country, against each threshold, per tax year",
      "Non-calendar tax years handled properly",
      "Wording an accountant can use as a starting point",
    ],
    limit: "It records presence. It never concludes that you are tax resident.",
  },
  exports: {
    outcome: "Get your record out, in a form someone else accepts.",
    gets: [
      "PDF and CSV of presence, trips and thresholds",
      "Multi-year history in one file",
      "Formatted for an accountant, not for us",
    ],
    limit: "An export is a record of what you entered, not a certified document.",
  },
  vault: {
    outcome: "Have the document at the border, with no signal.",
    gets: [
      "Passport, visas, insurance and contracts stored encrypted",
      "Cached offline — it opens on a plane and at a desk",
      "Expiry tracking so nothing lapses quietly",
    ],
    limit: "Storage, not verification. We do not vouch for a document.",
  },
};

export function paywallCopy(feature: ProFeature | null): PaywallCopy {
  if (!feature) return DEFAULT;
  return PAYWALL_COPY[feature] ?? DEFAULT;
}
