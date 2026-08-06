/**
 * Pricing table, shared by /pricing and the homepage.
 *
 * Transparent pricing before signup is a conversion decision, not a legal one:
 * a visitor who cannot see the price assumes the worst and leaves. It is
 * rendered from src/config/pricing.ts so the homepage and the pricing page can
 * never disagree.
 */
import { useState } from "react";
import { Check } from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  ANNUAL_MONTHS_CHARGED,
  PRICE_VAT_NOTE,
  TIERS,
  annualMonthlyEquivalentUsd,
  annualUsd,
  formatPrice,
  type Tier,
} from "@/config/pricing";
import { cn } from "@/lib/utils";

export type Billing = "monthly" | "annual";

export function PricingTable({
  compact = false,
  onChoose,
}: {
  /** Homepage variant: fewer feature lines, no long copy. */
  compact?: boolean;
  onChoose?: (tier: Tier, billing: Billing) => void;
}) {
  const [billing, setBilling] = useState<Billing>("annual");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center">
        <div className="flex rounded-md border border-border p-0.5 text-sm">
          {(["monthly", "annual"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={cn(
                "rounded px-3 py-1.5",
                billing === b ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {b === "monthly" ? "Monthly" : `Annual — ${12 - ANNUAL_MONTHS_CHARGED} months free`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => (
          <TierCard
            key={t.id}
            tier={t}
            billing={billing}
            compact={compact}
            {...(onChoose ? { onChoose } : {})}
          />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices in USD {PRICE_VAT_NOTE}. Annual plans are billed as{" "}
        {ANNUAL_MONTHS_CHARGED} months — the other {12 - ANNUAL_MONTHS_CHARGED} are free. Cancel
        any time; cancelling stops the next renewal and your record stays yours to export.
      </p>
    </div>
  );
}

function TierCard({
  tier,
  billing,
  compact,
  onChoose,
}: {
  tier: Tier;
  billing: Billing;
  compact: boolean;
  onChoose?: (tier: Tier, billing: Billing) => void;
}) {
  const free = tier.monthlyUsd === 0;
  const shown = billing === "annual" ? annualMonthlyEquivalentUsd(tier) : tier.monthlyUsd;
  const features = compact ? tier.features.slice(0, 4) : tier.features;

  return (
    <div
      className={cn(
        "panel flex flex-col p-5",
        tier.recommended && "border-primary/50 ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{tier.name}</h3>
        {tier.recommended ? (
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
            Most chosen
          </span>
        ) : null}
      </div>

      <div className="num mt-1 flex items-baseline gap-1 text-3xl font-semibold">
        {free ? (
          "Free"
        ) : (
          <>
            ${shown}
            <span className="text-sm font-normal text-muted-foreground">
              /mo{tier.perSeat ? " per seat" : ""}
            </span>
          </>
        )}
      </div>

      <div className="mt-0.5 min-h-[18px] text-[11px] text-muted-foreground">
        {free ? (
          "No card, no trial clock."
        ) : billing === "annual" ? (
          <>
            ${annualUsd(tier)}/yr {PRICE_VAT_NOTE} — {12 - ANNUAL_MONTHS_CHARGED} months free
          </>
        ) : (
          <>
            {PRICE_VAT_NOTE} · ${annualMonthlyEquivalentUsd(tier)}/mo billed annually
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">{tier.audience}</p>
      {!compact ? <p className="mt-2 text-sm">{tier.headline}</p> : null}

      <ul className="mt-4 flex-1 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" aria-hidden />
            <span>{f}</span>
          </li>
        ))}
        {compact && tier.features.length > features.length ? (
          <li className="text-xs text-muted-foreground">
            + {tier.features.length - features.length} more
          </li>
        ) : null}
      </ul>

      {free ? (
        <Link
          to="/tracker"
          className="mt-5 rounded-md border border-border py-2.5 text-center text-sm font-medium"
        >
          Start tracking — no account needed
        </Link>
      ) : (
        <button
          onClick={() => onChoose?.(tier, billing)}
          className={cn(
            "mt-5 rounded-md py-2.5 text-sm font-medium",
            tier.recommended
              ? "bg-primary text-primary-foreground"
              : "border border-border",
          )}
        >
          Choose {tier.name}
        </button>
      )}
    </div>
  );
}
