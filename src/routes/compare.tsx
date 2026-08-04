/**
 * PARTNER-FREE ZONE (see PARTNER_FREE_ZONES in src/config/partners.ts).
 * No affiliate link may ever be rendered here. The Compare table
 * decides what the app recommends, and that must depend only on the user's
 * income, their filters and the seed data — never on commission.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CITIES, getCity } from "@/lib/cities";
import {
  computeArbitrage,
  flagEmoji,
  formatUsd,
  isSchengenCity,
  monthlyCost,
  nomadIncomeMonthly,
  taxYearLabel,
  touristDaysFor,
} from "@/lib/arbitrage";
import { useProfile } from "@/lib/store";
import { EmptyState } from "@/components/Primitives";
import { LegalFooter } from "@/components/LegalFooter";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";
import type { City } from "@/lib/types";

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>) => ({
    cities: typeof search['cities'] === "string" ? (search['cities'] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: `Compare cities | ${APP_NAME}` },
      {
        name: "description",
        content:
          "Put two to four cities side by side: cost, surplus, visa days for your passport, tax triggers and scores.",
      },
      { property: "og:title", content: `Compare cities | ${APP_NAME}` },
      {
        property: "og:description",
        content: "Two to four cities, side by side, personalised to your income and passport.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { cities: raw } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const { profile } = useProfile();
  const income = profile.monthly_income_usd;

  const ids = raw.split(",").filter(Boolean).slice(0, 4);
  const selected = ids.map(getCity).filter(Boolean) as City[];

  const setIds = (next: string[]) =>
    navigate({ search: { cities: next.slice(0, 4).join(",") } });

  const bestOf = (fn: (c: City) => number, highest = true) => {
    if (selected.length === 0) return null;
    const values = selected.map(fn);
    const target = highest ? Math.max(...values) : Math.min(...values);
    return target;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Compare</h1>
        <p className="text-sm text-muted-foreground">
          Pick 2–4 cities. The URL is shareable, numbers stay personal to whoever opens it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CITIES.map((city) => {
          const active = ids.includes(city.id);
          return (
            <button
              key={city.id}
              onClick={() =>
                setIds(active ? ids.filter((i: string) => i !== city.id) : [...ids, city.id])
              }
              disabled={!active && ids.length >= 4}
              className={cn(
                "rounded-full border border-border px-3 py-1.5 text-xs disabled:opacity-40",
                active && "border-primary bg-primary/10 text-primary",
              )}
            >
              {flagEmoji(city.country_code)} {city.city}
            </button>
          );
        })}
      </div>

      {selected.length < 2 ? (
        <EmptyState
          title="Select at least two cities"
          body="Comparison rows highlight the best value per line — cheapest cost, largest surplus, fastest internet, most visa days."
        />
      ) : (
        <div className="panel overflow-x-auto hide-scrollbar">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="label-xs px-4 py-3 text-start font-medium">Metric</th>
                {selected.map((city) => (
                  <th key={city.id} className="px-4 py-3 text-end">
                    <Link
                      to="/city/$cityId"
                      params={{ cityId: city.id }}
                      className="hover:text-primary"
                    >
                      <div className="font-semibold">
                        {flagEmoji(city.country_code)} {city.city}
                      </div>
                      <div className="text-[11px] font-normal text-muted-foreground">
                        verified {city.last_verified}
                      </div>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <CompareRow
                label="Monthly cost (mid)"
                cities={selected}
                value={(c) => formatUsd(monthlyCost(c))}
                best={bestOf((c) => monthlyCost(c), false)}
                raw={(c) => monthlyCost(c)}
              />
              <CompareRow
                label="Monthly surplus"
                cities={selected}
                value={(c) =>
                  income ? formatUsd(computeArbitrage(c, income).surplusMonthly) : "—"
                }
                best={bestOf((c) => computeArbitrage(c, income).surplusMonthly)}
                raw={(c) => computeArbitrage(c, income).surplusMonthly}
              />
              <CompareRow
                label="Annual surplus"
                cities={selected}
                value={(c) =>
                  income ? formatUsd(computeArbitrage(c, income).surplusAnnual) : "—"
                }
                best={bestOf((c) => computeArbitrage(c, income).surplusAnnual)}
                raw={(c) => computeArbitrage(c, income).surplusAnnual}
              />
              <CompareRow
                label="Savings rate"
                cities={selected}
                value={(c) =>
                  income ? `${computeArbitrage(c, income).savingsRate.toFixed(0)}%` : "—"
                }
                best={bestOf((c) => computeArbitrage(c, income).savingsRate)}
                raw={(c) => computeArbitrage(c, income).savingsRate}
              />
              <CompareRow
                label="Internet"
                cities={selected}
                value={(c) => `${c.scores.internetSpeedMbps} Mbps`}
                best={bestOf((c) => c.scores.internetSpeedMbps)}
                raw={(c) => c.scores.internetSpeedMbps}
              />
              <CompareRow
                label="Safety"
                cities={selected}
                value={(c) => c.scores.safety.toFixed(1)}
                best={bestOf((c) => c.scores.safety)}
                raw={(c) => c.scores.safety}
              />
              <CompareRow
                label="Nomad community"
                cities={selected}
                value={(c) => c.scores.nomadCommunity.toFixed(1)}
                best={bestOf((c) => c.scores.nomadCommunity)}
                raw={(c) => c.scores.nomadCommunity}
              />
              <CompareRow
                label="Visa-free tourist days"
                cities={selected}
                value={(c) => `${touristDaysFor(c)}`}
                best={bestOf((c) => touristDaysFor(c))}
                raw={(c) => touristDaysFor(c)}
              />
              <CompareRow
                label="Nomad visa"
                cities={selected}
                value={(c) => (c.visa.nomadVisa.exists ? c.visa.nomadVisa.name : "None")}
              />
              <CompareRow
                label="Visa income req."
                cities={selected}
                value={(c) => {
                  const req = nomadIncomeMonthly(c);
                  if (!c.visa.nomadVisa.exists) return "—";
                  return req == null ? "Savings-based" : formatUsd(req);
                }}
              />
              <CompareRow
                label="Schengen"
                cities={selected}
                value={(c) => (isSchengenCity(c) ? "Yes — burns 90/180" : "No")}
              />
              <CompareRow
                label="Tax residency trigger"
                cities={selected}
                value={(c) => `${c.tax.residencyTriggerDays} days`}
              />
              <CompareRow
                label="Tax year"
                cities={selected}
                value={(c) => taxYearLabel(c)}
              />
              <CompareRow
                label="Special regime"
                cities={selected}
                value={(c) => c.tax.specialRegime?.name ?? "None"}
              />
            </tbody>
          </table>
        </div>
      )}

      <LegalFooter />
    </div>
  );
}

function CompareRow({
  label,
  cities,
  value,
  best,
  raw,
}: {
  label: string;
  cities: City[];
  value: (c: City) => string;
  best?: number | null;
  raw?: (c: City) => number;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="px-4 py-2.5 text-muted-foreground">{label}</td>
      {cities.map((city) => {
        const isBest = best != null && raw ? raw(city) === best : false;
        return (
          <td
            key={city.id}
            className={cn(
              "num px-4 py-2.5 text-end",
              isBest && "bg-positive-muted font-semibold text-positive",
            )}
          >
            {value(city)}
          </td>
        );
      })}
    </tr>
  );
}
