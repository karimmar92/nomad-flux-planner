import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import {
  partnersByCategory,
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
}: {
  partner: Partner;
  placement: PartnerPlacement;
  countryCode?: string;
  citySlug?: string;
  cityId?: string | null;
}) {
  const href = partnerUrl(partner, { countryCode: countryCode ?? "", citySlug: citySlug ?? "" });

  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-surface p-3">
      <a
        href={href}
        target="_blank"
        rel="sponsored noopener"
        onClick={() =>
          logPartnerClick({ partner_id: partner.id, placement, city_id: cityId ?? null })
        }
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
}: {
  category: PartnerCategory;
  placement: PartnerPlacement;
  title: string;
  countryCode?: string;
  citySlug?: string;
  cityId?: string | null;
}) {
  const partners = partnersByCategory(category);
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
