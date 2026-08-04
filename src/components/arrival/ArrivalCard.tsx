import { useMemo, useState } from "react";
import { CheckCircle2, MapPin, X } from "lucide-react";
import { CITIES, getCity } from "@/lib/cities";
import { flagEmoji } from "@/lib/arbitrage";
import { SCHENGEN_COUNTRIES, SCHENGEN_MAX_DAYS, maxStayFrom, schengenStatus } from "@/lib/schengen";
import {
  addDaysIso,
  daysInCountryTaxYear,
  toEngineTrips,
  todayIso,
} from "@/lib/trip-dates";
import { taxYearLabel, taxYearStartMonth } from "@/lib/arbitrage";
import { dismissArrival, writeLastSeen, type ArrivalPrompt } from "@/lib/country-detect";
import { useTrips } from "@/lib/store";
import { useOnline } from "@/lib/offline/use-online";
import { hasTickedEsimAnywhere } from "@/lib/checklist";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import type { Trip } from "@/lib/types";

/**
 * Arrival card. Everything above the fold is computed from cached data with
 * zero network: the Schengen engine is pure arithmetic over local trips and
 * the city rows are in the offline cache.
 *
 * Content order is fixed: visa fact first, commercial second, dismissible.
 * Nothing commercial renders offline — nothing could be bought anyway — and
 * even online it is one quiet line, suppressed if the user already ticked
 * eSIM on a pre-departure checklist.
 */

const COUNTRY_CHOICES = Array.from(
  new Set([...CITIES.map((c) => c.country_code), "FR", "IT", "DE", "MY", "SG", "AE", "GB", "US"]),
).sort();

function countryName(code: string) {
  return CITIES.find((c) => c.country_code === code)?.country ?? code;
}

export function ArrivalCard({
  prompt,
  onResolved,
}: {
  prompt: ArrivalPrompt;
  onResolved: () => void;
}) {
  const { trips, addTrip } = useTrips();
  const online = useOnline();
  const today = useMemo(() => todayIso(), []);
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [picking, setPicking] = useState(!prompt.suggestedCountry);
  const [choice, setChoice] = useState(prompt.suggestedCountry ?? prompt.candidates[0] ?? "PT");
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  const confirm = (code: string) => {
    const trip: Trip = {
      id: crypto.randomUUID(),
      country_code: code,
      city_id: CITIES.find((c) => c.country_code === code)?.id ?? null,
      entry_date: today,
      exit_date: null,
      purpose: "tourist",
      notes: "Logged from timezone change",
    };
    // Local write, immediately. No await on anything network-bound.
    addTrip(trip);
    // Country + date only. No coordinates are captured at any point.
    writeLastSeen({ timeZone: prompt.timeZone, country: code, date: today });
    setConfirmed(code);
  };

  if (confirmed) {
    return (
      <ArrivalFacts
        countryCode={confirmed}
        today={today}
        trips={[
          ...trips,
          {
            id: "pending",
            country_code: confirmed,
            city_id: null,
            entry_date: today,
            exit_date: null,
            purpose: "tourist",
            notes: "",
          },
        ]}
        online={online}
        showNudge={online && !nudgeDismissed && !hasTickedEsimAnywhere()}
        onDismissNudge={() => setNudgeDismissed(true)}
        onClose={onResolved}
      />
    );
  }

  return (
    <section className="panel border-l-2 border-l-primary p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            Your timezone changed to {prompt.offsetLabel}.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {prompt.suggestedCountry
              ? `Are you in ${countryName(prompt.suggestedCountry)} now?`
              : "That zone covers more than one country — which one are you in?"}
          </p>
        </div>
        <button
          onClick={() => {
            dismissArrival(prompt.timeZone, today);
            onResolved();
          }}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {picking ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className="rounded-md border border-input bg-surface px-2 py-2 text-sm"
            aria-label="Choose country"
          >
            {(prompt.candidates.length > 0 ? prompt.candidates : COUNTRY_CHOICES).map((code) => (
              <option key={code} value={code}>
                {flagEmoji(code)} {countryName(code)}
              </option>
            ))}
          </select>
          <button
            onClick={() => confirm(choice)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Log entry
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => confirm(prompt.suggestedCountry!)}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Yes, I&apos;m here
          </button>
          <button
            onClick={() => {
              dismissArrival(prompt.timeZone, today);
              onResolved();
            }}
            className="rounded-md border border-input px-4 py-2 text-sm"
          >
            No
          </button>
          <button
            onClick={() => setPicking(true)}
            className="rounded-md border border-input px-4 py-2 text-sm"
          >
            Choose country
          </button>
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted-foreground">
        Detected from your device clock. We store the country and the date — never your location.
      </p>
    </section>
  );
}

function ArrivalFacts({
  countryCode,
  today,
  trips,
  online,
  showNudge,
  onDismissNudge,
  onClose,
}: {
  countryCode: string;
  today: string;
  trips: Trip[];
  online: boolean;
  showNudge: boolean;
  onDismissNudge: () => void;
  onClose: () => void;
}) {
  const city = CITIES.find((c) => c.country_code === countryCode);
  const isSchengen = SCHENGEN_COUNTRIES.has(countryCode);
  const engineTrips = toEngineTrips(trips);

  // All of this is cached-data arithmetic. Nothing here touches the network.
  const schengen = schengenStatus(engineTrips, today);
  const grantedDays = isSchengen
    ? maxStayFrom(engineTrips, today)
    : (city?.visa.touristDays ?? null);
  const exitDeadline =
    grantedDays && grantedDays > 0 ? addDaysIso(today, grantedDays - 1) : null;

  const taxCity = city ? getCity(city.id) : undefined;
  const taxCount = taxCity
    ? daysInCountryTaxYear(trips, countryCode, today, taxYearStartMonth(taxCity))
    : null;

  return (
    <section className="panel border-l-2 border-l-accent-positive p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4 text-accent-positive" aria-hidden />
          Entry logged — {flagEmoji(countryCode)} {countryName(countryCode)}, {today}
        </h2>
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="label-xs">Days granted</dt>
          <dd className="num font-semibold">{grantedDays ?? "—"}</dd>
        </div>
        <div>
          <dt className="label-xs">Exit by</dt>
          <dd className="num font-semibold">{exitDeadline ?? "—"}</dd>
        </div>
        {isSchengen ? (
          <div>
            <dt className="label-xs">Schengen used</dt>
            <dd className="num font-semibold">
              {schengen.used} / {SCHENGEN_MAX_DAYS}
            </dd>
          </div>
        ) : null}
        {taxCount && taxCity ? (
          <div className="col-span-2 sm:col-span-3">
            <dt className="label-xs">
              Tax residency — {taxYearLabel(taxCity)} year
            </dt>
            <dd className="num text-sm">
              {taxCount.days} of {taxCity.tax.residencyTriggerDays} days
            </dd>
          </div>
        ) : null}
      </dl>

      {!online ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Offline — these figures come from your cached data and are correct. Your entry is saved
          and will sync.
        </p>
      ) : null}

      {/* Commercial content, if any, is last, quiet and dismissible — and never
          rendered offline, because nothing could be bought without a network.
          One card maximum, and the bar is higher here: a card triggered by the
          user's physical location reads as surveillance-for-profit if pushy. */}
      {showNudge ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              No local data yet? Options are on the Nomad kit page.
            </p>
            <button
              onClick={onDismissNudge}
              aria-label="Dismiss suggestion"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="mt-2">
            <PartnerGroup
              category="esim"
              placement="arrival"
              title="Data"
              countryCode={countryCode}
              cityId={city?.id ?? null}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
