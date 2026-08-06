/**
 * Plans — group meetups in a public venue.
 *
 * See docs/plans-spec.md. This screen surfaces PLANS, never people. There is
 * no matching, no gender filter, no photos of attendees and no 1:1 messaging,
 * and adding any of them changes what this product is.
 *
 * Gated to the same single city as the radar. Density beats coverage: four
 * plans in one city reads as alive, forty spread across thirty cities reads as
 * abandoned.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, MapPin, Users } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import { getCity } from "@/lib/cities";
import { RADAR_CITY_ID } from "@/lib/radar-types";
import { useSession } from "@/lib/use-session";
import { EmptyState } from "@/components/Primitives";
import { LegalFooter } from "@/components/LegalFooter";
import {
  ACTIVITY_LABEL,
  DEFAULT_CAPACITY,
  MAX_CAPACITY,
  MAX_DAYS_AHEAD,
  MIN_CAPACITY,
  PLAN_ACTIVITIES,
  createPlan,
  formatPlanTime,
  listPlans,
  type PlanActivity,
  type PlanWithCounts,
} from "@/lib/plans/plans";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: `Plans | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Coffee, dinner or a coworking session with other people nearby. Public venues, small groups, no matching.",
      },
    ],
  }),
  component: PlansPage,
});

function PlansPage() {
  const { userId, signedIn, ready } = useSession();
  const [plans, setPlans] = useState<PlanWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<PlanActivity | "all">("all");
  const [creating, setCreating] = useState(false);

  const city = getCity(RADAR_CITY_ID);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await listPlans(RADAR_CITY_ID, userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plans.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const visible = useMemo(
    () => (filter === "all" ? plans : plans.filter((p) => p.activity === filter)),
    [plans, filter],
  );

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Small groups, public places, in {city?.city ?? "your city"}.
          </p>
        </div>
        {signedIn ? (
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            {creating ? "Close" : "New plan"}
          </button>
        ) : null}
      </div>

      {!signedIn && ready ? (
        <div className="panel p-4 text-sm">
          <p className="text-muted-foreground">
            You need an account to post or join a plan — so the people at the
            table know who they are meeting.{" "}
            <Link to="/auth" className="font-medium text-primary underline">
              Sign in
            </Link>
          </p>
        </div>
      ) : null}

      {creating && signedIn && userId ? (
        <CreatePlan
          userId={userId}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" />
        {PLAN_ACTIVITIES.map((a) => (
          <FilterChip
            key={a}
            active={filter === a}
            onClick={() => setFilter(a)}
            label={ACTIVITY_LABEL[a]}
          />
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-md border border-negative/50 bg-negative-muted px-3 py-2 text-sm text-negative">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <EmptyState
          title={`Nothing planned in ${city?.city ?? "this city"} yet`}
          body="Be the first. One plan is usually enough to start the week off."
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((p) => (
            <li key={p.id}>
              <Link
                to="/plans/$planId"
                params={{ planId: p.id }}
                className="panel block p-4 transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{ACTIVITY_LABEL[p.activity]}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{p.venue_name}</span>
                    </p>
                  </div>
                  <div className="shrink-0 text-end">
                    <p className="text-sm font-medium tabular-nums">
                      {formatPlanTime(p.starts_at)}
                    </p>
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {p.goingCount} of {p.capacity}
                    </p>
                  </div>
                </div>
                {p.note ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{p.note}</p>
                ) : null}
                {p.isAttending ? (
                  <p className="mt-2 text-xs font-medium text-primary">You&apos;re going</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Public places only. Never share where you&apos;re staying. Tell someone
        you trust where you&apos;re going.
      </p>

      <LegalFooter />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          : "rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-surface-2"
      }
    >
      {label}
    </button>
  );
}

/** Three taps for the common case: tomorrow, six people, coffee. */
function CreatePlan({ userId, onCreated }: { userId: string; onCreated: () => void }) {
  const [activity, setActivity] = useState<PlanActivity>("coffee");
  const [venue, setVenue] = useState("");
  const [hint, setHint] = useState("");
  const [date, setDate] = useState(() => isoDay(1));
  const [time, setTime] = useState("19:00");
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (venue.trim().length < 2) {
      setError("Where are you meeting? A public place — a café, a bar, a coworking space.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createPlan(userId, {
        city_id: RADAR_CITY_ID,
        activity,
        venue_name: venue.trim(),
        venue_hint: hint.trim() || undefined,
        starts_at: new Date(`${date}T${time}`).toISOString(),
        capacity,
        note: note.trim() || undefined,
      });
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the plan.");
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-3 p-4">
      <h2 className="text-sm font-semibold">New plan</h2>

      <div className="flex flex-wrap gap-1.5">
        {PLAN_ACTIVITIES.map((a) => (
          <FilterChip
            key={a}
            active={activity === a}
            onClick={() => setActivity(a)}
            label={ACTIVITY_LABEL[a]}
          />
        ))}
      </div>

      <label className="block">
        <span className="label-xs">Where</span>
        <input
          value={venue}
          onChange={(e) => {
            setVenue(e.target.value);
            setError(null);
          }}
          placeholder="Café name, bar, coworking space"
          className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          A public place. Never your accommodation.
        </span>
      </label>

      <label className="block">
        <span className="label-xs">Where exactly (optional)</span>
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Upstairs, the back tables"
          className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="label-xs">Day</span>
          <input
            type="date"
            value={date}
            min={isoDay(0)}
            max={isoDay(MAX_DAYS_AHEAD - 1)}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="label-xs">Time</span>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          />
        </label>
      </div>

      <label className="block">
        <span className="label-xs">How many people, including you</span>
        <input
          type="number"
          min={MIN_CAPACITY}
          max={MAX_CAPACITY}
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
          className="mt-1 w-24 rounded-md border border-input bg-surface px-2 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          Small enough that everyone actually talks.
        </span>
      </label>

      <label className="block">
        <span className="label-xs">Anything else (optional)</span>
        <textarea
          value={note}
          maxLength={200}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          placeholder="I'll be the one with the orange backpack"
          className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
        />
      </label>

      {error ? (
        <p role="alert" className="rounded-md bg-negative-muted px-2 py-1.5 text-xs text-negative">
          {error}
        </p>
      ) : null}

      <button
        onClick={submit}
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        {busy ? "Posting…" : "Post plan"}
      </button>
    </section>
  );
}

/** Local calendar day, n days from today, as YYYY-MM-DD for a date input. */
function isoDay(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
