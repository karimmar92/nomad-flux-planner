import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, Lock, Plane, TrainFront, TriangleAlert } from "lucide-react";
import type { BorderRunPlan, ExitOption } from "@/lib/border-run";
import { RANK_WEIGHTS } from "@/lib/border-run";
import { useTranslation } from "react-i18next";
import { flagEmoji, formatUsd } from "@/lib/arbitrage";
import { TransportGroup } from "@/components/partners/TransportGroup";
import { formatDateLong } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { isEmergency } from "@/lib/entitlements";
import { EmergencyUnlockNote, LockedPreview } from "@/components/ProGate";

/**
 * Border-run planner. Deadline-triggered only — this card never appears
 * unless a move is already forced by a visa limit. That is also the only
 * reason a transport link is allowed inside it.
 */
export function BorderRunCard({ plan, isPro }: { plan: BorderRunPlan; isPro: boolean }) {
  const { i18n } = useTranslation();
  const { deadline, origin, departOn, options } = plan;
  const [openId, setOpenId] = useState<string | null>(options[0]?.city.id ?? null);
  // EMERGENCY RULE: over a limit, or inside 7 days of one, the gate comes off.
  const emergency = isEmergency(deadline);
  const unlocked = isPro || emergency;
  const visible = unlocked ? options : options.slice(0, 1);
  const locked = unlocked ? [] : options.slice(1);
  const cheapest = [...options].sort((a, b) => a.monthlyCost - b.monthlyCost)[0];


  return (
    <section
      className={cn(
        "panel border-s-2 p-4",
        deadline.overstayed || deadline.daysLeft <= 7
          ? "border-s-negative"
          : "border-s-accent-warning",
      )}
    >
      <div className="flex items-start gap-2.5">
        <TriangleAlert
          className={cn(
            "mt-0.5 h-5 w-5 shrink-0",
            deadline.overstayed || deadline.daysLeft <= 7
              ? "text-negative"
              : "text-accent-warning",
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-tight tracking-tight">
            {deadline.overstayed
              ? `You are over your limit in ${flagEmoji(deadline.countryCode)} ${deadline.countryCode}`
              : `You need to leave ${
                  deadline.reason === "schengen"
                    ? "the Schengen Area"
                    : `${flagEmoji(deadline.countryCode)} ${deadline.countryCode}`
                } by ${formatDateLong(deadline.lastLegalDay, i18n.language)} — ${deadline.daysLeft} ${
                  deadline.daysLeft === 1 ? "day" : "days"
                }`}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {deadline.explanation}
          </p>
        </div>
      </div>

      <div className="mt-4">
        <div className="label-xs mb-1">Where to go next, from {origin.city}</div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Ranked on your visa maths and your income — not on ticket price, and not on what pays
          us. Weighting: clock {RANK_WEIGHTS.clock}, cost {RANK_WEIGHTS.cost}, days{" "}
          {RANK_WEIGHTS.days}, journey {RANK_WEIGHTS.distance}.
        </p>

        <ol className="space-y-2">
          {visible.map((option, i) => (
            <OptionRow
              key={option.city.id}
              rank={i + 1}
              option={option}
              origin={origin.city}
              departOn={departOn}
              expanded={openId === option.city.id}
              onToggle={() => setOpenId(openId === option.city.id ? null : option.city.id)}
            />
          ))}
        </ol>

        {locked.length > 0 ? (
          <LockedPreview
            className="mt-2"
            headline={`${options.length} exit options found · cheapest is ${cheapest ? cheapest.city.city : "—"}`}
            detail="Pro shows every destination ranked, with its cost delta, days available and nomad-visa eligibility against your income."
          >
            <ol className="space-y-2">
              {locked.map((option, i) => (
                <OptionRow
                  key={option.city.id}
                  rank={i + 2}
                  option={option}
                  origin={origin.city}
                  departOn={departOn}
                  expanded={false}
                  onToggle={() => {}}
                />
              ))}
            </ol>
          </LockedPreview>
        ) : null}

        {emergency && !isPro && options.length > 1 ? <EmergencyUnlockNote /> : null}

      </div>
    </section>
  );
}

function OptionRow({
  rank,
  option,
  origin,
  departOn,
  expanded,
  onToggle,
}: {
  rank: number;
  option: ExitOption;
  origin: string;
  departOn: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { city } = option;
  const Icon = option.mode === "overland" ? TrainFront : Plane;

  return (
    <li className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-start"
      >
        <span className="num mt-0.5 w-5 shrink-0 text-sm font-semibold text-muted-foreground">
          {rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">
              {flagEmoji(city.country_code)} {city.city}
            </span>
            <span className="text-xs text-muted-foreground">{city.country}</span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            {option.stopsTheClock && option.nonSchengen ? (
              <Badge tone="positive">Non-Schengen — stops the clock</Badge>
            ) : null}
            <Badge tone={option.costDeltaUsd !== null && option.costDeltaUsd < 0 ? "positive" : "muted"}>
              {formatUsd(option.monthlyCost)}/mo
              {option.costDeltaUsd !== null && option.costDeltaUsd !== 0
                ? ` · ${option.costDeltaUsd < 0 ? "−" : "+"}${formatUsd(Math.abs(option.costDeltaUsd))}`
                : ""}
            </Badge>
            <Badge tone="muted">{option.daysAvailable} days</Badge>
            {option.nomadVisaQualified === true ? (
              <Badge tone="positive">Nomad visa — you qualify</Badge>
            ) : option.nomadVisaQualified === null && city.visa.nomadVisa.exists ? (
              <Badge tone="muted">Nomad visa available</Badge>
            ) : null}
          </span>
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {option.mode === "overland" ? "Overland" : "Air"} · roughly {option.journeyHours}h ·{" "}
            <span className="num">{option.distanceKm.toLocaleString()} km</span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="space-y-3 border-t border-border p-3">
          <div>
            <div className="label-xs mb-1.5">Why it ranked {rank}</div>
            <ul className="space-y-1">
              {option.breakdown.map((b) => (
                <li key={b.label} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0">
                    <span className="font-medium text-foreground">{b.label}</span>{" "}
                    <span className="text-muted-foreground">— {b.detail}</span>
                  </span>
                  <span className="num shrink-0 text-muted-foreground">
                    {b.points}/{b.max}
                  </span>
                </li>
              ))}
              <li className="flex items-baseline justify-between gap-3 border-t border-border pt-1 text-xs font-semibold">
                <span>Total</span>
                <span className="num">{option.score}/100</span>
              </li>
            </ul>
          </div>

          <Link
            to="/city/$cityId"
            params={{ cityId: city.id }}
            className="inline-block text-xs font-semibold text-accent-positive underline-offset-4 hover:underline"
          >
            Full breakdown for {city.city}
          </Link>

          {/* Transport links are permitted here: the move is forced by a visa
              deadline and the user has picked this destination. */}
          <TransportGroup
            placement="border_run"
            region={city.region}
            fromCity={origin}
            toCity={city.city}
            date={departOn}
            cityId={city.id}
            title={`${origin} → ${city.city}`}
          />
        </div>
      ) : null}
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "positive" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "num rounded border px-1.5 py-0.5 text-[10px] font-medium",
        tone === "positive"
          ? "border-accent-positive/30 bg-accent-positive-muted text-accent-positive"
          : "border-border text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
