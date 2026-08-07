import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { EyeOff, MapPin, Building2, Check } from "lucide-react";
import { BAND_LABELS, distanceLabel, lastSeenLabel, type Visibility } from "@/lib/geoprivacy";
import { AVAILABILITY_LABELS, LOOKING_FOR_LABELS } from "@/lib/radar-types";
import type { VisiblePeer } from "@/lib/radar-store";
import { cn } from "@/lib/utils";

/** Client-only clock. Radar labels are relative, so they must not render on the server. */
export function useNow(): string | null {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    setNow(new Date().toISOString());
    const t = setInterval(() => setNow(new Date().toISOString()), 60_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Chip({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "accent" | "muted";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "default" && "border-border bg-surface-2 text-muted-foreground",
        tone === "accent" && "border-primary/40 bg-primary/10 text-primary",
        tone === "muted" && "border-transparent bg-surface-2 text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold text-muted-foreground">
      {initials}
    </div>
  );
}

const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  icon: typeof EyeOff;
  blurb: string;
}[] = [
  {
    value: "ghost",
    label: "Ghost",
    icon: EyeOff,
    blurb: "Invisible. Nobody sees you on the radar or in the city list.",
  },
  {
    value: "city",
    label: "City",
    icon: Building2,
    blurb: "People see you are in this city. No area, no distance.",
  },
  {
    value: "radar",
    label: "Radar",
    icon: MapPin,
    blurb: "People see a distance band — never a position, never a number.",
  },
];

export function VisibilityToggle({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  const current = VISIBILITY_OPTIONS.find((o) => o.value === value)!;
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="label-xs">Your visibility</div>
          <div className="text-sm font-medium">{current.label}</div>
        </div>
        {value !== "ghost" ? (
          <button type="button"
            onClick={() => onChange("ghost")}
            className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Go invisible
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-surface-2 p-1">
        {VISIBILITY_OPTIONS.map((o) => (
          <button type="button"
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors",
              value === o.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <o.icon className="h-3.5 w-3.5" />
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{current.blurb}</p>
    </div>
  );
}

/** Distance is only ever a band label — the numeric km never leaves geoprivacy.ts. */
export function peerDistanceLabel(
  entry: VisiblePeer,
  myCell: { lat: number; lng: number } | null,
): string | null {
  if (entry.mode !== "cell" || !myCell) return null;
  if (entry.peer.cell_lat === null || entry.peer.cell_lng === null) return null;
  return distanceLabel(myCell, { lat: entry.peer.cell_lat, lng: entry.peer.cell_lng });
}

export function bandRank(label: string | null): number {
  if (!label) return BAND_LABELS.length + 1;
  const i = BAND_LABELS.indexOf(label as (typeof BAND_LABELS)[number]);
  return i === -1 ? BAND_LABELS.length + 1 : i;
}

export function PeerRow({
  entry,
  myCell,
  nowIso,
}: {
  entry: VisiblePeer;
  myCell: { lat: number; lng: number } | null;
  nowIso: string;
}) {
  const { peer } = entry;
  const band = peerDistanceLabel(entry, myCell);
  return (
    <Link
      to="/community/$peerId"
      params={{ peerId: peer.id }}
      className="panel block p-3 transition-colors hover:border-primary/40"
    >
      <div className="flex gap-3">
        <Avatar name={peer.display_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{peer.display_name}</span>
            <span className="text-xs text-muted-foreground">
              {AVAILABILITY_LABELS[peer.availability]}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-foreground/90">{peer.headline}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {peer.skills.slice(0, 3).map((s) => (
              <Chip key={s}>{s}</Chip>
            ))}
            {peer.looking_for.slice(0, 1).map((l) => (
              <Chip key={l} tone="accent">
                {LOOKING_FOR_LABELS[l]}
              </Chip>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span>{band ?? "in this city"}</span>
            <span>{lastSeenLabel(peer.last_active_at, nowIso)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ConsentScreen({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-6">
      <div>
        <span className="label-xs">Before we ask for anything</span>
        <h1 className="text-2xl font-semibold tracking-tight">
          How your location is handled
        </h1>
      </div>
      <ul className="panel space-y-3 p-4 text-sm">
        {[
          "We store your approximate area, rounded to a grid cell of about one kilometre. Your exact coordinates never leave your device.",
          "We keep no history. There is one row with your current area, and it is overwritten each time — there is nothing to reconstruct a movement pattern from.",
          "Other people only ever see a distance band like “1–3 km”, never a number and never a point on a map.",
          "If fewer than five people share your area, you appear as city-only, so you cannot be singled out.",
          "You can switch to Ghost at any time, from any screen, in one tap.",
          "You can delete your area and all radar data with one tap, and it is actually deleted.",
        ].map((line) => (
          <li key={line} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <button type="button"
        onClick={onAccept}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
      >
        I understand — continue
      </button>
      <p className="text-xs text-muted-foreground">
        You will still be in Ghost mode after this. Nothing is shared until you choose
        City or Radar yourself.
      </p>
    </div>
  );
}
