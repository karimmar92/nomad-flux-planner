/**
 * Border-run planner.
 *
 * The question this answers is not "what is the cheapest ticket out?" — a
 * flight search does that better. It is "given my visa maths and my income,
 * where is the best place to be next?". That needs the visa and cost data we
 * already hold, which is why it belongs here and not in a booking widget.
 *
 * All date arithmetic is delegated to the Schengen engine and trip-dates
 * adapter. No local Date construction in this module.
 */
import type { City, Profile, Trip } from "./types";
import { CITIES, getCity } from "./cities";
import {
  SCHENGEN_COUNTRIES,
  SCHENGEN_MAX_DAYS,
  schengenDaysUsed,
  toDayIndex,
  type Trip as EngineTrip,
} from "./schengen";
import { addDaysIso, toEngineTrips } from "./trip-dates";
import { monthlyCost, nomadIncomeMonthly, touristDaysWithExtension } from "./arbitrage";

/* -------------------------------------------------------------------------- */
/* Deadline detection                                                          */
/* -------------------------------------------------------------------------- */

export type DeadlineReason = "schengen" | "country_limit";

export interface ExitDeadline {
  reason: DeadlineReason;
  /** Country the user must leave. */
  countryCode: string;
  /** Last day they may legally still be present. */
  lastLegalDay: string;
  /** Whole days between today and the last legal day. 0 = must leave today. */
  daysLeft: number;
  /** True once the limit has already been exceeded. */
  overstayed: boolean;
  explanation: string;
}

const SEARCH_HORIZON_DAYS = 400;

/** The trip the user is currently on, if any. */
export function currentTrip(trips: Trip[], today: string): Trip | null {
  return (
    trips.find((t) => t.entry_date <= today && (t.exit_date === null || t.exit_date >= today)) ??
    null
  );
}

/**
 * Last day the user may remain, assuming they stay put from today onward.
 * Uses the Schengen engine for Schengen countries and the per-entry tourist
 * allowance elsewhere.
 */
export function exitDeadline(trips: Trip[], today: string): ExitDeadline | null {
  const open = currentTrip(trips, today);
  if (!open || open.purpose === "residence") return null;

  if (SCHENGEN_COUNTRIES.has(open.country_code)) {
    const others: EngineTrip[] = toEngineTrips(trips.filter((t) => t.id !== open.id));
    let last: string | null = null;
    for (let i = 0; i < SEARCH_HORIZON_DAYS; i++) {
      const day = addDaysIso(today, i);
      const sim: EngineTrip[] = [
        ...others,
        { countryCode: open.country_code, entryDate: open.entry_date, exitDate: day },
      ];
      if (schengenDaysUsed(sim, day) > SCHENGEN_MAX_DAYS) break;
      last = day;
    }
    if (last === null) {
      const yesterday = addDaysIso(today, -1);
      return {
        reason: "schengen",
        countryCode: open.country_code,
        lastLegalDay: yesterday,
        daysLeft: 0,
        overstayed: true,
        explanation:
          "Your logged trips already exceed 90 days in the current rolling 180-day window.",
      };
    }
    return {
      reason: "schengen",
      countryCode: open.country_code,
      lastLegalDay: last,
      daysLeft: toDayIndex(last) - toDayIndex(today),
      overstayed: false,
      explanation:
        "Schengen 90/180 is a rolling window across the whole area combined — moving to another Schengen country does not stop the clock.",
    };
  }

  const city = CITIES.find((c) => c.country_code === open.country_code);
  if (!city || city.visa.ruleType === "NOMAD_VISA") return null;
  const allowance =
    open.purpose === "nomad_visa"
      ? (city.visa.nomadVisa.staysPerEntryDays ?? 0)
      : touristDaysWithExtension(city);
  if (allowance <= 0) return null;

  const lastLegalDay = addDaysIso(open.entry_date, allowance - 1);
  const daysLeft = toDayIndex(lastLegalDay) - toDayIndex(today);
  return {
    reason: "country_limit",
    countryCode: open.country_code,
    lastLegalDay,
    daysLeft: Math.max(0, daysLeft),
    overstayed: daysLeft < 0,
    explanation:
      open.purpose === "nomad_visa"
        ? `${city.visa.nomadVisa.name} allows ${allowance} days per entry.`
        : `${city.country} allows ${allowance} days per entry including any extension.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Geography                                                                   */
/* -------------------------------------------------------------------------- */

const EARTH_RADIUS_KM = 6371;

export function distanceKm(a: City, b: City): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)));
}

/** Rough door-to-door hours. Deliberately labelled "rough" in the UI. */
export function journeyHours(km: number, mode: TransportMode): number {
  const hours = mode === "overland" ? km / 55 + 2 : km / 700 + 3.5;
  return Math.max(1, Math.round(hours));
}

export type TransportMode = "overland" | "air";

/* -------------------------------------------------------------------------- */
/* Ranking                                                                     */
/* -------------------------------------------------------------------------- */

export interface ExitOption {
  city: City;
  mode: TransportMode;
  distanceKm: number;
  journeyHours: number;
  nonSchengen: boolean;
  /** Stops the Schengen clock — only meaningful for a Schengen deadline. */
  stopsTheClock: boolean;
  monthlyCost: number;
  /** Negative = cheaper than where they are now. */
  costDeltaUsd: number | null;
  daysAvailable: number;
  nomadVisaQualified: boolean | null;
  score: number;
  /** Component contributions, shown in the UI so the ranking is auditable. */
  breakdown: { label: string; points: number; max: number; detail: string }[];
}

/**
 * Transparent composite. Weights are fixed and visible in the UI:
 * clock-stopping status first, then monthly cost, then days available, then
 * journey distance. Commission plays no part — transport partners are not even
 * imported by this module.
 */
export const RANK_WEIGHTS = { clock: 40, cost: 30, days: 20, distance: 10 } as const;

function scale(value: number, best: number, worst: number): number {
  if (best === worst) return 1;
  return Math.max(0, Math.min(1, (worst - value) / (worst - best)));
}

/** Days the user could stay in `city` on their passport, using the engine. */
function daysAvailableIn(city: City, trips: Trip[], from: string): number {
  if (SCHENGEN_COUNTRIES.has(city.country_code)) {
    // Any trip still open ends the day the user departs. Passing an open trip
    // through with exitDate === null makes the engine treat them as still
    // present on every simulated future day — i.e. in two Schengen countries at
    // once. Close them at `from`.
    const engine = toEngineTrips(trips).map((t) =>
      t.exitDate === null ? { ...t, exitDate: from } : t,
    );

    /**
     * No allowance left means a Schengen destination is not an option at all.
     *
     * This guard used to be unnecessary by accident. While schengenDaysUsed
     * summed trip lengths instead of counting distinct days, the traveller's
     * existing stay and the simulated arrival both claimed the travel day, the
     * total came out one over, and the loop below returned 0 on the first
     * iteration. The right answer for the wrong reason.
     *
     * Counting the union fixed the arithmetic and removed that accident. On the
     * day someone reaches exactly 90 days, moving to another Schengen country
     * adds no new day — they are already inside the area — so the loop now
     * reports "1 day available". That is arithmetically true and terrible
     * advice: it describes a day they are already spending, on which they must
     * leave the area entirely.
     *
     * So the rule is stated directly instead of emerging from an off-by-one. If
     * there is no allowance left beyond the travel day, every Schengen
     * destination is worth zero days, and the ranking drops it.
     */
    if (schengenDaysUsed(engine, from) >= SCHENGEN_MAX_DAYS) return 0;

    let n = 0;
    for (let k = 0; k < SCHENGEN_MAX_DAYS; k++) {
      const day = addDaysIso(from, k);
      const sim: EngineTrip[] = [
        ...engine,
        { countryCode: city.country_code, entryDate: from, exitDate: day },
      ];
      if (schengenDaysUsed(sim, day) > SCHENGEN_MAX_DAYS) break;
      n++;
    }
    return n;
  }
  return touristDaysWithExtension(city);
}

export function rankExitOptions(input: {
  origin: City;
  trips: Trip[];
  today: string;
  departOn: string;
  /** True when the deadline is Schengen-driven, so leaving the area matters. */
  avoidSchengen: boolean;
  monthlyIncomeUsd?: number | null;
}): ExitOption[] {
  const { origin, trips, departOn, avoidSchengen } = input;
  const originCost = monthlyCost(origin);
  const overland = new Set(origin.overland_neighbours);

  const candidates = CITIES.filter((c) => c.id !== origin.id).map((city) => {
    const mode: TransportMode = overland.has(city.id) ? "overland" : "air";
    const km = distanceKm(origin, city);
    const nonSchengen = !SCHENGEN_COUNTRIES.has(city.country_code);
    const income = input.monthlyIncomeUsd ?? null;
    const need = nomadIncomeMonthly(city);
    return {
      city,
      mode,
      distanceKm: km,
      journeyHours: journeyHours(km, mode),
      nonSchengen,
      stopsTheClock: avoidSchengen ? nonSchengen : true,
      monthlyCost: monthlyCost(city),
      costDeltaUsd: monthlyCost(city) - originCost,
      daysAvailable: daysAvailableIn(city, trips, departOn),
      nomadVisaQualified:
        !city.visa.nomadVisa.exists || need === null
          ? city.visa.nomadVisa.exists
            ? null
            : false
          : income === null
            ? null
            : income >= need,
    };
  });

  // Only rank places you can actually be: a Schengen exit that leaves you with
  // zero legal days is not an option.
  const viable = candidates.filter((c) => c.daysAvailable > 0);
  const pool = viable.length > 0 ? viable : candidates;

  const costs = pool.map((c) => c.monthlyCost);
  const cheapest = Math.min(...costs);
  const dearest = Math.max(...costs);
  const dists = pool.map((c) => c.distanceKm);
  const nearest = Math.min(...dists);
  const furthest = Math.max(...dists);

  return pool
    .map((c) => {
      const clockPts = c.stopsTheClock ? RANK_WEIGHTS.clock : 0;
      const costPts = Math.round(scale(c.monthlyCost, cheapest, dearest) * RANK_WEIGHTS.cost);
      const daysPts = Math.round(
        Math.min(1, c.daysAvailable / SCHENGEN_MAX_DAYS) * RANK_WEIGHTS.days,
      );
      const distPts = Math.round(scale(c.distanceKm, nearest, furthest) * RANK_WEIGHTS.distance);
      const breakdown = [
        {
          label: avoidSchengen ? "Stops the Schengen clock" : "Resets your allowance",
          points: clockPts,
          max: RANK_WEIGHTS.clock,
          detail: avoidSchengen
            ? c.nonSchengen
              ? "Outside the Schengen Area — days here do not count"
              : "Inside the Schengen Area — the clock keeps running"
            : "Fresh allowance on entry",
        },
        {
          label: "Monthly cost",
          points: costPts,
          max: RANK_WEIGHTS.cost,
          detail: `$${c.monthlyCost.toLocaleString()}/mo — ${
            c.costDeltaUsd === 0
              ? "same as now"
              : c.costDeltaUsd < 0
                ? `$${Math.abs(c.costDeltaUsd).toLocaleString()} cheaper than now`
                : `$${c.costDeltaUsd.toLocaleString()} dearer than now`
          }`,
        },
        {
          label: "Days you can stay",
          points: daysPts,
          max: RANK_WEIGHTS.days,
          detail: `${c.daysAvailable} days on your passport`,
        },
        {
          label: "Journey",
          points: distPts,
          max: RANK_WEIGHTS.distance,
          detail: `${c.mode === "overland" ? "Overland" : "Air"} · ~${c.journeyHours}h · ${c.distanceKm.toLocaleString()} km`,
        },
      ];
      return {
        ...c,
        score: clockPts + costPts + daysPts + distPts,
        breakdown,
      } satisfies ExitOption;
    })
    .sort((a, b) => b.score - a.score || a.distanceKm - b.distanceKm);
}

/* -------------------------------------------------------------------------- */
/* Plan assembly                                                               */
/* -------------------------------------------------------------------------- */

export interface BorderRunPlan {
  deadline: ExitDeadline;
  origin: City;
  /** Suggested departure — the day before the deadline bites, or today. */
  departOn: string;
  options: ExitOption[];
}

/** Only fires when a move is already forced. Never speculative. */
export const BORDER_RUN_TRIGGER_DAYS = 30;

export function buildBorderRunPlan(input: {
  trips: Trip[];
  today: string;
  profile: Pick<Profile, "monthly_income_usd" | "home_city_id">;
}): BorderRunPlan | null {
  const { trips, today, profile } = input;
  const deadline = exitDeadline(trips, today);
  if (!deadline) return null;
  if (!deadline.overstayed && deadline.daysLeft > BORDER_RUN_TRIGGER_DAYS) return null;

  const open = currentTrip(trips, today);
  const origin =
    (open?.city_id ? getCity(open.city_id) : undefined) ??
    CITIES.find((c) => c.country_code === deadline.countryCode) ??
    (profile.home_city_id ? getCity(profile.home_city_id) : undefined);
  if (!origin) return null;

  const departOn = deadline.overstayed ? today : deadline.lastLegalDay;

  return {
    deadline,
    origin,
    departOn,
    options: rankExitOptions({
      origin,
      trips,
      today,
      departOn,
      avoidSchengen: deadline.reason === "schengen",
      monthlyIncomeUsd: profile.monthly_income_usd,
    }),
  };
}
