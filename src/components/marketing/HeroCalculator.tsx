/**
 * Live Schengen calculator, embedded in the landing hero.
 *
 * This is the single highest-converting element available to this product, and
 * it is nearly free: the engine is pure client-side arithmetic, so a visitor
 * gets a real answer to a question they are anxious about before giving us
 * anything at all — no account, no email, no network call.
 *
 * It replaces what a mature SaaS site fills with a logo cloud. A stranger's
 * logo asks you to trust someone else's judgement; a correct answer to your own
 * question is proof you can verify yourself in ten seconds.
 *
 * Deliberately limited to ONE trip. The full rolling-window calculation across
 * a travel history is the product — this is the doorway, and a second date pair
 * here would turn a ten-second demo into a form.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import {
  SCHENGEN_MAX_DAYS,
  schengenStatus,
  toDayIndex,
  fromDayIndex,
  type Trip,
} from "@/lib/schengen";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function HeroCalculator() {
  const today = useMemo(() => todayIso(), []);
  const [entry, setEntry] = useState(() => fromDayIndex(toDayIndex(todayIso()) - 30));
  const [stillHere, setStillHere] = useState(true);
  const [exit, setExit] = useState(() => todayIso());

  const result = useMemo(() => {
    if (!entry) return null;
    if (!stillHere && exit && exit < entry) return null;
    const trips: Trip[] = [
      { countryCode: "PT", entryDate: entry, exitDate: stillHere ? null : exit },
    ];
    return schengenStatus(trips, today);
  }, [entry, exit, stillHere, today]);

  const tone =
    result == null
      ? "muted"
      : result.status === "violation" || result.status === "critical"
        ? "negative"
        : result.status === "warning"
          ? "warning"
          : "positive";

  return (
    <div className="panel mx-auto max-w-xl space-y-4 p-5 text-start">
      <div>
        <p className="label-xs">Try it now</p>
        <h2 className="mt-1 text-base font-semibold tracking-tight">
          How many Schengen days do you have left?
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          One trip, for a quick answer. No account, nothing sent anywhere — this runs entirely in
          your browser.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label-xs">Entered on</span>
          <input
            type="date"
            value={entry}
            max={today}
            onChange={(e) => setEntry(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="label-xs">Left on</span>
          <input
            type="date"
            value={stillHere ? today : exit}
            disabled={stillHere}
            min={entry}
            max={today}
            onChange={(e) => setExit(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm disabled:opacity-40"
          />
          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={stillHere}
              onChange={(e) => setStillHere(e.target.checked)}
            />
            Still there
          </label>
        </label>
      </div>

      {result ? (
        <div className="rounded-lg border border-border bg-surface-2 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">Days remaining today</span>
            <span
              className={
                tone === "positive"
                  ? "num text-3xl font-semibold text-positive"
                  : tone === "warning"
                    ? "num text-3xl font-semibold text-accent-warning"
                    : "num text-3xl font-semibold text-negative"
              }
            >
              {result.remaining}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.used} of {SCHENGEN_MAX_DAYS} used in the rolling 180-day window.
            {result.used > SCHENGEN_MAX_DAYS
              ? " That is already an overstay."
              : result.nextFullNinety
                ? ` A fresh 90 days opens up from ${result.nextFullNinety}.`
                : ""}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            This is one trip. Add the rest of your history and the number changes — older days age
            out of the window while newer ones count against you.
          </p>
          <Link
            to="/tracker"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Add your real trips
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      ) : (
        <p className="rounded-lg border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
          Pick the dates of your most recent Schengen trip.
        </p>
      )}
    </div>
  );
}
