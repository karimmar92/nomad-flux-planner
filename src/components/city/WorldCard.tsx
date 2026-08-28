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
 * ── REAL CARTOGRAPHY ───────────────────────────────────────────────────
 *
 * This used to be a hand-projected canvas with no coastlines, because there
 * was no map library or geographic data in this project. It is now a real
 * MapLibre GL map on OpenFreeMap tiles (free, no API key, OSM data) — real
 * coastlines, borders and place names, with the same markers, ring gauge and
 * escape arc drawn on top exactly as before. See src/lib/map-projection.ts
 * for the geo-math that carried over unchanged (great-circle distance, the
 * nearest-escape search, the arc's waypoints).
 *
 * Tiles need a network connection; the compliance numbers do not. Offline,
 * this shows a plain notice instead of a broken map — everything else on the
 * city page still works.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { City, Trip } from "@/lib/types";
import { SCHENGEN_COUNTRIES } from "@/lib/schengen";
import { arcWaypoints, buildMarkers, nearestEscape, type MapCity } from "@/lib/map-projection";
import { visaGauge, type Gauge } from "@/lib/city-telemetry";
import { useTheme } from "@/lib/store";
import { useOnline } from "@/lib/offline/use-online";
import { cn } from "@/lib/utils";

const RING: Record<Gauge["status"], string> = {
  ok: "var(--color-accent-positive)",
  watch: "var(--color-accent-warning)",
  at_limit: "var(--color-accent-warning)",
  exceeded: "var(--color-negative)",
};

/** OpenFreeMap's public styles — free, no API key. One per app theme. */
const STYLE_URL: Record<"dark" | "light", string> = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};

/**
 * MapLibre's style-spec color parser only understands legacy CSS color
 * syntax (hex, rgb, hsl) — not `oklch()`, which is what every token in this
 * app's palette is defined in. Handing it the raw custom-property string
 * fails with "color expected, oklch(...) found".
 *
 * Two browser-side conversion tricks were tried and both failed: reading
 * `getComputedStyle().color` back off a real element just echoed the same
 * oklch() string (modern Chromium preserves CSS Color 4 syntax in computed
 * style instead of downgrading it), and canvas 2D's `fillStyle` — normally
 * the one place a color is guaranteed to serialise to rgb — did the same. So
 * this does the OKLCH -> linear sRGB -> sRGB math directly rather than
 * depending on the engine to do it; verified against known points (white,
 * black, and this app's own --primary tokens, which land within a rounding
 * error of the "#1f5eff electric blue" the light-theme palette comment
 * names by hand).
 */
function oklchToHex(l: number, c: number, h: number): string {
  const hRad = (h * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const rLin = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const gLin = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bLin = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const gamma = (channel: number) => {
    const clamped = Math.max(0, Math.min(1, channel));
    return clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
  };
  const toHex = (channel: number) =>
    Math.round(gamma(channel) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(rLin)}${toHex(gLin)}${toHex(bLin)}`;
}

const OKLCH = /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/i;

function resolveCssVar(name: string): string {
  if (typeof document === "undefined") return "#3b82f6";
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const match = OKLCH.exec(raw);
  if (!match) return raw || "#3b82f6";
  const l = match[1]!.endsWith("%") ? parseFloat(match[1]!) / 100 : parseFloat(match[1]!);
  return oklchToHex(l, parseFloat(match[2]!), parseFloat(match[3]!));
}

/**
 * The focused-city marker: a progress ring built the same way ProgressRing
 * (src/components/Primitives.tsx) draws one, hand-built here as plain DOM
 * because a MapLibre marker element is not a React tree.
 */
function buildRingMarkerElement(gauge: Gauge, color: string): HTMLDivElement {
  const size = 34;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, gauge.pct / 100));
  const dashOffset = circumference * (1 - pct);

  const wrap = document.createElement("div");
  wrap.className = "flex flex-col items-center";
  wrap.innerHTML = `
    <span class="num mb-1 rounded-full bg-card px-1.5 py-0.5 text-[10px] font-semibold shadow-sm">${gauge.used}/${gauge.limit}</span>
    <span class="relative block" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--color-border)" stroke-width="${strokeWidth}" opacity="0.6" />
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}" />
      </svg>
      <span class="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full" style="background:var(--color-foreground)"></span>
    </span>
  `;
  return wrap;
}

function buildDotMarkerElement(m: { sharesAllowance: boolean; visited: boolean }): HTMLDivElement {
  const el = document.createElement("div");
  const size = m.visited ? 10 : 8;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = "999px";
  el.style.boxShadow = "0 0 0 2px var(--color-surface-2)";
  el.style.background = m.sharesAllowance
    ? "var(--color-primary)"
    : m.visited
      ? "var(--color-accent-positive)"
      : "var(--color-muted-foreground)";
  el.style.opacity = m.sharesAllowance ? "0.9" : m.visited ? "0.85" : "0.45";
  return el;
}

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
  const { theme } = useTheme();
  const online = useOnline();

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const [ready, setReady] = useState(false);

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

  const focused = mapCities.find((c) => c.id === city.id);
  const escape =
    focused && gauge.pct >= 50 ? nearestEscape(focused, mapCities, allowanceCountries) : null;

  /**
   * `useTheme()` always starts as "light" and corrects itself a tick after
   * mount (it reads localStorage in an effect, not in useState, to avoid an
   * SSR hydration mismatch). Depending the map's creation effect directly on
   * `theme` meant that correction destroyed and recreated the map on every
   * single page load, racing the marker effect against a map that no longer
   * existed. A ref sidesteps that: the map reads whichever theme is current
   * at the moment it is actually built, once, without re-running for a
   * value that was only ever transiently wrong.
   */
  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Create the map on mount, and recreate it only if connectivity returns —
  // not reactively on theme (see themeRef above). A live theme-swap after
  // the initial load is a reasonable future improvement, not required for
  // the map to render correctly today.
  useEffect(() => {
    if (!online || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL[themeRef.current],
        center: [city.lng, city.lat],
        zoom: 3,
        attributionControl: { compact: true },
      });
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
      setReady(false);
    };
    // Deliberately re-create only on connectivity, not on every trip/city
    // data change — the effect below updates markers in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Markers and the escape line — recomputed whenever the data driving them
  // changes, without recreating the map itself.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    let cancelled = false;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled) return;

      for (const m of markersRef.current) m.remove();
      markersRef.current = [];

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([city.lng, city.lat]);

      for (const m of markers) {
        if (m.focused) continue;
        const marker = new maplibregl.Marker({ element: buildDotMarkerElement(m) })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        markersRef.current.push(marker);
        if (m.sharesAllowance || m.visited) bounds.extend([m.lng, m.lat]);
      }

      const focusedMarker = new maplibregl.Marker({
        element: buildRingMarkerElement(gauge, RING[gauge.status]),
      })
        .setLngLat([city.lng, city.lat])
        .addTo(map);
      markersRef.current.push(focusedMarker);

      if (map.getLayer("escape-line")) map.removeLayer("escape-line");
      if (map.getSource("escape-line")) map.removeSource("escape-line");
      if (escape && focused) {
        const waypoints = arcWaypoints(focused, escape.city);
        map.addSource("escape-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: waypoints },
          },
        });
        map.addLayer({
          id: "escape-line",
          type: "line",
          source: "escape-line",
          layout: { "line-cap": "round" },
          paint: {
            "line-color": resolveCssVar("--color-primary"),
            "line-width": 2,
            "line-dasharray": [2, 2],
            "line-opacity": 0.8,
          },
        });
        bounds.extend([escape.city.lng, escape.city.lat]);
      }

      map.fitBounds(bounds, { padding: 40, maxZoom: 6, duration: 400 });
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, city.id, gauge.used, gauge.limit, gauge.status, escape?.city.id]);

  return (
    <section className="surface overflow-hidden">
      {online ? (
        <div ref={containerRef} className="h-64 w-full sm:h-80" />
      ) : (
        <div className="flex h-64 w-full items-center justify-center bg-surface-2 text-sm text-muted-foreground sm:h-80">
          Map needs a connection. Your day counts still work offline.
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {city.city} on the world map. {gauge.used} of {gauge.limit} {gauge.label} days used.
      </p>

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
