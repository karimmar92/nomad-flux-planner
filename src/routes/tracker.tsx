import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Trash2, X } from "lucide-react";
import {
  SCHENGEN_COUNTRIES,
  SCHENGEN_MAX_DAYS,
  maxStayFrom,
  schengenStatus,
} from "@/lib/schengen";
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
import { buildBorderRunPlan } from "@/lib/border-run";
import { BorderRunCard } from "@/components/borderrun/BorderRunCard";
import { detectPreDeparture } from "@/lib/pre-departure";
import { PreDepartureCard } from "@/components/predeparture/PreDepartureCard";
import { TripChecklistCard } from "@/components/predeparture/TripChecklist";
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
import { isPro as planIsPro } from "@/lib/entitlements";
import { LockedPreview } from "@/components/ProGate";
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
  const { trips, addTrip, removeTrip, hydrated } = useTrips();
  const { profile } = useProfile();
  const today = useMemo(() => todayIso(), []);
  const [plannedEntry, setPlannedEntry] = useState(() => addDaysIso(todayIso(), 30));
  const [justAdded, setJustAdded] = useState<Trip | null>(null);
  const [preDepartureDismissed, setPreDepartureDismissed] = useState(false);

  const engineTrips = useMemo(() => toEngineTrips(trips), [trips]);
  const schengen = useMemo(() => schengenStatus(engineTrips, today), [engineTrips, today]);
  const windowDays = useMemo(() => schengenWindowDays(trips, today), [trips, today]);
  const plannerDays = useMemo(
    () => maxStayFrom(engineTrips, plannedEntry),
    [engineTrips, plannedEntry],
  );
  const proPlanning = planIsPro(profile.plan);
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
            level:
              schengen.status === "warning" ? "warn" : "high",
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Visa tracker</h1>
        <p className="text-sm text-muted-foreground">
          Rolling Schengen 90/180 and per-country tax day counters. Entry and exit days both
          count as full days.
        </p>
      </div>

      {alerts.length > 0 ? (
        <div className="space-y-2">
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
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{a.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {borderRun ? (
        <BorderRunCard plan={borderRun} isPro={profile.plan === "pro"} />
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

      {/* Schengen engine */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold">Schengen 90/180</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Days used" value={schengen.used} hint="in trailing 180 days" />
          <Stat
            label="Days remaining"
            value={schengen.remaining}
            tone={schengen.status === "ok" ? "positive" : "negative"}
            size="lg"
          />
          <Stat label="Window opened" value={addDaysIso(today, -179)} size="sm" />
          <Stat
            label="Full 90 available from"
            value={schengen.nextFullNinety ?? "beyond 400 days"}
            size="sm"
            hint="earliest date for a fresh full stay"
          />
        </div>
        {schengen.status === "violation" ? (
          <p className="mt-3 rounded-md border border-negative/50 bg-negative-muted px-3 py-2 text-xs text-negative">
            Your logged trips exceed 90 days in the current window.
          </p>
        ) : null}

        {/* FORWARD PLANNING IS PRO. Today's status above is free forever —
            the alarm is free, the answer to "what now?" is paid. */}
        {proPlanning ? (
          <div className="mt-4 rounded-md border border-border p-3">
            <label className="label-xs" htmlFor="planner">
              If I enter on…
            </label>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <input
                id="planner"
                type="date"
                value={plannedEntry}
                onChange={(e) => setPlannedEntry(e.target.value)}
                className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
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
            className="mt-4"
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

      {/* Timeline */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold">Last 12 months</h2>
        {trips.length === 0 ? (
          <p className="text-sm text-muted-foreground">Log a trip to draw your timeline.</p>
        ) : (
          <Timeline trips={trips} today={today} colorFor={colorFor} schengenDays={windowDays} />
        )}
      </section>

      {/* Country counters */}
      <section className="panel p-4">
        <h2 className="mb-3 text-sm font-semibold">Tax residency day counters</h2>
        {counters.length === 0 ? (
          <p className="text-sm text-muted-foreground">No trips logged yet.</p>
        ) : (
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
                    className={cn(
                      "num font-medium",
                      c.pct >= 90 && "text-negative",
                      c.pct >= 75 && c.pct < 90 && "text-primary",
                    )}
                  >
                    {c.count.days} / {c.meta.trigger}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
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
        )}
      </section>

      <AddTrip
        onAdd={(trip) => {
          addTrip(trip);
          setJustAdded(trip.entry_date > today ? trip : null);
        }}
      />

      {justAdded ? (
        <TripConfirmKit
          trip={justAdded}
          originCityName={
            (currentTripCity(trips, today) ??
              (profile.home_city_id ? getCity(profile.home_city_id)?.city : undefined)) ?? null
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Your trips</h2>
        {hydrated && trips.length === 0 ? (
          <EmptyState
            title="No trips logged"
            body="Add your entries and exits and the Schengen window, tax counters and timeline all fill in automatically."
          />
        ) : (
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
                      {inclusiveDays(trip.entry_date, trip.exit_date ?? today)} days · {trip.purpose.replace("_", " ")}
                    </div>
                  </div>
                  <button
                    onClick={() => removeTrip(trip.id)}
                    aria-label="Delete trip"
                    className="text-muted-foreground hover:text-negative"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        )}
      </section>

      <LegalFooter />
    </div>
  );
}

function Timeline({
  trips,
  today,
  colorFor,
  schengenDays,
}: {
  trips: Trip[];
  today: string;
  colorFor: (code: string) => string | undefined;
  schengenDays: Set<string>;
}) {
  const start = addDaysIso(today, -364);
  const days = Array.from({ length: 365 }, (_, i) => addDaysIso(start, i));

  const countryOn = (key: string) => {
    for (const trip of trips) {
      const entry = trip.entry_date;
      const exit = trip.exit_date ?? today;
      if (key >= entry && key <= exit) return trip.country_code;
    }
    return null;
  };

  return (
    <div>
      <div className="flex h-10 w-full gap-px overflow-hidden rounded">
        {days.map((day) => {
          const code = countryOn(day);
          return (
            <div
              key={day}
              title={`${day}${code ? ` — ${countryName(code)}` : ""}`}
              className="h-full flex-1"
              style={{ background: code ? colorFor(code) : "var(--surface-2)" }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex h-1.5 w-full gap-px">
        {days.map((day) => (
          <div
            key={`s-${day}`}
            className="h-full flex-1"
            style={{
              background: schengenDays.has(day)
                ? "var(--negative)"
                : "transparent",
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>{monthYearLabel(start)}</span>
        <span>Red strip = days counted in the current Schengen window</span>
        <span>{monthYearLabel(today)}</span>
      </div>
    </div>
  );
}

function AddTrip({ onAdd }: { onAdd: (trip: Trip) => void }) {
  const [country, setCountry] = useState("PT");
  const [entry, setEntry] = useState(() => todayIso());
  const [exit, setExit] = useState("");
  const [stillHere, setStillHere] = useState(false);
  const [purpose, setPurpose] = useState<TripPurpose>("tourist");

  return (
    <section className="panel p-4">
      <h2 className="mb-3 text-sm font-semibold">Add a trip</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="label-xs">Country</span>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          >
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
            onChange={(e) => setEntry(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="label-xs">Exit date</span>
          <input
            type="date"
            value={exit}
            disabled={stillHere}
            onChange={(e) => setExit(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm disabled:opacity-40"
          />
          <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={stillHere}
              onChange={(e) => setStillHere(e.target.checked)}
            />
            Still here
          </label>
        </label>
        <label className="block">
          <span className="label-xs">Purpose</span>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as TripPurpose)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
          >
            <option value="tourist">Tourist</option>
            <option value="nomad_visa">Nomad visa</option>
            <option value="residence">Residence</option>
          </select>
        </label>
      </div>
      <button
        onClick={() => {
          if (!entry || (!stillHere && !exit)) return;
          onAdd({
            id: crypto.randomUUID(),
            country_code: country,
            city_id: CITIES.find((c) => c.country_code === country)?.id ?? null,
            entry_date: entry,
            exit_date: stillHere ? null : exit,
            purpose,
            notes: "",
          });
          setExit("");
          setStillHere(false);
        }}
        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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

