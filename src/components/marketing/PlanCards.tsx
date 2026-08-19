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
import { annualUsd, tier } from "@/config/pricing";

export type PlanCardBilling = "monthly" | "annual";

/** The two self-serve plans, in order. Content lives here, not in the pages. */
function planContent(billing: PlanCardBilling) {
  const pro = tier("pro");
  const proAnnual = annualUsd(pro);
  return [
    {
      id: "free" as const,
      name: "Free",
      price: "$0",
      unit: "always",
      outcome: "Know where you stand today.",
      points: [
        "Unlimited trips, no cap, ever",
        "Your Schengen status right now",
        "Day counts for every country",
        `All ${CITIES.length} cities and their costs`,
      ],
      cta: "Start tracking",
      featured: false,
    },
    {
      id: "pro" as const,
      name: "Pro",
      price: billing === "annual" ? `$${proAnnual}` : `$${pro.monthlyUsd}`,
      unit: billing === "annual" ? "per year · two months free" : "per month",
      outcome: "Plan the next move before it becomes urgent.",
      points: [
        "Border-run planning, every exit ranked",
        "Alerts at 75% and 90% of any limit",
        "Tax presence report and exports",
        "Document vault, offline at the border",
      ],
      cta: "Choose Pro",
      featured: true,
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
}: {
  billing?: PlanCardBilling;
  onSelect?: (plan: "free" | "pro", billing: PlanCardBilling) => void;
  busyPlan?: string | null;
  highlight?: string | null;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
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
          highlighted={highlight === p.id}
          cta={busyPlan === p.id ? "Opening checkout…" : p.cta}
          {...(onSelect
            ? { onSelect: () => onSelect(p.id, billing) }
            : p.id === "pro"
              ? { search: { plan: "pro" as const, interval: billing } }
              : { to: "/tracker" as const })}
        />
      ))}
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
  featured = false,
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
  featured?: boolean;
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
        {featured ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            Most chosen
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="num text-4xl font-semibold tracking-tight">{price}</span>
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
