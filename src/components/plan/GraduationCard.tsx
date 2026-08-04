import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { PlaneLanding } from "lucide-react";
import { CITIES } from "@/lib/cities";
import { useProfile, useTrips } from "@/lib/store";
import { emptyChecklist, type ChecklistItemKey } from "@/lib/checklist";
import { idbSet } from "@/lib/offline/idb";
import { todayIso } from "@/lib/trip-dates";
import {
  CHECKLIST_TASKS,
  daysUntilDeparture,
  planProgress,
  useDeparturePlan,
  type ChecklistTaskKey,
  type DeparturePlan,
} from "@/lib/plan/departure";

/**
 * The handoff from the planning track to the tracker. It should read as a
 * graduation, not a second signup: everything the user entered before they
 * left carries over, and the departure checklist is archived as the notes on
 * their first trip record rather than being thrown away.
 */

const TASK_TO_TRIP_ITEM: Partial<Record<ChecklistTaskKey, ChecklistItemKey>> = {
  buy_esim: "esim",
  health_insurance: "insurance",
  confirm_entry_date: "entry_logged",
  upload_documents: "visa_docs_saved",
  save_onward_and_address: "onward_travel",
  book_first_month: "accommodation",
};

function archiveChecklist(tripId: string, plan: DeparturePlan) {
  if (typeof window === "undefined") return;
  const KEY = "driftly.checklists";
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    all = {};
  }
  const base = emptyChecklist(tripId);
  for (const task of CHECKLIST_TASKS) {
    const mapped = TASK_TO_TRIP_ITEM[task.key];
    if (mapped && plan.checked[task.key]) base.checked[mapped] = true;
  }
  all[tripId] = base;
  window.localStorage.setItem(KEY, JSON.stringify(all));
  void idbSet(KEY, all);
  window.dispatchEvent(new CustomEvent("driftly:checklists"));
}

/** True once the departure date has passed, or they logged an entry themselves. */
export function useHasDeparted() {
  const { plan } = useDeparturePlan();
  const { trips } = useTrips();
  const daysUntil = daysUntilDeparture(plan.targetDate);
  return {
    plan,
    trips,
    departed: (daysUntil != null && daysUntil <= 0) || trips.length > 0,
    graduated: plan.graduatedAt != null,
  };
}

export function GraduationCard() {
  const { plan, patch } = useDeparturePlan();
  const { profile, patchProfile } = useProfile();
  const { trips, addTrip } = useTrips();
  const daysUntil = daysUntilDeparture(plan.targetDate);
  const city = useMemo(
    () => CITIES.find((c) => c.id === plan.targetCityId),
    [plan.targetCityId],
  );
  const progress = planProgress(plan);

  const departed = (daysUntil != null && daysUntil <= 0) || trips.length > 0;
  if (profile.stage !== "planning" || plan.graduatedAt || !departed) return null;

  const entryDate = plan.targetDate ?? todayIso();
  const alreadyLogged = trips.length > 0;

  const graduate = () => {
    if (!alreadyLogged && city) {
      const id = crypto.randomUUID();
      addTrip({
        id,
        country_code: city.country_code,
        city_id: city.id,
        entry_date: entryDate,
        exit_date: null,
        purpose: "tourist",
        notes: `First move. Departure checklist completed ${progress.done} of ${progress.total} items.`,
        created_at: new Date().toISOString(),
      });
      archiveChecklist(id, plan);
    }
    patch({ graduatedAt: new Date().toISOString() });
    patchProfile({ stage: "abroad" });
  };

  return (
    <div className="panel mb-4 border-positive/40 bg-positive-muted/40 p-4">
      <div className="flex items-start gap-3">
        <PlaneLanding className="mt-0.5 h-5 w-5 shrink-0 text-positive" />
        <div className="min-w-0">
          <h2 className="text-base font-semibold">
            {alreadyLogged ? "You have logged your first entry." : "Your departure date has passed."}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you entered while planning carries over: your income, your savings and your
            departure checklist ({progress.done} of {progress.total} done). The checklist is filed
            against your first trip rather than deleted, and the day counters take over from here.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={graduate}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              {alreadyLogged ? "Switch me to the tracker" : `Log ${city?.city ?? "my entry"} and continue`}
            </button>
            <Link
              to="/tracker"
              className="rounded-md border border-border px-3 py-2 text-sm hover:border-primary/50"
            >
              Open tracker
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
