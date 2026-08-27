/**
 * Equirectangular projection and the map's visual model.
 *
 * ── WHY A MAP EARNS ITS PLACE HERE ─────────────────────────────────────
 *
 * On a VPN status screen a map is decoration: it shows where your traffic
 * exits, which you already chose. On this product it carries the single
 * hardest thing to say in words —
 *
 *     "these 29 countries share ONE 90-day allowance"
 *
 * That sentence takes a paragraph and still gets misread. Shown as one lit
 * region containing every city that draws from the same meter, it takes no
 * reading at all. The map is the explanation, not an illustration of it.
 *
 * ── NO DEPENDENCY, AND WHAT THAT COSTS ─────────────────────────────────
 *
 * There is no map library or geographic data in this project, and adding
 * `world-atlas` plus a renderer means a package install this environment has
 * already failed at more than once. So this uses the data that IS present:
 * every one of the 30 cities carries lat/lng.
 *
 * The honest consequence: THERE ARE NO COASTLINES. This is a constellation of
 * real places at their real relative positions, not a political map. That is a
 * deliberate trade — an accurate abstract map beats an inaccurate literal one,
 * and a hand-drawn approximation of Europe would be visibly wrong to anyone who
 * lives there.
 *
 * To upgrade later: keep `project()` and swap the backdrop for real land paths.
 * Nothing else changes, because everything below is positioned by projection,
 * not by hand.
 *
 * ── WHY EQUIRECTANGULAR ────────────────────────────────────────────────
 *
 * Because it is linear: x depends only on longitude, y only on latitude. That
 * makes every position trivially checkable by hand, which matters more here
 * than area fidelity. Mercator would exaggerate the northern cities this
 * audience actually uses, and any conic projection would need a fitted centre.
 */

/** The SVG canvas. Width is exactly 2x height, which equirectangular requires. */
export const MAP_WIDTH = 360;
export const MAP_HEIGHT = 180;

export type Point = { x: number; y: number };

/**
 * Longitude/latitude to SVG coordinates.
 *
 * Longitude -180..180 maps left to right; latitude 90..-90 maps top to bottom.
 * Inputs are clamped rather than wrapped: a coordinate outside the real range
 * is bad data, and drawing it at the edge makes that visible instead of
 * teleporting a city to the other side of the world.
 */
export function project(lat: number, lng: number): Point {
  const safeLng = Math.max(-180, Math.min(180, lng));
  const safeLat = Math.max(-90, Math.min(90, lat));
  return {
    x: ((safeLng + 180) / 360) * MAP_WIDTH,
    y: ((90 - safeLat) / 180) * MAP_HEIGHT,
  };
}

/** Great-circle distance in km. Used to pick the nearest escape. */
export function haversineKm(a: Point3, b: Point3): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export type Point3 = { lat: number; lng: number };

/**
 * A quadratic arc between two projected points, bowed toward the pole.
 *
 * Flight paths drawn as straight lines read as scratches across the map; a
 * consistent bow reads as travel. The bow is proportional to distance so short
 * hops stay nearly flat rather than ballooning.
 *
 * Bows UP in the northern hemisphere and DOWN in the southern, so the curve
 * always arcs away from the equator and never crosses the line it connects.
 */
export function arcPath(from: Point, to: Point): string {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const lift = Math.min(dist * 0.18, 24);
  // Northern hemisphere is the upper half of the canvas.
  const northern = my < MAP_HEIGHT / 2;
  const cy = northern ? my - lift : my + lift;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${mx.toFixed(2)} ${cy.toFixed(2)} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

/**
 * Frame the map to the points that matter, instead of always drawing the globe.
 *
 * WHY THIS EXISTS: the first render showed the whole world with Lisbon, the
 * Schengen bloc and the escape city crammed into about 40 pixels of Europe.
 * Every dot the map was supposed to distinguish overlapped, so the one thing it
 * was built to communicate — which countries share this allowance — was
 * illegible. A world map is the right projection and the wrong FRAME.
 *
 * Fitting to the relevant points means a Lisbon page shows Europe and the
 * Balkans, and a Bangkok page shows south-east Asia, each at a scale where the
 * dots separate.
 *
 * The minimum span stops a single isolated city from zooming to absurdity: with
 * one point the box would have zero width, and everything would be drawn on top
 * of itself at infinite magnification.
 */
export function fitViewBox(
  points: Point[],
  options: { padding?: number; minSpan?: number } = {},
): { x: number; y: number; width: number; height: number; scale: number } {
  const padding = options.padding ?? 18;
  const minSpan = options.minSpan ?? 60;

  if (points.length === 0) {
    return { x: 0, y: 0, width: MAP_WIDTH, height: MAP_HEIGHT, scale: 1 };
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  let minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  let minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;

  // Enforce a minimum width, then derive height from the 2:1 canvas ratio so
  // the projection is never distorted by the framing.
  let width = Math.max(maxX - minX, minSpan);
  let height = width / 2;

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  // If the points are taller than the derived box, grow the box rather than
  // clipping them.
  const neededHeight = maxY - minY;
  if (neededHeight > height) {
    height = neededHeight;
    width = height * 2;
  }

  minX = cx - width / 2;
  minY = cy - height / 2;

  // Never pan outside the map. Clamp, then re-clamp size in case the box is
  // larger than the world itself.
  width = Math.min(width, MAP_WIDTH);
  height = Math.min(height, MAP_HEIGHT);
  minX = Math.max(0, Math.min(minX, MAP_WIDTH - width));
  minY = Math.max(0, Math.min(minY, MAP_HEIGHT - height));

  return { x: minX, y: minY, width, height, scale: MAP_WIDTH / width };
}

export type MapCity = {
  id: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export type MapMarker = MapCity & {
  point: Point;
  /** Shares the current city's Schengen allowance. */
  sharesAllowance: boolean;
  /** The user has recorded days here. */
  visited: boolean;
  /** The city whose page this is. */
  focused: boolean;
};

/**
 * Build every marker the map draws, in one pass.
 *
 * Returned sorted so the focused city is LAST and therefore painted on top;
 * SVG has no z-index, so paint order is the only control available.
 */
export function buildMarkers(input: {
  cities: MapCity[];
  focusedId: string;
  /** Country codes that share the focused city's allowance. Empty if none. */
  allowanceCountries: Set<string>;
  /** Country codes the user has recorded presence in. */
  visitedCountries: Set<string>;
}): MapMarker[] {
  const markers = input.cities.map((c) => ({
    ...c,
    point: project(c.lat, c.lng),
    sharesAllowance: input.allowanceCountries.has(c.countryCode.toUpperCase()),
    visited: input.visitedCountries.has(c.countryCode.toUpperCase()),
    focused: c.id === input.focusedId,
  }));

  return markers.sort((a, b) => Number(a.focused) - Number(b.focused));
}

/**
 * The nearest city that does NOT share the focused city's allowance.
 *
 * This is the border-run answer rendered geographically: if the meter is
 * filling, that is where you go to stop it. Returns null when nothing in the
 * dataset qualifies, rather than inventing a destination.
 */
export function nearestEscape(
  from: MapCity,
  cities: MapCity[],
  allowanceCountries: Set<string>,
): { city: MapCity; km: number } | null {
  let best: { city: MapCity; km: number } | null = null;
  for (const c of cities) {
    if (c.id === from.id) continue;
    if (allowanceCountries.has(c.countryCode.toUpperCase())) continue;
    const km = haversineKm(from, c);
    if (!best || km < best.km) best = { city: c, km };
  }
  return best;
}
