import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";
import {
  BANKING_DISCLAIMER,
  BANKING_PLACEMENTS,
  partnersForRegion,
  type Partner,
  type PartnerPlacement,
} from "@/config/partners";
import { PartnerCard } from "./PartnerCard";

/**
 * Banking links. Permitted ONLY at `kit_page` and `onboarding` — see the
 * BANKING RULE in src/config/partners.ts.
 *
 * Three things this component guarantees and callers must not work around:
 *  - multi-currency accounts only, never local account opening or "assistance";
 *  - BANKING_DISCLAIMER is always rendered, always visible;
 *  - no recommendation language. Copy here is comparative fact only. Do not
 *    add "best", "recommended", "top pick" or "you should" to this file.
 *
 * It must never be rendered inside or next to tax content. Doing so turns an
 * affiliate link into what reads as tax structuring advice.
 */
export type BankingPlacement = (typeof BANKING_PLACEMENTS)[number];

export function BankingGroup({
  placement,
  region,
  title = "Money",
  cityId,
}: {
  placement: BankingPlacement;
  /** Country/region of residence as a coverage filter, not a ranking signal. */
  region?: string;
  title?: string;
  cityId?: string | null;
}) {
  const partners = partnersForRegion("banking", region);
  if (partners.length === 0) return null;

  const personal = partners.filter((p) => p.accountType !== "business");
  const business = partners.filter((p) => p.accountType === "business");

  const card = (p: Partner) => (
    <PartnerCard
      key={p.id}
      partner={p}
      placement={placement}
      variant="row"
      ctaLabel="See details"
      cityId={cityId ?? null}
    />
  );

  return (
    <section className="space-y-3">
      <h2 className="label-xs font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Multi-currency accounts — the ones used instead of local banking. We don&apos;t link to
        local account opening or to the agencies that offer to arrange it.
      </p>

      {personal.length > 0 ? (
        <div className="space-y-3">
          <p className="label-xs text-muted-foreground">Personal accounts</p>
          {personal.map(card)}
        </div>
      ) : null}

      {business.length > 0 ? (
        <div className="space-y-3">
          <p className="label-xs text-muted-foreground">Business accounts</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Relevant if you invoice international clients in your company&apos;s name rather than
            your own.
          </p>
          {business.map(card)}
        </div>
      ) : null}

      <BankingDisclaimer />
    </section>
  );
}

/**
 * Standing disclaimer, same always-visible treatment as the visa disclaimer.
 * Required on every banking placement — deposit-taking and payment services
 * are regulated financial promotions in the UK and EU, and the rules reach
 * affiliates too.
 */
export function BankingDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p
      className={
        compact
          ? "flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground"
          : "flex items-start gap-2 rounded-xl border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground"
      }
    >
      <Info className={compact ? "mt-px h-3 w-3 shrink-0" : "mt-0.5 h-4 w-4 shrink-0"} aria-hidden />
      <span>
        {BANKING_DISCLAIMER}{" "}
        <Link to="/how-we-make-money" className="underline hover:text-foreground">
          How we make money
        </Link>
      </span>
    </p>
  );
}
