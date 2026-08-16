/**
 * The EU Entry/Exit System — one source of truth for dates and claims.
 *
 * WHY THIS FILE EXISTS AT ALL. Until now the product's implicit pitch was
 * "count your own days, because passport stamps get missed or smudged". As of
 * 10 April 2026 that problem is largely solved: EES replaced stamping with a
 * biometric record and computes the 90/180 itself.
 *
 * That does not make the product redundant, and it is worth being precise
 * about why, because the honest version is also the stronger one:
 *
 *   EES tells you at the border. It knows your number at the moment you are
 *   standing in front of an officer, which is the moment it is too late to
 *   change anything. It will not tell you in June that the October plan you
 *   are about to book does not work.
 *
 * So the value moves from counting to forecasting. Same maths, different job.
 *
 * A SECOND-ORDER EFFECT THAT MATTERS MORE. Overstays are now detected
 * automatically and retained for five years, readable by every border officer
 * and consulate in the area. The old failure mode — an inconsistent stamp, a
 * quiet overstay nobody noticed — is closing. This raises the cost of being
 * wrong, which is the real argument for planning ahead.
 *
 * EVERY DATE HERE IS SOURCED. Do not edit from memory; these numbers are
 * checkable and being wrong about them is worse than saying nothing:
 *   https://home-affairs.ec.europa.eu/news/entryexit-system-ees-fully-operational-2026-04-10_en
 *   https://home-affairs.ec.europa.eu/policies/schengen/smart-borders/entry-exit-system_en
 */

export const EES = {
  /** Phased rollout began. */
  rolloutStart: "2025-10-12",
  /** Fully operational across all Schengen states. */
  fullyOperational: "2026-04-10",
  /**
   * Member states may ease or pause checks to manage queues for a limited
   * period after full operation. Stated as a bound, not a promise: the point
   * for a traveller is that it ends, not when.
   */
  flexibilityEndsBy: "2026-09-30",
  /** How long an overstay record is retained and visible. */
  overstayRecordYears: 5,
} as const;

/**
 * What EES changed, in the order a traveller cares about.
 *
 * Deliberately does not include "you no longer need to track your days". That
 * would be false: EES does not publish a running total to the traveller, and a
 * number you can only obtain by presenting yourself at a border is not a
 * planning tool.
 */
export const EES_CHANGES: { title: string; body: string }[] = [
  {
    title: "Your passport is no longer stamped",
    body: "Entries and exits are recorded biometrically instead: facial image, fingerprints, and the date and place of each crossing. If your method for counting days was flicking through stamps, that method has run out. There is nothing to flick through.",
  },
  {
    title: "Overstays are detected automatically",
    body: `The system computes the 90/180 itself and flags anyone over it. The record is kept for ${EES.overstayRecordYears} years and is visible to border officers and consulates across all 29 countries, so it follows you into later visa applications rather than ending at the airport.`,
  },
  {
    title: "It tells you at the border, which is too late",
    body: "EES knows your number when you are standing in front of an officer. It will not warn you in advance, and it will not tell you whether the trip you are about to book fits. That gap is the only reason to count your own days now.",
  },
  {
    title: "The 90/180 rule itself did not change",
    body: "Same 90 days, same rolling 180-day window, same 29 countries sharing one allowance. Only the enforcement changed, and it got considerably better at its job.",
  },
];
