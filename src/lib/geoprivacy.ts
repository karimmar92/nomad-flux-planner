export const CELL_DEG = 0.01;              // ~1.11 km of latitude
export const K_ANONYMITY_FLOOR = 5;        // suppress cells below this occupancy
export const DISTANCE_BANDS = [1, 3, 10, 25] as const;
export const BAND_LABELS = ["under 1 km", "1–3 km", "3–10 km", "10–25 km", "25 km+"] as const;
export const RADAR_TTL_DAYS = 7;

export interface LatLng { lat: number; lng: number }

/** Snap a true position to its grid cell centroid. RUN THIS ON THE CLIENT. */
export function snapToCell(lat: number, lng: number): LatLng {
  return {
    lat: Math.floor(lat / CELL_DEG) * CELL_DEG + CELL_DEG / 2,
    lng: Math.floor(lng / CELL_DEG) * CELL_DEG + CELL_DEG / 2,
  };
}

export function cellKey(cell: LatLng): string {
  return `${cell.lat.toFixed(3)}:${cell.lng.toFixed(3)}`;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bandIndex(km: number): number {
  for (let i = 0; i < DISTANCE_BANDS.length; i++) if (km < DISTANCE_BANDS[i]!) return i;
  return DISTANCE_BANDS.length;
}

/** The ONLY distance function the UI may call. Returns a label, never a number. */
export function distanceLabel(cellA: LatLng, cellB: LatLng): string {
  return BAND_LABELS[bandIndex(haversineKm(cellA, cellB))]!;
}

/** Round last-seen to whole hours — minute precision plus a cell sequence
 *  reconstructs a movement pattern. */
export function lastSeenLabel(lastActiveIso: string, nowIso: string): string {
  const hrs = Math.floor((Date.parse(nowIso) - Date.parse(lastActiveIso)) / 3_600_000);
  if (hrs < 1) return "active now";
  if (hrs < 24) return `active ${hrs}h ago`;
  const d = Math.floor(hrs / 24);
  return d === 1 ? "active yesterday" : `active ${d} days ago`;
}

export function isOnRadar(lastActiveIso: string, nowIso: string): boolean {
  return (Date.parse(nowIso) - Date.parse(lastActiveIso)) / 86_400_000 < RADAR_TTL_DAYS;
}

export type Visibility = "ghost" | "city" | "radar";

/** Fails closed: any path that forgets to set visibility yields the private option. */
export function resolveVisibility(opts: {
  subjectVisibility: Visibility;
  cellOccupancy: number;
  isBlocked: boolean;
  subjectLastActive: string;
  now: string;
}): "hidden" | "city_only" | "cell" {
  const { subjectVisibility, cellOccupancy, isBlocked, subjectLastActive, now } = opts;
  if (isBlocked) return "hidden";
  if (subjectVisibility === "ghost") return "hidden";
  if (!isOnRadar(subjectLastActive, now)) return "hidden";
  if (subjectVisibility === "city") return "city_only";
  if (cellOccupancy < K_ANONYMITY_FLOOR) return "city_only";
  return "cell";
}
