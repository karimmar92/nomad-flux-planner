/**
 * The telemetry hero: flag, status line, capacity bars, metric strip.
 *
 * Layout borrowed from a VPN status screen, because the pattern fits: a
 * bounded resource filling toward a limit, with the colour carrying the
 * urgency, over a strip of quiet labelled metrics. See lib/city-telemetry.ts
 * for why the bars are the right transplant and the map and sparkline are not.
 *
 * ── WHAT IS DELIBERATELY ABSENT ───────────────────────────────────────
 *
 * NO SPARKLINE. The reference has a live traffic graph and it is the most
 * eye-catching thing on it. There is no time-series data here to draw, and a
 * generated curve on a page whose entire selling point is trustworthy numbers
 * would be the worst possible decoration.
 *
 * NO MAP. A pulsing dot tells a VPN user where their traffic exits. Here it
 * would say "this city is in the place you already know it is".
 *
 * ── WHY THE BARS SHOW EVEN AT ZERO ────────────────────────────────────
 *
 * A visitor with no trips logged sees "0 of 90 days used". That is not empty
 * state, it is the answer to the question they arrived with, and it also
 * teaches the meter before it matters. Hiding it until there is data would
 * make the most useful element invisible to exactly the people who have not
 * started yet.
 */
import { Link } from "@tanstack/react-router";
import { MapPin, Plane } from "lucide-react";
import type { City, Trip } from "@/lib/types";
import { cityTelemetry, leadGauge, type Gauge } from "@/lib/city-telemetry";
import { flagEmoji, formatUsd } from "@/lib/arbitrage";
import { cn } from "@/lib/utils";

/** Bar colour by status. Colour is the message, so it is used nowhere else. */
const BAR: Record<Gauge["status"], string> = {
  ok: "bg-accent-positive",
  watch: "bg-accent-warning",
  at_limit: "bg-accent-warning",
  exceeded: "bg-negative",
};

const TEXT: Record<Gauge["status"], string> = {
  ok: "text-muted-foreground",
  watch: "text-accent-warning",
  at_limit: "text-accent-warning",
  exceeded: "text-negative",
};

export function CityTelemetryHero({
  city,
  trips,
  today,
  monthlyCostUsd,
  surplusMonthlyUsd,
  savingsRatePct,
}: {
  city: City;
  trips: Trip[];
  today: string;
  monthlyCostUsd: number;
  surplusMonthlyUsd: number | null;
  savingsRatePct: number | null;
}) {
  const t = cityTelemetry(city, trips, today);
  const lead = leadGauge(t.gauges);

  return (
    <section className="surface overflow-hidden">
      {/* ── Identity + live status ──────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-3xl leading-none" aria-hidden>
              {flagEmoji(city.country_code)}
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{city.city}</h1>
              <p className="text-sm text-muted-foreground">{city.country}</p>
            </div>
          </div>

          {/* The status line. Says something true whether or not they have
              logged anything, rather than going blank for a new visitor. */}
          <p className="mt-3 flex items-center gap-1.5 text-sm">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                t.currentlyHere ? "bg-accent-positive" : "bg-muted-foreground/50",
              )}
              aria-hidden
            />
            {t.currentlyHere ? (
              <span>
                <span className="font-medium">You are here now</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {t.daysEverHere} day{t.daysEverHere === 1 ? "" : "s"} recorded
                </span>
              </span>
            ) : t.daysEverHere > 0 ? (
              <span className="text-muted-foreground">
                {t.daysEverHere} day{t.daysEverHere === 1 ? "" : "s"} recorded in {city.country}
              </span>
            ) : (
              <span className="text-muted-foreground">No trips logged here yet</span>
            )}
          </p>
        </div>

        <Link
          to="/tracker"
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plane className="h-4 w-4" aria-hidden />
          Log a trip here
        </Link>
      </div>

      {/* ── The gauges. The reason this component exists. ────────────── */}
      <div className="grid gap-px bg-border sm:grid-cols-2">
        {t.gauges.map((g) => (
          <div key={g.id} className="bg-card p-5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label-xs">{g.label}</span>
              <span className={cn("text-xs font-medium", TEXT[g.status])}>
                {Math.round(g.pct)}%
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="num text-3xl font-semibold tracking-tight">{g.used}</span>
              <span className="text-sm text-muted-foreground">of {g.limit} days</span>
            </div>

            {/* The bar. Width is clamped in the model, so an overstay renders
                as a full red bar rather than overflowing its container. */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn("h-full rounded-full transition-all", BAR[g.status])}
                style={{ width: `${g.pct}%` }}
                role="progressbar"
                aria-valuenow={g.used}
                aria-valuemin={0}
                aria-valuemax={g.limit}
                aria-label={`${g.label}: ${g.used} of ${g.limit} days`}
              />
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{g.basis}</p>
          </div>
        ))}
      </div>

      {/* Which limit binds first. Stated, because it is not always the visa —
          in Georgia the tax threshold arrives at 183 and the visa at 365. */}
      {lead && lead.used > 0 ? (
        <p className="border-t border-border bg-surface-2 px-5 py-2.5 text-xs text-muted-foreground">
          Closest limit here:{" "}
          <span className={cn("font-medium", TEXT[lead.status])}>{lead.label}</span>, at{" "}
          {Math.round(lead.pct)}% of {lead.limit} days.
        </p>
      ) : null}

      {/* ── Metric strip. Numbers loud, labels quiet. ────────────────── */}
      <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">
        <Metric label="Cost / month" value={formatUsd(monthlyCostUsd)} />
        <Metric
          label="You'd keep"
          value={surplusMonthlyUsd == null ? "—" : formatUsd(surplusMonthlyUsd)}
          hint={surplusMonthlyUsd == null ? "Add your income" : undefined}
          tone={surplusMonthlyUsd == null ? undefined : surplusMonthlyUsd >= 0 ? "good" : "bad"}
        />
        <Metric
          label="Savings rate"
          value={savingsRatePct == null ? "—" : `${Math.round(savingsRatePct)}%`}
        />
        <Metric label="Internet" value={`${city.scores.internetSpeedMbps} Mbps`} />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  // `| undefined` explicitly: the project runs exactOptionalPropertyTypes, so
  // `hint?: string` means "may be absent" but NOT "may be present as undefined",
  // and every conditional call site passes undefined.
  hint?: string | undefined;
  tone?: "good" | "bad" | undefined;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="label-xs">{label}</div>
      <div
        className={cn(
          "num mt-1 text-lg font-semibold tracking-tight",
          tone === "good" && "text-accent-positive",
          tone === "bad" && "text-negative",
        )}
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" aria-hidden />
          {hint}
        </div>
      ) : null}
    </div>
  );
}
