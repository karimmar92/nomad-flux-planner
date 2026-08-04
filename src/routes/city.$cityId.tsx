import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Bookmark, Check, GitCompareArrows, Plus, X } from "lucide-react";
import { getCity } from "@/lib/cities";
import {
  computeArbitrage,
  flagEmoji,
  formatUsd,
  monthlyCost,
  touristDaysFor,
} from "@/lib/arbitrage";
import { COST_LABELS, CORE_COST_KEYS, SCORE_LABELS, type Costs } from "@/lib/types";
import { useProfile, useSavedCities } from "@/lib/store";
import { ConfidenceBadge, ScoreBar, Stat } from "@/components/Primitives";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

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
      ],
    };
  },
  errorComponent: ({ error }) => <div role="alert">{error.message}</div>,
  notFoundComponent: () => <div className="py-16 text-center">City not found.</div>,
  component: CityDetail,
});

function CityDetail() {
  const { city } = Route.useLoaderData();
  const { profile, patchProfile } = useProfile();
  const { saved, toggle } = useSavedCities();
  const [tier, setTier] = useState<"lean" | "mid">("mid");
  const [showMath, setShowMath] = useState(false);

  const income = profile.monthly_income_usd;
  const arb = computeArbitrage(city, income, tier, profile.savings_usd);
  const touristDays = touristDaysFor(city, profile.nationality);
  const nomad = city.visa.nomad_visa;
  const clearsIncome = nomad ? (income ?? 0) >= nomad.income_usd_monthly : false;
  const isSaved = saved.includes(city.id);

  return (
    <div className="space-y-4">
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
          <button
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
                label={`Cost here (${tier})`}
                value={formatUsd(arb.cost)}
                hint="per month"
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

            <button
              onClick={() => setShowMath((v) => !v)}
              className="mt-3 text-xs text-primary underline-offset-2 hover:underline"
            >
              {showMath ? "Hide the math" : "Show me how this was calculated"}
            </button>
            {showMath ? (
              <div className="num mt-2 rounded-md border border-border bg-surface-2 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                <div>
                  cost = {CORE_COST_KEYS.map((k) => city.costs[k][tier]).join(" + ")} ={" "}
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
                  Basket excludes coliving and outskirts rent (alternatives to central rent).
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
            {(Object.keys(COST_LABELS) as (keyof Costs)[]).map((key) => {
              const amount = city.costs[key][tier];
              const max = Math.max(...Object.values(city.costs).map((v) => v[tier]));
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span
                      className={cn(
                        CORE_COST_KEYS.includes(key)
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {COST_LABELS[key]}
                      {CORE_COST_KEYS.includes(key) ? "" : " *"}
                    </span>
                    <span className="num font-medium">{formatUsd(amount)}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        CORE_COST_KEYS.includes(key) ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                      style={{ width: `${(amount / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            * Not counted in the basket — alternatives to central rent. Verified{" "}
            {city.last_verified}.
          </p>
        </section>

        {/* Scores */}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Scores</h2>
          <div className="space-y-3">
            <ScoreBar
              label={SCORE_LABELS.internet_mbps}
              value={Math.min(city.scores.internet_mbps, 300)}
              max={300}
              display={`${city.scores.internet_mbps} Mbps`}
            />
            <ScoreBar label={SCORE_LABELS.safety} value={city.scores.safety} />
            <ScoreBar label={SCORE_LABELS.community} value={city.scores.community} />
            <ScoreBar label={SCORE_LABELS.walkability} value={city.scores.walkability} />
            <ScoreBar label={SCORE_LABELS.english} value={city.scores.english} />
            <ScoreBar label={SCORE_LABELS.weather} value={city.scores.weather} />
          </div>
        </section>

        {/* Visa */}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Visa</h2>
          <div className="flex items-baseline gap-2">
            <Stat
              label={`Tourist days — ${profile.nationality} passport`}
              value={touristDays === 0 ? "Visa required" : `${touristDays} days`}
              tone={touristDays === 0 ? "negative" : "default"}
            />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{city.visa.rule}</p>
          {city.visa.schengen ? (
            <p className="mt-2 rounded-md border border-negative/40 bg-negative-muted px-3 py-2 text-xs text-negative">
              Schengen area — these days share one rolling 90/180 allowance with every other
              Schengen country.{" "}
              <Link to="/tracker" className="underline">
                Open the tracker
              </Link>
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
                        {nomad.income_usd_monthly === 0
                          ? "None stated"
                          : `${formatUsd(nomad.income_usd_monthly)}/mo`}
                        {income != null && nomad.income_usd_monthly > 0 ? (
                          clearsIncome ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <X className="h-4 w-4" />
                          )
                        ) : null}
                      </span>
                    }
                  />
                  <Row label="Duration" value={`${nomad.duration_months} months`} />
                  <Row label="Renewable" value={nomad.renewable ? "Yes" : "No"} />
                  <Row label="Path to residency" value={nomad.residency_path} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No dedicated nomad visa. You&apos;re on tourist terms unless you qualify for a
                separate residence route.
              </p>
            )}
          </div>
        </section>

        {/* Tax */}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Tax</h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat
              label="Residency trigger"
              value={`${city.tax.residency_trigger_days} days`}
              hint="in the tax year"
            />
            <Stat
              label="Tax year"
              value={city.tax.tax_year}
              tone={city.tax.tax_year_start_month !== 0 ? "negative" : "default"}
              hint={
                city.tax.tax_year_start_month !== 0
                  ? "Non-calendar year — plan around this"
                  : "Calendar year"
              }
            />
          </div>
          {city.tax.tax_year_start_month !== 0 ? (
            <p className="mt-3 rounded-md border border-negative/40 bg-negative-muted px-3 py-2 text-xs text-negative">
              This country&apos;s tax year does not follow the calendar. Day counts reset in{" "}
              {city.tax.tax_year.split("–")[0]}, not January.
            </p>
          ) : null}
          {city.tax.special_regime ? (
            <div className="mt-3 rounded-md border border-border bg-surface-2 p-3">
              <div className="label-xs">Special regime</div>
              <p className="text-sm">{city.tax.special_regime}</p>
            </div>
          ) : null}
        </section>
      </div>

      {/* The honest note */}
      <section className="panel border-l-2 border-l-primary p-4">
        <h2 className="mb-2 text-sm font-semibold">The honest note</h2>
        <p className="text-sm leading-relaxed text-foreground/90">{city.arbitrage_note}</p>
      </section>

      <LegalFooter />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function TierToggle({
  tier,
  onChange,
}: {
  tier: "lean" | "mid";
  onChange: (t: "lean" | "mid") => void;
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5 text-xs">
      {(["lean", "mid"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded px-2 py-1 capitalize",
            tier === t ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {t === "mid" ? "mid-range" : "lean"}
        </button>
      ))}
    </div>
  );
}
