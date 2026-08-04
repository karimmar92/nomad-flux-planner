import { Link } from "@tanstack/react-router";
import { Bookmark, Wifi } from "lucide-react";
import { computeArbitrage, flagEmoji, formatUsd, monthlyCost } from "@/lib/arbitrage";
import type { City } from "@/lib/types";
import { cn } from "@/lib/utils";

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

  return (
    <div className="panel group relative flex flex-col gap-3 p-4 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <Link to="/city/$cityId" params={{ cityId: city.id }} className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-base">
              {flagEmoji(city.country_code)}
            </span>
            <h3 className="truncate text-base font-semibold">{city.city}</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            {city.country} · {city.region}
          </p>
        </Link>
        {onToggleSave ? (
          <button
            onClick={onToggleSave}
            aria-label={saved ? "Remove saved city" : "Save city"}
            className={cn(
              "shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-surface-2",
              saved && "text-primary",
            )}
          >
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
          </button>
        ) : null}
      </div>

      <Link to="/city/$cityId" params={{ cityId: city.id }} className="block">
        <div className="label-xs">You&apos;d keep</div>
        <div
          className={cn(
            "num text-3xl font-semibold",
            income == null && "text-muted-foreground",
            income != null && (positive ? "text-positive" : "text-negative"),
          )}
        >
          {income == null ? "—" : `${formatUsd(arb.surplusMonthly)}/mo`}
        </div>
        <div className="num mt-0.5 text-xs text-muted-foreground">
          {formatUsd(cost)}/mo cost
          {income != null ? ` · ${arb.savingsRate.toFixed(0)}% savings rate` : " · add income"}
        </div>
      </Link>

      <div className="flex flex-wrap gap-1.5">
        <Badge>
          <Wifi className="mr-1 h-3 w-3" />
          {city.scores.internet_mbps} Mbps
        </Badge>
        <Badge tone={city.visa.nomad_visa ? "positive" : "muted"}>
          {city.visa.nomad_visa ? "Nomad visa" : "No nomad visa"}
        </Badge>
        {city.visa.schengen ? <Badge tone="warning">Schengen</Badge> : null}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "positive" | "warning";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[11px]",
        tone === "muted" && "border-border bg-surface-2 text-muted-foreground",
        tone === "positive" && "border-positive/40 bg-positive-muted text-positive",
        tone === "warning" && "border-negative/40 bg-negative-muted text-negative",
      )}
    >
      {children}
    </span>
  );
}
