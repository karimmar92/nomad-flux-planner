import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import {
  partnersByCategory,
  partnersForRegion,
  partnerUrl,
  type Partner,
  type PartnerCategory,
  type PartnerPlacement,
} from "@/config/partners";
import { logPartnerClick } from "@/lib/partner-clicks";

/**
 * The only component allowed to render an outbound partner link.
 * Always renders the disclosure directly beneath the link, always logs the
 * click, always uses rel="sponsored noopener".
 */
export function PartnerCard({
  partner,
  placement,
  countryCode,
  citySlug,
  cityId,
  fromCity,
  toCity,
  date,
  variant = "compact",
  ctaLabel,
}: {
  partner: Partner;
  placement: PartnerPlacement;
  countryCode?: string;
  citySlug?: string;
  cityId?: string | null;
  /** Route context, transport partners only. */
  fromCity?: string;
  toCity?: string;
  date?: string;
  /** "row" is the full-width Nomad kit treatment; "compact" is the inline card. */
  variant?: "compact" | "row";
  ctaLabel?: string;
}) {
  const href = partnerUrl(partner, {
    countryCode: countryCode ?? "",
    citySlug: citySlug ?? "",
    fromCity: fromCity ?? "",
    toCity: toCity ?? "",
    date: date ?? "",
  });
  const onClick = () =>
    logPartnerClick({ partner_id: partner.id, placement, city_id: cityId ?? null });

  if (variant === "row") {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight tracking-tight text-foreground">
              {partner.name}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{partner.note}</p>
          </div>
          <a
            href={href}
            target="_blank"
            rel="sponsored noopener"
            onClick={onClick}
            className="shrink-0 rounded-full bg-accent-positive-muted px-4 py-2 text-sm font-semibold text-accent-positive transition-colors hover:bg-accent-positive hover:text-background"
          >
            {ctaLabel ?? "Compare plans"}
          </a>
        </div>
        <p className="mt-3 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground/80">
          {partner.disclosure}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-surface p-3">
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener"
        onClick={onClick}
        className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary"
      >
        {partner.name}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{partner.note}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
        {partner.disclosure}{" "}
        <Link to="/how-we-make-money" className="underline hover:text-foreground">
          How we make money
        </Link>
      </p>
    </div>
  );
}

export function PartnerGroup({
  category,
  placement,
  title,
  countryCode,
  citySlug,
  cityId,
  variant = "compact",
}: {
  category: PartnerCategory;
  placement: PartnerPlacement;
  title: string;
  countryCode?: string;
  citySlug?: string;
  cityId?: string | null;
  variant?: "compact" | "row";
}) {
  const partners = partnersByCategory(category);

  if (variant === "row") {
    return (
      <section className="space-y-3">
        <h2 className="label-xs font-semibold">{title}</h2>
        {partners.map((p) => (
          <PartnerCard
            key={p.id}
            partner={p}
            placement={placement}
            variant="row"
            {...(countryCode ? { countryCode } : {})}
            {...(citySlug ? { citySlug } : {})}
            cityId={cityId ?? null}
          />
        ))}
      </section>
    );
  }

  return (
    <div>
      <div className="label-xs mb-2">{title}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {partners.map((p) => (
          <PartnerCard
            key={p.id}
            partner={p}
            placement={placement}
            {...(countryCode ? { countryCode } : {})}
            {...(citySlug ? { citySlug } : {})}
            cityId={cityId ?? null}
          />
        ))}
      </div>
    </div>
  );
}
