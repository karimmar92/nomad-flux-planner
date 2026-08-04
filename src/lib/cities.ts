/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. The seed dataset and city ordering
 * decides what the app recommends, and that must depend only on the user's
 * income, their filters and the seed data — never on commission.
 */
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
  connectivityWarning?: string;
  nearestAirportIata: string;
  overlandNeighbours: string[];
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
    connectivity_warning: row.connectivityWarning ?? null,
    nearest_airport_iata: row.nearestAirportIata,
    overland_neighbours: row.overlandNeighbours ?? [],
    last_verified: SEED_LAST_VERIFIED,
    confidence: (LOW_CONFIDENCE_IDS.has(row.id) ? "low" : "medium") as Confidence,
  };
}

export const CITIES: City[] = (seed.cities as unknown as SeedCity[]).map(toCity);

export const REGIONS = Array.from(new Set(CITIES.map((x) => x.region))).sort();

export function getCity(id: string): City | undefined {
  return CITIES.find((x) => x.id === id);
}
