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
 *
 * ---------------------------------------------------------------------------
 * BANKING RULE (regulated — read all of it before touching this category)
 * ---------------------------------------------------------------------------
 * Multi-currency accounts ONLY: the accounts nomads use instead of local
 * banking. Wise, Revolut, Payoneer.
 *
 *   NEVER link to local bank account opening. Local retail banks in Georgia,
 *   Thailand or Portugal do not run affiliate programmes. What fills that gap
 *   is "account opening assistance" agencies charging $200-500, and that space
 *   contains outright scams targeting exactly this audience. One bad referral
 *   there costs more trust than the entire affiliate stack earns. This is a
 *   prohibition, not a preference — see PROHIBITED_PARTNER_TYPES.
 *
 * Where a city has genuinely useful local banking context (Georgia's banking
 * has become harder for some nationalities, for instance) it is written as
 * editorial content in `arbitrage_note`, with no link attached. Information,
 * not a referral.
 *
 * Deposit-taking and payment services are regulated financial promotions in
 * the UK and EU, and the rules reach affiliates, not just the firms. Three
 * requirements, all enforced in code below:
 *
 *   1. No recommendation language anywhere near a banking link. Not "best
 *      account for nomads", not "we recommend", not "you should". Comparative
 *      fact only: what it does, where it works, what it costs.
 *   2. BANKING_DISCLAIMER renders on every banking placement, always visible,
 *      in the same standing style as the visa disclaimer.
 *   3. Banking links stay physically separate from tax content. We display
 *      residency triggers and special regimes (Georgia 1%, Beckham Law).
 *      "Open this account" next to "become tax resident here at 183 days"
 *      reads as tax structuring advice, a regulated activity in most of these
 *      jurisdictions. See BANKING_FREE_ZONES.
 *
 * ---------------------------------------------------------------------------
 * ONE CARD PER SCREEN (applies to every category)
 * ---------------------------------------------------------------------------
 * There are four affiliate categories now. No screen may display more than one
 * partner card. If a placement wants two, it belongs on the Nomad kit page,
 * which is the single catalogue surface (CATALOGUE_PLACEMENTS). The failure
 * mode from here is not too little revenue, it's the app quietly turning into
 * a link farm — and one good free-to-paid conversion is worth more than any
 * individual affiliate category. PartnerGroup/TransportGroup/BankingGroup
 * enforce this by rendering a single card outside the catalogue.
 */

export type PartnerCategory = "esim" | "insurance" | "transport" | "banking";

/**
 * Categories of partner we will never carry, whatever they pay.
 * Load-bearing: read this before adding anything to PARTNERS.
 */
export const PROHIBITED_PARTNER_TYPES = [
  "local-bank-account-opening", // Local retail banks: no programmes, and the gap is filled by scams
  "account-opening-assistance", // $200-500 agencies targeting this exact audience
  "residency-by-investment", // Same risk class, worse
  "tax-structuring-services", // Regulated advice we are not licensed to sell
  "banner-ad-networks", // No ads, ever
] as const;

/** Coarse coverage regions, matching the `region` field on the cities dataset. */
export type PartnerRegion =
  | "*"
  | "Europe"
  | "Asia"
  | "Latin America"
  | "Africa"
  | "Middle East";

export interface Partner {
  id: string;
  name: string;
  category: PartnerCategory;
  /**
   * Regions the partner actually covers, or ["*"] for global. Omit for
   * destination-agnostic partners (eSIM, insurance). Coverage differs sharply
   * for transport — a European rail aggregator is useless to someone in
   * Vietnam — and for banking, where eligibility follows country of residence.
   */
  regions?: PartnerRegion[];
  /** Banking only: which product this row is. Business is not a footnote. */
  accountType?: "personal" | "business";
  /** Placeholder — replace once the affiliate account is approved. */
  urlTemplate: string; // supports {countryCode}, {citySlug}, {fromCity}, {toCity}, {date}
  disclosure: string;
  /** Editorial note. Written by us, never by the partner. */
  note: string;
}

/**
 * Standing disclaimer for every banking placement. Always visible, never
 * behind a disclosure triangle, never abbreviated.
 */
export const BANKING_DISCLAIMER =
  "Information only, not financial advice. Availability, fees and features depend on your country of residence. Check the provider's terms.";


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
  // Banking — subject to the BANKING RULE above. Multi-currency accounts only.
  // Notes are comparative fact: what it does, where it works, what it costs.
  // No superlatives, no "recommended", no "best for nomads".
  {
    id: "wise",
    name: "Wise",
    category: "banking",
    accountType: "personal",
    regions: ["*"],
    urlTemplate: "https://wise.com/invite/?ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Multi-currency account with local bank details in 9+ currencies. The business account is the one that matters if you invoice international clients.",
  },
  {
    // Surfaced as its own row, not a footnote under the personal account: this
    // audience invoices international clients, and the product is different.
    id: "wise-business",
    name: "Wise Business",
    category: "banking",
    accountType: "business",
    regions: ["*"],
    urlTemplate: "https://wise.com/business/invite/?ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Same local bank details in the company's name, with batch payouts and accounting exports. One-off setup fee in most countries; company registration documents required.",
  },
  {
    id: "revolut",
    name: "Revolut",
    category: "banking",
    accountType: "personal",
    regions: ["Europe", "Asia", "Latin America"],
    urlTemplate: "https://revolut.com/referral/?ref=REPLACE_ME",
    disclosure: "Affiliate link — we earn a commission at no extra cost to you.",
    note: "Strong app and card. Availability and features vary a lot by country of residence — check yours before relying on it.",
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

/**
 * Banking-specific lint zone. The tax entries are the important ones: a
 * banking link beside a residency trigger or a special regime reads as tax
 * structuring advice, which is regulated in most of these jurisdictions.
 */
export const BANKING_FREE_ZONES = [
  ...PARTNER_FREE_ZONES,
  "src/routes/city.$cityId.tsx", // Tax card, residency triggers, special regimes — see the comment there
  "src/routes/tracker.tsx", // Day counters sit next to residency thresholds
  "src/components/borderrun/BorderRunCard.tsx", // A forced move is not a moment to sell an account
  "notifications", // No financial promotions pushed at anyone
] as const;

/** Placements where a transport link is permitted. Nowhere else. */
export const TRANSPORT_PLACEMENTS = ["border_run", "trip_confirm", "kit_page"] as const;

/**
 * Placements where a banking link is permitted. Nowhere else — specifically
 * not city detail, not the tracker, not the border-run planner.
 */
export const BANKING_PLACEMENTS = ["kit_page", "onboarding"] as const;

export type PartnerPlacement =
  | "city_detail"
  | "trip_confirm"
  | "visa_card"
  | "kit_page"
  | "border_run"
  | "onboarding";

/**
 * The one-card-per-screen budget. The Nomad kit page is the single catalogue
 * surface and is exempt: it exists precisely so that no other screen has to
 * carry a second link.
 */
export const MAX_PARTNER_CARDS_PER_SCREEN = 1;
export const CATALOGUE_PLACEMENTS: PartnerPlacement[] = ["kit_page"];

export function isCataloguePlacement(placement: PartnerPlacement): boolean {
  return CATALOGUE_PLACEMENTS.includes(placement);
}


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
    (p) =>
      !p.regions ||
      !region ||
      p.regions.includes("*") ||
      p.regions.includes(region as PartnerRegion),
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
