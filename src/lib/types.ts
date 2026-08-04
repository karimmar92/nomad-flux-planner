export type Confidence = "high" | "medium" | "low";

export type CostItem = { lean: number; mid: number };

export type Costs = {
  rent_central: CostItem;
  rent_outskirts: CostItem;
  coliving: CostItem;
  coworking: CostItem;
  groceries: CostItem;
  meal: CostItem;
  utilities: CostItem;
  mobile: CostItem;
  transport: CostItem;
  gym: CostItem;
};

export const COST_LABELS: Record<keyof Costs, string> = {
  rent_central: "Rent — central 1BR",
  rent_outskirts: "Rent — outskirts 1BR",
  coliving: "Coliving",
  coworking: "Coworking desk",
  groceries: "Groceries",
  meal: "Eating out",
  utilities: "Utilities",
  mobile: "Mobile / data",
  transport: "Transport",
  gym: "Gym",
};

/** Items summed into the headline monthly cost (rent_central used; alternatives excluded). */
export const CORE_COST_KEYS: (keyof Costs)[] = [
  "rent_central",
  "coworking",
  "groceries",
  "meal",
  "utilities",
  "mobile",
  "transport",
  "gym",
];

export type Scores = {
  internet_mbps: number;
  safety: number;
  community: number;
  walkability: number;
  english: number;
  weather: number;
};

export const SCORE_LABELS: Record<keyof Scores, string> = {
  internet_mbps: "Internet",
  safety: "Safety",
  community: "Nomad community",
  walkability: "Walkability",
  english: "English",
  weather: "Weather",
};

export type NomadVisa = {
  name: string;
  income_usd_monthly: number;
  duration_months: number;
  renewable: boolean;
  residency_path: string;
};

export type Visa = {
  schengen: boolean;
  /** Tourist days by ISO-2 nationality; `default` is the fallback. */
  tourist_days: Record<string, number> & { default: number };
  rule: string;
  nomad_visa: NomadVisa | null;
};

export type Tax = {
  residency_trigger_days: number;
  /** e.g. "Jan–Dec", "Mar–Feb", "Jul–Jun" */
  tax_year: string;
  /** month index 0-11 that the tax year starts */
  tax_year_start_month: number;
  special_regime: string | null;
};

export type City = {
  id: string;
  city: string;
  country: string;
  country_code: string;
  region: string;
  lat: number;
  lng: number;
  local_currency: string;
  costs: Costs;
  scores: Scores;
  visa: Visa;
  tax: Tax;
  arbitrage_note: string;
  last_verified: string;
  confidence: Confidence;
};

export type IncomeType = "employed" | "freelance" | "founder";
export type Plan = "free" | "pro";

export type Profile = {
  display_name: string;
  nationality: string;
  monthly_income_usd: number | null;
  income_type: IncomeType;
  home_city_id: string | null;
  currency_display: string;
  savings_usd: number | null;
  plan: Plan;
  onboarded: boolean;
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
};
