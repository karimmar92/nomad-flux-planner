import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { CityCard } from "@/components/CityCard";
import { Onboarding } from "@/components/Onboarding";
import { EmptyState } from "@/components/Primitives";
import { CITIES, REGIONS } from "@/lib/cities";
import {
  computeArbitrage,
  formatUsd,
  isSchengenCity,
  monthlyCost,
  nomadIncomeMonthly,
  touristDaysFor,
} from "@/lib/arbitrage";
import { useProfile, useSavedCities } from "@/lib/store";
import { APP_NAME } from "@/lib/app";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${APP_NAME} — what a city costs you, not what it costs` },
      {
        name: "description",
        content:
          "Personalised cost-of-living arbitrage for freelancers: see what you'd keep each month in every city, given your income and passport.",
      },
      { property: "og:title", content: `${APP_NAME} — personalised geo-arbitrage` },
      {
        property: "og:description",
        content: "See what you'd keep each month in every city, given your income and passport.",
      },
    ],
  }),
  component: Explore,
});

type SortKey = "savings" | "cheapest" | "internet" | "weather";

function Explore() {
  const { profile, hydrated } = useProfile();
  const { saved, toggle } = useSavedCities();
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("all");
  const [maxBudget, setMaxBudget] = useState(4000);
  const [minInternet, setMinInternet] = useState(0);
  const [minSafety, setMinSafety] = useState(0);
  const [nomadOnly, setNomadOnly] = useState(false);
  const [outsideSchengen, setOutsideSchengen] = useState(false);
  const [incomeQualifies, setIncomeQualifies] = useState(false);
  const [sort, setSort] = useState<SortKey>("savings");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const income = profile.monthly_income_usd;

  const cities = useMemo(() => {
    const list = CITIES.filter((city) => {
      const cost = monthlyCost(city);
      if (query) {
        const q = query.toLowerCase();
        if (!city.city.toLowerCase().includes(q) && !city.country.toLowerCase().includes(q))
          return false;
      }
      if (region !== "all" && city.region !== region) return false;
      if (cost > maxBudget) return false;
      if (city.scores.internetSpeedMbps < minInternet) return false;
      if (city.scores.safety < minSafety) return false;
      if (nomadOnly && !city.visa.nomadVisa.exists) return false;
      if (outsideSchengen && isSchengenCity(city)) return false;
      if (incomeQualifies) {
        const req = nomadIncomeMonthly(city) ?? 0;
        if (!income || income < req) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sort === "cheapest") return monthlyCost(a) - monthlyCost(b);
      if (sort === "internet") return b.scores.internetSpeedMbps - a.scores.internetSpeedMbps;
      if (sort === "weather") return b.scores.weather - a.scores.weather;
      return (
        computeArbitrage(b, income).surplusMonthly - computeArbitrage(a, income).surplusMonthly
      );
    });
  }, [
    query,
    region,
    maxBudget,
    minInternet,
    minSafety,
    nomadOnly,
    outsideSchengen,
    incomeQualifies,
    sort,
    income,
  ]);

  const best = cities[0] ? computeArbitrage(cities[0], income) : null;

  return (
    <div className="space-y-5">
      {hydrated && !profile.onboarded && showOnboarding ? (
        <Onboarding onDone={() => setShowOnboarding(false)} />
      ) : null}

      <section className="panel p-4">
        <h1 className="text-xl font-semibold tracking-tight">
          {income
            ? `On ${formatUsd(income)}/mo, here's what you'd keep.`
            : "Add your income to personalise every number."}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {income && best && cities[0]
            ? `Best right now: ${cities[0].city} — ${formatUsd(best.surplusMonthly)}/mo surplus, ${best.savingsRate.toFixed(0)}% savings rate. Visa-free tourist days there: ${touristDaysFor(cities[0])}.`
            : "Every figure below is generic until we know your income and passport."}
        </p>
        {!income ? (
          <Link
            to="/profile"
            className="mt-3 inline-flex rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            Enter income
          </Link>
        ) : null}
      </section>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city or country"
            className="w-full rounded-md border border-input bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm",
            filtersOpen && "border-primary text-primary",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
        </button>
      </div>

      {filtersOpen ? (
        <div className="panel grid gap-4 p-4 sm:grid-cols-2">
          <div>
            <label className="label-xs">Region</label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
            >
              <option value="all">All regions</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-xs">Sort</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="mt-1 w-full rounded-md border border-input bg-surface px-2 py-2 text-sm"
            >
              <option value="savings">Highest savings</option>
              <option value="cheapest">Cheapest</option>
              <option value="internet">Fastest internet</option>
              <option value="weather">Best weather</option>
            </select>
          </div>
          <RangeRow
            label="Max monthly budget"
            value={maxBudget}
            display={formatUsd(maxBudget)}
            min={500}
            max={5000}
            step={100}
            onChange={setMaxBudget}
          />
          <RangeRow
            label="Min internet"
            value={minInternet}
            display={`${minInternet} Mbps`}
            min={0}
            max={250}
            step={10}
            onChange={setMinInternet}
          />
          <RangeRow
            label="Min safety score"
            value={minSafety}
            display={`${minSafety.toFixed(1)} / 5`}
            min={0}
            max={5}
            step={0.5}
            onChange={setMinSafety}
          />
          <div className="flex flex-wrap items-end gap-2">
            <Toggle active={nomadOnly} onClick={() => setNomadOnly((v) => !v)}>
              Has nomad visa
            </Toggle>
            <Toggle active={outsideSchengen} onClick={() => setOutsideSchengen((v) => !v)}>
              Outside Schengen
            </Toggle>
            <Toggle active={incomeQualifies} onClick={() => setIncomeQualifies((v) => !v)}>
              I meet the income requirement
            </Toggle>
          </div>
        </div>
      ) : null}

      {cities.length === 0 ? (
        <EmptyState
          title="No cities match those filters"
          body="Loosen the budget or internet minimum to see more of the 25-city dataset."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <CityCard
              key={city.id}
              city={city}
              income={income}
              saved={saved.includes(city.id)}
              onToggleSave={() => toggle(city.id)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {cities.length} of {CITIES.length} cities. Cost figures carry a last-verified date
        on each city page.
      </p>
    </div>
  );
}

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="label-xs">{label}</label>
        <span className="num text-xs font-medium">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]"
      />
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border border-border px-3 py-1.5 text-xs",
        active && "border-primary bg-primary/10 text-primary",
      )}
    >
      {children}
    </button>
  );
}
