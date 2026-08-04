import { useCallback, useEffect, useState } from "react";
import { idbSet } from "../offline/idb";
import { enqueue } from "../offline/sync-queue";
import { toDayIndex, todayIso } from "../trip-dates";

/**
 * The "before you go" plan. One per user — someone only leaves for the first
 * time once. Stored locally and mirrored to IndexedDB like everything else, so
 * the checklist survives the flight and the first week without a SIM.
 */

export type DeparturePhase = 90 | 60 | 30 | 7;

export type ChecklistTaskKey =
  // 90 days
  | "pick_destination"
  | "passport_validity"
  | "visa_requirements"
  | "business_structure"
  | "tax_exit"
  // 60 days
  | "book_flights"
  | "health_insurance"
  | "multi_currency_account"
  | "notify_clients"
  // 30 days
  | "book_first_month"
  | "mail_forwarding"
  | "cancel_home_services"
  | "upload_documents"
  // 7 days
  | "buy_esim"
  | "download_offline"
  | "save_onward_and_address"
  | "confirm_entry_date";

export type ChecklistTask = {
  key: ChecklistTaskKey;
  phase: DeparturePhase;
  label: string;
  detail: string;
  /** Internal route this task hands off to, if any. */
  link?: { to: string; label: string };
  /**
   * Partner category where buying something genuinely IS the next action.
   * Never more than one card renders on the page regardless — see
   * MAX_PARTNER_CARDS_PER_SCREEN in src/config/partners.ts.
   */
  partnerCategory?: "esim" | "insurance";
};

export const DEPARTURE_PHASES: { phase: DeparturePhase; title: string; blurb: string }[] = [
  { phase: 90, title: "90 days out", blurb: "Decisions, paperwork and the things with long lead times." },
  { phase: 60, title: "60 days out", blurb: "Book the move and put the cover in place." },
  { phase: 30, title: "30 days out", blurb: "Land the logistics and unwind things at home." },
  { phase: 7, title: "7 days out", blurb: "The last week. Most of this cannot be done after you land." },
];

export const CHECKLIST_TASKS: ChecklistTask[] = [
  {
    key: "pick_destination",
    phase: 90,
    label: "Decide your first destination",
    detail: "One city, not a route. A first move with three legs booked is three chances to get it wrong.",
    link: { to: "/plan", label: "Where should I start?" },
  },
  {
    key: "passport_validity",
    phase: 90,
    label: "Check passport validity",
    detail:
      "Many countries refuse entry with under six months remaining, and a renewal from abroad is slow. Store the scan now.",
    link: { to: "/record/vault", label: "Document vault" },
  },
  {
    key: "visa_requirements",
    phase: 90,
    label: "Check visa requirements for your passport",
    detail: "Entry days, whether an extension exists, and what immigration asks for on arrival.",
    link: { to: "/", label: "City visa facts" },
  },
  {
    key: "business_structure",
    phase: 90,
    label: "Work out whether you need a company",
    detail:
      "Only if you freelance. For most people with a real tax residency the honest answer is no — the tool will say so.",
    link: { to: "/setup/company", label: "Eligibility check" },
  },
  {
    key: "tax_exit",
    phase: 90,
    label: "Start your home tax-exit process",
    detail:
      "Deregistration deadlines are the slowest item on this list and the one most people discover too late.",
    link: { to: "/plan/tax-exit", label: "Leaving your tax system" },
  },

  {
    key: "book_flights",
    phase: 60,
    label: "Book flights",
    detail: "Immigration often asks for proof of onward travel. A dated ticket answers that question in one screenshot.",
  },
  {
    key: "health_insurance",
    phase: 60,
    label: "Sort health insurance",
    detail: "Cover must start on or before your entry date, and nomad visa applications generally require proof of it.",
    partnerCategory: "insurance",
  },
  {
    key: "multi_currency_account",
    phase: 60,
    label: "Open a multi-currency account",
    detail: "Getting paid in one currency and spending in another is the single most expensive thing to leave unsolved.",
    link: { to: "/kit", label: "Money options" },
  },
  {
    key: "notify_clients",
    phase: 60,
    label: "Tell your clients",
    detail: "Time zones, invoicing details and where you will be. Do it before you go, not from an airport.",
  },

  {
    key: "book_first_month",
    phase: 30,
    label: "Book the first month's accommodation",
    detail: "One month only. Long leases signed from another continent are how people end up in the wrong neighbourhood.",
  },
  {
    key: "mail_forwarding",
    phase: 30,
    label: "Arrange mail forwarding",
    detail: "Tax authorities and banks still write letters, and a missed one can undo the paperwork above.",
  },
  {
    key: "cancel_home_services",
    phase: 30,
    label: "Cancel or suspend home services",
    detail: "Utilities, gym, transport passes, subscriptions. Notice periods are usually 30 days, which is why this sits here.",
  },
  {
    key: "upload_documents",
    phase: 30,
    label: "Photograph and upload every important document",
    detail: "Passport, visas, insurance, birth certificate, qualifications. Available offline once stored.",
    link: { to: "/record/vault", label: "Document vault" },
  },

  {
    key: "buy_esim",
    phase: 7,
    label: "Buy your eSIM",
    detail:
      "Buy it before you fly. You cannot buy one after you land — activation needs a connection you will not have in the arrivals hall.",
    partnerCategory: "esim",
  },
  {
    key: "download_offline",
    phase: 7,
    label: "Download your data for offline use",
    detail: "City facts, visa rules and your documents, cached on the device.",
  },
  {
    key: "save_onward_and_address",
    phase: 7,
    label: "Save your onward ticket and first address offline",
    detail: "Both are written on almost every arrival card, usually while you are standing in a queue with no signal.",
  },
  {
    key: "confirm_entry_date",
    phase: 7,
    label: "Confirm your entry date in the tracker",
    detail: "This is the entry that starts your day counters. It becomes your first trip record.",
    link: { to: "/tracker", label: "Tracker" },
  },
];

export function tasksForPhase(phase: DeparturePhase): ChecklistTask[] {
  return CHECKLIST_TASKS.filter((t) => t.phase === phase);
}

/* ------------------------------------------------------------------ */
/* Stored plan                                                         */
/* ------------------------------------------------------------------ */

export type DeparturePlan = {
  /** yyyy-MM-dd, or null while they are still deciding. */
  targetDate: string | null;
  targetCityId: string | null;
  savingsUsd: number | null;
  incomeUsd: number | null;
  bufferTargetUsd: number | null;
  homeCountry: string | null;
  checked: Partial<Record<ChecklistTaskKey, boolean>>;
  /** Set once the plan has been handed over to the tracker. */
  graduatedAt: string | null;
  updatedAt: string;
};

export const EMPTY_PLAN: DeparturePlan = {
  targetDate: null,
  targetCityId: null,
  savingsUsd: null,
  incomeUsd: null,
  bufferTargetUsd: null,
  homeCountry: null,
  checked: {},
  graduatedAt: null,
  updatedAt: "",
};

const KEY = "driftly.departure_plan";

function readPlan(): DeparturePlan {
  if (typeof window === "undefined") return EMPTY_PLAN;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY_PLAN, ...(JSON.parse(raw) as DeparturePlan) } : EMPTY_PLAN;
  } catch {
    return EMPTY_PLAN;
  }
}

function writePlan(plan: DeparturePlan) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(plan));
  void idbSet(KEY, plan);
  void enqueue({ entity: "departure_plan", action: "upsert", payload: plan });
  window.dispatchEvent(new CustomEvent("driftly:plan"));
}

export function useDeparturePlan() {
  const [plan, setPlan] = useState<DeparturePlan>(EMPTY_PLAN);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const load = () => setPlan(readPlan());
    load();
    setHydrated(true);
    window.addEventListener("driftly:plan", load);
    return () => window.removeEventListener("driftly:plan", load);
  }, []);

  const patch = useCallback((fields: Partial<DeparturePlan>) => {
    const next = { ...readPlan(), ...fields, updatedAt: new Date().toISOString() };
    writePlan(next);
    setPlan(next);
  }, []);

  const toggleTask = useCallback(
    (key: ChecklistTaskKey) => {
      const current = readPlan();
      patch({ checked: { ...current.checked, [key]: !current.checked[key] } });
    },
    [patch],
  );

  return { plan, patch, toggleTask, hydrated };
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

/** Days until departure. Negative once the date has passed. UTC day indices only. */
export function daysUntilDeparture(targetDate: string | null, today = todayIso()): number | null {
  if (!targetDate) return null;
  return toDayIndex(targetDate) - toDayIndex(today);
}

/** The phase the user is currently inside, given a departure date. */
export function activePhase(daysUntil: number | null): DeparturePhase | null {
  if (daysUntil == null) return null;
  if (daysUntil <= 7) return 7;
  if (daysUntil <= 30) return 30;
  if (daysUntil <= 60) return 60;
  return 90;
}

export function isPhaseDue(phase: DeparturePhase, daysUntil: number | null): boolean {
  return daysUntil == null ? phase === 90 : daysUntil <= phase;
}

export function planProgress(plan: DeparturePlan): { done: number; total: number } {
  const done = CHECKLIST_TASKS.filter((t) => plan.checked[t.key]).length;
  return { done, total: CHECKLIST_TASKS.length };
}

/**
 * The single purchase card the checklist is allowed to show, if any: the
 * partner task in the current phase that is still unticked. One card per
 * screen, and only where buying something is genuinely the next action.
 */
export function nextPurchaseTask(
  plan: DeparturePlan,
  daysUntil: number | null,
): ChecklistTask | null {
  const phase = activePhase(daysUntil);
  if (phase == null) return null;
  const order: DeparturePhase[] = [7, 30, 60, 90];
  for (const p of order) {
    if (p < phase) continue;
    const task = tasksForPhase(p).find((t) => t.partnerCategory && !plan.checked[t.key]);
    if (task) return task;
  }
  return null;
}
