/**
 * The world card: the city page's main visual.
 *
 * ── WHAT IT SAYS WITHOUT SAYING IT ─────────────────────────────────────
 *
 * Four facts, no sentences:
 *
 *   1. WHERE you are, as a pulsing marker.
 *   2. WHICH countries share your allowance — every city drawing from the same
 *      90 days is lit in the same colour. "One allowance across 29 countries"
 *      stops being a claim and becomes something you can see at a glance.
 *   3. HOW FULL that allowance is, as a ring around the marker. The ring is
 *      the same number as the bar in the gauges, drawn where the eye already is.
 *   4. WHERE TO GO if it fills, as an arc to the nearest city that does not
 *      share it. That is the border-run answer, rendered geographically.
 *
 * The only text is a four-item legend and one number in the ring.
 *
 * ── THE HONEST LIMITATION ──────────────────────────────────────────────
 *
 * There are no coastlines, because there is no geographic data in this project
 * and adding a map library means an install this environment has failed at
 * before. This is a constellation of real places at their real relative
 * positions — accurate, but abstract.
 *
 * I would rather ship an accurate abstract map than an inaccurate literal one.
 * A hand-drawn Europe would be visibly wrong to everyone who lives in it, and
 * this product's whole argument is that its numbers can be trusted.
 *
 * The upgrade path is one file: keep `project()` and drop real land paths in
 * behind the markers. Nothing else moves, because every element is positioned
 * by projection rather than by hand.
 */
import { Link } from "@tanstack/react-router";
import type { City, Trip } from "@/lib/types";
import { SCHENGEN_COUNTRIES } from "@/lib/schengen";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  arcPath,
  buildMarkers,
  fitViewBox,
  nearestEscape,
  project,
  type MapCity,
} from "@/lib/map-projection";
import { visaGauge, type Gauge } from "@/lib/city-telemetry";
import { cn } from "@/lib/utils";

const RING: Record<Gauge["status"], string> = {
  ok: "var(--color-accent-positive)",
  watch: "var(--color-accent-warning)",
  at_limit: "var(--color-accent-warning)",
  exceeded: "var(--color-negative)",
};

export function WorldCard({
  city,
  cities,
  trips,
  today,
}: {
  city: City;
  cities: City[];
  trips: Trip[];
  today: string;
}) {
  const gauge = visaGauge(city, trips, today);

  const mapCities: MapCity[] = cities.map((c) => ({
    id: c.id,
    city: c.city,
    countryCode: c.country_code,
    lat: c.lat,
    lng: c.lng,
  }));

  /**
   * Which countries share this city's meter.
   *
   * For a Schengen city that is all 29. For anywhere else the allowance is
   * per-country, so the set is just this country — and the map correctly shows
   * a single lit dot rather than implying a bloc that does not exist.
   */
  const allowanceCountries = SCHENGEN_COUNTRIES.has(city.country_code.toUpperCase())
    ? new Set(SCHENGEN_COUNTRIES)
    : new Set([city.country_code.toUpperCase()]);

  const visitedCountries = new Set(trips.map((t) => t.country_code.toUpperCase()));

  const markers = buildMarkers({
    cities: mapCities,
    focusedId: city.id,
    allowanceCountries,
    visitedCountries,
  });

  const here = project(city.lat, city.lng);
  const focused = mapCities.find((c) => c.id === city.id);
  const escape =
    focused && gauge.pct >= 50 ? nearestEscape(focused, mapCities, allowanceCountries) : null;
  const escapePoint = escape ? project(escape.city.lat, escape.city.lng) : null;

  /**
   * Frame to what matters, not the whole planet.
   *
   * The first render drew the globe with Lisbon, the Schengen bloc and the
   * escape city inside about 40px of Europe. Every dot overlapped, so the one
   * thing the map exists to show was unreadable. Fitting to the focused city,
   * everything sharing its allowance, and the escape gives a frame where the
   * dots separate.
   */
  const framePoints = [
    here,
    ...markers.filter((m) => m.sharesAllowance || m.visited).map((m) => m.point),
    ...(escapePoint ? [escapePoint] : []),
  ];
  const view = fitViewBox(framePoints);
  // Marker sizes are in map units, so they must shrink as the frame zooms in,
  // or a 3.6x zoom turns every dot into a blob.
  const k = 1 / view.scale;

  // Ring geometry. Circumference drives the dash offset that fills it.
  const R = 13 * k;
  const CIRC = 2 * Math.PI * R;
  const filled = (gauge.pct / 100) * CIRC;

  return (
    <section className="surface overflow-hidden">
      <svg
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        className="block w-full"
        role="img"
        aria-label={`${city.city} on the world map. ${gauge.used} of ${gauge.limit} ${gauge.label} days used.`}
      >
        <rect
          x={view.x}
          y={view.y}
          width={view.width}
          height={view.height}
          fill="var(--color-surface-2)"
        />

        {/* Graticule. Faint enough to read as texture, present enough to give
            the dots a frame so they do not float in a void. */}
        <g stroke="var(--color-border)" strokeWidth={0.3 * k} opacity="0.5">
          {[30, 60, 90, 120, 150].map((y) => (
            <line key={`h${y}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} />
          ))}
          {[60, 120, 180, 240, 300].map((x) => (
            <line key={`v${x}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} />
          ))}
        </g>
        {/* The equator, slightly stronger — one real reference line. */}
        <line
          x1={0}
          y1={MAP_HEIGHT / 2}
          x2={MAP_WIDTH}
          y2={MAP_HEIGHT / 2}
          stroke="var(--color-border)"
          strokeWidth={0.5 * k}
        />

        {/* NO GLOW HERE, DELIBERATELY. A radial gradient behind the focus was
            the first thing I drew and it rendered as a near-solid disc that
            covered every Schengen dot — decoration hiding the exact
            information the map exists to show. */}

        {/* The escape arc, drawn under the markers so dots stay legible. Only
            appears once the meter is at least half full — before that it would
            be advice nobody asked for. */}
        {escapePoint ? (
          <g>
            <path
              d={arcPath(here, escapePoint)}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth={0.9 * k}
              strokeDasharray={`${2 * k} ${2 * k}`}
              opacity="0.75"
            />
            <circle cx={escapePoint.x} cy={escapePoint.y} r={2.6 * k} fill="var(--color-primary)" />
          </g>
        ) : null}

        {/* Every city. Three visual states, no labels. */}
        {markers.map((m) => {
          if (m.focused) return null;
          return (
            <circle
              key={m.id}
              cx={m.point.x}
              cy={m.point.y}
              r={(m.visited ? 2.4 : 1.8) * k}
              fill={
                m.sharesAllowance
                  ? "var(--color-primary)"
                  : m.visited
                    ? "var(--color-accent-positive)"
                    : "var(--color-muted-foreground)"
              }
              opacity={m.sharesAllowance ? 0.85 : m.visited ? 0.8 : 0.35}
            />
          );
        })}

        {/* The focused city, with the allowance ring around it. The ring is the
            same figure as the gauge bar — repeated here because this is where
            the eye already is. */}
        <g>
          {/* Track: deliberately faint. Contrast belongs to the fill. */}
          <circle
            cx={here.x}
            cy={here.y}
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={5 * k}
            opacity="0.6"
          />
          <circle
            cx={here.x}
            cy={here.y}
            r={R}
            fill="none"
            stroke={RING[gauge.status]}
            strokeWidth={5 * k}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRC}`}
            // Start the fill at 12 o'clock rather than 3 o'clock, which is
            // where people expect a meter to begin.
            transform={`rotate(-90 ${here.x} ${here.y})`}
          />
          <circle cx={here.x} cy={here.y} r={3.4 * k} fill="var(--color-foreground)" />
          <text
            x={here.x}
            y={here.y - R - 4 * k}
            textAnchor="middle"
            className="num"
            fontSize={7 * k}
            fontWeight="600"
            fill="var(--color-foreground)"
          >
            {gauge.used}/{gauge.limit}
          </text>
        </g>
      </svg>

      {/* Legend. The only prose, and it is four fragments. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <Key color="var(--color-foreground)" label={city.city} solid />
        {allowanceCountries.size > 1 ? (
          <Key
            color="var(--color-primary)"
            label={`Shares this allowance (${allowanceCountries.size} countries)`}
          />
        ) : null}
        <Key color="var(--color-accent-positive)" label="You have been" />
        {escape ? (
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 border-t border-dashed border-primary" aria-hidden />
            <Link
              to="/city/$cityId"
              params={{ cityId: escape.city.id }}
              className="hover:text-foreground"
            >
              Nearest reset: {escape.city.city} · {escape.km.toLocaleString()} km
            </Link>
          </span>
        ) : null}
      </div>
    </section>
  );
}

function Key({ color, label, solid = false }: { color: string; label: string; solid?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn("rounded-full", solid ? "h-2.5 w-2.5" : "h-2 w-2")}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}
