import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Check, GitCompareArrows, Plus, TriangleAlert, X } from "lucide-react";
import { getCity } from "@/lib/cities";
import {
  type CostTier,
  computeArbitrage,
  costLines,
  flagEmoji,
  formatUsd,
  isSchengenCity,
  nomadIncomeMonthly,
  taxYearLabel,
  taxYearWarning,
  touristDaysFor,
  touristDaysWithExtension,
} from "@/lib/arbitrage";
import {
  SCORE_LABELS,
  SCORE_MAX,
  VISA_RULE_DESCRIPTIONS,
  VISA_RULE_LABELS,
  type VisaRuleType,
} from "@/lib/types";
import { useProfile, useSavedCities } from "@/lib/store";
import { isPaid } from "@/lib/entitlements";
import { formatLocal } from "@/lib/fx";
import { ConfidenceBadge, ScoreBar, Stat } from "@/components/Primitives";
import { PartnerGroup } from "@/components/partners/PartnerCard";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";
import { useCityContent } from "@/lib/i18n/city-content";
import { TranslatedField } from "@/components/i18n/TranslatedField";
import { TranslationStatusBanner } from "@/components/i18n/TranslationStatusBanner";
import { hreflangLinks } from "@/lib/i18n/hreflang";

export const Route = createFileRoute("/city/$cityId")({
  loader: ({ params }) => {
    const city = getCity(params.cityId);
    if (!city) throw notFound();
    return { city };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "City unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const { city } = loaderData;
    const title = `${city.city}, ${city.country} — cost, visa and tax | ${APP_NAME}`;
    const description = `What ${city.city} costs you: personalised monthly surplus, visa days for your passport, tax residency triggers and the honest downsides.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      // One indexable URL per language for the same city.
      links: [
        { rel: "canonical", href: `/city/${city.id}` },
        ...hreflangLinks(`/city/${city.id}`),
      ],
    };
  },
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div className="py-16 text-center">City not found.</div>,
  component: CityDetail,
});

function CityDetail() {
  const { city } = Route.useLoaderData();
  const cityContent = useCityContent();
  const { profile, patchProfile } = useProfile();
  const { saved, toggle } = useSavedCities();
  const [tier, setTier] = useState<CostTier>("mid");
  const [showMath, setShowMath] = useState(false);

  const income = profile.monthly_income_usd;
  const arb = computeArbitrage(city, income, tier, profile.savings_usd);
  const touristDays = touristDaysFor(city);
  const nomad = city.visa.nomadVisa.exists ? city.visa.nomadVisa : null;
  const nomadIncome = nomadIncomeMonthly(city);
  const clearsIncome = nomadIncome != null ? (income ?? 0) >= nomadIncome : false;
  const schengen = isSchengenCity(city);
  const ruleType = city.visa.ruleType as VisaRuleType;
  const lines = costLines(city);
  const maxLine = Math.max(...lines.map((l) => l.amount));
  const taxWarning = taxYearWarning(city);
  const regime = city.tax.specialRegime;
  const isSaved = saved.includes(city.id);

  return (
    <div className="space-y-4">
      {/* Honest about provenance: better to say "machine translated" than to
          present a machine-translated visa rule as authoritative. */}
      <TranslationStatusBanner namespaces={["cities", "visa"]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span aria-hidden>{flagEmoji(city.country_code)}</span>
            {city.city}
            <span className="text-muted-foreground">{city.country}</span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Last verified {city.last_verified}</span>
            <ConfidenceBadge confidence={city.confidence} />
            <span>· {city.local_currency}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button"
            onClick={() => toggle(city.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm",
              isSaved && "border-primary text-primary",
            )}
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            {isSaved ? "Saved" : "Save"}
          </button>
          <Link
            to="/compare"
            search={{ cities: city.id }}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm"
          >
            <GitCompareArrows className="h-4 w-4" />
            Compare
          </Link>
          <Link
            to="/tracker"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Add trip
          </Link>
        </div>
      </div>

      {/* Your numbers */}
      <section className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Your numbers</h2>
          <TierToggle tier={tier} onChange={setTier} />
        </div>

        {income == null ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No income entered yet — these figures stay blank until you add one.{" "}
            <Link to="/profile" className="text-primary underline-offset-2 hover:underline">
              Add income
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Your income" value={`${formatUsd(income)}`} hint="per month" />
              <Stat
                label={`Cost here (${tier === "mid" ? "mid-range" : tier})`}
                value={formatUsd(arb.cost)}
                // Same local-currency treatment as the calculator — one city
                // should never show its cost two different ways.
                hint={formatLocal(arb.cost, city.local_currency) ?? "per month"}
              />
              <Stat
                label="Monthly surplus"
                value={formatUsd(arb.surplusMonthly)}
                tone={arb.surplusMonthly >= 0 ? "positive" : "negative"}
                size="lg"
              />
              <Stat
                label="Annual surplus"
                value={formatUsd(arb.surplusAnnual)}
                tone={arb.surplusAnnual >= 0 ? "positive" : "negative"}
                hint={`${arb.savingsRate.toFixed(0)}% savings rate`}
              />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-border p-3">
                <label className="label-xs" htmlFor="savings">
                  Current savings (optional)
                </label>
                <input
                  id="savings"
                  inputMode="numeric"
                  value={profile.savings_usd ?? ""}
                  onChange={(e) =>
                    patchProfile({
                      savings_usd: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null,
                    })
                  }
                  placeholder="e.g. 18000"
                  className="num mt-1 w-full rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
                />
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="label-xs">Runway</div>
                <div className="num text-2xl font-semibold">
                  {arb.runwayMonths ? `${arb.runwayMonths.toFixed(1)} months` : "—"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {arb.runwayMonths
                    ? "How long your savings alone would last here at this cost tier."
                    : "Add savings to see how long you could last here with no income."}
                </p>
              </div>
            </div>

            <button type="button"
              onClick={() => setShowMath((v) => !v)}
              className="mt-3 text-xs text-primary underline-offset-2 hover:underline"
            >
              {showMath ? "Hide the math" : "Show me how this was calculated"}
            </button>
            {showMath ? (
              <div className="num mt-2 rounded-md border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                <div>
                  cost = dataset {tier === "mid" ? "mid-range" : "lean"} monthly total ={" "}
                  {formatUsd(arb.cost)}
                </div>
                <div>
                  surplus = {formatUsd(income)} − {formatUsd(arb.cost)} ={" "}
                  {formatUsd(arb.surplusMonthly)}
                </div>
                <div>
                  savings rate = {formatUsd(arb.surplusMonthly)} ÷ {formatUsd(income)} ={" "}
                  {arb.savingsRate.toFixed(1)}%
                </div>
                <div className="mt-1">
                  Total is the dataset&apos;s monthly figure for a single remote worker: central
                  1BR, one coworking desk, groceries with ~half of meals out, utilities, mobile
                  data, transport and gym.
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Costs */}
        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Cost breakdown</h2>
            <TierToggle tier={tier} onChange={setTier} />
          </div>
          <div className="space-y-2">
            {lines.map((line) => (
              <div key={line.key}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className={cn(line.inTotal ? "text-foreground" : "text-muted-foreground")}>
                    {line.label}
                    {line.inTotal ? "" : " *"}
                  </span>
                  <span className="num font-medium">{formatUsd(line.amount)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      line.inTotal ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                    style={{ width: `${(line.amount / maxLine) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-baseline justify-between border-t border-border pt-2 text-sm">
              <span className="font-medium">
                Monthly total — {tier === "mid" ? "mid-range" : "lean"}
              </span>
              <span className="num font-semibold">{formatUsd(arb.cost)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            * Reference only — alternatives to central rent, or a per-meal price. Verified{" "}
            {city.last_verified}.
          </p>
        </section>

        {/* Scores */}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Scores</h2>
          <div className="space-y-3">
            <ScoreBar
              label={SCORE_LABELS.internetSpeedMbps}
              value={Math.min(city.scores.internetSpeedMbps, 300)}
              max={300}
              display={`${city.scores.internetSpeedMbps} Mbps`}
            />
            <ScoreBar label={SCORE_LABELS.safety} value={city.scores.safety} max={SCORE_MAX} />
            <ScoreBar
              label={SCORE_LABELS.nomadCommunity}
              value={city.scores.nomadCommunity}
              max={SCORE_MAX}
            />
            <ScoreBar
              label={SCORE_LABELS.walkability}
              value={city.scores.walkability}
              max={SCORE_MAX}
            />
            <ScoreBar
              label={SCORE_LABELS.englishFriendly}
              value={city.scores.englishFriendly}
              max={SCORE_MAX}
            />
            <ScoreBar label={SCORE_LABELS.weather} value={city.scores.weather} max={SCORE_MAX} />
          </div>
          {city.connectivity_warning ? (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--warning)]">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>
                {(() => {
                  const c = cityContent(city.id, "connectivityWarning", city.connectivity_warning);
                  return c ? (
                    <TranslatedField translated={c.display} english={c.english} />
                  ) : null;
                })()}
              </span>
            </p>
          ) : null}
        </section>

        {/* Visa */}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Visa</h2>
          {city.visa.nationalityDependent ? (
            <p className="mb-3 flex items-start gap-2 rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--warning)]">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>Visa rules vary significantly by passport — confirm for yours.</span>
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-4">

            <Stat
              label="Visa-free tourist days"
              value={touristDays === 0 ? "Visa required" : `${touristDays} days`}
              tone={touristDays === 0 ? "negative" : "default"}
              hint={
                city.visa.extensionDays
                  ? `+${city.visa.extensionDays} with an extension (${touristDaysWithExtension(city)} total)`
                  : "No standard extension"
              }
            />
            <Stat label="Rule" value={VISA_RULE_LABELS[ruleType]} size="sm" />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {VISA_RULE_DESCRIPTIONS[ruleType]}
          </p>
          {city.visa.maxDaysPerCalendarYear ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Hard cap of {city.visa.maxDaysPerCalendarYear} days per calendar year.
            </p>
          ) : null}
          {schengen ? (
            <p className="mt-2 rounded-md border border-negative/40 bg-negative-muted px-3 py-2 text-xs text-negative">
              Schengen area — these days share one rolling 90/180 allowance with every other
              Schengen country.{" "}
              <Link to="/tracker" className="underline">
                Open the tracker
              </Link>
            </p>
          ) : (
            <p className="mt-2 rounded-md border border-positive/40 bg-positive-muted px-3 py-2 text-xs text-positive">
              Non-Schengen — days spent here do not burn your Schengen 90/180 allowance.
            </p>
          )}

          {city.visa.notes ? (
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
              {city.visa.notes}
            </p>
          ) : null}
          {city.visa.policyTrialExpiry ? (
            <p className="mt-2 flex items-start gap-2 rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--warning)]">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>
                These visa-free policies are trials, currently set to expire{" "}
                {city.visa.policyTrialExpiry}. Verified {city.last_verified}. If your stay runs
                past that date, confirm the rules before booking anything.
              </span>
            </p>
          ) : null}

          <div className="mt-4 rounded-md border border-border p-3">
            <div className="label-xs">Nomad visa</div>

            {nomad ? (
              <>
                <div className="text-sm font-semibold">{nomad.name}</div>
                <div className="mt-2 space-y-1.5 text-sm">
                  <Row
                    label="Income requirement"
                    value={
                      <span
                        className={cn(
                          "num inline-flex items-center gap-1 font-medium",
                          income == null
                            ? "text-muted-foreground"
                            : clearsIncome
                              ? "text-positive"
                              : "text-negative",
                        )}
                      >
                        {nomadIncome == null
                          ? nomad.requiredSavingsUSD
                            ? `${formatUsd(nomad.requiredSavingsUSD)} in savings`
                            : "None stated"
                          : `${formatUsd(nomadIncome)}/mo`}
                        {income != null && nomadIncome != null ? (
                          clearsIncome ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )
                        ) : null}
                      </span>
                    }
                  />
                  {nomad.approxCostUSD ? (
                    <Row label="Typical cost" value={`${formatUsd(nomad.approxCostUSD)}`} />
                  ) : null}
                  {nomad.durationMonths ? (
                    <Row label="Duration" value={`${nomad.durationMonths} months`} />
                  ) : null}
                  {nomad.staysPerEntryDays ? (
                    <Row label="Stay per entry" value={`${nomad.staysPerEntryDays} days`} />
                  ) : null}
                  <Row label="Renewable" value={nomad.renewable ? "Yes" : "No"} />
                  <Row
                    label="Path to residency"
                    value={nomad.pathToResidency ? "Yes" : "No"}
                  />
                  {(() => {
                    const c = cityContent(city.id, "nomadVisaNotes", nomad.notes);
                    return c ? (
                      <TranslatedField
                        translated={c.display}
                        english={c.english}
                        className="pt-1 text-xs text-muted-foreground"
                      />
                    ) : null;
                  })()}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No dedicated nomad visa. You&apos;re on tourist terms unless you qualify for a
                separate residence route.
              </p>
            )}
          </div>
          {/* Only where a nomad visa actually exists — most applications require
              proof of cover, so this is a requirement note that happens to be
              commercial. Hidden for Pro. When this shows, it is this screen's
              one and only partner card: the "Before you arrive" eSIM card below
              stands down. One card per screen, app-wide. */}

          {nomad && profile.plan !== "pro" ? (
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Most nomad visa applications require proof of health cover for the full permit
                duration
                {nomad.durationMonths ? ` — here that's ${nomad.durationMonths} months` : ""}.
              </p>
              <PartnerGroup
                category="insurance"
                placement="visa_card"
                title="Cover accepted for nomad permits"
                countryCode={city.country_code}
                citySlug={city.id}
                cityId={city.id}
              />
            </div>
          ) : null}
        </section>

        {/*
          TAX CARD — NO PARTNER LINK MAY EVER GO IN THIS SECTION.

          Not an eSIM, not insurance, and above all not a banking link. This
          card shows residency triggers and special regimes (Georgia's 1%
          small-business status, Spain's Beckham Law). Putting "open this
          account" next to "become tax resident here at 183 days" reads as tax
          structuring advice, which is a regulated activity in most of these
          jurisdictions and one we are not licensed to give. Banking lives on
          the Nomad kit page, in its own section, deliberately far from here.
          See BANKING_FREE_ZONES in src/config/partners.ts.

          Local banking context for a city is editorial only: write it into
          `arbitrage_note` with no link attached. Information, not a referral.
        */}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Tax</h2>

          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Residency trigger"
              value={`${city.tax.residencyTriggerDays} days`}
              hint="in the tax year"
            />
            <Stat
              label="Tax year"
              value={taxYearLabel(city)}
              hint={taxWarning ? "Non-calendar year" : "Calendar year"}
            />
          </div>
          {taxWarning ? (
            <p className="mt-3 flex items-start gap-2 rounded-md border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-3 py-2 text-xs font-medium text-[var(--warning)]">
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" aria-hidden />
              <span>
                {taxWarning} Your {city.tax.residencyTriggerDays}-day count resets on the tax-year
                boundary, not on 1 January.
              </span>
            </p>
          ) : null}
          {city.tax.windowNote ? (
            <p className="mt-2 text-xs text-muted-foreground">{city.tax.windowNote}</p>
          ) : null}
          {regime ? (
            <div className="mt-3 rounded-md border-s-2 border-s-primary border border-primary/30 bg-primary/5 p-3">
              <div className="label-xs text-primary">Special tax regime</div>
              <p className="text-sm font-semibold">{regime.name}</p>
              <p className="num text-sm">{regime.rate}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {regime.years ? `Available for up to ${regime.years} years. ` : ""}
                {regime.turnoverCapUSD
                  ? `Turnover cap ~${formatUsd(regime.turnoverCapUSD)}/yr. `
                  : ""}
                For a high earner this can matter more than the rent difference.
              </p>
            </div>
          ) : null}
          {(() => {
            const c = cityContent(city.id, "taxNotes", city.tax.notes);
            return c ? (
              <TranslatedField
                translated={c.display}
                english={c.english}
                className="mt-3 text-sm text-muted-foreground"
              />
            ) : null;
          })()}
          {city.tax.foreignIncomeExemptForNomadVisa ? (
            <p className="mt-2 rounded-md border border-positive/40 bg-positive-muted px-3 py-2 text-xs text-positive">
              Foreign-sourced income is generally exempt for nomad-permit holders here.
            </p>
          ) : null}
        </section>
      </div>

      {/* The honest note */}
      <section className="panel border-s-2 border-s-primary p-4">
        <h2 className="mb-2 text-sm font-semibold">The honest note</h2>
        {(() => {
          const c = cityContent(city.id, "arbitrageNote", city.arbitrage_note);
          return c ? <TranslatedField translated={c.display} english={c.english} /> : null;
        })()}
      </section>

      {/* Before you arrive — deliberately last, after the numbers. Pro subscribers
          paid to not be sold to while browsing, so they never see this. Skipped
          entirely when the visa card already carried this screen's one card. */}
      {isPaid(profile.plan) || nomad ? null : (

        <section className="panel p-4">
          <h2 className="text-sm font-semibold">Before you arrive</h2>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">
            One eSIM option for landing in {city.country} with data. The note is ours, and it
            doesn&apos;t affect where {city.city} ranks anywhere in {APP_NAME}.
          </p>

          <PartnerGroup
            category="esim"
            placement="city_detail"
            title="eSIM"
            countryCode={city.country_code}
            citySlug={city.id}
            cityId={city.id}
          />
        </section>
      )}

      <LegalFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-end">{value}</span>
    </div>
  );
}

function TierToggle({
  tier,
  onChange,
}: {
  tier: CostTier;
  onChange: (t: CostTier) => void;
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5 text-xs">
      {(["lean", "mid", "luxury"] as const).map((t) => (
        <button type="button"
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded px-2 py-1 capitalize",
            tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {t === "mid" ? "mid-range" : t}
        </button>
      ))}
    </div>
  );
}
