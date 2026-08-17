/**
 * Freelance platform fees.
 *
 * ── WHY A RATE ALONE IS NOT ENOUGH ─────────────────────────────────────
 *
 * The obvious model is one number: "the platform takes 10%". That is what the
 * calculator did, and it quietly answered a question nobody asked, because
 * platforms differ on TWO axes, not one:
 *
 *   RATE     — 10%, 15%, 20%.
 *   BASIS    — what the percentage is charged on.
 *
 * The second is the one that gets missed. Some platforms take a cut of
 * everything that moves through them, including performance bonuses. Others
 * intermediate only the hourly engagement, and a bonus the client pays directly
 * never touches the platform.
 *
 * With a $40/h rate, 2 clients x 3h x 21 days and $200 x 7 appointments per
 * client, the split is $5,040 hourly and $2,800 appointment fees. A 15% cut on
 * everything costs $1,176 a month; 15% on the hourly portion alone costs $756.
 * That is a $420/month difference — over $5,000 a year — produced entirely by a
 * modelling assumption the user never saw and could not change.
 *
 * So the basis is explicit, selectable, and shown in the output.
 *
 * ── ON THE RATES BELOW ─────────────────────────────────────────────────
 *
 * These are starting points, not quoted terms. Platform pricing changes, varies
 * by contract type and by how long a client relationship has run, and several
 * of these have changed their structure more than once. They are presets to
 * save typing, and the custom option exists because the user's actual contract
 * beats our table every time. The UI says so rather than implying these are
 * authoritative.
 */

/** What the percentage is charged on. */
export type FeeBasis = "all" | "hourly";

export type PlatformPreset = {
  id: string;
  label: string;
  /** Fraction, so 0.15 is 15%. */
  rate: number;
  basis: FeeBasis;
  note: string;
};

export const PLATFORM_PRESETS: PlatformPreset[] = [
  {
    id: "flat-10",
    label: "10% on everything",
    rate: 0.1,
    basis: "all",
    note: "A flat cut of all earnings routed through the platform, bonuses included.",
  },
  {
    id: "flat-15",
    label: "15% on everything",
    rate: 0.15,
    basis: "all",
    note: "As above at a higher rate. Common on platforms that handle payments and disputes.",
  },
  {
    id: "hourly-10",
    label: "10% on hourly only",
    rate: 0.1,
    basis: "hourly",
    note: "The platform intermediates the hourly engagement; performance fees are paid to you directly.",
  },
  {
    id: "hourly-15",
    label: "15% on hourly only",
    rate: 0.15,
    basis: "hourly",
    note: "As above at a higher rate.",
  },
  {
    id: "flat-20",
    label: "20% on everything",
    rate: 0.2,
    basis: "all",
    note: "Typical of marketplaces that supply the client rather than just the payment rail.",
  },
  {
    id: "direct",
    label: "No platform (direct)",
    rate: 0,
    basis: "all",
    note: "Invoicing the client yourself. No cut, and you carry the collection risk.",
  },
];

/**
 * Clamps a user-entered fee to something arithmetically meaningful.
 *
 * A negative fee would pay the freelancer more than they billed, and anything
 * at or above 100% would make net income zero or negative from a fee alone.
 * Both are input errors rather than scenarios, and letting either through
 * produces a confidently wrong number in a table headed "take-home".
 */
export function clampFeeRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(0.9, rate));
}

export function presetById(id: string): PlatformPreset | undefined {
  return PLATFORM_PRESETS.find((p) => p.id === id);
}
