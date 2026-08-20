/**
 * ITINERARY ENGINE
 *
 * Pure, synchronous, client-side. Nothing here touches the network or the
 * database: a person planning where to go next should not have to broadcast it.
 *
 * The search is a beam over (stop index → arrival airport) states. Airports are
 * never collapsed into their city, so an itinerary that lands at DMK and leaves
 * from BKK is a *different, more expensive* itinerary than one that does not —
 * which is the whole point.
 */
import {
  crossAirportTransfer,
  getHopCity,
  type Airport,
} from "./airports";
import { searchLeg } from "./flights";
import type {
  CrossAirportChange,
  Itinerary,
  ItineraryWarning,
  Leg,
  PlannedStop,
  Preferences,
  StopInput,
} from "./types";

export const DEFAULT_PREFERENCES: Preferences = {
  priority: "balanced",
  airportPreference: "any",
  avoidLateArrivals: true,
  nomadMode: true,
};

/** Stay lengths a remote worker can actually work from, in nights. */
const NOMAD_MIN_NIGHTS = 14;
const NOMAD_MAX_NIGHTS = 56;

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m`;
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function isLate(arriveMinute: number): boolean {
  return arriveMinute >= 23 * 60 || arriveMinute < 6 * 60;
}

/** Nomad fit for one stop: 100 inside the 2–8 week band, falling away outside. */
export function stopNomadScore(nights: number): number {
  if (nights >= NOMAD_MIN_NIGHTS && nights <= NOMAD_MAX_NIGHTS) return 100;
  if (nights < NOMAD_MIN_NIGHTS) return Math.max(0, 100 - (NOMAD_MIN_NIGHTS - nights) * 8);
  return Math.max(40, 100 - (nights - NOMAD_MAX_NIGHTS) * 1.5);
}

type Weights = { price: number; hour: number; stop: number; cross: number; late: number };

function weights(prefs: Preferences): Weights {
  switch (prefs.priority) {
    case "cheapest":
      return { price: 1, hour: 6, stop: 25, cross: 55, late: prefs.avoidLateArrivals ? 60 : 10 };
    case "fewest_transfers":
      return { price: 0.35, hour: 14, stop: 190, cross: 220, late: prefs.avoidLateArrivals ? 110 : 20 };
    default:
      return { price: 0.6, hour: 12, stop: 90, cross: 130, late: prefs.avoidLateArrivals ? 90 : 15 };
  }
}

function airportPreferencePenalty(a: Airport, prefs: Preferences): number {
  if (prefs.airportPreference === "main") return a.kind === "main" ? 0 : 45;
  if (prefs.airportPreference === "lowcost") return a.kind === "lowcost" ? 0 : 30;
  return 0;
}

type Partial_ = {
  legs: Leg[];
  arrival: Airport | null;
  cost: number;
  price: number;
  minutes: number;
};

/**
 * Builds ranked itineraries for an ordered list of stops.
 * Returns at most `limit` results, best first.
 */
export function planItineraries(
  stops: StopInput[],
  startDateISO: string,
  prefs: Preferences,
  limit = 4,
): Itinerary[] {
  const cities = stops.map((s) => getHopCity(s.cityKey)).filter(Boolean) as NonNullable<
    ReturnType<typeof getHopCity>
  >[];
  if (cities.length !== stops.length || cities.length < 2) return [];

  const w = weights(prefs);

  // Departure date out of each stop = start + nights accumulated so far.
  const departDates: string[] = [];
  let cursor = startDateISO;
  for (const stop of stops) {
    departDates.push(cursor);
    cursor = addDays(cursor, Math.max(1, stop.nights));
  }

  const BEAM = 14;
  let frontier: Partial_[] = [{ legs: [], arrival: null, cost: 0, price: 0, minutes: 0 }];

  for (let i = 0; i < cities.length - 1; i++) {
    const here = cities[i]!;
    const next = cities[i + 1]!;
    const dateISO = departDates[i + 1]!; // fly out on the day the stay ends
    const nextFrontier: Partial_[] = [];

    for (const state of frontier) {
      for (const dep of here.airports) {
        // Changing airports inside the departure city is a real cost.
        let change: CrossAirportChange | null = null;
        let changeCost = 0;
        let changeMinutes = 0;
        if (state.arrival && state.arrival.iata !== dep.iata) {
          const transfer = crossAirportTransfer(state.arrival.iata, dep.iata);
          if (transfer) {
            change = {
              cityKey: here.key,
              cityName: here.name,
              fromIata: state.arrival.iata,
              toIata: dep.iata,
              transfer,
              recommendedBufferMinutes: Math.max(180, transfer.minutes + 120),
            };
            changeCost = w.cross + transfer.costUsd * w.price + (transfer.minutes / 60) * w.hour;
            changeMinutes = transfer.minutes;
          }
        }

        for (const arr of next.airports) {
          for (const offer of searchLeg(dep.iata, arr.iata, dateISO)) {
            // Flexible stays let the engine take a cheaper nearby date.
            const flex = stops[i]?.flexible ? 0.9 : 1;
            const priceLow = Math.round(offer.priceUsdLow * flex);
            const late = isLate(offer.arriveMinute);
            const legCost =
              priceLow * w.price +
              (offer.durationMinutes / 60) * w.hour +
              offer.stops * w.stop +
              (late ? w.late : 0) +
              airportPreferencePenalty(dep, prefs) +
              airportPreferencePenalty(arr, prefs) +
              changeCost;

            nextFrontier.push({
              legs: [
                ...state.legs,
                { from: dep, to: arr, offer: { ...offer, priceUsdLow: priceLow }, crossAirport: change, lateArrival: late },
              ],
              arrival: arr,
              cost: state.cost + legCost,
              price: state.price + priceLow,
              minutes: state.minutes + offer.durationMinutes + changeMinutes,
            });
          }
        }
      }
    }

    nextFrontier.sort((a, b) => a.cost - b.cost);
    // Keep the beam diverse: at most 3 partials per arrival airport, so a
    // single cheap airport cannot crowd out every alternative.
    const perAirport = new Map<string, number>();
    frontier = [];
    for (const cand of nextFrontier) {
      const key = cand.arrival?.iata ?? "";
      const n = perAirport.get(key) ?? 0;
      if (n >= 3) continue;
      perAirport.set(key, n + 1);
      frontier.push(cand);
      if (frontier.length >= BEAM) break;
    }
    if (frontier.length === 0) return [];
  }

  const built = frontier.map((state, idx) => build(state, stops, cities, departDates, startDateISO, prefs, idx));

  // Nomad mode folds stay quality into the final ordering, not just display.
  built.sort((a, b) => b.score - a.score);

  // Drop near-duplicates (same airport sequence).
  const seen = new Set<string>();
  const out: Itinerary[] = [];
  for (const it of built) {
    const key = it.legs.map((l) => `${l.from.iata}>${l.to.iata}`).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= limit) break;
  }
  return out;
}

function build(
  state: Partial_,
  stopInputs: StopInput[],
  cities: NonNullable<ReturnType<typeof getHopCity>>[],
  departDates: string[],
  startDateISO: string,
  prefs: Preferences,
  idx: number,
): Itinerary {
  const legs = state.legs;
  const stops: PlannedStop[] = cities.map((city, i) => {
    const nights = Math.max(1, stopInputs[i]?.nights ?? 14);
    const arrivalDateISO = i === 0 ? startDateISO : departDates[i]!;
    return {
      cityKey: city.key,
      cityName: city.name,
      countryCode: city.countryCode,
      ...(city.cityId ? { cityId: city.cityId } : {}),
      arrivalDateISO,
      departureDateISO: addDays(arrivalDateISO, nights),
      nights,
      arrivalAirport: i === 0 ? null : (legs[i - 1]?.to ?? null),
      departureAirport: legs[i]?.from ?? null,
    };
  });

  const crossAirportChanges = legs
    .map((l) => l.crossAirport)
    .filter((c): c is CrossAirportChange => Boolean(c));

  const nomadScore = Math.round(
    stops.reduce((sum, s) => sum + stopNomadScore(s.nights), 0) / Math.max(1, stops.length),
  );

  const transferCost = crossAirportChanges.reduce((s, c) => s + c.transfer.costUsd, 0);
  const priceUsdLow = state.price + transferCost;
  const priceUsdHigh =
    legs.reduce((s, l) => s + l.offer.priceUsdHigh, 0) + Math.round(transferCost * 1.3);

  const warnings: ItineraryWarning[] = [];
  for (const c of crossAirportChanges) {
    warnings.push({
      kind: "cross-airport",
      text: `Airport change in ${c.cityName}: land at ${c.fromIata}, depart from ${c.toIata}. Allow ${formatMinutes(c.recommendedBufferMinutes)} — ${c.transfer.method.toLowerCase()}.`,
    });
  }
  for (const l of legs) {
    if (l.lateArrival) {
      warnings.push({
        kind: "late-arrival",
        text: `${l.from.iata} → ${l.to.iata} lands at ${formatClock(l.offer.arriveMinute)}. Book accommodation with a 24h desk.`,
      });
    }
    if (l.offer.durationMinutes > 14 * 60) {
      warnings.push({
        kind: "long-leg",
        text: `${l.from.iata} → ${l.to.iata} is ${formatMinutes(l.offer.durationMinutes)} door to door.`,
      });
    }
  }
  for (const s of stops) {
    if (s.nights < 7) {
      warnings.push({
        kind: "short-stay",
        text: `${s.cityName} is only ${s.nights} nights — too short to set up a working week.`,
      });
    }
  }

  // Display score: cheap, fast, few frictions, good stay lengths.
  const hours = state.minutes / 60;
  let score = 100;
  score -= Math.min(35, priceUsdLow / 45);
  score -= Math.min(25, hours * 0.9);
  score -= legs.reduce((s, l) => s + l.offer.stops, 0) * 5;
  score -= crossAirportChanges.length * 9;
  score -= legs.filter((l) => l.lateArrival).length * (prefs.avoidLateArrivals ? 7 : 3);
  if (prefs.nomadMode) score = score * 0.7 + nomadScore * 0.3;

  return {
    id: `itin-${idx}-${legs.map((l) => l.from.iata + l.to.iata).join("")}`,
    legs,
    stops,
    priceUsdLow,
    priceUsdHigh,
    totalTravelMinutes: state.minutes,
    flightStops: legs.reduce((s, l) => s + l.offer.stops, 0),
    crossAirportChanges,
    nomadScore,
    score: Math.max(1, Math.round(score)),
    warnings,
  };
}
