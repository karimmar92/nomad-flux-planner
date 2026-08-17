/**
 * FOUNDING 100 — one-time payment, Pro forever.
 *
 * ── WHY THIS PRICE ────────────────────────────────────────────────────
 *
 * $149 once. Pro is $29/mo, so this is about five months of Pro for
 * permanent access. Reasoning, since the number is a business decision and
 * not a guess:
 *
 *   Too low ($29-49) and it converts people who will never open the app
 *   again. Those buyers are worse than no buyers: they generate support
 *   load, no feedback, and no advocacy, and they permanently occupy a
 *   scarce spot.
 *
 *   Too high ($249+) will not convert against zero social proof. Nobody
 *   pays a year of a product's price up front when the landing page
 *   admits it has no customers yet. That admission is the right call, but
 *   it caps what a first cohort will pay.
 *
 *   $149 is still a single evening out for someone earning $3,000+/month
 *   remotely, which is the ICP. Low enough to decide alone, high enough
 *   that the buyer opens the app to justify it. That second part is the
 *   actual product: a hundred people with a reason to give feedback.
 *
 * The goal here is NOT revenue. 100 x $149 is $14,900, which does not fund
 * anything meaningful. The goal is a hundred real users, a hundred real
 * conversations, and proof that strangers will pay for this at all.
 *
 * ── WHY PRO AND NOT "EVERYTHING" ──────────────────────────────────────
 *
 * Teams is deliberately excluded. It is priced per seat because the cost
 * scales per seat, and granting unlimited seats forever to a hundred
 * accounts is how a lifetime deal turns into an unbounded liability. The
 * offer is one person, Pro, forever. That is generous and it is bounded.
 *
 * ── WHY THE COUNTER MUST BE REAL ──────────────────────────────────────
 *
 * The remaining count comes from a COUNT() on the database, not from a
 * constant somebody edits. Two reasons, and the second is the one that
 * actually matters:
 *
 *   1. A fake scarcity counter is misleading advertising. In Germany that
 *      is actionable under the UWG, and "only 100 spots" that quietly
 *      becomes 150 is exactly the pattern regulators and competitors look
 *      for.
 *
 *   2. This product's entire position is that it tells people
 *      uncomfortable truths and shows its workings. A landing page that
 *      admits it has no customers cannot also run a fake urgency timer.
 *      One of those is a lie and it poisons the other.
 *
 * When the hundredth spot goes, the offer closes and stays closed. If
 * that turns out to be a mistake, the honest fix is a new, clearly
 * different offer, not quietly raising the cap.
 */

/**
 * One-time price in USD. Displayed and charged; there is no VAT on top.
 *
 * WHY 149 AND NOT 99. Two reasons, and the tax one is the lesser of them.
 *
 * At $99 against a $29/month plan, a founding spot paid for itself in 3.4
 * months. Lifetime deals conventionally price at ten to twenty times monthly;
 * $99 sat below that range, which reads as low confidence in the product and
 * selects for people hunting a bargain rather than people who would otherwise
 * have paid $29 a month. A founding cohort is meant to be the second group.
 *
 * The tax argument is structural. Prices here are INCLUSIVE and final. Today
 * the § 19 UStG exemption means all of it lands; once cross-border B2C digital
 * sales pass €10,000 a year, VAT is owed in the customer's country at 17–27%.
 * At $149 inclusive the net after German VAT is about $121, still comfortably
 * above the ~$96 that $99 nets today with no VAT at all. So the price survives
 * the threshold without a second increase.
 *
 * That matters more than it sounds: raising the price of something sold as
 * "lifetime" is the kind of thing customers write posts about. Better to price
 * once, correctly, than to price low and correct it in public later.
 */
export const FOUNDING_PRICE_USD = 149;

/** Hard cap. Enforced in the database, not just in the UI. */
export const FOUNDING_SPOTS = 100;

/**
 * Stripe lookup key for the one-time price.
 *
 * A lookup key rather than an env var, matching how the subscription prices
 * work since the move to Lovable payments: the same key resolves in sandbox
 * and live, so there is no test price id that can leak into production.
 *
 * The price behind it must be ONE-TIME, not recurring. Mixing those up
 * produces a customer charged $149 every month.
 */
export const FOUNDING_PRICE_LOOKUP_KEY = "founding_lifetime";

/** What a founding member gets, stated plainly enough to be held to. */
export const FOUNDING_INCLUDES = [
  "Everything in Pro, for as long as Driftly exists",
  "Border-run planning, threshold alerts and the compliance calendar",
  "The tax presence report and every export",
  "The document vault, with second-factor protection",
  "Full arbitrage ranking across every city",
  "New Pro features as they ship, at no extra cost",
] as const;

/**
 * Stated as clearly as the inclusions. A lifetime promise that quietly
 * excludes things is the kind of detail that produces chargebacks, and a
 * chargeback costs more than the sale.
 */
export const FOUNDING_EXCLUDES = [
  "Team seats and the employer dashboard, which are priced per seat",
  "Anything a third party charges for directly, such as an eSIM or a visa fee",
] as const;

/**
 * The honest risk disclosure.
 *
 * Legally useful and commercially useful. "Lifetime" means the life of
 * the product, and a buyer who understands that before paying does not
 * file a dispute two years later. Saying it out loud also converts better
 * with this audience than pretending the risk does not exist.
 */
// Interpolated, not hardcoded. The price appeared here as a literal "$99" and
// stayed wrong for a whole commit after the price moved — in the one paragraph
// whose entire job is being straight with the buyer.
export const FOUNDING_RISK_NOTE = `Lifetime means the life of the product, and Driftly is built by one person with no customers yet. If it shuts down, it stops. Your data is exportable at any time and stays yours either way. Buy this because $${FOUNDING_PRICE_USD} is worth the tool to you today, not as a bet on a company.`;

export function foundingRemaining(taken: number): number {
  return Math.max(0, FOUNDING_SPOTS - taken);
}

export function foundingIsOpen(taken: number): boolean {
  return foundingRemaining(taken) > 0;
}

/**
 * What the counter says.
 *
 * Under ten left is stated exactly, because at that point the number is
 * genuinely the decision-relevant fact. Above that it is rounded to avoid
 * the drip-feed urgency pattern ("only 63 left!") that reads as a growth
 * tactic rather than information.
 */
export function foundingCounterLabel(taken: number): string {
  const left = foundingRemaining(taken);
  if (left === 0) return "All 100 spots taken";
  if (left <= 10) return `${left} of ${FOUNDING_SPOTS} spots left`;
  return `${taken} of ${FOUNDING_SPOTS} taken`;
}
