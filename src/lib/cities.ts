import seed from "@/data/seed-cities.json";
import type { City, Confidence, Costs, Scores, Tax, Visa } from "./types";

type SeedCity = {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  lat: number;
  lng: number;
  localCurrency: string;
  costs: Costs;
  scores: Scores;
  visa: Visa;
  tax: Tax;
  arbitrageNote: string;
};

/** Dataset-wide verification date. Every row carries it in the UI. */
export const SEED_LAST_VERIFIED = "2026-08-04";

/** Volatile local currencies — cost figures go stale fast. */
const LOW_CONFIDENCE_IDS = new Set(["buenos-aires-ar", "istanbul-tr"]);

function toCity(row: SeedCity): City {
  return {
    id: row.id,
    city: row.city,
    country: row.country,
    country_code: row.countryCode,
    region: row.region,
    lat: row.lat,
    lng: row.lng,
    local_currency: row.localCurrency,
    costs: row.costs,
    scores: row.scores,
    visa: row.visa,
    tax: row.tax,
    arbitrage_note: row.arbitrageNote,
    last_verified: SEED_LAST_VERIFIED,
    confidence: (LOW_CONFIDENCE_IDS.has(row.id) ? "low" : "medium") as Confidence,
  };
}

export const CITIES: City[] = (seed.cities as unknown as SeedCity[]).map(toCity);

export const REGIONS = Array.from(new Set(CITIES.map((x) => x.region))).sort();

export function getCity(id: string): City | undefined {
  return CITIES.find((x) => x.id === id);
}
