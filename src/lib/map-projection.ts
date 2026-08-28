/**
 * Geography helpers for the city World Card.
 *
 * The rendering half of this file (a hand-projected equirectangular canvas,
 * with no coastlines because there was no map library in this project) has
 * been replaced by a real MapLibre GL / OpenFreeMap map in WorldCard.tsx —
 * see that file for the map itself. What is left here is the geo-math that
 * never depended on the rendering approach: great-circle distance and "which
 * city is the nearest way out of this allowance", both still driving the
 * map's escape-arc feature exactly as before.
 */

export type Point3 = { lat: number; lng: number };

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

export type MapCity = {
  id: string;
  city: string;
  countryCode: string;
  lat: number;
  lng: number;
};

export type MapMarker = MapCity & {
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
 * Returned sorted so the focused city is LAST, so it is added to the map
 * after the rest and z-orders on top of anything it overlaps.
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

/**
 * A few waypoints along a curve bowed toward the pole, for the escape-arc
 * line layer. Flight paths drawn as a straight line read as a scratch across
 * the map; a consistent bow reads as travel. Mirrors the bow the old SVG
 * `arcPath()` drew, in lat/lng instead of projected canvas coordinates.
 */
export function arcWaypoints(from: Point3, to: Point3): [number, number][] {
  const midLat = (from.lat + to.lat) / 2;
  const midLng = (from.lng + to.lng) / 2;
  const dist = haversineKm(from, to);
  // Degrees of lift, capped, proportional to distance so short hops stay
  // nearly flat rather than ballooning.
  const lift = Math.min(dist / 400, 6);
  // Bows away from the equator, same rule as before.
  const bentLat = midLat >= 0 ? midLat + lift : midLat - lift;

  return [
    [from.lng, from.lat],
    [midLng, bentLat],
    [to.lng, to.lat],
  ];
}
