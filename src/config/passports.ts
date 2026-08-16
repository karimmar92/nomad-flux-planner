/**
 * Which rules a passport actually exposes you to.
 *
 * The app has been showing every user a Schengen 90/180 counter since day one,
 * including people who legally have no such limit. An Irish or German citizen
 * has free movement: they can live in Lisbon indefinitely and the count is
 * meaningless to them. Showing it is not a cosmetic error — it teaches the
 * wrong mental model to the person least able to check it.
 *
 * FREE MOVEMENT IS NOT THE SAME SET AS SCHENGEN. This trips people up
 * constantly and the two lists genuinely differ:
 *
 *   Ireland and Cyprus  — EU, so their citizens have free movement, but the
 *                         countries themselves are outside Schengen.
 *   Iceland, Norway,
 *   Liechtenstein       — not EU, but EEA, so free movement applies.
 *   Switzerland         — neither EU nor EEA, but free movement applies by
 *                         bilateral agreement.
 *
 * So this list is "whose citizens move freely", which is what determines
 * whether the 90/180 count binds them. `SCHENGEN_COUNTRIES` in lib/schengen.ts
 * is a different question — "which territory does the count apply to" — and
 * the two must not be merged, however similar they look.
 */

/**
 * Citizenships with free movement in the EU/EEA/Switzerland.
 *
 * EU27 + Iceland, Liechtenstein, Norway + Switzerland.
 */
export const FREE_MOVEMENT_PASSPORTS = new Set([
  // EU27
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
  // EEA (non-EU)
  "IS",
  "LI",
  "NO",
  // Bilateral free movement
  "CH",
]);

/**
 * True when the 90/180 rule binds the holder of this passport.
 *
 * Unknown or unset passports return true. That is deliberate: the failure that
 * matters is telling somebody they have no limit when they do. Showing a limit
 * to someone who does not have one is a wasted card; hiding one from someone
 * who does is a ban at the border.
 */
export function hasSchengenLimit(passport: string | null | undefined): boolean {
  if (!passport) return true;
  return !FREE_MOVEMENT_PASSPORTS.has(passport.toUpperCase());
}

/**
 * True when this passport is registered by the Entry/Exit System.
 *
 * EES records non-EU nationals crossing an external Schengen border. Free
 * movement holders are outside its scope, which is the same population that
 * has no 90/180 limit — so the two answers coincide today. They are kept as
 * separate functions because they answer different questions and there is no
 * guarantee the scopes stay identical.
 */
export function isEesRegistered(passport: string | null | undefined): boolean {
  return hasSchengenLimit(passport);
}
