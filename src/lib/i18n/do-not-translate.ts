/**
 * Strings that must survive translation untouched.
 *
 * The test is simple: if the user may have to say this word out loud to an
 * immigration officer, a landlord or an accountant, it stays in the source
 * language. A translated "Beckham Law" is unsearchable and unusable.
 */

export const DO_NOT_TRANSLATE = [
  // Product + partner names
  "Driftly",
  "Airalo",
  "Holafly",
  "SafetyWing",
  "Genki",
  "Wise",
  "Revolut",
  "doola",
  "Firstbase",
  "Xolo",
  "12Go",
  "Omio",
  "Kiwi.com",
  "Stripe",
  "Stripe Connect",

  // Visas and legal instruments — proper nouns
  "D8 Digital Nomad Visa",
  "D7 Visa",
  "X2 Student Visa",
  "Beckham Law",
  "Form 5472",
  "Form 1120",
  "Abmeldung",
  "Anmeldung",
  "Baja consular",
  "Non-Habitual Resident",
  "White Card",
  "Digital Nomad Visa",
  "Schengen",
  "LLC",
  "CFC",
  "EIN",
  "ITIN",
  "IRS",
  "OECD",
] as const;

/**
 * Field paths that are never translated, regardless of namespace:
 * identifiers, currency codes, ISO country codes and city record keys.
 * City NAMES may appear in their common local form ("München") but the record
 * must stay matchable to its id (`munich-de`) — translate the display string,
 * never the id.
 */
export const DO_NOT_TRANSLATE_FIELDS = [
  "id",
  "country_code",
  "countryCode",
  "local_currency",
  "localCurrency",
  "currency",
  "nearest_airport_iata",
  "slug",
] as const;

const LOOKUP = new Set(DO_NOT_TRANSLATE.map((s) => s.toLowerCase()));

export function isDoNotTranslate(value: string) {
  return LOOKUP.has(value.trim().toLowerCase());
}
