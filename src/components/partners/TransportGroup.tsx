import { partnersForRegion, type PartnerPlacement } from "@/config/partners";
import { PartnerCard } from "./PartnerCard";

/**
 * Transport links. Permitted ONLY at `border_run`, `trip_confirm` and
 * `kit_page` — see the TRANSPORT RULE in src/config/partners.ts. Rendering
 * this anywhere a move is not already decided or forced is a product bug, not
 * a styling choice.
 *
 * Region filtered: a European rail aggregator is useless to someone in Vietnam.
 */
export function TransportGroup({
  placement,
  region,
  fromCity,
  toCity,
  date,
  cityId,
  title = "Getting there",
  variant = "compact",
}: {
  placement: Extract<PartnerPlacement, "border_run" | "trip_confirm" | "kit_page">;
  /** Destination region, used purely as a coverage filter. */
  region?: string;
  fromCity?: string;
  toCity?: string;
  date?: string;
  cityId?: string | null;
  title?: string;
  variant?: "compact" | "row";
}) {
  const partners = partnersForRegion("transport", region);
  if (partners.length === 0) return null;

  const cards = partners.map((p) => (
    <PartnerCard
      key={p.id}
      partner={p}
      placement={placement}
      variant={variant}
      ctaLabel="Check routes"
      cityId={cityId ?? null}
      {...(fromCity ? { fromCity } : {})}
      {...(toCity ? { toCity } : {})}
      {...(date ? { date } : {})}
    />
  ));

  if (variant === "row") {
    return (
      <section className="space-y-3">
        <h2 className="label-xs font-semibold">{title}</h2>
        {cards}
      </section>
    );
  }

  return (
    <div>
      <div className="label-xs mb-2">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2">{cards}</div>
    </div>
  );
}
