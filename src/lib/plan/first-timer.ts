/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. This is a ranking, and a ranking
 * must depend only on the seed data and the user's passport — never on commission.
 *
 * First-move ranking. Deliberately weighted differently from Explore: cost is
 * nearly ignored. The cheapest cities in the dataset are also the ones with the
 * thinnest infrastructure and the smallest English-speaking scene, and a first
 * move is the worst possible time to optimise purely on price.
 */
import type { City } from "../types";

export const FIRST_MOVE_RATIONALE =
  "Ranked for a first move, not for cost. English, an established community, safety and a straightforward entry matter far more the first time than saving another $200 a month. The cheapest cities in the dataset are usually the hardest to land in cold.";

export const FIRST_MOVE_WEIGHTS = {
  englishFriendly: 0.24,
  nomadCommunity: 0.28,
  safety: 0.2,
  internet: 0.1,
  visaEase: 0.1,
  cost: 0.08,
} as const;

/** Visa-free days, normalised. A 30-day entry is workable but genuinely harder. */
function visaEase(city: City): number {
  const d = city.visa.touristDays + (city.visa.extensionDays ?? 0);
  if (d >= 180) return 1;
  if (d >= 90) return 0.85;
  if (d >= 60) return 0.7;
  return 0.45;
}

/** Cheapest city in the set scores 1, the most expensive 0. */
function costEase(city: City, min: number, max: number): number {
  if (max <= min) return 0.5;
  return 1 - (city.costs.totalMonthlyLean - min) / (max - min);
}

export type FirstMovePick = {
  city: City;
  score: number; // 0-100
  reasons: string[];
  caution: string | null;
};

function reasonsFor(city: City): string[] {
  const out: string[] = [];
  if (city.scores.nomadCommunity >= 4.5) out.push("Large, established remote-work scene");
  if (city.scores.englishFriendly >= 4) out.push("You can get by in English from day one");
  else if (city.scores.englishFriendly >= 3.5) out.push("English works in the places you will need it");
  if (city.scores.safety >= 4.5) out.push("Consistently safe for newcomers");
  if (city.scores.internetSpeedMbps >= 180) out.push(`${city.scores.internetSpeedMbps} Mbps typical`);
  const days = city.visa.touristDays + (city.visa.extensionDays ?? 0);
  if (days >= 90) out.push(`${days} days on arrival — no visa run in month two`);
  return out.slice(0, 4);
}

function cautionFor(city: City): string | null {
  if (city.visa.touristDays <= 30)
    return `Only ${city.visa.touristDays} days on entry${
      city.visa.extensionDays ? `, extendable by ${city.visa.extensionDays}` : ""
    } — plan the extension before you fly, not after.`;
  if (city.scores.englishFriendly <= 3)
    return "You will want some of the local language within the first month.";
  if (city.scores.safety <= 3.5) return "Fine with normal city awareness, but not a soft landing.";
  return null;
}

/**
 * Gates, applied before any scoring. A first move needs an existing arrival
 * infrastructure — coworking, short lets that answer emails in English, other
 * people who did it last month — and that is not something a low cost of
 * living substitutes for. Cities that fail a gate are not ranked lower, they
 * are not shown, and the page says why.
 */
export const FIRST_MOVE_GATES = {
  minNomadCommunity: 4.5,
  minSafety: 3.5,
  minInternetMbps: 90,
  /** Above this, the runway maths stops working for most first movers. */
  maxLeanMonthlyUsd: 2000,
} as const;

export function passesFirstMoveGates(city: City): boolean {
  return (
    city.scores.nomadCommunity >= FIRST_MOVE_GATES.minNomadCommunity &&
    city.scores.safety >= FIRST_MOVE_GATES.minSafety &&
    city.scores.internetSpeedMbps >= FIRST_MOVE_GATES.minInternetMbps &&
    city.costs.totalMonthlyLean <= FIRST_MOVE_GATES.maxLeanMonthlyUsd
  );
}

export function rankForFirstMove(cities: City[], limit = 8): FirstMovePick[] {
  const eligible = cities.filter(passesFirstMoveGates);
  const leanCosts = cities.map((c) => c.costs.totalMonthlyLean);
  const min = Math.min(...leanCosts);
  const max = Math.max(...leanCosts);
  const w = FIRST_MOVE_WEIGHTS;

  return eligible
    .map((city) => {
      const s = city.scores;
      const score =
        ((s.englishFriendly / 5) * w.englishFriendly +
          (s.nomadCommunity / 5) * w.nomadCommunity +
          (s.safety / 5) * w.safety +
          Math.min(1, s.internetSpeedMbps / 250) * w.internet +
          visaEase(city) * w.visaEase +
          costEase(city, min, max) * w.cost) *
        100;
      return { city, score, reasons: reasonsFor(city), caution: cautionFor(city) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
