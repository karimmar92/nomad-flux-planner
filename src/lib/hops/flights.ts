/**
 * FLIGHT SUPPLY — mocked, but shaped like the real thing.
 *
 * Everything downstream talks to `searchLeg`. Swapping in a real API means
 * replacing this one function with an async call and awaiting it in the
 * planner; nothing else in the feature knows where offers come from.
 *
 * The numbers are deterministic (hashed from route + date) so a given search
 * always returns the same itinerary ranking. Random prices would make the
 * ranking untrustworthy and untestable.
 */
import { distanceKm, getAirport } from "./airports";
import type { FlightOffer } from "./types";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * Offers for one airport pair on one date.
 *
 * Returns a direct option where the route is plausibly direct, plus a cheaper
 * one-stop, so the ranking has a real trade-off to resolve.
 */
export function searchLeg(fromIata: string, toIata: string, dateISO: string): FlightOffer[] {
  const from = getAirport(fromIata);
  const to = getAirport(toIata);
  if (!from || !to || fromIata === toIata) return [];

  const km = distanceKm(from, to);
  const seed = hash(`${fromIata}-${toIata}-${dateISO}`);
  const seed2 = hash(`${toIata}-${fromIata}-${dateISO}-b`);

  const airMinutes = Math.round(45 + (km / 780) * 60);
  const lowCostRoute = from.kind === "lowcost" || to.kind === "lowcost";

  // Base fare: steep per-km at short range, flattening out long-haul.
  const base = 38 + Math.pow(km, 0.82) * 0.62;
  const seasonal = 0.85 + seed * 0.4;
  const directPrice = base * seasonal * (lowCostRoute ? 0.72 : 1);

  const offers: FlightOffer[] = [];

  // Direct — long thin routes between two secondary airports rarely exist.
  const directPlausible = km < 1200 || from.kind === "main" || to.kind === "main";
  if (directPlausible) {
    const dep = Math.round(300 + seed * 780); // 05:00 – 18:00
    offers.push(
      makeOffer({
        fromIata,
        toIata,
        dateISO,
        dep,
        duration: airMinutes,
        stops: 0,
        low: directPrice * 0.9,
        high: directPrice * 1.25,
        carrier: lowCostRoute ? "low-cost" : "full-service",
      }),
    );
  }

  // One-stop — cheaper, slower, and often lands unsociably late.
  const connect = Math.round(90 + seed2 * 210);
  const dep2 = Math.round(600 + seed2 * 780); // 10:00 – 23:00
  offers.push(
    makeOffer({
      fromIata,
      toIata,
      dateISO,
      dep: dep2,
      duration: airMinutes + connect + 40,
      stops: 1,
      low: directPrice * (directPlausible ? 0.68 : 0.95),
      high: directPrice * (directPlausible ? 0.95 : 1.3),
      carrier: seed2 > 0.5 ? "low-cost" : "full-service",
    }),
  );

  return offers;
}

function makeOffer(o: {
  fromIata: string;
  toIata: string;
  dateISO: string;
  dep: number;
  duration: number;
  stops: number;
  low: number;
  high: number;
  carrier: FlightOffer["carrier"];
}): FlightOffer {
  const arriveRaw = o.dep + o.duration;
  return {
    fromIata: o.fromIata,
    toIata: o.toIata,
    dateISO: o.dateISO,
    departMinute: o.dep,
    arriveMinute: arriveRaw % 1440,
    dayOffset: Math.floor(arriveRaw / 1440),
    durationMinutes: o.duration,
    stops: o.stops,
    priceUsdLow: Math.round(o.low),
    priceUsdHigh: Math.round(o.high),
    carrier: o.carrier,
  };
}
