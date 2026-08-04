import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, LocateFixed, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/app";
import { CITIES, getCity } from "@/lib/cities";
import { snapToCell } from "@/lib/geoprivacy";
import { waitingCount } from "@/lib/radar-peers";
import {
  RADAR_CITY_ID,
  useBlocks,
  useConnections,
  useMyRadar,
  useRadarConsent,
  useRadarWaitlist,
  visiblePeers,
} from "@/lib/radar-store";
import {
  AVAILABILITY,
  AVAILABILITY_LABELS,
  LOOKING_FOR,
  LOOKING_FOR_LABELS,
  type Availability,
  type LookingFor,
} from "@/lib/radar-types";
import { EmptyState } from "@/components/Primitives";
import {
  ConsentScreen,
  PeerRow,
  VisibilityToggle,
  bandRank,
  peerDistanceLabel,
  useNow,
} from "@/components/radar/RadarBits";
import { cn } from "@/lib/utils";
import { RequiresNetwork } from "@/components/OfflineBanner";

export const Route = createFileRoute("/community/")({
  head: () => ({
    meta: [
      { title: `Community radar — find people to work with | ${APP_NAME}` },
      {
        name: "description",
        content:
          "A professional collaboration radar for freelancers and founders. Approximate areas only, never exact locations, and you are invisible by default.",
      },
      { property: "og:title", content: `Community radar | ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "Find freelancers and founders working nearby. Privacy-first: approximate area only, invisible by default.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityRadar,
});

function CommunityRadar() {
  const { consented, setConsented, hydrated: consentHydrated } = useRadarConsent();
  const { me, patchMe, setCell, deleteEverything } = useMyRadar();
  const { isBlocked } = useBlocks();
  const { connections } = useConnections();
  const nowIso = useNow();

  const [cityId, setCityId] = useState<string>(RADAR_CITY_ID);
  const [skill, setSkill] = useState("");
  const [lookingFor, setLookingFor] = useState<LookingFor | "any">("any");
  const [availability, setAvailability] = useState<Availability | "any">("any");

  const city = getCity(cityId);
  const myCell =
    me.cell_lat !== null && me.cell_lng !== null
      ? { lat: me.cell_lat, lng: me.cell_lng }
      : null;

  const rows = useMemo(() => {
    if (!nowIso) return [];
    const base = visiblePeers({ myCell, nowIso, cityId, isBlocked });
    return base
      .filter((e) =>
        skill.trim()
          ? e.peer.skills.some((s) =>
              s.toLowerCase().includes(skill.trim().toLowerCase()),
            )
          : true,
      )
      .filter((e) => (lookingFor === "any" ? true : e.peer.looking_for.includes(lookingFor)))
      .filter((e) => (availability === "any" ? true : e.peer.availability === availability))
      .sort((a, b) => {
        const rank =
          bandRank(peerDistanceLabel(a, myCell)) - bandRank(peerDistanceLabel(b, myCell));
        if (rank !== 0) return rank;
        return Date.parse(b.peer.last_active_at) - Date.parse(a.peer.last_active_at);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowIso, me.cell_lat, me.cell_lng, cityId, skill, lookingFor, availability, connections]);

  const pendingIncoming = connections.filter(
    (c) => c.recipient_id === "me" && c.status === "pending",
  ).length;

  const shareArea = () => {
    if (!("geolocation" in navigator)) {
      // Fall back to the city centroid so the radar still works.
      const c = getCity(cityId);
      if (c) setCell(snapToCell(c.lat, c.lng), cityId);
      toast.message("Using the city centre as your approximate area");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Snap happens here, in the browser. Only the centroid is ever stored.
        setCell(snapToCell(pos.coords.latitude, pos.coords.longitude), cityId);
        toast.success("Approximate area updated");
      },
      () => {
        const c = getCity(cityId);
        if (c) setCell(snapToCell(c.lat, c.lng), cityId);
        toast.message("Location unavailable — using the city centre instead");
      },
      { maximumAge: 300_000, timeout: 8000 },
    );
  };

  if (!consentHydrated) return null;
  if (!consented) return <ConsentScreen onAccept={() => setConsented(true)} />;

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="label-xs">Community</span>
          <h1 className="text-2xl font-semibold tracking-tight">Collaboration radar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People building things near you. Not a map, not a feed, not a dating app.
          </p>
        </div>
        <Link
          to="/community/requests"
          className="relative rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2"
        >
          <Inbox className="mr-1.5 inline h-3.5 w-3.5" />
          Requests
          {pendingIncoming > 0 ? (
            <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
              {pendingIncoming}
            </span>
          ) : null}
        </Link>
      </header>

      <VisibilityToggle value={me.visibility} onChange={(v) => patchMe({ visibility: v })} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="label-xs" htmlFor="radar-city">
          City
        </label>
        <select
          id="radar-city"
          value={cityId}
          onChange={(e) => setCityId(e.target.value)}
          className="rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
        >
          {CITIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.city}
              {c.id === RADAR_CITY_ID ? " — live" : ""}
            </option>
          ))}
        </select>
      </div>

      {cityId !== RADAR_CITY_ID ? (
        <CityGate cityId={cityId} cityName={city?.city ?? "this city"} />
      ) : (
        <>
          <div className="panel flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="text-sm">
              {myCell ? (
                <span className="text-muted-foreground">
                  Your approximate area is set. Distances are shown in bands only.
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Set your approximate area to sort people by distance band.
                </span>
              )}
            </div>
            <button
              onClick={shareArea}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
            >
              <LocateFixed className="mr-1.5 inline h-3.5 w-3.5" />
              {myCell ? "Refresh area" : "Set my area"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={skill}
              onChange={(e) => setSkill(e.target.value)}
              placeholder="Filter by skill"
              aria-label="Filter by skill"
              className="rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <select
              aria-label="Filter by what they're looking for"
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value as LookingFor | "any")}
              className="rounded-md border border-input bg-surface px-3 py-2 text-sm"
            >
              <option value="any">Any intent</option>
              {LOOKING_FOR.map((l) => (
                <option key={l} value={l}>
                  {LOOKING_FOR_LABELS[l]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by availability"
              value={availability}
              onChange={(e) => setAvailability(e.target.value as Availability | "any")}
              className="rounded-md border border-input bg-surface px-3 py-2 text-sm"
            >
              <option value="any">Any availability</option>
              {AVAILABILITY.map((a) => (
                <option key={a} value={a}>
                  {AVAILABILITY_LABELS[a]}
                </option>
              ))}
            </select>
          </div>

          <p className={cn("text-sm font-medium", !nowIso && "opacity-0")}>
            {rows.length} {rows.length === 1 ? "person" : "people"} working nearby in Canggu
          </p>

          {nowIso && rows.length === 0 ? (
            <EmptyState
              title="Nobody matches that yet"
              body="Canggu is the only city where the radar is live, and the filters above are strict. Loosen a filter, or check back — people drop on and off the radar as they work."
            />
          ) : (
            <div className="space-y-2">
              {nowIso
                ? rows.map((entry) => (
                    <PeerRow
                      key={entry.peer.id}
                      entry={entry}
                      myCell={myCell}
                      nowIso={nowIso}
                    />
                  ))
                : null}
            </div>
          )}
        </>
      )}

      <div className="panel space-y-2 p-4">
        <h2 className="text-sm font-semibold">Your location data</h2>
        <p className="text-xs text-muted-foreground">
          We hold one row: an area rounded to about a kilometre, and the hour you were
          last active. No history, no exact coordinates, nothing to reconstruct a route
          from.
        </p>
        <button
          onClick={() => {
            deleteEverything();
            toast.success("Radar data deleted");
          }}
          className="rounded-md border border-negative/40 px-3 py-1.5 text-xs font-medium text-negative hover:bg-negative-muted"
        >
          <Trash2 className="mr-1.5 inline h-3.5 w-3.5" />
          Delete my area and radar data
        </button>
      </div>
    </div>
  );
}

function CityGate({ cityId, cityName }: { cityId: string; cityName: string }) {
  const { join, joined } = useRadarWaitlist();
  const [email, setEmail] = useState("");
  const done = joined(cityId);

  return (
    <div className="panel space-y-3 p-5">
      <h2 className="text-base font-semibold">The radar isn&apos;t live in {cityName}</h2>
      <p className="text-sm text-muted-foreground">
        Proximity discovery only works with density. A hundred people in one city is a
        scene; a hundred spread over twenty-five cities is a ghost town. So we open one
        city at a time — Canggu first.
      </p>
      <p className="num text-2xl font-semibold">{waitingCount(cityId)}</p>
      <p className="-mt-2 text-xs text-muted-foreground">
        people waiting for {cityName}
      </p>
      {done ? (
        <p className="text-sm text-positive">
          You&apos;re on the list. We&apos;ll email you when {cityName} opens.
        </p>
      ) : (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^\S+@\S+\.\S+$/.test(email)) {
              toast.error("Enter a valid email address");
              return;
            }
            join(email, cityId);
            toast.success("Added to the list");
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Notify me
          </button>
        </form>
      )}
    </div>
  );
}
