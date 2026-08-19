import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Trash2, X } from "lucide-react";
import { SCHENGEN_COUNTRIES, SCHENGEN_MAX_DAYS, maxStayFrom, schengenStatus } from "@/lib/schengen";
import {
  addDaysIso,
  daysInCountryTaxYear,
  inclusiveDays,
  monthYearLabel,
  schengenWindowDays,
  todayIso,
  toEngineTrips,
} from "@/lib/trip-dates";
import { CITIES } from "@/lib/cities";
import { taxYearLabel, taxYearStartMonth } from "@/lib/arbitrage";
import { useProfile, useTrips } from "@/lib/store";
import { useSession } from "@/lib/use-session";
import { buildBorderRunPlan, exitDeadline } from "@/lib/border-run";
import { BorderRunCard } from "@/components/borderrun/BorderRunCard";
import { detectPreDeparture } from "@/lib/pre-departure";
import { PreDepartureCard } from "@/components/predeparture/PreDepartureCard";
import { TripChecklistCard } from "@/components/predeparture/TripChecklist";
import { GuidedTripFlow } from "@/components/tracker/GuidedTripFlow";
import { InstallPrompt } from "@/components/InstallPrompt";
import { hasTickedEsimAnywhere } from "@/lib/checklist";
import { toDayIndex } from "@/lib/schengen";
import { TransportGroup } from "@/components/partners/TransportGroup";
import { getCity } from "@/lib/cities";
import { flagEmoji } from "@/lib/arbitrage";
import { EmptyState, Stat } from "@/components/Primitives";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";
import { useGate } from "@/lib/paywall/use-gate";
import { LockedPreview } from "@/components/ProGate";
import { ImportTrips } from "@/components/trips/ImportTrips";
import type { Trip, TripPurpose } from "@/lib/types";
import { formatDate, formatDateLong } from "@/lib/i18n/format";

export const Route = createFileRoute("/tracker")({
  head: () => ({
    meta: [
      { title: `Visa tracker — Schengen 90/180 engine | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Log trips and get a rolling Schengen 90/180 calculation, per-country tax residency day counters and alerts before you trip a threshold.",
      },
      { property: "og:title", content: `Visa tracker | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Rolling Schengen 90/180 counter, per-country tax day counters and alerts.",
      },
    ],
  }),
  component: Tracker,
});

/** Tax-year metadata by country, extended by the cities dataset. */
const TAX_META: Record<string, { trigger: number; startMonth: number; label: string }> = {
  TH: { trigger: 180, startMonth: 0, label: "Jan–Dec" },
  MY: { trigger: 182, startMonth: 0, label: "Jan–Dec" },
  ZA: { trigger: 183, startMonth: 2, label: "Mar–Feb" },
  MU: { trigger: 183, startMonth: 6, label: "Jul–Jun" },
};

function taxMetaFor(code: string) {
  const fromCity = CITIES.find((c) => c.country_code === code);
  return (
    TAX_META[code] ?? {
      trigger: fromCity?.tax.residencyTriggerDays ?? 183,
      startMonth: fromCity ? taxYearStartMonth(fromCity) : 0,
      label: fromCity ? taxYearLabel(fromCity) : "Jan–Dec",
    }
  );
}

const COUNTRY_OPTIONS = Array.from(
  new Set([...CITIES.map((c) => c.country_code), "ES", "FR", "IT", "DE", "MY", "MU", "AE", "ID"]),
).sort();

function countryName(code: string) {
  return CITIES.find((c) => c.country_code === code)?.country ?? code;
}

const PALETTE = [
  "oklch(0.78 0.15 68)",
  "oklch(0.68 0.12 200)",
  "oklch(0.7 0.14 150)",
  "oklch(0.66 0.15 330)",
  "oklch(0.72 0.13 250)",
  "oklch(0.62 0.16 22)",
  "oklch(0.75 0.1 110)",
];

function Tracker() {
  const { i18n } = useTranslation();
  const { trips, addTrip, removeTrip, setTrips, hydrated } = useTrips();
  const { profile, patchProfile } = useProfile();
  const today = useMemo(() => todayIso(), []);
  /**
   * The planner opens on TODAY, not on an arbitrary date a month out. A date
   * the user did not choose is a question they have to correct before the tool
   * is usable, and "how long can I stay if I go now" is the common question.
   */
  const [plannedEntry, setPlannedEntry] = useState(() => todayIso());
  const [entryMode, setEntryMode] = useState<"guided" | "quick">("guided");
  const [justAdded, setJustAdded] = useState<Trip | null>(null);
  const [preDepartureDismissed, setPreDepartureDismissed] = useState(false);
  const { signedIn, ready: sessionReady } = useSession();
  const [deviceNoticeDismissed, setDeviceNoticeDismissed] = useState(false);

  const engineTrips = useMemo(() => toEngineTrips(trips), [trips]);
  const schengen = useMemo(() => schengenStatus(engineTrips, today), [engineTrips, today]);
  const windowDays = useMemo(() => schengenWindowDays(trips, today), [trips, today]);
  const plannerDays = useMemo(
    () => maxStayFrom(engineTrips, plannedEntry),
    [engineTrips, plannedEntry],
  );
  // Soft gate: the planner is a forward-looking check, three free a month.
  const plannerGate = useGate("forward_planning");
  const proPlanning = plannerGate.allowed;
  const plannerLastDay = plannerDays > 0 ? addDaysIso(plannedEntry, plannerDays - 1) : null;

  // Border-run planner. Deadline-triggered only — never a speculative prompt.
  const borderRun = useMemo(
    () =>
      buildBorderRunPlan({
        trips,
        today,
        profile: {
          monthly_income_usd: profile.monthly_income_usd,
          home_city_id: profile.home_city_id,
        },
      }),
    [trips, today, profile.monthly_income_usd, profile.home_city_id],
  );

  /**
   * Pre-departure, not arrival. An eSIM offer on arrival is unsellable —
   * no roaming, no usable WiFi, immigration queue. This fires 1-7 days out,
   * when buying one is actually possible.
   */
  const preDeparture = useMemo(() => detectPreDeparture(trips, today), [trips, today]);

  /** Upcoming trips that deserve a cached, offline-readable checklist. */
  const upcomingTrips = useMemo(
    () =>
      trips
        .filter((t) => {
          const d = toDayIndex(t.entry_date) - toDayIndex(today);
          return d >= 0 && d <= 60;
        })
        .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1)),
    [trips, today],
  );

  const countries = Array.from(new Set(trips.map((t) => t.country_code)));
  const colorFor = (code: string) =>
    PALETTE[countries.indexOf(code) % PALETTE.length] ?? PALETTE[0];

  const counters = countries.map((code) => {
    const meta = taxMetaFor(code);
    const count = daysInCountryTaxYear(trips, code, today, meta.startMonth);
    return { code, meta, count, pct: (count.days / meta.trigger) * 100 };
  });

  const alerts = [
    ...(schengen.status !== "ok"
      ? [
          {
            level: schengen.status === "warning" ? "warn" : "high",
            text: `Schengen: ${schengen.used} of ${SCHENGEN_MAX_DAYS} days used in the current rolling window. ${schengen.remaining} remaining today.`,
          },
        ]
      : []),
    ...counters
      .filter((c) => c.pct >= 75)
      .map((c) => ({
        level: c.pct >= 90 ? "high" : "warn",
        text: `${countryName(c.code)}: ${c.count.days} of ${c.meta.trigger} days toward tax residency (${c.meta.label} year).`,
      })),
  ];

  /**
   * "Last day you can stay" comes from exitDeadline — the same helper the
   * border-run card uses. Deriving it separately here (e.g. from maxStayFrom,
   * which models a NEW entry today) produced a hero date that contradicted the
   * card directly beneath it by a fortnight.
   */
  const deadline = useMemo(() => exitDeadline(trips, today), [trips, today]);

  /**
   * Status is carried by a WORD and an ICON, never by colour alone — this
   * page is read by people who are colour-blind, in sunlight, at a border.
   */
  const statusWord =
    schengen.status === "violation"
      ? "Over the limit"
      : schengen.status === "ok"
        ? "Safe"
        : "Getting close";
  const StatusIcon =
    schengen.status === "violation"
      ? AlertOctagon
      : schengen.status === "ok"
        ? CheckCircle2
        : AlertTriangle;
  const statusTone =
    schengen.status === "violation"
      ? "text-negative"
      : schengen.status === "ok"
        ? "text-positive"
        : "text-primary";

  const entryFlow =
    entryMode === "guided" ? (
      <GuidedTripFlow
        passport={profile.nationality || null}
        onSetPassport={(code) => patchProfile({ nationality: code })}
        onAdd={(trip) => {
          addTrip(trip);
          setJustAdded(trip.entry_date > today ? trip : null);
        }}
        onSwitchToQuick={() => setEntryMode("quick")}
      />
    ) : (
      <div className="space-y-2">
        <AddTrip
          onAdd={(trip) => {
            addTrip(trip);
            setJustAdded(trip.entry_date > today ? trip : null);
          }}
        />
        <button
          type="button"
          onClick={() => setEntryMode("guided")}
          className="min-h-11 text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Walk me through it instead
        </button>
      </div>
    );

  /**
   * FIRST VISIT. No trips means no Schengen window, no timeline, no counters
   * and no list — rendering five empty panels makes a working product look
   * broken. One line of explanation, the entry flow, the import option.
   */
  if (hydrated && trips.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Visa tracker</h1>
          <p className="text-sm text-muted-foreground">
            Log where you have been and {APP_NAME} works out how many Schengen days you have left,
            when you must leave, and when you cross a tax-residency threshold.
          </p>
        </div>
        {entryFlow}
        <ImportTrips />
        <LegalFooter />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">Visa tracker</h1>

      {/* 1 ─ STATUS HERO. Days remaining is the largest thing on the page. */}
      <section className="panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className="num text-6xl font-semibold leading-none tracking-tight sm:text-7xl">
            {schengen.remaining}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">days remaining</div>
            <div className={cn("flex items-center gap-1.5 text-sm font-semibold", statusTone)}>
              <StatusIcon className="h-4 w-4 shrink-0" aria-hidden />
              {statusWord}
            </div>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          In the rolling Schengen 180-day window. Entry and exit days both count as full days.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="label-xs">Last day you can stay</div>
            <div className="num mt-0.5 text-lg font-semibold">
              {deadline
                ? deadline.overstayed
                  ? "Already past"
                  : formatDate(deadline.lastLegalDay, i18n.language)
                : "Not in a counted country"}
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="label-xs">Full 90 available again from</div>
            <div className="num mt-0.5 text-lg font-semibold">
              {schengen.nextFullNinety
                ? formatDate(schengen.nextFullNinety, i18n.language)
                : "beyond 400 days"}
            </div>
          </div>
        </div>

        {schengen.status === "violation" ? (
          <p className="mt-3 rounded-md border border-negative/50 bg-negative-muted px-3 py-2 text-xs text-negative">
            Your logged trips exceed 90 days in the current window.
          </p>
        ) : null}

        {/* Trust, not glance: the raw arithmetic folds away. */}
        <details className="mt-3 rounded-md border border-border">
          <summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium">
            How this is calculated
          </summary>
          <div className="grid grid-cols-2 gap-4 px-3 pb-3">
            <Stat label="Days used" value={schengen.used} hint="in trailing 180 days" />
            <Stat label="Allowance" value={SCHENGEN_MAX_DAYS} hint="days per 180" />
            {/*
              Dates always render through formatDate — never raw ISO. Any
              numeric-only format is ambiguous across locales (03/04 is 3 April
              to a German, 4 March to an American), and every date here has
              legal consequences, so the month is always a word.
            */}
            <Stat
              label="Window opened"
              value={formatDate(addDaysIso(today, -179), i18n.language)}
              size="sm"
            />
            <Stat
              label="Window closes"
              value={formatDate(today, i18n.language)}
              size="sm"
              hint="the window is re-tested every day"
            />
          </div>
        </details>

        {/* FORWARD PLANNING IS PRO. Today's status above is free forever —
            the alarm is free, the answer to "what now?" is paid. */}
        {proPlanning ? (
          <div className="mt-3 rounded-md border border-border p-3">
            <label className="label-xs" htmlFor="planner">
              If I enter on…
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <input
                id="planner"
                type="date"
                value={plannedEntry}
                onChange={(e) => setPlannedEntry(e.target.value)}
                className="min-h-11 rounded-md border border-input bg-surface px-2 text-sm"
              />
              <p className="num text-sm">
                you could stay{" "}
                <span className="font-semibold text-primary">{plannerDays} days</span>
                {plannerLastDay ? ` — until ${formatDate(plannerLastDay, i18n.language)}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <LockedPreview
            gate={plannerGate}
            className="mt-6"
            headline={`Entering ${formatDate(plannedEntry, i18n.language)} gives you a legal stay — Pro shows how long`}
            detail="Plan any future entry date, and a whole year of trips, against your rolling window."
          >
            <div className="rounded-md border border-border p-3">
              <div className="label-xs">If I enter on…</div>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm">
                  {formatDate(plannedEntry, i18n.language)}
                </span>
                <p className="num text-sm">
                  you could stay{" "}
                  <span className="font-semibold text-primary">{plannerDays} days</span>
                  {plannerLastDay ? ` — until ${formatDate(plannerLastDay, i18n.language)}` : ""}
                </p>
              </div>
            </div>
          </LockedPreview>
        )}
      </section>

      {/* 2 ─ ALERTS. Announced, because one can appear without a navigation. */}
      <div aria-live="polite" className="space-y-2 empty:hidden">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
              a.level === "high"
                ? "border-negative/50 bg-negative-muted text-negative"
                : "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{a.text}</span>
          </div>
        ))}
      </div>

      {/* 3 ─ WHAT TO DO NEXT */}
      {borderRun ? (
        <BorderRunCard plan={borderRun} />
      ) : null}

      {preDeparture && !preDepartureDismissed ? (
        <PreDepartureCard
          trigger={preDeparture}
          /* One card per screen: the border-run card already holds it. */
          showPartnerCard={!borderRun}
          esimAlreadyTicked={hasTickedEsimAnywhere()}
          onDismiss={() => setPreDepartureDismissed(true)}
        />
      ) : null}

      {/* 4 ─ ADD A TRIP. Logging is the habit; it sits above the analysis. */}
      {entryFlow}

      {justAdded ? (
        <TripConfirmKit
          trip={justAdded}
          originCityName={
            currentTripCity(trips, today) ??
            (profile.home_city_id ? getCity(profile.home_city_id)?.city : undefined) ??
            null
          }
          /* One card per screen: the border-run card already carries this
             screen's single partner link when a deadline is live. */
          showPartnerCard={!borderRun && !(preDeparture && !preDepartureDismissed)}
          onDismiss={() => setJustAdded(null)}
        />
      ) : null}

      {upcomingTrips.length > 0 ? (
        <div className="space-y-3">
          {upcomingTrips.slice(0, 3).map((trip) => (
            <TripChecklistCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : null}

      {/* 5 ─ TAX RESIDENCY COUNTERS */}
      {counters.length > 0 ? (
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Tax residency day counters</h2>
          <div className="space-y-3">
            {counters.map((c) => (
              <div key={c.code}>
                <div className="flex items-baseline justify-between text-sm">
                  <span>
                    {flagEmoji(c.code)} {countryName(c.code)}{" "}
                    <span className="text-xs text-muted-foreground">
                      · {c.meta.label} year
                      {c.meta.startMonth !== 0 ? " (non-calendar)" : ""}
                    </span>
                  </span>
                  <span
                    id={`tax-count-${c.code}`}
                    className={cn(
                      "num font-medium",
                      c.pct >= 90 && "text-negative",
                      c.pct >= 75 && c.pct < 90 && "text-primary",
                    )}
                  >
                    {c.count.days} / {c.meta.trigger}
                  </span>
                </div>
                {/* The bar is decoration over the number; the number is the
                    accessible value, associated here rather than duplicated. */}
                <div
                  role="progressbar"
                  aria-labelledby={`tax-count-${c.code}`}
                  aria-valuenow={c.count.days}
                  aria-valuemin={0}
                  aria-valuemax={c.meta.trigger}
                  aria-valuetext={`${c.count.days} of ${c.meta.trigger} days in ${countryName(c.code)}`}
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      c.pct >= 90 ? "bg-negative" : "bg-primary",
                    )}
                    style={{ width: `${Math.min(100, c.pct)}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Counting {c.count.periodStart} → {c.count.periodEnd}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 6 ─ TIMELINE */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold">Last 12 months</h2>
        <Timeline
          trips={trips}
          today={today}
          countries={countries}
          colorFor={colorFor}
          schengenDays={windowDays}
        />
      </section>

      {/* 7 ─ YOUR TRIPS */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Your trips</h2>
          <ClearAllTrips count={trips.length} onClear={() => setTrips([])} />
        </div>
        <div className="panel divide-y divide-border">
          {[...trips]
            .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
            .map((trip) => (
              <div key={trip.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: colorFor(trip.country_code) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {flagEmoji(trip.country_code)} {countryName(trip.country_code)}
                    {SCHENGEN_COUNTRIES.has(trip.country_code) ? (
                      <span className="ms-2 rounded border border-border px-1 text-[10px] text-muted-foreground">
                        Schengen
                      </span>
                    ) : null}
                  </div>
                  <div className="num text-xs text-muted-foreground">
                    {formatDate(trip.entry_date, i18n.language)} →{" "}
                    {trip.exit_date ? formatDate(trip.exit_date, i18n.language) : "still here"} ·{" "}
                    {inclusiveDays(trip.entry_date, trip.exit_date ?? today)} days ·{" "}
                    {trip.purpose.replace("_", " ")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeTrip(trip.id)}
                  aria-label={`Delete trip to ${countryName(trip.country_code)}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-negative"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
        </div>
      </section>

      {/* 8 ─ SECONDARY. Import, install, device warning, legal. */}
      <details className="panel p-4">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">
          Import more trips from a list
        </summary>
        <div className="mt-3">
          <ImportTrips />
        </div>
      </details>

      {/* Offline is only real once installed, and the tracker is the page
          whose value depends on it. */}
      <InstallPrompt />

      {/*
        Device-only warning. Everything works without an account — that is
        deliberate, because logging a trip is the habit the product depends on
        and a signup wall kills it. But someone must never accumulate months of
        history believing it is safe when it lives in one browser's storage.
      */}
      {sessionReady && !signedIn && !deviceNoticeDismissed ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p className="text-foreground">
            Saved on this device only. If you clear your browser or switch phones, these trips are
            gone.{" "}
            <Link
              to="/auth"
              search={{ next: "/tracker" }}
              className="font-medium text-primary underline"
            >
              Create an account
            </Link>{" "}
            and everything you have already logged is uploaded automatically.
          </p>
          <button
            type="button"
            onClick={() => setDeviceNoticeDismissed(true)}
            aria-label="Dismiss"
            className="ms-auto inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      ) : null}

      <LegalFooter />
    </div>
  );
}

/**
 * Destructive and therefore two-step. Without any reset at all, leftover test
 * data looks exactly like data the app invented on its own.
 */
function ClearAllTrips({ count, onClear }: { count: number; onClear: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:border-negative/50 hover:text-negative"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Clear all trips
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Delete all {count} trips?</span>
      <button
        type="button"
        onClick={() => {
          onClear();
          setConfirming(false);
        }}
        className="min-h-11 rounded-md border border-negative bg-negative-muted px-3 text-xs font-medium text-negative"
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded-md border border-border px-3 text-xs"
      >
        Cancel
      </button>
    </div>
  );
}

/**
 * One SVG, one rect per contiguous segment.
 *
 * This used to render 365 divs for the bars plus 365 for the Schengen strip:
 * 730 DOM nodes on a page whose whole point is being opened on a phone, on
 * mobile data, in an immigration queue. Segments carry the same information at
 * a fraction of the cost.
 */
function Timeline({
  trips,
  today,
  countries,
  colorFor,
  schengenDays,
}: {
  trips: Trip[];
  today: string;
  countries: string[];
  colorFor: (code: string) => string | undefined;
  schengenDays: Set<string>;
}) {
  const DAYS = 365;
  const start = addDaysIso(today, -(DAYS - 1));
  const startIdx = toDayIndex(start);
  const endIdx = toDayIndex(today);

  /** Trip segments clipped to the visible window, in day offsets. */
  const segments = trips
    .map((trip) => {
      const from = Math.max(toDayIndex(trip.entry_date), startIdx);
      const to = Math.min(toDayIndex(trip.exit_date ?? today), endIdx);
      return { trip, from: from - startIdx, span: to - from + 1 };
    })
    .filter((s) => s.span > 0);

  /** Contiguous runs of days counted in the current Schengen window. */
  const countedRuns: { from: number; span: number }[] = [];
  for (let i = 0; i < DAYS; i++) {
    if (!schengenDays.has(addDaysIso(start, i))) continue;
    const last = countedRuns[countedRuns.length - 1];
    if (last && last.from + last.span === i) last.span += 1;
    else countedRuns.push({ from: i, span: 1 });
  }

  return (
    <div>
      <svg
        viewBox={`0 0 ${DAYS} 46`}
        preserveAspectRatio="none"
        className="h-12 w-full"
        role="img"
        aria-label={`Travel timeline for the last 12 months, ${segments.length} trips`}
      >
        <rect x={0} y={0} width={DAYS} height={38} rx={2} fill="var(--surface-2)" />
        {segments.map((s) => (
          <rect
            key={s.trip.id}
            x={s.from}
            y={0}
            width={s.span}
            height={38}
            fill={colorFor(s.trip.country_code)}
          >
            <title>
              {`${countryName(s.trip.country_code)} · ${s.trip.entry_date} → ${s.trip.exit_date ?? "still here"}`}
            </title>
          </rect>
        ))}
        {countedRuns.map((r) => (
          <rect key={`c-${r.from}`} x={r.from} y={41} width={r.span} height={5} fill="var(--negative)">
            <title>Counted in the current Schengen window</title>
          </rect>
        ))}
      </svg>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{monthYearLabel(start)}</span>
        <span>{monthYearLabel(today)}</span>
      </div>
      {/* Colour needs a key: without one the bars are decoration. */}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {countries.map((code) => (
          <li key={code} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: colorFor(code) }}
              aria-hidden
            />
            {countryName(code)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-negative" aria-hidden />
          Days counted in the current Schengen window
        </li>
      </ul>
    </div>
  );
}


function AddTrip({ onAdd }: { onAdd: (trip: Trip) => void }) {
  /**
   * No country is preselected. This used to open on "PT", which silently
   * became the logged country whenever the user did not notice — a wrong
   * country is a wrong Schengen calculation, so it is asked, not guessed.
   */
  const [country, setCountry] = useState("");
  const [entry, setEntry] = useState(() => todayIso());
  const [exit, setExit] = useState("");
  const [stillHere, setStillHere] = useState(false);
  const [purpose, setPurpose] = useState<TripPurpose>("tourist");
  const [error, setError] = useState<string | null>(null);

  /**
   * Returns a message when the form cannot be submitted, null when it can.
   *
   * This used to be `if (!entry || (!stillHere && !exit)) return;` — a silent
   * no-op. Clicking "Add trip" with no exit date did nothing at all, with no
   * explanation, which reads as a broken button. Logging a trip is the one
   * action the whole product depends on; it must never fail quietly.
   */
  function validate(): string | null {
    if (!country) return "Add a country.";
    if (!entry) return "Add an entry date.";
    if (!stillHere && !exit) {
      return "Add an exit date, or tick “Still here” if you haven’t left yet.";
    }
    if (!stillHere && exit && exit < entry) {
      return "The exit date is before the entry date.";
    }
    return null;
  }

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold">Add a trip</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="label-xs">Country</span>
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setError(null);
            }}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface px-2 text-sm"
          >
            <option value="" disabled>
              Select a country
            </option>
            {COUNTRY_OPTIONS.map((code) => (
              <option key={code} value={code}>
                {flagEmoji(code)} {countryName(code)}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="label-xs">Entry date</span>
          <input
            type="date"
            value={entry}
            onChange={(e) => {
              setEntry(e.target.value);
              setError(null);
            }}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface px-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="label-xs">Exit date</span>
          <input
            type="date"
            value={exit}
            disabled={stillHere}
            onChange={(e) => {
              setExit(e.target.value);
              setError(null);
            }}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface px-2 text-sm disabled:opacity-40"
          />
          <label className="mt-1.5 flex min-h-11 items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={stillHere}
              onChange={(e) => {
                setStillHere(e.target.checked);
                setError(null);
              }}
            />
            Still here
          </label>
        </label>
        <label className="block">
          <span className="label-xs">Purpose</span>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as TripPurpose)}
            className="mt-1 min-h-11 w-full rounded-md border border-input bg-surface px-2 text-sm"
          >
            <option value="tourist">Tourist</option>
            <option value="nomad_visa">Nomad visa</option>
            <option value="residence">Residence</option>
          </select>
        </label>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-negative/50 bg-negative-muted px-3 py-2 text-xs text-negative"
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => {
          const problem = validate();
          if (problem) {
            setError(problem);
            return;
          }
          setError(null);
          onAdd({
            id: crypto.randomUUID(),
            country_code: country,
            city_id: CITIES.find((c) => c.country_code === country)?.id ?? null,
            entry_date: entry,
            exit_date: stillHere ? null : exit,
            purpose,
            notes: "",
          });
          setCountry("");
          setExit("");
          setStillHere(false);
        }}
        className="mt-3 min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
      >
        Add trip
      </button>
    </section>
  );
}

/**
 * Highest-intent moment in the app: a future trip was just logged. Shown once,
 * dismissible, and only for future entry dates.
 */
/** City the user is in right now, used as the origin for a booked journey. */
function currentTripCity(trips: Trip[], today: string): string | null {
  const open = trips.find(
    (t) => t.entry_date <= today && (t.exit_date === null || t.exit_date >= today),
  );
  return open?.city_id ? (getCity(open.city_id)?.city ?? null) : null;
}

function TripConfirmKit({
  trip,
  originCityName,
  showPartnerCard,
  onDismiss,
}: {
  trip: Trip;
  originCityName: string | null;
  showPartnerCard: boolean;
  onDismiss: () => void;
}) {
  const { i18n } = useTranslation();
  const destination = trip.city_id ? getCity(trip.city_id) : undefined;
  const label = formatDateLong(trip.entry_date, i18n.language);

  // One card per screen. The journey is the thing that's just been decided, so
  // routing wins when we know both ends; otherwise data on landing. Everything
  // else is on /kit — this card never becomes a stack of links.
  const showTransport = showPartnerCard && Boolean(originCityName && destination);
  const showEsim = showPartnerCard && !showTransport;

  return (
    <section className="panel border-s-2 border-s-primary p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            Arriving in {countryName(trip.country_code)} on {label}.
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Our notes, not the partners&apos;. Dismiss if you&apos;re already set.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {showEsim ? (
          <PartnerGroup
            category="esim"
            placement="trip_confirm"
            title="eSIM"
            countryCode={trip.country_code}
            cityId={trip.city_id}
          />
        ) : null}
        {/* Transport is permitted here: the trip is already saved, with a
            future entry date and a known origin. The decision is made. */}
        {showTransport && originCityName && destination ? (
          <TransportGroup
            placement="trip_confirm"
            region={destination.region}
            fromCity={originCityName}
            toCity={destination.city}
            date={trip.entry_date}
            cityId={trip.city_id}
            title={`Getting there — ${originCityName} → ${destination.city}`}
          />
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          <Link to="/kit" className="underline hover:text-foreground">
            Cover, data and accounts are all on the Nomad kit page
          </Link>
        </p>
      </div>
    </section>
  );
}
