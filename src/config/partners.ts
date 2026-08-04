/**
 * Single source of truth for every affiliate partner in the app.
 *
 * Structural rule: affiliate revenue may never influence what the app
 * recommends. No affiliate URL may be hardcoded anywhere else — if you need a
 * partner link, read it from PARTNERS and render it through
 * `src/components/partners/PartnerCard.tsx`, which always attaches the
 * disclosure and logs the click.
 *
 * ---------------------------------------------------------------------------
 * TRANSPORT RULE (stricter than the rule above — read before adding a link)
 * ---------------------------------------------------------------------------
 * eSIM and insurance are destination-agnostic: which one you need depends on
 * where you already decided to go. Transport is different — it creates an
 * incentive for the user to move more often, and moving less is usually better
 * for them. Cheaper, calmer, better work, and often better tax positioning.
 *
 *   Transport links may appear ONLY where a move is already decided or already
 *   forced by a visa deadline. They must never appear as a suggestion to
 *   travel. No "why not visit X?", no "popular routes from your city", no
 *   proactive prompts on Explore, no push notifications about fares. If the app
 *   ever nudges someone to move who wasn't going to, the advice has been sold.
 *
 * Permitted in exactly three placements: `border_run`, `trip_confirm`,
 * `kit_page`. Forbidden everywhere listed in TRANSPORT_FREE_ZONES.
 */

export type PartnerCategory = "esim" | "insurance" | "transport";

/** Coarse coverage regions, matching the `region` field on the cities dataset. */
export type PartnerRegion = "Europe" | "Asia" | "Latin America" | "Africa" | "Middle East";

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  /**
   * Regions the partner actually covers. Omit for destination-agnostic
   * partners (eSIM, insurance). Coverage differs sharply for transport —
   * a European rail aggregator is useless to someone in Vietnam.
   */
  regions?: PartnerRegion[];
  /** Placeholder — replace once the affiliate account is approved. */
  urlTemplate: string; // supports {countryCode}, {citySlug}, {fromCity}, {toCity}, {date}
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
  // Transport — subject to the TRANSPORT RULE above. No direct airline
  // programmes: they pay close to nothing and cover one carrier each.
  {
    id: "12go",
    name: "12Go",
    category: "transport",
    regions: ["Asia"],
    urlTemplate: "https://12go.asia/en?from={fromCity}&to={toCity}&date={date}&ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Best coverage for buses, ferries and sleeper trains across Southeast Asia. Books the routes that don't appear on flight search.",
  },
  {
    id: "omio",
    name: "Omio",
    category: "transport",
    regions: ["Europe"],
    urlTemplate: "https://omio.com/search?from={fromCity}&to={toCity}&date={date}&ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Rail, coach and budget flights across Europe in one search. Strongest for overland routes.",
  },
  {
    id: "kiwi",
    name: "Kiwi.com",
    category: "transport",
    regions: ["Europe", "Asia", "Latin America", "Africa", "Middle East"],
    urlTemplate: "https://kiwi.com/search?from={fromCity}&to={toCity}&date={date}&ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Combines flights, trains and buses into one itinerary — useful for awkward routes no single carrier covers.",
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

/**
 * Transport-specific lint zone. Superset of PARTNER_FREE_ZONES in spirit:
 * anywhere a transport link would read as an invitation to travel rather than
 * help with a move already decided. Notifications are listed as a zone even
 * though the module does not exist yet — it must never be built with fares in
 * it.
 */
export const TRANSPORT_FREE_ZONES = [
  "src/routes/index.tsx", // Explore — never suggest a journey to a city they're browsing
  "src/routes/compare.tsx", // Compare — a comparison must not become a booking funnel
  "src/routes/calculator.tsx", // Arbitrage calculator
  "src/lib/arbitrage.ts", // City ranking and scoring
  "src/lib/cities.ts", // Seed data and city ordering
  "src/components/CityCard.tsx", // Ranked list row
  "src/routes/city.$cityId.tsx", // City detail — browsing a city is not deciding to go
  "notifications", // Any push/email surface. No fare alerts, ever.
] as const;

/** Placements where a transport link is permitted. Nowhere else. */
export const TRANSPORT_PLACEMENTS = ["border_run", "trip_confirm", "kit_page"] as const;

export type PartnerPlacement =
  | "city_detail"
  | "trip_confirm"
  | "visa_card"
  | "kit_page"
  | "border_run";

/** Partners for a category, in editorial order. Never sorted by payout. */
export function partnersByCategory(category: PartnerCategory): Partner[] {
  return PARTNERS.filter((p) => p.category === category);
}

/**
 * Partners for a category that actually cover the given region. Editorial
 * order preserved; region is a coverage filter, not a ranking signal.
 */
export function partnersForRegion(category: PartnerCategory, region?: string): Partner[] {
  return partnersByCategory(category).filter(
    (p) => !p.regions || !region || p.regions.includes(region as PartnerRegion),
  );
}

export function getPartner(id: string): Partner | undefined {
  return PARTNERS.find((p) => p.id === id);
}

export function partnerUrl(
  partner: Partner,
  vars: {
    countryCode?: string;
    citySlug?: string;
    fromCity?: string;
    toCity?: string;
    date?: string;
  } = {},
): string {
  return partner.urlTemplate
    .replace("{countryCode}", encodeURIComponent(vars.countryCode ?? ""))
    .replace("{citySlug}", encodeURIComponent(vars.citySlug ?? ""))
    .replace("{fromCity}", encodeURIComponent(vars.fromCity ?? ""))
    .replace("{toCity}", encodeURIComponent(vars.toCity ?? ""))
    .replace("{date}", encodeURIComponent(vars.date ?? ""));
}
