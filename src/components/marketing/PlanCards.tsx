/**
 * The plan cards, shared by the landing page and /pricing.
 *
 * One definition, two callers. The landing page renders them as links into
 * /pricing; /pricing renders the same cards with a real buy handler, so the
 * card someone clicks on the homepage is visually the card they pay from.
 * Two separate pricing presentations is how a price ends up differing between
 * the promise and the checkout.
 *
 * TEAMS IS NOT HERE. Per-seat sales need a conversation and a contract, and a
 * fourth column on a launch page mostly adds deliberation. /business still
 * explains it; the card returns when the tier is actually sold self-serve.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/cities";
import {
  ANNUAL_MONTHS_FREE,
  TRIAL_DAYS,
  annualMonthlyEquivalentUsd,
  annualSavingPercent,
  annualUsd,
  tier,
} from "@/config/pricing";
import { FOUNDING_PRICE_USD, FOUNDING_SPOTS } from "@/config/founding";

export type PlanCardBilling = "monthly" | "annual";

/**
 * The three self-serve plans, in order: Free, Pro, Founding.
 *
 * THREE, not two. Two options is a yes/no on one price; three is a choice
 * between shapes — free, subscription, pay-once — and the middle one is the
 * one being recommended. The founding card is not a fourth column of features,
 * it is the "I do not want a subscription" answer.
 *
 * Annual leads: the price shown is the monthly-equivalent on annual, with the
 * true monthly figure struck through beside it, so the comparison is honest
 * and the cheaper commitment is the default rather than the hidden option.
 *
 * TEAMS IS STILL NOT HERE. Per-seat sales need a conversation; /business
 * explains it.
 */
function planContent(billing: PlanCardBilling) {
  const pro = tier("pro");
  const proAnnual = annualUsd(pro);
  const perMonth = annualMonthlyEquivalentUsd(pro);
  const annual = billing === "annual";
  return [
    {
      id: "free" as const,
      name: "Free",
      price: "$0",
      unit: "always, no card",
      outcome: "Know where you stand today.",
      points: [
        "Unlimited trips, no cap, ever",
        "Your Schengen status right now",
        "Day counts for every country",
        `Three forward-looking checks a month, then ${CITIES.length} cities to browse`,
      ],
      cta: "Start tracking",
      featured: false,
      strikethrough: null as string | null,
      badge: null as string | null,
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: annual ? `$${perMonth}` : `$${pro.monthlyUsd}`,
      unit: annual
        ? `per month, billed $${proAnnual} yearly · ${ANNUAL_MONTHS_FREE} months free`
        : "per month, billed monthly",
      outcome: "Plan the next move before it becomes urgent.",
      points: [
        "Border-run planning, every exit ranked",
        "Alerts at 75% and 90% of any limit",
        "Tax presence report and exports",
        "Document vault, offline at the border",
      ],
      cta: `Start ${TRIAL_DAYS}-day free trial`,
      featured: true,
      // The anchor. Annual is priced against the monthly it replaces.
      strikethrough: annual ? `$${pro.monthlyUsd}` : null,
      badge: annual ? `Save ${annualSavingPercent()}%` : null,
    },
  ];
}

/**
 * @param onSelect - omit on marketing pages: the cards then link to /pricing
 *   instead of opening checkout in place.
 */
export function PlanCardGrid({
  billing = "annual",
  onSelect,
  busyPlan,
  highlight,
  includeFounding = true,
}: {
  billing?: PlanCardBilling;
  onSelect?: (plan: "free" | "pro", billing: PlanCardBilling) => void;
  busyPlan?: string | null;
  highlight?: string | null;
  /** Adds the one-off Founding card so the row is a real three-way choice. */
  includeFounding?: boolean;
}) {
  return (
    <div className={cn("grid gap-5", includeFounding ? "md:grid-cols-3" : "md:grid-cols-2")}>
      {planContent(billing).map((p) => (
        <PlanCard
          key={p.id}
          id={`plan-${p.id}`}
          name={p.name}
          price={p.price}
          unit={p.unit}
          outcome={p.outcome}
          points={p.points}
          featured={p.featured}
          strikethrough={p.strikethrough}
          badge={p.badge}
          highlighted={highlight === p.id}
          cta={busyPlan === p.id ? "Opening checkout…" : p.cta}
          {...(onSelect
            ? { onSelect: () => onSelect(p.id, billing) }
            : p.id === "pro"
              ? { search: { plan: "pro" as const, interval: billing } }
              : { to: "/tracker" as const })}
        />
      ))}

      {includeFounding ? (
        <PlanCard
          id="plan-founding"
          name={`Founder ${FOUNDING_SPOTS}`}
          price={`$${FOUNDING_PRICE_USD}`}
          unit="once, not per month"
          outcome="Pay once and never think about the price again."
          points={[
            "Everything in Pro, for as long as Driftly exists",
            "No renewal, no card kept on file",
            "New Pro features as they ship",
            `Only ${FOUNDING_SPOTS} spots`,
          ]}
          cta={`Take a founding spot — $${FOUNDING_PRICE_USD}`}
          hash="founding"
        />
      ) : null}
    </div>
  );
}

/**
 * A pricing card.
 *
 * The outcome line sits directly under the price and is the only bold sentence
 * in the card, because that is the thing being bought. Feature bullets are
 * capped at four: past that the eye stops reading and starts comparing list
 * lengths, which is the opposite of the intent.
 *
 * Exactly one card is `featured`. Two emphasised cards is the same as none.
 */
export function PlanCard({
  id,
  name,
  price,
  unit,
  outcome,
  points,
  cta,
  to,
  search,
  onSelect,
  hash,
  featured = false,
  strikethrough = null,
  badge = null,
  highlighted = false,
  footer,
}: {
  id?: string;
  name: string;
  price: string;
  unit: string;
  outcome: string;
  points: string[];
  cta: string;
  to?: "/tracker" | "/business";
  search?: { plan: "starter" | "pro" | "teams"; interval: PlanCardBilling };
  onSelect?: () => void;
  /** Links to /pricing#<hash>, used by the Founding card on marketing pages. */
  hash?: string;
  featured?: boolean;
  /** The monthly price this one is anchored against, struck through. */
  strikethrough?: string | null;
  /** "Save XX%" — derived upstream, never typed by hand. */
  badge?: string | null;
  highlighted?: boolean;
  footer?: ReactNode;
}) {
  const ctaClass = cn(
    // 44px minimum: this is the one control on the page that must never be
    // missed on a phone.
    "mt-7 min-h-11 rounded-full py-3 text-center text-sm font-medium transition-colors",
    featured
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border hover:bg-surface-2",
  );

  return (
    <div
      id={id}
      className={cn(
        "surface flex flex-col p-7",
        featured && "border-primary/40 ring-1 ring-primary/15",
        highlighted && "ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className="flex items-center gap-1.5">
          {badge ? (
            <span className="rounded-full bg-positive-muted px-2.5 py-0.5 text-[11px] font-semibold text-positive">
              {badge}
            </span>
          ) : null}
          {featured ? (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
              Most chosen
            </span>
          ) : null}
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="num text-4xl font-semibold tracking-tight">{price}</span>
        {/* The anchor sits next to the price, not in the footnotes. */}
        {strikethrough ? (
          <span className="num text-lg text-muted-foreground line-through">{strikethrough}</span>
        ) : null}
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>

      <p className="mt-4 text-sm font-medium leading-relaxed">{outcome}</p>

      <ul className="mt-5 flex-1 space-y-2.5 text-sm text-muted-foreground">
        {points.map((p) => (
          <li key={p} className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-positive" aria-hidden />
            <span>{p}</span>
          </li>
        ))}
      </ul>

      {onSelect ? (
        // Never disabled while auth hydrates. The session is resolved inside
        // the handler instead, so a click always does something.
        <button type="button" onClick={onSelect} className={ctaClass}>
          {cta}
        </button>
      ) : hash ? (
        <Link to="/pricing" hash={hash} className={ctaClass}>
          {cta}
        </Link>
      ) : search ? (
        // Hardcoded to "/pricing" rather than a variable route. A variable `to`
        // widens to every route in the tree, so TanStack falls back to the root
        // search schema and rejects { plan, interval }.
        <Link to="/pricing" search={search} className={ctaClass}>
          {cta}
        </Link>
      ) : (
        <Link to={to ?? "/tracker"} className={ctaClass}>
          {cta}
        </Link>
      )}

      {footer}
    </div>
  );
}
