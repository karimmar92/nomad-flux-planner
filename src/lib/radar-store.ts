import { useCallback, useEffect, useState } from "react";
import {
  cellKey,
  isOnRadar,
  resolveVisibility,
  type LatLng,
  type Visibility,
} from "./geoprivacy";
import { RADAR_PEERS, SEED_INCOMING } from "./radar-peers";
import type { Block, Connection, RadarProfile, Report } from "./radar-types";
import { RADAR_CITY_ID } from "./radar-types";

/**
 * Local persistence for the radar. Mirrors the `profiles` radar columns,
 * `connections`, `blocks` and `reports` one-for-one so the swap to Cloud is a
 * single-file change. Note what is NOT here: any store of a precise
 * coordinate, and any append-only location history.
 */

const KEYS = {
  me: "driftly.radar.me",
  connections: "driftly.radar.connections",
  blocks: "driftly.radar.blocks",
  reports: "driftly.radar.reports",
  consent: "driftly.radar.consent",
  waitlist: "driftly.radar.waitlist",
};

export const ME_ID = "me";

export type MyRadar = {
  headline: string;
  skills: string[];
  looking_for: RadarProfile["looking_for"];
  availability: RadarProfile["availability"];
  bio: string;
  timezone: string;
  /** Ghost is the default. A new user is never on the radar by accident. */
  visibility: Visibility;
  cell_lat: number | null;
  cell_lng: number | null;
  last_active_at: string | null;
  radar_city_id: string | null;
};

export const DEFAULT_MY_RADAR: MyRadar = {
  headline: "",
  skills: [],
  looking_for: [],
  availability: "available",
  bio: "",
  timezone: typeof Intl !== "undefined" ? "Asia/Makassar" : "UTC",
  visibility: "ghost",
  cell_lat: null,
  cell_lng: null,
  last_active_at: null,
  radar_city_id: null,
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("driftly:store", { detail: key }));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValue(read<T>(key, fallback));
    setHydrated(true);
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read<T>(key, fallback));
    };
    window.addEventListener("driftly:store", onChange);
    return () => window.removeEventListener("driftly:store", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T) => {
      write(key, next);
      setValue(next);
    },
    [key],
  );

  return { value, update, hydrated };
}

export function useRadarConsent() {
  const { value, update, hydrated } = useStored<boolean>(KEYS.consent, false);
  return { consented: value, setConsented: update, hydrated };
}

export function useMyRadar() {
  const { value, update, hydrated } = useStored<MyRadar>(KEYS.me, DEFAULT_MY_RADAR);
  const patch = useCallback(
    (fields: Partial<MyRadar>) => update({ ...value, ...fields }),
    [value, update],
  );

  /** One overwritten row. There is no history, by design. */
  const setCell = useCallback(
    (cell: LatLng, cityId: string) =>
      update({
        ...value,
        cell_lat: cell.lat,
        cell_lng: cell.lng,
        radar_city_id: cityId,
        last_active_at: new Date().toISOString(),
      }),
    [value, update],
  );

  const touch = useCallback(
    () => update({ ...value, last_active_at: new Date().toISOString() }),
    [value, update],
  );

  /** Deletes every location and radar row this user has. One tap, actually gone. */
  const deleteEverything = useCallback(() => {
    write(KEYS.me, DEFAULT_MY_RADAR);
    write(KEYS.connections, []);
    write(KEYS.blocks, []);
    write(KEYS.consent, false);
    update(DEFAULT_MY_RADAR);
  }, [update]);

  return { me: value, patchMe: patch, setCell, touch, deleteEverything, hydrated };
}

export function useConnections() {
  const { value, update, hydrated } = useStored<Connection[]>(KEYS.connections, SEED_INCOMING);

  const request = useCallback(
    (recipientId: string, note: string) => {
      const existing = value.find(
        (c) => c.requester_id === ME_ID && c.recipient_id === recipientId,
      );
      if (existing) return existing;
      const row: Connection = {
        id: crypto.randomUUID(),
        requester_id: ME_ID,
        recipient_id: recipientId,
        status: "pending",
        intro_note: note,
        created_at: new Date().toISOString(),
      };
      update([...value, row]);
      return row;
    },
    [value, update],
  );

  const setStatus = useCallback(
    (id: string, status: Connection["status"]) =>
      update(value.map((c) => (c.id === id ? { ...c, status } : c))),
    [value, update],
  );

  const withPeer = useCallback(
    (peerId: string) =>
      value.find((c) => c.requester_id === peerId || c.recipient_id === peerId) ?? null,
    [value],
  );

  return { connections: value, request, setStatus, withPeer, hydrated };
}

export function useBlocks() {
  const { value, update, hydrated } = useStored<Block[]>(KEYS.blocks, []);
  const block = useCallback(
    (blockedId: string) => {
      if (value.some((b) => b.blocked_id === blockedId)) return;
      update([
        ...value,
        {
          id: crypto.randomUUID(),
          blocker_id: ME_ID,
          blocked_id: blockedId,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    [value, update],
  );
  const unblock = useCallback(
    (blockedId: string) => update(value.filter((b) => b.blocked_id !== blockedId)),
    [value, update],
  );
  const isBlocked = useCallback(
    (id: string) => value.some((b) => b.blocked_id === id),
    [value],
  );
  return { blocks: value, block, unblock, isBlocked, hydrated };
}

export function useReports() {
  const { value, update, hydrated } = useStored<Report[]>(KEYS.reports, []);
  const report = useCallback(
    (reportedId: string, reason: Report["reason"], detail: string) =>
      update([
        ...value,
        {
          id: crypto.randomUUID(),
          reporter_id: ME_ID,
          reported_id: reportedId,
          reason,
          detail,
          created_at: new Date().toISOString(),
          status: "open" as const,
        },
      ]),
    [value, update],
  );
  return { reports: value, report, hydrated };
}

export function useRadarWaitlist() {
  const { value, update } = useStored<{ email: string; city_id: string }[]>(
    KEYS.waitlist,
    [],
  );
  const join = useCallback(
    (email: string, cityId: string) => update([...value, { email, city_id: cityId }]),
    [value, update],
  );
  const joined = useCallback(
    (cityId: string) => value.some((w) => w.city_id === cityId),
    [value],
  );
  return { join, joined };
}

/** Cell occupancy across everyone currently on the radar in this city,
 *  including me. Drives the k-anonymity floor. */
export function occupancyMap(myCell: LatLng | null, nowIso: string): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const p of RADAR_PEERS) {
    if (p.visibility === "ghost") continue;
    if (p.cell_lat === null || p.cell_lng === null) continue;
    if (!isOnRadar(p.last_active_at, nowIso)) continue;
    bump(cellKey({ lat: p.cell_lat, lng: p.cell_lng }));
  }
  if (myCell) bump(cellKey(myCell));
  return counts;
}

export type VisiblePeer = {
  peer: RadarProfile;
  mode: "city_only" | "cell";
};

/** `resolveVisibility` gates every read — no peer reaches the UI without it. */
export function visiblePeers(opts: {
  myCell: LatLng | null;
  nowIso: string;
  cityId: string;
  isBlocked: (id: string) => boolean;
}): VisiblePeer[] {
  const counts = occupancyMap(opts.myCell, opts.nowIso);
  const out: VisiblePeer[] = [];
  for (const peer of RADAR_PEERS) {
    if (peer.radar_city_id !== opts.cityId) continue;
    const cell =
      peer.cell_lat !== null && peer.cell_lng !== null
        ? { lat: peer.cell_lat, lng: peer.cell_lng }
        : null;
    const mode = resolveVisibility({
      subjectVisibility: peer.visibility,
      cellOccupancy: cell ? (counts.get(cellKey(cell)) ?? 0) : 0,
      isBlocked: opts.isBlocked(peer.id),
      subjectLastActive: peer.last_active_at,
      now: opts.nowIso,
    });
    if (mode === "hidden") continue;
    out.push({ peer, mode });
  }
  return out;
}

export function getPeer(id: string): RadarProfile | undefined {
  return RADAR_PEERS.find((p) => p.id === id);
}

export { RADAR_CITY_ID };
