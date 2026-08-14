/**
 * "What time would my working day start here?"
 *
 * Comes straight out of an r/digitalnomad thread where someone working
 * 09:00–15:00 with a German team asked whether to winter in Argentina or Asia.
 * Sixteen replies, no consensus, and one person who knew the answer wrote:
 * "I was going to answer, but the math made my head hurt."
 *
 * TWO DESIGN RULES, both taken from that thread:
 *
 * 1. IT DOES NOT PICK A WINNER. The replies split cleanly between "finish by
 *    noon, the afternoon is yours" and "the whole morning is free, it feels
 *    like two days in one" — the same schedule described as a cost by one
 *    person and a benefit by another. So this states the hours and what they
 *    cost, and stops. A tool that told the early riser to move to Seoul would
 *    be substituting its taste for theirs.
 *
 * 2. IT SHOWS BOTH SEASONS WHEN THEY DIFFER. The question was asked in August
 *    about December. For 21 of our 30 cities the gap to Europe changes by an
 *    hour between summer and winter — usually because Europe shifts, not the
 *    destination. Showing only today's answer would quietly mislead anyone
 *    planning ahead, which is most people using this page.
 */
import { useState } from "react";
import { Clock, Pencil } from "lucide-react";
import {
  DEFAULT_WORK_HOURS,
  FIT_NOTE,
  formatMinute,
  formatOffset,
  isValidTimezone,
  scheduleFit,
  workWindowIn,
  type WorkHours,
} from "@/lib/timezone";
import { useProfile } from "@/lib/store";
import type { City } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Today, as YYYY-MM-DD in UTC. Consistent with the rest of the app's dates. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The same calendar day six months out — used to expose the seasonal swing. */
function sixMonthsOut(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y, m - 1 + 6, d));
  return shifted.toISOString().slice(0, 10);
}

function seasonLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return month >= 4 && month <= 9 ? "Apr–Oct" : "Nov–Mar";
}

const FIT_TONE: Record<string, string> = {
  aligned: "text-accent-positive",
  early: "text-foreground",
  very_early: "text-accent-warning",
  late: "text-foreground",
  very_late: "text-accent-warning",
  overnight: "text-negative",
};

export function WorkWindowCard({ city }: { city: City }) {
  const { profile, patchProfile } = useProfile();
  const stored = profile.work_hours;
  const [editing, setEditing] = useState(false);

  const work: WorkHours = stored
    ? {
        startMinute: stored.start_minute,
        endMinute: stored.end_minute,
        timezone: stored.timezone,
      }
    : DEFAULT_WORK_HOURS;

  /**
   * The timezone field is free text, so it can hold "Europe/Berln" mid-typing.
   * `Intl.DateTimeFormat` THROWS on an unknown zone rather than falling back,
   * which would take the whole city page down while someone is editing. Bail
   * to a message instead of computing on a zone that does not exist.
   */
  const zonesOk = isValidTimezone(work.timezone) && isValidTimezone(city.timezone);

  const today = todayIso();
  const other = sixMonthsOut(today);

  if (!zonesOk) {
    return (
      <section className="panel p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          Your working day in {city.city}
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          &ldquo;{work.timezone}&rdquo; is not a timezone we recognise. Use an IANA name like{" "}
          <code>Europe/Berlin</code> or <code>America/New_York</code>.
        </p>
        <HoursEditor
          work={work}
          onChange={(next) =>
            patchProfile({
              work_hours: {
                start_minute: next.startMinute,
                end_minute: next.endMinute,
                timezone: next.timezone,
              },
            })
          }
        />
      </section>
    );
  }

  const now = workWindowIn(work, city.timezone, today);
  const then = workWindowIn(work, city.timezone, other);
  const seasonsDiffer = now.startMinute !== then.startMinute;
  const fit = scheduleFit(now);

  // Nobody has said they have fixed hours yet: offer it rather than assume it.
  if (!stored && !editing) {
    return (
      <section className="panel p-4">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          Working hours here
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {city.city} is {formatOffset(now.offsetHours)} from your team&apos;s timezone. Tell us the
          hours you cannot move and every city will show what your working day looks like on the
          local clock.
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/50 hover:bg-surface-2"
        >
          Set my working hours
        </button>
      </section>
    );
  }

  return (
    <section className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
          Your working day in {city.city}
        </h2>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-label="Edit working hours"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Pencil className="h-3 w-3" aria-hidden />
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {editing ? (
        <HoursEditor
          work={work}
          onChange={(next) =>
            patchProfile({
              work_hours: {
                start_minute: next.startMinute,
                end_minute: next.endMinute,
                timezone: next.timezone,
              },
            })
          }
        />
      ) : null}

      <div className="mt-3 flex items-baseline gap-2">
        <span className={cn("num text-2xl font-semibold", FIT_TONE[fit])}>
          {formatMinute(now.startMinute)}–{formatMinute(now.endMinute)}
        </span>
        <span className="text-xs text-muted-foreground">
          local
          {now.startDayShift === 1 ? ", starting the next day" : null}
          {now.startDayShift === -1 ? ", starting the day before" : null}
        </span>
      </div>

      <p className="mt-0.5 text-xs text-muted-foreground">
        Your {formatMinute(work.startMinute)}–{formatMinute(work.endMinute)} in{" "}
        {work.timezone.split("/")[1]?.replace(/_/g, " ") ?? work.timezone} ·{" "}
        {formatOffset(now.offsetHours)}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{FIT_NOTE[fit]}</p>

      {seasonsDiffer ? (
        // The trap this feature exists to close: the offset above is not a
        // constant, and the person reading is usually planning months ahead.
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">This changes with the clocks.</span>{" "}
          {seasonLabel(other)} it becomes {formatMinute(then.startMinute)}–
          {formatMinute(then.endMinute)} local, an hour{" "}
          {then.startMinute > now.startMinute ? "later" : "earlier"}
          {city.timezone.startsWith("Asia/") || city.timezone.startsWith("Indian/")
            ? " — not because anything changes here, but because Europe shifts."
            : "."}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Deliberately three plain inputs and no timezone search. The zone defaults to
 * whatever the browser reports, which is right for the overwhelming majority
 * (your team is usually where you were when you took the job) and editable as
 * free text for everyone else.
 */
function HoursEditor({ work, onChange }: { work: WorkHours; onChange: (next: WorkHours) => void }) {
  const browserZone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  function setTime(which: "startMinute" | "endMinute", value: string) {
    const [h, m] = value.split(":").map(Number);
    if (h == null || Number.isNaN(h)) return;
    onChange({ ...work, [which]: h * 60 + (m ?? 0) });
  }

  return (
    <div className="mt-3 grid gap-2 rounded-md bg-surface-2 p-3 sm:grid-cols-3">
      <label className="block">
        <span className="label-xs">Start</span>
        <input
          type="time"
          value={formatMinute(work.startMinute)}
          onChange={(e) => setTime("startMinute", e.target.value)}
          className="input mt-1"
        />
      </label>
      <label className="block">
        <span className="label-xs">End</span>
        <input
          type="time"
          value={formatMinute(work.endMinute)}
          onChange={(e) => setTime("endMinute", e.target.value)}
          className="input mt-1"
        />
      </label>
      <label className="block">
        <span className="label-xs">Your team is in</span>
        <input
          type="text"
          value={work.timezone}
          onChange={(e) => onChange({ ...work, timezone: e.target.value })}
          placeholder={browserZone}
          className="input mt-1"
        />
      </label>
    </div>
  );
}
