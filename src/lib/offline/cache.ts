import { CITIES } from "@/lib/cities";
import { idbGet, idbSet } from "./idb";
import type { City, Profile, Trip } from "@/lib/types";

/**
 * Offline cache. Everything the app needs in an immigration hall with no
 * connectivity lives here: the whole seed dataset (~40 KB, so there is no
 * reason to cache a subset), the user's profile and every trip.
 *
 * Written on app open and after every successful load or local mutation.
 */

export const CACHE_KEYS = {
  cities: "cache.cities",
  profile: "cache.profile",
  trips: "cache.trips",
  cachedAt: "cache.updated_at",
} as const;

export type CachedCities = { cities: City[]; cachedAt: string };

export async function warmCityCache(): Promise<void> {
  // The full 25-city dataset — costs, visa, tax, notes. All of it.
  await idbSet(CACHE_KEYS.cities, { cities: CITIES, cachedAt: new Date().toISOString() });
  await idbSet(CACHE_KEYS.cachedAt, new Date().toISOString());
}

export async function readCachedCities(): Promise<City[]> {
  const row = await idbGet<CachedCities>(CACHE_KEYS.cities);
  return row?.cities ?? [];
}

export function cacheProfile(profile: Profile): void {
  void idbSet(CACHE_KEYS.profile, profile);
}

export function cacheTrips(trips: Trip[]): void {
  void idbSet(CACHE_KEYS.trips, trips);
}

export function readCachedProfile(): Promise<Profile | null> {
  return idbGet<Profile>(CACHE_KEYS.profile);
}

export function readCachedTrips(): Promise<Trip[] | null> {
  return idbGet<Trip[]>(CACHE_KEYS.trips);
}

export function readCacheTimestamp(): Promise<string | null> {
  return idbGet<string>(CACHE_KEYS.cachedAt);
}
