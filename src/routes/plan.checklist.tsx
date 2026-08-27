import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ExternalLink } from "lucide-react";
import { GraduationCard } from "@/components/plan/GraduationCard";
import { ProgressRing } from "@/components/Primitives";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { LegalFooter } from "@/components/LegalFooter";
import { CITIES } from "@/lib/cities";
import {
  CHECKLIST_TASKS,
  DEPARTURE_PHASES,
  activePhase,
  daysUntilDeparture,
  isPhaseDue,
  nextPurchaseTask,
  planProgress,
  tasksForPhase,
  useDeparturePlan,
} from "@/lib/plan/departure";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plan/checklist")({
  head: () => ({
    meta: [
      { title: `Departure countdown checklist | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Everything to do before you leave, phased at 90, 60, 30 and 7 days — passports, visas, insurance, tax exit, eSIM and the things you cannot do after you land.",
      },
      { property: "og:title", content: "The 90-day departure checklist" },
      {
        property: "og:description",
        content: "17 tasks, in the order they actually need doing before your first move.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChecklistPage,
});

function ChecklistPage() {
  const { plan, patch, toggleTask } = useDeparturePlan();
  const daysUntil = daysUntilDeparture(plan.targetDate);
  const current = activePhase(daysUntil);
  const progress = planProgress(plan);
  const purchase = nextPurchaseTask(plan, daysUntil);
  const city = CITIES.find((c) => c.id === plan.targetCityId);

  return (
    <div className="space-y-5">
      <GraduationCard />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs">Before you go</p>
          <h1 className="text-2xl font-semibold tracking-tight">Departure countdown</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Phased by lead time, not by importance. Everything here is stored on your device and
            works offline.
          </p>
        </div>
        <Link to="/plan" className="text-xs text-muted-foreground hover:text-foreground">
          Back to planning
        </Link>
      </header>

      <section className="panel grid gap-4 p-4 sm:grid-cols-3">
        <div>
          <label className="label-xs" htmlFor="dep-date">
            Target departure date
          </label>
          <input
            id="dep-date"
            type="date"
            value={plan.targetDate ?? ""}
            onChange={(e) => patch({ targetDate: e.target.value || null })}
            className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        <div>
          <span className="label-xs">Days to go</span>
          <p className="num mt-1 text-3xl font-semibold">
            {daysUntil == null ? "—" : Math.max(0, daysUntil)}
          </p>
          <p className="text-xs text-muted-foreground">
            {city ? `To ${city.city}, ${city.country}.` : "Pick a destination on the planning hub."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing
            value={progress.done}
            max={progress.total}
            size={64}
            strokeWidth={5}
            tone="positive"
            center={`${progress.done}/${progress.total}`}
            label={`${progress.done} of ${progress.total} tasks done`}
          />
          <div>
            <span className="label-xs">Progress</span>
            <p className="text-sm text-muted-foreground">
              {progress.done === progress.total
                ? "All tasks done."
                : `${progress.total - progress.done} left.`}
            </p>
          </div>
        </div>
      </section>

      {DEPARTURE_PHASES.map(({ phase, title, blurb }) => {
        const due = isPhaseDue(phase, daysUntil);
        const tasks = tasksForPhase(phase);
        const done = tasks.filter((t) => plan.checked[t.key]).length;
        return (
          <section key={phase} className={cn("panel overflow-hidden", !due && "opacity-70")}>
            <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {title}
                  {current === phase ? (
                    <span className="ms-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
                      You are here
                    </span>
                  ) : null}
                </h2>
                <p className="text-xs text-muted-foreground">{blurb}</p>
              </div>
              <span className="num shrink-0 text-xs text-muted-foreground">
                {done}/{tasks.length}
              </span>
            </div>

            <ul className="divide-y divide-border">
              {tasks.map((task) => {
                const checked = !!plan.checked[task.key];
                return (
                  <li key={task.key} className="flex gap-3 px-4 py-3">
                    <button type="button"
                      onClick={() => toggleTask(task.key)}
                      aria-pressed={checked}
                      aria-label={`Mark "${task.label}" as ${checked ? "not done" : "done"}`}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                        checked
                          ? "border-positive bg-positive text-background"
                          : "border-border hover:border-primary",
                      )}
                    >
                      {checked ? <Check className="h-3.5 w-3.5" /> : null}
                    </button>
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          checked && "text-muted-foreground line-through",
                        )}
                      >
                        {task.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {task.detail}
                      </p>
                      {task.link ? (
                        <Link
                          to={task.link.to}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          {task.link.label}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}

                      {/* One partner card on this whole screen, and only on the
                          task where buying the thing IS the next action. */}
                      {purchase?.key === task.key && task.partnerCategory ? (
                        <div className="mt-3">
                          <PartnerGroup
                            category={task.partnerCategory}
                            placement="plan_checklist"
                            title={
                              task.partnerCategory === "esim"
                                ? "Buy it before you fly"
                                : "Cover that starts before your entry date"
                            }
                            cityId={city?.id ?? null}
                            {...(city ? { countryCode: city.country_code } : {})}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="text-xs text-muted-foreground">
        {CHECKLIST_TASKS.length} tasks in total. When your departure date passes, this list is
        archived against your first trip in the tracker rather than deleted.
      </p>

      <LegalFooter />
    </div>
  );
}
