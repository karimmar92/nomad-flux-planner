export type Confidence = "high" | "medium" | "low";

/** Monthly USD figures, mid-range basis. Shape matches the `costs` jsonb column. */
export type Costs = {
  rent1brCentral: number;
  rent1brOutskirts: number;
  colivingRoom: number;
  coworkingHotDesk: number;
  groceriesMonthly: number;
  mealInexpensive: number;
  utilities: number;
  mobileData: number;
  transportMonthly: number;
  gymMonthly: number;
  totalMonthlyMidRange: number;
  totalMonthlyLean: number;
};

export type CostLineKey = Exclude<keyof Costs, "totalMonthlyMidRange" | "totalMonthlyLean">;

export const COST_LABELS: Record<CostLineKey, string> = {
  rent1brCentral: "Rent — central 1BR",
  rent1brOutskirts: "Rent — outskirts 1BR",
  colivingRoom: "Coliving room",
  coworkingHotDesk: "Coworking hot desk",
  groceriesMonthly: "Groceries",
  mealInexpensive: "Meal out (per meal)",
  utilities: "Utilities",
  mobileData: "Mobile data",
  transportMonthly: "Transport",
  gymMonthly: "Gym",
};

/** Line items shown as monthly recurring costs. */
export const MONTHLY_COST_KEYS: CostLineKey[] = [
  "rent1brCentral",
  "coworkingHotDesk",
  "groceriesMonthly",
  "utilities",
  "mobileData",
  "transportMonthly",
  "gymMonthly",
];

/** Line items shown for reference only (alternatives or per-unit prices). */
export const REFERENCE_COST_KEYS: CostLineKey[] = [
  "rent1brOutskirts",
  "colivingRoom",
  "mealInexpensive",
];

/** 0–5 subjective scores, except internet which is Mbps. */
export type Scores = {
  internetSpeedMbps: number;
  safety: number;
  nomadCommunity: number;
  walkability: number;
  englishFriendly: number;
  weather: number;
};

export const SCORE_MAX = 5;

export const SCORE_LABELS: Record<keyof Scores, string> = {
  internetSpeedMbps: "Internet",
  safety: "Safety",
  nomadCommunity: "Nomad community",
  walkability: "Walkability",
  englishFriendly: "English",
  weather: "Weather",
};

export type VisaRuleType =
  "SCHENGEN_90_180" | "FIXED_PER_ENTRY" | "ROLLING_PER_YEAR" | "NOMAD_VISA";

export const VISA_RULE_LABELS: Record<VisaRuleType, string> = {
  SCHENGEN_90_180: "Schengen 90/180",
  FIXED_PER_ENTRY: "Fresh allowance per entry",
  ROLLING_PER_YEAR: "Rolling annual cap",
  NOMAD_VISA: "Nomad permit only",
};

export const VISA_RULE_DESCRIPTIONS: Record<VisaRuleType, string> = {
  SCHENGEN_90_180:
    "Rolling window. Max 90 days in any trailing 180-day period across the whole Schengen Area combined. Entry day and exit day both count. Leaving to a non-Schengen country does not reset it.",
  FIXED_PER_ENTRY:
    "A fresh allowance each time you enter. Border runs may reset it, but repeated same-day runs draw scrutiny.",
  ROLLING_PER_YEAR: "Max N days per rolling 12 months or per calendar year, tracked cumulatively.",
  NOMAD_VISA: "A dedicated remote-work residence permit. Separate from the tourist allowance.",
};

export type NomadVisa = {
  name: string;
  exists: boolean;
  minMonthlyIncomeUSD?: number | null;
  minAnnualIncomeUSD?: number;
  requiredSavingsUSD?: number;
  alternativeSavingsUSD?: number;
  /** Typical all-in cost of obtaining the permit, USD. */
  approxCostUSD?: number;
  durationMonths?: number;
  staysPerEntryDays?: number;
  renewable?: boolean;
  renewableUpToYears?: number;
  pathToResidency?: boolean;
  notes?: string;
};

export type Visa = {
  ruleType: VisaRuleType;
  touristDays: number;
  extensionDays?: number;
  windowDays?: number | null;
  maxDaysPerCalendarYear?: number;
  /** True where the headline allowance differs sharply by passport (China).
   *  The UI must then refuse to present one number as universal. */
  nationalityDependent?: boolean;
  /** ISO date. Set where the current policy is a trial with a known end date. */
  policyTrialExpiry?: string;
  /** Free-text caveats shown under the visa card. */
  notes?: string;
  nomadVisa: NomadVisa;
};

export type SpecialRegime = {
  name: string;
  rate: string;
  years?: number;
  turnoverCapGEL?: number;
  turnoverCapUSD?: number;
};

export type Tax = {
  residencyTriggerDays: number;
  /** "calendar", "March-February", "July-June" */
  taxYear: string;
  windowNote?: string;
  notes: string;
  foreignIncomeExemptForNomadVisa: boolean;
  personalIncomeTaxRate?: number;
  specialRegime?: SpecialRegime;
};

export type City = {
  id: string;
  city: string;
  country: string;
  country_code: string;
  region: string;
  lat: number;
  lng: number;
  /**
   * IANA time zone id, e.g. "Europe/Lisbon".
   *
   * Stored explicitly rather than derived from lat/lng, because the mapping is
   * political, not geographic, and the exceptions are exactly the places
   * nomads go:
   *
   *   - Las Palmas is Spain but Atlantic/Canary — an hour behind Madrid.
   *   - Playa del Carmen is America/Cancun (UTC-5), an hour AHEAD of
   *     Mexico City (UTC-6), despite being the same country.
   *   - All five Chinese cities are Asia/Shanghai, including Kunming and Dali
   *     in the far west, where solar noon is nearly two hours off the clock.
   *
   * A coordinate lookup gets each of those wrong, and an hour of error is
   * exactly enough to make a "you can make the 09:00 standup" claim false.
   */
  timezone: string;
  local_currency: string;
  costs: Costs;
  scores: Scores;
  visa: Visa;
  tax: Tax;
  arbitrage_note: string;
  /** Where the headline Mbps figure is misleading (Great Firewall, villa wifi).
   *  Rendered as an amber row inside the liveability/scores section. */
  connectivity_warning?: string | null;
  /** IATA code of the airport actually used to reach the city. */
  nearest_airport_iata: string;
  /** City ids reachable by ground transport in roughly 12 hours or less.
   *  Deliberately conservative — an empty array falls back to air routing
   *  rather than inventing a bus that does not exist. */
  overland_neighbours: string[];
  last_verified: string;
  confidence: Confidence;
};

export type IncomeType = "employed" | "freelance" | "founder";

/**
 * Which track the user is on. "planning" people have no trips yet, so the
 * tracker is noise to them and the runway calculator is the whole product.
 * Set on first run and again at the graduation handoff.
 */
export type UserStage = "planning" | "abroad";
/** Tier ids mirror src/config/pricing.ts. Order matters: see PLAN_RANK. */
export type Plan = "free" | "starter" | "pro" | "teams";

export type Profile = {
  display_name: string;
  nationality: string;
  monthly_income_usd: number | null;
  income_type: IncomeType;
  home_city_id: string | null;
  currency_display: string;
  savings_usd: number | null;
  plan: Plan;
  stage: UserStage;
  onboarded: boolean;
  /**
   * The working hours the person cannot move, and the zone they belong to.
   *
   * Optional because it only applies to people with fixed hours — an employee
   * on a European team, a freelancer with a standing client call. Someone
   * genuinely async has no constraint here and should not be asked to invent
   * one. Absent means "don't show schedule fit", not "assume 9 to 5".
   *
   * Stored on the profile rather than per-city because it is a fact about the
   * person's job, not about anywhere they might go.
   */
  work_hours?: {
    /** Minutes since midnight in `timezone`. */
    start_minute: number;
    end_minute: number;
    /** IANA zone the hours are fixed to, e.g. "Europe/Berlin". */
    timezone: string;
  } | null;
};

export type TripPurpose = "tourist" | "nomad_visa" | "residence";

export type Trip = {
  id: string;
  country_code: string;
  city_id: string | null;
  entry_date: string; // yyyy-MM-dd
  exit_date: string | null; // null = currently there
  purpose: TripPurpose;
  notes: string;
  /** When the entry was logged. Drives the report's retrospective-entry flag. */
  created_at?: string;
};
