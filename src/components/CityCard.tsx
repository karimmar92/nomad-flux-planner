/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. The ranked city row
 * decides what the app recommends, and that must depend only on the user's
 * income, their filters and the seed data — never on commission.
 */
import { Link } from "@tanstack/react-router";
import { Heart, Wifi, BadgeCheck, ShieldCheck } from "lucide-react";
import {
  computeArbitrage,
  formatUsd,
  isSchengenCity,
  monthlyCost,
} from "@/lib/arbitrage";
import type { City } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Deterministic cover band per city, stable across renders.
 *
 * Hue is deliberately constrained to a warm earth band (~15°–85° in oklch)
 * rather than the full spectrum. Free-running hues produced lime greens and
 * pinks that clashed with the terracotta palette and read as broken image
 * placeholders instead of a designed surface. Chroma is kept low for the same
 * reason — these are backgrounds, not focal points.
 *
 * If real photography is added later, this becomes the fallback for cities
 * with no image rather than the default.
 */
function coverStyle(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) % 997;
  const hue = 15 + (n % 70);
  const light = 0.62 + ((n >> 3) % 5) * 0.02;
  const chroma = 0.05 + ((n >> 6) % 4) * 0.012;
  return {
    backgroundImage: `linear-gradient(140deg, oklch(${light} ${chroma} ${hue}), oklch(${(light - 0.12).toFixed(2)} ${(chroma + 0.02).toFixed(3)} ${hue + 22}))`,
  };
}

export function CityCard({
  city,
  income,
  saved,
  onToggleSave,
}: {
  city: City;
  income: number | null;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  const arb = computeArbitrage(city, income);
  const cost = monthlyCost(city);
  const positive = arb.surplusMonthly > 0;
  const schengen = isSchengenCity(city);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-shadow hover:shadow-[0_6px_20px_rgba(0,0,0,0.07)]">
      {/* Cover band */}
      <Link
        to="/city/$cityId"
        params={{ cityId: city.id }}
        className="relative block h-32 sm:h-36"
        style={coverStyle(city.id)}
        aria-label={`${city.city}, ${city.country}`}
      >
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center"
        >
          <span className="grid h-14 w-14 place-items-center rounded-full bg-white/25 text-xl font-semibold text-white backdrop-blur-sm">
            {city.country_code}
          </span>
        </span>
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent"
        />
      </Link>

      {onToggleSave ? (
        <button
          onClick={onToggleSave}
          aria-label={saved ? "Remove saved city" : "Save city"}
          className="absolute end-3 top-3 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-primary"
        >
          <Heart className={cn("h-4 w-4", saved && "fill-current text-primary")} />
        </button>
      ) : null}

      <div className="px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <Link to="/city/$cityId" params={{ cityId: city.id }} className="min-w-0">
            <h3 className="truncate text-lg font-semibold leading-tight text-primary">
              {city.city}
            </h3>
            <p className="truncate text-xs text-muted-foreground">{city.country}</p>
          </Link>
          <div className="shrink-0 text-end">
            <div className="label-xs">Est. cost</div>
            <div className="num text-lg font-semibold leading-tight">{formatUsd(cost)}/mo</div>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Chip>
            <Wifi className="me-1 h-3 w-3" />
            {city.scores.internetSpeedMbps} Mbps
          </Chip>
          {city.visa.nomadVisa.exists ? (
            <Chip tone="primary">
              <BadgeCheck className="me-1 h-3 w-3" />
              Nomad visa
            </Chip>
          ) : null}
          {schengen ? (
            <Chip tone="warning">Schengen clock</Chip>
          ) : (
            <Chip tone="positive">
              <ShieldCheck className="me-1 h-3 w-3" />
              Non-Schengen
            </Chip>
          )}
        </div>
      </div>

      {/*
        The arbitrage row only renders once an income is known.

        It previously showed "add income" on every card — thirty identical
        prompts down the page, which reads as noise rather than an invitation
        and makes the grid look broken. The ask now happens once, in a banner
        above the grid; the moment income is set, every card fills in at once,
        which is a far better payoff than thirty separate nudges.
      */}
      {income == null ? null : (
        <Link
          to="/city/$cityId"
          params={{ cityId: city.id }}
          className="flex items-center justify-between border-t border-border px-4 py-2.5"
        >
          <span className="label-xs">You&apos;d keep</span>
          <span
            className={cn(
              "num text-lg font-semibold",
              positive ? "text-positive" : "text-negative",
            )}
          >
            {positive ? "+" : "−"}
            {formatUsd(Math.abs(arb.surplusMonthly))}/mo
          </span>
        </Link>
      )}
    </article>
  );
}

function Chip({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "positive" | "warning" | "primary";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium",
        tone === "muted" && "bg-surface-2 text-muted-foreground",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "positive" && "bg-positive-muted text-positive",
        tone === "warning" && "bg-negative-muted text-negative",
      )}
    >
      {children}
    </span>
  );
}
