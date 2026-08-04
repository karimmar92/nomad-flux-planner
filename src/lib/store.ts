import { useCallback, useEffect, useState } from "react";
import type { Profile, Trip } from "./types";
import { idbSet } from "./offline/idb";
import { enqueue } from "./offline/sync-queue";
import { cacheProfile, cacheTrips } from "./offline/cache";

/**
 * Local persistence layer. Every read/write goes through here so swapping in
 * Lovable Cloud tables (profiles / trips / saved_cities) is a single-file change.
 */

const KEYS = {
  profile: "driftly.profile",
  trips: "driftly.trips",
  saved: "driftly.saved_cities",
  theme: "driftly.theme",
};

export const DEFAULT_PROFILE: Profile = {
  display_name: "",
  nationality: "GB",
  monthly_income_usd: null,
  income_type: "freelance",
  home_city_id: null,
  currency_display: "USD",
  savings_usd: null,
  plan: "free",
  stage: "abroad",
  onboarded: false,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Offline-first write path. The local write is synchronous and always wins;
 * the IndexedDB mirror makes it durable and the queued op reconciles later.
 * Nothing on this path awaits the network — the user must never wait on a
 * request to log an entry date.
 */
function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  void idbSet(key, value);
  if (key === KEYS.profile) {
    cacheProfile(value as Profile);
    void enqueue({ entity: "profile", action: "upsert", payload: value });
  }
  if (key === KEYS.trips) {
    cacheTrips(value as Trip[]);
    void enqueue({ entity: "trip", action: "upsert", payload: value });
  }
  window.dispatchEvent(new CustomEvent("driftly:store", { detail: key }));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, fallback));
    setHydrated(true);
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read<T>(key, fallback));
    };
    window.addEventListener("driftly:store", onChange);
    return () => window.removeEventListener("driftly:store", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      write(key, next);
      setValue(next);
    },
    [key],
  );

  return { value, update, hydrated };
}

export function useProfile() {
  const { value, update, hydrated } = useStored<Profile>(KEYS.profile, DEFAULT_PROFILE);
  const patch = useCallback(
    (fields: Partial<Profile>) => update({ ...value, ...fields }),
    [value, update],
  );
  return { profile: value, setProfile: update, patchProfile: patch, hydrated };
}

export function useTrips() {
  const { value, update, hydrated } = useStored<Trip[]>(KEYS.trips, []);
  const addTrip = useCallback((trip: Trip) => update([...value, trip]), [value, update]);
  const removeTrip = useCallback(
    (id: string) => update(value.filter((t) => t.id !== id)),
    [value, update],
  );
  return { trips: value, addTrip, removeTrip, setTrips: update, hydrated };
}

export function useSavedCities() {
  const { value, update, hydrated } = useStored<string[]>(KEYS.saved, []);
  const toggle = useCallback(
    (id: string) =>
      update(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]),
    [value, update],
  );
  return { saved: value, toggle, hydrated };
}

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = (read<string>(KEYS.theme, "dark") as "dark" | "light") ?? "dark";
    setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      write(KEYS.theme, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme: toggle };
}
