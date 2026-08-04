/**
 * Single source of truth for every affiliate partner in the app.
 *
 * Structural rule: affiliate revenue may never influence what the app
 * recommends. No affiliate URL may be hardcoded anywhere else — if you need a
 * partner link, read it from PARTNERS and render it through
 * `src/components/partners/PartnerCard.tsx`, which always attaches the
 * disclosure and logs the click.
 */

export type PartnerCategory = "esim" | "insurance";

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  /** Placeholder — replace once the affiliate account is approved. */
  urlTemplate: string; // supports {countryCode} and {citySlug}
  disclosure: string;
  /** Editorial note. Written by us, never by the partner. */
  note: string;
}

export const PARTNERS: Partner[] = [
  {
    id: "airalo",
    name: "Airalo",
    category: "esim",
    urlTemplate: "https://airalo.com/?country={countryCode}&ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Widest country coverage. Data-only, so no local number.",
  },
  {
    id: "holafly",
    name: "Holafly",
    category: "esim",
    urlTemplate: "https://holafly.com/?dest={countryCode}&ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Unlimited-data plans. Usually pricier for short stays.",
  },
  {
    id: "safetywing",
    name: "SafetyWing Nomad Insurance",
    category: "insurance",
    urlTemplate: "https://safetywing.com/?ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Subscription model, cancel anytime. Check whether motorbike accidents are covered — they often are not without a local licence.",
  },
  {
    id: "genki",
    name: "Genki",
    category: "insurance",
    urlTemplate: "https://genki.world/?ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Often cheaper over 50. Accepted for several nomad visa applications.",
  },
];

/**
 * Modules where partner links are forbidden. These decide what the app
 * recommends and in what order. If a partner link ever appears in one of them,
 * the product has stopped being trustworthy: city ordering must depend only on
 * the user's income, their filters, and the seed data.
 *
 * Each listed file carries a matching comment at the top explaining why.
 */
export const PARTNER_FREE_ZONES = [
  "src/routes/index.tsx", // Explore ranking, filtering and sorting
  "src/routes/compare.tsx", // Compare table
  "src/routes/calculator.tsx", // Arbitrage calculator
  "src/lib/arbitrage.ts", // City scoring, cost maths and ordering
  "src/lib/cities.ts", // Seed data and city ordering
  "src/components/CityCard.tsx", // Ranked list row
] as const;

export type PartnerPlacement = "city_detail" | "trip_confirm" | "visa_card" | "kit_page";

/** Partners for a category, in editorial order. Never sorted by payout. */
export function partnersByCategory(category: PartnerCategory): Partner[] {
  return PARTNERS.filter((p) => p.category === category);
}

export function getPartner(id: string): Partner | undefined {
  return PARTNERS.find((p) => p.id === id);
}

export function partnerUrl(
  partner: Partner,
  vars: { countryCode?: string; citySlug?: string } = {},
): string {
  return partner.urlTemplate
    .replace("{countryCode}", encodeURIComponent(vars.countryCode ?? ""))
    .replace("{citySlug}", encodeURIComponent(vars.citySlug ?? ""));
}
