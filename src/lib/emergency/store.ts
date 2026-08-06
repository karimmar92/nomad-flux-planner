/**
 * Emergency details — DEVICE-LOCAL ONLY. Never synced.
 *
 * WHY THIS DOES NOT USE lib/store.ts:
 *
 * The shared `write()` in store.ts enqueues a sync op for the profile and trip
 * keys. Blood type, allergies and medication are health data — special
 * category personal data under GDPR Article 9 — which carries a materially
 * higher bar than anything else this app holds: explicit consent, a stronger
 * lawful basis, a heavier DPIA.
 *
 * The feature's entire value is being available offline on the device, so
 * there is no reason to accept that exposure. This module therefore writes
 * straight to localStorage and IndexedDB and never goes near the sync queue.
 *
 * IF YOU ARE ABOUT TO CHANGE THIS: routing emergency details through the
 * shared store, adding them to a Supabase table, or including them in any
 * server request turns this app into a processor of health data. That is a
 * product and legal decision, not a refactor. `assertNeverSynced` below exists
 * to make the accident loud rather than silent.
 */
import { useCallback, useEffect, useState } from "react";
import { idbGet, idbSet } from "../offline/idb";

export const EMERGENCY_KEY = "driftly.emergency";

export type EmergencyDetails = {
  /** Not health data — but still sensitive, so it stays local too. */
  insuranceProvider: string;
  insurancePolicy: string;
  /** The 24h assistance line, deliberately distinct from customer service:
   *  people reach for the wrong number under stress. */
  insuranceEmergencyPhone: string;
  contactName: string;
  contactPhone: string;
  passportNumber: string;
  passportExpiry: string;
  /** ── Health data (GDPR Art. 9). Local only. Never transmitted. ── */
  bloodType: string;
  allergies: string;
  medication: string;
};

export const EMPTY_DETAILS: EmergencyDetails = {
  insuranceProvider: "",
  insurancePolicy: "",
  insuranceEmergencyPhone: "",
  contactName: "",
  contactPhone: "",
  passportNumber: "",
  passportExpiry: "",
  bloodType: "",
  allergies: "",
  medication: "",
};

/** Fields that are health data under Art. 9 — used by the UI to label them. */
export const HEALTH_FIELDS: (keyof EmergencyDetails)[] = [
  "bloodType",
  "allergies",
  "medication",
];

/**
 * Guard against a future refactor quietly uploading this. Call it from any
 * code path that builds a network payload; it throws loudly rather than
 * letting health data leave the device unnoticed.
 */
export function assertNeverSynced(payloadKey: string) {
  if (payloadKey === EMERGENCY_KEY) {
    throw new Error(
      "Emergency details are health data (GDPR Art. 9) and must never be synced. " +
        "See src/lib/emergency/store.ts.",
    );
  }
}

function read(): EmergencyDetails {
  if (typeof window === "undefined") return EMPTY_DETAILS;
  try {
    const raw = window.localStorage.getItem(EMERGENCY_KEY);
    return raw ? { ...EMPTY_DETAILS, ...(JSON.parse(raw) as EmergencyDetails) } : EMPTY_DETAILS;
  } catch {
    return EMPTY_DETAILS;
  }
}

export function useEmergencyDetails() {
  const [details, setDetails] = useState<EmergencyDetails>(EMPTY_DETAILS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setDetails(read());
    setHydrated(true);
  }, []);

  const patch = useCallback((fields: Partial<EmergencyDetails>) => {
    setDetails((prev) => {
      const next = { ...prev, ...fields };
      try {
        window.localStorage.setItem(EMERGENCY_KEY, JSON.stringify(next));
        // IndexedDB mirror survives a localStorage eviction under storage
        // pressure — this is the data you least want to lose.
        void idbSet(EMERGENCY_KEY, next);
      } catch {
        /* private mode: the in-memory copy still serves this session */
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    setDetails(EMPTY_DETAILS);
    try {
      window.localStorage.removeItem(EMERGENCY_KEY);
      void idbSet(EMERGENCY_KEY, null);
    } catch {
      /* ignore */
    }
  }, []);

  return { details, patch, clear, hydrated };
}

/** Recover from IndexedDB if localStorage was evicted. */
export async function restoreFromIdb(): Promise<EmergencyDetails | null> {
  const stored = await idbGet<EmergencyDetails>(EMERGENCY_KEY);
  if (!stored) return null;
  try {
    window.localStorage.setItem(EMERGENCY_KEY, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
  return stored;
}

export function hasAnyDetails(d: EmergencyDetails): boolean {
  return Object.values(d).some((v) => v.trim() !== "");
}
