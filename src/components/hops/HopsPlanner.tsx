/**
 * MULTI-CITY PLANNER — UI
 *
 * PARTNER-FREE ZONE. The ranking decides where somebody flies; it must depend
 * on their inputs and nothing else. Leg links are plain search URLs.
 *
 * Ranking is pure and client-side (src/lib/hops/plan.ts). The only thing that
 * ever leaves the device is an explicit "Add to timeline", which appends to the
 * ordinary Driftly trip store — the same rows the tracker, Schengen engine and
 * year-end report read, and the same rows the offline queue pushes to the
 * backend `trips` table when signed in.
 *
 * 2026-08 rebuild:
 * - Styling moved onto the shared theme utilities (panel / input / pill / label-xs)
 *   so this page stops being the one screen with its own look.
 * - Layout works at every width: single column on mobile, sticky route panel
 *   from lg up, metrics as a wrapping grid instead of a row that clips.
 * - Timeline writes go through a single batched store write (see addTrips) —
 *   the old loop of addTrip calls persisted only the last stop.
 * - city_id is validated against the seed city dataset before it is stored.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Check,
  ChevronDown,
  CloudOff,
  ExternalLink,
  GripVertical,
  Plane,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { getCity } from "@/lib/cities";
import { HOP_CITIES, type HopCity } from "@/lib/hops/airports";
import { legLinks } from "@/lib/hops/links";
import {
  DEFAULT_PREFERENCES,
  addDays,
  formatClock,
  formatMinutes,
  planItineraries,
  stopNomadScore,
} from "@/lib/hops/plan";
import type { Itinerary, Preferences, StopInput } from "@/lib/hops/types";
import { useTrips } from "@/lib/store";
import { todayIso } from "@/lib/trip-dates";
import type { Trip } from "@/lib/types";
import { useSession } from "@/lib/use-session";
import { cn } from "@/lib/utils";

const MAX_STOPS = 6;

export function HopsPlanner() {
  const { trips, addTrips } = useTrips();
  const { userId } = useSession();
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState(() => addDays(todayIso(), 21));
  const [stops, setStops] = useState<StopInput[]>([
    { cityKey: "bangkok", nights: 28, flexible: true },
    { cityKey: "chiang-mai", nights: 21, flexible: true },
    { cityKey: "kuala-lumpur", nights: 21, flexible: false },
  ]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [added, setAdded] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showMorePrefs, setShowMorePrefs] = useState(false);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  const results = useMemo(
    () => planItineraries(stops, startDate, prefs, 4),
    [stops, startDate, prefs],
  );

  function patchStop(i: number, patch: Partial<StopInput>) {
    setStops((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= stops.length || from === to) return;
    setStops((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item) next.splice(to, 0, item);
      return next;
    });
  }

  /** Detect simple date overlaps with existing timeline trips. */
  function findOverlaps(itinerary: Itinerary): string[] {
    const overlaps: string[] = [];
    for (const stop of itinerary.stops) {
      for (const t of trips) {
        if (!t.entry_date || !t.exit_date) continue;
        if (stop.arrivalDateISO < t.exit_date && stop.departureDateISO > t.entry_date) {
          overlaps.push(`${stop.cityName} overlaps an existing trip in ${t.country_code}`);
        }
      }
    }
    return overlaps;
  }

  function addToTimeline(itinerary: Itinerary) {
    if (findOverlaps(itinerary).length > 0 && overlapWarning !== itinerary.id) {
      setOverlapWarning(itinerary.id);
      return;
    }

    // One batched write: the store enqueues a single sync op for the whole set.
    const newTrips: Trip[] = itinerary.stops.map((stop) => {
      // Only reference a city the seed dataset actually knows, so city_id never
      // points at something the tracker and reports cannot resolve.
      const cityId = stop.cityId && getCity(stop.cityId) ? stop.cityId : null;
      const airports = [
        stop.arrivalAirport ? `arrive ${stop.arrivalAirport.iata}` : null,
        stop.departureAirport ? `depart ${stop.departureAirport.iata}` : null,
      ].filter(Boolean);
      return {
        id: crypto.randomUUID(),
        country_code: stop.countryCode.toUpperCase().slice(0, 2),
        city_id: cityId,
        entry_date: stop.arrivalDateISO,
        exit_date: stop.departureDateISO,
        purpose: "tourist",
        notes: `Provisional — multi-city plan${airports.length ? ` (${airports.join(", ")})` : ""}`,
      };
    });

    addTrips(newTrips);
    setAdded(itinerary.id);
    setOverlapWarning(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-5">
      {/* ---- INPUT PANEL ------------------------------------------------ */}
      <section className="panel space-y-4 p-4 lg:sticky lg:top-4 lg:self-start">
        <div>
          <p className="label-xs">Your route</p>
          <h2 className="text-lg font-semibold tracking-tight">Stops, in order</h2>
        </div>

        <label className="block">
          <span className="label-xs">Leaving on</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input mt-1"
          />
        </label>

        <ol className="relative space-y-2">
          {stops.length > 1 ? (
            <div
              className="pointer-events-none absolute start-[18px] top-6 bottom-6 w-px bg-border/70"
              aria-hidden
            />
          ) : null}
          {stops.map((stop, i) => (
            <li
              key={`${stop.cityKey}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null) move(dragIndex, i);
                setDragIndex(null);
              }}
              className={cn(
                "relative rounded-lg border border-border bg-surface-2/60 p-2.5 transition-opacity",
                dragIndex === i && "opacity-60",
              )}
            >
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2 hidden h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:block" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <CitySelect
                    value={stop.cityKey}
                    onChange={(cityKey) => patchStop(i, { cityKey })}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={stop.nights}
                        onChange={(e) =>
                          patchStop(i, { nights: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="input w-16 px-2 py-1"
                      />
                      nights
                    </label>
                    <button
                      type="button"
                      onClick={() => patchStop(i, { flexible: !stop.flexible })}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-[11px] transition-colors",
                        stop.flexible
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {stop.flexible ? "Around these dates" : "Exact dates"}
                    </button>
                  </div>
                  <NomadHint nights={stop.nights} />
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <IconBtn label="Move up" onClick={() => move(i, i - 1)}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn label="Move down" onClick={() => move(i, i + 1)}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </IconBtn>
                  {stops.length > 2 ? (
                    <IconBtn
                      label="Remove stop"
                      onClick={() => setStops((p) => p.filter((_, idx) => idx !== i))}
                    >
                      <X className="h-3.5 w-3.5" />
                    </IconBtn>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {stops.length < MAX_STOPS ? (
          <button
            type="button"
            onClick={() =>
              setStops((p) => [...p, { cityKey: "lisbon", nights: 21, flexible: true }])
            }
            className="w-full rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            + Add a stop
          </button>
        ) : null}

        <div className="space-y-3 border-t border-border pt-3">
          <p className="label-xs">Preferences</p>
          <ChipRow
            options={[
              { id: "balanced", label: "Balanced" },
              { id: "cheapest", label: "Cheapest" },
              { id: "fewest_transfers", label: "Fewest transfers" },
            ]}
            value={prefs.priority}
            onChange={(v) => setPrefs({ ...prefs, priority: v as Preferences["priority"] })}
          />

          <button
            type="button"
            onClick={() => setShowMorePrefs((v) => !v)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>More preferences</span>
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showMorePrefs && "rotate-180")}
            />
          </button>

          {showMorePrefs ? (
            <div className="space-y-3">
              <ChipRow
                options={[
                  { id: "any", label: "Any airport" },
                  { id: "main", label: "Main international" },
                  { id: "lowcost", label: "Low-cost airport" },
                ]}
                value={prefs.airportPreference}
                onChange={(v) =>
                  setPrefs({ ...prefs, airportPreference: v as Preferences["airportPreference"] })
                }
              />
              <Toggle
                label="Avoid late-night arrivals"
                checked={prefs.avoidLateArrivals}
                onChange={(v) => setPrefs({ ...prefs, avoidLateArrivals: v })}
              />
              <Toggle
                label="Prefer longer stays (nomad mode)"
                checked={prefs.nomadMode}
                onChange={(v) => setPrefs({ ...prefs, nomadMode: v })}
              />
            </div>
          ) : null}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Prices are indicative ranges for planning, not live fares. Ranking runs on your device —
          nothing about this route is sent anywhere unless you add it to your timeline.
        </p>
      </section>

      {/* ---- RESULTS ---------------------------------------------------- */}
      <section className="space-y-4">
        {results.length === 0 ? (
          <div className="panel border-dashed p-8 text-center text-sm text-muted-foreground">
            Add at least two different cities to see routes.
          </div>
        ) : (
          results.map((it, idx) => (
            <ItineraryCard
              key={it.id}
              itinerary={it}
              rank={idx}
              added={added === it.id}
              signedIn={Boolean(userId)}
              showOverlap={overlapWarning === it.id}
              onAdd={() => addToTimeline(it)}
              onConfirmOverlap={() => {
                setOverlapWarning(null);
                addToTimeline(it);
              }}
              onDismissOverlap={() => setOverlapWarning(null)}
              onOpenTracker={() => navigate({ to: "/tracker" })}
            />
          ))
        )}
      </section>
    </div>
  );
}

function ItineraryCard({
  itinerary,
  rank,
  added,
  signedIn,
  showOverlap,
  onAdd,
  onConfirmOverlap,
  onDismissOverlap,
  onOpenTracker,
}: {
  itinerary: Itinerary;
  rank: number;
  added: boolean;
  signedIn: boolean;
  showOverlap: boolean;
  onAdd: () => void;
  onConfirmOverlap: () => void;
  onDismissOverlap: () => void;
  onOpenTracker: () => void;
}) {
  const it = itinerary;
  const isBest = rank === 0;

  return (
    <article
      className={cn(
        "panel overflow-hidden",
        isBest && "border-primary/40 shadow-sm shadow-primary/5",
      )}
    >
      <header className="space-y-3 border-b border-border p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              isBest ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
            )}
          >
            {isBest ? "Best overall" : `Option ${rank + 1}`}
          </span>
          <span className="min-w-0 text-sm font-medium">
            {it.stops.map((s) => s.cityName).join(" → ")}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Est. total" value={`$${it.priceUsdLow}–${it.priceUsdHigh}`} />
          <Metric label="Travel time" value={formatMinutes(it.totalTravelMinutes)} />
          <Metric label="Transfers" value={String(it.flightStops)} />
          <Metric label="Nomad fit" value={`${it.nomadScore}/100`} />
        </dl>
      </header>

      {it.crossAirportChanges.length > 0 ? (
        <div className="space-y-2 border-b border-border bg-warning/10 px-4 py-3">
          {it.crossAirportChanges.map((c) => (
            <div key={`${c.fromIata}-${c.toIata}`} className="flex gap-2 text-xs">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="font-medium text-foreground">
                  Airport change in {c.cityName}: {c.fromIata} → {c.toIata}
                </p>
                <p className="text-muted-foreground">
                  {c.transfer.method}. About {formatMinutes(c.transfer.minutes)} and ~$
                  {c.transfer.costUsd}. Leave at least{" "}
                  {formatMinutes(c.recommendedBufferMinutes)} between landing and the next
                  check-in.
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <ol className="divide-y divide-border">
        {it.stops.map((stop, i) => (
          <li key={`${stop.cityKey}-${i}`} className="px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="text-sm font-medium">
                {stop.cityName}
                <span className="ms-2 text-xs font-normal text-muted-foreground">
                  {stop.arrivalDateISO} → {stop.departureDateISO} · {stop.nights} nights
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stop.arrivalAirport ? `in ${stop.arrivalAirport.iata}` : "start"}
                {stop.departureAirport ? ` · out ${stop.departureAirport.iata}` : " · end"}
                {stop.arrivalAirport &&
                stop.departureAirport &&
                stop.arrivalAirport.iata !== stop.departureAirport.iata
                  ? " · airport change"
                  : ""}
              </p>
            </div>
            {it.legs[i] ? <LegRow leg={it.legs[i]!} /> : null}
          </li>
        ))}
      </ol>

      {it.warnings.filter((w) => w.kind !== "cross-airport").length > 0 ? (
        <ul className="space-y-1 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {it.warnings
            .filter((w) => w.kind !== "cross-airport")
            .map((w, i) => (
              <li key={i}>• {w.text}</li>
            ))}
        </ul>
      ) : null}

      {showOverlap ? (
        <div className="border-t border-border bg-warning/10 px-4 py-3 text-xs">
          <p className="font-medium text-foreground">
            This sequence overlaps trips already on your timeline.
          </p>
          <p className="mt-1 text-muted-foreground">
            You can still add it (as provisional), but check the tracker afterwards to resolve any
            double-booking of dates.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onConfirmOverlap}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              Add anyway
            </button>
            <button
              type="button"
              onClick={onDismissOverlap}
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <footer className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
          {added ? (
            signedIn ? (
              <>Added as provisional trips and saved to your account.</>
            ) : (
              <span className="inline-flex items-start gap-1.5">
                <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Added on this device only — sign in to keep these trips across devices.
              </span>
            )
          ) : (
            <>
              Nomad fit {it.nomadScore}/100 — stay lengths that score high sit in the 2–8 week band
              where remote work is realistic. Below 14 nights is usually too short to settle.
            </>
          )}
        </p>
        {added ? (
          <button
            type="button"
            onClick={onOpenTracker}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-surface-2 px-3 py-2 text-sm font-medium sm:w-auto"
          >
            <Check className="h-4 w-4" /> Open tracker
          </button>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:w-auto"
          >
            <CalendarPlus className="h-4 w-4" /> Add to my timeline
          </button>
        )}
      </footer>
    </article>
  );
}

function LegRow({ leg }: { leg: Itinerary["legs"][number] }) {
  return (
    <div className="mt-2 rounded-lg bg-surface-2/60 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <Plane className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-medium">
          {leg.from.iata} → {leg.to.iata}
        </span>
        <span className="text-muted-foreground">
          {leg.offer.dateISO} · {formatClock(leg.offer.departMinute)}–
          {formatClock(leg.offer.arriveMinute)}
          {leg.offer.dayOffset > 0 ? ` (+${leg.offer.dayOffset})` : ""} ·{" "}
          {formatMinutes(leg.offer.durationMinutes)} ·{" "}
          {leg.offer.stops === 0 ? "direct" : `${leg.offer.stops} stop`}
        </span>
        <span className="text-muted-foreground tabular-nums">
          ${leg.offer.priceUsdLow}–{leg.offer.priceUsdHigh}
        </span>
        {leg.lateArrival ? (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] text-warning">
            late arrival
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
        {legLinks(leg).map((l) => (
          <a
            key={l.label}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {l.label} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="label-xs">{label}</dt>
      <dd className="truncate text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function NomadHint({ nights }: { nights: number }) {
  const score = stopNomadScore(nights);
  if (score >= 100) return null;
  return (
    <p className="text-[11px] text-muted-foreground">
      {nights < 14
        ? "Short for a working stay — 2 weeks is the usual minimum to be productive."
        : "Long stay — check the visa allowance for this country."}
    </p>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
    >
      {children}
    </button>
  );
}

function ChipRow({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="hide-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 sm:flex-wrap sm:overflow-visible">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors",
            value === o.id
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-border",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-all",
            checked ? "start-[18px]" : "start-0.5",
          )}
        />
      </button>
    </label>
  );
}

/** Searchable city picker. Shows every airport so nothing is hidden. */
function CitySelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = HOP_CITIES.find((c) => c.key === value);
  const matches = useMemo(() => filterCities(q), [q]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setQ("");
        }}
        className="input flex items-center justify-between gap-2 text-start"
      >
        <span className="truncate">
          {selected?.name ?? "Pick a city"}
          <span className="ms-1.5 text-xs text-muted-foreground">
            {selected?.airports.map((a) => a.iata).join(" / ")}
          </span>
        </span>
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="rounded-md border border-input bg-background">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="City or airport code…"
        className="w-full rounded-t-md bg-transparent px-3 py-2 text-sm outline-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter" && matches[0]) {
            onChange(matches[0].key);
            setOpen(false);
          }
        }}
      />
      <ul className="max-h-56 overflow-auto border-t border-border">
        {matches.slice(0, 40).map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => {
                onChange(c.key);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-start text-sm hover:bg-surface-2"
            >
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {c.airports.map((a) => a.iata).join(" / ")}
              </span>
            </button>
          </li>
        ))}
        {matches.length === 0 ? (
          <li className="px-3 py-2 text-xs text-muted-foreground">No match.</li>
        ) : null}
      </ul>
    </div>
  );
}

function filterCities(q: string): HopCity[] {
  const term = q.trim().toLowerCase();
  if (!term) return HOP_CITIES;
  return HOP_CITIES.filter(
    (c) =>
      c.name.toLowerCase().includes(term) ||
      c.countryCode.toLowerCase() === term ||
      c.airports.some(
        (a) => a.iata.toLowerCase().includes(term) || a.name.toLowerCase().includes(term),
      ),
  );
}
