/**
 * Choose a business plan and seat count.
 *
 * Shared by the first-purchase step in CreateOrgFlow and the Billing section
 * of the dashboard, so the price a buyer sees while choosing is computed the
 * same way as the price on /business and the amount Stripe charges. Plans are
 * billed once a year, so there is no billing-period choice to make.
 */
import { Check } from "lucide-react";
import {
  BUSINESS_TIERS,
  MAXIMUM_SEATS,
  MINIMUM_SEATS,
  clampSeats,
  type BusinessTierId,
} from "@/config/business-plans";
import { monthlyEquivalentUsd, perSeatYearlyUsd, usd, yearlyTotal } from "@/lib/org/pricing";
import { cn } from "@/lib/utils";

export type PlanChoice = { tier: BusinessTierId; seats: number };

export function PlanPicker({
  value,
  onChange,
  disabledTiers = [],
}: {
  value: PlanChoice;
  onChange: (next: PlanChoice) => void;
  /** Tiers that cannot be chosen here, e.g. the plan already held. */
  disabledTiers?: BusinessTierId[];
}) {
  // Typing "25" passes through "2", so the field itself is left alone until
  // blur; every figure and the charge use the clamped count.
  const seats = clampSeats(value.seats);

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Plan" className="grid gap-2.5">
        {BUSINESS_TIERS.map((t) => {
          const selected = value.tier === t.id;
          const disabled = disabledTiers.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange({ ...value, tier: t.id })}
              className={cn(
                "rounded-xl border p-3.5 text-start transition-colors disabled:opacity-50",
                selected ? "border-primary bg-accent" : "border-border hover:bg-surface-2",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold">
                  {t.name}
                  {t.recommended ? (
                    <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      Most chosen
                    </span>
                  ) : null}
                  {disabled ? (
                    <span className="ms-2 text-[10px] font-normal text-muted-foreground">
                      current plan
                    </span>
                  ) : null}
                </span>
                <span className="num text-sm">
                  {usd(perSeatYearlyUsd(t.id))}
                  <span className="text-xs text-muted-foreground"> /seat/year</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.headline} About {usd(monthlyEquivalentUsd(t.id))} a month.
              </p>
              {selected ? (
                <ul className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                  {t.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-positive"
                        aria-hidden
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </button>
          );
        })}
      </div>

      <label className="block space-y-1">
        <span className="label-xs">
          Seats ({MINIMUM_SEATS} to {MAXIMUM_SEATS})
        </span>
        <input
          type="number"
          min={MINIMUM_SEATS}
          max={MAXIMUM_SEATS}
          value={value.seats}
          onChange={(e) => onChange({ ...value, seats: Number(e.target.value) })}
          onBlur={() => onChange({ ...value, seats })}
          className="input num"
        />
      </label>

      <p className="text-sm">
        <span className="num font-semibold">{usd(yearlyTotal(seats, value.tier))}</span>
        <span className="text-muted-foreground"> billed once a year for {seats} seats</span>
      </p>
    </div>
  );
}
