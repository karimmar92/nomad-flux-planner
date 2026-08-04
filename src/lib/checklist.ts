import { useCallback, useEffect, useState } from "react";
import { idbSet } from "./offline/idb";
import { enqueue } from "./offline/sync-queue";
import type { City } from "./types";

/**
 * Pre-departure checklist, per trip. Fully available offline once cached —
 * this is the retention feature, not the partner card next to it. Being asked
 * for an onward ticket and an address at a border with no data connection is
 * the moment this app earns its place on the home screen.
 */

export type ChecklistItemKey =
  | "esim"
  | "insurance"
  | "entry_logged"
  | "visa_docs_saved"
  | "onward_travel"
  | "accommodation";

export type TripChecklist = {
  tripId: string;
  checked: Partial<Record<ChecklistItemKey, boolean>>;
  /** Free text the user fills in, cached locally, readable with no network. */
  accommodationAddress: string;
  onwardTravelNote: string;
  updatedAt: string;
};

const KEY = "driftly.checklists";

export const CHECKLIST_ITEMS: { key: ChecklistItemKey; label: string; hint: string }[] = [
  { key: "esim", label: "eSIM sorted", hint: "Buy before you fly — you cannot buy one after you land." },
  { key: "insurance", label: "Insurance active", hint: "Cover must start on or before your entry date." },
  { key: "entry_logged", label: "Entry date logged", hint: "Keeps the Schengen and tax counters honest." },
  {
    key: "visa_docs_saved",
    label: "Visa requirements saved offline",
    hint: "The document list for this country, cached on the device.",
  },
  {
    key: "onward_travel",
    label: "Onward travel booked",
    hint: "Immigration frequently asks for proof of exit.",
  },
  {
    key: "accommodation",
    label: "Accommodation address",
    hint: "Written on almost every arrival card. Have it one tap away.",
  },
];

function readAll(): Record<string, TripChecklist> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, TripChecklist>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, TripChecklist>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(all));
  void idbSet(KEY, all);
  window.dispatchEvent(new CustomEvent("driftly:checklists"));
}

export function emptyChecklist(tripId: string): TripChecklist {
  return {
    tripId,
    checked: {},
    accommodationAddress: "",
    onwardTravelNote: "",
    updatedAt: new Date().toISOString(),
  };
}

/** Has the user already ticked eSIM anywhere? Suppresses the arrival nudge. */
export function hasTickedEsimAnywhere(): boolean {
  return Object.values(readAll()).some((c) => c.checked.esim === true);
}

export function useTripChecklist(tripId: string | null) {
  const [checklist, setChecklist] = useState<TripChecklist>(() => emptyChecklist(tripId ?? ""));

  useEffect(() => {
    if (!tripId) return;
    const load = () => setChecklist(readAll()[tripId] ?? emptyChecklist(tripId));
    load();
    window.addEventListener("driftly:checklists", load);
    return () => window.removeEventListener("driftly:checklists", load);
  }, [tripId]);

  const patch = useCallback(
    (fields: Partial<Omit<TripChecklist, "tripId">>) => {
      if (!tripId) return;
      const all = readAll();
      const next: TripChecklist = {
        ...(all[tripId] ?? emptyChecklist(tripId)),
        ...fields,
        tripId,
        updatedAt: new Date().toISOString(),
      };
      all[tripId] = next;
      // Local write first; the network is never on this path.
      writeAll(all);
      setChecklist(next);
      void enqueue({ entity: "checklist", action: "upsert", payload: next });
    },
    [tripId],
  );

  const toggle = useCallback(
    (key: ChecklistItemKey) =>
      patch({ checked: { ...checklist.checked, [key]: !checklist.checked[key] } }),
    [checklist.checked, patch],
  );

  return { checklist, patch, toggle };
}

/**
 * The document list for a country, derived from the cached seed row. No
 * network, no fetch — this renders in an immigration hall.
 */
export function visaDocumentList(city: City | undefined, nationality: string): string[] {
  if (!city) {
    return [
      "Passport valid 6+ months beyond entry",
      "Proof of onward or return travel",
      "Accommodation address for the arrival card",
      "Proof of funds or a recent bank statement",
    ];
  }
  const docs = [
    `Passport valid 6+ months beyond ${city.country} entry`,
    `Tourist entry: ${city.visa.touristDays} days on a ${nationality} passport${
      city.visa.extensionDays ? ` (+${city.visa.extensionDays} day extension available)` : ""
    }`,
    "Proof of onward or return travel",
    "Accommodation address for the arrival card",
    "Proof of funds or a recent bank statement",
    "Travel insurance certificate",
  ];
  if (city.visa.nomadVisa.exists) {
    docs.push(
      `${city.visa.nomadVisa.name}: income evidence${
        city.visa.nomadVisa.minMonthlyIncomeUSD
          ? ` of $${city.visa.nomadVisa.minMonthlyIncomeUSD.toLocaleString()}/month`
          : ""
      }, if applying`,
    );
  }
  return docs;
}
