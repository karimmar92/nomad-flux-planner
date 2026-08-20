import type { Airport, CrossAirportTransfer } from "./airports";

/** One stop the user asked for, before the planner picks airports for it. */
export type StopInput = {
  cityKey: string;
  /** Nights the traveller wants on the ground here. */
  nights: number;
  /** "around these dates" — lets the engine shift the departure by a few days. */
  flexible: boolean;
};

export type RankingPriority = "balanced" | "cheapest" | "fewest_transfers";
export type AirportPreference = "any" | "main" | "lowcost";

export type Preferences = {
  priority: RankingPriority;
  airportPreference: AirportPreference;
  /** Penalise arrivals after 23:00 and before 06:00. */
  avoidLateArrivals: boolean;
  /** Reward stop lengths that suit a 2–8 week base rather than tourist hopping. */
  nomadMode: boolean;
};

export type FlightOffer = {
  fromIata: string;
  toIata: string;
  /** yyyy-MM-dd of departure. */
  dateISO: string;
  /** Minutes after local midnight. */
  departMinute: number;
  arriveMinute: number;
  /** Whole-journey duration including any connection. */
  durationMinutes: number;
  /** Number of intermediate stops on this leg (0 = direct). */
  stops: number;
  priceUsdLow: number;
  priceUsdHigh: number;
  carrier: "full-service" | "low-cost";
  /** Days the arrival falls after the departure date (0 or 1+). */
  dayOffset: number;
};

export type CrossAirportChange = {
  cityKey: string;
  cityName: string;
  fromIata: string;
  toIata: string;
  transfer: CrossAirportTransfer;
  /** Buffer we recommend between landing and the next check-in. */
  recommendedBufferMinutes: number;
};

export type Leg = {
  from: Airport;
  to: Airport;
  offer: FlightOffer;
  /** Set when the traveller must change airports in the departure city first. */
  crossAirport: CrossAirportChange | null;
  lateArrival: boolean;
};

export type PlannedStop = {
  cityKey: string;
  cityName: string;
  countryCode: string;
  cityId?: string;
  arrivalDateISO: string;
  departureDateISO: string;
  nights: number;
  arrivalAirport: Airport | null;
  departureAirport: Airport | null;
};

export type ItineraryWarning = {
  kind: "cross-airport" | "late-arrival" | "short-stay" | "long-leg";
  text: string;
};

export type Itinerary = {
  id: string;
  legs: Leg[];
  stops: PlannedStop[];
  priceUsdLow: number;
  priceUsdHigh: number;
  /** Air time + connections + ground transfers, minutes. */
  totalTravelMinutes: number;
  flightStops: number;
  crossAirportChanges: CrossAirportChange[];
  /** 0–100, how well the stop lengths fit a 2–8 week nomad base. */
  nomadScore: number;
  /** 0–100 overall fit for the chosen preferences. Higher is better. */
  score: number;
  warnings: ItineraryWarning[];
};
