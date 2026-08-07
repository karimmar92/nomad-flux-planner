/**
 * Live Schengen calculator, on the landing page, before any signup.
 *
 * This is the highest-leverage element on the page, for two reasons:
 *
 *   1. It delivers the product's core value in one input. A visitor gets a real
 *      answer about their own situation before being asked for anything, which
 *      is the only kind of proof that survives scepticism.
 *   2. Effort creates ownership. Someone who has typed their own dates and
 *      seen their own number wants to keep it — and "Save this to my tracker"
 *      is then a continuation rather than a conversion ask.
 *
 * It runs the SAME engine as the app (src/lib/schengen.ts), not a marketing
 * approximation. A landing-page calculator that disagrees with the product is
 * a lie that gets discovered on day one.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, CalendarClock } from "lucide-react";
import { SCHENGEN_MAX_DAYS, schengenStatus } from "@/lib/schengen";
import { addDaysIso, todayIso } from "@/lib/trip-dates";
import { useTrips } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Trip } from "@/lib/types";

export function HeroCalculator() {
  const navigate = useNavigate();
  const { trips, setTrips } = useTrips();
  const today = useMemo(() => todayIso(), []);
  const [entry, setEntry] = useState(() => addDaysIso(todayIso(), -45));
  const [stillHere, setStillHere] = useState(true);
  const [exit, setExit] = useState(() => todayIso());

  const result = useMemo(() => {
    if (!entry || entry > today) return null;
    const probe: Trip[] = [
      {
        id: "hero-probe",
        country_code: "PT",
        city_id: null,
        entry_date: entry,
        exit_date: stillHere ? null : exit,
        purpose: "tourist",
        notes: "",
      },
    ];
    const status = schengenStatus(probe, today);
    // The date they must be out by, if they stayed continuously from entry.
    const mustLeave = addDaysIso(entry, SCHENGEN_MAX_DAYS - 1);
    return { ...status, mustLeave };
  }, [entry, exit, stillHere, today]);

  const save = () => {
    setTrips([
      ...trips,
      {
        id: crypto.randomUUID(),
        country_code: "PT",
        city_id: null,
        entry_date: entry,
        exit_date: stillHere ? null : exit,
        purpose: "tourist",
        notes: "",
      },
    ]);
    void navigate({ to: "/tracker" });
  };

  const tone =
    result?.status === "violation" || result?.status === "critical"
      ? "text-negative"
      : result?.status === "warning"
        ? "text-accent-warning"
        : "text-positive";

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <CalendarClock className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span className="label-xs">Try it — no account</span>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label-xs">I entered the Schengen area on</span>
            <input
              type="date"
              value={entry}
              max={today}
              onChange={(e) => setEntry(e.target.value)}
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="label-xs">and left on</span>
            <input
              type="date"
              value={stillHere ? today : exit}
              min={entry}
              max={today}
              disabled={stillHere}
              onChange={(e) => setExit(e.target.value)}
              className="num mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-50"
            />
            <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={stillHere}
                onChange={(e) => setStillHere(e.target.checked)}
              />
              I&apos;m still here
            </label>
          </label>
        </div>

        {result ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Days used" value={String(result.used)} tone={tone} />
              <Metric label="Days left" value={String(result.remaining)} />
              <Metric
                label={result.used >= SCHENGEN_MAX_DAYS ? "Over since" : "Latest exit"}
                value={result.mustLeave.slice(5)}
              />
            </div>

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-700 ease-out",
                  result.status === "ok" ? "bg-positive" : "bg-accent-warning",
                  (result.status === "critical" || result.status === "violation") && "bg-negative",
                )}
                style={{
                  width: `${Math.min(100, (result.used / SCHENGEN_MAX_DAYS) * 100)}%`,
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {result.used >= SCHENGEN_MAX_DAYS
                ? "That is past the 90-day limit. Overstaying risks a fine, a removal order and an entry ban of up to three years."
                : `Counted on the rolling 180-day window, with entry and exit days both counted in full. Your allowance next returns to a full 90 days on ${result.nextFullNinety ?? "a date beyond this horizon"}.`}
            </p>

            <button
              onClick={save}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
            >
              Save this trip and track it properly
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Saves to this device. No account, no email.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Pick an entry date to see your position.</p>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="label-xs">{label}</div>
      <div className={cn("num mt-0.5 text-2xl font-semibold", tone)}>{value}</div>
    </div>
  );
}
